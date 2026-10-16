import { prisma } from "@/lib/prisma";
import ProfitTabs, { type ProfitTab } from "@/components/crm/ProfitTabs";
import { ALL_TIME, isMonthKey, monthKeyLondon } from "@/lib/profit";
import { parseBusinessFilter } from "@/lib/business";
import {
  EXPENSE_ORDER,
  PROFIT_LEAD_ORDER,
  PROFIT_LEAD_SELECT,
  PROFIT_LEAD_WHERE,
  toExpenseRecord,
  toProfitJob,
} from "@/lib/profit-data";

export const dynamic = "force-dynamic";

// Every lead in Won or Completed, read straight from the leads table, and
// every business expense. The tab, month and business come from the address
// so Refresh and the back button keep them; with none given the page opens
// on the Overview for All time and both businesses. A future month is never
// shown.
export default async function ProfitPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string | string[]; tab?: string | string[]; business?: string | string[] }>;
}) {
  const params = await searchParams;
  const currentMonth = monthKeyLondon(new Date());
  const requested = typeof params.month === "string" ? params.month : "";
  const month = isMonthKey(requested) && requested <= currentMonth ? requested : ALL_TIME;
  const tab: ProfitTab = params.tab === "jobs" || params.tab === "expenses" ? params.tab : "overview";

  const [leads, distributors, expenses] = await Promise.all([
    prisma.lead.findMany({ where: PROFIT_LEAD_WHERE, select: PROFIT_LEAD_SELECT, orderBy: PROFIT_LEAD_ORDER }),
    prisma.distributor.findMany({
      orderBy: [{ active: "desc" }, { name: "asc" }],
      select: { id: true, name: true, active: true },
    }),
    prisma.expense.findMany({ orderBy: EXPENSE_ORDER }),
  ]);

  return (
    <ProfitTabs
      jobs={leads.map(toProfitJob)}
      expenses={expenses.map(toExpenseRecord)}
      distributors={distributors}
      initialMonth={month}
      initialTab={tab}
      initialBusiness={parseBusinessFilter(params.business)}
      currentMonth={currentMonth}
    />
  );
}
