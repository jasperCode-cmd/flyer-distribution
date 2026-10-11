import { test } from "node:test";
import assert from "node:assert/strict";
import { applyBulkPriorityAction, isLostReason, markLeadsLost, type PriorityDb, type PriorityTx } from "@/lib/priority-actions";
import { automaticItems, taskItems, type LeadFacts, type PriorityInputs } from "@/lib/priorities";

const NOW = new Date("2026-10-11T10:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

type Write = { op: string; args: { where?: Record<string, unknown>; data?: Record<string, unknown>; create?: Record<string, unknown> } };

// A fake database. Like Prisma's, its writes only run when awaited, and a
// transaction keeps its writes only if it finishes; a lead in `failFor`
// makes its transaction throw, as a database error would.
function fakeDb(leads: { id: string; name: string; stage: string; wonAt: Date | null }[], failFor: string[] = []) {
  const committed: Write[] = [];
  const lazy = (pending: Write[], write: Write, fail: boolean) => ({
    then(resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) {
      if (fail) return Promise.reject(new Error("database error")).then(resolve, reject);
      pending.push(write);
      return Promise.resolve({ count: 1 }).then(resolve, reject);
    },
  });
  const db: PriorityDb = {
    async $transaction<T>(fn: (tx: PriorityTx) => Promise<T>): Promise<T> {
      const pending: Write[] = [];
      const leadOf = (args: Write["args"]) => String(args.data?.leadId ?? args.where?.id ?? args.create?.itemKey ?? "");
      const failing = (args: Write["args"]) => failFor.some((id) => leadOf(args).includes(id));
      const tx = {
        priorityDismissal: { upsert: (args: Write["args"]) => lazy(pending, { op: "dismissal.upsert", args }, failing(args)) },
        activity: { create: (args: Write["args"]) => lazy(pending, { op: "activity.create", args }, failing(args)) },
        task: { updateMany: (args: Write["args"]) => lazy(pending, { op: "task.updateMany", args }, failing(args)) },
        lead: {
          findUnique: async (args: { where: { id: string } }) => leads.find((l) => l.id === args.where.id) ?? null,
          update: (args: Write["args"]) => lazy(pending, { op: "lead.update", args }, failing(args)),
        },
      } as unknown as PriorityTx;
      const result = await fn(tx);
      committed.push(...pending);
      return result;
    },
  };
  return { db, committed };
}

// --- Mark as Lost -------------------------------------------------------------------

test("bulk Mark as Lost sets the stage, lost reason and activity on each lead; one failure doesn't stop the rest", async () => {
  const leads = [
    { id: "L1", name: "Kara Bell", stage: "AWAITING_RESPONSE", wonAt: null },
    { id: "L2", name: "Gina Patel", stage: "AWAITING_RESPONSE", wonAt: null },
    { id: "L3", name: "Finn Doyle", stage: "UNCONTACTED", wonAt: null },
    { id: "L4", name: "Old Lost", stage: "LOST", wonAt: null },
  ];
  // L2's transaction fails part way through.
  const { db, committed } = fakeDb(leads, ["L2"]);
  const errors: string[] = [];
  const results = await markLeadsLost(db, ["L1", "L2", "L3", "L4", "gone"], "WENT_QUIET", "ignored, not Other", "u1", NOW, (id) => errors.push(id));

  assert.deepEqual(
    results.map((r) => [r.id, r.status]),
    [["L1", "done"], ["L2", "failed"], ["L3", "done"], ["L4", "skipped"], ["gone", "failed"]]
  );
  assert.equal(results[1].message, "Failed to save. Nothing was changed for this lead.");
  assert.equal(results[4].message, "That lead no longer exists.");
  assert.deepEqual(errors, ["L2"]);

  // L1 and L3 were each moved and noted; nothing at all was kept for L2 or L4.
  const updates = committed.filter((w) => w.op === "lead.update");
  assert.deepEqual(updates.map((w) => [w.args.where?.id, w.args.data]), [
    ["L1", { stage: "LOST", lostReason: "WENT_QUIET", lostReasonNote: null }],
    ["L3", { stage: "LOST", lostReason: "WENT_QUIET", lostReasonNote: null }],
  ]);
  const notes = committed.filter((w) => w.op === "activity.create").map((w) => w.args.data);
  assert.deepEqual(notes, [
    { leadId: "L1", type: "STAGE_CHANGE", detail: "Stage changed from Warm / Awaiting Response to Lost (bulk action)", userId: "u1" },
    { leadId: "L3", type: "STAGE_CHANGE", detail: "Stage changed from Uncontacted to Lost (bulk action)", userId: "u1" },
  ]);
  assert.ok(!committed.some((w) => JSON.stringify(w).includes("L2")), "L2's transaction left nothing behind");
});

test("the Other reason keeps its note; the rest don't", async () => {
  const { db, committed } = fakeDb([{ id: "L1", name: "Kara", stage: "AWAITING_RESPONSE", wonAt: null }]);
  await markLeadsLost(db, ["L1"], "OTHER", "  Moved abroad  ", null, NOW);
  assert.deepEqual(committed[0].args.data, { stage: "LOST", lostReason: "OTHER", lostReasonNote: "Moved abroad" });
  assert.equal(isLostReason("WENT_QUIET"), true);
  assert.equal(isLostReason("BORED"), false);
});

// --- Done, Snooze and Still in talks ------------------------------------------------

function awaitingLead(id: string, name: string): LeadFacts {
  return {
    id,
    name,
    businessName: null,
    email: null,
    phone: null,
    stage: "AWAITING_RESPONSE",
    source: "REFERRAL",
    paymentStatus: "NOT_PAID",
    reviewStatus: "NOT_REQUESTED",
    createdAt: "2026-10-01T09:00:00.000Z",
    scrapped: false,
    activities: [],
    job: null,
  };
}

function items(): ReturnType<typeof automaticItems> {
  const inputs: PriorityInputs = {
    now: NOW,
    leads: [awaitingLead("L1", "Kara Bell"), awaitingLead("L2", "Gina Patel"), awaitingLead("L3", "Finn Doyle")],
    applications: [{ id: "A1", fullName: "Dan", email: null, phone: null, status: "NEW", receivedAt: "2026-10-09T08:00:00.000Z", updatedAt: "2026-10-09T08:00:00.000Z" }],
    tasks: [{ id: "T1", description: "Renew the van insurance", dueDate: "2026-10-11T12:00:00.000Z", priority: "NORMAL", lead: null }],
    emails: [],
    dismissals: [],
  };
  return [...automaticItems(inputs), ...taskItems(inputs)];
}

test("bulk Still in talks snoozes each lead and logs its note on each one", async () => {
  const { db, committed } = fakeDb([], ["L2"]);
  const results = await applyBulkPriorityAction(
    db,
    items(),
    ["awaiting:L1", "awaiting:L2", "awaiting:L3", "application:A1", "awaiting:gone"],
    "still_in_talks",
    5,
    "u1",
    NOW
  );
  assert.deepEqual(
    results.map((r) => [r.id, r.status]),
    [["awaiting:L1", "done"], ["awaiting:L2", "failed"], ["awaiting:L3", "done"], ["application:A1", "failed"], ["awaiting:gone", "skipped"]]
  );
  assert.equal(results[3].message, "Still in talks is only for leads awaiting a response.");

  const notes = committed.filter((w) => w.op === "activity.create").map((w) => w.args.data);
  assert.deepEqual(notes, [
    { leadId: "L1", type: "NOTE", detail: "Still in talks. Snoozed on Priorities for 5 days, back on 16 Oct.", userId: "u1" },
    { leadId: "L3", type: "NOTE", detail: "Still in talks. Snoozed on Priorities for 5 days, back on 16 Oct.", userId: "u1" },
  ]);
  const snoozes = committed.filter((w) => w.op === "dismissal.upsert").map((w) => w.args.create);
  assert.deepEqual(
    snoozes.map((c) => [c?.itemKey, c?.dismissed, (c?.snoozedUntil as Date).getTime() - NOW.getTime(), c?.note]),
    [
      ["awaiting:L1", false, 5 * DAY, "Still in talks, snoozed for 5 days"],
      ["awaiting:L3", false, 5 * DAY, "Still in talks, snoozed for 5 days"],
    ]
  );
});

test("bulk Done hides each item until it changes, and completes a task", async () => {
  const { db, committed } = fakeDb([]);
  const results = await applyBulkPriorityAction(db, items(), ["awaiting:L1", "task:T1", "application:A1"], "done", undefined, null, NOW);
  assert.deepEqual(results.map((r) => r.status), ["done", "done", "done"]);
  assert.deepEqual(
    committed.map((w) => [w.op, w.args.where]),
    [
      ["dismissal.upsert", { itemKey: "awaiting:L1" }],
      ["task.updateMany", { id: "T1", completed: false }],
      ["dismissal.upsert", { itemKey: "application:A1" }],
    ]
  );
  // A snooze must be 1, 3 or 7 days.
  const bad = await applyBulkPriorityAction(db, items(), ["awaiting:L1"], "snooze", 2, null, NOW);
  assert.deepEqual(bad, [{ id: "awaiting:L1", status: "failed", message: "Choose 1, 3, 7 days." }]);
});
