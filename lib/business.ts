// The two businesses the CRM works for, and the All / FDH / LDB filter used
// across Leads, Priorities, the Dialer, Profit, the Dashboard and the Inbox.
// Pure, so the browser and the server share it.

export const BUSINESSES = ["FDH", "LDB"] as const;
export type Business = (typeof BUSINESSES)[number];

export const BUSINESS_NAMES: Record<Business, string> = {
  FDH: "Flyer Distribution Hampshire",
  LDB: "Leaflet Distribution Bournemouth",
};

// What the badge on an LDB lead says.
export const LDB_BADGE = "Bournemouth";

export function isBusiness(value: unknown): value is Business {
  return value === "FDH" || value === "LDB";
}

export const BUSINESS_FILTERS = ["ALL", "FDH", "LDB"] as const;
export type BusinessFilter = (typeof BUSINESS_FILTERS)[number];

export const BUSINESS_FILTER_LABELS: Record<BusinessFilter, string> = {
  ALL: "All",
  FDH: "FDH",
  LDB: "LDB",
};

// From an address bar or request: anything unknown is All.
export function parseBusinessFilter(raw: unknown): BusinessFilter {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === "FDH" || value === "LDB" ? value : "ALL";
}

// Whether a lead (or its job, email or task) belongs under a filter. A lead
// with no business recorded is FDH, as every lead from before businesses
// existed is.
export function leadInFilter(business: Business | null | undefined, filter: BusinessFilter): boolean {
  return filter === "ALL" || (business ?? "FDH") === filter;
}

// Something that may have no lead at all (a task or calendar event on its
// own): with none it shows under every filter.
export function itemInFilter(lead: { business?: Business | null } | null | undefined, filter: BusinessFilter): boolean {
  return !lead || leadInFilter(lead.business, filter);
}

export function filterByBusiness<T extends { business?: Business | null }>(items: T[], filter: BusinessFilter): T[] {
  return filter === "ALL" ? items : items.filter((item) => leadInFilter(item.business, filter));
}

// A Prisma where for a lead's business (empty for All).
export function leadBusinessWhere(filter: BusinessFilter): { business?: Business } {
  return filter === "ALL" ? {} : { business: filter };
}

// --- Expenses ---------------------------------------------------------------

export const EXPENSE_BUSINESSES = ["SHARED", "FDH", "LDB"] as const;
export type ExpenseBusiness = (typeof EXPENSE_BUSINESSES)[number];

export const EXPENSE_BUSINESS_LABELS: Record<ExpenseBusiness, string> = {
  SHARED: "Shared",
  FDH: "FDH",
  LDB: "LDB",
};

export function isExpenseBusiness(value: unknown): value is ExpenseBusiness {
  return value === "SHARED" || value === "FDH" || value === "LDB";
}

// Under a business filter an expense counts when it is that business's or
// shared, so shared costs appear under both; All shows every expense once.
export function expenseMatchesBusiness(business: ExpenseBusiness, filter: BusinessFilter): boolean {
  return filter === "ALL" || business === "SHARED" || business === filter;
}

// An expense with no business recorded is shared.
export function filterExpensesByBusiness<T extends { business?: ExpenseBusiness }>(
  expenses: T[],
  filter: BusinessFilter
): T[] {
  return filter === "ALL" ? expenses : expenses.filter((e) => expenseMatchesBusiness(e.business ?? "SHARED", filter));
}

export const SHARED_COSTS_NOTE = "Shared costs appear under both businesses";
