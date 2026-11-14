import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";
import type { Label } from "./fit";
import { LABEL_SCHEMA, labelPrompt, parseReading } from "./labels";
import { costUsd, LOCATE_MODEL, tokensOf } from "./pricing";

// Reading a screenshot's street names with Claude (on the server only; the
// key is ANTHROPIC_API_KEY and never leaves it). One screenshot per call,
// well inside the server function's time limit: the image at working size
// with a faint numbered grid (pixel positions read best against one), a
// JSON schema for the answer, low effort (it's reading, not reasoning), no
// automatic retries (a busy API sends this screenshot to "Needs line-up" with
// the reason and the batch carries on), and the server-side refusal
// fallback switched on. Nothing about the screenshot or the answer is
// logged: a failure logs only its HTTP status.

export const LOCATE_TIMEOUT_MS = 45_000;
const GRID_PX = 100;

export function locateConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

export type ReadResult =
  | { ok: true; labels: Label[]; costUsd: number; seconds: number; model: string; tokens: { input: number; output: number } }
  | { ok: false; reason: string; retryAfterS: number | null; costUsd: number; seconds: number; model: string | null };

// The screenshot as sent: working size, with the grid.
export async function withGrid(image: Buffer, width: number, height: number): Promise<Buffer> {
  let lines = "";
  for (let x = GRID_PX; x < width; x += GRID_PX)
    lines += `<line x1="${x}" y1="0" x2="${x}" y2="${height}" stroke="yellow" stroke-opacity="0.55" stroke-width="1"/><text x="${x + 2}" y="14" font-size="13" fill="yellow" font-family="DejaVu Sans, Arial">${x}</text><text x="${x + 2}" y="${height - 6}" font-size="13" fill="yellow" font-family="DejaVu Sans, Arial">${x}</text>`;
  for (let y = GRID_PX; y < height; y += GRID_PX)
    lines += `<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="yellow" stroke-opacity="0.55" stroke-width="1"/><text x="2" y="${y - 2}" font-size="13" fill="yellow" font-family="DejaVu Sans, Arial">${y}</text><text x="${width - 34}" y="${y - 2}" font-size="13" fill="yellow" font-family="DejaVu Sans, Arial">${y}</text>`;
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${lines}</svg>`);
  const sized = await sharp(image).resize(width, height, { fit: "fill" }).toBuffer();
  return sharp(sized).composite([{ input: svg }]).jpeg({ quality: 88 }).toBuffer();
}

function failureOf(err: unknown): { reason: string; retryAfterS: number | null; status: string } {
  const retryAfter = (e: unknown) => {
    const v = Number((e as { headers?: { get?: (k: string) => string | null } }).headers?.get?.("retry-after"));
    return Number.isFinite(v) && v > 0 ? Math.min(v, 120) : null;
  };
  if (err instanceof Anthropic.RateLimitError) return { reason: "Claude is busy (rate limited); try Locate again shortly", retryAfterS: retryAfter(err) ?? 20, status: "429" };
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) return { reason: "Locate isn't set up yet (the API key was refused)", retryAfterS: null, status: String(err.status) };
  if (err instanceof Anthropic.APIConnectionTimeoutError) return { reason: "Claude took too long to answer", retryAfterS: 10, status: "timeout" };
  if (err instanceof Anthropic.APIConnectionError) return { reason: "Couldn't reach Claude", retryAfterS: 10, status: "connection" };
  if (err instanceof Anthropic.InternalServerError)
    return { reason: err.status === 529 ? "Claude is overloaded right now; try Locate again shortly" : "Claude had a problem with this screenshot", retryAfterS: retryAfter(err) ?? 20, status: String(err.status) };
  if (err instanceof Anthropic.BadRequestError) return { reason: "Claude couldn't take this screenshot", retryAfterS: null, status: "400" };
  if (err instanceof Anthropic.APIError) return { reason: `Claude returned an error (${err.status ?? "no status"})`, retryAfterS: null, status: String(err.status) };
  return { reason: "Locate failed on this screenshot", retryAfterS: null, status: err instanceof Error ? err.name : "unknown" };
}

export async function readLabels(image: Buffer, width: number, height: number): Promise<ReadResult> {
  const started = Date.now();
  const seconds = () => Math.round((Date.now() - started) / 100) / 10;
  if (!locateConfigured()) return { ok: false, reason: "Locate isn't set up yet", retryAfterS: null, costUsd: 0, seconds: 0, model: null };
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: LOCATE_TIMEOUT_MS, maxRetries: 0 });
  let sent: Buffer;
  try {
    sent = await withGrid(image, width, height);
  } catch {
    return { ok: false, reason: "The screenshot couldn't be read as an image", retryAfterS: null, costUsd: 0, seconds: seconds(), model: null };
  }
  try {
    const response = await client.beta.messages.create({
      model: LOCATE_MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: { type: "json_schema", schema: LABEL_SCHEMA as unknown as Record<string, unknown> } },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: sent.toString("base64") } },
            { type: "text", text: labelPrompt(width, height) },
          ],
        },
      ],
    });
    const cost = costUsd(response.usage, LOCATE_MODEL);
    const model = response.model;
    if (response.stop_reason === "refusal") return { ok: false, reason: "Claude declined to read this screenshot", retryAfterS: null, costUsd: cost, seconds: seconds(), model };
    if (response.stop_reason === "max_tokens") return { ok: false, reason: "Claude's reading was cut short", retryAfterS: null, costUsd: cost, seconds: seconds(), model };
    const text = response.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    let labels: Label[];
    try {
      labels = parseReading(JSON.parse(text), width, height);
    } catch {
      return { ok: false, reason: "Claude's answer couldn't be read", retryAfterS: null, costUsd: cost, seconds: seconds(), model };
    }
    return { ok: true, labels, costUsd: cost, seconds: seconds(), model, tokens: tokensOf(response.usage) };
  } catch (err) {
    const f = failureOf(err);
    // Only the status: never the screenshot, the answer or the key.
    console.warn(`Rounds: Locate's call to Claude failed (${f.status})`);
    return { ok: false, reason: f.reason, retryAfterS: f.retryAfterS, costUsd: 0, seconds: seconds(), model: null };
  }
}
