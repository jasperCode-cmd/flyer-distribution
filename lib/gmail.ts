import "server-only";
import { OAuth2Client } from "google-auth-library";
import { gmail as gmailClient, gmail_v1 } from "@googleapis/gmail";
import { convert as htmlToText } from "html-to-text";
import { randomBytes } from "node:crypto";

const SCOPES = ["https://www.googleapis.com/auth/gmail.send", "https://www.googleapis.com/auth/gmail.readonly"];
const MAX_MESSAGES = 30;

// Inbox page. Metadata for a page of threads is fetched in parallel but
// capped, so a page load stays quick without bursting Gmail's per-user
// quota; full message bodies are only fetched when a thread is opened.
const INBOX_PAGE_SIZE = 20;
const METADATA_CONCURRENCY = 5;
export const INBOX_SEARCH_MAX = 200;
// Every header the exclusion rule reads, plus what a list row and a reply need.
const THREAD_METADATA_HEADERS = [
  "From",
  "To",
  "Cc",
  "Delivered-To",
  "Subject",
  "Date",
  "Content-Type",
  "Message-ID",
  "Reply-To",
];
// Unread badge: at most this many unread threads are checked against the
// exclusion list, and the result is reused briefly so every CRM page load
// isn't another round of Gmail calls.
const UNREAD_SCAN_LIMIT = 100;
const UNREAD_CACHE_MS = 60_000;

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

export type InboxThreadSummary = {
  id: string;
  fromName: string;
  fromAddress: string;
  // A single valid Reply-To on the latest received message, if any. Used,
  // with fromAddress, to match the thread to a lead.
  replyToAddress: string | null;
  subject: string;
  snippet: string;
  date: string;
  unread: boolean;
  hasAttachment: boolean;
  messageCount: number;
};

// The other party on a thread: the latest sender who isn't us, or, if every
// message is ours, whoever the latest one was sent to.
export type Counterparty = { name: string; address: string };

// Who a reply goes to. `from` is the latest received message's sender and
// `replyTo` its single valid Reply-To, if it has one; `recipient` is the
// Reply-To when present (a form service sending on a customer's behalf, for
// example), otherwise the sender.
export type ReplyTarget = {
  from: Counterparty | null;
  replyTo: Counterparty | null;
  recipient: Counterparty | null;
};

export type InboxThread = {
  id: string;
  subject: string;
  counterparty: Counterparty | null;
  replyTo: Counterparty | null;
  recipient: Counterparty | null;
  lastMessageId: string | null;
  messages: ConversationMessage[];
};

