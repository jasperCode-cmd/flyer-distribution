import { test } from "node:test";
import assert from "node:assert/strict";
import {
  availabilityPreview,
  filterDistributors,
  formatUkPhone,
  matchesDistributorSearch,
  sortDistributors,
  summarizeDistributors,
  type AssignedJob,
  type DistributorRecord,
  type DistributorSummary,
  type JobLead,
  type PayLine,
  type ShiftFacts,
} from "@/lib/distributor-directory";
import { buildDistributorUpdate } from "@/lib/distributors";

const NOW = new Date("2026-10-11T10:00:00.000Z");

function distributor(o: Partial<DistributorRecord> = {}): DistributorRecord {
  return { id: "d1", name: "Sam Turner", phone: "07700 900123", email: "sam@example.com", notes: null, active: true, application: null, ...o };
}

const leadA: JobLead = { leadId: "LA", leadName: "Ruby Lane", businessName: "Lane Florists", wonAt: "2026-07-08T10:00:00.000Z", campaignStartDate: "2026-07-20T00:00:00.000Z" };
const leadB: JobLead = { leadId: "LB", leadName: "Theo Marsh", businessName: null, wonAt: "2026-08-21T11:00:00.000Z", campaignStartDate: null };
const leadC: JobLead = { leadId: "LC", leadName: "Chloe Hughes", businessName: null, wonAt: "2026-09-30T09:00:00.000Z", campaignStartDate: "2026-10-13T00:00:00.000Z" };

function line(o: Partial<PayLine> & Pick<PayLine, "id" | "leadId">): PayLine {
  const lead = [leadA, leadB, leadC].find((l) => l.leadId === o.leadId)!;
  return { ...lead, distributorId: "d1", payType: "FLAT", ratePence: null, leafletCount: null, amountPence: 10000, ...o };
}

const assignedTo = (lead: JobLead, distributorId = "d1"): AssignedJob => ({ ...lead, distributorId });

function summary(o: Partial<DistributorSummary> = {}): DistributorSummary {
  return { ...distributor(o), jobs: [], jobsWorked: 0, totalPaidPence: 0, lastJobDate: null, upcomingShifts: [], ...o };
}

// --- Jobs worked and total paid ---------------------------------------------------------

test("a job is counted once whether they were assigned, paid, or both, and every pay line adds up", () => {
  const [s] = summarizeDistributors(
    [distributor()],
    // Assigned on A and C.
    [assignedTo(leadA), assignedTo(leadC)],
    [
      // Two lines on A (two drops), where they are also the assigned distributor.
      line({ id: "c1", leadId: "LA", payType: "PER_THOUSAND", ratePence: 4000, leafletCount: 6000, amountPence: 24000 }),
      line({ id: "c2", leadId: "LA", amountPence: 5000 }),
      // Paid on B without being the assigned distributor.
      line({ id: "c3", leadId: "LB", amountPence: 30000 }),
    ],
    [],
    NOW
  );
  assert.equal(s.jobsWorked, 3, "A, B and C, each once");
  assert.equal(s.totalPaidPence, 24000 + 5000 + 30000);
  const byLead = Object.fromEntries(s.jobs.map((j) => [j.leadId, j]));
  assert.equal(byLead.LA.paidPence, 29000);
  assert.equal(byLead.LA.lines.length, 2);
  assert.equal(byLead.LA.assigned, true);
  assert.equal(byLead.LB.assigned, false);
  // Assigned but no pay recorded yet: a job, nothing paid.
  assert.equal(byLead.LC.paidPence, 0);
  assert.equal(byLead.LC.lines.length, 0);
  // Newest job first; a job's date is its campaign start, else its won date.
  assert.deepEqual(s.jobs.map((j) => j.leadId), ["LC", "LB", "LA"]);
  // C's campaign starts on 13 October, still to come, so the last job is B.
  assert.equal(s.lastJobDate, "2026-08-21T11:00:00.000Z");
  const later = summarizeDistributors([distributor()], [assignedTo(leadC)], [], [], new Date("2026-10-13T00:00:00.000Z"));
  assert.equal(later[0].lastJobDate, "2026-10-13T00:00:00.000Z", "from the day it starts");
});

test("someone else's lines and assignments don't count, and a distributor with none has nothing", () => {
  const [sam, priya] = summarizeDistributors(
    [distributor(), distributor({ id: "d2", name: "Priya Shah" })],
    [assignedTo(leadA, "d2")],
    [line({ id: "c1", leadId: "LA", distributorId: "d2", amountPence: 12000 })],
    [],
    NOW
  );
  assert.deepEqual([sam.jobsWorked, sam.totalPaidPence, sam.lastJobDate], [0, 0, null]);
  assert.deepEqual([priya.jobsWorked, priya.totalPaidPence], [1, 12000]);
});

