import { normalizePhone } from "./distributor-applications";

// The Distributors page: each distributor with what they have worked and
// been paid, worked out from plain data so it can be tested without a
// database.
//
// Jobs worked and total paid come from two places: distributor cost lines
// (set amount or per 1,000 leaflets) that name the distributor, and Jobs
// where they are the assigned distributor. Both point at a lead, and a lead
// has at most one Job, so a job is one lead: it is counted once however many
// lines it has and whether or not they are also the assigned distributor.
// Only the cost lines carry money; an assignment alone counts as a job with
// nothing paid yet. Fuel lines are not pay and are left out.

export type ApplicationFacts = {
  id: string;
  area: string | null;
  hasCar: boolean | null;
  hasLicence: boolean | null;
  availability: string | null;
  receivedAt: string;
};

export type DistributorRecord = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  active: boolean;
  // Their colour on the Area Planner, once they have been placed on a map.
  mapColour?: string | null;
  // Their most recent application, if they came from one. Manually added
  // distributors have none.
  application: ApplicationFacts | null;
};

// What a job says about itself, for the panel's list.
export type JobLead = {
  leadId: string;
  leadName: string;
  businessName: string | null;
  wonAt: string | null;
  campaignStartDate: string | null;
};

// A Job with this distributor assigned to it.
export type AssignedJob = JobLead & { distributorId: string };

// A distributor cost line naming this distributor.
export type PayLine = JobLead & {
  id: string;
  distributorId: string;
  payType: "FLAT" | "PER_THOUSAND" | null;
  ratePence: number | null;
  leafletCount: number | null;
  amountPence: number;
};

export type ShiftFacts = {
  id: string;
  distributorId: string;
  title: string;
  startDateTime: string;
  endDateTime: string | null;
  completed: boolean;
};

export type DistributorJob = JobLead & {
  // When the job happened: the campaign start if known, else the won date.
  jobDate: string | null;
  assigned: boolean;
  lines: Pick<PayLine, "id" | "payType" | "ratePence" | "leafletCount" | "amountPence">[];
  paidPence: number;
};

export type DistributorSummary = DistributorRecord & {
  jobs: DistributorJob[];
  jobsWorked: number;
  totalPaidPence: number;
  // The latest job date that has arrived; a campaign still to come isn't a
  // "last job" yet.
  lastJobDate: string | null;
  upcomingShifts: ShiftFacts[];
};

function jobDateOf(job: JobLead): string | null {
  return job.campaignStartDate ?? job.wonAt;
}

// Newest first, undated last.
function byDateDesc(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return b.localeCompare(a);
}

export function summarizeDistributors(
  distributors: DistributorRecord[],
  assigned: AssignedJob[],
  lines: PayLine[],
  shifts: ShiftFacts[],
  now: Date
): DistributorSummary[] {
  // distributor id -> lead id -> job
  const jobs = new Map<string, Map<string, DistributorJob>>();
  function jobFor(distributorId: string, lead: JobLead): DistributorJob {
    let byLead = jobs.get(distributorId);
    if (!byLead) jobs.set(distributorId, (byLead = new Map()));
    let job = byLead.get(lead.leadId);
    if (!job) {
      job = {
        leadId: lead.leadId,
        leadName: lead.leadName,
        businessName: lead.businessName,
        wonAt: lead.wonAt,
        campaignStartDate: lead.campaignStartDate,
        jobDate: jobDateOf(lead),
        assigned: false,
        lines: [],
        paidPence: 0,
      };
      byLead.set(lead.leadId, job);
    }
    return job;
  }

  for (const a of assigned) jobFor(a.distributorId, a).assigned = true;
  for (const line of lines) {
    const job = jobFor(line.distributorId, line);
    job.lines.push({
      id: line.id,
      payType: line.payType,
      ratePence: line.ratePence,
      leafletCount: line.leafletCount,
      amountPence: line.amountPence,
    });
    job.paidPence += line.amountPence;
  }

  const nowMs = now.getTime();
  return distributors.map((d) => {
    const list = [...(jobs.get(d.id)?.values() ?? [])].sort(
      (a, b) => byDateDesc(a.jobDate, b.jobDate) || a.leadName.localeCompare(b.leadName)
    );
    const upcomingShifts = shifts
      .filter((s) => s.distributorId === d.id && !s.completed && Date.parse(s.endDateTime ?? s.startDateTime) >= nowMs)
      .sort((a, b) => a.startDateTime.localeCompare(b.startDateTime));
    return {
      ...d,
      jobs: list,
      jobsWorked: list.length,
      totalPaidPence: list.reduce((sum, j) => sum + j.paidPence, 0),
      lastJobDate: list.find((j) => j.jobDate && Date.parse(j.jobDate) <= nowMs)?.jobDate ?? null,
      upcomingShifts,
    };
  });
}

