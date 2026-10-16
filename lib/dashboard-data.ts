import type { PrismaClient } from "@/generated/prisma/client";
import { decimalToPence } from "./money";
import { monthKeyLondon, type ProfitJob } from "./profit";
import type { ExpenseRecord } from "./expenses";
import { EXPENSE_ORDER, PROFIT_LEAD_ORDER, PROFIT_LEAD_SELECT, PROFIT_LEAD_WHERE, toExpenseRecord, toProfitJob } from "./profit-data";
import { filterExpensesByBusiness, leadBusinessWhere, type BusinessFilter } from "./business";
import { QUERY_CONCURRENCY, runLimited } from "./run-limited";
import {
  addDays,
  chartData,
  chartMonths,
  COLD_OUTREACH,
  coldOutreachFigures,
  coldOutreachInMoney,
  moneyChange,
  moneyFigures,
  moneyOwed,
  pipelineFigures,
  ukDay,
  upcomingCampaigns,
  upcomingEvents,
  type DashboardLead,
  type DashboardPeriod,
  type UpcomingCampaign,
  type UpcomingEvent,
} from "./dashboard";

// Everything the Dashboard shows except Priorities (which has its own
// loader), worked out on the server for the period and business in the
// address. Under a business filter every figure, chart and list is that
// business's alone, except that shared expenses count under both, and a
// calendar event with no lead shows under every filter. Takes the client as a
// parameter so a local-database test can run it too.

type DashboardDb = Pick<PrismaClient, "lead" | "expense" | "activity" | "job" | "calendarEvent">;

export async function loadDashboard(db: DashboardDb, period: DashboardPeriod, now: Date, business: BusinessFilter = "ALL") {
  const byBusiness = leadBusinessWhere(business);
  const today = ukDay(now);
  const currentMonth = monthKeyLondon(now);
  // Generous windows; the shared functions check the UK days.
  const windowStart = new Date(Date.parse(`${addDays(today, -1)}T00:00:00Z`));
  const campaignsEnd = new Date(Date.parse(`${addDays(today, 16)}T00:00:00Z`));
  const eventsEnd = new Date(Date.parse(`${addDays(today, 8)}T00:00:00Z`));
  const callsSince = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [jobRows, expenseRows, leadRows, calls, campaignRows, eventRows] = await runLimited(QUERY_CONCURRENCY, [
    () => db.lead.findMany({ where: { ...PROFIT_LEAD_WHERE, ...byBusiness }, select: PROFIT_LEAD_SELECT, orderBy: PROFIT_LEAD_ORDER }),
    () => db.expense.findMany({ orderBy: EXPENSE_ORDER }),
    () => db.lead.findMany({
      where: { scrapped: false, ...byBusiness },
      select: { id: true, source: true, stage: true, createdAt: true, wonAt: true, dealValue: true },
    }),
    () => db.activity.findMany({
      where: { type: "CALL", createdAt: { gte: callsSince }, lead: { source: COLD_OUTREACH, scrapped: false, ...byBusiness } },
      select: { leadId: true, createdAt: true },
    }),
    () => db.job.findMany({
      where: {
        campaignStartDate: { gte: windowStart, lte: campaignsEnd },
        lead: { scrapped: false, stage: { in: ["WON", "COMPLETED"] }, ...byBusiness },
      },
      select: {
        campaignStartDate: true,
        distributorName: true,
        distributor: { select: { name: true } },
        lead: {
          select: {
            id: true,
            name: true,
            businessName: true,
            costs: {
              where: { category: "DISTRIBUTOR", distributorId: { not: null } },
              select: { distributor: { select: { name: true } } },
            },
          },
        },
      },
    }),
    () => db.calendarEvent.findMany({
      where: {
        completed: false,
        startDateTime: { gte: windowStart, lte: eventsEnd },
        ...(business === "ALL" ? {} : { OR: [{ linkedLeadId: null }, { linkedLead: byBusiness }] }),
      },
      orderBy: { startDateTime: "asc" },
      select: { id: true, title: true, type: true, startDateTime: true, endDateTime: true, linkedLeadId: true },
    }),
  ]);

  const jobs: ProfitJob[] = jobRows.map(toProfitJob);
  const expenses: ExpenseRecord[] = filterExpensesByBusiness(expenseRows.map(toExpenseRecord), business);
  const leads: DashboardLead[] = leadRows.map((l) => ({
    id: l.id,
    source: l.source,
    stage: l.stage,
    createdAt: l.createdAt.toISOString(),
    wonAt: l.wonAt?.toISOString() ?? null,
    dealPence: decimalToPence(l.dealValue),
  }));
  const coldIds = new Set(leads.filter((l) => l.source === COLD_OUTREACH).map((l) => l.id));

  const campaigns: UpcomingCampaign[] = upcomingCampaigns(
    campaignRows.map((j) => {
      const paid = [...new Set(j.lead.costs.map((c) => c.distributor?.name).filter((n): n is string => !!n))];
      return {
        leadId: j.lead.id,
        name: j.lead.name,
        businessName: j.lead.businessName,
        start: j.campaignStartDate!.toISOString(),
        distributor: j.distributor?.name ?? (j.distributorName?.trim() || null) ?? (paid.length ? paid.join(", ") : null),
      };
    }),
    today
  );
  const events: UpcomingEvent[] = upcomingEvents(
    eventRows.map((e) => ({
      id: e.id,
      title: e.title,
      type: e.type,
      start: e.startDateTime.toISOString(),
      end: e.endDateTime?.toISOString() ?? null,
      leadId: e.linkedLeadId,
    })),
    today
  );

  const months = chartMonths(period, leads, jobs, expenses, currentMonth);
  return {
    today,
    currentMonth,
    money: moneyFigures(jobs, expenses, period, currentMonth),
    change: moneyChange(jobs, expenses, period, currentMonth),
    owed: moneyOwed(jobs),
    coldJobsInMoney: coldOutreachInMoney(jobs, coldIds, period, currentMonth),
    chart: chartData(months, leads, jobs, expenses, currentMonth),
    pipeline: pipelineFigures(leads, period),
    cold: coldOutreachFigures(
      leads,
      calls.map((c) => ({ leadId: c.leadId, createdAt: c.createdAt.toISOString() })),
      now
    ),
    campaigns,
    events,
  };
}

export type DashboardData = Awaited<ReturnType<typeof loadDashboard>>;
