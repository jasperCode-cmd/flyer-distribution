import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Every lead with a future nextCallableAt — not scoped to the dialer's own
// source/tag filter, this is a general utility view of everything pending,
// including leads currently locked to one user via the Call Back
// assignment mechanism (shown here so they're never invisible to the
// other person, just not callable by them yet).
export default async function ScheduledCallbacksPage() {
  const leads = await prisma.lead.findMany({
    where: { scrapped: false, nextCallableAt: { gt: new Date() } },
    select: {
      id: true,
      name: true,
      businessName: true,
      nextCallableAt: true,
      assignedTo: { select: { id: true, name: true } },
    },
    orderBy: { nextCallableAt: "asc" },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-blue-900">Scheduled Call Backs</h1>
      <div className="bg-white rounded-lg border border-gray-200">
        {leads.length === 0 ? (
          <p className="px-4 py-8 text-sm text-gray-400 text-center">Nothing scheduled.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {leads.map((l) => (
              <li key={l.id}>
                <Link
                  href={`/admin/crm/leads/${l.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-blue-900 truncate">{l.name}</p>
                    {l.businessName && <p className="text-xs text-gray-500 truncate">{l.businessName}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-medium text-gray-700">
                      {new Date(l.nextCallableAt!).toLocaleString("en-GB", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                    {l.assignedTo && (
                      <p className="text-[11px] text-blue-700 font-medium">Assigned: {l.assignedTo.name}</p>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
