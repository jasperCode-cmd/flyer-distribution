import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { stageChangeOps, stageUpdateData, type StageChangeDb } from "@/lib/lead-stage";
import { validateCostInput } from "@/lib/job-costs";
import { decimalToPence, formatPence, parsePoundsToPence } from "@/lib/money";
import {
  ALL_TIME,
  distributorPayments,
  jobFigures,
  jobsForMonth,
  leafletCountFromQuantity,
  monthKeyLondon,
  monthOptions,
  perThousandAmountPence,
  summarize,
  wonAtFromDateInput,
  wonDateInput,
  type CostLine,
  type ProfitJob,
} from "@/lib/profit";

// A stand-in for the Prisma client that records what the stage routes ask
// it to write.
function recordingDb() {
  const calls: { model: string; args: { where?: { id: string }; data: Record<string, unknown> } }[] = [];
  const db: StageChangeDb = {
    lead: { update: (args) => calls.push({ model: "lead", args }) },
    activity: { create: (args) => calls.push({ model: "activity", args }) },
  };
  return { db, calls };
}

const NOW = new Date("2026-10-11T09:15:00Z");
const EARLIER = new Date("2026-08-03T12:00:00Z");

// --- wonAt on every route into Won ---------------------------------------

test("the single-lead stage route (Kanban drag, table select, lead page) sets wonAt on a move into Won", () => {
  const { db, calls } = recordingDb();
  stageChangeOps(db, { id: "l1", stage: "AWAITING_RESPONSE", wonAt: null }, "WON", { userId: "u1", now: NOW });
  assert.deepEqual(calls[0].args, { where: { id: "l1" }, data: { stage: "WON", wonAt: NOW } });
  assert.equal(calls[1].args.data.detail, "Stage changed from Warm / Awaiting Response to Won");
  assert.equal(calls[1].args.data.type, "STAGE_CHANGE");
});

test("the bulk route sets wonAt on a move into Won and keeps its (bulk action) note", () => {
  const { db, calls } = recordingDb();
  stageChangeOps(db, { id: "l2", stage: "UNCONTACTED", wonAt: null }, "WON", { userId: "u1", now: NOW, bulk: true });
  assert.deepEqual(calls[0].args.data, { stage: "WON", wonAt: NOW });
  assert.equal(calls[1].args.data.detail, "Stage changed from Uncontacted to Won (bulk action)");
});

test("a move straight to Completed sets wonAt if it is empty", () => {
  for (const bulk of [false, true]) {
    const { db, calls } = recordingDb();
    stageChangeOps(db, { id: "l3", stage: "AWAITING_RESPONSE", wonAt: null }, "COMPLETED", { userId: null, now: NOW, bulk });
    assert.deepEqual(calls[0].args.data, { stage: "COMPLETED", wonAt: NOW });
  }
});

test("Won to Completed keeps the existing wonAt", () => {
  const { db, calls } = recordingDb();
  stageChangeOps(db, { id: "l4", stage: "WON", wonAt: EARLIER }, "COMPLETED", { userId: "u1", now: NOW });
  assert.deepEqual(calls[0].args.data, { stage: "COMPLETED" });
});

test("leaving Won never clears wonAt, and coming back keeps the first win", () => {
  const { db, calls } = recordingDb();
  stageChangeOps(db, { id: "l5", stage: "WON", wonAt: EARLIER }, "LOST", {
    userId: "u1",
    now: NOW,
    extraData: { lostReason: "PRICE", lostReasonNote: null },
  });
  assert.deepEqual(calls[0].args.data, { stage: "LOST", lostReason: "PRICE", lostReasonNote: null });
  assert.equal("wonAt" in calls[0].args.data, false);

  stageChangeOps(db, { id: "l5", stage: "LOST", wonAt: EARLIER }, "WON", { userId: "u1", now: NOW });
  assert.deepEqual(calls[2].args.data, { stage: "WON" });
});

