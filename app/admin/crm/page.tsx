import Link from "next/link";
import { getLeadsWithLastActivity } from "@/lib/crm-data";
import { computeDashboardStats, getLastInteracted, STAGE_LABELS } from "@/lib/crm-constants";

export const dynamic = "force-dynamic";

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);
}

function daysAgo(date: Date) {
  const days = Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000));
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export default async function CrmDashboardPage() {
  const leads = await getLeadsWithLastActivity();
  const stats = computeDashboardStats(leads);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-blue-900">Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Open Pipeline Value</p>
          <p className="text-2xl font-bold text-blue-900">{formatCurrency(stats.pipelineValue)}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Total Leads</p>
          <p className="text-2xl font-bold text-blue-900">{stats.totalLeads}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Conversion Rate</p>
          <p className="text-2xl font-bold text-blue-900">
            {(stats.conversionRate * 100).toFixed(0)}%
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5">Won ÷ (Won + Lost)</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Stale Leads (5+ days)</p>
          <p className="text-2xl font-bold text-red-600">{stats.staleLeads.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(STAGE_LABELS).map(([stage, label]) => (
          <div key={stage} className="bg-white rounded-lg border border-gray-200 p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className="text-xl font-bold text-blue-900">{stats.stageCounts[stage] ?? 0}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-sm font-bold text-blue-900">Stale Leads (oldest first)</h2>
          <Link href="/admin/crm/leads" className="text-xs text-blue-700 hover:underline">
            View all leads
          </Link>
        </div>
        {stats.staleLeads.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-500">No stale leads right now.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {stats.staleLeads.map((lead) => (
              <li key={lead.id}>
                <Link
                  href={`/admin/crm/leads/${lead.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-blue-900 truncate">{lead.name}</p>
                    <p className="text-xs text-gray-500">{STAGE_LABELS[lead.stage]}</p>
                  </div>
                  <span className="text-xs text-red-600 font-medium shrink-0 ml-3">
                    {daysAgo(getLastInteracted(lead))}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
