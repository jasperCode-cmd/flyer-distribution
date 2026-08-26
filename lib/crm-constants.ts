// Pure constants/helpers only — safe to import from Client Components.
// Anything touching Prisma lives in lib/crm-data.ts instead, so this file
// never pulls the Postgres driver into the browser bundle.

const OPEN_STAGES = ["UNCONTACTED", "AWAITING_RESPONSE"] as const;
const STALE_DAYS = 5;

type LeadForActivity = {
  createdAt: Date | string;
  activities: { createdAt: Date | string }[];
};

function toDate(d: Date | string): Date {
  return d instanceof Date ? d : new Date(d);
}

export function getLastInteracted(lead: LeadForActivity): Date {
  return toDate(lead.activities[0]?.createdAt ?? lead.createdAt);
}

export function isStale(lead: LeadForActivity, days = STALE_DAYS): boolean {
  const last = getLastInteracted(lead);
  return Date.now() - last.getTime() > days * 24 * 60 * 60 * 1000;
}

export function computeDashboardStats<
  T extends LeadForActivity & { stage: string; dealValue: unknown }
>(leads: T[]) {
  const pipelineValue = leads
    .filter((l) => (OPEN_STAGES as readonly string[]).includes(l.stage))
    .reduce((sum, l) => sum + (l.dealValue ? Number(l.dealValue) : 0), 0);

  const stageCounts: Record<string, number> = {
    UNCONTACTED: 0,
    AWAITING_RESPONSE: 0,
    WON: 0,
    LOST: 0,
  };
  for (const l of leads) {
    stageCounts[l.stage] = (stageCounts[l.stage] ?? 0) + 1;
  }

  const nonOpenCount = stageCounts.WON + stageCounts.LOST;
  const conversionRate = nonOpenCount > 0 ? stageCounts.WON / nonOpenCount : 0;

  const staleLeads = leads
    .filter((l) => isStale(l))
    .sort((a, b) => getLastInteracted(a).getTime() - getLastInteracted(b).getTime());

  return {
    pipelineValue,
    stageCounts,
    conversionRate,
    staleLeads,
    totalLeads: leads.length,
  };
}

export const STAGE_LABELS: Record<string, string> = {
  UNCONTACTED: "Uncontacted",
  AWAITING_RESPONSE: "Awaiting Response",
  WON: "Won",
  LOST: "Lost",
};

export const STAGES = ["UNCONTACTED", "AWAITING_RESPONSE", "WON", "LOST"] as const;

export const SOURCE_LABELS: Record<string, string> = {
  WEBSITE_QUOTE_FORM: "Website Quote Form",
  INSTAGRAM_DM: "Instagram DM",
  REFERRAL: "Referral",
  COLD_OUTREACH: "Cold Outreach",
  OTHER: "Other",
};

export const PRIORITIES = ["HIGH", "MEDIUM", "LOW"] as const;

export const PRIORITY_LABELS: Record<string, string> = {
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

export const LOST_REASONS = ["PRICE", "CHOSE_COMPETITOR", "WENT_QUIET", "NOT_READY", "OTHER"] as const;

export const LOST_REASON_LABELS: Record<string, string> = {
  PRICE: "Price",
  CHOSE_COMPETITOR: "Chose Competitor",
  WENT_QUIET: "Went Quiet",
  NOT_READY: "Not Ready",
  OTHER: "Other",
};

export type LeadFilters = {
  stage?: string;
  source?: string;
  assignedToId?: string;
  priority?: string;
  tagId?: string;
  atRiskOnly?: boolean;
};

type FilterableLead = {
  stage: string;
  source: string;
  priority: string;
  atRisk: boolean;
  assignedTo: { id: string } | null;
  tags?: { id: string }[];
};

export function applyLeadFilters<T extends FilterableLead>(leads: T[], filters: LeadFilters): T[] {
  let result = leads;
  if (filters.stage) result = result.filter((l) => l.stage === filters.stage);
  if (filters.source) result = result.filter((l) => l.source === filters.source);
  if (filters.assignedToId) result = result.filter((l) => l.assignedTo?.id === filters.assignedToId);
  if (filters.priority) result = result.filter((l) => l.priority === filters.priority);
  if (filters.tagId) result = result.filter((l) => (l.tags ?? []).some((t) => t.id === filters.tagId));
  if (filters.atRiskOnly) result = result.filter((l) => l.atRisk);
  return result;
}

export function isOverdue(dueDate: Date | string): boolean {
  const d = toDate(dueDate);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  return d.getTime() < startOfToday.getTime();
}

export function isDueToday(dueDate: Date | string): boolean {
  const d = toDate(dueDate);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}
