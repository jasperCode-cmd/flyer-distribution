import { STAGE_LABELS } from "./crm-constants";

// The one place a lead's stage change is turned into database writes, used
// by the single-lead stage route (Kanban drag, the table's stage select, the
// lead page) and the bulk route. No other code path moves a lead into Won
// or Completed.

export const WON_STAGES = ["WON", "COMPLETED"] as const;

export function isWonStage(stage: string): boolean {
  return (WON_STAGES as readonly string[]).includes(stage);
}

// wonAt is set the first time a lead moves into Won, or straight into
// Completed, and only if it is empty: the first win sticks, leaving Won
// never clears it, and moving on to Completed keeps it.
export function stageUpdateData(
  lead: { wonAt: Date | null },
  stage: string,
  now: Date
): { stage: string; wonAt?: Date } {
  return isWonStage(stage) && !lead.wonAt ? { stage, wonAt: now } : { stage };
}

// Narrow structural type so a route passes the real Prisma client and a
// test a plain object. The calls only build operations; the caller runs
// them in its own transaction, exactly as before.
export type StageChangeDb = {
  lead: { update(args: { where: { id: string }; data: Record<string, unknown> }): unknown };
  activity: {
    create(args: {
      data: { leadId: string; type: "STAGE_CHANGE"; detail: string; userId: string | null };
    }): unknown;
  };
};

export function stageChangeOps(
  db: StageChangeDb,
  lead: { id: string; stage: string; wonAt: Date | null },
  stage: string,
  options: { userId: string | null; now: Date; extraData?: Record<string, unknown>; bulk?: boolean }
): unknown[] {
  return [
    db.lead.update({
      where: { id: lead.id },
      data: { ...stageUpdateData(lead, stage, options.now), ...(options.extraData ?? {}) },
    }),
    db.activity.create({
      data: {
        leadId: lead.id,
        type: "STAGE_CHANGE",
        detail: `Stage changed from ${STAGE_LABELS[lead.stage]} to ${STAGE_LABELS[stage]}${
          options.bulk ? " (bulk action)" : ""
        }`,
        userId: options.userId,
      },
    }),
  ];
}
