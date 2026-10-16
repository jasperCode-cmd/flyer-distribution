import { isWonStage } from "./lead-stage";
import { STAGES } from "./crm-constants";
import { ALL_TIME, COST_GROUPS, jobFigures, monthKeyLondon, type CostGroupId, type ProfitJob } from "./profit";
import { EXPENSE_CATEGORIES, type ExpenseCategory, type ExpenseRecord } from "./expenses";
import { dataMonths, expenseMonths, monthsBetween, periodFigures, retainerMonths, type PeriodFigures } from "./profit-overview";
import type { BusinessFilter } from "./business";

// The Dashboard's figures, pure and client-safe so each one is tested from
// plain data.
//
// Money matches the Profit page exactly: All time is the Profit page's All
// time, and a date range counts the same things by day. A job counts on the
// UK day it was won, a one-off expense on its date, and a monthly expense or
// a retainer's month on the 1st of that month, so a range covering whole
// months equals those months on the Profit page. Money therefore includes
// any won cold outreach jobs, as the Profit page does.
//
// Everything about leads and sales (inbound enquiries, jobs won, new
// enquiries, win rate, average job value, the stage strip) leaves cold
// outreach out; it has its own section below the fold.

export const COLD_OUTREACH = "COLD_OUTREACH";
export const INBOUND_SOURCE = "WEBSITE_QUOTE_FORM";

const DAY_MS = 24 * 60 * 60 * 1000;

// --- Days and periods ---------------------------------------------------------

// The UK calendar day of a moment, "YYYY-MM-DD".
export function ukDay(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-CA", { timeZone: "Europe/London" });
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

// Inclusive count of days from one day to another.
export function dayCount(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS) + 1;
}

function isDay(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export type DashboardPeriod =
  | { kind: "all" }
  // UK days, both inclusive.
  | { kind: "last30" | "custom"; from: string; to: string };

export const ALL_PERIOD: DashboardPeriod = { kind: "all" };

// From the page address: ?period=30d, or ?from=YYYY-MM-DD&to=YYYY-MM-DD, or
// nothing for All time. A range can't run past today; anything unusable
// falls back to All time.
export function parsePeriod(
  params: { period?: string | string[]; from?: string | string[]; to?: string | string[] },
  today: string
): DashboardPeriod {
  if (params.period === "30d") return { kind: "last30", from: addDays(today, -29), to: today };
  const { from, to } = params;
  if (isDay(from) && isDay(to) && from <= to && from <= today && from >= "2000-01-01") {
    return { kind: "custom", from, to: to > today ? today : to };
  }
  return ALL_PERIOD;
}

// The same number of days straight before, for the change figures.
export function previousPeriod(period: DashboardPeriod): { from: string; to: string } | null {
  if (period.kind === "all") return null;
  const n = dayCount(period.from, period.to);
  return { from: addDays(period.from, -n), to: addDays(period.from, -1) };
}

// The Dashboard address for a period and business filter; All time for
// both businesses is the plain address.
export function periodSearch(period: DashboardPeriod, business: BusinessFilter = "ALL"): string {
  const params = new URLSearchParams();
  if (period.kind === "last30") params.set("period", "30d");
  if (period.kind === "custom") {
    params.set("from", period.from);
    params.set("to", period.to);
  }
  if (business !== "ALL") params.set("business", business);
  const query = params.toString();
  return query ? `?${query}` : "";
}

function shortDay(day: string, withYear: boolean): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });
}

export function periodLabel(period: DashboardPeriod): string {
  if (period.kind === "all") return "All time";
  if (period.kind === "last30") return "Last 30 days";
  const sameYear = period.from.slice(0, 4) === period.to.slice(0, 4);
  if (period.from === period.to) return shortDay(period.from, true);
  return `${shortDay(period.from, !sameYear)} to ${shortDay(period.to, true)}`;
}

function inRange(iso: string | null, range: { from: string; to: string } | null): boolean {
  if (!range) return true;
  if (!iso) return false;
  const day = ukDay(iso);
  return day >= range.from && day <= range.to;
}

