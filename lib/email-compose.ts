// What the compose modal sends, kept apart from the modal so it is unit
// tested. Client-safe: no server imports.

export type ReplyContext = {
  subject: string;
  threadId: string;
  lastMessageId: string;
};

// "reply" continues a conversation (its thread and In-Reply-To); "new"
// starts a fresh thread, so no thread details are sent at all.
export type ComposeMode = "reply" | "new";

export function composeSendPayload(params: {
  mode: ComposeMode;
  replyTo: ReplyContext | null;
  subject: string;
  body: string;
  to?: string;
}): { subject: string; body: string; to?: string; threadId?: string; lastMessageId?: string } {
  const payload: { subject: string; body: string; to?: string; threadId?: string; lastMessageId?: string } = {
    subject: params.subject.trim(),
    body: params.body,
  };
  if (params.to !== undefined) payload.to = params.to.trim();
  if (params.mode === "reply" && params.replyTo) {
    payload.threadId = params.replyTo.threadId;
    payload.lastMessageId = params.replyTo.lastMessageId;
  }
  return payload;
}

// The subject a reply starts with: the conversation's, with "Re: " once.
export function replySubject(subject: string): string {
  return /^re:/i.test(subject.trim()) ? subject : `Re: ${subject}`;
}

// A quick check while typing; the server checks again and decides.
export const SINGLE_EMAIL_RE = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/;
export const MAX_EMAIL_ADDRESS = 254;

export function looksLikeOneAddress(value: string): boolean {
  const v = value.trim();
  return v.length > 0 && v.length <= MAX_EMAIL_ADDRESS && SINGLE_EMAIL_RE.test(v);
}
