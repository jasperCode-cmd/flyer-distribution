import "server-only";
import { prisma } from "@/lib/prisma";

export function leadWithLastActivityArgs() {
  return {
    activities: { orderBy: { createdAt: "desc" as const }, take: 1 },
    assignedTo: { select: { id: true, name: true } },
    tags: { include: { tag: true } },
  };
}

export async function getLeadsWithLastActivity() {
  return prisma.lead.findMany({
    include: leadWithLastActivityArgs(),
    orderBy: { createdAt: "desc" },
  });
}

// Flattens the LeadTag join rows into a plain Tag[] for client components.
export function flattenTags<T extends { tags: { tag: { id: string; name: string; color: string } }[] }>(
  lead: T
) {
  return { ...lead, tags: lead.tags.map((lt) => lt.tag) };
}

export async function findDuplicateLeads(
  email: string | null | undefined,
  phone: string | null | undefined,
  excludeId?: string
) {
  const email_ = email?.trim();
  const phone_ = phone?.trim();
  if (!email_ && !phone_) return [];

  return prisma.lead.findMany({
    where: {
      id: excludeId ? { not: excludeId } : undefined,
      OR: [
        ...(email_ ? [{ email: email_ }] : []),
        ...(phone_ ? [{ phone: phone_ }] : []),
      ],
    },
    select: { id: true, name: true, email: true, phone: true },
    take: 5,
  });
}

export async function getFollowUpTasks() {
  const tasks = await prisma.task.findMany({
    where: { completed: false },
    include: { lead: { select: { id: true, name: true } } },
    orderBy: { dueDate: "asc" },
  });

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  const overdue = tasks.filter((t) => t.dueDate < startOfToday);
  const today = tasks.filter((t) => t.dueDate >= startOfToday && t.dueDate < startOfTomorrow);

  return { overdue, today };
}