function rangeOf(period: DashboardPeriod): { from: string; to: string } | null {
  return period.kind === "all" ? null : { from: period.from, to: period.to };
}

// --- Money --------------------------------------------------------------------

function pct(part: number, whole: number): number | null {
  return whole > 0 ? (part / whole) * 100 : null;
}

// The Profit Overview's figures for a range of days (see the top of the file).
export function rangeFigures(
  jobs: ProfitJob[],
  expenses: ExpenseRecord[],
  range: { from: string; to: string },
  currentMonth: string
): PeriodFigures {
  const costGroups = Object.fromEntries(COST_GROUPS.map((g) => [g.id, 0])) as Record<CostGroupId, number>;
  const expensesByCategory = Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c, 0])) as Record<ExpenseCategory, number>;
  const firstOfMonthIn = (month: string) => `${month}-01` >= range.from && `${month}-01` <= range.to;
  let jobRevenuePence = 0;
  let retainerRevenuePence = 0;
  let jobCostsPence = 0;
  let expensesPence = 0;

  for (const job of jobs) {
    if (!isWonStage(job.stage)) continue;
    if (job.wonAt && monthKeyLondon(job.wonAt) <= currentMonth && inRange(job.wonAt, range)) {
      const f = jobFigures(job);
      jobRevenuePence += f.paidPence;
      jobCostsPence += f.costsPence;
      for (const g of COST_GROUPS) costGroups[g.id] += f.groups[g.id];
    }
    for (const m of retainerMonths(job, currentMonth)) {
      if (firstOfMonthIn(m)) retainerRevenuePence += job.retainerMonthlyPence!;
    }
  }

  for (const expense of expenses) {
    const months = expenseMonths(expense, currentMonth);
    const times =
      expense.kind === "ONE_OFF"
        ? months.length > 0 && expense.date && expense.date >= range.from && expense.date <= range.to
          ? 1
          : 0
        : months.filter(firstOfMonthIn).length;
    expensesPence += expense.amountPence * times;
    expensesByCategory[expense.category] += expense.amountPence * times;
  }

  const revenuePence = jobRevenuePence + retainerRevenuePence;
  const jobProfitPence = revenuePence - jobCostsPence;
  const netProfitPence = jobProfitPence - expensesPence;
  return {
    jobRevenuePence,
    retainerRevenuePence,
    revenuePence,
    jobCostsPence,
    jobProfitPence,
    expensesPence,
    netProfitPence,
    jobMarginPct: pct(jobProfitPence, revenuePence),
    netMarginPct: pct(netProfitPence, revenuePence),
    costGroups,
    expensesByCategory,
    undatedJobs: 0,
  };
}

export function moneyFigures(
  jobs: ProfitJob[],
  expenses: ExpenseRecord[],
  period: DashboardPeriod,
  currentMonth: string
): PeriodFigures {
  return period.kind === "all"
    ? periodFigures(jobs, expenses, ALL_TIME, currentMonth)
    : rangeFigures(jobs, expenses, period, currentMonth);
}

export type MoneyChange = { revenuePence: number; netProfitPence: number; netMarginPts: number | null };

// The change against the previous period of the same length; none for All
// time. The margin's change is in percentage points, and only when both
// periods had a margin.
export function moneyChange(
  jobs: ProfitJob[],
  expenses: ExpenseRecord[],
  period: DashboardPeriod,
  currentMonth: string
): { previous: { from: string; to: string }; change: MoneyChange } | null {
  const previous = previousPeriod(period);
  if (!previous) return null;
  const now = moneyFigures(jobs, expenses, period, currentMonth);
  const before = rangeFigures(jobs, expenses, previous, currentMonth);
  return {
    previous,
    change: {
      revenuePence: now.revenuePence - before.revenuePence,
      netProfitPence: now.netProfitPence - before.netProfitPence,
      netMarginPts: now.netMarginPct !== null && before.netMarginPct !== null ? now.netMarginPct - before.netMarginPct : null,
    },
  };
}

