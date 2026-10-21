import { prisma } from "@/lib/prisma";
import { loadPriorityList } from "@/lib/priorities-data";
import { sharedDashboard } from "@/lib/dashboard-data";
import { requestChangeId } from "@/lib/crm-change-server";
import { parsePeriod, ukDay } from "@/lib/dashboard";
import TopPriorities from "@/components/crm/TopPriorities";
import DashboardMoney from "@/components/crm/DashboardMoney";
import DashboardPeriodControl from "@/components/crm/DashboardPeriodControl";
import DashboardBusinessControl from "@/components/crm/DashboardBusinessControl";
import { ColdOutreach, SalesPipeline, Upcoming } from "@/components/crm/DashboardPanels";
import { parseBusinessFilter, SHARED_COSTS_NOTE } from "@/lib/business";

export const dynamic = "force-dynamic";

// The Dashboard, in order of importance: Money and Top priorities, then
// Sales pipeline and Upcoming, all above the fold on a laptop; Cold outreach
// sits collapsed below. The period (All time, Last 30 days or a custom
// range) and the business (All, FDH or LDB) come from the address.
export default async function CrmDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    period?: string | string[];
    from?: string | string[];
    to?: string | string[];
    business?: string | string[];
  }>;
}) {
  const now = new Date();
  const params = await searchParams;
  const period = parsePeriod(params, ukDay(now));
  const business = parseBusinessFilter(params.business);
  // Both shared for a minute, and worked out afresh after your own change.
  const changeId = await requestChangeId();
  const [data, priorities] = await Promise.all([
    sharedDashboard(prisma, period, now, business, changeId),
    loadPriorityList({ withEmail: false, changeId }),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-blue-900">Dashboard</h1>
        <div className="flex flex-wrap items-center gap-3">
          <DashboardBusinessControl period={period} business={business} />
          <DashboardPeriodControl period={period} today={data.today} business={business} />
        </div>
      </div>
      {business !== "ALL" && <p className="-mt-2 text-right text-xs text-gray-500">{SHARED_COSTS_NOTE}</p>}

      <div className="grid gap-4 lg:grid-cols-12">
        <DashboardMoney data={data} period={period} business={business} className="min-w-0 lg:col-span-7" />
        <TopPriorities initial={priorities} business={business} className="min-w-0 lg:col-span-5" />
        <SalesPipeline pipeline={data.pipeline} period={period} business={business} className="min-w-0 lg:col-span-7" />
        <Upcoming campaigns={data.campaigns} events={data.events} className="min-w-0 lg:col-span-5" />
      </div>

      <ColdOutreach cold={data.cold} />
    </div>
  );
}
