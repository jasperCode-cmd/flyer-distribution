import type { gmail_v1 } from "@googleapis/gmail";
import {
  extractTextVariants,
  isLdbThread,
  mapWithConcurrency,
  parseMailbox,
  shouldExcludeThread,
  singleReplyTo,
  type GmailMessageReader,
  type GmailReadContext,
} from "./gmail";
import {
  formatNoteDate,
  normalizePhone,
  parseApplicationEmail,
  type ApplicationFields,
  type ParsedApplication,
} from "./distributor-applications";
import { isLdbApplicationNotification, ldbApplicationSearchQuery, readLdbApplication } from "./ldb-application-import";
import type { NotificationRules } from "./ldb-backfill";
import type { Business } from "./business";

// Importing past applications from the business Gmail: the FDH form's Work
// With Us notifications and the Leaflet Distribution Bournemouth website's
// distributor application notifications (lib/ldb-application-import.ts).
// Read-only: Gmail is only searched and read, never changed. Every thread is
// checked against the hidden addresses as a whole, the same rule as the
// inbox, so an application involving another business never comes in.

export const IMPORT_SCAN_MAX = 500;
const THREAD_CONCURRENCY = 5;

export type ImportCandidate = {
  messageId: string;
  threadId: string;
  receivedAt: string;
  // Which website's notification it is, and so the business it is saved as.
  business: Business;
  parsed: ParsedApplication;
};

export type DuplicateFlag =
  | { kind: "existing"; name: string; receivedAt: string }
  | { kind: "batch"; name: string }
  | null;

function header(message: gmail_v1.Schema$Message, name: string): string | null {
  const h = message.payload?.headers?.find((x) => x.name?.toLowerCase() === name.toLowerCase());
  return h?.value ?? null;
}

function sameSubject(a: string | null, b: string): boolean {
  const tidy = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
  return a !== null && tidy(a) === tidy(b);
}

export function applicationSearchQuery(subject: string): string {
  return `subject:"${subject.replace(/"/g, "")}"`;
}

// Gmail's subject search matches words, so every result is checked again
// here: the exact notification subject (not a reply or forward of it),
// received rather than sent or drafted by us.
export function isApplicationNotification(
  message: gmail_v1.Schema$Message,
  subject: string,
  senderAddress: string
): boolean {
  if (!sameSubject(header(message, "Subject"), subject)) return false;
  const labels = message.labelIds ?? [];
  if (labels.includes("SENT") || labels.includes("DRAFT")) return false;
  const from = parseMailbox(header(message, "From")).address.toLowerCase();
  return from !== senderAddress.toLowerCase();
}

function receivedAt(message: gmail_v1.Schema$Message): string {
  if (message.internalDate) return new Date(Number(message.internalDate)).toISOString();
  const date = header(message, "Date");
  const parsed = date ? new Date(date) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : new Date().toISOString();
}

export function candidateFromMessage(message: gmail_v1.Schema$Message, senderAddress: string): ImportCandidate {
  const replyTo = singleReplyTo(header(message, "Reply-To"), senderAddress);
  const { plain, fromHtml } = extractTextVariants(message.payload);
  return {
    messageId: message.id ?? "",
    threadId: message.threadId ?? "",
    receivedAt: receivedAt(message),
    business: "FDH",
    parsed: parseApplicationEmail({ plain, fromHtml, replyTo: replyTo?.address ?? null }),
  };
}

// How a Bournemouth notification is told apart: sent from the LDB address to
// the Hampshire Gmail, with none of our addresses as Reply-To.
function ldbRules(context: GmailReadContext, ldbAddress: string): NotificationRules {
  const inbox = context.senderAddress.toLowerCase();
  const ours = [...new Set([...(context.own ?? []), inbox, ldbAddress].map((a) => a.toLowerCase()))];
  return { from: ldbAddress.toLowerCase(), inbox, ours };
}

