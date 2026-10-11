import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { stageChangeOps } from "@/lib/lead-stage";
import { loadProfitJob, PROFIT_LEAD_SELECT, PROFIT_LEAD_WHERE, toProfitJob } from "@/lib/profit-data";

// Runs against a real database, but only a throwaway local one: it needs
// PROFIT_TEST_DATABASE_URL pointing at localhost, and is skipped otherwise,
// so it can never touch the production database. It cleans up after itself.
//
//   PROFIT_TEST_DATABASE_URL=postgresql://user@127.0.0.1:5432/scratch npm test

const url = process.env.PROFIT_TEST_DATABASE_URL ?? "";
let host = "";
try {
  host = url ? new URL(url).hostname : "";
} catch {
  host = "";
}
const skip = !["localhost", "127.0.0.1", "::1", "[::1]"].includes(host)
  ? "set PROFIT_TEST_DATABASE_URL to a local throwaway database to run"
  : false;

let prisma: PrismaClient;
const created = { leads: [] as string[], distributors: [] as string[] };

before(async () => {
  if (skip) return;
  prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
});

after(async () => {
  if (skip) return;
  await prisma.lead.deleteMany({ where: { id: { in: created.leads } } });
  await prisma.distributor.deleteMany({ where: { id: { in: created.distributors } } });
  await prisma.$disconnect();
});

async function wonLeadWithCosts(name: string) {
  const distributor = await prisma.distributor.create({ data: { name: `${name} distributor` } });
  created.distributors.push(distributor.id);
  const lead = await prisma.lead.create({
    data: { name, stage: "WON", wonAt: new Date("2026-08-03T12:00:00Z"), amountPaid: "500.00", dealValue: "600.00" },
  });
  created.leads.push(lead.id);
  await prisma.jobCost.createMany({
    data: [
      {
        leadId: lead.id,
        category: "DISTRIBUTOR",
        distributorId: distributor.id,
        payType: "PER_THOUSAND",
        ratePence: 4500,
        leafletCount: 5000,
        amountPence: 22500,
      },
      { leadId: lead.id, category: "PRINTING", amountPence: 9000 },
    ],
  });
  return { lead, distributor };
}

async function onProfitPage(leadId: string) {
  const rows = await prisma.lead.findMany({ where: PROFIT_LEAD_WHERE, select: { id: true } });
  return rows.some((r) => r.id === leadId);
}

async function moveStage(leadId: string, stage: string) {
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
  await prisma.$transaction(
    stageChangeOps(prisma, lead, stage, { userId: null, now: new Date() }) as [
      ReturnType<typeof prisma.lead.update>,
      ReturnType<typeof prisma.activity.create>,
    ]
  );
}

test("a lead leaving Won disappears from the Profit page but keeps its costs, and comes back with them", { skip }, async () => {
  const { lead } = await wonLeadWithCosts("Profit test: leaves Won");
  assert.equal(await onProfitPage(lead.id), true);

  await moveStage(lead.id, "AWAITING_RESPONSE");
  assert.equal(await onProfitPage(lead.id), false);
  assert.equal(await loadProfitJob(prisma, lead.id), null);
  assert.equal(await prisma.jobCost.count({ where: { leadId: lead.id } }), 2);

  await moveStage(lead.id, "WON");
  const back = await loadProfitJob(prisma, lead.id);
  assert.ok(back);
  assert.equal(back.costs.length, 2);
  // The first win sticks.
  assert.equal(back.wonAt, "2026-08-03T12:00:00.000Z");
  assert.equal(back.paidPence, 50000);
  assert.equal(back.dealPence, 60000);
});

test("Completed stays on the Profit page and keeps wonAt; a move straight to Completed sets it", { skip }, async () => {
  const { lead } = await wonLeadWithCosts("Profit test: completed");
  await moveStage(lead.id, "COMPLETED");
  const row = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
  assert.equal(row.wonAt?.toISOString(), "2026-08-03T12:00:00.000Z");
  assert.equal(await onProfitPage(lead.id), true);

  const fresh = await prisma.lead.create({ data: { name: "Profit test: straight to Completed" } });
  created.leads.push(fresh.id);
  const before = Date.now();
  await moveStage(fresh.id, "COMPLETED");
  const done = await prisma.lead.findUniqueOrThrow({ where: { id: fresh.id } });
  assert.ok(done.wonAt && done.wonAt.getTime() >= before - 1000);
});

test("deleting a distributor leaves its cost lines, with the amount, and no distributor", { skip }, async () => {
  const { lead, distributor } = await wonLeadWithCosts("Profit test: distributor deleted");
  await prisma.distributor.delete({ where: { id: distributor.id } });

  const lines = await prisma.jobCost.findMany({ where: { leadId: lead.id, category: "DISTRIBUTOR" } });
  assert.equal(lines.length, 1);
  assert.equal(lines[0].distributorId, null);
  assert.equal(lines[0].amountPence, 22500);

  const row = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id }, select: PROFIT_LEAD_SELECT });
  const job = toProfitJob(row);
  const kept = job.costs.find((c) => c.category === "DISTRIBUTOR");
  assert.equal(kept?.distributorName, null);
  assert.equal(kept?.amountPence, 22500);
});

test("deleting a lead removes its cost lines with it", { skip }, async () => {
  const { lead } = await wonLeadWithCosts("Profit test: lead deleted");
  await prisma.lead.delete({ where: { id: lead.id } });
  assert.equal(await prisma.jobCost.count({ where: { leadId: lead.id } }), 0);
});
