import { itemInFilter, type Business, type BusinessFilter } from "./business";
import { isPersonLoggedContact } from "./activity-origin";
import { STAGE_LABELS } from "./crm-constants";

// The Priorities list: one shared, ranked to-do list for both users. Pure
// and client-safe, so every rule is unit tested from plain data.
//
// Ranking: Urgent, High, Normal, Low; within a level, overdue tasks first,
// then whatever has waited longest (a campaign by how soon it starts).
// Each lead appears once, under its most important reason, with any other
// reasons listed underneath it.
//
// Automatic items clear themselves when their condition stops being true.
// Done hides one until its fingerprint (the state that raised it) changes;
// Snooze hides one until the snooze ends.

export const PRIORITY_LEVELS = ["URGENT", "HIGH", "NORMAL", "LOW"] as const;
export type PriorityLevel = (typeof PRIORITY_LEVELS)[number];
export const LEVEL_LABELS: Record<PriorityLevel, string> = { URGENT: "Urgent", HIGH: "High", NORMAL: "Normal", LOW: "Low" };
const LEVEL_RANK: Record<PriorityLevel, number> = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 };

export function isPriorityLevel(value: unknown): value is PriorityLevel {
  return typeof value === "string" && (PRIORITY_LEVELS as readonly string[]).includes(value);
}

export const REASON_TYPES = [
  "new_enquiry",
  "unanswered_email",
  "awaiting",
  "unpaid",
  "review",
  "campaign",
  "application",
  "repeat",
  "task",
] as const;
export type ReasonType = (typeof REASON_TYPES)[number];
// What each reason says on a row, in plain English. A task shows its own
// title instead.
export const REASON_LABELS: Record<ReasonType, string> = {
  new_enquiry: "New enquiry",
  unanswered_email: "They replied, needs an answer",
  awaiting: "Waiting on them",
  unpaid: "Not fully paid",
  review: "Ask for a review",
  campaign: "Campaign needs a distributor",
  application: "New application",
  repeat: "Follow up for more work",
  task: "Task",
};

// The small headings rows are grouped under within each level.
export const GROUP_LABELS: Record<ReasonType, string> = { ...REASON_LABELS, task: "Tasks" };

// Fired in the browser after anything changes the list, so the count in the
// navigation updates straight away.
export const PRIORITIES_CHANGED_EVENT = "fdh:priorities-changed";

export const SNOOZE_DAYS = [1, 3, 7] as const;
export const STILL_IN_TALKS_DAYS = [2, 5, 7] as const;
export const REPEAT_FOLLOW_UP_DAYS = 21;
export const CAMPAIGN_WINDOW_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

// --- What the rules read ------------------------------------------------------

export type LeadRef = {
  id: string;
  name: string;
  businessName: string | null;
  email: string | null;
  phone: string | null;
  stage: string;
  // Missing means FDH, as every lead from before businesses existed is.
  business?: Business;
};

// userId is null for an activity no one was signed in for (the website form).
export type ActivityFact = { type: string; detail: string; createdAt: string; userId: string | null };

export type LeadFacts = LeadRef & {
  source: string;
  paymentStatus: string;
  reviewStatus: string;
  createdAt: string;
  scrapped: boolean;
  // Stage changes, calls, emails and notes; any order.
  activities: ActivityFact[];
  job: {
    campaignStartDate: string | null;
    completionDate: string | null;
    distributorId: string | null;
    distributorName: string | null;
    hasDistributorCost: boolean;
  } | null;
};

export type ApplicationFacts = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  // Which website it came through; missing means FDH.
  business?: Business;
  status: string;
  // How it reached the CRM: the website form, or a Gmail import (for the bell).
  source?: "WEBSITE_FORM" | "GMAIL_IMPORT";
  receivedAt: string;
  updatedAt: string;
};

export type TaskFacts = {
  id: string;
  description: string;
  dueDate: string;
  priority: PriorityLevel;
  lead: LeadRef | null;
};

