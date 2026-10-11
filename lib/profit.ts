// Profit calculator maths. Pure and client-safe: no Prisma, no server code.
// Every money value here is whole pence. Profit and margin are worked out
// on the amount paid; the deal value only gives the secondary "expected
// profit". No VAT anywhere: the business is not VAT registered.

export const COST_CATEGORIES = ["DISTRIBUTOR", "FUEL", "PRINTING", "DESIGN", "ADDITIONAL"] as const;
export type CostCategory = (typeof COST_CATEGORIES)[number];
export type PayType = "FLAT" | "PER_THOUSAND";

export type CostLine = {
  id: string;
  category: CostCategory;
  distributorId: string | null;
  // The distributor's name at the time of reading; null once the
  // distributor is deleted (the line and its amount stay).
  distributorName: string | null;
  payType: PayType | null;
  ratePence: number | null;
  leafletCount: number | null;
  amountPence: number;
  label: string | null;
  note: string | null;
  createdAt: string;
};

export type ProfitJob = {
  leadId: string;
  name: string;
  businessName: string | null;
  stage: string;
  wonAt: string | null;
  dealPence: number | null;
  paidPence: number | null;
  leafletQuantity: string | null;
  printingIncluded: boolean;
  designIncluded: boolean;
  costs: CostLine[];
  // A retainer's monthly amount counts as revenue paid in every month from
  // retainerStart to retainerEnd ("YYYY-MM"; no end means it carries on).
  isRetainer: boolean;
  retainerMonthlyPence: number | null;
  retainerStart: string | null;
  retainerEnd: string | null;
};

export type CostGroupId = "distributors" | "printing" | "design" | "additional";

// Distributor pay and fuel sit together under Distributors.
export const COST_GROUPS: { id: CostGroupId; label: string; categories: CostCategory[] }[] = [
  { id: "distributors", label: "Distributors", categories: ["DISTRIBUTOR", "FUEL"] },
  { id: "printing", label: "Printing", categories: ["PRINTING"] },
  { id: "design", label: "Design", categories: ["DESIGN"] },
  { id: "additional", label: "Additional", categories: ["ADDITIONAL"] },
];

export const CATEGORY_LABELS: Record<CostCategory, string> = {
  DISTRIBUTOR: "Distributor",
  FUEL: "Fuel",
  PRINTING: "Printing",
  DESIGN: "Design",
  ADDITIONAL: "Additional",
};

export function groupOf(category: CostCategory): CostGroupId {
  return COST_GROUPS.find((g) => g.categories.includes(category))!.id;
}

export type JobFigures = {
  groups: Record<CostGroupId, number>;
  costsPence: number;
  // Null amount paid counts as nothing paid yet.
  paidPence: number;
  dealPence: number | null;
  profitPence: number;
  // Null when nothing has been paid: a margin on zero means nothing.
  marginPct: number | null;
  expectedProfitPence: number | null;
  expectedMarginPct: number | null;
  isLoss: boolean;
};

function pct(part: number, whole: number): number | null {
  return whole > 0 ? (part / whole) * 100 : null;
}

export function jobFigures(job: Pick<ProfitJob, "costs" | "paidPence" | "dealPence">): JobFigures {
  const groups: Record<CostGroupId, number> = { distributors: 0, printing: 0, design: 0, additional: 0 };
  for (const line of job.costs) groups[groupOf(line.category)] += line.amountPence;
  const costsPence = groups.distributors + groups.printing + groups.design + groups.additional;
  const paidPence = job.paidPence ?? 0;
  const profitPence = paidPence - costsPence;
  const expectedProfitPence = job.dealPence === null ? null : job.dealPence - costsPence;
  return {
    groups,
    costsPence,
    paidPence,
    dealPence: job.dealPence,
    profitPence,
    marginPct: pct(profitPence, paidPence),
    expectedProfitPence,
    expectedMarginPct: expectedProfitPence === null ? null : pct(expectedProfitPence, job.dealPence!),
    isLoss: profitPence < 0,
  };
}

export type ProfitSummary = {
  jobCount: number;
  paidPence: number;
  // Jobs without a deal value add nothing here; noDealCount says how many.
  dealPence: number;
  noDealCount: number;
  costsPence: number;
  profitPence: number;
  marginPct: number | null;
  expectedProfitPence: number;
};