test("upcoming shifts are their own, not completed, and not over; a shift in progress counts", () => {
  const shift = (o: Partial<ShiftFacts>): ShiftFacts => ({
    id: "s",
    distributorId: "d1",
    title: "Ringwood drop",
    startDateTime: "2026-10-14T08:00:00.000Z",
    endDateTime: "2026-10-14T12:00:00.000Z",
    completed: false,
    ...o,
  });
  const [s] = summarizeDistributors(
    [distributor()],
    [],
    [],
    [
      shift({ id: "later", startDateTime: "2026-10-20T08:00:00.000Z", endDateTime: null }),
      shift({ id: "soon" }),
      shift({ id: "now", startDateTime: "2026-10-11T08:00:00.000Z", endDateTime: "2026-10-11T12:00:00.000Z" }),
      shift({ id: "past", startDateTime: "2026-10-01T08:00:00.000Z", endDateTime: "2026-10-01T12:00:00.000Z" }),
      shift({ id: "done", completed: true }),
      shift({ id: "other", distributorId: "d2" }),
    ],
    NOW
  );
  assert.deepEqual(s.upcomingShifts.map((x) => x.id), ["now", "soon", "later"]);
});

// --- Phone numbers ----------------------------------------------------------------------

test("phones show in one UK format however they were typed", () => {
  for (const typed of ["07700900123", "07700 900123", "+44 7700 900123", "+447700900123", "0044 7700 900 123", "+44 (0)7700 900123", "07700-900-123"]) {
    assert.equal(formatUkPhone(typed), "07700 900123", typed);
  }
  assert.equal(formatUkPhone("02079460018"), "020 7946 0018");
  assert.equal(formatUkPhone("+44 23 8049 6000"), "023 8049 6000");
  assert.equal(formatUkPhone("01214960000"), "0121 496 0000");
  assert.equal(formatUkPhone("0113 496 0000"), "0113 496 0000");
  assert.equal(formatUkPhone("01425470000"), "01425 470000");
  assert.equal(formatUkPhone("03001234567"), "0300 123 4567");
  // Not an 11-digit UK number: shown as typed.
  assert.equal(formatUkPhone("+33 1 23 45 67 89"), "+33 1 23 45 67 89");
  assert.equal(formatUkPhone("12345"), "12345");
  assert.equal(formatUkPhone("  "), null);
  assert.equal(formatUkPhone(null), null);
});

test("search finds a phone in any format, and a name or email ignoring case", () => {
  const d = distributor({ phone: "+44 7700 900123" });
  for (const q of ["07700900123", "07700 900123", "+447700900123", "0044 7700 900123", "7700 900", "900123", "(07700) 900-123"]) {
    assert.equal(matchesDistributorSearch(d, q), true, q);
  }
  assert.equal(matchesDistributorSearch(distributor({ phone: "07700 900123" }), "+44 7700 900 123"), true);
  assert.equal(matchesDistributorSearch(d, "SAM"), true);
  assert.equal(matchesDistributorSearch(d, "turn"), true);
  assert.equal(matchesDistributorSearch(d, "Sam@Example"), true);
  assert.equal(matchesDistributorSearch(d, ""), true);
  assert.equal(matchesDistributorSearch(d, "07700 900999"), false);
  assert.equal(matchesDistributorSearch(d, "priya"), false);
  // A short number or one mixed with letters isn't a phone search.
  assert.equal(matchesDistributorSearch(d, "12"), false);
  assert.equal(matchesDistributorSearch(d, "abc 900"), false);
  assert.equal(matchesDistributorSearch(distributor({ phone: null }), "07700"), false);
});

// --- Filters and sorting ----------------------------------------------------------------

const app = (o: Partial<NonNullable<DistributorRecord["application"]>> = {}) => ({
  id: "a1",
  area: "Southampton, SO15 2AB",
  hasCar: true,
  hasLicence: true,
  availability: "Weekday mornings",
  receivedAt: "2026-06-01T09:00:00.000Z",
  ...o,
});