// An inbox thread whose latest message came from a lead, already matched.
export type EmailFacts = {
  lead: LeadRef;
  threadId: string;
  messageId: string;
  receivedAt: string;
  subject: string;
  messageIdHeader: string | null;
};

export type DismissalFacts = {
  itemKey: string;
  fingerprint: string;
  snoozedUntil: string | null;
  dismissed: boolean;
};

export type PriorityInputs = {
  now: Date;
  leads: LeadFacts[];
  applications: ApplicationFacts[];
  tasks: TaskFacts[];
  emails: EmailFacts[];
  dismissals: DismissalFacts[];
};

// --- What the list shows ----------------------------------------------------

export type PrioritySubject =
  | ({ kind: "lead" } & LeadRef)
  | { kind: "application"; id: string; name: string; email: string | null; phone: string | null; business: Business }
  | { kind: "none" };

export type PriorityItem = {
  key: string;
  type: ReasonType;
  level: PriorityLevel;
  title: string;
  detail: string | null;
  fingerprint: string;
  // When it started waiting (a task: its due date; a campaign: its start).
  since: string;
  // Earlier sorts first within a level.
  sortAt: string;
  overdue: boolean;
  subject: PrioritySubject;
  taskId: string | null;
  // An unanswered email's conversation, so Email replies in it.
  reply: { subject: string; threadId: string; lastMessageId: string } | null;
};

export type PriorityRow = {
  id: string;
  level: PriorityLevel;
  primary: PriorityItem;
  others: PriorityItem[];
};

// How the Gmail part of the list went: null when it wasn't asked for.
export type PriorityEmailStatus = {
  status: "ok" | "not_configured" | "reconnect" | "error";
  // True when the inbox has more conversations than the scan looked at.
  limited: boolean;
  scanned: number;
  checkedAt: string;
};

export type PriorityList = {
  rows: PriorityRow[];
  email: PriorityEmailStatus | null;
  generatedAt: string;
};

// --- Dates --------------------------------------------------------------------

