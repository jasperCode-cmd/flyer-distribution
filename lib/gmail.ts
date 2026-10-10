import "server-only";
import { OAuth2Client } from "google-auth-library";
import { gmail as gmailClient, gmail_v1 } from "@googleapis/gmail";
import { convert as htmlToText } from "html-to-text";

const SCOPES = ["https://www.googleapis.com/auth/gmail.send", "https://www.googleapis.com/auth/gmail.readonly"];
const MAX_MESSAGES = 30;

export type GmailResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: "not_configured" | "reconnect" | "error"; message: string };

export type ConversationMessage = {
  id: string;
  threadId: string;
  messageIdHeader: string | null;
  direction: "sent" | "received";
  from: string;
  date: string;
  subject: string;
  bodyText: string;
  hasAttachment: boolean;
};

export type ThreadContext = {
  threadId: string;
  lastMessageId: string;
};

function readEnv() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
  const senderAddress = process.env.GMAIL_SENDER_ADDRESS;
  if (!clientId || !clientSecret || !refreshToken || !senderAddress) return null;
  return { clientId, clientSecret, refreshToken, senderAddress };
}

export function isGmailConfigured(): boolean {
  return readEnv() !== null;
}

function getExcludedAddresses(): string[] {
  const raw = process.env.GMAIL_EXCLUDE_ADDRESSES;
  if (!raw) return [];
  return raw
    .split(",")
    .map((a) => a.trim().toLowerCase())
    .filter(Boolean);
}

function buildClient(env: NonNullable<ReturnType<typeof readEnv>>) {
  const oauth2Client = new OAuth2Client({ clientId: env.clientId, clientSecret: env.clientSecret });
  oauth2Client.setCredentials({ refresh_token: env.refreshToken, scope: SCOPES.join(" ") });
  return gmailClient({ version: "v1", auth: oauth2Client });
}

// Google errors can carry request/response detail that isn't safe to log
// verbatim (it can echo back parts of the request). Only ever log a short,
// static reason plus err.message, never the full error object.
function classifyError(err: unknown): { reason: "reconnect" | "error"; message: string } {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes("invalid_grant")) {
    return { reason: "reconnect", message: "Gmail needs to be reconnected." };
  }
  return { reason: "error", message: "Gmail request failed." };
}

// --- Pure helpers (no network, no env) -------------------------------------
// Kept separate from the Gmail-calling functions below so they can be unit
// tested directly with hand-built message fixtures, without a real client.

export function encodeMimeHeader(text: string): string {
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(text)) return text;
  return `=?UTF-8?B?${Buffer.from(text, "utf-8").toString("base64")}?=`;
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64").toString("utf-8");
}