// Deal value minus amount paid on every Won and Completed job, right now.
// A job paid in full or more owes nothing; one with no deal value is left
// out, as nothing is known to be owed.
export function moneyOwed(jobs: ProfitJob[]): { owedPence: number; jobsOwing: number } {
  let owedPence = 0;
  let jobsOwing = 0;
  for (const job of jobs) {
    if (!isWonStage(job.stage) || job.dealPence === null) continue;
    const owed = job.dealPence - (job.paidPence ?? 0);
    if (owed > 0) {
      owedPence += owed;
      jobsOwing++;
    }
  }
  return { owedPence, jobsOwing };
}

// --- Leads --------------------------------------------------------------------

// Every lead that isn't scrapped, with what the Dashboard reads.
export type DashboardLead = {
  id: string;
  source: string;
  stage: string;
  createdAt: string;
  wonAt: string | null;
  dealPence: number | null;
};

const isCold = (lead: DashboardLead) => lead.source === COLD_OUTREACH;

// --- The chart ----------------------------------------------------------------

export const CHART_SERIES = ["enquiries", "won", "revenue", "net"] as const;
export type ChartSeries = (typeof CHART_SERIES)[number];
export const CHART_LABELS: Record<ChartSeries, string> = {
  enquiries: "Inbound enquiries",
  won: "Jobs won",
  revenue: "Revenue paid",
  net: "Net profit",
};
export type ChartPoint = { month: string; value: number };

// Every month the period touches, oldest first. All time runs from the
// first month with anything in it to the current month.
export function chartMonths(
  period: DashboardPeriod,
  leads: DashboardLead[],
  jobs: ProfitJob[],
  expenses: ExpenseRecord[],
  currentMonth: string
): string[] {
  if (period.kind !== "all") return monthsBetween(period.from.slice(0, 7), period.to.slice(0, 7));
  let first = dataMonths(jobs, expenses, currentMonth).at(-1) ?? currentMonth;
  for (const lead of leads) {
    if (isCold(lead)) continue;
    const created = lead.source === INBOUND_SOURCE ? monthKeyLondon(lead.createdAt) : null;
    const won = isWonStage(lead.stage) && lead.wonAt ? monthKeyLondon(lead.wonAt) : null;
    for (const m of [created, won]) if (m && m < first) first = m;
  }
  return monthsBetween(first, currentMonth);
}

// Whole calendar months, one value each: inbound enquiries by the month
// they came in, jobs won by their won date (cold outreach left out of both),
// and the Profit Overview's revenue paid and net profit for that month.
export function chartData(
  months: string[],
  leads: DashboardLead[],
  jobs: ProfitJob[],
  expenses: ExpenseRecord[],
  currentMonth: string
): Record<ChartSeries, ChartPoint[]> {
  const count = (pick: (lead: DashboardLead) => string | null) => {
    const byMonth = new Map<string, number>();
    for (const lead of leads) {
      if (isCold(lead)) continue;
      const m = pick(lead);
      if (m) byMonth.set(m, (byMonth.get(m) ?? 0) + 1);
    }
    return months.map((month) => ({ month, value: byMonth.get(month) ?? 0 }));
  };
  const figures = months.map((month) => ({ month, f: periodFigures(jobs, expenses, month, currentMonth) }));
  return {
    enquiries: count((l) => (l.source === INBOUND_SOURCE ? monthKeyLondon(l.createdAt) : null)),
    won: count((l) => (isWonStage(l.stage) && l.wonAt ? monthKeyLondon(l.wonAt) : null)),
    revenue: figures.map(({ month, f }) => ({ month, value: f.revenuePence })),
    net: figures.map(({ month, f }) => ({ month, value: f.netProfitPence })),
  };
}

// --- Sales pipeline -----------------------------------------------------------

export type PipelineFigures = {
  newEnquiries: number;
  // Leads created in the period, by the stage they are in now.
  stageCounts: Record<string, number>;
  winRatePct: number | null;
  avgJobPence: number | null;
  // Jobs won in the period with a deal value, which the average is of.
  avgBasedOn: number;
};