// The UK calendar day of a moment, "YYYY-MM-DD".
export function ukDay(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-CA", { timeZone: "Europe/London" });
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

// When the lead last entered a stage, from its activity: a stage change into
// it, or, for Awaiting Response, the Dialer's "Marked Warm". Null if there is
// no record of it.
const STAGE_CHANGE_RE = (label: string) =>
  new RegExp(` to ${label.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}( \\(bulk action\\))?( because [^]*)?\\.?$`);

export function stageEnteredAt(lead: Pick<LeadFacts, "activities">, stage: string): string | null {
  const label = STAGE_LABELS[stage];
  if (!label) return null;
  const re = STAGE_CHANGE_RE(label);
  let latest: string | null = null;
  for (const a of lead.activities) {
    const hit =
      (a.type === "STAGE_CHANGE" && re.test(a.detail)) ||
      (stage === "AWAITING_RESPONSE" && a.type === "CALL" && a.detail === "Dialer: Marked Warm");
    if (hit && (!latest || a.createdAt > latest)) latest = a.createdAt;
  }
  return latest;
}

// Rule 8's completion date: the Job's completion date if set, otherwise when
// the lead moved to Completed. Null when neither is known.
export function completedOn(lead: LeadFacts): string | null {
  return lead.job?.completionDate ?? stageEnteredAt(lead, "COMPLETED");
}

function leadSubject(lead: LeadRef): PrioritySubject {
  return {
    kind: "lead",
    id: lead.id,
    name: lead.name,
    businessName: lead.businessName,
    email: lead.email,
    phone: lead.phone,
    stage: lead.stage,
    business: lead.business ?? "FDH",
  };
}

function item(
  fields: Omit<PriorityItem, "title" | "sortAt" | "overdue" | "taskId" | "reply"> & Partial<PriorityItem>
): PriorityItem {
  return {
    title: REASON_LABELS[fields.type],
    sortAt: fields.since,
    overdue: false,
    taskId: null,
    reply: null,
    ...fields,
  };
}

const PAYMENT_LABELS: Record<string, string> = {
  NOT_PAID: "Not paid",
  DEPOSIT_PAID: "Deposit paid",
  PARTIAL_PAID: "Partly paid",
  PAID_IN_FULL: "Paid in full",
};

// --- The rules ----------------------------------------------------------------

export function automaticItems(inputs: PriorityInputs): PriorityItem[] {
  const { now } = inputs;
  const today = ukDay(now);
  const items: PriorityItem[] = [];

  for (const lead of inputs.leads) {
    if (lead.scrapped) continue;
    const subject = leadSubject(lead);

    // 1. A new website enquiry, until the lead leaves Uncontacted.
    if (lead.source === "WEBSITE_QUOTE_FORM" && lead.stage === "UNCONTACTED") {
      const since = stageEnteredAt(lead, "UNCONTACTED") ?? lead.createdAt;
      items.push(item({ key: `new_enquiry:${lead.id}`, type: "new_enquiry", level: "URGENT", detail: null, fingerprint: `UNCONTACTED:${since}`, since, subject }));
    }

    // 3. Awaiting a response, from the moment it entered that stage.
    if (lead.stage === "AWAITING_RESPONSE") {
      const since = stageEnteredAt(lead, "AWAITING_RESPONSE") ?? lead.createdAt;
      items.push(item({ key: `awaiting:${lead.id}`, type: "awaiting", level: "HIGH", detail: null, fingerprint: `AWAITING_RESPONSE:${since}`, since, subject }));
    }

    if (lead.stage === "COMPLETED") {
      const completed = completedOn(lead);
      const since = completed ?? stageEnteredAt(lead, "COMPLETED") ?? lead.createdAt;

      // 4. Not fully paid, straight away.
      if (lead.paymentStatus !== "PAID_IN_FULL") {
        items.push(
          item({
            key: `unpaid:${lead.id}`,
            type: "unpaid",
            level: "HIGH",
            detail: PAYMENT_LABELS[lead.paymentStatus] ?? lead.paymentStatus,
            fingerprint: `${lead.paymentStatus}:${since}`,
            since,
            subject,
          })
        );
      }

      // 5. No review asked for yet.
      if (lead.reviewStatus === "NOT_REQUESTED") {
        items.push(item({ key: `review:${lead.id}`, type: "review", level: "HIGH", detail: null, fingerprint: `NOT_REQUESTED:${since}`, since, subject }));
      }

      // 8. 21 days after completion, until someone logs a call, sends an
      // email or writes a note after it appeared (or the lead goes back to
      // Won). Notes the CRM writes itself don't count.
      if (completed) {
        const appears = new Date(new Date(completed).getTime() + REPEAT_FOLLOW_UP_DAYS * DAY_MS);
        const contactedSince = lead.activities.some(
          (a) => isPersonLoggedContact(a) && new Date(a.createdAt) > appears
        );
        if (now >= appears && !contactedSince) {
          items.push(
            item({
              key: `repeat:${lead.id}`,
              type: "repeat",
              level: "LOW",
              detail: null,
              fingerprint: `COMPLETED:${completed}`,
              since: appears.toISOString(),
              subject,
            })
          );
        }
      }
    }

    // 6. A campaign starting in the next 7 days with no distributor: none on
    // the Job (linked or by name) and no distributor cost line.
    const job = lead.job;
    if (job?.campaignStartDate && (lead.stage === "WON" || lead.stage === "COMPLETED")) {
      const startDay = ukDay(job.campaignStartDate);
      const noDistributor = !job.distributorId && !job.distributorName?.trim() && !job.hasDistributorCost;
      if (noDistributor && startDay >= today && startDay <= addDays(today, CAMPAIGN_WINDOW_DAYS)) {
        items.push(
          item({
            key: `campaign:${lead.id}`,
            type: "campaign",
            level: "NORMAL",
            detail: null,
            fingerprint: `campaign:${job.campaignStartDate}`,
            since: job.campaignStartDate,
            subject,
          })
        );
      }
    }
  }

  // 2. Unanswered emails from leads (already matched and checked).
  for (const email of inputs.emails) {
    items.push(
      item({
        key: `email:${email.threadId}`,
        type: "unanswered_email",
        level: "HIGH",
        detail: email.subject,
        fingerprint: email.messageId,
        since: email.receivedAt,
        subject: leadSubject(email.lead),
        reply: { subject: email.subject, threadId: email.threadId, lastMessageId: email.messageIdHeader ?? "" },
      })
    );
  }

  // 7. New distributor applications.
  for (const app of inputs.applications) {
    if (app.status !== "NEW") continue;
    items.push(
      item({
        key: `application:${app.id}`,
        type: "application",
        level: "LOW",
        detail: null,
        fingerprint: `NEW:${app.updatedAt}`,
        since: app.receivedAt,
        subject: { kind: "application", id: app.id, name: app.fullName, email: app.email, phone: app.phone, business: app.business ?? "FDH" },
      })
    );
  }

  return items;
}

export function taskItems(inputs: PriorityInputs): PriorityItem[] {
  const today = ukDay(inputs.now);
  return inputs.tasks.map((task) =>
    item({
      key: `task:${task.id}`,
      type: "task",
      level: task.priority,
      title: task.description,
      detail: null,
      fingerprint: `task:${task.dueDate}`,
      since: task.dueDate,
      overdue: ukDay(task.dueDate) < today,
      subject: task.lead ? leadSubject(task.lead) : { kind: "none" },
      taskId: task.id,
    })
  );
}

export function isHidden(entry: PriorityItem, dismissal: DismissalFacts | undefined, now: Date): boolean {
  if (!dismissal) return false;
  if (dismissal.snoozedUntil && new Date(dismissal.snoozedUntil) > now) return true;
  return dismissal.dismissed && dismissal.fingerprint === entry.fingerprint;
}

// On a tie (a completed job's reasons all date from its completion), the
// order of REASON_TYPES decides, so money owed comes before a review.
export function compareItems(a: PriorityItem, b: PriorityItem): number {
  return (
    LEVEL_RANK[a.level] - LEVEL_RANK[b.level] ||
    Number(b.overdue) - Number(a.overdue) ||
    a.sortAt.localeCompare(b.sortAt) ||
    REASON_TYPES.indexOf(a.type) - REASON_TYPES.indexOf(b.type) ||
    a.key.localeCompare(b.key)
  );
}

function subjectKey(entry: PriorityItem): string {
  if (entry.subject.kind === "lead") return `lead:${entry.subject.id}`;
  if (entry.subject.kind === "application") return `application:${entry.subject.id}`;
  return entry.key;
}

// Every item before Done and Snooze are applied, keyed by item key.
export function allItems(inputs: PriorityInputs): PriorityItem[] {
  return [...automaticItems(inputs), ...taskItems(inputs)];
}

// One subject's reasons in order: most important first, except that an
// unanswered email always comes straight ahead of Awaiting Response, so
// when the lead has replied the headline is the reply waiting for an answer.
export function orderRowItems(items: PriorityItem[]): PriorityItem[] {
  const sorted = [...items].sort(compareItems);
  const awaiting = sorted.findIndex((i) => i.type === "awaiting");
  const email = sorted.findIndex((i) => i.type === "unanswered_email");
  if (awaiting !== -1 && email > awaiting) {
    const [reply] = sorted.splice(email, 1);
    sorted.splice(awaiting, 0, reply);
  }
  return sorted;
}

function toRow(id: string, items: PriorityItem[]): PriorityRow {
  const ordered = orderRowItems(items);
  return { id, level: ordered[0].level, primary: ordered[0], others: ordered.slice(1) };
}

export function buildPriorities(inputs: PriorityInputs): PriorityRow[] {
  const dismissals = new Map(inputs.dismissals.map((d) => [d.itemKey, d]));
  const visible = allItems(inputs).filter((entry) => !isHidden(entry, dismissals.get(entry.key), inputs.now));

  const groups = new Map<string, PriorityItem[]>();
  for (const entry of visible) {
    const key = subjectKey(entry);
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }
  const rows = [...groups.entries()].map(([id, entries]) => toRow(id, entries));
  return rows.sort((a, b) => compareItems(a.primary, b.primary));
}

export function urgentHighCount(rows: PriorityRow[]): number {
  return rows.filter((r) => r.level === "URGENT" || r.level === "HIGH").length;
}

// The list after one item is done or snoozed in the browser, before the
// server's fresh copy arrives: a row loses that item, the next most
// important reason takes its place, and an empty row goes.
export function removeItem(rows: PriorityRow[], key: string): PriorityRow[] {
  const next: PriorityRow[] = [];
  for (const row of rows) {
    const remaining = [row.primary, ...row.others].filter((i) => i.key !== key);
    if (remaining.length === 0) continue;
    next.push(toRow(row.id, remaining));
  }
  return next.sort((a, b) => compareItems(a.primary, b.primary));
}

// The page's filters: a row's level and type are its headline reason's, the
// same as the section and group it is listed under.
export function filterRows(rows: PriorityRow[], level: PriorityLevel | "ALL", type: ReasonType | "ALL"): PriorityRow[] {
  return rows.filter((r) => (level === "ALL" || r.level === level) && (type === "ALL" || r.primary.type === type));
}

// --- The business filter ----------------------------------------------------------

// A lead's rows show under its own business, and so do an application's (the
// website it came through); a task with no lead shows under every filter.
export function rowsForBusiness(rows: PriorityRow[], filter: BusinessFilter): PriorityRow[] {
  if (filter === "ALL") return rows;
  return rows.filter((row) => {
    const subject = row.primary.subject;
    return itemInFilter(subject.kind === "lead" || subject.kind === "application" ? subject : null, filter);
  });
}

// --- Sections and groups on the page -------------------------------------------

export const GROUP_PREVIEW = 5;

export type PriorityGroup = {
  // "URGENT:new_enquiry", for remembering which groups are opened up.
  id: string;
  type: ReasonType;
  label: string;
  rows: PriorityRow[];
  // The first five, or every row once "Show all" is pressed.
  shown: PriorityRow[];
  hidden: number;
};

export type PrioritySection = { level: PriorityLevel; count: number; groups: PriorityGroup[] };

// Urgent, High, Normal and Low, each split by the headline reason's type.
// Rows keep their ranking; a group sits where its highest-ranked row would.
export function groupRows(
  rows: PriorityRow[],
  expanded: ReadonlySet<string> = new Set(),
  preview: number = GROUP_PREVIEW
): PrioritySection[] {
  return PRIORITY_LEVELS.map((level) => {
    const inLevel = rows.filter((r) => r.level === level);
    const byType = new Map<ReasonType, PriorityRow[]>();
    for (const row of inLevel) byType.set(row.primary.type, [...(byType.get(row.primary.type) ?? []), row]);
    const groups = [...byType.entries()].map(([type, list]) => {
      const id = `${level}:${type}`;
      const shown = expanded.has(id) ? list : list.slice(0, preview);
      return { id, type, label: GROUP_LABELS[type], rows: list, shown, hidden: list.length - shown.length };
    });
    return { level, count: inLevel.length, groups };
  }).filter((section) => section.count > 0);
}

// --- What a row offers --------------------------------------------------------------

export type PrimaryAction = "reply" | "call" | "email" | "open" | null;

// One main button per row: Reply to a reply waiting for an answer; Call
// someone we're waiting on (Email when there's no phone); Open for the rest.
// A task with no lead has nothing to open.
export function primaryAction(row: PriorityRow): PrimaryAction {
  const { primary, primary: { subject } } = row;
  if (primary.type === "unanswered_email" && primary.reply && subject.kind === "lead") return "reply";
  if (primary.type === "awaiting" && subject.kind === "lead") {
    if (subject.phone?.trim()) return "call";
    if (subject.email?.trim()) return "email";
  }
  return subject.kind === "none" ? null : "open";
}

// The row's Awaiting Response reason, wherever it sits, for Still in talks.
export function awaitingItem(row: PriorityRow): PriorityItem | null {
  return [row.primary, ...row.others].find((i) => i.type === "awaiting" && i.subject.kind === "lead") ?? null;
}

// Mark as Lost is for leads that aren't already Lost.
export function canMarkLost(row: PriorityRow): boolean {
  const subject = row.primary.subject;
  return subject.kind === "lead" && subject.stage !== "LOST";
}

// "Waiting 3 days", "Due 9 Oct", "Starts in 2 days", "Completed 23 days ago".
export function waitingLabel(entry: PriorityItem, now: Date): string {
  const short = (iso: string) =>
    new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" });
  const today = ukDay(now);
  if (entry.type === "task") {
    // An overdue task also carries an "Overdue" tag on the page.
    return ukDay(entry.since) === today ? "Due today" : `Due ${short(entry.since)}`;
  }
  if (entry.type === "campaign") {
    const start = ukDay(entry.since);
    if (start === today) return "Starts today";
    if (start === addDays(today, 1)) return "Starts tomorrow";
    const days = Math.round((Date.parse(start) - Date.parse(today)) / DAY_MS);
    return `Starts in ${days} days`;
  }
  if (entry.type === "repeat") {
    // It appears 21 days after completion; say how long ago that was.
    const completed = new Date(entry.since).getTime() - REPEAT_FOLLOW_UP_DAYS * DAY_MS;
    const days = Math.floor((now.getTime() - completed) / DAY_MS);
    return `Completed ${days} days ago`;
  }
  const ms = now.getTime() - new Date(entry.since).getTime();
  if (ms < 60 * 60 * 1000) return "Waiting under an hour";
  const hours = Math.floor(ms / (60 * 60 * 1000));
  if (hours < 24) return `Waiting ${hours} ${hours === 1 ? "hour" : "hours"}`;
  const days = Math.floor(ms / DAY_MS);
  return `Waiting ${days} ${days === 1 ? "day" : "days"}`;
}

// --- Done, Snooze and Still in talks ------------------------------------------

export type PriorityAction = "done" | "snooze" | "still_in_talks";

export type PlannedAction =
  | { kind: "complete_task"; taskId: string }
  | {
      kind: "dismiss";
      itemKey: string;
      fingerprint: string;
      dismissed: boolean;
      snoozedUntil: Date | null;
      note: string | null;
      // Still in talks also notes it on the lead's activity.
      activity: { leadId: string; detail: string } | null;
    };

// What an action on an item writes. Done on a task completes the task; Done
// on anything else hides it until its fingerprint changes. Snooze (1, 3 or 7
// days) and Still in talks (2, 5 or 7 days, Awaiting Response only) hide it
// until the snooze ends.
export function planPriorityAction(
  entry: PriorityItem,
  action: PriorityAction,
  days: number | undefined,
  now: Date
): PlannedAction | { error: string } {
  if (action === "done") {
    if (entry.type === "task" && entry.taskId) return { kind: "complete_task", taskId: entry.taskId };
    return { kind: "dismiss", itemKey: entry.key, fingerprint: entry.fingerprint, dismissed: true, snoozedUntil: null, note: null, activity: null };
  }
  const choices: readonly number[] = action === "snooze" ? SNOOZE_DAYS : STILL_IN_TALKS_DAYS;
  if (!days || !choices.includes(days)) return { error: `Choose ${choices.join(", ")} days.` };
  if (action === "still_in_talks" && (entry.type !== "awaiting" || entry.subject.kind !== "lead")) {
    return { error: "Still in talks is only for leads awaiting a response." };
  }
  const until = new Date(now.getTime() + days * DAY_MS);
  const back = until.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" });
  const stillInTalks = action === "still_in_talks" && entry.subject.kind === "lead";
  return {
    kind: "dismiss",
    itemKey: entry.key,
    fingerprint: entry.fingerprint,
    dismissed: false,
    snoozedUntil: until,
    note: stillInTalks ? `Still in talks, snoozed for ${days} days` : null,
    activity:
      stillInTalks && entry.subject.kind === "lead"
        ? { leadId: entry.subject.id, detail: `Still in talks. Snoozed on Priorities for ${days} days, back on ${back}.` }
        : null,
  };
}
