import "server-only";
import { prisma } from "@/lib/prisma";
import { CALENDAR_EVENT_TYPE_LABELS } from "@/lib/calendar-constants";

export function leadWithLastActivityArgs() {
  return {
    activities: { orderBy: { createdAt: "desc" as const }, take: 1 },
    assignedTo: { select: { id: true, name: true } },
    tags: { include: { tag: true } },
  };
}

export async function getLeadsWithLastActivity() {
  return prisma.lead.findMany({
    where: { scrapped: false },
    include: leadWithLastActivityArgs(),
    orderBy: { createdAt: "desc" },
  });
}

// Flattens the LeadTag join rows into a plain Tag[] for client components.
export function flattenTags<T extends { tags: { tag: { id: string; name: string; color: string } }[] }>(
  lead: T
) {
  return { ...lead, tags: lead.tags.map((lt) => lt.tag) };
}

export async function findDuplicateLeads(
  email: string | null | undefined,
  phone: string | null | undefined,
  excludeId?: string
) {
  const email_ = email?.trim();
  const phone_ = phone?.trim();
  if (!email_ && !phone_) return [];

  return prisma.lead.findMany({
    where: {
      id: excludeId ? { not: excludeId } : undefined,
      OR: [
        ...(email_ ? [{ email: email_ }] : []),
        ...(phone_ ? [{ phone: phone_ }] : []),
      ],
    },
    select: { id: true, name: true, email: true, phone: true },
    take: 5,
  });
}

export type UpcomingEntry = {
  id: string;
  title: string;
  typeLabel: string;
  when: Date;
  href: string;
};

// Manually scheduled events plus job dates, merged chronologically from the
// start of today. Job dates are read from Job rather than duplicated as
// CalendarEvent rows, matching how the calendar page itself builds them.
export async function getUpcomingSchedule(limit = 6): Promise<UpcomingEntry[]> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [events, jobs] = await Promise.all([
    prisma.calendarEvent.findMany({
      where: { completed: false, startDateTime: { gte: startOfToday } },
      orderBy: { startDateTime: "asc" },
      take: limit,
      select: {
        id: true,
        title: true,
        type: true,
        startDateTime: true,
        linkedLeadId: true,
      },
    }),
    prisma.job.findMany({
      where: {
        OR: [
          { campaignStartDate: { gte: startOfToday } },
          { completionDate: { gte: startOfToday } },
        ],
      },
      select: {
        id: true,
        campaignStartDate: true,
        completionDate: true,
        lead: { select: { id: true, name: true, businessName: true } },
      },
    }),
  ]);

  const entries: UpcomingEntry[] = events.map((e) => ({
    id: `event-${e.id}`,
    title: e.title,
    typeLabel: CALENDAR_EVENT_TYPE_LABELS[e.type] ?? e.type,
    when: e.startDateTime,
    // Prefer the linked lead when there is one; the calendar has no
    // per-day route to deep-link into.
    href: e.linkedLeadId ? `/admin/crm/leads/${e.linkedLeadId}` : "/admin/crm/calendar",
  }));

  for (const j of jobs) {
    const label = j.lead.businessName || j.lead.name;
    const href = `/admin/crm/leads/${j.lead.id}`;
    if (j.campaignStartDate && j.campaignStartDate >= startOfToday) {
      entries.push({
        id: `job-start-${j.id}`,
        title: `${label} — campaign start`,
        typeLabel: "Job",
        when: j.campaignStartDate,
        href,
      });
    }
    if (j.completionDate && j.completionDate >= startOfToday) {
      entries.push({
        id: `job-end-${j.id}`,
        title: `${label} — delivery/completion`,
        typeLabel: "Job",
        when: j.completionDate,
        href,
      });
    }
  }

  return entries.sort((a, b) => a.when.getTime() - b.when.getTime()).slice(0, limit);
}

// Shared WHERE clause for the dialer's active queue — see crm-constants'
// queue-ordering comment for the full algorithm this pairs with. Kept as a
// plain object builder (not a query itself) so /next (take 1) and /queue
// (the full list view) stay byte-for-byte consistent with each other.
export function dialerQueueWhere({
  source,
  tagId,
  userId,
  excludeIds,
}: {
  source: string;
  tagId?: string;
  userId: string;
  excludeIds?: string[];
}) {
  return {
    scrapped: false,
    stage: "UNCONTACTED" as const,
    source: source as never,
    ...(tagId ? { tags: { some: { tagId } } } : {}),
    OR: [{ assignedToId: null }, { assignedToId: userId }],
    AND: [
      { OR: [{ nextCallableAt: null }, { nextCallableAt: { lte: new Date() } }] },
      ...(excludeIds && excludeIds.length > 0 ? [{ id: { notIn: excludeIds } }] : []),
    ],
  };
}

// nextCallableAt ascending with nulls last (never-called leads sort after
// any real, overdue callback date), then createdAt ascending as the
// tiebreak among never-called leads — oldest/first-imported first.
export const dialerQueueOrderBy = [
  { nextCallableAt: { sort: "asc" as const, nulls: "last" as const } },
  { createdAt: "asc" as const },
];

export function dialerLeadSelect() {
  return {
    id: true,
    name: true,
    businessName: true,
    phone: true,
    source: true,
    addressArea: true,
    targetAreas: true,
    postcode: true,
    dealValue: true,
    noAnswerStreak: true,
    nextCallableAt: true,
    assignedToId: true,
    assignedTo: { select: { id: true, name: true } },
    createdAt: true,
    activities: {
      where: { type: "CALL" as const },
      orderBy: { createdAt: "desc" as const },
      take: 1,
      include: { user: { select: { name: true } } },
    },
  };
}

export async function getNextDialerLead(params: {
  source: string;
  tagId?: string;
  userId: string;
  excludeIds?: string[];
}) {
  return prisma.lead.findFirst({
    where: dialerQueueWhere(params),
    orderBy: dialerQueueOrderBy,
    select: dialerLeadSelect(),
  });
}

export async function getDialerQueueList(params: { source: string; tagId?: string; userId: string }) {
  return prisma.lead.findMany({
    where: dialerQueueWhere(params),
    orderBy: dialerQueueOrderBy,
    select: dialerLeadSelect(),
    take: 200,
  });
}

export async function getCallsMadeToday(userId: string) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  return prisma.activity.count({
    where: {
      userId,
      type: "CALL",
      detail: { startsWith: "Dialer:" },
      createdAt: { gte: startOfToday },
    },
  });
}

export async function getInboundLeadCount() {
  return prisma.lead.count({
    where: { scrapped: false, stage: "UNCONTACTED", source: "WEBSITE_QUOTE_FORM" },
  });
}

export async function getDueCallbackCount() {
  return prisma.lead.count({
    where: { scrapped: false, stage: "UNCONTACTED", nextCallableAt: { lte: new Date() } },
  });
}

export async function getFollowUpTasks() {
  const tasks = await prisma.task.findMany({
    where: { completed: false },
    include: { lead: { select: { id: true, name: true } } },
    orderBy: { dueDate: "asc" },
  });

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  const overdue = tasks.filter((t) => t.dueDate < startOfToday);
  const today = tasks.filter((t) => t.dueDate >= startOfToday && t.dueDate < startOfTomorrow);

  return { overdue, today };
}
