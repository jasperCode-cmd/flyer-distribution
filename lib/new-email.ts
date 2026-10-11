import "server-only";
import { MAX_EMAIL_ADDRESS, SINGLE_EMAIL_RE } from "./email-compose";
import { sendLeadEmailAndRecord, type SendEmailFn, type SendLeadEmailPrisma } from "./send-lead-email";
import type { SignatureOutcome } from "./gmail";
import type { InboxLeadMatch } from "./inbox-leads";

// A new email started from the Inbox, to an address typed by hand.
//   - The address is checked here: exactly one plain address, a sensible
//     length, and not one of GMAIL_EXCLUDE_ADDRESSES (the same rule the
//     inbox uses to hide them).
//   - If it is a live lead's address (case-insensitive, exact), it goes
//     through the same send-and-record path as an email from the lead's
//     page: the Activity is written and an Uncontacted lead moves to Awaiting
//     Response.
//   - Anyone else, a scrapped lead included, gets a plain email and nothing
//     is written to the database.
// Always a fresh thread: no thread details are taken from anywhere.

export type AddressCheck = { ok: true; address: string } | { ok: false; reason: "invalid" | "excluded"; error: string };

export function checkNewEmailAddress(raw: unknown, excluded: string[]): AddressCheck {
  const address = typeof raw === "string" ? raw.trim() : "";
  if (!address || address.length > MAX_EMAIL_ADDRESS || !SINGLE_EMAIL_RE.test(address)) {
    return { ok: false, reason: "invalid", error: "Enter one email address, for example name@example.com." };
  }
  const lower = address.toLowerCase();
  if (excluded.some((addr) => lower.includes(addr))) {
    return { ok: false, reason: "excluded", error: "The CRM doesn't send to this address." };
  }
  return { ok: true, address };
}

export type NewEmailResult =
  | { ok: true; recordedOnLead: boolean; movedToAwaitingResponse: boolean; signature?: SignatureOutcome }
  | { ok: false; sent: false; reason: "not_configured" | "reconnect" | "error"; message: string }
  | { ok: false; sent: true; message: string };

export async function sendNewEmail(params: {
  to: string;
  lead: InboxLeadMatch | null;
  subject: string;
  body: string;
  userId: string;
  sendEmailFn: SendEmailFn;
  prismaClient: SendLeadEmailPrisma;
}): Promise<NewEmailResult> {
  if (params.lead && !params.lead.scrapped) {
    const outcome = await sendLeadEmailAndRecord({
      lead: { id: params.lead.id, stage: params.lead.stage },
      to: params.to,
      subject: params.subject,
      body: params.body,
      userId: params.userId,
      threadContext: null,
      sendEmailFn: params.sendEmailFn,
      prismaClient: params.prismaClient,
    });
    if (!outcome.ok) return outcome;
    return {
      ok: true,
      recordedOnLead: true,
      movedToAwaitingResponse: outcome.movedToAwaitingResponse,
      signature: outcome.signature,
    };
  }

  const result = await params.sendEmailFn({
    to: params.to,
    subject: params.subject,
    body: params.body,
    threadContext: null,
  });
  if (!result.ok) return { ok: false, sent: false, reason: result.reason, message: result.message };
  return { ok: true, recordedOnLead: false, movedToAwaitingResponse: false, signature: result.data.signature };
}
