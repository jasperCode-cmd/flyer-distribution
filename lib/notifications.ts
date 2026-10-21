// The bell: website enquiries not yet contacted, new applications from the
// website form, callbacks due and follow-up tasks due today or overdue. The
// same for both users. Worked out from the facts Priorities already reads
// (so the two share one set of queries), plus the callbacks due. No server
// imports: the bell in the browser uses these types.

import type { Business } from "./business";
import type { ApplicationFacts, LeadFacts, TaskFacts } from "./priorities";

export type Notifications = {
  count: number;
  websiteLeads: { id: string; name: string; createdAt: string; business?: Business }[];
  // Imported past applications are left out, so an import never floods the bell.
  newApplications: { id: string; fullName: string; receivedAt: string; business?: Business }[];
  dueCallbacks: { id: string; name: string; nextCallableAt: string }[];
  followUps: { id: string; description: string; dueDate: string; leadId: string; leadName: string; overdue: boolean }[];
};

const newestFirst = (a: string, b: string) => Date.parse(b) - Date.parse(a);

export function notificationsFrom(
  facts: { leads: LeadFacts[]; applications: ApplicationFacts[]; tasks: TaskFacts[] },
  dueCallbacks: { id: string; name: string; nextCallableAt: Date | string }[],
  now: Date
): Notifications {
  const websiteLeads = facts.leads
    .filter((l) => !l.scrapped && l.stage === "UNCONTACTED" && l.source === "WEBSITE_QUOTE_FORM")
    .sort((a, b) => newestFirst(a.createdAt, b.createdAt))
    .map((l) => ({ id: l.id, name: l.name, createdAt: l.createdAt, business: l.business }));

  const newApplications = facts.applications
    .filter((a) => a.status === "NEW" && a.source === "WEBSITE_FORM")
    .sort((a, b) => newestFirst(a.receivedAt, b.receivedAt))
    .map((a) => ({ id: a.id, fullName: a.fullName, receivedAt: a.receivedAt, business: a.business }));

  // Due today or overdue by the server's day, earliest first. A task with no
  // lead (possible from the Priorities page) is left out: each links to its lead.
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
  const followUps = facts.tasks
    .filter((t) => Date.parse(t.dueDate) < startOfTomorrow.getTime())
    .sort((a, b) => Date.parse(a.dueDate) - Date.parse(b.dueDate))
    .flatMap((t) =>
      t.lead
        ? [{ id: t.id, description: t.description, dueDate: t.dueDate, leadId: t.lead.id, leadName: t.lead.name, overdue: Date.parse(t.dueDate) < startOfToday.getTime() }]
        : []
    );

  const callbacks = dueCallbacks.map((c) => ({
    id: c.id,
    name: c.name,
    nextCallableAt: typeof c.nextCallableAt === "string" ? c.nextCallableAt : c.nextCallableAt.toISOString(),
  }));

  return {
    count: websiteLeads.length + newApplications.length + callbacks.length + followUps.length,
    websiteLeads,
    newApplications,
    dueCallbacks: callbacks,
    followUps,
  };
}
