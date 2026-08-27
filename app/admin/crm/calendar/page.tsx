import { prisma } from "@/lib/prisma";
import CalendarView from "@/components/crm/CalendarView";
import type { CalendarEntry } from "@/lib/calendar-constants";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const [events, jobs, tasks, users, distributors, leads] = await Promise.all([
    prisma.calendarEvent.findMany({
      orderBy: { startDateTime: "asc" },
      include: {
        assignedToUser: { select: { id: true, name: true } },
        distributor: { select: { id: true, name: true } },
      },
    }),
    // All jobs: only dated ones produce calendar entries (filtered below),
    // but the "linked job" picker needs undated ones too.
    prisma.job.findMany({
      include: {
        lead: { select: { id: true, name: true, businessName: true } },
        distributor: { select: { id: true, name: true } },
      },
    }),
    prisma.task.findMany({
      include: { lead: { select: { id: true, name: true } } },
    }),
    prisma.user.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.distributor.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.lead.findMany({
      select: { id: true, name: true, businessName: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const entries: CalendarEntry[] = [];

  for (const e of events) {
    entries.push({
      id: e.id,
      kind: "EVENT",
      type: e.type,
      title: e.title,
      start: e.startDateTime.toISOString(),
      end: e.endDateTime ? e.endDateTime.toISOString() : null,
      notes: e.notes,
      completed: e.completed,
      href: null, // stored events open the edit modal instead
      assignedToUserId: e.assignedToUserId,
      assignedToName: e.assignedToUser?.name ?? null,
      distributorId: e.distributorId,
      distributorName: e.distributor?.name ?? null,
      linkedLeadId: e.linkedLeadId,
      linkedJobId: e.linkedJobId,
    });
  }

  // Derived, read-only. Built here at query time rather than duplicated as
  // CalendarEvent rows, so editing a Job date stays the single source.
  for (const j of jobs) {
    const label = j.lead.businessName || j.lead.name;
    const base = {
      notes: null,
      completed: false,
      href: `/admin/crm/leads/${j.lead.id}`,
      assignedToUserId: null,
      assignedToName: null,
      distributorId: j.distributorId,
      distributorName: j.distributor?.name ?? null,
      linkedLeadId: j.lead.id,
      linkedJobId: j.id,
      end: null,
    };
    if (j.campaignStartDate) {
      entries.push({
        ...base,
        id: `job-start-${j.id}`,
        kind: "JOB_START",
        type: "JOB_START",
        title: `${label} — campaign start`,
        start: j.campaignStartDate.toISOString(),
      });
    }
    if (j.completionDate) {
      entries.push({
        ...base,
        id: `job-end-${j.id}`,
        kind: "JOB_COMPLETION",
        type: "JOB_COMPLETION",
        title: `${label} — delivery/completion`,
        start: j.completionDate.toISOString(),
        completed: j.deliveryConfirmed,
      });
    }
  }

  for (const t of tasks) {
    entries.push({
      id: `task-${t.id}`,
      kind: "TASK_DUE",
      type: "TASK_DUE",
      title: `${t.lead.name} — ${t.description}`,
      start: t.dueDate.toISOString(),
      end: null,
      notes: null,
      completed: t.completed,
      href: `/admin/crm/leads/${t.lead.id}`,
      assignedToUserId: null,
      assignedToName: null,
      distributorId: null,
      distributorName: null,
      linkedLeadId: t.lead.id,
      linkedJobId: null,
    });
  }

  entries.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  return (
    <div>
      <h1 className="text-xl font-bold text-blue-900 mb-4">Calendar</h1>
      <CalendarView
        entries={entries}
        users={users}
        distributors={distributors}
        leads={leads.map((l) => ({
          id: l.id,
          name: l.businessName ? `${l.name} — ${l.businessName}` : l.name,
        }))}
        jobs={jobs.map((j) => ({
          id: j.id,
          name: j.lead.businessName || j.lead.name,
        }))}
      />
    </div>
  );
}
