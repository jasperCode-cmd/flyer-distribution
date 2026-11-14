import { createServer, type IncomingMessage, type Server } from "node:http";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

// A stand-in for the Anthropic Messages API, for Locate's tests and the local
// walkthrough: it answers the way the real API does, with the street-name
// readings recorded from the three real screenshots (fixtures), choosing
// which by comparing the image it is sent with the fixtures. It can be told
// to answer the next few requests as rate limited (429), overloaded (529), a
// refusal, or an unreadable answer. It keeps each request it was sent (the
// body and headers), never logs them, and listens on localhost only.

export type MockMode = "ok" | "rate-limit" | "overloaded" | "refusal" | "bad-json";
export type MockRequest = { body: Record<string, unknown>; headers: IncomingMessage["headers"]; screenshot: string | null };

const dirIn = (dir: string, name: string) => readdirSync(dir).find((f) => f.toLowerCase() === name && statSync(join(dir, f)).isDirectory());

export function fixturesDir(root = process.cwd()): string {
  const tests = join(root, "lib", "__tests__");
  const fixtures = join(tests, dirIn(tests, "fixtures")!);
  return join(fixtures, dirIn(fixtures, "rounds")!);
}

export function fixtureFile(n: string, root = process.cwd()): string {
  const dir = fixturesDir(root);
  return join(dir, readdirSync(dir).find((f) => (n === "3" ? !/\(\d\)/.test(f) : f.includes(`(${n})`)) && /\.jpe?g$/i.test(f))!);
}

const small = async (input: Buffer | string) => (await sharp(input).resize(46, 100, { fit: "fill" }).greyscale().raw().toBuffer()) as Buffer;

export async function startMockAnthropic(root = process.cwd(), port = 0): Promise<{ url: string; requests: MockRequest[]; setMode(mode: MockMode, times?: number): void; close(): Promise<void> }> {
  const readings = JSON.parse(readFileSync(join(fixturesDir(root), "locate-readings.json"), "utf8")).readings as Record<string, { labels: unknown[] }>;
  const refs = await Promise.all(["1", "2", "3"].map(async (n) => ({ n, px: await small(fixtureFile(n, root)) })));
  const requests: MockRequest[] = [];
  let mode: MockMode = "ok";
  let left = 0;
  const which = async (b64: string | undefined) => {
    if (!b64) return null;
    const px = await small(Buffer.from(b64, "base64"));
    let best: string | null = null;
    let bestDiff = Infinity;
    for (const r of refs) {
      let d = 0;
      for (let i = 0; i < px.length; i++) d += Math.abs(px[i] - r.px[i]);
      if (d < bestDiff) {
        bestDiff = d;
        best = r.n;
      }
    }
    // Far from every fixture: an image the mock has no reading for.
    return bestDiff / px.length < 25 ? best : null;
  };
  const server: Server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", async () => {
      const send = (status: number, body: unknown, headers: Record<string, string> = {}) => {
        res.writeHead(status, { "content-type": "application/json", "request-id": `req_mock_${requests.length}`, ...headers });
        res.end(JSON.stringify(body));
      };
      if (req.method === "POST" && req.url === "/__mode") {
        const m = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
        mode = m.mode ?? "ok";
        left = m.times ?? 1;
        return send(200, { ok: true });
      }
      if (req.method !== "POST" || !req.url?.startsWith("/v1/messages")) return send(404, { type: "error", error: { type: "not_found_error", message: "Not found" } });
      let body: Record<string, unknown> = {};
      try {
        body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } catch {
        return send(400, { type: "error", error: { type: "invalid_request_error", message: "Bad JSON" } });
      }
      const content = ((body.messages as { content: { type: string; source?: { data?: string } }[] }[])?.[0]?.content ?? []) as { type: string; source?: { data?: string } }[];
      const screenshot = await which(content.find((c) => c.type === "image")?.source?.data);
      requests.push({ body, headers: req.headers, screenshot });
      const now = left > 0 ? mode : "ok";
      if (left > 0 && --left === 0) mode = "ok";
      if (now === "rate-limit") return send(429, { type: "error", error: { type: "rate_limit_error", message: "Rate limited" } }, { "retry-after": "7" });
      if (now === "overloaded") return send(529, { type: "error", error: { type: "overloaded_error", message: "Overloaded" } });
      const reading = screenshot ? readings[screenshot] : { labels: [] };
      const usage = { input_tokens: 2104, output_tokens: 150 + 36 * reading.labels.length, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 };
      const message = (text: string | null, stop: string) => ({
        id: `msg_mock_${requests.length}`,
        type: "message",
        role: "assistant",
        model: "claude-opus-5-5",
        content: text === null ? [] : [{ type: "text", text }],
        stop_reason: stop,
        stop_sequence: null,
        usage,
      });
      if (now === "refusal") return send(200, message(null, "refusal"));
      if (now === "bad-json") return send(200, message("Here are the labels I found", "end_turn"));
      // Slow enough to look like a real call in the walkthrough's progress.
      await new Promise((r) => setTimeout(r, Number(process.env.MOCK_ANTHROPIC_DELAY_MS ?? 0)));
      send(200, message(JSON.stringify(reading), "end_turn"));
    });
  });
  await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve));
  const address = server.address();
  const url = `http://127.0.0.1:${typeof address === "object" && address ? address.port : port}`;
  return {
    url,
    requests,
    setMode(m: MockMode, times = 1) {
      mode = m;
      left = times;
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
