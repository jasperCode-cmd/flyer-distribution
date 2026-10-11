import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { loadDistributorDirectory } from "@/lib/distributor-directory-data";
import { buildDistributorUpdate } from "@/lib/distributors";

// The Distributors page's figures against a real database, but only a
// throwaway local one: it needs CRM_TEST_DATABASE_URL pointing at localhost
// and is skipped otherwise, so it can never touch the production database.
// It cleans up after itself.
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

const TAG = "Directory test";
const NOW = new Date("2026-10-11T10:00:00.000Z");
let prisma: PrismaClient;

async function cleanUp() {
  await prisma.calendarEvent.deleteMany({ where: { title: { startsWith: TAG } } });
  await prisma.lead.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.distributorApplication.deleteMany({ where: { fullName: { startsWith: TAG } } });
  await prisma.distributor.deleteMany({ where: { name: { startsWith: TAG } } });
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

test("real database: jobs and pay counted once each, fuel left out, and deactivating keeps all of it", { skip }, async () => {
  const d = await prisma.distributor.create({ data: { name: `${TAG} Sam`, phone: "+44 7700 900777" } });
  await prisma.distributorApplication.create({
    data: {
      fullName: `${TAG} Sam`,
      source: "WEBSITE_FORM",
      area: "Totton SO40",
      hasCar: true,
      hasLicence: false,
      availability: "Weekday mornings",
      status: "APPROVED",
      distributorId: d.id,
    },
  });
  // Assigned and paid twice on one job; paid only on another.
  const both = await prisma.lead.create({
    data: {
      name: `${TAG} Both`,
      stage: "COMPLETED",
      wonAt: new Date("2026-08-01T10:00:00Z"),
      job: { create: { distributorId: d.id, campaignStartDate: new Date("2026-08-10T00:00:00Z") } },
    },
  });
  const paidOnly = await prisma.lead.create({
    data: { name: `${TAG} Paid only`, stage: "WON", wonAt: new Date("2026-09-01T10:00:00Z") },
  });
  await prisma.jobCost.createMany({
    data: [
      { leadId: both.id, category: "DISTRIBUTOR", distributorId: d.id, payType: "PER_THOUSAND", ratePence: 4500, leafletCount: 4000, amountPence: 18000 },
      { leadId: both.id, category: "DISTRIBUTOR", distributorId: d.id, payType: "FLAT", amountPence: 2500 },
      // Fuel isn't pay.
      { leadId: both.id, category: "FUEL", distributorId: d.id, amountPence: 1500 },
      { leadId: paidOnly.id, category: "DISTRIBUTOR", distributorId: d.id, payType: "FLAT", amountPence: 30000 },
    ],
  });
  await prisma.calendarEvent.createMany({
    data: [
      { type: "DISTRIBUTOR_SHIFT", title: `${TAG} next week`, startDateTime: new Date("2026-10-15T08:00:00Z"), distributorId: d.id },
      { type: "DISTRIBUTOR_SHIFT", title: `${TAG} last week`, startDateTime: new Date("2026-10-01T08:00:00Z"), distributorId: d.id },
    ],
  });

  const find = async () => (await loadDistributorDirectory(prisma, NOW)).find((x) => x.id === d.id)!;
  const before = await find();
  assert.equal(before.jobsWorked, 2);
  assert.equal(before.totalPaidPence, 18000 + 2500 + 30000);
  assert.deepEqual(before.jobs.map((j) => [j.leadName, j.paidPence, j.assigned]), [
    [`${TAG} Paid only`, 30000, false],
    [`${TAG} Both`, 20500, true],
  ]);
  assert.deepEqual(before.upcomingShifts.map((s) => s.title), [`${TAG} next week`]);
  assert.equal(before.application?.area, "Totton SO40");
  assert.equal(before.application?.hasLicence, false);

  // Deactivate exactly as the edit route does.
  const update = buildDistributorUpdate({ active: false });
  assert.ok(update.ok);
  await prisma.distributor.updateMany({ where: { id: d.id }, data: update.data });

  const after = await find();
  assert.equal(after.active, false);
  assert.deepEqual(
    { ...after, active: true },
    { ...before, active: true },
    "everything but the flag is unchanged"
  );
  // Nothing was unlinked in the database either.
  assert.equal(await prisma.job.count({ where: { distributorId: d.id } }), 1);
  assert.equal(await prisma.jobCost.count({ where: { distributorId: d.id } }), 4);
  assert.equal(await prisma.calendarEvent.count({ where: { distributorId: d.id } }), 2);
  assert.equal(await prisma.distributorApplication.count({ where: { distributorId: d.id } }), 1);
});
