import "server-only";
import { escapeHtml, type GmailResult, type SignatureOutcome, type ThreadContext } from "./gmail";

// Email for Leaflet Distribution Bournemouth (LDB) leads. It never goes
// through the FDH Gmail: it is sent with Brevo's transactional API from the
// LDB address, Reply-To the same, with a BCC to the LDB address so the sent
// copy forwards into the shared inbox and shows in the conversation view.
// Plain text plus HTML like the Gmail path, with the LDB signature instead of
// the Gmail one. The key and addresses are read from the environment and are
// never logged or returned.

export const BREVO_SEND_URL = "https://api.brevo.com/v3/smtp/email";
export const LDB_NOT_CONNECTED = "Bournemouth email not connected.";

const EMAIL_RE = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/;
const SEND_TIMEOUT_MS = 20_000;

export type LdbEnv = { apiKey: string; senderAddress: string; senderName: string };

export function readLdbEnv(): LdbEnv | null {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  const senderAddress = process.env.LDB_SENDER_ADDRESS?.trim();
  const senderName = process.env.LDB_SENDER_NAME?.replace(/[\r\n]+/g, " ").trim();
  if (!apiKey || !senderAddress || !senderName || !EMAIL_RE.test(senderAddress)) return null;
  return { apiKey, senderAddress, senderName };
}

export function isLdbEmailConfigured(): boolean {
  return readLdbEnv() !== null;
}

const FREE_MAIL = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "hotmail.co.uk", "live.com", "live.co.uk",
  "yahoo.com", "yahoo.co.uk", "icloud.com", "me.com", "aol.com", "btinternet.com", "sky.com",
  "protonmail.com", "proton.me",
]);

// The website shown in the signature: the sender address's own domain, unless
// it is a free mail service.
export function ldbWebsite(senderAddress: string): string | null {
  const domain = senderAddress.split("@")[1]?.trim().toLowerCase() ?? "";
  if (!domain || FREE_MAIL.has(domain)) return null;
  return domain.startsWith("www.") ? domain : `www.${domain}`;
}

export function ldbSignature(senderAddress: string): { text: string; html: string } {
  const website = ldbWebsite(senderAddress);
  const lines = ["Leaflet Distribution Bournemouth", ...(website ? [website] : []), senderAddress];
  const html = [
    "Leaflet Distribution Bournemouth",
    ...(website ? [`<a href="https://${escapeHtml(website)}">${escapeHtml(website)}</a>`] : []),
    `<a href="mailto:${escapeHtml(senderAddress)}">${escapeHtml(senderAddress)}</a>`,
  ].join("<br>\n");
  return { text: lines.join("\n"), html };
}

export type BrevoEmail = {
  sender: { name: string; email: string };
  to: { email: string }[];
  bcc: { email: string }[];
  replyTo: { name: string; email: string };
  subject: string;
  textContent: string;
  htmlContent: string;
  headers?: Record<string, string>;
};

export type LdbSendParams = {
  to: string;
  subject: string;
  body: string;
  threadContext?: ThreadContext | null;
};

// The request body, the same two parts the Gmail path sends: the body then
// the signature as plain text, and the body HTML-escaped (so nothing typed can
// become HTML) then the signature. A reply carries the threading headers so
// it lands in the same conversation.
export function buildBrevoEmail(env: LdbEnv, params: LdbSendParams): BrevoEmail {
  const body = params.body.replace(/\r\n|\r/g, "\n");
  const signature = ldbSignature(env.senderAddress);
  const htmlBody = escapeHtml(body).replace(/\n/g, "<br>\n");
  const email: BrevoEmail = {
    sender: { name: env.senderName, email: env.senderAddress },
    to: [{ email: params.to }],
    bcc: [{ email: env.senderAddress }],
    replyTo: { name: env.senderName, email: env.senderAddress },
    subject: params.subject,
    textContent: `${body}\n\n-- \n${signature.text}`,
    htmlContent:
      `<div dir="ltr">${htmlBody}<br clear="all"><br>\n<span>-- </span><br>\n` +
      `<div dir="ltr">${signature.html}</div></div>`,
  };
  const inReplyTo = params.threadContext?.lastMessageId?.trim();
  if (inReplyTo) email.headers = { "In-Reply-To": inReplyTo, References: inReplyTo };
  return email;
}

export type LdbSendDeps = { env?: LdbEnv | null; fetchFn?: typeof fetch };

// Sends one email through Brevo. With any setting missing nothing is sent
// and the result says Bournemouth email isn't connected; there is no
// fallback to Gmail.
export async function sendViaBrevo(
  params: LdbSendParams,
  deps: LdbSendDeps = {}
): Promise<GmailResult<{ messageId: string; threadId: string; signature: SignatureOutcome }>> {
  const env = deps.env === undefined ? readLdbEnv() : deps.env;
  if (!env) return { ok: false, reason: "not_configured", message: LDB_NOT_CONNECTED };
  const fetchFn = deps.fetchFn ?? fetch;

  let res: Response;
  try {
    res = await fetchFn(BREVO_SEND_URL, {
      method: "POST",
      headers: { "api-key": env.apiKey, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(buildBrevoEmail(env, params)),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
  } catch (err) {
    console.error("Brevo send failed:", err instanceof Error ? err.name : "unknown error");
    return { ok: false, reason: "error", message: "Bournemouth email could not be sent. Please try again." };
  }

  if (!res.ok) {
    // Only the status: Brevo's error text can echo what it was sent.
    console.error("Brevo send failed:", res.status);
    const message =
      res.status === 401 || res.status === 403
        ? "Bournemouth email could not be sent: Brevo refused the API key."
        : "Bournemouth email could not be sent. Please try again.";
    return { ok: false, reason: "error", message };
  }

  let messageId = "";
  try {
    const data = (await res.json()) as { messageId?: unknown };
    if (typeof data.messageId === "string") messageId = data.messageId;
  } catch {
    // Sent all the same; the id is only informational.
  }
  return {
    ok: true,
    data: { messageId, threadId: params.threadContext?.threadId ?? "", signature: "added" },
  };
}

// For the compose window: who an LDB email comes from and the signature it
// gets, or that Bournemouth email isn't connected. Never the key.
export function ldbSenderPreview():
  | { configured: true; fromName: string; fromAddress: string; signatureText: string }
  | { configured: false } {
  const env = readLdbEnv();
  if (!env) return { configured: false };
  return {
    configured: true,
    fromName: env.senderName,
    fromAddress: env.senderAddress,
    signatureText: ldbSignature(env.senderAddress).text,
  };
}
