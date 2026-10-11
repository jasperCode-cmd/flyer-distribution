import { isWonStage } from "./lead-stage";
import { ALL_TIME, COST_GROUPS, jobFigures, monthKeyLondon, type CostGroupId, type ProfitJob } from "./profit";
import { EXPENSE_CATEGORIES, type ExpenseCategory, type ExpenseRecord } from "./expenses";

// The Profit Overview: jobs, retainers and business expenses together, by UK
// calendar month. Pure and client-safe; every amount is whole pence.
//
//   revenue paid  = amount paid on jobs won in the period
//                 + each retainer's monthly amount for its months in the period
//   job profit    = revenue paid - job costs
//   net profit    = job profit - business expenses
//   margins       = job profit and net profit as a share of revenue paid, or
//                   none when nothing was paid
//
// Months after the current one never count, in a month or in All time: an
// expense dated next month, or a retainer's future months, wait until then.

// --- Months -----------------------------------------------------------------

export function addMonths(key: string, n: number): string {
  const [y, m] = key.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

// Inclusive; empty when from is after to.
export function monthsBetween(from: string, to: string): string[] {
  const months: string[] = [];
  for (let m = from; m <= to && months.length < 1200; m = addMonths(m, 1)) months.push(m);
  return months;
}

// The months an expense counts in, up to and including the current month.
export function expenseMonths(expense: ExpenseRecord, currentMonth: string): string[] {
  if (expense.kind === "ONE_OFF") {
    const month = expense.date?.slice(0, 7);
    return month && month <= currentMonth ? [month] : [];
  }
  if (!expense.startMonth) return [];
  const end = expense.endMonth && expense.endMonth < currentMonth ? expense.endMonth : currentMonth;
  return monthsBetween(expense.startMonth, end);
}

// The months a retainer's monthly amount counts in: from its start to its
// end (or the current month), and only while the lead is Won or Completed.
export function retainerMonths(job: ProfitJob, currentMonth: string): string[] {
  if (!job.isRetainer || !job.retainerMonthlyPence || !job.retainerStart || !isWonStage(job.stage)) return [];
  const end = job.retainerEnd && job.retainerEnd < currentMonth ? job.retainerEnd : currentMonth;
  return monthsBetween(job.retainerStart, end);
}

function jobMonth(job: ProfitJob): string | null {
  return job.wonAt ? monthKeyLondon(job.wonAt) : null;
}

// --- Figures for a month, or All time ---------------------------------------

export type PeriodFigures = {
  jobRevenuePence: number;
  retainerRevenuePence: number;
  revenuePence: number;
  jobCostsPence: number;
  jobProfitPence: number;
  expensesPence: number;
  netProfitPence: number;
  jobMarginPct: number | null;
  netMarginPct: number | null;
  costGroups: Record<CostGroupId, number>;
  expensesByCategory: Record<ExpenseCategory, number>;
  // All time only: jobs with no won date are counted but sit in no month.
  undatedJobs: number;
};

function pct(part: number, whole: number): number | null {
  return whole > 0 ? (part / whole) * 100 : null;
}

export function periodFigures(
  jobs: ProfitJob[],
  expenses: ExpenseRecord[],
  period: string,
  currentMonth: string
): PeriodFigures {
  const all = period === ALL_TIME;
  const costGroups = Object.fromEntries(COST_GROUPS.map((g) => [g.id, 0])) as Record<CostGroupId, number>;
  const expensesByCategory = Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c, 0])) as Record<ExpenseCategory, number>;
  let jobRevenuePence = 0;
  let retainerRevenuePence = 0;
  let jobCostsPence = 0;
  let expensesPence = 0;
  let undatedJobs = 0;

  for (const job of jobs) {
    if (!isWonStage(job.stage)) continue;
    const month = jobMonth(job);
    const counts = all ? month === null || month <= currentMonth : month === period;
    if (counts) {
      const f = jobFigures(job);
      jobRevenuePence += f.paidPence;
      jobCostsPence += f.costsPence;
      for (const g of COST_GROUPS) costGroups[g.id] += f.groups[g.id];
      if (month === null) undatedJobs++;
    }
    for (const m of retainerMonths(job, currentMonth)) {
      if (all || m === period) retainerRevenuePence += job.retainerMonthlyPence!;
    }
  }

  for (const expense of expenses) {
    const months = expenseMonths(expense, currentMonth);
    const times = all ? months.length : months.includes(period) ? 1 : 0;
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
    undatedJobs: all ? undatedJobs : 0,
  };
}

// --- Month by month ---------------------------------------------------------

// Every month from the first one with anything in it up to the current one,
// including quiet months in between, newest first.
export function dataMonths(jobs: ProfitJob[], expenses: ExpenseRecord[], currentMonth: string): string[] {
  let first = currentMonth;
  for (const job of jobs) {
    if (!isWonStage(job.stage)) continue;
    const m = jobMonth(job);
    if (m && m < first) first = m;
    const r = retainerMonths(job, currentMonth)[0];
    if (r && r < first) first = r;
  }
  for (const expense of expenses) {
    const m = expenseMonths(expense, currentMonth)[0];
    if (m && m < first) first = m;
  }
  return monthsBetween(first, currentMonth).reverse();
}

export type MonthRow = { month: string } & PeriodFigures;

export function monthlyRows(jobs: ProfitJob[], expenses: ExpenseRecord[], currentMonth: string): MonthRow[] {
  return dataMonths(jobs, expenses, currentMonth).map((month) => ({
    month,
    ...periodFigures(jobs, expenses, month, currentMonth),
  }));
}

// The months the selector offers: every month with data, newest first, plus
// the one asked for if it is a real past or current month.
export function overviewMonthOptions(
  jobs: ProfitJob[],
  expenses: ExpenseRecord[],
  currentMonth: string,
  selected?: string
): string[] {
  const months = new Set(dataMonths(jobs, expenses, currentMonth));
  if (selected && /^\d{4}-(0[1-9]|1[0-2])$/.test(selected) && selected <= currentMonth) months.add(selected);
  return [...months].sort().reverse();
}

// --- Retainers --------------------------------------------------------------

export type ActiveRetainer = {
  leadId: string;
  name: string;
  businessName: string | null;
  monthlyPence: number;
  start: string;
  end: string | null;
};

// Retainers counting this month, and what they bring in each month.
export function activeRetainers(jobs: ProfitJob[], currentMonth: string): { list: ActiveRetainer[]; monthlyPence: number } {
  const list = jobs
    .filter((job) => retainerMonths(job, currentMonth).includes(currentMonth))
    .map((job) => ({
      leadId: job.leadId,
      name: job.name,
      businessName: job.businessName,
      monthlyPence: job.retainerMonthlyPence!,
      start: job.retainerStart!,
      end: job.retainerEnd,
    }))
    .sort((a, b) => b.monthlyPence - a.monthlyPence || a.name.localeCompare(b.name));
  return { list, monthlyPence: list.reduce((sum, r) => sum + r.monthlyPence, 0) };
}

// The expenses that count in a period, for the Expenses tab: All time shows
// every expense, a month shows those that count in it.
export function expensesForPeriod(expenses: ExpenseRecord[], period: string, currentMonth: string): ExpenseRecord[] {
  if (period === ALL_TIME) return expenses;
  return expenses.filter((e) => expenseMonths(e, currentMonth).includes(period));
}
