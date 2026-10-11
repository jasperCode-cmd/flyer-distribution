import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { applyBulkPriorityAction, markLeadsLost } from "@/lib/priority-actions";
import { automaticItems, type LeadFacts } from "@/lib/priorities";

// The Priorities bulk bar against a real database, but only a throwaway
// local one: it needs CRM_TEST_DATABASE_URL pointing at localhost and is
// skipped otherwise, so it can never touch the production database. It
// cleans up after itself.
//
//   CRM_TEST_DATABASE_URL=postgresql://user@127.0.0.1:5432/scratch npm test

const url = process.env.CRM_TEST_DATABASE_URL ?? "";
let host = "";
try {
  host = url ? new URL(url).hostname : "";
} catch {
  host = "";
}
const skip = !["localhost", "127.0.0.1", "::1", "[::1]"].includes(host)
  ? "set CRM_TEST_DATABASE_URL to a local throwaway database to run"
  : false;

const TAG = "Bulk priorities test";
let prisma: PrismaClient;
let leadIds: string[] = [];

async function cleanUp() {
  const leads = await prisma.lead.findMany({ where: { name: { startsWith: TAG } }, select: { id: true } });
  await prisma.priorityDismissal.deleteMany({ where: { itemKey: { in: leads.map((l) => `awaiting:${l.id}`) } } });
  await prisma.lead.deleteMany({ where: { name: { startsWith: TAG } } });
}

before(async () => {
  if (skip) return;
  prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  await cleanUp();
});

after(async () => {
  if (skip) return;
  await cleanUp();
  await prisma.$disconnect();
});

async function makeLeads() {
  const created = await Promise.all(
    ["Kara", "Gina", "Finn"].map((name) =>
      prisma.lead.create({ data: { name: `${TAG} ${name}`, stage: "AWAITING_RESPONSE", source: "REFERRAL" } })
    )
  );
  leadIds = created.map((l) => l.id);
  return created;
}

test("real database: bulk Mark as Lost moves each lead, records the reason and the activity, and a missing lead doesn't stop the rest", { skip }, async () => {
  const [kara, gina, finn] = await makeLeads();
  const now = new Date();
  const results = await markLeadsLost(prisma, [kara.id, "no-such-lead", gina.id, finn.id], "CHOSE_COMPETITOR", "", null, now);
  assert.deepEqual(
    results.map((r) => r.status),
    ["done", "failed", "done", "done"]
  );

  const after = await prisma.lead.findMany({
    where: { id: { in: leadIds } },
    select: { name: true, stage: true, lostReason: true, lostReasonNote: true, activities: { select: { type: true, detail: true } } },
    orderBy: { name: "asc" },
  });
  for (const lead of after) {
    assert.equal(lead.stage, "LOST", lead.name);
    assert.equal(lead.lostReason, "CHOSE_COMPETITOR", lead.name);
    assert.equal(lead.lostReasonNote, null, lead.name);
    assert.deepEqual(lead.activities, [
      { type: "STAGE_CHANGE", detail: "Stage changed from Warm / Awaiting Response to Lost (bulk action)" },
    ]);
  }

  // Running it again leaves them alone.
  const again = await markLeadsLost(prisma, leadIds, "PRICE", "", null, now);
  assert.deepEqual(again.map((r) => r.status), ["skipped", "skipped", "skipped"]);
  assert.equal(await prisma.activity.count({ where: { leadId: { in: leadIds } } }), 3);
  await cleanUp();
});

test("real database: bulk Still in talks snoozes each lead and logs its note on each one", { skip }, async () => {
  const created = await makeLeads();
  const now = new Date();
  const facts: LeadFacts[] = created.map((l) => ({
    id: l.id,
    name: l.name,
    businessName: null,
    email: null,
    phone: null,
    stage: "AWAITING_RESPONSE",
    source: "REFERRAL",
    paymentStatus: "NOT_PAID",
    reviewStatus: "NOT_REQUESTED",
    createdAt: l.createdAt.toISOString(),
    scrapped: false,
    activities: [],
    job: null,
  }));
  const items = automaticItems({ now, leads: facts, applications: [], tasks: [], emails: [], dismissals: [] });
  const results = await applyBulkPriorityAction(prisma, items, leadIds.map((id) => `awaiting:${id}`), "still_in_talks", 2, null, now);
  assert.deepEqual(results.map((r) => r.status), ["done", "done", "done"]);

  for (const id of leadIds) {
    const notes = await prisma.activity.findMany({ where: { leadId: id }, select: { type: true, detail: true } });
    assert.equal(notes.length, 1);
    assert.equal(notes[0].type, "NOTE");
    assert.match(notes[0].detail, /^Still in talks\. Snoozed on Priorities for 2 days, back on \d{1,2} \w+\.$/);
    const snooze = await prisma.priorityDismissal.findUnique({ where: { itemKey: `awaiting:${id}` } });
    assert.equal(snooze?.dismissed, false);
    assert.equal(Math.round((snooze!.snoozedUntil!.getTime() - now.getTime()) / 3_600_000), 48);
  }
});
