import "server-only";
import { prisma } from "@/lib/prisma";
import { leadBusinessWhere, type BusinessFilter } from "./business";

export function leadWithLastActivityArgs() {
  return {
    activities: { orderBy: { createdAt: "desc" as const }, take: 1 },
    assignedTo: { select: { id: true, name: true } },
    tags: { include: { tag: true } },
  };
}

export async function getLeadsWithLastActivity() {
  return prisma.lead.findMany({
    where: { scrapped: false },
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

// Shared "move to Awaiting Response" update data. Used by the Dialer's Warm
// outcome and by the email-send flow, so a lead reaching this stage always
// clears the same dialer fields the same way, from a single definition.
export function awaitingResponseStageData() {
  return {
    stage: "AWAITING_RESPONSE" as const,
    noAnswerStreak: 0,
    nextCallableAt: null,
  };
}

// A lead only auto-advances to Awaiting Response from Uncontacted. A lead
// already past that point (including Won/Completed/Lost) never moves just
// because an email was sent to it.
export function shouldMoveToAwaitingResponse(stage: string): boolean {
  return stage === "UNCONTACTED";
}

// Shared WHERE clause for the dialer's active queue. See crm-constants'
// queue-ordering comment for the full algorithm this pairs with. Kept as a
// plain object builder (not a query itself) so /next (take 1) and /queue
// (the full list view) stay byte-for-byte consistent with each other.
export function dialerQueueWhere({
  source,
  tagId,
  userId,
  excludeIds,
  business = "ALL",
}: {
  source: string;
  tagId?: string;
  userId: string;
  excludeIds?: string[];
  business?: BusinessFilter;
}) {
  return {
    scrapped: false,
    stage: "UNCONTACTED" as const,
    source: source as never,
    ...leadBusinessWhere(business),
    ...(tagId ? { tags: { some: { tagId } } } : {}),
    OR: [{ assignedToId: null }, { assignedToId: userId }],
    AND: [
      { OR: [{ nextCallableAt: null }, { nextCallableAt: { lte: new Date() } }] },
      ...(excludeIds && excludeIds.length > 0 ? [{ id: { notIn: excludeIds } }] : []),
    ],
  };
}

// nextCallableAt ascending with nulls last (never-called leads sort after
// any real, overdue callback date), then createdAt ascending as the
// tiebreak among never-called leads: oldest/first-imported first.
export const dialerQueueOrderBy = [
  { nextCallableAt: { sort: "asc" as const, nulls: "last" as const } },
  { createdAt: "asc" as const },
];

export function dialerLeadSelect() {
  return {
    id: true,
    name: true,
    businessName: true,
    business: true,
    phone: true,
    source: true,
    addressArea: true,
    targetAreas: true,
    postcode: true,
    dealValue: true,
    noAnswerStreak: true,
    nextCallableAt: true,
    assignedToId: true,
    assignedTo: { select: { id: true, name: true } },
    createdAt: true,
    activities: {
      where: { type: "CALL" as const },
      orderBy: { createdAt: "desc" as const },
      take: 1,
      include: { user: { select: { name: true } } },
    },
  };
}

export async function getNextDialerLead(params: {
  source: string;
  tagId?: string;
  userId: string;
  excludeIds?: string[];
  business?: BusinessFilter;
}) {
  return prisma.lead.findFirst({
    where: dialerQueueWhere(params),
    orderBy: dialerQueueOrderBy,
    select: dialerLeadSelect(),
  });
}

export async function getDialerQueueList(params: { source: string; tagId?: string; userId: string; business?: BusinessFilter }) {
  return prisma.lead.findMany({
    where: dialerQueueWhere(params),
    orderBy: dialerQueueOrderBy,
    select: dialerLeadSelect(),
    take: 200,
  });
}

export async function getCallsMadeToday(userId: string) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  return prisma.activity.count({
    where: {
      userId,
      type: "CALL",
      detail: { startsWith: "Dialer:" },
      createdAt: { gte: startOfToday },
    },
  });
}

export async function getInboundLeadCount() {
  return prisma.lead.count({
    where: { scrapped: false, stage: "UNCONTACTED", source: "WEBSITE_QUOTE_FORM" },
  });
}

export async function getDueCallbackCount() {
  return prisma.lead.count({
    where: { scrapped: false, stage: "UNCONTACTED", nextCallableAt: { lte: new Date() } },
  });
}