export function pipelineFigures(leads: DashboardLead[], period: DashboardPeriod): PipelineFigures {
  const range = rangeOf(period);
  const sales = leads.filter((l) => !isCold(l));
  const cohort = sales.filter((l) => inRange(l.createdAt, range));
  const stageCounts = Object.fromEntries(STAGES.map((s) => [s, cohort.filter((l) => l.stage === s).length]));
  const won = (stageCounts.WON ?? 0) + (stageCounts.COMPLETED ?? 0);
  const decided = won + (stageCounts.LOST ?? 0);
  // All time counts every won job, dated or not; a range needs a won date in it.
  const wonInPeriod = sales.filter((l) => isWonStage(l.stage) && (range ? inRange(l.wonAt, range) : true));
  const withDeal = wonInPeriod.filter((l) => l.dealPence !== null);
  return {
    newEnquiries: cohort.filter((l) => l.source === INBOUND_SOURCE).length,
    stageCounts,
    winRatePct: decided > 0 ? (won / decided) * 100 : null,
    avgJobPence: withDeal.length > 0 ? Math.round(withDeal.reduce((sum, l) => sum + l.dealPence!, 0) / withDeal.length) : null,
    avgBasedOn: withDeal.length,
  };
}

// --- Cold outreach --------------------------------------------------------------

export type ColdOutreachFigures = {
  total: number;
  uncontacted: number;
  calledLast7Days: number;
  awaitingResponse: number;
  won: number;
};

// Totals as they stand now, plus how many different cold leads were called
// in the last 7 days.
export function coldOutreachFigures(
  leads: DashboardLead[],
  calls: { leadId: string; createdAt: string }[],
  now: Date
): ColdOutreachFigures {
  const cold = leads.filter(isCold);
  const coldIds = new Set(cold.map((l) => l.id));
  const since = now.getTime() - 7 * DAY_MS;
  const called = new Set(calls.filter((c) => coldIds.has(c.leadId) && Date.parse(c.createdAt) >= since).map((c) => c.leadId));
  return {
    total: cold.length,
    uncontacted: cold.filter((l) => l.stage === "UNCONTACTED").length,
    calledLast7Days: called.size,
    awaitingResponse: cold.filter((l) => l.stage === "AWAITING_RESPONSE").length,
    won: cold.filter((l) => isWonStage(l.stage)).length,
  };
}

// How much of the Money figures came from won cold outreach jobs, so the
// card can say so.
export function coldOutreachInMoney(
  jobs: ProfitJob[],
  coldLeadIds: Set<string>,
  period: DashboardPeriod,
  currentMonth: string
): number {
  const range = rangeOf(period);
  return jobs.filter(
    (j) =>
      coldLeadIds.has(j.leadId) &&
      isWonStage(j.stage) &&
      (range ? inRange(j.wonAt, range) : !j.wonAt || monthKeyLondon(j.wonAt) <= currentMonth)
  ).length;
}

// --- Upcoming --------------------------------------------------------------------

export const CAMPAIGN_DAYS = 14;
export const EVENT_DAYS = 7;

export type UpcomingCampaign = {
  leadId: string;
  name: string;
  businessName: string | null;
  start: string;
  distributor: string | null;
};

export type UpcomingEvent = {
  id: string;
  title: string;
  type: string;
  start: string;
  end: string | null;
  leadId: string | null;
};

// Campaigns starting today to 14 days on, soonest first.
export function upcomingCampaigns<T extends { start: string }>(campaigns: T[], today: string): T[] {
  const last = addDays(today, CAMPAIGN_DAYS);
  return campaigns
    .filter((c) => {
      const day = ukDay(c.start);
      return day >= today && day <= last;
    })
    .sort((a, b) => a.start.localeCompare(b.start));
}

// Calendar entries from today to 6 days on (the next 7 days), soonest first.
export function upcomingEvents<T extends { start: string }>(events: T[], today: string): T[] {
  const last = addDays(today, EVENT_DAYS - 1);
  return events
    .filter((e) => {
      const day = ukDay(e.start);
      return day >= today && day <= last;
    })
    .sort((a, b) => a.start.localeCompare(b.start));
}
