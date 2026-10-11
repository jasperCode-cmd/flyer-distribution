import { prisma } from "@/lib/prisma";
import { isGmailConfigured } from "@/lib/gmail";
import ApplicationsView from "@/components/crm/ApplicationsView";

export const dynamic = "force-dynamic";

export default async function ApplicationsPage() {
  const applications = await prisma.distributorApplication.findMany({
    orderBy: { receivedAt: "desc" },
    include: { distributor: { select: { id: true, name: true } } },
  });

  return (
    <ApplicationsView
      gmailConfigured={isGmailConfigured()}
      applications={applications.map((a) => ({
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
        receivedAt: a.receivedAt.toISOString(),
        distributor: a.distributor,
      }))}
    />
  );
}