export function summarize(jobs: ProfitJob[]): ProfitSummary {
  let paidPence = 0;
  let dealPence = 0;
  let noDealCount = 0;
  let costsPence = 0;
  for (const job of jobs) {
    const f = jobFigures(job);
    paidPence += f.paidPence;
    costsPence += f.costsPence;
    if (job.dealPence === null) noDealCount++;
    else dealPence += job.dealPence;
  }
  const profitPence = paidPence - costsPence;
  return {
    jobCount: jobs.length,
    paidPence,
    dealPence,
    noDealCount,
    costsPence,
    profitPence,
    marginPct: pct(profitPence, paidPence),
    expectedProfitPence: dealPence - costsPence,
  };
}

// Per distributor: what each one was paid on a job, fuel included.
export function distributorPayments(costs: CostLine[]): { key: string; name: string; amountPence: number }[] {
  const byKey = new Map<string, { key: string; name: string; amountPence: number }>();
  for (const line of costs) {
    if (line.category !== "DISTRIBUTOR" && line.category !== "FUEL") continue;
    if (line.category === "FUEL" && !line.distributorId) continue;
    const key = line.distributorId ?? `deleted:${line.id}`;
    const name = line.distributorName ?? "Deleted distributor";
    const entry = byKey.get(key) ?? { key, name, amountPence: 0 };
    entry.amountPence += line.amountPence;
    byKey.set(key, entry);
  }
  return [...byKey.values()].sort((a, b) => b.amountPence - a.amountPence || a.name.localeCompare(b.name));
}

// A rate per 1,000 leaflets times a leaflet count, rounded to the nearest
// penny (halves up). The server always works this out itself.
export function perThousandAmountPence(ratePence: number, leafletCount: number): number {
  return Math.floor((ratePence * leafletCount + 500) / 1000);
}

export const MAX_LEAFLETS = 10_000_000;

// Prefill for the leaflet count: only when the lead's quantity is one plain
// number ("5000", "5,000", "5,000 leaflets"). A range or an "Under 1,000"
// from the quote form is not a count, so it is shown as a hint instead.
export function leafletCountFromQuantity(quantity: string | null | undefined): number | null {
  if (!quantity) return null;
  const match = /^\s*(\d{1,3}(?:,\d{3})+|\d+)\s*(?:leaflets?|flyers?)?\s*$/i.exec(quantity);
  if (!match) return null;
  const count = Number(match[1].replace(/,/g, ""));
  return count > 0 && count <= MAX_LEAFLETS ? count : null;
}

// Months are UK months: a job won at 00:30 on 1 August BST is an August job.
const MONTH_PARTS = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  year: "numeric",
  month: "2-digit",
});

export function monthKeyLondon(date: Date | string): string {
  const parts = MONTH_PARTS.formatToParts(typeof date === "string" ? new Date(date) : date);
  const year = parts.find((p) => p.type === "year")!.value;
  const month = parts.find((p) => p.type === "month")!.value;
  return `${year}-${month}`;
}

export const ALL_TIME = "all";

export function isMonthKey(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function monthLabel(key: string): string {
  if (key === ALL_TIME) return "All time";
  const [year, month] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 15)).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

// Newest first, always including the current month and the one asked for.
export function monthOptions(jobs: Pick<ProfitJob, "wonAt">[], currentMonth: string, selected?: string): string[] {
  const keys = new Set<string>([currentMonth]);
  for (const job of jobs) if (job.wonAt) keys.add(monthKeyLondon(job.wonAt));
  if (selected && isMonthKey(selected)) keys.add(selected);
  return [...keys].sort().reverse();
}

// A month shows the jobs won in it; All time shows every job, including
// the ones whose won date is not known yet.
export function jobsForMonth<T extends Pick<ProfitJob, "wonAt">>(jobs: T[], month: string): T[] {
  if (month === ALL_TIME) return jobs;
  return jobs.filter((job) => job.wonAt !== null && monthKeyLondon(job.wonAt) === month);
}

// The won date as a UK calendar day, for the date input: "2026-08-01".
export function wonDateInput(wonAt: string | null): string {
  if (!wonAt) return "";
  return new Date(wonAt).toLocaleDateString("en-CA", { timeZone: "Europe/London" });
}

// A date picked by hand is stored as midday UTC on that day, which is the
// same calendar day in UK time all year round.
export function wonAtFromDateInput(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  if (year < 2000 || year > 2100) return null;
  return date;
}

export function formatWonDate(wonAt: string | null): string {
  if (!wonAt) return "-";
  return new Date(wonAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/London",
  });
}
