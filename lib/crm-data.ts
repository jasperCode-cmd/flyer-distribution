import "server-only";
import { prisma } from "@/lib/prisma";

export function leadWithLastActivityArgs() {
  return {
    activities: { orderBy: { createdAt: "desc" as const }, take: 1 },
    assignedTo: { select: { id: true, name: true } },
  };
}

export async function getLeadsWithLastActivity() {
  return prisma.lead.findMany({
    include: leadWithLastActivityArgs(),
    orderBy: { createdAt: "desc" },
  });
}