export function buildRawMessage(params: {
  from: string;
  to: string;
  subject: string;
  body: string;
  inReplyTo?: string | null;
}): string {
  const lines = [
    `From: ${params.from}`,
    `To: ${params.to}`,
    `Subject: ${encodeMimeHeader(params.subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
  ];
  if (params.inReplyTo) {
    lines.push(`In-Reply-To: ${params.inReplyTo}`);
    lines.push(`References: ${params.inReplyTo}`);
  }
  lines.push("", params.body);
  return base64UrlEncode(lines.join("\r\n"));
}

function getHeader(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string): string | null {
  if (!headers) return null;
  const match = headers.find((h) => h.name?.toLowerCase() === name.toLowerCase());
  return match?.value ?? null;
}

// Walks the MIME tree depth-first, preferring the first text/plain part it
// finds. Falls back to the first text/html part, converted to plain text on
// the server, and never returns HTML to the caller.
function extractBody(part: gmail_v1.Schema$MessagePart | undefined): string {
  if (!part) return "";

  function walk(p: gmail_v1.Schema$MessagePart): { plain: string | null; html: string | null } {
    const mimeType = p.mimeType ?? "";
    if (mimeType === "text/plain" && p.body?.data) {
      return { plain: base64UrlDecode(p.body.data), html: null };
    }
    if (mimeType === "text/html" && p.body?.data) {
      return { plain: null, html: base64UrlDecode(p.body.data) };
    }
    if (p.parts) {
      let foundHtml: string | null = null;
      for (const child of p.parts) {
        const result = walk(child);
        if (result.plain) return result;
        if (result.html && !foundHtml) foundHtml = result.html;
      }
      return { plain: null, html: foundHtml };
    }
    return { plain: null, html: null };
  }

  const { plain, html } = walk(part);
  if (plain) return plain;
  if (html) return htmlToText(html, { wordwrap: false });
  return "";
}

function hasAnyAttachment(part: gmail_v1.Schema$MessagePart | undefined): boolean {
  if (!part) return false;
  if (part.filename && part.filename.length > 0) return true;
  if (part.parts) return part.parts.some(hasAnyAttachment);
  return false;
}

function addressListContains(headerValue: string | null, excluded: string[]): boolean {
  if (!headerValue || excluded.length === 0) return false;
  const lower = headerValue.toLowerCase();
  return excluded.some((addr) => lower.includes(addr));
}

// Extracts the bare email address from a "Display Name <addr@host>" header
// value, or returns the value unchanged if it's already bare.
function extractAddress(headerValue: string | null): string {
  if (!headerValue) return "";
  const match = headerValue.match(/<([^>]+)>/);
  return (match ? match[1] : headerValue).trim();
}

export function shouldExcludeMessage(
  headers: gmail_v1.Schema$MessagePartHeader[] | undefined,
  excluded: string[]
): boolean {
  if (excluded.length === 0) return false;
  return (
    addressListContains(getHeader(headers, "From"), excluded) ||
    addressListContains(getHeader(headers, "To"), excluded) ||
    addressListContains(getHeader(headers, "Cc"), excluded) ||
    addressListContains(getHeader(headers, "Delivered-To"), excluded)
  );
}

export function parseConversationMessage(
  message: gmail_v1.Schema$Message,
  senderAddress: string
): ConversationMessage | null {
  const headers = message.payload?.headers;
  const from = getHeader(headers, "From") ?? "";
  const fromAddress = extractAddress(from).toLowerCase();
  const direction: ConversationMessage["direction"] =
    fromAddress === senderAddress.toLowerCase() ? "sent" : "received";

  return {
    id: message.id ?? "",
    threadId: message.threadId ?? "",
    messageIdHeader: getHeader(headers, "Message-ID"),
    direction,
    from,
    date: message.internalDate
      ? new Date(Number(message.internalDate)).toISOString()
      : new Date().toISOString(),
    subject: getHeader(headers, "Subject") ?? "(no subject)",
    bodyText: extractBody(message.payload),
    hasAttachment: hasAnyAttachment(message.payload),
  };
}

// --- Network-calling functions -----------------------------------------

export async function sendEmail(params: {
  to: string;
  subject: string;
  body: string;
  threadContext?: ThreadContext | null;
}): Promise<GmailResult<{ messageId: string; threadId: string }>> {
  const env = readEnv();
  if (!env) return { ok: false, reason: "not_configured", message: "Gmail is not connected." };

  try {
    const client = buildClient(env);
    const raw = buildRawMessage({
      from: env.senderAddress,
      to: params.to,
      subject: params.subject,
      body: params.body,
      inReplyTo: params.threadContext?.lastMessageId ?? null,
    });

    const res = await client.users.messages.send({
      userId: "me",
      requestBody: {
        raw,
        threadId: params.threadContext?.threadId,
      },
    });

    return {
      ok: true,
      data: { messageId: res.data.id ?? "", threadId: res.data.threadId ?? "" },
    };
  } catch (err) {
    const { reason, message } = classifyError(err);
    console.error("Gmail send failed:", reason);
    return { ok: false, reason, message };
  }
}

export async function getConversation(leadEmail: string): Promise<GmailResult<ConversationMessage[]>> {
  const env = readEnv();
  if (!env) return { ok: false, reason: "not_configured", message: "Gmail is not connected." };

  try {
    const client = buildClient(env);
    const excluded = getExcludedAddresses();

    const list = await client.users.messages.list({
      userId: "me",
      q: `(from:"${leadEmail}" OR to:"${leadEmail}")`,
      maxResults: MAX_MESSAGES,
    });

    const ids = (list.data.messages ?? []).map((m) => m.id).filter((id): id is string => !!id);
    if (ids.length === 0) return { ok: true, data: [] };

    const full = await Promise.all(
      ids.map((id) => client.users.messages.get({ userId: "me", id, format: "full" }))
    );

    const parsed = full
      .map((r) => r.data)
      .filter((m) => !shouldExcludeMessage(m.payload?.headers, excluded))
      .map((m) => parseConversationMessage(m, env.senderAddress))
      .filter((m): m is ConversationMessage => m !== null)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return { ok: true, data: parsed };
  } catch (err) {
    const { reason, message } = classifyError(err);
    console.error("Gmail conversation fetch failed:", reason);
    return { ok: false, reason, message };
  }
}
