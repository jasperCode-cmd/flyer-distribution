import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { moveApplicationsToDistributors, type BulkDb, type BulkTx } from "@/lib/application-bulk";

// The bulk move against a real database, but only a throwaway local one: it
// needs CRM_TEST_DATABASE_URL pointing at localhost and is skipped
// otherwise, so it can never touch the production database. It cleans up
// after itself.
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

const TAG = "Bulk move test";
let prisma: PrismaClient;

async function cleanUp() {
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

async function application(name: string, extra: { phone?: string; email?: string; day: number }) {
  return prisma.distributorApplication.create({
    data: {
      fullName: `${TAG}: ${name}`,
      phone: extra.phone ?? null,
      email: extra.email ?? null,
      source: "WEBSITE_FORM",
      receivedAt: new Date(Date.UTC(2026, 8, extra.day, 10)),
    },
  });
}

// The real client, except that one application's link step throws, after
// its new distributor has been created inside the same transaction.
function failingFor(id: string): BulkDb {
  return {
    $transaction: (fn) =>
      prisma.$transaction((tx) => {
        const wrapped: BulkTx = {
          $executeRaw: (query, ...values) => tx.$executeRaw(query, ...values),
          distributor: tx.distributor,
          distributorApplication: {
            findUnique: (args) => tx.distributorApplication.findUnique(args),
            updateMany: (args) => {
              if (args.where.id === id) throw new Error("simulated failure");
              return tx.distributorApplication.updateMany(args);
            },
          },
        };
        return fn(wrapped);
      }),
  };
}

test("real database: one failure is rolled back on its own, matches are linked, and a second run creates nothing", { skip }, async () => {
  const existing = await prisma.distributor.create({
    data: { name: `${TAG}: Existing Priya`, phone: "07700 900555", email: "priya.bulk@example.com" },
  });
  const a = await application("Alice", { phone: "07123 400001", day: 1 });
  const b = await application("Bea", { phone: "+44 7700 900555", day: 2 });
  const c = await application("Cal", { email: "PRIYA.BULK@example.com", day: 3 });
  const d = await application("Dan", { phone: "07123 400004", day: 4 });
  const e = await application("Eve", { phone: "07123 400005", day: 5 });
  const ids = [a.id, b.id, c.id, d.id, e.id];
  const before = await prisma.distributor.count({ where: { name: { startsWith: TAG } } });

  const first = await moveApplicationsToDistributors(failingFor(d.id), ids);
  assert.deepEqual(
    first.map((r) => [r.fullName.replace(`${TAG}: `, ""), r.result]),
    [
      ["Alice", "created"],
      ["Bea", "linked"],
      ["Cal", "linked"],
      ["Dan", "failed"],
      ["Eve", "created"],
    ]
  );
  const rows = await prisma.distributorApplication.findMany({
    where: { id: { in: ids } },
    orderBy: { receivedAt: "asc" },
    select: { status: true, distributorId: true },
  });
  assert.deepEqual(
    rows.map((r) => r.status),
    ["APPROVED", "APPROVED", "APPROVED", "NEW", "APPROVED"]
  );
  assert.equal(rows[1].distributorId, existing.id);
  assert.equal(rows[2].distributorId, existing.id);
  assert.equal(rows[3].distributorId, null);
  // Alice and Eve only: Dan's distributor was rolled back with his failure.
  assert.equal(await prisma.distributor.count({ where: { name: { startsWith: TAG } } }), before + 2);
  assert.equal(await prisma.distributor.count({ where: { name: `${TAG}: Dan` } }), 0);

  // Again with the real client: Dan goes through now, nothing else changes.
  const second = await moveApplicationsToDistributors(prisma, ids);
  assert.deepEqual(second.map((r) => r.result), ["skipped", "skipped", "skipped", "created", "skipped"]);
  const third = await moveApplicationsToDistributors(prisma, ids);
  assert.deepEqual(third.map((r) => r.result), ["skipped", "skipped", "skipped", "skipped", "skipped"]);
  assert.equal(await prisma.distributor.count({ where: { name: { startsWith: TAG } } }), before + 3);
});
