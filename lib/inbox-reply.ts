import "server-only";
import { sendLeadEmailAndRecord } from "./send-lead-email";
import type { SendEmailFn, SendLeadEmailPrisma, SendLeadEmailResult } from "./send-lead-email";
import type { SignatureOutcome } from "./gmail";
import type { InboxLeadMatch } from "./inbox-leads";

export type InboxReplyResult =
  | SendLeadEmailResult
  | { ok: true; movedToAwaitingResponse: false; threadId: string; signature?: SignatureOutcome };

// A reply from the inbox, always sent to the recipient the server worked out
// from the thread (the Reply-To when there is a single valid one, otherwise
// the sender). When the thread matches a live lead, it goes through exactly
// the same send-and-record path as a reply from the lead's own page, so the
// EMAIL Activity is written and an Uncontacted lead moves to Awaiting
// Response via the shared stage logic. Anyone else (including a scrapped
// lead, which the CRM never emails from a lead page) just gets a threaded
// reply, with nothing written to the database.
export async function sendInboxReply(params: {
  threadId: string;
  lastMessageId: string | null;
  recipientAddress: string;
  lead: InboxLeadMatch | null;
  subject: string;
  body: string;
  userId: string;
  sendEmailFn: SendEmailFn;
  prismaClient: SendLeadEmailPrisma;
  sendLeadEmailFn?: typeof sendLeadEmailAndRecord;
}): Promise<InboxReplyResult> {
  const threadContext = { threadId: params.threadId, lastMessageId: params.lastMessageId ?? "" };

  if (params.lead && !params.lead.scrapped) {
    const sendLead = params.sendLeadEmailFn ?? sendLeadEmailAndRecord;
    return sendLead({
      lead: { id: params.lead.id, stage: params.lead.stage },
      to: params.recipientAddress,
      subject: params.subject,
      body: params.body,
      userId: params.userId,
      threadContext,
      sendEmailFn: params.sendEmailFn,
      prismaClient: params.prismaClient,
    });
  }

  const result = await params.sendEmailFn({
    to: params.recipientAddress,
    subject: params.subject,
    body: params.body,
    threadContext,
  });
  if (!result.ok) {
    return { ok: false, sent: false, reason: result.reason, message: result.message };
  }
  return { ok: true, movedToAwaitingResponse: false, threadId: result.data.threadId, signature: result.data.signature };
}
