import "server-only";
import { prisma } from "./prisma";
import { mapWithConcurrency, withInboxReader } from "./gmail";
import { unansweredLeadEmails } from "./priorities-email";
import { QUERY_CONCURRENCY, runLimited } from "./run-limited";
import {
  addDays,
  buildPriorities,
  isPriorityLevel,
  ukDay,
  type EmailFacts,
  type PriorityEmailStatus,
  type PriorityInputs,
  type PriorityList,
} from "./priorities";

// Loads what the Priorities rules read. The database part is quick and is
// shown first; the Gmail part (unanswered emails) is separate, cached for
// about two minutes, and only ever looks at the most recent inbox
// conversations. If Gmail isn't connected the rest of the list still works.

export const EMAIL_SCAN_THREADS = 50;
const EMAIL_CACHE_MS = 2 * 60 * 1000;
const EMAIL_REFRESH_MIN_MS = 10 * 1000;

const LEAD_REF = { id: true, name: true, businessName: true, email: true, phone: true, stage: true, business: true } as const;

export async function loadDatabaseFacts(now: Date): Promise<Omit<PriorityInputs, "emails">> {
  const today = ukDay(now);
  // A generous window for campaigns; the rule itself checks the UK days.
  const campaignFrom = new Date(Date.parse(`${addDays(today, -1)}T00:00:00Z`));
  const campaignTo = new Date(Date.parse(`${addDays(today, 9)}T00:00:00Z`));

  const [leads, applications, tasks, dismissals] = await runLimited(QUERY_CONCURRENCY, [
    () => prisma.lead.findMany({
      where: {
        scrapped: false,
        OR: [
          { source: "WEBSITE_QUOTE_FORM", stage: "UNCONTACTED" },
          { stage: { in: ["AWAITING_RESPONSE", "COMPLETED"] } },
          { stage: { in: ["WON", "COMPLETED"] }, job: { campaignStartDate: { gte: campaignFrom, lte: campaignTo } } },
        ],
      },
      select: {
        ...LEAD_REF,
        source: true,
        paymentStatus: true,
        reviewStatus: true,
        createdAt: true,
        scrapped: true,
        activities: {
          where: { type: { in: ["STAGE_CHANGE", "CALL", "EMAIL", "NOTE"] } },
          orderBy: { createdAt: "desc" },
          take: 60,
          select: { type: true, detail: true, createdAt: true, userId: true },
        },
        job: { select: { campaignStartDate: true, completionDate: true, distributorId: true, distributorName: true } },
        costs: { where: { category: "DISTRIBUTOR" }, select: { id: true }, take: 1 },
      },
    }),
    () => prisma.distributorApplication.findMany({
      where: { status: "NEW" },
      select: { id: true, fullName: true, email: true, phone: true, status: true, receivedAt: true, updatedAt: true },
    }),
    () => prisma.task.findMany({
      where: { completed: false },
      select: { id: true, description: true, dueDate: true, priority: true, lead: { select: LEAD_REF } },
    }),
    () => prisma.priorityDismissal.findMany({
      select: { itemKey: true, fingerprint: true, snoozedUntil: true, dismissed: true },
    }),
  ]);

  return {
    now,
    leads: leads.map((l) => ({
      id: l.id,
      name: l.name,
      businessName: l.businessName,
      email: l.email,
      phone: l.phone,
      stage: l.stage,
      business: l.business,
      source: l.source,
      paymentStatus: l.paymentStatus,
      reviewStatus: l.reviewStatus,
      createdAt: l.createdAt.toISOString(),
      scrapped: l.scrapped,
      activities: l.activities.map((a) => ({
        type: a.type,
        detail: a.detail,
        createdAt: a.createdAt.toISOString(),
        userId: a.userId,
      })),
      job: l.job
        ? {
            campaignStartDate: l.job.campaignStartDate?.toISOString() ?? null,
            completionDate: l.job.completionDate?.toISOString() ?? null,
            distributorId: l.job.distributorId,
            distributorName: l.job.distributorName,
            hasDistributorCost: l.costs.length > 0,
          }
        : null,
    })),
    applications: applications.map((a) => ({
      ...a,
      receivedAt: a.receivedAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    })),
    tasks: tasks.map((t) => ({
      id: t.id,
      description: t.description,
      dueDate: t.dueDate.toISOString(),
      priority: isPriorityLevel(t.priority) ? t.priority : "NORMAL",
      lead: t.lead,
    })),
    dismissals: dismissals.map((d) => ({ ...d, snoozedUntil: d.snoozedUntil?.toISOString() ?? null })),
  };
}

