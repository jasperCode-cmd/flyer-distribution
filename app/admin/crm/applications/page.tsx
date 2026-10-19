import { prisma } from "@/lib/prisma";
import { isGmailConfigured } from "@/lib/gmail";
import { parseBusinessFilter } from "@/lib/business";
import ApplicationsView from "@/components/crm/ApplicationsView";

export const dynamic = "force-dynamic";

// ?business=LDB opens the list on one business, as on the Leads page.
export default async function ApplicationsPage({ searchParams }: { searchParams: Promise<{ business?: string }> }) {
  const business = parseBusinessFilter((await searchParams).business);
  const applications = await prisma.distributorApplication.findMany({
    orderBy: { receivedAt: "desc" },
    include: { distributor: { select: { id: true, name: true } } },
  });

  return (
    <ApplicationsView
      gmailConfigured={isGmailConfigured()}
      initialBusiness={business === "ALL" ? undefined : business}
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
        business: a.business,
        receivedAt: a.receivedAt.toISOString(),
        distributor: a.distributor,
      }))}
    />
  );
}
