import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import LeadDetail from "@/components/crm/LeadDetail";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [lead, users] = await Promise.all([
    prisma.lead.findUnique({
      where: { id },
      include: {
        activities: {
          orderBy: { createdAt: "desc" },
          include: { user: { select: { name: true } } },
        },
        job: true,
        tags: { include: { tag: true } },
        tasks: { orderBy: { dueDate: "asc" } },
      },
    }),
    prisma.user.findMany({ select: { id: true, name: true } }),
  ]);

  if (!lead) notFound();

  const serializable = {
    ...lead,
    dealValue: lead.dealValue ? lead.dealValue.toString() : null,
    createdAt: lead.createdAt.toISOString(),
    activities: lead.activities.map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
    })),
    job: lead.job
      ? {
          ...lead.job,
          campaignStartDate: lead.job.campaignStartDate?.toISOString() ?? null,
          completionDate: lead.job.completionDate?.toISOString() ?? null,
        }
      : null,
    tags: lead.tags.map((lt) => lt.tag),
    tasks: lead.tasks.map((t) => ({ ...t, dueDate: t.dueDate.toISOString() })),
  };

  return <LeadDetail lead={serializable} users={users} />;
}