test("moves that are not into Won or Completed never touch wonAt", () => {
  for (const stage of ["UNCONTACTED", "AWAITING_RESPONSE", "LOST"]) {
    assert.deepEqual(stageUpdateData({ wonAt: null }, stage, NOW), { stage });
  }
});

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "__tests__" ? [] : sourceFiles(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

test("both server routes that change a lead's stage go through stageChangeOps, and nothing else writes a stage from a variable", () => {
  for (const route of ["app/api/crm/leads/[id]/stage/route.ts", "app/api/crm/leads/bulk/route.ts"]) {
    const source = readFileSync(route, "utf8");
    assert.match(source, /stageChangeOps\(prisma, /, route);
    assert.doesNotMatch(source, /type: "STAGE_CHANGE"/, route);
  }
  const direct = /stage:\s*"(WON|COMPLETED)"|data:\s*\{\s*stage\b|stage:\s*(stage|newStage|body\.stage)\b|type: "STAGE_CHANGE"/;
  const offenders = [...sourceFiles("app/api"), ...sourceFiles("lib")]
    .filter((file) => !file.endsWith("lead-stage.ts") && !file.endsWith("send-lead-email.ts"))
    .filter((file) => direct.test(readFileSync(file, "utf8")));
  assert.deepEqual(offenders, []);
  // The one other stage writer, the email flow, only ever moves a lead to
  // Warm / Awaiting Response.
  assert.match(readFileSync("lib/send-lead-email.ts", "utf8"), /awaitingResponseStageData\(\)/);
});

// --- Per 1,000 leaflets, worked out on the server ------------------------

test("a per-1,000 distributor amount is worked out from the rate and count, ignoring any amount sent", () => {
  const result = validateCostInput({
    category: "DISTRIBUTOR",
    distributorId: "d1",
    payType: "PER_THOUSAND",
    rate: "45",
    leafletCount: "5,000",
    amount: "1.00",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.data, {
    category: "DISTRIBUTOR",
    distributorId: "d1",
    payType: "PER_THOUSAND",
    ratePence: 4500,
    leafletCount: 5000,
    amountPence: 22500,
    label: null,
    note: null,
  });
});

test("per-1,000 rounding is to the nearest penny, halves up, in whole numbers", () => {
  assert.equal(perThousandAmountPence(3333, 1234), 4113); // 4112.922
  assert.equal(perThousandAmountPence(1, 500), 1); // 0.5
  assert.equal(perThousandAmountPence(1, 499), 0); // 0.499
  assert.equal(perThousandAmountPence(4250, 7500), 31875);
});

test("per-1,000 lines reject a bad rate, a bad count, and a total over the cap", () => {
  const base = { category: "DISTRIBUTOR", distributorId: "d1", payType: "PER_THOUSAND" };
  assert.equal(validateCostInput({ ...base, rate: "abc", leafletCount: "1000" }).ok, false);
  assert.equal(validateCostInput({ ...base, rate: "45", leafletCount: "0" }).ok, false);
  assert.equal(validateCostInput({ ...base, rate: "45", leafletCount: "12.5" }).ok, false);
  assert.equal(validateCostInput({ ...base, rate: "45", leafletCount: "10000001" }).ok, false);
  assert.equal(validateCostInput({ ...base, rate: "1000000", leafletCount: "10000000" }).ok, false);
});

test("cost lines: what each kind needs", () => {
  const flat = validateCostInput({ category: "DISTRIBUTOR", distributorId: "d1", payType: "FLAT", amount: "£1,250.50" });
  assert.equal(flat.ok && flat.data.amountPence, 125050);
  assert.equal(flat.ok && flat.data.ratePence, null);

  assert.equal(validateCostInput({ category: "DISTRIBUTOR", payType: "FLAT", amount: "10" }).ok, false);
  const kept = validateCostInput({ payType: "FLAT", amount: "10" }, { fixedCategory: "DISTRIBUTOR", keepDeletedDistributor: true });
  assert.equal(kept.ok && kept.data.distributorId, null);
  assert.equal(validateCostInput({ category: "DISTRIBUTOR", distributorId: "d1", amount: "10" }).ok, false);

  const fuel = validateCostInput({ category: "FUEL", amount: "12.40" });
  assert.equal(fuel.ok && fuel.data.amountPence, 1240);

  assert.equal(validateCostInput({ category: "ADDITIONAL", amount: "5" }).ok, false);
  const extra = validateCostInput({ category: "ADDITIONAL", amount: "5", label: " Parking " });
  assert.equal(extra.ok && extra.data.label, "Parking");

  const printing = validateCostInput({ category: "PRINTING", amount: "300" });
  assert.equal(printing.ok && printing.data.label, null);

  // An edit can't change what the line is for.
  const edited = validateCostInput({ category: "ADDITIONAL", amount: "50" }, { fixedCategory: "DESIGN" });
  assert.equal(edited.ok && edited.data.category, "DESIGN");

  for (const amount of ["-5", "1.234", "", "abc", "1000000.01"]) {
    assert.equal(validateCostInput({ category: "PRINTING", amount }).ok, false, amount);
  }
  assert.equal(validateCostInput({ category: "PRINTING", amount: "1000000" }).ok, true);
  assert.equal(validateCostInput({ category: "PRINTING", amount: "5", label: "x".repeat(101) }).ok, false);
  assert.equal(validateCostInput({ category: "VAT", amount: "5" }).ok, false);
  assert.equal(validateCostInput(null).ok, false);
});

// --- Money in pence -------------------------------------------------------

test("deal value and amount paid convert to pence exactly, not through floating point", () => {
  assert.equal(decimalToPence("19.99"), 1999);
  assert.equal(decimalToPence("1234.5"), 123450);
  assert.equal(decimalToPence("0.10"), 10);
  assert.equal(decimalToPence({ toFixed: () => "4.35" }), 435);
  assert.equal(decimalToPence(null), null);
  assert.equal(parsePoundsToPence("0.29"), 29);
  assert.equal(parsePoundsToPence("1.005"), null);
  assert.equal(formatPence(-12000), "-£120.00");
  assert.equal(formatPence(null), "-");
});

function line(category: CostLine["category"], amountPence: number, extra: Partial<CostLine> = {}): CostLine {
  return {
    id: `${category}-${amountPence}-${Math.random()}`,
    category,
    distributorId: null,
    distributorName: null,
    payType: null,
    ratePence: null,
    leafletCount: null,
    amountPence,
    label: null,
    note: null,
    createdAt: "2026-10-01T00:00:00.000Z",
    ...extra,
  };
}

function job(overrides: Partial<ProfitJob> = {}): ProfitJob {
  return {
    leadId: `lead-${Math.random()}`,
    name: "Test",
    businessName: null,
    stage: "WON",
    wonAt: "2026-10-01T10:00:00.000Z",
    dealPence: null,
    paidPence: null,
    leafletQuantity: null,
    printingIncluded: false,
    designIncluded: false,
    costs: [],
    ...overrides,
  };
}

// --- Profit and margin ----------------------------------------------------

test("profit and margin are on the amount paid; expected profit is on the deal value", () => {
  const f = jobFigures(
    job({
      paidPence: 100000,
      dealPence: 120000,
      costs: [
        line("DISTRIBUTOR", 30000),
        line("FUEL", 2000),
        line("PRINTING", 15000),
        line("DESIGN", 5000),
        line("ADDITIONAL", 3000),
      ],
    })
  );
  assert.deepEqual(f.groups, { distributors: 32000, printing: 15000, design: 5000, additional: 3000 });
  assert.equal(f.costsPence, 55000);
  assert.equal(f.profitPence, 45000);
  assert.equal(f.marginPct, 45);
  assert.equal(f.expectedProfitPence, 65000);
  assert.equal(f.expectedMarginPct!.toFixed(4), "54.1667");
  assert.equal(f.isLoss, false);
});

test("nothing paid: profit is minus the costs, margin is unknown", () => {
  const unpaid = jobFigures(job({ paidPence: null, dealPence: 50000, costs: [line("DISTRIBUTOR", 12000)] }));
  assert.equal(unpaid.paidPence, 0);
  assert.equal(unpaid.profitPence, -12000);
  assert.equal(unpaid.marginPct, null);
  assert.equal(unpaid.isLoss, true);
  assert.equal(unpaid.expectedProfitPence, 38000);

  const empty = jobFigures(job({ paidPence: 0 }));
  assert.equal(empty.profitPence, 0);
  assert.equal(empty.marginPct, null);
  assert.equal(empty.isLoss, false);
  assert.equal(empty.expectedProfitPence, null);
});

test("a loss: costs more than the amount paid", () => {
  const f = jobFigures(job({ paidPence: 20000, dealPence: 20000, costs: [line("DISTRIBUTOR", 18000), line("PRINTING", 7000)] }));
  assert.equal(f.profitPence, -5000);
  assert.equal(f.marginPct, -25);
  assert.equal(f.isLoss, true);
});

test("pence add up exactly where pounds as floats would not", () => {
  const f = jobFigures(job({ paidPence: 30, costs: [line("ADDITIONAL", 10), line("ADDITIONAL", 20)] }));
  assert.equal(f.profitPence, 0);
  assert.notEqual(0.1 + 0.2, 0.3);
});

test("the summary adds up paid, deal value and costs across jobs", () => {
  const s = summarize([
    job({ paidPence: 100000, dealPence: 100000, costs: [line("DISTRIBUTOR", 40000)] }),
    job({ paidPence: 25000, dealPence: null, costs: [line("PRINTING", 30000)] }),
    job({ paidPence: null, dealPence: 50000 }),
  ]);
  assert.equal(s.jobCount, 3);
  assert.equal(s.paidPence, 125000);
  assert.equal(s.dealPence, 150000);
  assert.equal(s.noDealCount, 1);
  assert.equal(s.costsPence, 70000);
  assert.equal(s.profitPence, 55000);
  assert.equal(s.marginPct, 44);
  assert.equal(s.expectedProfitPence, 80000);
  assert.equal(summarize([]).marginPct, null);
});

test("what each distributor was paid, fuel included; a deleted distributor's lines stay", () => {
  const payments = distributorPayments([
    line("DISTRIBUTOR", 20000, { distributorId: "a", distributorName: "Alex" }),
    line("FUEL", 1500, { distributorId: "a", distributorName: "Alex" }),
    line("DISTRIBUTOR", 30000, { distributorId: "b", distributorName: "Bea" }),
    line("DISTRIBUTOR", 9000, { id: "gone" }),
    line("FUEL", 800),
    line("PRINTING", 5000),
  ]);
  assert.deepEqual(payments, [
    { key: "b", name: "Bea", amountPence: 30000 },
    { key: "a", name: "Alex", amountPence: 21500 },
    { key: "deleted:gone", name: "Deleted distributor", amountPence: 9000 },
  ]);
});

// --- Months, by won date, in UK time --------------------------------------

test("a job counts towards the UK month it was won in", () => {
  // 23:30 UTC on 31 July is 00:30 on 1 August in British Summer Time.
  assert.equal(monthKeyLondon("2026-07-31T23:30:00Z"), "2026-08");
  // In winter UK time is UTC.
  assert.equal(monthKeyLondon("2026-12-31T23:30:00Z"), "2026-12");
  assert.equal(monthKeyLondon("2027-01-01T00:00:00Z"), "2027-01");
});

test("month grouping by wonAt; All time includes jobs with no won date", () => {
  const july = job({ name: "July", wonAt: "2026-07-15T10:00:00Z" });
  const lateJuly = job({ name: "Late July (UK August)", wonAt: "2026-07-31T23:30:00Z" });
  const august = job({ name: "August", wonAt: "2026-08-20T10:00:00Z" });
  const unknown = job({ name: "Unknown", wonAt: null });
  const all = [july, lateJuly, august, unknown];

  assert.deepEqual(jobsForMonth(all, "2026-07").map((j) => j.name), ["July"]);
  assert.deepEqual(jobsForMonth(all, "2026-08").map((j) => j.name), ["Late July (UK August)", "August"]);
  assert.deepEqual(jobsForMonth(all, "2026-10"), []);
  assert.equal(jobsForMonth(all, ALL_TIME).length, 4);

  assert.deepEqual(monthOptions(all, "2026-10"), ["2026-10", "2026-08", "2026-07"]);
  assert.deepEqual(monthOptions([], "2026-10", "2025-12"), ["2026-10", "2025-12"]);
});

test("a won date set by hand is stored as midday UTC and stays on that UK day", () => {
  const summer = wonAtFromDateInput("2026-08-01")!;
  assert.equal(summer.toISOString(), "2026-08-01T12:00:00.000Z");
  assert.equal(monthKeyLondon(summer), "2026-08");
  assert.equal(wonDateInput(summer.toISOString()), "2026-08-01");
  assert.equal(wonDateInput("2026-07-31T23:30:00Z"), "2026-08-01");
  assert.equal(wonAtFromDateInput("2026-02-30"), null);
  assert.equal(wonAtFromDateInput("01/08/2026"), null);
});

test("the leaflet count is only prefilled from a plain number", () => {
  assert.equal(leafletCountFromQuantity("5000"), 5000);
  assert.equal(leafletCountFromQuantity("5,000"), 5000);
  assert.equal(leafletCountFromQuantity(" 12,500 leaflets "), 12500);
  assert.equal(leafletCountFromQuantity("5,000 - 10,000"), null);
  assert.equal(leafletCountFromQuantity("Under 1,000"), null);
  assert.equal(leafletCountFromQuantity("25,000+"), null);
  assert.equal(leafletCountFromQuantity(""), null);
  assert.equal(leafletCountFromQuantity(null), null);
});
