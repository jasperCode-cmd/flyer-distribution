import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { handleLdbIntake, LDB_INTAKE_PER_CONTACT_PER_HOUR } from "@/lib/ldb-intake";
import { loadDashboard } from "@/lib/dashboard-data";
import { ALL_PERIOD } from "@/lib/dashboard";
import type { BusinessFilter } from "@/lib/business";
import { JAMES_LEAD, JAMES_NOTE, JAMES_PAYLOAD, SARAH_LEAD, SARAH_NOTE, SARAH_PAYLOAD } from "./ldb-website-payloads";

// Businesses against a real database, but only a throwaway local one: it
// needs CRM_TEST_DATABASE_URL pointing at localhost and is skipped otherwise,
// so it can never touch the production database. It cleans up after itself.
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

const TAG = "Business test";
const SECRET = "local-test-secret";
let prisma: PrismaClient;

// The website payloads use their own addresses; only Bournemouth website
// leads with them are removed.
const PAYLOAD_EMAILS = [SARAH_LEAD.email, JAMES_LEAD.email];

async function cleanUp() {
  await prisma.calendarEvent.deleteMany({ where: { title: { startsWith: TAG } } });
  await prisma.expense.deleteMany({ where: { label: { startsWith: TAG } } });
  await prisma.lead.deleteMany({
    where: {
      OR: [
        { name: { startsWith: TAG } },
        { email: { endsWith: "@business-test.example" } },
        { email: { in: PAYLOAD_EMAILS }, business: "LDB", source: "WEBSITE_QUOTE_FORM" },
      ],
    },
  });
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

test("real database: a lead made without a business is FDH, and an expense without one is Shared", { skip }, async () => {
  const lead = await prisma.lead.create({ data: { name: `${TAG} default` } });
  const expense = await prisma.expense.create({
    data: { label: `${TAG} default`, category: "OTHER", amountPence: 100, kind: "ONE_OFF", date: new Date("2026-09-01") },
  });
  assert.equal(lead.business, "FDH");
  assert.equal(expense.business, "SHARED");
  await cleanUp();
});

test("real database: the intake makes an LDB lead and the per-contact cap holds", { skip }, async () => {
  const post = (email: string) =>
    handleLdbIntake(
      new Request("http://localhost/api/crm/intake/ldb", {
        method: "POST",
        headers: { "content-type": "application/json", "x-intake-secret": SECRET },
        body: JSON.stringify({ name: `${TAG} Sam`, email, service: "Leaflet distribution" }),
      }),
      {
        db: prisma,
        secret: SECRET,
        findDuplicates: async (e) =>
          prisma.lead.findMany({ where: { email: e ?? undefined }, select: { id: true, name: true }, take: 5 }),
      }
    );

  const first = await post("sam@business-test.example");
  assert.equal(first.status, 200);
  assert.deepEqual(await first.json(), { ok: true });
  const lead = await prisma.lead.findFirstOrThrow({
    where: { email: "sam@business-test.example" },
    include: { activities: true },
  });
  assert.equal(lead.business, "LDB");
  assert.equal(lead.source, "WEBSITE_QUOTE_FORM");
  assert.equal(lead.stage, "UNCONTACTED");
  assert.equal(lead.activities.length, 1);
  assert.equal(lead.activities[0].type, "NOTE");
  assert.equal(lead.activities[0].userId, null);

  for (let i = 1; i < LDB_INTAKE_PER_CONTACT_PER_HOUR; i++) {
    const again = await post("SAM@business-test.example");
    assert.equal(again.status, 200);
  }
  const capped = await post("sam@business-test.example");
  assert.equal(capped.status, 429);
  assert.equal(await prisma.lead.count({ where: { email: { equals: "sam@business-test.example", mode: "insensitive" } } }), LDB_INTAKE_PER_CONTACT_PER_HOUR);
  // The second one onwards notes the first as a possible duplicate.
  const notes = await prisma.activity.findMany({ where: { lead: { email: { equals: "sam@business-test.example", mode: "insensitive" } } } });
  assert.ok(notes.some((n) => n.detail.includes("Possible duplicate of existing lead(s)")));
  await cleanUp();
});

test("real database: the LDB website's own payloads are saved with every field", { skip }, async () => {
  for (const [raw, expected, note] of [
    [SARAH_PAYLOAD, SARAH_LEAD, SARAH_NOTE],
    [JAMES_PAYLOAD, JAMES_LEAD, JAMES_NOTE],
  ] as const) {
    const res = await handleLdbIntake(
      new Request("http://localhost/api/crm/intake/ldb", {
        method: "POST",
        headers: { "content-type": "application/json", "x-intake-secret": SECRET },
        body: raw,
      }),
      { db: prisma, secret: SECRET, findDuplicates: async () => [] }
    );
    assert.equal(res.status, 200, expected.name);
    assert.deepEqual(await res.json(), { ok: true });
    const lead = await prisma.lead.findFirstOrThrow({
      where: { email: expected.email, business: "LDB", source: "WEBSITE_QUOTE_FORM" },
      include: { activities: true },
    });
    const saved = Object.fromEntries(Object.keys(expected).map((key) => [key, lead[key as keyof typeof lead]]));
    assert.deepEqual(saved, expected);
    assert.equal(lead.activities.length, 1);
    assert.equal(lead.activities[0].type, "NOTE");
    assert.equal(lead.activities[0].userId, null);
    assert.equal(lead.activities[0].detail, note);
  }
  await cleanUp();
});

test("real database: the Dashboard business filter applies to money, pipeline and upcoming events", { skip }, async () => {
  const now = new Date();
  const snapshot = async () => {
    const out = {} as Record<BusinessFilter, { revenue: number; expenses: number; leads: number; events: string[] }>;
    for (const filter of ["ALL", "FDH", "LDB"] as const) {
      const data = await loadDashboard(prisma, ALL_PERIOD, now, filter);
      out[filter] = {
        revenue: data.money.revenuePence,
        expenses: data.money.expensesPence,
        leads: data.pipeline.stageCounts.WON ?? 0,
        events: data.events.map((e) => e.title).filter((t) => t.startsWith(TAG)).sort(),
      };
    }
    return out;
  };
  const before = await snapshot();

  const wonAt = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const fdh = await prisma.lead.create({ data: { name: `${TAG} FDH job`, stage: "WON", wonAt, amountPaid: 100, dealValue: 100 } });
  await prisma.lead.create({ data: { name: `${TAG} LDB job`, stage: "WON", wonAt, amountPaid: 50, dealValue: 50, business: "LDB" } });
  const day = now.toISOString().slice(0, 10);
  for (const [business, pence] of [["FDH", 1000], ["LDB", 500], ["SHARED", 300]] as const) {
    await prisma.expense.create({
      data: { label: `${TAG} ${business}`, category: "OTHER", amountPence: pence, kind: "ONE_OFF", date: new Date(`${day}T00:00:00Z`), business },
    });
  }
  const soon = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  await prisma.calendarEvent.create({ data: { title: `${TAG} no lead`, type: "GENERAL", startDateTime: soon } });
  await prisma.calendarEvent.create({ data: { title: `${TAG} FDH lead`, type: "GENERAL", startDateTime: soon, linkedLeadId: fdh.id } });

  const afterAll = await snapshot();
  const delta = (filter: BusinessFilter) => ({
    revenue: afterAll[filter].revenue - before[filter].revenue,
    expenses: afterAll[filter].expenses - before[filter].expenses,
    leads: afterAll[filter].leads - before[filter].leads,
  });
  assert.deepEqual(delta("ALL"), { revenue: 150_00, expenses: 1800, leads: 2 });
  assert.deepEqual(delta("FDH"), { revenue: 100_00, expenses: 1300, leads: 1 });
  assert.deepEqual(delta("LDB"), { revenue: 50_00, expenses: 800, leads: 1 });
  assert.deepEqual(afterAll.ALL.events, [`${TAG} FDH lead`, `${TAG} no lead`]);
  assert.deepEqual(afterAll.FDH.events, [`${TAG} FDH lead`, `${TAG} no lead`]);
  assert.deepEqual(afterAll.LDB.events, [`${TAG} no lead`], "an event with no lead shows under every filter");
  await cleanUp();
});
