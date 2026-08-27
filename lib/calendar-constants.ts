// Pure constants/helpers only — safe to import from Client Components.
// Anything touching Prisma lives in the page/route files instead, so this
// file never pulls the Postgres driver into the browser bundle.
// (Same split as lib/crm-constants.ts.)

export const CALENDAR_EVENT_TYPES = [
  "CALL",
  "COLD_CALL_BLOCK",
  "DISTRIBUTOR_SHIFT",
  "GENERAL",
] as const;

export type CalendarEventType = (typeof CALENDAR_EVENT_TYPES)[number];

export const CALENDAR_EVENT_TYPE_LABELS: Record<string, string> = {
  CALL: "Call",
  COLD_CALL_BLOCK: "Cold-Calling Block",
  DISTRIBUTOR_SHIFT: "Distributor Shift",
  GENERAL: "General",
};

// Entries pulled from Job and Task are read-only on the calendar — they are
// derived at query time from those models rather than stored as rows here,
// so they are labelled and coloured distinctly from the editable four.
export const DERIVED_KINDS = ["JOB_START", "JOB_COMPLETION", "TASK_DUE"] as const;

export const DERIVED_KIND_LABELS: Record<string, string> = {
  JOB_START: "Job — Campaign Start",
  JOB_COMPLETION: "Job — Delivery/Completion",
  TASK_DUE: "Task Due",
};

export const ENTRY_LABELS: Record<string, string> = {
  ...CALENDAR_EVENT_TYPE_LABELS,
  ...DERIVED_KIND_LABELS,
};

// dot: the small marker used in month cells.
// chip: the full pill used in week and agenda views.
export const ENTRY_COLORS: Record<string, { dot: string; chip: string }> = {
  CALL: { dot: "bg-blue-500", chip: "bg-blue-50 text-blue-800 border-blue-200" },
  COLD_CALL_BLOCK: {
    dot: "bg-purple-500",
    chip: "bg-purple-50 text-purple-800 border-purple-200",
  },
  DISTRIBUTOR_SHIFT: {
    dot: "bg-emerald-500",
    chip: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  GENERAL: { dot: "bg-gray-500", chip: "bg-gray-50 text-gray-700 border-gray-200" },
  JOB_START: { dot: "bg-amber-500", chip: "bg-amber-50 text-amber-800 border-amber-200" },
  JOB_COMPLETION: {
    dot: "bg-orange-500",
    chip: "bg-orange-50 text-orange-800 border-orange-200",
  },
  TASK_DUE: { dot: "bg-rose-500", chip: "bg-rose-50 text-rose-800 border-rose-200" },
};

export function entryColor(kindOrType: string) {
  return ENTRY_COLORS[kindOrType] ?? ENTRY_COLORS.GENERAL;
}

// A single row on the calendar, whether stored (kind "EVENT") or derived
// from a Job/Task. Dates cross the server/client boundary as ISO strings.
export type CalendarEntry = {
  id: string;
  kind: "EVENT" | "JOB_START" | "JOB_COMPLETION" | "TASK_DUE";
  // For a stored event this is its CalendarEventType; for a derived entry
  // it repeats the kind, so filtering and colouring can use one field.
  type: string;
  title: string;
  start: string;
  end: string | null;
  notes: string | null;
  completed: boolean;
  // Where clicking through goes. Derived entries always have one; stored
  // events open the edit modal instead.
  href: string | null;
  assignedToUserId: string | null;
  assignedToName: string | null;
  distributorId: string | null;
  distributorName: string | null;
  linkedLeadId: string | null;
  linkedJobId: string | null;
};

export type CalendarFilters = {
  type?: string;
  assignedToUserId?: string;
  distributorId?: string;
};

export function applyCalendarFilters(
  entries: CalendarEntry[],
  filters: CalendarFilters,
): CalendarEntry[] {
  let result = entries;
  if (filters.type) result = result.filter((e) => e.type === filters.type);
  if (filters.assignedToUserId) {
    result = result.filter((e) => e.assignedToUserId === filters.assignedToUserId);
  }
  if (filters.distributorId) {
    result = result.filter((e) => e.distributorId === filters.distributorId);
  }
  return result;
}

/* ---------- date helpers (all local-time) ---------- */

export function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

export function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

export function addMonths(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(1);
  c.setMonth(c.getMonth() + n);
  return c;
}

// Stable key for bucketing entries into day cells. Built from local parts
// rather than toISOString(), which would shift days either side of UTC.
export function dateKey(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isSameDay(a: Date, b: Date): boolean {
  return dateKey(a) === dateKey(b);
}

export function isToday(d: Date): boolean {
  return isSameDay(d, new Date());
}

// Weeks run Monday–Sunday, matching UK business convention.
export function startOfWeek(d: Date): Date {
  const c = startOfDay(d);
  const day = (c.getDay() + 6) % 7; // Mon = 0
  return addDays(c, -day);
}

// Always 6 rows of 7, so the grid height doesn't jump between months.
export function monthGrid(anchor: Date): Date[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = startOfWeek(first);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export function weekGrid(anchor: Date): Date[] {
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDayLong(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function formatMonthYear(d: Date): string {
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

// "09:00–13:00", or just "09:00" for a point-in-time entry. Multi-day
// ranges get the end date spelled out so they aren't mistaken for hours.
export function formatEntryTime(entry: CalendarEntry): string {
  const start = new Date(entry.start);
  if (!entry.end) return formatTime(entry.start);
  const end = new Date(entry.end);
  if (isSameDay(start, end)) return `${formatTime(entry.start)}–${formatTime(entry.end)}`;
  return `${formatTime(entry.start)} → ${end.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  })} ${formatTime(entry.end)}`;
}

// A multi-day entry appears in every day cell it spans, not only its start.
export function entryOccupiesDay(entry: CalendarEntry, day: Date): boolean {
  const start = startOfDay(new Date(entry.start));
  const end = entry.end ? startOfDay(new Date(entry.end)) : start;
  const d = startOfDay(day);
  return d.getTime() >= start.getTime() && d.getTime() <= end.getTime();
}

export function entriesForDay(entries: CalendarEntry[], day: Date): CalendarEntry[] {
  return entries
    .filter((e) => entryOccupiesDay(e, day))
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
}

// For <input type="datetime-local">, which wants local time with no zone.
export function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}