// --- Phone numbers -----------------------------------------------------------

// One consistent way to show a UK number, whatever way it was typed:
// "07700 900123", "020 7946 0018", "023 8049 6000", "0121 496 0000",
// "01425 470000". +44 and 0044 become a leading 0. Anything that isn't an
// 11-digit UK number is shown as it was typed.
export function formatUkPhone(phone: string | null | undefined): string | null {
  const raw = (phone ?? "").trim();
  if (!raw) return null;
  const d = normalizePhone(raw);
  if (d.length !== 11 || !d.startsWith("0")) return raw;
  if (d.startsWith("07")) return `${d.slice(0, 5)} ${d.slice(5)}`;
  if (d.startsWith("02")) return `${d.slice(0, 3)} ${d.slice(3, 7)} ${d.slice(7)}`;
  // 011x and 01x1 are the large cities (0113, 0121 and so on).
  if (/^01(1\d|\d1)/.test(d)) return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
  if (d.startsWith("01")) return `${d.slice(0, 5)} ${d.slice(5)}`;
  // 03, 08 and 09 numbers.
  return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
}

// --- Search, filters and sorting ----------------------------------------------

export type YesNoFilter = "" | "yes" | "no";
export type StatusFilter = "active" | "inactive" | "all";
export type DistributorSort = "name" | "jobs" | "paid" | "last";

export type DistributorFilters = {
  q?: string;
  area?: string;
  car?: YesNoFilter;
  licence?: YesNoFilter;
  status?: StatusFilter;
};

export const DEFAULT_STATUS: StatusFilter = "active";

export const SORT_LABELS: Record<DistributorSort, string> = {
  name: "Name, A to Z",
  jobs: "Most jobs worked",
  paid: "Most paid",
  last: "Most recent job",
};

function compact(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/\s+/g, "");
}

// Name or email (ignoring case), or phone in any format: "07700 900123",
// "+44 7700 900123", "07700900123" and "900 123" all find the same person.
export function matchesDistributorSearch(d: Pick<DistributorRecord, "name" | "phone" | "email">, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (d.name.toLowerCase().includes(q)) return true;
  if ((d.email ?? "").toLowerCase().includes(q)) return true;
  const qDigits = q.replace(/\D/g, "");
  // Only a query that is all digits and phone punctuation is a phone search.
  if (qDigits.length >= 3 && qDigits.length === q.replace(/[\s()+\-.]/g, "").length) {
    const stored = normalizePhone(d.phone);
    if (stored.includes(normalizePhone(q)) || (d.phone ?? "").replace(/\D/g, "").includes(qDigits)) return true;
  }
  return false;
}

function yesNoMatches(value: boolean | null, filter: YesNoFilter | undefined): boolean {
  if (!filter) return true;
  return value === (filter === "yes");
}

export function filterDistributors<T extends DistributorRecord>(list: T[], filters: DistributorFilters): T[] {
  const status = filters.status ?? DEFAULT_STATUS;
  const area = compact(filters.area);
  return list.filter((d) => {
    if (status === "active" && !d.active) return false;
    if (status === "inactive" && d.active) return false;
    // Area, car and licence only come from an application; a distributor
    // added by hand has none, so any of these filters leaves them out.
    if (area && !compact(d.application?.area).includes(area)) return false;
    if (!yesNoMatches(d.application?.hasCar ?? null, filters.car)) return false;
    if (!yesNoMatches(d.application?.hasLicence ?? null, filters.licence)) return false;
    return matchesDistributorSearch(d, filters.q ?? "");
  });
}

export function sortDistributors(list: DistributorSummary[], sort: DistributorSort): DistributorSummary[] {
  const byName = (a: DistributorSummary, b: DistributorSummary) =>
    a.name.localeCompare(b.name, "en-GB", { sensitivity: "base" });
  const compare: Record<DistributorSort, (a: DistributorSummary, b: DistributorSummary) => number> = {
    name: byName,
    jobs: (a, b) => b.jobsWorked - a.jobsWorked || byName(a, b),
    paid: (a, b) => b.totalPaidPence - a.totalPaidPence || byName(a, b),
    last: (a, b) => byDateDesc(a.lastJobDate, b.lastJobDate) || byName(a, b),
  };
  return [...list].sort(compare[sort]);
}

export function isDistributorSort(value: unknown): value is DistributorSort {
  return value === "name" || value === "jobs" || value === "paid" || value === "last";
}

// A short look at someone's availability for the table, cut at a word.
export function availabilityPreview(text: string | null | undefined, max = 48): string {
  const flat = (text ?? "").replace(/\s+/g, " ").trim();
  if (!flat) return "-";
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max - 3);
  const space = cut.lastIndexOf(" ");
  return `${(space > max / 2 ? cut.slice(0, space) : cut).trimEnd()}...`;
}
