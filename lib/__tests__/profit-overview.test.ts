import { test } from "node:test";
import assert from "node:assert/strict";
import {
  activeRetainers,
  addMonths,
  expenseMonths,
  expensesForPeriod,
  monthlyRows,
  periodFigures,
  retainerMonths,
} from "@/lib/profit-overview";
import {
  dateInputToDb,
  dbDateToInput,
  dbMonthToInput,
  monthInputToDb,
  ukToday,
  validateExpenseInput,
  validateRetainerInput,
  type ExpenseRecord,
} from "@/lib/expenses";
import { ALL_TIME, type CostLine, type ProfitJob } from "@/lib/profit";

const NOW = "2026-10";

function expense(o: Partial<ExpenseRecord>): ExpenseRecord {
  return {
    id: `e-${Math.random()}`,
    label: "Expense",
    category: "OFFICE",
    amountPence: 10000,
    kind: "ONE_OFF",
    date: null,
    startMonth: null,
    endMonth: null,
    note: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...o,
  };
}

function cost(amountPence: number, category: CostLine["category"] = "DISTRIBUTOR"): CostLine {
  return {
    id: `c-${Math.random()}`,
    category,
    distributorId: null,
    distributorName: null,
    payType: null,
    ratePence: null,
    leafletCount: null,
    amountPence,
    label: null,
    note: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

function job(o: Partial<ProfitJob>): ProfitJob {
  return {
    leadId: `l-${Math.random()}`,
    name: "Job",
    businessName: null,
    stage: "WON",
    wonAt: null,
    dealPence: null,
    paidPence: null,
    leafletQuantity: null,
    printingIncluded: false,
    designIncluded: false,
    costs: [],
    isRetainer: false,
    retainerMonthlyPence: null,
    retainerStart: null,
    retainerEnd: null,
    ...o,
  };
}

// --- Expenses -----------------------------------------------------------------

test("a recurring expense counts in every month from its start to its end, and no others", () => {
  const rent = expense({ kind: "MONTHLY", amountPence: 45000, startMonth: "2026-06", endMonth: "2026-08" });
  assert.deepEqual(expenseMonths(rent, NOW), ["2026-06", "2026-07", "2026-08"]);
  assert.equal(periodFigures([], [rent], "2026-05", NOW).expensesPence, 0);
  assert.equal(periodFigures([], [rent], "2026-06", NOW).expensesPence, 45000);
  assert.equal(periodFigures([], [rent], "2026-08", NOW).expensesPence, 45000);
  assert.equal(periodFigures([], [rent], "2026-09", NOW).expensesPence, 0);
  assert.equal(periodFigures([], [rent], ALL_TIME, NOW).expensesPence, 135000);
});

test("an ongoing recurring expense counts up to the current month only", () => {
  const software = expense({ kind: "MONTHLY", category: "SOFTWARE", amountPence: 1999, startMonth: "2026-08" });
  assert.deepEqual(expenseMonths(software, NOW), ["2026-08", "2026-09", "2026-10"]);
  assert.equal(periodFigures([], [software], "2026-11", NOW).expensesPence, 0);
  assert.equal(periodFigures([], [software], ALL_TIME, NOW).expensesPence, 5997);
  // Once November is the current month, it counts there too.
  assert.equal(periodFigures([], [software], ALL_TIME, "2026-11").expensesPence, 7996);
  // Starting in the future: nothing yet.
  assert.deepEqual(expenseMonths(expense({ kind: "MONTHLY", startMonth: "2026-12" }), NOW), []);
});

test("a one-off expense counts once, in its month", () => {
  const van = expense({ kind: "ONE_OFF", category: "VEHICLE", amountPence: 32000, date: "2026-09-15" });
  assert.deepEqual(expenseMonths(van, NOW), ["2026-09"]);
  assert.equal(periodFigures([], [van], "2026-09", NOW).expensesPence, 32000);
  assert.equal(periodFigures([], [van], "2026-10", NOW).expensesPence, 0);
  assert.equal(periodFigures([], [van], ALL_TIME, NOW).expensesPence, 32000);
  assert.deepEqual(periodFigures([], [van], ALL_TIME, NOW).expensesByCategory.VEHICLE, 32000);
});

// --- Retainers ----------------------------------------------------------------

test("a retainer adds its monthly amount in every active month only", () => {
  const retainer = job({ isRetainer: true, retainerMonthlyPence: 25000, retainerStart: "2026-07", retainerEnd: "2026-09" });
  assert.deepEqual(retainerMonths(retainer, NOW), ["2026-07", "2026-08", "2026-09"]);
  assert.equal(periodFigures([retainer], [], "2026-06", NOW).retainerRevenuePence, 0);
  assert.equal(periodFigures([retainer], [], "2026-08", NOW).retainerRevenuePence, 25000);
  assert.equal(periodFigures([retainer], [], "2026-10", NOW).retainerRevenuePence, 0);
  assert.equal(periodFigures([retainer], [], ALL_TIME, NOW).revenuePence, 75000);

  const ongoing = job({ isRetainer: true, retainerMonthlyPence: 10000, retainerStart: "2026-09" });
  assert.equal(periodFigures([ongoing], [], ALL_TIME, NOW).retainerRevenuePence, 20000, "September and October, not November");

  // Only while the lead is Won or Completed, and only while it is a retainer.
  assert.equal(periodFigures([{ ...retainer, stage: "LOST" }], [], ALL_TIME, NOW).revenuePence, 0);
  assert.equal(periodFigures([{ ...retainer, stage: "COMPLETED" }], [], ALL_TIME, NOW).revenuePence, 75000);
  assert.equal(periodFigures([{ ...retainer, isRetainer: false }], [], ALL_TIME, NOW).revenuePence, 0);
});

test("a retainer's setup fee still counts in its won month, with the monthly amount from its start", () => {
  const client = job({
    wonAt: "2026-07-10T10:00:00.000Z",
    paidPence: 50000,
    costs: [cost(12000)],
    isRetainer: true,
    retainerMonthlyPence: 20000,
    retainerStart: "2026-08",
  });
  const july = periodFigures([client], [], "2026-07", NOW);
  assert.equal(july.jobRevenuePence, 50000);
  assert.equal(july.retainerRevenuePence, 0);
  assert.equal(july.jobCostsPence, 12000);
  assert.equal(periodFigures([client], [], "2026-08", NOW).revenuePence, 20000);
  assert.equal(periodFigures([client], [], "2026-08", NOW).jobCostsPence, 0, "job costs stay with the won month");
  assert.equal(periodFigures([client], [], ALL_TIME, NOW).revenuePence, 50000 + 3 * 20000);
});

test("active retainers and the total monthly recurring revenue", () => {
  const a = job({ name: "Ann", isRetainer: true, retainerMonthlyPence: 30000, retainerStart: "2026-01" });
  const b = job({ name: "Ben", isRetainer: true, retainerMonthlyPence: 15000, retainerStart: "2026-09", retainerEnd: "2026-12" });
  const ended = job({ name: "Cal", isRetainer: true, retainerMonthlyPence: 50000, retainerStart: "2026-01", retainerEnd: "2026-09" });
  const future = job({ name: "Dee", isRetainer: true, retainerMonthlyPence: 50000, retainerStart: "2026-11" });
  const result = activeRetainers([b, ended, future, a], NOW);
  assert.deepEqual(result.list.map((r) => r.name), ["Ann", "Ben"]);
  assert.equal(result.monthlyPence, 45000);
});

// --- Net profit and margins ---------------------------------------------------

test("net profit and both margins, in pence, including a month with no revenue and a loss month", () => {
  const jobs = [
    job({ wonAt: "2026-08-12T10:00:00.000Z", paidPence: 100000, costs: [cost(30000), cost(10000, "PRINTING")] }),
    job({ wonAt: "2026-10-02T10:00:00.000Z", paidPence: 20000, costs: [cost(15000)] }),
  ];
  const expenses = [
    expense({ kind: "ONE_OFF", date: "2026-08-20", amountPence: 15000 }),
    expense({ kind: "ONE_OFF", date: "2026-09-03", amountPence: 5000 }),
    expense({ kind: "ONE_OFF", date: "2026-10-05", amountPence: 10000 }),
  ];

  const aug = periodFigures(jobs, expenses, "2026-08", NOW);
  assert.equal(aug.revenuePence, 100000);
  assert.equal(aug.jobCostsPence, 40000);
  assert.equal(aug.jobProfitPence, 60000);
  assert.equal(aug.expensesPence, 15000);
  assert.equal(aug.netProfitPence, 45000);
  assert.equal(aug.jobMarginPct, 60);
  assert.equal(aug.netMarginPct, 45);
  assert.deepEqual(aug.costGroups, { distributors: 30000, printing: 10000, design: 0, additional: 0 });

  // Nothing paid in September: a loss of the expenses, and no margin at all.
  const sep = periodFigures(jobs, expenses, "2026-09", NOW);
  assert.equal(sep.revenuePence, 0);
  assert.equal(sep.netProfitPence, -5000);
  assert.equal(sep.jobMarginPct, null);
  assert.equal(sep.netMarginPct, null);

  // October: a job profit, but a net loss once expenses are taken off.
  const oct = periodFigures(jobs, expenses, "2026-10", NOW);
  assert.equal(oct.jobProfitPence, 5000);
  assert.equal(oct.netProfitPence, -5000);
  assert.equal(oct.jobMarginPct, 25);
  assert.equal(oct.netMarginPct, -25);

  const all = periodFigures(jobs, expenses, ALL_TIME, NOW);
  assert.equal(all.netProfitPence, 45000 - 5000 - 5000);
});

test("All time and the month rows never include future months", () => {
  const jobs = [job({ wonAt: "2026-09-01T10:00:00.000Z", paidPence: 10000, isRetainer: true, retainerMonthlyPence: 1000, retainerStart: "2026-09" })];
  const expenses = [
    expense({ kind: "ONE_OFF", date: "2026-11-02", amountPence: 99900 }),
    expense({ kind: "MONTHLY", startMonth: "2026-09", amountPence: 500 }),
  ];
  const all = periodFigures(jobs, expenses, ALL_TIME, NOW);
  assert.equal(all.expensesPence, 1000, "September and October of the monthly one, not November's one-off");
  assert.equal(all.retainerRevenuePence, 2000);
  const rows = monthlyRows(jobs, expenses, NOW);
  assert.deepEqual(rows.map((r) => r.month), ["2026-10", "2026-09"]);
  assert.deepEqual(expensesForPeriod(expenses, "2026-11", NOW), []);
});

test("month rows: newest first, quiet months included, adding up to All time", () => {
  const jobs = [
    job({ wonAt: "2026-06-15T10:00:00.000Z", paidPence: 40000, costs: [cost(10000)] }),
    job({ wonAt: "2026-09-15T10:00:00.000Z", paidPence: 30000 }),
  ];
  const expenses = [expense({ kind: "MONTHLY", startMonth: "2026-07", amountPence: 2000 })];
  const rows = monthlyRows(jobs, expenses, NOW);
  assert.deepEqual(rows.map((r) => r.month), ["2026-10", "2026-09", "2026-08", "2026-07", "2026-06"]);
  const total = periodFigures(jobs, expenses, ALL_TIME, NOW);
  assert.equal(rows.reduce((s, r) => s + r.netProfitPence, 0), total.netProfitPence);
  assert.equal(rows.reduce((s, r) => s + r.revenuePence, 0), total.revenuePence);
  assert.equal(addMonths("2026-12", 1), "2027-01");
  assert.equal(addMonths("2027-01", -1), "2026-12");
});

// --- UK months ----------------------------------------------------------------

test("UK month boundaries: an expense just after midnight on the 1st in UK time is that month's", () => {
  // 00:30 on 1 August in British Summer Time is still 31 July in UTC.
  const justAfterMidnight = new Date("2026-07-31T23:30:00Z");
  assert.equal(ukToday(justAfterMidnight), "2026-08-01");
  const fuelCard = expense({ kind: "ONE_OFF", date: ukToday(justAfterMidnight), amountPence: 6000 });
  assert.equal(periodFigures([], [fuelCard], "2026-08", NOW).expensesPence, 6000);
  assert.equal(periodFigures([], [fuelCard], "2026-07", NOW).expensesPence, 0);
  // In winter UK time is UTC, so 23:30 on 31 December is still December.
  assert.equal(ukToday(new Date("2026-12-31T23:30:00Z")), "2026-12-31");
  // Stored as a DATE and read back, the day never shifts.
  assert.equal(dbDateToInput(dateInputToDb("2026-08-01")), "2026-08-01");
  assert.equal(dbMonthToInput(monthInputToDb("2026-08")), "2026-08");
  // Jobs use the same UK months: won at 00:30 on 1 August BST is an August job.
  const won = job({ wonAt: "2026-07-31T23:30:00.000Z", paidPence: 1000 });
  assert.equal(periodFigures([won], [], "2026-08", NOW).revenuePence, 1000);
});

// --- What the forms send ------------------------------------------------------

test("expense input: required fields, kinds, and an end month not before the start", () => {
  const ok = validateExpenseInput({ label: " Office rent ", category: "OFFICE", amount: "450", kind: "MONTHLY", startMonth: "2026-06", endMonth: "" });
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.data.label, "Office rent");
    assert.equal(ok.data.amountPence, 45000);
    assert.equal(ok.data.startMonth?.toISOString(), "2026-06-01T00:00:00.000Z");
    assert.equal(ok.data.endMonth, null);
    assert.equal(ok.data.date, null);
  }
  const oneOff = validateExpenseInput({ label: "Printer", category: "EQUIPMENT", amount: "199.99", kind: "ONE_OFF", date: "2026-09-03" });
  assert.equal(oneOff.ok && oneOff.data.date?.toISOString(), "2026-09-03T00:00:00.000Z");
  for (const bad of [
    { category: "OFFICE", amount: "1", kind: "ONE_OFF", date: "2026-09-03" },
    { label: "x", category: "TRAVEL", amount: "1", kind: "ONE_OFF", date: "2026-09-03" },
    { label: "x", category: "OFFICE", amount: "0", kind: "ONE_OFF", date: "2026-09-03" },
    { label: "x", category: "OFFICE", amount: "-5", kind: "ONE_OFF", date: "2026-09-03" },
    { label: "x", category: "OFFICE", amount: "5", kind: "ONE_OFF", date: "2026-02-30" },
    { label: "x", category: "OFFICE", amount: "5", kind: "MONTHLY", startMonth: "2026-13" },
    { label: "x", category: "OFFICE", amount: "5", kind: "MONTHLY", startMonth: "2026-08", endMonth: "2026-07" },
    { label: "x", category: "OFFICE", amount: "5", kind: "WEEKLY" },
  ]) {
    assert.equal(validateExpenseInput(bad).ok, false, JSON.stringify(bad));
  }
});

test("retainer input: amount and start needed, end optional and not before the start", () => {
  const on = validateRetainerInput({ isRetainer: true, monthly: "250", startMonth: "2026-08", endMonth: "" });
  assert.deepEqual(on.ok && on.data, {
    isRetainer: true,
    retainerMonthlyPence: 25000,
    retainerStart: new Date("2026-08-01T00:00:00.000Z"),
    retainerEnd: null,
  });
  assert.deepEqual(validateRetainerInput({ isRetainer: false }), { ok: true, data: { isRetainer: false } });
  assert.equal(validateRetainerInput({ isRetainer: true, monthly: "", startMonth: "2026-08" }).ok, false);
  assert.equal(validateRetainerInput({ isRetainer: true, monthly: "250" }).ok, false);
  assert.equal(validateRetainerInput({ isRetainer: true, monthly: "250", startMonth: "2026-08", endMonth: "2026-07" }).ok, false);
});
