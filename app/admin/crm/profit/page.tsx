import { prisma } from "@/lib/prisma";
import ProfitView from "@/components/crm/ProfitView";
import { ALL_TIME, isMonthKey, monthKeyLondon } from "@/lib/profit";
import { PROFIT_LEAD_ORDER, PROFIT_LEAD_SELECT, PROFIT_LEAD_WHERE, toProfitJob } from "@/lib/profit-data";

export const dynamic = "force-dynamic";

// Every lead in Won or Completed, read straight from the leads table. The
// month comes from the address so Refresh and the back button keep it; it
// defaults to the current UK month.
export default async function ProfitPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string | string[] }>;
}) {
  const params = await searchParams;
  const currentMonth = monthKeyLondon(new Date());
  const requested = typeof params.month === "string" ? params.month : "";
  const month = requested === ALL_TIME || isMonthKey(requested) ? requested : currentMonth;

  const [leads, distributors] = await Promise.all([
    prisma.lead.findMany({ where: PROFIT_LEAD_WHERE, select: PROFIT_LEAD_SELECT, orderBy: PROFIT_LEAD_ORDER }),
    prisma.distributor.findMany({
      orderBy: [{ active: "desc" }, { name: "asc" }],
      select: { id: true, name: true, active: true },
    }),
  ]);

  return (
    <ProfitView
      jobs={leads.map(toProfitJob)}
      distributors={distributors}
      initialMonth={month}
      currentMonth={currentMonth}
    />
  );
}
