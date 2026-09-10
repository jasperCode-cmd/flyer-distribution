import { prisma } from "@/lib/prisma";
import ScrappedLeadsView from "@/components/crm/ScrappedLeadsView";

export const dynamic = "force-dynamic";

export default async function ScrappedLeadsPage() {
  const leads = await prisma.lead.findMany({
    where: { scrapped: true },
    select: {
      id: true,
      name: true,
      businessName: true,
      scrapReason: true,
      scrapNote: true,
      scrappedAt: true,
      noAnswerStreak: true,
    },
    orderBy: { scrappedAt: "desc" },
  });

  const serializable = leads.map((l) => ({
    ...l,
    scrappedAt: l.scrappedAt ? l.scrappedAt.toISOString() : null,
  }));

  return <ScrappedLeadsView leads={serializable} />;
}