// The application emails in one thread, or none at all if the thread
// touches a hidden address anywhere. A thread that involves the LDB address
// is Bournemouth mail, so never an FDH application; only the LDB website's
// own notifications are taken from it.
export function candidatesFromThread(
  thread: gmail_v1.Schema$Thread,
  wanted: Set<string>,
  context: GmailReadContext & { subject: string }
): ImportCandidate[] {
  const messages = thread.messages ?? [];
  if (shouldExcludeThread(messages, context.excluded)) return [];
  const ldbAddress = context.ldbAddress ?? null;
  const ldbThread = isLdbThread(messages, ldbAddress);
  const rules = ldbAddress ? ldbRules(context, ldbAddress) : null;
  return messages
    .filter((m) => m.id && wanted.has(m.id))
    .flatMap((m): ImportCandidate[] => {
      if (!ldbThread && isApplicationNotification(m, context.subject, context.senderAddress)) {
        return [candidateFromMessage(m, context.senderAddress)];
      }
      if (rules && isLdbApplicationNotification(m, rules)) {
        return [
          {
            messageId: m.id ?? "",
            threadId: m.threadId ?? thread.id ?? "",
            receivedAt: receivedAt(m),
            business: "LDB",
            parsed: readLdbApplication(m, rules.ours),
          },
        ];
      }
      return [];
    });
}

async function readThreads(
  reader: GmailMessageReader,
  refs: { id: string; threadId: string }[],
  context: GmailReadContext & { subject: string }
): Promise<ImportCandidate[]> {
  const wanted = new Set(refs.map((r) => r.id));
  const threadIds = [...new Set(refs.map((r) => r.threadId))];
  const threads = await mapWithConcurrency(threadIds, THREAD_CONCURRENCY, (id) => reader.getThread(id));
  return threads
    .flatMap((t) => (t ? candidatesFromThread(t, wanted, context) : []))
    .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
}

type MessageRef = { id: string; threadId: string };

// Up to max results of one search, newest first, across pages.
async function listUpTo(
  reader: GmailMessageReader,
  q: string,
  max: number
): Promise<{ refs: MessageRef[]; truncated: boolean }> {
  const found: MessageRef[] = [];
  let pageToken: string | undefined;
  do {
    const page = await reader.listMessageIds(q, pageToken);
    found.push(...page.messages);
    pageToken = page.nextPageToken ?? undefined;
    if (found.length >= max) return { refs: found.slice(0, max), truncated: found.length > max || !!pageToken };
  } while (pageToken);
  return { refs: found, truncated: false };
}

// Both searches' results, taken in turn so that neither website's can crowd
// out the other's, without duplicates and no more than max in all.
function mergeRefs(lists: MessageRef[][], max: number): { refs: MessageRef[]; dropped: boolean } {
  const seen = new Set<string>();
  const refs: MessageRef[] = [];
  const longest = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < longest; i++) {
    for (const list of lists) {
      const ref = list[i];
      if (!ref || seen.has(ref.id)) continue;
      seen.add(ref.id);
      refs.push(ref);
    }
  }
  return { refs: refs.slice(0, max), dropped: refs.length > max };
}

// The preview: every application email found, newest first, minus any
// already imported (by Gmail message ID). Those are skipped before their
// content is even fetched. Nothing is saved here. The FDH notifications are
// found by their subject, and the Bournemouth ones by theirs and the LDB
// address, when there is one.
export async function findApplicationEmails(
  reader: GmailMessageReader,
  context: GmailReadContext & { subject: string },
  options: { alreadyImported: (messageIds: string[]) => Promise<Set<string>>; max?: number }
): Promise<{ candidates: ImportCandidate[]; alreadyImported: number; truncated: boolean }> {
  const max = options.max ?? IMPORT_SCAN_MAX;
  const queries = [
    applicationSearchQuery(context.subject),
    ...(context.ldbAddress ? [ldbApplicationSearchQuery(context.ldbAddress)] : []),
  ];
  const searches: { refs: MessageRef[]; truncated: boolean }[] = [];
  for (const q of queries) searches.push(await listUpTo(reader, q, max));
  const { refs, dropped } = mergeRefs(searches.map((s) => s.refs), max);
  const truncated = dropped || searches.some((s) => s.truncated);

  const imported = await options.alreadyImported(refs.map((r) => r.id));
  const fresh = refs.filter((r) => !imported.has(r.id));
  const candidates = await readThreads(reader, fresh, context);
  return { candidates, alreadyImported: refs.length - fresh.length, truncated };
}

