import { LOST_REASONS } from "./crm-constants";
import { stageChangeOps } from "./lead-stage";
import { planPriorityAction, type PlannedAction, type PriorityAction, type PriorityItem } from "./priorities";

// Writing Done, Snooze, Still in talks and Mark as Lost from the Priorities
// page. Every item is written in its own transaction, so in a bulk action
// one failure never stops the rest. Shared by the single-row actions route
// and the bulk route; the database is a narrow structural type so a test
// can pass a plain object.

type DismissalData = {
  fingerprint: string;
  dismissed: boolean;
  snoozedUntil: Date | null;
  note: string | null;
  userId: string | null;
};

export type PriorityTx = {
  priorityDismissal: {
    upsert(args: { where: { itemKey: string }; create: DismissalData & { itemKey: string }; update: DismissalData }): PromiseLike<unknown>;
  };
  activity: {
    create(args: {
      data: { leadId: string; type: "NOTE" | "STAGE_CHANGE"; detail: string; userId: string | null };
    }): PromiseLike<unknown>;
  };
  task: {
    updateMany(args: { where: { id: string; completed: false }; data: { completed: true } }): PromiseLike<{ count: number }>;
  };
  lead: {
    findUnique(args: {
      where: { id: string };
      select: { id: true; name: true; stage: true; wonAt: true };
    }): PromiseLike<{ id: string; name: string; stage: string; wonAt: Date | null } | null>;
    update(args: { where: { id: string }; data: Record<string, unknown> }): PromiseLike<unknown>;
  };
};

export type PriorityDb = {
  $transaction<T>(fn: (tx: PriorityTx) => Promise<T>): Promise<T>;
};

export type BulkStatus = "done" | "skipped" | "failed";
export type BulkResult = { id: string; status: BulkStatus; message?: string };

// One Done, Snooze or Still in talks, as planned by planPriorityAction.
export async function writePlannedAction(db: PriorityDb, plan: PlannedAction, userId: string | null): Promise<void> {
  await db.$transaction(async (tx) => {
    if (plan.kind === "complete_task") {
      await tx.task.updateMany({ where: { id: plan.taskId, completed: false }, data: { completed: true } });
      return;
    }
    const data = {
      fingerprint: plan.fingerprint,
      dismissed: plan.dismissed,
      snoozedUntil: plan.snoozedUntil,
      note: plan.note,
      userId,
    };
    await tx.priorityDismissal.upsert({ where: { itemKey: plan.itemKey }, create: { itemKey: plan.itemKey, ...data }, update: data });
    if (plan.activity) {
      await tx.activity.create({ data: { leadId: plan.activity.leadId, type: "NOTE", detail: plan.activity.detail, userId } });
    }
  });
}

// Done, Snooze or Still in talks on several items. `items` is every current
// item, worked out on the server; only their keys come from the browser.
export async function applyBulkPriorityAction(
  db: PriorityDb,
  items: PriorityItem[],
  keys: string[],
  action: PriorityAction,
  days: number | undefined,
  userId: string | null,
  now: Date,
  onError?: (key: string, err: unknown) => void
): Promise<BulkResult[]> {
  const byKey = new Map(items.map((i) => [i.key, i]));
  const results: BulkResult[] = [];
  for (const key of new Set(keys)) {
    const entry = byKey.get(key);
    if (!entry) {
      results.push({ id: key, status: "skipped", message: "It had already cleared." });
      continue;
    }
    const plan = planPriorityAction(entry, action, days, now);
    if ("error" in plan) {
      results.push({ id: key, status: "failed", message: plan.error });
      continue;
    }
    try {
      await writePlannedAction(db, plan, userId);
      results.push({ id: key, status: "done" });
    } catch (err) {
      onError?.(key, err);
      results.push({ id: key, status: "failed", message: "Failed to save. Nothing was changed for this one." });
    }
  }
  return results;
}

export function isLostReason(value: unknown): value is (typeof LOST_REASONS)[number] {
  return typeof value === "string" && (LOST_REASONS as readonly string[]).includes(value);
}

// Mark as Lost on several leads with one lost reason. Each lead goes through
// the shared stage change (the lead's stage, its lost reason and the stage
// change activity) in its own transaction; a lead already Lost is left alone.
export async function markLeadsLost(
  db: PriorityDb,
  leadIds: string[],
  lostReason: (typeof LOST_REASONS)[number],
  lostReasonNote: string,
  userId: string | null,
  now: Date,
  onError?: (leadId: string, err: unknown) => void
): Promise<(BulkResult & { name?: string })[]> {
  const note = lostReason === "OTHER" ? lostReasonNote.trim() || null : null;
  const results: (BulkResult & { name?: string })[] = [];
  for (const id of new Set(leadIds)) {
    try {
      const outcome = await db.$transaction(async (tx) => {
        const lead = await tx.lead.findUnique({ where: { id }, select: { id: true, name: true, stage: true, wonAt: true } });
        if (!lead) return { id, status: "failed" as const, message: "That lead no longer exists." };
        if (lead.stage === "LOST") return { id, name: lead.name, status: "skipped" as const, message: "Already Lost." };
        const ops = stageChangeOps(tx, lead, "LOST", {
          userId,
          now,
          bulk: true,
          extraData: { lostReason, lostReasonNote: note },
        });
        for (const op of ops) await op;
        return { id, name: lead.name, status: "done" as const };
      });
      results.push(outcome);
    } catch (err) {
      onError?.(id, err);
      results.push({ id, status: "failed", message: "Failed to save. Nothing was changed for this lead." });
    }
  }
  return results;
}
