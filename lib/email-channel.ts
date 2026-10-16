import "server-only";
import { sendEmail } from "./gmail";
import { sendViaBrevo } from "./ldb-email";
import type { Business } from "./business";
import type { SendEmailFn } from "./send-lead-email";
import type { InboxLeadMatch } from "./inbox-leads";

// The one place an email's channel is chosen, by business. FDH goes through
// the FDH Gmail as before. LDB only ever goes through Brevo, so an LDB email
// can never leave from the FDH Gmail, even when Brevo isn't set up (it is
// then refused as "Bournemouth email not connected"). The senders can be
// swapped in a test.

export type ChannelSenders = { gmail: SendEmailFn; ldb: SendEmailFn };

const REAL_SENDERS: ChannelSenders = { gmail: sendEmail, ldb: (params) => sendViaBrevo(params) };

export function senderFor(business: Business, senders: ChannelSenders = REAL_SENDERS): SendEmailFn {
  return business === "LDB" ? senders.ldb : senders.gmail;
}

// An inbox reply is Bournemouth mail when the conversation went through the
// LDB address or is with an LDB lead.
export function replyBusiness(isLdbThread: boolean, lead: Pick<InboxLeadMatch, "business"> | null): Business {
  return isLdbThread || lead?.business === "LDB" ? "LDB" : "FDH";
}

export const BOTH_BUSINESSES_ERROR =
  "This address is on both an FDH lead and a Bournemouth lead, so the CRM can't tell which business to send from. Email them from the lead's own page instead.";

// A new email from the Inbox: the To address's leads decide. No lead sends
// from Gmail as before; an address on leads of both businesses is refused
// rather than guessed.
export function newEmailBusiness(
  match: Pick<InboxLeadMatch, "business" | "businesses"> | null
): { ok: true; business: Business } | { ok: false; error: string } {
  if (!match) return { ok: true, business: "FDH" };
  if (match.businesses.includes("FDH") && match.businesses.includes("LDB")) {
    return { ok: false, error: BOTH_BUSINESSES_ERROR };
  }
  return { ok: true, business: match.business };
}