// Confirm: the chosen emails are read again from Gmail (not taken from the
// browser) and go through every check once more.
export async function loadSelectedApplicationEmails(
  reader: GmailMessageReader,
  context: GmailReadContext & { subject: string },
  selections: { messageId: string; threadId: string }[],
  alreadyImported: (messageIds: string[]) => Promise<Set<string>>
): Promise<ImportCandidate[]> {
  const imported = await alreadyImported(selections.map((s) => s.messageId));
  const fresh = selections
    .filter((s) => !imported.has(s.messageId))
    .map((s) => ({ id: s.messageId, threadId: s.threadId }));
  const candidates = await readThreads(reader, fresh, context);
  return candidates.filter((c) => c.parsed.readable);
}

// Likely duplicates by phone: against applications already in the CRM, and
// against an older email in the same import.
export function flagDuplicates(
  candidates: ImportCandidate[],
  existing: { fullName: string; phone: string | null; receivedAt: Date }[]
): Map<string, DuplicateFlag> {
  const byPhone = new Map<string, { fullName: string; receivedAt: Date }>();
  for (const e of existing) {
    const key = normalizePhone(e.phone);
    if (key.length >= 7 && !byPhone.has(key)) byPhone.set(key, e);
  }
  const flags = new Map<string, DuplicateFlag>();
  const seen = new Map<string, string>();
  const oldestFirst = [...candidates].sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
  for (const c of oldestFirst) {
    const key = normalizePhone(c.parsed.fields.phone);
    let flag: DuplicateFlag = null;
    if (key.length >= 7) {
      const match = byPhone.get(key);
      if (match) flag = { kind: "existing", name: match.fullName, receivedAt: match.receivedAt.toISOString() };
      else if (seen.has(key)) flag = { kind: "batch", name: seen.get(key)! };
      else seen.set(key, c.parsed.fields.fullName);
    }
    flags.set(c.messageId, flag);
  }
  return flags;
}

export function duplicateNote(flag: DuplicateFlag): string | null {
  if (!flag) return null;
  if (flag.kind === "existing") {
    return `Possible duplicate: same phone number as ${flag.name}'s application from ${formatNoteDate(new Date(flag.receivedAt))}.`;
  }
  return `Possible duplicate: same phone number as ${flag.name}'s application, imported at the same time.`;
}

export type SaveImportDb = {
  distributorApplication: {
    createMany(args: {
      data: (ApplicationFields & {
        source: "GMAIL_IMPORT";
        business: Business;
        gmailMessageId: string;
        receivedAt: Date;
        notes: string | null;
      })[];
      skipDuplicates: true;
    }): Promise<{ count: number }>;
  };
};

// The unique Gmail message ID means a message imported in the meantime (two
// people pressing Confirm at once) is skipped by the database, not doubled.
export async function saveImportedApplications(
  db: SaveImportDb,
  candidates: ImportCandidate[],
  flags: Map<string, DuplicateFlag>
): Promise<number> {
  const readable = candidates.filter((c) => c.parsed.readable && c.messageId);
  if (readable.length === 0) return 0;
  const result = await db.distributorApplication.createMany({
    data: readable.map((c) => ({
      ...c.parsed.fields,
      source: "GMAIL_IMPORT",
      business: c.business,
      gmailMessageId: c.messageId,
      receivedAt: new Date(c.receivedAt),
      notes: duplicateNote(flags.get(c.messageId) ?? null),
    })),
    skipDuplicates: true,
  });
  return result.count;
}
