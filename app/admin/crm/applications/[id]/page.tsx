import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ApplicationDetail from "@/components/crm/ApplicationDetail";

export const dynamic = "force-dynamic";

export default async function ApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await prisma.distributorApplication.findUnique({
    where: { id },
    include: { distributor: { select: { id: true, name: true } } },
  });
  if (!a) notFound();

  return (
    <ApplicationDetail
      application={{
        id: a.id,
        fullName: a.fullName,
        phone: a.phone,
        email: a.email,
        area: a.area,
        age: a.age,
        hasCar: a.hasCar,
        hasLicence: a.hasLicence,
        availability: a.availability,
        status: a.status,
        source: a.source,
        business: a.business,
        notes: a.notes,
        receivedAt: a.receivedAt.toISOString(),
        distributor: a.distributor,
      }}
    />
  );
}
