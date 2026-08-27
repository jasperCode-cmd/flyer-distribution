import { prisma } from "@/lib/prisma";
import DistributorManager from "@/components/crm/DistributorManager";

export const dynamic = "force-dynamic";

export default async function DistributorsPage() {
  const distributors = await prisma.distributor.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: { _count: { select: { jobs: true, calendarEvents: true } } },
  });

  return (
    <div>
      <h1 className="text-xl font-bold text-blue-900 mb-4">Distributors</h1>
      <DistributorManager
        distributors={distributors.map((d) => ({
          id: d.id,
          name: d.name,
          phone: d.phone,
          email: d.email,
          notes: d.notes,
          active: d.active,
          _count: d._count,
        }))}
      />
    </div>
  );
}
