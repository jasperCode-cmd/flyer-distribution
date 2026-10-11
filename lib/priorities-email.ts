import type { gmail_v1 } from "@googleapis/gmail";
import { latestUnanswered, shouldExcludeThread, type GmailReadContext } from "./gmail";
import { findLeadsForAddresses, pickThreadLead, type InboxLeadsPrisma } from "./inbox-leads";
import type { EmailFacts } from "./priorities";

// Rule 2's Gmail half, kept apart from the Gmail client so it can be tested
// with plain threads: of the threads scanned, those whose latest message
// came from a lead (matched on its sender or single Reply-To, as the inbox
// does) with nothing sent by us after it. A thread touching an address in
// GMAIL_EXCLUDE_ADDRESSES is skipped, as everywhere else, and so is a
// scrapped lead.
export async function unansweredLeadEmails(
  threads: (gmail_v1.Schema$Thread | null)[],
  context: GmailReadContext,
  db: InboxLeadsPrisma
): Promise<EmailFacts[]> {
  const candidates = threads
    .filter((t): t is gmail_v1.Schema$Thread => !!t && !shouldExcludeThread(t.messages ?? undefined, context.excluded))
    .map((t) => latestUnanswered(t, context.senderAddress))
    .filter((m): m is NonNullable<typeof m> => m !== null);
  if (candidates.length === 0) return [];
  const matches = await findLeadsForAddresses(
    db,
    candidates.flatMap((c) => [c.fromAddress, c.replyToAddress ?? ""])
  );
  const emails: EmailFacts[] = [];
  for (const c of candidates) {
    const lead = pickThreadLead(matches, { replyTo: c.replyToAddress, from: c.fromAddress });
    if (!lead || lead.scrapped) continue;
    emails.push({
      lead: { id: lead.id, name: lead.name, businessName: null, email: lead.email, phone: null, stage: lead.stage },
      threadId: c.threadId,
      messageId: c.messageId,
      receivedAt: c.receivedAt,
      subject: c.subject,
      messageIdHeader: c.messageIdHeader,
    });
  }
  return emails;
}
