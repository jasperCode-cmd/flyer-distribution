import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function areaKeyFor(addressArea: string | null, postcode: string | null): string {
  if (addressArea?.trim()) return addressArea.trim();
  const outwardCode = postcode?.trim().split(/\s+/)[0];
  if (outwardCode) return outwardCode.toUpperCase();
  return "Unknown Area";
}

export default async function JobsByAreaPage() {
  const jobs = await prisma.job.findMany({
    include: { lead: { select: { id: true, name: true, addressArea: true, postcode: true } } },
  });

  const groups = new Map<string, { active: number; completed: number; jobs: typeof jobs }>();

  for (const job of jobs) {
    const key = areaKeyFor(job.lead.addressArea, job.lead.postcode);
    const group = groups.get(key) ?? { active: 0, completed: 0, jobs: [] };
    if (job.status === "COMPLETED") group.completed++;
    else group.active++;
    group.jobs.push(job);
    groups.set(key, group);
  }

  const sortedGroups = Array.from(groups.entries()).sort((a, b) => b[1].jobs.length - a[1].jobs.length);

  return (
    <div>
      <h1 className="text-xl font-bold text-blue-900 mb-1">Jobs by Area</h1>
      <p className="text-sm text-gray-500 mb-4">
        Grouped by address area (falling back to postcode district) across all Won leads with a job.
      </p>

      {sortedGroups.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-400">No jobs yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sortedGroups.map(([area, group]) => (
            <div key={area} className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-bold text-blue-900">{area}</h2>
                <span className="text-xs text-gray-400">{group.jobs.length} job(s)</span>
              </div>
              <div className="flex gap-4 mb-3">
                <div>
                  <p className="text-lg font-bold text-blue-900">{group.active}</p>
                  <p className="text-[11px] text-gray-500">Active</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-green-600">{group.completed}</p>
                  <p className="text-[11px] text-gray-500">Completed</p>
                </div>
              </div>
              <ul className="space-y-1">
                {group.jobs.map((j) => (
                  <li key={j.id}>
                    <Link
                      href={`/admin/crm/leads/${j.lead.id}`}
                      className="text-xs text-blue-700 hover:underline"
                    >
                      {j.lead.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
