import { prisma } from "@/lib/prisma";
import { loadPriorityList } from "@/lib/priorities-data";
import { loadDashboard } from "@/lib/dashboard-data";
import { parsePeriod, ukDay } from "@/lib/dashboard";
import TopPriorities from "@/components/crm/TopPriorities";
import DashboardMoney from "@/components/crm/DashboardMoney";
import DashboardPeriodControl from "@/components/crm/DashboardPeriodControl";
import { ColdOutreach, SalesPipeline, Upcoming } from "@/components/crm/DashboardPanels";

export const dynamic = "force-dynamic";

// The Dashboard, in order of importance: Money and Top priorities, then
// Sales pipeline and Upcoming, all above the fold on a laptop; Cold outreach
// sits collapsed below. The period (All time, Last 30 days or a custom
// range) comes from the address.
export default async function CrmDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string | string[]; from?: string | string[]; to?: string | string[] }>;
}) {
  const now = new Date();
  const period = parsePeriod(await searchParams, ukDay(now));
  const [data, priorities] = await Promise.all([
    loadDashboard(prisma, period, now),
    loadPriorityList({ withEmail: false }),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-blue-900">Dashboard</h1>
        <DashboardPeriodControl period={period} today={data.today} />
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <DashboardMoney data={data} period={period} className="min-w-0 lg:col-span-7" />
        <TopPriorities initial={priorities} className="min-w-0 lg:col-span-5" />
        <SalesPipeline pipeline={data.pipeline} period={period} className="min-w-0 lg:col-span-7" />
        <Upcoming campaigns={data.campaigns} events={data.events} className="min-w-0 lg:col-span-5" />
      </div>

      <ColdOutreach cold={data.cold} />
    </div>
  );
}
