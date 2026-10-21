import "server-only";
import { prisma } from "./prisma";
import { getInboxUnreadCount, isGmailConfigured } from "./gmail";
import { notificationsFrom, type Notifications } from "./notifications";
import { urgentHighCount } from "./priorities";
import { loadPriorityList, sharedDatabaseFacts } from "./priorities-data";
import { sharedCache } from "./shared-cache";

// What every CRM tab shows around the page: the bell, and the counts beside
// Inbox, Applications and Priorities. One answer, worked out at most once a
// minute and shared by every tab and user (and afresh for whoever has just
// changed something, shared-cache.ts). It reads the same facts as
// Priorities, so a Dashboard or Priorities page open at the same time costs
// no more queries.

export type CrmStatus = {
  notifications: Notifications;
  // New applications, beside Applications.
  applications: number;
  // Urgent and High rows on Priorities, unanswered emails included.
  priorities: number;
  // Unread inbox conversations; null without Gmail, or when it didn't answer.
  inbox: { count: number; more: boolean } | null;
};

export const CRM_STATUS_TTL_MS = 60 * 1000;
const statusCache = sharedCache<CrmStatus>("crm-status", { ttlMs: CRM_STATUS_TTL_MS, maxEntries: 1 });

export function loadCrmStatus(changeId: string | null = null): Promise<CrmStatus> {
  return statusCache.get("status", () => workOutStatus(changeId), { changeId });
}

async function inboxCount(): Promise<CrmStatus["inbox"]> {
  if (!isGmailConfigured()) return null;
  // The badge is optional; a failure just hides it.
  const result = await getInboxUnreadCount().catch(() => null);
  return result?.ok ? result.data : null;
}

async function workOutStatus(changeId: string | null): Promise<CrmStatus> {
  const now = new Date();
  const [facts, list, dueCallbacks, inbox] = await Promise.all([
    sharedDatabaseFacts(now, changeId),
    // Shares the same facts (one load between them).
    loadPriorityList({ withEmail: true, changeId }),
    prisma.lead.findMany({
      where: { scrapped: false, stage: "UNCONTACTED", nextCallableAt: { lte: now } },
      select: { id: true, name: true, nextCallableAt: true },
      orderBy: { nextCallableAt: "asc" },
    }),
    inboxCount(),
  ]);
  return {
    notifications: notificationsFrom(
      facts,
      dueCallbacks.flatMap((c) => (c.nextCallableAt ? [{ id: c.id, name: c.name, nextCallableAt: c.nextCallableAt }] : [])),
      now
    ),
    applications: facts.applications.length,
    priorities: urgentHighCount(list.rows),
    inbox,
  };
}
