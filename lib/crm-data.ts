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