const people = [
  summary({ id: "sam", name: "Sam Turner", application: app(), jobsWorked: 2, totalPaidPence: 68000, lastJobDate: "2026-09-30T00:00:00.000Z" }),
  summary({ id: "priya", name: "priya Shah", phone: "07700 900301", email: "priya@example.com", application: app({ area: "Ringwood BH24", hasCar: false, hasLicence: true }), jobsWorked: 3, totalPaidPence: 56000, lastJobDate: "2026-10-13T00:00:00.000Z" }),
  summary({ id: "tom", name: "Tom Reid", phone: null, email: null, application: null, jobsWorked: 2, totalPaidPence: 76000, lastJobDate: null }),
  summary({ id: "olivia", name: "Olivia Grant", active: false, application: app({ area: "Eastleigh SO50", hasCar: null, hasLicence: false }), jobsWorked: 1, totalPaidPence: 9000, lastJobDate: "2026-05-01T00:00:00.000Z" }),
];
const ids = (list: { id: string }[]) => list.map((d) => d.id);

test("filters: Active by default, then Inactive or All, area, car and licence", () => {
  assert.deepEqual(ids(filterDistributors(people, {})), ["sam", "priya", "tom"]);
  assert.deepEqual(ids(filterDistributors(people, { status: "inactive" })), ["olivia"]);
  assert.deepEqual(ids(filterDistributors(people, { status: "all" })), ["sam", "priya", "tom", "olivia"]);
  // Area ignores case and spaces, so "so152ab" finds "SO15 2AB".
  assert.deepEqual(ids(filterDistributors(people, { area: "so152ab" })), ["sam"]);
  assert.deepEqual(ids(filterDistributors(people, { area: "ringwood" })), ["priya"]);
  assert.deepEqual(ids(filterDistributors(people, { car: "yes" })), ["sam"]);
  assert.deepEqual(ids(filterDistributors(people, { car: "no" })), ["priya"]);
  // Unknown car (Olivia) matches neither yes nor no.
  assert.deepEqual(ids(filterDistributors(people, { car: "no", status: "all" })), ["priya"]);
  assert.deepEqual(ids(filterDistributors(people, { licence: "no", status: "all" })), ["olivia"]);
  // Someone added by hand (Tom) has no area, car or licence, so any of
  // those filters leaves them out.
  assert.ok(!ids(filterDistributors(people, { licence: "yes" })).includes("tom"));
  // Filters combine with search.
  assert.deepEqual(ids(filterDistributors(people, { licence: "yes", q: "900301" })), ["priya"]);
});

test("sorting by name, jobs worked, total paid and last job", () => {
  assert.deepEqual(ids(sortDistributors(people, "name")), ["olivia", "priya", "sam", "tom"], "ignoring case");
  assert.deepEqual(ids(sortDistributors(people, "jobs")), ["priya", "sam", "tom", "olivia"], "ties by name");
  assert.deepEqual(ids(sortDistributors(people, "paid")), ["tom", "sam", "priya", "olivia"]);
  assert.deepEqual(ids(sortDistributors(people, "last")), ["priya", "sam", "olivia", "tom"], "no job last");
});

test("the availability preview is short and on one line", () => {
  assert.equal(availabilityPreview("After school on weekdays\nand Saturday mornings", 30), "After school on weekdays...");
  assert.equal(availabilityPreview("Weekends"), "Weekends");
  assert.equal(availabilityPreview(null), "-");
  assert.equal(availabilityPreview("   "), "-");
});

// --- Deactivating keeps history -----------------------------------------------------------

test("deactivating only turns the flag off, and an inactive distributor keeps their jobs, pay and shifts", () => {
  assert.deepEqual(buildDistributorUpdate({ active: false }), { ok: true, data: { active: false } });
  assert.deepEqual(buildDistributorUpdate({ active: true }), { ok: true, data: { active: true } });
  assert.deepEqual(buildDistributorUpdate({ active: "no" }), { ok: false, error: "Active must be true or false" });
  assert.deepEqual(buildDistributorUpdate({}), { ok: false, error: "Nothing to change" });
  // Edits use the same tidying as creating one.
  assert.deepEqual(buildDistributorUpdate({ name: "  Sam  ", phone: " ", email: " sam@example.com ", notes: "" }), {
    ok: true,
    data: { name: "Sam", phone: null, email: "sam@example.com", notes: null },
  });
  assert.deepEqual(buildDistributorUpdate({ name: "  " }), { ok: false, error: "Distributor name is required" });

  const [inactive] = summarizeDistributors(
    [distributor({ active: false })],
    [assignedTo(leadA)],
    [line({ id: "c1", leadId: "LA", amountPence: 24000 })],
    [{ id: "s1", distributorId: "d1", title: "Drop", startDateTime: "2026-10-20T08:00:00.000Z", endDateTime: null, completed: false }],
    NOW
  );
  assert.deepEqual([inactive.active, inactive.jobsWorked, inactive.totalPaidPence, inactive.upcomingShifts.length], [false, 1, 24000, 1]);
});