export type InboxReplyContext = {
  threadId: string;
  subject: string;
  counterparty: Counterparty | null;
  replyTo: Counterparty | null;
  recipient: Counterparty | null;
  lastMessageId: string | null;
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

// Addresses the CRM never shows or emails (GMAIL_EXCLUDE_ADDRESSES).
export function getExcludedAddresses(): string[] {
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

// Quoted-printable (RFC 2045) for a UTF-8 text part: readable in the raw
// message, safe for any character, and no encoded line over 76 characters.
export function encodeQuotedPrintable(text: string): string {
  return text
    .replace(/\r\n|\r|\n/g, "\n")
    .split("\n")
    .map((line) => {
      const bytes = Buffer.from(line, "utf-8");
      const tokens: string[] = [];
      bytes.forEach((b, i) => {
        const trailingSpace = (b === 32 || b === 9) && i === bytes.length - 1;
        const literal = b >= 33 && b <= 126 && b !== 61;
        tokens.push(literal || ((b === 32 || b === 9) && !trailingSpace)
          ? String.fromCharCode(b)
          : `=${b.toString(16).toUpperCase().padStart(2, "0")}`);
      });
      const out: string[] = [];
      let current = "";
      for (const token of tokens) {
        if (current.length + token.length > 75) {
          out.push(`${current}=`);
          current = "";
        }
        current += token;
      }
      out.push(current);
      return out.join("\r\n");
    })
    .join("\r\n");
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Our own Gmail signature as plain text, for the text/plain part and the
// compose preview. Images are left out; a link keeps its address only when
// the text doesn't already show it.
const SIGNATURE_HTML_TO_TEXT = {
  wordwrap: false as const,
  selectors: [
    { selector: "a", options: { hideLinkHrefIfSameAsText: true } },
    { selector: "img", format: "skip" },
  ],
};

// A link whose text is already its address (ignoring https://, mailto:, tel:
// and spacing) is shown once, not as "07700 900999 [tel:07700900999]".
function sameLink(text: string, href: string): boolean {
  const tidy = (v: string) =>
    v.trim().toLowerCase().replace(/^(https?:\/\/|mailto:|tel:)/, "").replace(/\/$/, "").replace(/[\s().-]/g, "");
  return tidy(text) !== "" && tidy(text) === tidy(href);
}

export function signatureToText(html: string): string {
  const withoutRepeatedLinks = html.replace(
    /<a\b([^>]*?)\bhref\s*=\s*(["'])(.*?)\2([^>]*)>([^<]*)<\/a>/gi,
    (whole, before: string, _q: string, href: string, after: string, text: string) =>
      sameLink(text, href) ? `<a${before}${after}>${text}</a>` : whole
  );
  return htmlToText(withoutRepeatedLinks, SIGNATURE_HTML_TO_TEXT).trim();
}

// Images in a signature only show for the recipient when they're linked by
// URL. Embedded ones (data: or cid:) can't be sent from here.
export function describeSignatureImages(html: string): { linked: number; embedded: number } {
  let linked = 0;
  let embedded = 0;
  for (const match of html.matchAll(/<img\b[^>]*?\bsrc\s*=\s*["']?([^"'\s>]+)/gi)) {
    if (/^https?:\/\//i.test(match[1])) linked++;
    else embedded++;
  }
  return { linked, embedded };
}

function newBoundary(): string {
  return `fdh_${randomBytes(12).toString("hex")}`;
}

// Every email goes out as multipart/alternative: a text/plain part (the
// body, then the signature as plain text) and a text/html part (the body
// HTML-escaped with line breaks as <br>, then our signature inside a
// gmail_signature div, the way Gmail itself sends it). The body is always
// escaped, so nothing typed can become HTML. Threading headers are exactly
// as before.
export function buildRawMessage(params: {
  from: string;
  to: string;
  subject: string;
  body: string;
  inReplyTo?: string | null;
  signatureHtml?: string | null;
  boundary?: string;
}): string {
  const boundary = params.boundary ?? newBoundary();
  const signatureHtml = params.signatureHtml?.trim() || null;
  const body = params.body.replace(/\r\n|\r/g, "\n");

  const plain = signatureHtml ? `${body}\n\n-- \n${signatureToText(signatureHtml)}` : body;
  const htmlBody = escapeHtml(body).replace(/\n/g, "<br>\n");
  const html =
    `<div dir="ltr">${htmlBody}` +
    (signatureHtml
      ? `<br clear="all"><br>\n<span class="gmail_signature_prefix">-- </span><br>\n` +
        `<div dir="ltr" class="gmail_signature" data-smartmail="gmail_signature">${signatureHtml}</div>`
      : "") +
    `</div>`;

  const lines = [
    `From: ${params.from}`,
    `To: ${params.to}`,
    `Subject: ${encodeMimeHeader(params.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];
  if (params.inReplyTo) {
    lines.push(`In-Reply-To: ${params.inReplyTo}`);
    lines.push(`References: ${params.inReplyTo}`);
  }
  lines.push(
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: quoted-printable",
    "",
    encodeQuotedPrintable(plain),
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: quoted-printable",
    "",
    encodeQuotedPrintable(html),
    `--${boundary}--`,
    ""
  );
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

// For reading form notification emails: both text versions of a message,
// never its HTML. The HTML version is converted with every table cell on
// its own line, because the default conversion runs a table's cells
// together ("NameSam Example") and the fields could not be told apart.
const FORM_HTML_TO_TEXT = {
  wordwrap: false as const,
  selectors: [
    ...["table", "tbody", "thead", "tfoot", "tr", "td", "th"].map((selector) => ({ selector, format: "block" })),
    ...["h1", "h2", "h3", "h4"].map((selector) => ({ selector, options: { uppercase: false } })),
    { selector: "a", options: { ignoreHref: true } },
    { selector: "img", format: "skip" },
  ],
};

export function extractTextVariants(part: gmail_v1.Schema$MessagePart | undefined): {
  plain: string | null;
  fromHtml: string | null;
} {
  let plain: string | null = null;
  let html: string | null = null;
  function walk(p: gmail_v1.Schema$MessagePart) {
    const mimeType = p.mimeType ?? "";
    if (mimeType === "text/plain" && p.body?.data && plain === null && !p.filename) {
      plain = base64UrlDecode(p.body.data);
    } else if (mimeType === "text/html" && p.body?.data && html === null && !p.filename) {
      html = base64UrlDecode(p.body.data);
    }
    p.parts?.forEach(walk);
  }
  if (part) walk(part);
  return { plain, fromHtml: html === null ? null : htmlToText(html, FORM_HTML_TO_TEXT) };
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Splits an address-list header on commas that aren't inside a quoted name.
function splitAddressList(headerValue: string): string[] {
  return headerValue
    .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
    .map((p) => p.trim())
    .filter(Boolean);
}

// Splits the first mailbox in a From/To header into a display name and a
// bare address. The name falls back to the address when there isn't one.
export function parseMailbox(headerValue: string | null): Counterparty {
  if (!headerValue) return { name: "", address: "" };
  const first = splitAddressList(headerValue)[0] ?? "";
  const address = extractAddress(first);
  const angle = first.indexOf("<");
  const rawName = angle > 0 ? first.slice(0, angle) : "";
  const name = rawName.trim().replace(/^"(.*)"$/, "$1").trim();
  return { name: name || address, address };
}

// Gmail snippets are plain text with HTML entities escaped. Decoded here so
// the UI can render them as text, never as markup.
export function decodeHtmlEntities(text: string): string {
  const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === "#") {
      const n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : whole;
    }
    return named[code.toLowerCase()] ?? whole;
  });
}

export function normalizeInboxSearch(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.trim().slice(0, INBOX_SEARCH_MAX).trim();
}

// Runs fn over items with at most `limit` calls in flight, keeping order.
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
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

// A thread is dropped as a whole if any one of its messages touches an
// excluded address, so an excluded conversation never shows partially.
export function shouldExcludeThread(
  messages: gmail_v1.Schema$Message[] | undefined,
  excluded: string[]
): boolean {
  if (excluded.length === 0 || !messages) return false;
  return messages.some((m) => shouldExcludeMessage(m.payload?.headers, excluded));
}

export function isThreadInInbox(messages: gmail_v1.Schema$Message[] | undefined): boolean {
  return (messages ?? []).some((m) => m.labelIds?.includes("INBOX"));
}

function sortedOldestFirst(messages: gmail_v1.Schema$Message[] | undefined): gmail_v1.Schema$Message[] {
  return [...(messages ?? [])].sort((a, b) => Number(a.internalDate ?? 0) - Number(b.internalDate ?? 0));
}

// A Reply-To is only honoured when it holds exactly one valid address that
// isn't our own; anything else (several addresses, junk) is ignored.
export function singleReplyTo(headerValue: string | null, senderAddress: string): Counterparty | null {
  if (!headerValue) return null;
  const parts = splitAddressList(headerValue);
  if (parts.length !== 1) return null;
  const box = parseMailbox(parts[0]);
  if (!EMAIL_RE.test(box.address)) return null;
  if (box.address.toLowerCase() === senderAddress.toLowerCase()) return null;
  return box;
}

export function findReplyTarget(
  messages: gmail_v1.Schema$Message[] | undefined,
  senderAddress: string
): ReplyTarget {
  const own = senderAddress.toLowerCase();
  const newestFirst = sortedOldestFirst(messages).reverse();
  for (const m of newestFirst) {
    const from = parseMailbox(getHeader(m.payload?.headers, "From"));
    if (from.address && from.address.toLowerCase() !== own) {
      const replyTo = singleReplyTo(getHeader(m.payload?.headers, "Reply-To"), senderAddress);
      return { from, replyTo, recipient: replyTo ?? from };
    }
  }
  const latest = newestFirst[0];
  const to = parseMailbox(getHeader(latest?.payload?.headers, "To"));
  return { from: null, replyTo: null, recipient: to.address ? to : null };
}

export function findCounterparty(
  messages: gmail_v1.Schema$Message[] | undefined,
  senderAddress: string
): Counterparty | null {
  const target = findReplyTarget(messages, senderAddress);
  return target.from ?? target.recipient;
}

// For the Priorities list: a thread whose latest message is from someone
// else, with nothing sent by us after it, or null if we wrote last. The
// addresses are the ones the inbox matches a lead on (the sender and a single
// Reply-To), from that latest message.
export type UnansweredMessage = {
  threadId: string;
  messageId: string;
  receivedAt: string;
  fromAddress: string;
  replyToAddress: string | null;
  subject: string;
  // The latest message's Message-ID header, so a reply can thread onto it.
  messageIdHeader: string | null;
};

export function latestUnanswered(
  thread: gmail_v1.Schema$Thread,
  senderAddress: string
): UnansweredMessage | null {
  const messages = sortedOldestFirst(thread.messages);
  const latest = messages[messages.length - 1];
  if (!thread.id || !latest?.id) return null;
  const from = parseMailbox(getHeader(latest.payload?.headers, "From"));
  if (!from.address || from.address.toLowerCase() === senderAddress.toLowerCase()) return null;
  if (latest.labelIds?.includes("SENT")) return null;
  return {
    threadId: thread.id,
    messageId: latest.id,
    receivedAt: latest.internalDate ? new Date(Number(latest.internalDate)).toISOString() : new Date(0).toISOString(),
    fromAddress: from.address,
    replyToAddress: singleReplyTo(getHeader(latest.payload?.headers, "Reply-To"), senderAddress)?.address ?? null,
    subject: getHeader(messages[0].payload?.headers, "Subject")?.trim() || "(no subject)",
    messageIdHeader: getHeader(latest.payload?.headers, "Message-ID"),
  };
}

// Metadata-format messages carry headers but no MIME parts, so a list row
// can only infer attachments from the top-level Content-Type. An opened
// thread uses the exact part-based check instead.
function looksLikeAttachment(message: gmail_v1.Schema$Message): boolean {
  if (hasAnyAttachment(message.payload)) return true;
  const contentType = getHeader(message.payload?.headers, "Content-Type") ?? message.payload?.mimeType ?? "";
  return /^multipart\/mixed/i.test(contentType.trim());
}

export function summarizeThread(
  thread: gmail_v1.Schema$Thread,
  senderAddress: string
): InboxThreadSummary | null {
  const messages = sortedOldestFirst(thread.messages);
  if (!thread.id || messages.length === 0) return null;
  const latest = messages[messages.length - 1];
  const target = findReplyTarget(messages, senderAddress);
  const sender = target.from ?? target.recipient ?? { name: "", address: "" };
  const subject = getHeader(messages[0].payload?.headers, "Subject")?.trim() || "(no subject)";
  return {
    id: thread.id,
    fromName: sender.name,
    fromAddress: sender.address,
    replyToAddress: target.replyTo?.address ?? null,
    subject,
    snippet: decodeHtmlEntities(latest.snippet ?? thread.snippet ?? ""),
    date: latest.internalDate
      ? new Date(Number(latest.internalDate)).toISOString()
      : new Date().toISOString(),
    unread: messages.some((m) => m.labelIds?.includes("UNREAD")),
    hasAttachment: messages.some(looksLikeAttachment),
    messageCount: messages.length,
  };
}

function lastMessageIdHeader(messages: gmail_v1.Schema$Message[] | undefined): string | null {
  const ordered = sortedOldestFirst(messages);
  return ordered.length ? getHeader(ordered[ordered.length - 1].payload?.headers, "Message-ID") : null;
}

function isNotFound(err: unknown): boolean {
  const status = (err as { status?: number; code?: number | string } | null)?.status ??
    (err as { code?: number | string } | null)?.code;
  return status === 404 || status === "404";
}

// --- Network-calling functions -----------------------------------------

// --- Our Gmail signature -------------------------------------------------------

// Read from Gmail's own settings for GMAIL_SENDER_ADDRESS (a read-only call
// the existing gmail.readonly scope allows), kept in server memory only for
// 10 minutes. Never stored in the database and never logged.
const SIGNATURE_CACHE_MS = 10 * 60 * 1000;

export type SignatureState = { status: "found"; html: string } | { status: "none" } | { status: "unavailable" };
export type SignatureOutcome = "added" | "none" | "unavailable";
export type SendAsEntry = { sendAsEmail?: string | null; signature?: string | null };

let signatureCache: { sender: string; value: SignatureState; expires: number } | null = null;

export function clearSignatureCache() {
  signatureCache = null;
}

export async function loadSignature(
  listSendAs: () => Promise<SendAsEntry[]>,
  senderAddress: string,
  now: number = Date.now()
): Promise<SignatureState> {
  const sender = senderAddress.toLowerCase();
  if (signatureCache && signatureCache.sender === sender && signatureCache.expires > now) {
    return signatureCache.value;
  }
  try {
    const entries = await listSendAs();
    const match = entries.find((e) => (e.sendAsEmail ?? "").toLowerCase() === sender);
    if (!match) {
      console.error("Gmail signature not loaded:", "sender address not found");
      return { status: "unavailable" };
    }
    const html = (match.signature ?? "").trim();
    const value: SignatureState = html ? { status: "found", html } : { status: "none" };
    signatureCache = { sender, value, expires: now + SIGNATURE_CACHE_MS };
    return value;
  } catch (err) {
    console.error("Gmail signature not loaded:", classifyError(err).reason);
    return { status: "unavailable" };
  }
}

function sendAsLister(client: gmail_v1.Gmail): () => Promise<SendAsEntry[]> {
  return async () => (await client.users.settings.sendAs.list({ userId: "me" })).data.sendAs ?? [];
}

// For the compose window: our signature as plain text, never HTML.
export async function getSignaturePreview(): Promise<
  GmailResult<
    | { status: "found"; text: string; images: { linked: number; embedded: number } }
    | { status: "none" }
    | { status: "unavailable" }
  >
> {
  const env = readEnv();
  if (!env) return { ok: false, reason: "not_configured", message: "Gmail is not connected." };
  const state = await loadSignature(sendAsLister(buildClient(env)), env.senderAddress);
  if (state.status !== "found") return { ok: true, data: state };
  return {
    ok: true,
    data: { status: "found", text: signatureToText(state.html), images: describeSignatureImages(state.html) },
  };
}

// --- Sending -------------------------------------------------------------------

export type GmailSendApi = {
  send(requestBody: { raw: string; threadId?: string }): Promise<{ id: string; threadId: string }>;
  listSendAs(): Promise<SendAsEntry[]>;
};

export type SendEmailParams = {
  to: string;
  subject: string;
  body: string;
  threadContext?: ThreadContext | null;
};

// The send itself, given the two Gmail calls it needs, so a test can drive
// it with a fake. A signature that can't be loaded never stops the email:
// it goes without one and the result says so.
export async function sendEmailVia(
  api: GmailSendApi,
  senderAddress: string,
  params: SendEmailParams,
  now: number = Date.now()
): Promise<GmailResult<{ messageId: string; threadId: string; signature: SignatureOutcome }>> {
  const signature = await loadSignature(() => api.listSendAs(), senderAddress, now);
  const raw = buildRawMessage({
    from: senderAddress,
    to: params.to,
    subject: params.subject,
    body: params.body,
    inReplyTo: params.threadContext?.lastMessageId ?? null,
    signatureHtml: signature.status === "found" ? signature.html : null,
  });

  try {
    const res = await api.send({ raw, threadId: params.threadContext?.threadId });
    return {
      ok: true,
      data: {
        messageId: res.id,
        threadId: res.threadId,
        signature: signature.status === "found" ? "added" : signature.status,
      },
    };
  } catch (err) {
    const { reason, message } = classifyError(err);
    console.error("Gmail send failed:", reason);
    return { ok: false, reason, message };
  }
}

export async function sendEmail(
  params: SendEmailParams
): Promise<GmailResult<{ messageId: string; threadId: string; signature: SignatureOutcome }>> {
  const env = readEnv();
  if (!env) return { ok: false, reason: "not_configured", message: "Gmail is not connected." };

  try {
    const client = buildClient(env);
    return await sendEmailVia(
      {
        async send(requestBody) {
          const res = await client.users.messages.send({ userId: "me", requestBody });
          return { id: res.data.id ?? "", threadId: res.data.threadId ?? "" };
        },
        listSendAs: sendAsLister(client),
      },
      env.senderAddress,
      params
    );
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
    const fetched = full.map((r) => r.data);

    // Same thread-level rule as the inbox: a conversation that touches an
    // excluded address anywhere is hidden whole, including through messages
    // this lead search didn't return.
    const excludedThreads = new Set<string>();
    if (excluded.length > 0) {
      const threadIds = [...new Set(fetched.map((m) => m.threadId).filter((id): id is string => !!id))];
      const threads = await mapWithConcurrency(threadIds, METADATA_CONCURRENCY, async (id) => {
        const res = await client.users.threads.get({
          userId: "me",
          id,
          format: "metadata",
          metadataHeaders: THREAD_METADATA_HEADERS,
        });
        return res.data;
      });
      threads.forEach((t, i) => {
        if (shouldExcludeThread(t.messages, excluded)) excludedThreads.add(threadIds[i]);
      });
    }

    const parsed = fetched
      .filter((m) => !excludedThreads.has(m.threadId ?? ""))
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

// --- Reading application notification emails (read-only) -------------------

export type GmailMessageReader = {
  listMessageIds(q: string, pageToken?: string): Promise<{
    messages: { id: string; threadId: string }[];
    nextPageToken: string | null;
  }>;
  // Full thread, or null when it doesn't exist.
  getThread(threadId: string): Promise<gmail_v1.Schema$Thread | null>;
};

export type GmailReadContext = { senderAddress: string; excluded: string[] };

// Hands fn a reader backed by the real Gmail client, with the exclusion list
// and our own address. Only list and get calls, under the existing scopes.
export async function withGmailMessageReader<T>(
  fn: (reader: GmailMessageReader, context: GmailReadContext) => Promise<T>
): Promise<GmailResult<T>> {
  const env = readEnv();
  if (!env) return { ok: false, reason: "not_configured", message: "Gmail is not connected." };

  try {
    const client = buildClient(env);
    const reader: GmailMessageReader = {
      async listMessageIds(q, pageToken) {
        const res = await client.users.messages.list({ userId: "me", q, maxResults: 100, pageToken });
        return {
          messages: (res.data.messages ?? [])
            .filter((m) => m.id && m.threadId)
            .map((m) => ({ id: m.id as string, threadId: m.threadId as string })),
          nextPageToken: res.data.nextPageToken ?? null,
        };
      },
      async getThread(threadId) {
        try {
          const res = await client.users.threads.get({ userId: "me", id: threadId, format: "full" });
          return res.data;
        } catch (err) {
          if (isNotFound(err)) return null;
          throw err;
        }
      },
    };
    const data = await fn(reader, { senderAddress: env.senderAddress, excluded: getExcludedAddresses() });
    return { ok: true, data };
  } catch (err) {
    const { reason, message } = classifyError(err);
    console.error("Gmail application email read failed:", reason);
    return { ok: false, reason, message };
  }
}

// --- Inbox page (read-only) ------------------------------------------------

// Which Gmail label and query a list or scan uses: the inbox (and Unread,
// when that toggle is on) plus the search box and the category's own query.
export function inboxListParams(params: { q?: unknown; unread?: boolean; categoryQuery?: string }): {
  labelIds: string[];
  q: string;
} {
  return {
    labelIds: params.unread ? ["INBOX", "UNREAD"] : ["INBOX"],
    q: [normalizeInboxSearch(params.q), params.categoryQuery ?? ""].filter(Boolean).join(" "),
  };
}

// One page of threads as shown: anything touching an excluded address goes
// first, then the category's own check, if it has one.
export function filterInboxPage(
  threads: gmail_v1.Schema$Thread[],
  excluded: string[],
  keep?: (thread: gmail_v1.Schema$Thread) => boolean
): gmail_v1.Schema$Thread[] {
  return threads.filter((t) => !shouldExcludeThread(t.messages, excluded) && (!keep || keep(t)));
}

export async function listInboxThreads(params: {
  pageToken?: string;
  q?: string;
  unread?: boolean;
  categoryQuery?: string;
  keep?: (thread: gmail_v1.Schema$Thread) => boolean;
}): Promise<GmailResult<{ threads: InboxThreadSummary[]; nextPageToken: string | null }>> {
  const env = readEnv();
  if (!env) return { ok: false, reason: "not_configured", message: "Gmail is not connected." };

  try {
    const client = buildClient(env);
    const excluded = getExcludedAddresses();
    const { labelIds, q } = inboxListParams(params);

    const list = await client.users.threads.list({
      userId: "me",
      labelIds,
      maxResults: INBOX_PAGE_SIZE,
      pageToken: params.pageToken || undefined,
      q: q || undefined,
    });

    const ids = (list.data.threads ?? []).map((t) => t.id).filter((id): id is string => !!id);
    const threads = await mapWithConcurrency(ids, METADATA_CONCURRENCY, async (id) => {
      const res = await client.users.threads.get({
        userId: "me",
        id,
        format: "metadata",
        metadataHeaders: THREAD_METADATA_HEADERS,
      });
      return res.data;
    });

    const summaries = filterInboxPage(threads, excluded, params.keep)
      .map((t) => summarizeThread(t, env.senderAddress))
      .filter((t): t is InboxThreadSummary => t !== null);

    return { ok: true, data: { threads: summaries, nextPageToken: list.data.nextPageToken ?? null } };
  } catch (err) {
    const { reason, message } = classifyError(err);
    console.error("Gmail inbox list failed:", reason);
    return { ok: false, reason, message };
  }
}

// Hands fn a read-only reader for scanning the inbox (list and header-only
// get, under the existing scopes), with the exclusion list and our address.
export async function withInboxReader<T>(
  fn: (
    reader: {
      listThreadIds(params: {
        labelIds: string[];
        q?: string;
        pageToken?: string;
        maxResults: number;
      }): Promise<{ ids: string[]; nextPageToken: string | null }>;
      getThreadMetadata(id: string): Promise<gmail_v1.Schema$Thread | null>;
    },
    context: GmailReadContext
  ) => Promise<T>
): Promise<GmailResult<T>> {
  const env = readEnv();
  if (!env) return { ok: false, reason: "not_configured", message: "Gmail is not connected." };

  try {
    const client = buildClient(env);
    const data = await fn(
      {
        async listThreadIds({ labelIds, q, pageToken, maxResults }) {
          const res = await client.users.threads.list({ userId: "me", labelIds, q, pageToken, maxResults });
          return {
            ids: (res.data.threads ?? []).map((t) => t.id).filter((id): id is string => !!id),
            nextPageToken: res.data.nextPageToken ?? null,
          };
        },
        async getThreadMetadata(id) {
          try {
            const res = await client.users.threads.get({
              userId: "me",
              id,
              format: "metadata",
              metadataHeaders: THREAD_METADATA_HEADERS,
            });
            return res.data;
          } catch (err) {
            if (isNotFound(err)) return null;
            throw err;
          }
        },
      },
      { senderAddress: env.senderAddress, excluded: getExcludedAddresses() }
    );
    return { ok: true, data };
  } catch (err) {
    const { reason, message } = classifyError(err);
    console.error("Gmail inbox scan failed:", reason);
    return { ok: false, reason, message };
  }
}

// Full bodies, oldest first. Returns null (not an error) when the thread
// doesn't exist, isn't in the inbox, or touches an excluded address, so the
// route can answer 404 without saying which.
export async function getInboxThread(threadId: string): Promise<GmailResult<InboxThread | null>> {
  const env = readEnv();
  if (!env) return { ok: false, reason: "not_configured", message: "Gmail is not connected." };

  try {
    const client = buildClient(env);
    const res = await client.users.threads.get({ userId: "me", id: threadId, format: "full" });
    const messages = res.data.messages ?? [];
    if (!isThreadInInbox(messages) || shouldExcludeThread(messages, getExcludedAddresses())) {
      return { ok: true, data: null };
    }

    const parsed = sortedOldestFirst(messages)
      .map((m) => parseConversationMessage(m, env.senderAddress))
      .filter((m): m is ConversationMessage => m !== null);
    const target = findReplyTarget(messages, env.senderAddress);

    return {
      ok: true,
      data: {
        id: res.data.id ?? threadId,
        subject: parsed[0]?.subject ?? "(no subject)",
        counterparty: target.from ?? target.recipient,
        replyTo: target.replyTo,
        recipient: target.recipient,
        lastMessageId: lastMessageIdHeader(messages),
        messages: parsed,
      },
    };
  } catch (err) {
    if (isNotFound(err)) return { ok: true, data: null };
    const { reason, message } = classifyError(err);
    console.error("Gmail inbox thread fetch failed:", reason);
    return { ok: false, reason, message };
  }
}

// What a reply needs, from headers only. The recipient is always worked out
// here from the thread itself, never taken from the request.
export async function getInboxReplyContext(threadId: string): Promise<GmailResult<InboxReplyContext | null>> {
  const env = readEnv();
  if (!env) return { ok: false, reason: "not_configured", message: "Gmail is not connected." };

  try {
    const client = buildClient(env);
    const res = await client.users.threads.get({
      userId: "me",
      id: threadId,
      format: "metadata",
      metadataHeaders: THREAD_METADATA_HEADERS,
    });
    const messages = res.data.messages ?? [];
    if (!isThreadInInbox(messages) || shouldExcludeThread(messages, getExcludedAddresses())) {
      return { ok: true, data: null };
    }
    const first = sortedOldestFirst(messages)[0];
    const target = findReplyTarget(messages, env.senderAddress);
    return {
      ok: true,
      data: {
        threadId: res.data.id ?? threadId,
        subject: getHeader(first?.payload?.headers, "Subject")?.trim() || "(no subject)",
        counterparty: target.from ?? target.recipient,
        replyTo: target.replyTo,
        recipient: target.recipient,
        lastMessageId: lastMessageIdHeader(messages),
      },
    };
  } catch (err) {
    if (isNotFound(err)) return { ok: true, data: null };
    const { reason, message } = classifyError(err);
    console.error("Gmail reply context fetch failed:", reason);
    return { ok: false, reason, message };
  }
}

let unreadCache: { value: { count: number; more: boolean }; expires: number } | null = null;

// Unread conversations in INBOX. Without an exclusion list this is the INBOX
// label's own count. With one, the unread threads are checked so excluded
// conversations never inflate the badge; past UNREAD_SCAN_LIMIT it reports
// `more` rather than a guess.
export async function getInboxUnreadCount(): Promise<GmailResult<{ count: number; more: boolean }>> {
  const env = readEnv();
  if (!env) return { ok: false, reason: "not_configured", message: "Gmail is not connected." };
  if (unreadCache && unreadCache.expires > Date.now()) return { ok: true, data: unreadCache.value };

  try {
    const client = buildClient(env);
    const label = await client.users.labels.get({ userId: "me", id: "INBOX" });
    const labelCount = label.data.threadsUnread ?? 0;
    const excluded = getExcludedAddresses();

    let value = { count: labelCount, more: false };
    if (excluded.length > 0 && labelCount > 0) {
      const list = await client.users.threads.list({
        userId: "me",
        labelIds: ["INBOX", "UNREAD"],
        maxResults: UNREAD_SCAN_LIMIT,
      });
      const ids = (list.data.threads ?? []).map((t) => t.id).filter((id): id is string => !!id);
      const threads = await mapWithConcurrency(ids, METADATA_CONCURRENCY, async (id) => {
        const res = await client.users.threads.get({
          userId: "me",
          id,
          format: "metadata",
          metadataHeaders: THREAD_METADATA_HEADERS,
        });
        return res.data;
      });
      const kept = threads.filter((t) => !shouldExcludeThread(t.messages, excluded)).length;
      value = { count: kept, more: !!list.data.nextPageToken };
    }

    unreadCache = { value, expires: Date.now() + UNREAD_CACHE_MS };
    return { ok: true, data: value };
  } catch (err) {
    const { reason, message } = classifyError(err);
    console.error("Gmail unread count failed:", reason);
    return { ok: false, reason, message };
  }
}
