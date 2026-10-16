import type { gmail_v1 } from "@googleapis/gmail";
import { isLdbThread, latestUnanswered, shouldExcludeThread, type GmailReadContext } from "./gmail";
import { findLeadCandidates, matchLeadsByEmail, pickThreadLead, type InboxLeadsPrisma } from "./inbox-leads";
import type { EmailFacts } from "./priorities";

// Rule 2's Gmail half, kept apart from the Gmail client so it can be tested
// with plain threads: of the threads scanned, those whose latest message
// came from a lead (matched on its sender or single Reply-To, as the inbox
// does) with nothing sent by us after it. A message from the Bournemouth
// address counts as sent by us. A thread touching a hidden address is
// skipped, as everywhere else, and so is a scrapped lead. A Bournemouth
// conversation only ever matches an LDB lead.
export async function unansweredLeadEmails(
  threads: (gmail_v1.Schema$Thread | null)[],
  context: GmailReadContext,
  db: InboxLeadsPrisma
): Promise<EmailFacts[]> {
  const own = context.own ?? context.senderAddress;
  const ldbAddress = context.ldbAddress ?? null;
  const candidates = threads
    .filter((t): t is gmail_v1.Schema$Thread => !!t && !shouldExcludeThread(t.messages ?? undefined, context.excluded))
    .map((t) => ({ message: latestUnanswered(t, own), ldb: isLdbThread(t.messages ?? undefined, ldbAddress) }))
    .filter((c): c is { message: NonNullable<typeof c.message>; ldb: boolean } => c.message !== null);
  if (candidates.length === 0) return [];
  const { unique, leads } = await findLeadCandidates(
    db,
    candidates.flatMap((c) => [c.message.fromAddress, c.message.replyToAddress ?? ""])
  );
  const anyLead = matchLeadsByEmail(unique, leads, { prefer: "FDH" });
  const ldbLead = matchLeadsByEmail(unique, leads, { only: "LDB" });
  const emails: EmailFacts[] = [];
  for (const { message: c, ldb } of candidates) {
    const lead = pickThreadLead(ldb ? ldbLead : anyLead, { replyTo: c.replyToAddress, from: c.fromAddress });
    if (!lead || lead.scrapped) continue;
    emails.push({
      lead: {
        id: lead.id,
        name: lead.name,
        businessName: null,
        email: lead.email,
        phone: null,
        stage: lead.stage,
        business: lead.business,
      },
      threadId: c.threadId,
      messageId: c.messageId,
      receivedAt: c.receivedAt,
      subject: c.subject,
      messageIdHeader: c.messageIdHeader,
    });
  }
  return emails;
}
