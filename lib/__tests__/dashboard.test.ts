import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ALL_PERIOD,
  chartData,
  chartMonths,
  coldOutreachFigures,
  coldOutreachInMoney,
  moneyChange,
  moneyFigures,
  moneyOwed,
  parsePeriod,
  periodLabel,
  periodSearch,
  pipelineFigures,
  previousPeriod,
  rangeFigures,
  upcomingCampaigns,
  upcomingEvents,
  type DashboardLead,
  type DashboardPeriod,
} from "@/lib/dashboard";
import { periodFigures } from "@/lib/profit-overview";
import { ALL_TIME, type CostLine, type ProfitJob } from "@/lib/profit";
import type { ExpenseRecord } from "@/lib/expenses";

// 11:00 in the UK on Sunday 11 October 2026.
const NOW = new Date("2026-10-11T10:00:00.000Z");
const TODAY = "2026-10-11";
const MONTH = "2026-10";

function cost(amountPence: number): CostLine {
  return {
    id: `c-${amountPence}`,
    category: "DISTRIBUTOR",
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

function job(o: Partial<ProfitJob> & Pick<ProfitJob, "leadId">): ProfitJob {
  return {
    name: o.leadId,
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

function expense(o: Partial<ExpenseRecord> & Pick<ExpenseRecord, "id" | "amountPence">): ExpenseRecord {
  return { label: o.id, category: "OFFICE", kind: "ONE_OFF", date: null, startMonth: null, endMonth: null, note: null, createdAt: "2026-01-01T00:00:00.000Z", ...o };
}

// The Profit page's jobs: Won and Completed leads.
const JOBS: ProfitJob[] = [
  job({ leadId: "w1", stage: "WON", wonAt: "2026-10-05T10:00:00.000Z", dealPence: 100000, paidPence: 60000, costs: [cost(20000)] }),
  job({ leadId: "r1", stage: "COMPLETED", wonAt: "2026-09-20T10:00:00.000Z", dealPence: 50000, paidPence: 50000, costs: [cost(30000)] }),
  job({ leadId: "w2", stage: "COMPLETED", wonAt: "2026-08-20T10:00:00.000Z", dealPence: 80000, paidPence: 80000, costs: [cost(10000)] }),
  // Won from cold outreach.
  job({ leadId: "c1", stage: "WON", wonAt: "2026-09-25T10:00:00.000Z", dealPence: 30000, paidPence: 10000, costs: [cost(5000)] }),
  // A retainer of £250 a month from September.
  job({ leadId: "r2", stage: "WON", wonAt: "2026-06-10T10:00:00.000Z", paidPence: 0, isRetainer: true, retainerMonthlyPence: 25000, retainerStart: "2026-09" }),
  // No won date: All time only.
  job({ leadId: "o1", stage: "WON", wonAt: null, paidPence: 5000 }),
];

const EXPENSES: ExpenseRecord[] = [
  expense({ id: "rent", amountPence: 45000, kind: "MONTHLY", startMonth: "2026-06" }),
  expense({ id: "van", amountPence: 10000, date: "2026-09-15" }),
  expense({ id: "stand", amountPence: 3000, date: "2026-08-30" }),
];

function lead(id: string, source: string, stage: string, createdAt: string, wonAt: string | null = null, dealPence: number | null = null): DashboardLead {
  return { id, source, stage, createdAt: `${createdAt}T09:00:00.000Z`, wonAt, dealPence };
}

const LEADS: DashboardLead[] = [
  lead("w1", "WEBSITE_QUOTE_FORM", "WON", "2026-09-28", "2026-10-05T10:00:00.000Z", 100000),
  lead("w2", "WEBSITE_QUOTE_FORM", "COMPLETED", "2026-08-10", "2026-08-20T10:00:00.000Z", 80000),
  lead("w3", "WEBSITE_QUOTE_FORM", "LOST", "2026-09-15"),
  lead("w4", "WEBSITE_QUOTE_FORM", "UNCONTACTED", "2026-10-10"),
  lead("w5", "WEBSITE_QUOTE_FORM", "AWAITING_RESPONSE", "2026-07-03"),
  lead("r1", "REFERRAL", "COMPLETED", "2026-09-01", "2026-09-20T10:00:00.000Z", 50000),
  lead("r2", "REFERRAL", "WON", "2026-06-01", "2026-06-10T10:00:00.000Z", null),
  lead("o1", "OTHER", "WON", "2026-05-01", null, 5000),
  lead("c1", "COLD_OUTREACH", "WON", "2026-09-14", "2026-09-25T10:00:00.000Z", 30000),
  lead("c2", "COLD_OUTREACH", "LOST", "2026-09-20"),
  lead("c3", "COLD_OUTREACH", "UNCONTACTED", "2026-10-01"),
  lead("c4", "COLD_OUTREACH", "AWAITING_RESPONSE", "2026-09-30"),
];

const LAST30 = parsePeriod({ period: "30d" }, TODAY);
const CUSTOM = parsePeriod({ from: "2026-09-21", to: "2026-10-04" }, TODAY);
const SEPTEMBER = parsePeriod({ from: "2026-09-01", to: "2026-09-30" }, TODAY);

// --- The period ---------------------------------------------------------------------------

test("the period comes from the address: All time by default, Last 30 days, or a custom range", () => {
  assert.deepEqual(parsePeriod({}, TODAY), ALL_PERIOD);
  assert.deepEqual(LAST30, { kind: "last30", from: "2026-09-12", to: "2026-10-11" });
  assert.deepEqual(CUSTOM, { kind: "custom", from: "2026-09-21", to: "2026-10-04" });
  // A range can't run past today.
  assert.deepEqual(parsePeriod({ from: "2026-10-01", to: "2026-12-31" }, TODAY), { kind: "custom", from: "2026-10-01", to: TODAY });
  // Anything unusable is All time.
  for (const bad of [
    { from: "2026-09-30", to: "2026-09-01" },
    { from: "2026-02-30", to: "2026-03-01" },
    { from: "2026-10-12", to: "2026-10-20" },
    { from: "2026-09-01" },
    { from: ["2026-09-01"], to: "2026-09-30" },
    { period: "7d" },
  ]) {
    assert.deepEqual(parsePeriod(bad, TODAY), ALL_PERIOD, JSON.stringify(bad));
  }
  assert.equal(periodSearch(ALL_PERIOD), "");
  assert.equal(periodSearch(LAST30), "?period=30d");
  assert.equal(periodSearch(CUSTOM), "?from=2026-09-21&to=2026-10-04");
  assert.equal(periodLabel(ALL_PERIOD), "All time");
  assert.equal(periodLabel(LAST30), "Last 30 days");
  assert.match(periodLabel(SEPTEMBER), /^1 Sept? to 30 Sept? 2026$/);
});

test("the previous period is the same number of days straight before", () => {
  assert.equal(previousPeriod(ALL_PERIOD), null);
  assert.deepEqual(previousPeriod(LAST30), { from: "2026-08-13", to: "2026-09-11" });
  assert.deepEqual(previousPeriod(SEPTEMBER), { from: "2026-08-02", to: "2026-08-31" });
  assert.deepEqual(previousPeriod(CUSTOM), { from: "2026-09-07", to: "2026-09-20" });
});

// --- Money ----------------------------------------------------------------------------------

function money(period: DashboardPeriod) {
  const f = moneyFigures(JOBS, EXPENSES, period, MONTH);
  return { revenue: f.revenuePence, costs: f.jobCostsPence, expenses: f.expensesPence, net: f.netProfitPence, margin: f.netMarginPct === null ? null : Number(f.netMarginPct.toFixed(2)) };
}

test("money for All time, Last 30 days and a custom range", () => {
  // All time: every job (the undated one too), 2 retainer months, 5 months of rent.
  assert.deepEqual(money(ALL_PERIOD), { revenue: 205000 + 50000, costs: 65000, expenses: 225000 + 13000, net: -48000, margin: -18.82 });
  // 12 Sep to 11 Oct: three jobs won, the retainer and rent for October
  // (counted on the 1st), and the van on 15 Sep.
  assert.deepEqual(money(LAST30), { revenue: 120000 + 25000, costs: 55000, expenses: 45000 + 10000, net: 35000, margin: 24.14 });
  // 21 Sep to 4 Oct: one job, October's retainer and rent.
  assert.deepEqual(money(CUSTOM), { revenue: 10000 + 25000, costs: 5000, expenses: 45000, net: -15000, margin: -42.86 });
});

test("the Dashboard's money equals the Profit page for the same period", () => {
  assert.deepEqual(moneyFigures(JOBS, EXPENSES, ALL_PERIOD, MONTH), periodFigures(JOBS, EXPENSES, ALL_TIME, MONTH));
  for (const [month, from, to] of [
    ["2026-06", "2026-06-01", "2026-06-30"],
    ["2026-07", "2026-07-01", "2026-07-31"],
    ["2026-08", "2026-08-01", "2026-08-31"],
    ["2026-09", "2026-09-01", "2026-09-30"],
  ]) {
    assert.deepEqual(rangeFigures(JOBS, EXPENSES, { from, to }, MONTH), periodFigures(JOBS, EXPENSES, month, MONTH), month);
  }
  // A range covering several whole months is their sum.
  const summer = rangeFigures(JOBS, EXPENSES, { from: "2026-07-01", to: "2026-09-30" }, MONTH);
  const months = ["2026-07", "2026-08", "2026-09"].map((m) => periodFigures(JOBS, EXPENSES, m, MONTH));
  assert.equal(summer.revenuePence, months.reduce((s, f) => s + f.revenuePence, 0));
  assert.equal(summer.netProfitPence, months.reduce((s, f) => s + f.netProfitPence, 0));
});

test("the change against the previous period", () => {
  assert.equal(moneyChange(JOBS, EXPENSES, ALL_PERIOD, MONTH), null);
  const last30 = moneyChange(JOBS, EXPENSES, LAST30, MONTH)!;
  // Previous 13 Aug to 11 Sep: one job (£800, £100 costs), September's
  // retainer and rent, the stand on 30 Aug: revenue £1,050, net £470.
  assert.deepEqual(last30.previous, { from: "2026-08-13", to: "2026-09-11" });
  assert.equal(last30.change.revenuePence, 145000 - 105000);
  assert.equal(last30.change.netProfitPence, 35000 - 47000);
  assert.equal(Number(last30.change.netMarginPts!.toFixed(2)), Number(((35000 / 145000 - 47000 / 105000) * 100).toFixed(2)));
  // No margin in the previous period (nothing paid): no margin change.
  const quiet = moneyChange(JOBS, EXPENSES, parsePeriod({ from: "2026-07-01", to: "2026-07-10" }, TODAY), MONTH)!;
  assert.equal(quiet.change.netMarginPts, null);
});

test("money owed is deal value minus amount paid on Won and Completed jobs, now", () => {
  // w1 owes £400, c1 £200; the rest are paid in full or have no deal value.
  assert.deepEqual(moneyOwed(JOBS), { owedPence: 60000, jobsOwing: 2 });
  assert.deepEqual(
    moneyOwed([
      job({ leadId: "a", dealPence: 50000, paidPence: 60000 }),
      job({ leadId: "b", dealPence: 50000, paidPence: null }),
      job({ leadId: "c", dealPence: null, paidPence: 0 }),
      job({ leadId: "d", stage: "LOST", dealPence: 90000, paidPence: 0 }),
    ]),
    { owedPence: 50000, jobsOwing: 1 },
    "overpaid owes nothing, unpaid owes all of it, no deal value and not Won are left out"
  );
});

// --- Sales pipeline ---------------------------------------------------------------------------

test("sales pipeline for All time, Last 30 days and a custom range, cold outreach left out", () => {
  const all = pipelineFigures(LEADS, ALL_PERIOD);
  assert.equal(all.newEnquiries, 5);
  assert.deepEqual(all.stageCounts, { UNCONTACTED: 1, AWAITING_RESPONSE: 1, WON: 3, COMPLETED: 2, LOST: 1 });
  // (3 + 2) / (3 + 2 + 1)
  assert.equal(all.winRatePct!.toFixed(2), "83.33");
  // Deal values £1,000, £800, £500 and £50; r2 has none.
  assert.deepEqual([all.avgJobPence, all.avgBasedOn], [58750, 4]);

  const last30 = pipelineFigures(LEADS, LAST30);
  assert.equal(last30.newEnquiries, 3);
  assert.deepEqual(last30.stageCounts, { UNCONTACTED: 1, AWAITING_RESPONSE: 0, WON: 1, COMPLETED: 0, LOST: 1 });
  assert.equal(last30.winRatePct, 50);
  // Won in the period: w1 (£1,000) and r1 (£500).
  assert.deepEqual([last30.avgJobPence, last30.avgBasedOn], [75000, 2]);

  const custom = pipelineFigures(LEADS, CUSTOM);
  assert.equal(custom.newEnquiries, 1);
  assert.equal(custom.winRatePct, 100);
  assert.deepEqual([custom.avgJobPence, custom.avgBasedOn], [null, 0], "nothing won in it, so -");

  // No decided leads: no win rate.
  assert.equal(pipelineFigures(LEADS, parsePeriod({ from: "2026-10-09", to: "2026-10-11" }, TODAY)).winRatePct, null);
});

test("win rate and average job value maths", () => {
  const leads = [
    lead("a", "REFERRAL", "WON", "2026-09-01", "2026-09-02T10:00:00.000Z", 12345),
    lead("b", "REFERRAL", "COMPLETED", "2026-09-01", "2026-09-03T10:00:00.000Z", 10000),
    lead("c", "REFERRAL", "LOST", "2026-09-01"),
    lead("d", "REFERRAL", "LOST", "2026-09-01"),
    lead("e", "REFERRAL", "LOST", "2026-09-01"),
    lead("f", "REFERRAL", "AWAITING_RESPONSE", "2026-09-01"),
  ];
  const p = pipelineFigures(leads, ALL_PERIOD);
  assert.equal(p.winRatePct, 40, "2 / (2 + 3); Awaiting doesn't count");
  assert.deepEqual([p.avgJobPence, p.avgBasedOn], [11173, 2], "(12345 + 10000) / 2, rounded to the penny");
});

test("cold outreach is left out of every lead figure above the fold", () => {
  const without = LEADS.filter((l) => l.source !== "COLD_OUTREACH");
  for (const period of [ALL_PERIOD, LAST30, CUSTOM]) {
    assert.deepEqual(pipelineFigures(LEADS, period), pipelineFigures(without, period));
  }
  const months = chartMonths(ALL_PERIOD, LEADS, JOBS, EXPENSES, MONTH);
  const withCold = chartData(months, LEADS, JOBS, EXPENSES, MONTH);
  const noCold = chartData(months, without, JOBS, EXPENSES, MONTH);
  assert.deepEqual(withCold.enquiries, noCold.enquiries);
  assert.deepEqual(withCold.won, noCold.won);
  // Money matches the Profit page, which includes the won cold outreach
  // job, and the card says so.
  assert.equal(coldOutreachInMoney(JOBS, new Set(["c1", "c2", "c3", "c4"]), ALL_PERIOD, MONTH), 1);
  assert.equal(coldOutreachInMoney(JOBS, new Set(["c1"]), LAST30, MONTH), 1);
  assert.equal(coldOutreachInMoney(JOBS, new Set(["c1"]), parsePeriod({ from: "2026-10-01", to: TODAY }, TODAY), MONTH), 0);
});

// --- The chart --------------------------------------------------------------------------------

test("chart data for each toggle, month by month, with a loss month below the line", () => {
  const months = chartMonths(ALL_PERIOD, LEADS, JOBS, EXPENSES, MONTH);
  assert.deepEqual(months, ["2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]);
  const data = chartData(months, LEADS, JOBS, EXPENSES, MONTH);
  const values = (s: keyof typeof data) => data[s].map((p) => p.value);
  // Website enquiries by the month they came in.
  assert.deepEqual(values("enquiries"), [0, 1, 1, 2, 1]);
  // Jobs won by won date (r2, w2, r1, w1; c1 is cold outreach).
  assert.deepEqual(values("won"), [1, 0, 1, 1, 1]);
  assert.deepEqual(values("revenue"), [0, 0, 80000, 85000, 85000]);
  // June and July are rent only; September is a loss after the van.
  assert.deepEqual(values("net"), [-45000, -45000, 22000, -5000, 20000]);
  // Each money bar is the Profit page's month.
  for (const p of data.net) assert.equal(p.value, periodFigures(JOBS, EXPENSES, p.month, MONTH).netProfitPence);

  // A range shows every month it touches.
  assert.deepEqual(chartMonths(LAST30, LEADS, JOBS, EXPENSES, MONTH), ["2026-09", "2026-10"]);
  assert.deepEqual(chartMonths(SEPTEMBER, LEADS, JOBS, EXPENSES, MONTH), ["2026-09"]);
});

// --- Cold outreach and Upcoming ----------------------------------------------------------------

test("the cold outreach section counts cold leads and who was called in the last 7 days", () => {
  const calls = [
    { leadId: "c3", createdAt: "2026-10-09T10:00:00.000Z" },
    { leadId: "c3", createdAt: "2026-10-09T11:00:00.000Z" },
    { leadId: "c2", createdAt: "2026-10-05T10:00:00.000Z" },
    // 9 days ago.
    { leadId: "c4", createdAt: "2026-10-02T10:00:00.000Z" },
    // Not a cold lead.
    { leadId: "w4", createdAt: "2026-10-10T10:00:00.000Z" },
  ];
  assert.deepEqual(coldOutreachFigures(LEADS, calls, NOW), { total: 4, uncontacted: 1, calledLast7Days: 2, awaitingResponse: 1, won: 1 });
});

test("upcoming: campaigns from today to 14 days on, calendar entries for the next 7 days", () => {
  const campaigns = [
    { start: "2026-10-25T00:00:00.000Z", name: "in 14 days" },
    { start: "2026-10-11T00:00:00.000Z", name: "today" },
    { start: "2026-10-26T00:00:00.000Z", name: "in 15 days" },
    { start: "2026-10-10T00:00:00.000Z", name: "yesterday" },
  ];
  assert.deepEqual(upcomingCampaigns(campaigns, TODAY).map((c) => c.name), ["today", "in 14 days"]);
  const events = [
    { start: "2026-10-17T20:00:00.000Z", name: "Sat 17th, 21:00" },
    { start: "2026-10-17T23:30:00.000Z", name: "Sun 18th, 00:30" },
    { start: "2026-10-11T08:00:00.000Z", name: "this morning" },
    { start: "2026-10-10T08:00:00.000Z", name: "yesterday" },
  ];
  assert.deepEqual(upcomingEvents(events, TODAY).map((e) => e.name), ["this morning", "Sat 17th, 21:00"]);
});