export type EmailScan = PriorityEmailStatus & { emails: EmailFacts[] };

let emailCache: { at: number; value: EmailScan } | null = null;
// A scan already under way, so the page and the navigation count asking at
// the same moment share one look at Gmail.
let emailScanInFlight: Promise<EmailScan> | null = null;

// The most recent inbox conversations, newest first, each checked for a
// latest message from a lead with nothing sent by us after it (see
// unansweredLeadEmails).
export async function scanUnansweredEmails(options: { fresh?: boolean } = {}): Promise<EmailScan> {
  const nowMs = Date.now();
  if (emailCache) {
    const age = nowMs - emailCache.at;
    if (age < EMAIL_CACHE_MS && !(options.fresh && age > EMAIL_REFRESH_MIN_MS)) return emailCache.value;
  }
  if (emailScanInFlight) return emailScanInFlight;
  emailScanInFlight = runEmailScan(nowMs).finally(() => {
    emailScanInFlight = null;
  });
  return emailScanInFlight;
}

async function runEmailScan(nowMs: number): Promise<EmailScan> {
  const result = await withInboxReader(async (reader, context) => {
    const list = await reader.listThreadIds({ labelIds: ["INBOX"], maxResults: EMAIL_SCAN_THREADS });
    const threads = await mapWithConcurrency(list.ids, 5, (id) => reader.getThreadMetadata(id));
    const emails = await unansweredLeadEmails(threads, context, prisma);
    return { emails, limited: list.nextPageToken !== null, scanned: list.ids.length };
  });

  const value: EmailScan = result.ok
    ? { status: "ok", ...result.data, checkedAt: new Date(nowMs).toISOString() }
    : { status: result.reason, emails: [], limited: false, scanned: 0, checkedAt: new Date(nowMs).toISOString() };
  // A failure is cached too, so a Gmail outage doesn't slow every page.
  emailCache = { at: nowMs, value };
  return value;
}

// The email items carry only what the inbox match knows about the lead; fill
// in the rest so a row can offer Call and the business name.
async function completeEmailLeads(emails: EmailFacts[]): Promise<EmailFacts[]> {
  if (emails.length === 0) return emails;
  const leads = await prisma.lead.findMany({
    where: { id: { in: [...new Set(emails.map((e) => e.lead.id))] } },
    select: LEAD_REF,
  });
  const byId = new Map(leads.map((l) => [l.id, l]));
  return emails.map((e) => ({ ...e, lead: byId.get(e.lead.id) ?? e.lead }));
}

export async function loadPriorityList(options: { withEmail: boolean; fresh?: boolean }): Promise<PriorityList> {
  const now = new Date();
  const [facts, scan] = await Promise.all([
    loadDatabaseFacts(now),
    options.withEmail ? scanUnansweredEmails({ fresh: options.fresh }) : Promise.resolve(null),
  ]);
  const emails = scan ? await completeEmailLeads(scan.emails) : [];
  const rows = buildPriorities({ ...facts, emails });
  return {
    rows,
    email: scan ? { status: scan.status, limited: scan.limited, scanned: scan.scanned, checkedAt: scan.checkedAt } : null,
    generatedAt: now.toISOString(),
  };
}
