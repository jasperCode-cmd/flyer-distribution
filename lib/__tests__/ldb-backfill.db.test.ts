import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { applyBackfill, loadContacts, loadImportedIds, planBackfill, type ApplyDb } from "@/lib/ldb-backfill";
import { loadDashboard } from "@/lib/dashboard-data";
import { ukDay } from "@/lib/dashboard";
import { FDH, fakeReader, LDB, msg, notification, OPTIONS, SUBJECT, thread } from "./ldb-backfill-fixtures";

// The Bournemouth backfill against a real database, but only a throwaway
// local one: it needs CRM_TEST_DATABASE_URL pointing at localhost and is
// skipped otherwise, so it can never touch the production database. Gmail is
// a fake reader over made-up notifications. It cleans up after itself.

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

const DOMAIN = "@backfill-test.example";
let prisma: PrismaClient;

async function cleanUp() {
  await prisma.lead.deleteMany({ where: { email: { endsWith: DOMAIN } } });
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

const now = new Date();
const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);
const enquiry = (name: string, local: string, extra = "") => `Name: ${name}\nEmail: ${local}${DOMAIN}\nService: leaflet-distribution${extra}`;

function threads() {
  return [
    thread("bt1", [
      notification("bf-ann", daysAgo(45), enquiry("Ann Reid", "ann", "\nAreas: Poole")),
      msg("bf-ann-reply", { from: LDB, to: `ann${DOMAIN}`, subject: `Re: ${SUBJECT}`, at: daysAgo(44), labels: ["SENT"], text: "Hi Ann" }),
    ]),
    thread("bt2", [notification("bf-ben", daysAgo(90), enquiry("Ben Ross", "ben"))]),
    thread("bt3", [notification("bf-cat", daysAgo(3), enquiry("Cat Moss", "cat"))]),
    thread("bt4", [notification("bf-dup", daysAgo(5), enquiry("Dee Upton", "dup"))]),
    thread("bt5", [notification("bf-none", daysAgo(6), "Name: No Contact\nService: leaflet-distribution")]),
  ];
}

async function planFromDb() {
  const [imported, contacts] = await Promise.all([loadImportedIds(prisma), loadContacts(prisma)]);
  return planBackfill({ reader: fakeReader(threads()), imported, contacts, options: OPTIONS, own: [FDH, LDB], excluded: [], now });
}

test("real database: --apply writes dated LDB leads with their notes, and a second --apply creates nothing", { skip }, async () => {
  // An existing FDH lead with the same email as one enquiry.
  await prisma.lead.create({ data: { name: "Existing FDH lead", email: `DUP${DOMAIN}` } });
  // Cat's enquiry day alone, so leads other test files make today don't count.
  const catDay = ukDay(daysAgo(3));
  const period = { kind: "custom" as const, from: catDay, to: catDay };
  const before = (await loadDashboard(prisma, period, now, "LDB")).pipeline.newEnquiries;

  const first = await planFromDb();
  assert.deepEqual(
    first.rows.map((r) => [r.messageId, r.skip?.kind ?? r.stage]),
    [
      ["bf-ben", "LOST"],
      ["bf-ann", "AWAITING_RESPONSE"],
      ["bf-none", "unreadable"],
      ["bf-dup", "duplicate"],
      ["bf-cat", "UNCONTACTED"],
    ]
  );
  assert.deepEqual(await applyBackfill(prisma, first.rows), { created: 3, alreadyImported: 0 });

  const leads = await prisma.lead.findMany({
    where: { email: { endsWith: DOMAIN }, business: "LDB" },
    include: { activities: true },
    orderBy: { createdAt: "asc" },
  });
  assert.deepEqual(leads.map((l) => [l.name, l.stage]), [["Ben Ross", "LOST"], ["Ann Reid", "AWAITING_RESPONSE"], ["Cat Moss", "UNCONTACTED"]]);
  for (const lead of leads) {
    const row = first.rows.find((r) => r.name === lead.name)!;
    assert.equal(lead.createdAt.toISOString(), row.receivedAt.toISOString(), `${lead.name}: dated when the email arrived`);
    assert.equal(lead.source, "WEBSITE_QUOTE_FORM");
    assert.equal(lead.activities.length, 1);
    const note = lead.activities[0];
    assert.equal(note.type, "NOTE");
    assert.equal(note.userId, null);
    assert.equal(note.createdAt.toISOString(), row.receivedAt.toISOString());
    assert.match(note.detail, /^Service type: leaflet-distribution\nFrom the Leaflet Distribution Bournemouth website\n/);
    assert.ok(note.detail.endsWith(`\nImported from Gmail\nGmail message ID: ${row.messageId}`));
  }
  const ben = leads.find((l) => l.name === "Ben Ross")!;
  assert.equal(ben.lostReason, "OTHER");
  assert.equal(ben.lostReasonNote, "Imported old enquiry, no reply on record");
  assert.equal(leads.find((l) => l.name === "Ann Reid")!.targetAreas, "Poole");
  // The Dashboard counts Cat's enquiry on the day it came in, not today.
  assert.equal((await loadDashboard(prisma, period, now, "LDB")).pipeline.newEnquiries - before, 1);

  // The same preview applied again, and a fresh run, both create nothing.
  assert.deepEqual(await applyBackfill(prisma, first.rows), { created: 0, alreadyImported: 3 });
  const second = await planFromDb();
  assert.deepEqual(second.rows.map((r) => r.skip?.kind), ["imported", "imported", "unreadable", "duplicate", "imported"]);
  assert.deepEqual(await applyBackfill(prisma, second.rows), { created: 0, alreadyImported: 0 });
  assert.equal(await prisma.lead.count({ where: { email: { endsWith: DOMAIN }, business: "LDB" } }), 3);
  await cleanUp();
});

test("real database: a failure while writing a lead leaves nothing of it behind", { skip }, async () => {
  const { rows } = await planFromDb();
  const cat = rows.filter((r) => r.messageId === "bf-cat");
  // Each lead is written, then something fails before its transaction ends.
  const failing: ApplyDb = {
    lead: prisma.lead,
    activity: prisma.activity,
    $transaction: (fn) =>
      prisma.$transaction((tx) =>
        fn({
          activity: tx.activity,
          lead: {
            async create(args) {
              await tx.lead.create(args);
              throw new Error("simulated failure");
            },
          },
        })
      ),
  };
  await assert.rejects(applyBackfill(failing, cat), /simulated failure/);
  assert.equal(await prisma.lead.count({ where: { email: `cat${DOMAIN}` } }), 0);
  assert.equal(await prisma.activity.count({ where: { detail: { contains: "Gmail message ID: bf-cat" } } }), 0);
  await cleanUp();
});
