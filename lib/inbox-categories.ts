import type { gmail_v1 } from "@googleapis/gmail";
import { parseMailbox } from "./gmail";
import { DISTRIBUTOR_APPLICATION_SUBJECT } from "./distributor-application-form";
import type { InboxLeadMatch } from "./inbox-leads";

// The inbox filter buttons, in order. Each category is one entry, of one of
// two kinds:
//   - "gmail": a Gmail search added to the inbox query, paged by Gmail. An
//     optional keep() checks each returned thread again, because Gmail's
//     subject search matches words rather than the exact subject.
//   - "crm": a matcher that checks each thread's From and Reply-To against CRM
//     records while the inbox is scanned in batches (with Load more).
// Adding a category means adding one entry to INBOX_CATEGORIES. Whatever the
// category, GMAIL_EXCLUDE_ADDRESSES is applied before it ever sees a thread.

// Web3Forms sends every form notification from this address.
export const WEB3FORMS_SENDER = "notify@web3forms.com";
// The subject components/QuoteForm.tsx sends with each quote request.
export const QUOTE_NOTIFICATION_SUBJECT = "New Quote Request - Flyer Distribution Hampshire";

// What a thread's From and Reply-To matched in the CRM.
export type CrmRecordMatches = {
  lead: InboxLeadMatch | null;
  distributor: { id: string; name: string } | null;
  applicant: { id: string; fullName: string } | null;
};

export type InboxCategory =
  | {
      id: string;
      label: string;
      kind: "gmail";
      query: string;
      keep?: (thread: gmail_v1.Schema$Thread) => boolean;
    }
  | {
      id: string;
      label: string;
      kind: "crm";
      matches: (thread: gmail_v1.Schema$Thread, crm: CrmRecordMatches) => boolean;
    };

function header(message: gmail_v1.Schema$Message, name: string): string | null {
  return message.payload?.headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? null;
}

function sameSubject(a: string | null, b: string): boolean {
  const tidy = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
  return a !== null && tidy(a) === tidy(b);
}

export function notificationQuery(sender: string, subject: string): string {
  return `from:${sender} subject:"${subject.replace(/"/g, "")}"`;
}

// A thread holding a form notification itself: sent by the form service with
// exactly this subject, so a reply ("Re: ...") or anything we sent never
// counts on its own.
export function isFormNotification(thread: gmail_v1.Schema$Thread, sender: string, subject: string): boolean {
  return (thread.messages ?? []).some((m) => {
    const labels = m.labelIds ?? [];
    if (labels.includes("SENT") || labels.includes("DRAFT")) return false;
    return (
      parseMailbox(header(m, "From")).address.toLowerCase() === sender.toLowerCase() &&
      sameSubject(header(m, "Subject"), subject)
    );
  });
}

export const INBOX_CATEGORIES: InboxCategory[] = [
  { id: "all", label: "All", kind: "gmail", query: "" },
  {
    id: "leads",
    label: "Leads",
    kind: "crm",
    matches: (_thread, crm) => crm.lead !== null,
  },
  {
    id: "enquiries",
    label: "New enquiries",
    kind: "gmail",
    query: notificationQuery(WEB3FORMS_SENDER, QUOTE_NOTIFICATION_SUBJECT),
    keep: (thread) => isFormNotification(thread, WEB3FORMS_SENDER, QUOTE_NOTIFICATION_SUBJECT),
  },
  {
    id: "distributors",
    label: "Distributors",
    kind: "crm",
    // Application notifications, plus anyone who is a Distributor or has
    // applied to be one.
    matches: (thread, crm) =>
      isFormNotification(thread, WEB3FORMS_SENDER, DISTRIBUTOR_APPLICATION_SUBJECT) ||
      crm.distributor !== null ||
      crm.applicant !== null,
  },
];

export const DEFAULT_INBOX_CATEGORY = "all";

// Unknown ids are refused rather than quietly treated as All.
export function findInboxCategory(id: string | null | undefined): InboxCategory | null {
  const wanted = id || DEFAULT_INBOX_CATEGORY;
  return INBOX_CATEGORIES.find((c) => c.id === wanted) ?? null;
}
