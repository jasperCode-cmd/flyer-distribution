import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { handleLdbApplicationIntake } from "@/lib/ldb-application-intake";
import { APPLICATIONS_PER_HOUR_CAP, handleApplicationRequest } from "@/lib/application-endpoint";
import { APPLICATION_HONEYPOT_FIELD } from "@/lib/distributor-application-form";

// LDB distributor applications against a real database, but only a throwaway
// local one: it needs CRM_TEST_DATABASE_URL pointing at localhost and is
// skipped otherwise, so it can never touch the production database. Test
// applications use phone numbers from the 01632 960 range (set aside for
// drama, never real) or a far-future received date, and are removed after.

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

const SECRET = "test-intake-secret";
// Far enough ahead that no other application is within 7 days of it.
const FUTURE = new Date("2030-01-15T10:00:00.000Z");
let prisma: PrismaClient;

async function cleanUp() {
  await prisma.distributorApplication.deleteMany({
    where: { OR: [{ receivedAt: { gte: new Date("2030-01-01T00:00:00.000Z") } }, { phone: { startsWith: "01632 960" } }] },
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

const post = (body: unknown, headers: Record<string, string> = { "x-intake-secret": SECRET }) =>
  new Request("http://localhost/api/crm/intake/ldb-application", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

const ldb = (body: unknown, now: Date) => handleLdbApplicationIntake(post(body), { db: prisma, secret: SECRET, now: () => now });

const fdhForm = (name: string, phone: string) => ({
  access_key: "k",
  [APPLICATION_HONEYPOT_FIELD]: "",
  name,
  phone,
  area: "Ringwood",
  age: "30",
  "has-car": "Yes",
  "has-licence": "Yes",
  availability: "Weekends",
});

test("real database: an application saved before businesses existed, or without one, is FDH", { skip }, async () => {
  await prisma.$executeRaw`INSERT INTO "DistributorApplication" ("id", "fullName", "phone", "source", "receivedAt", "updatedAt") VALUES ('ldb-app-test-old', 'Old Applicant', '01632 960001', 'WEBSITE_FORM', ${FUTURE}, now())`;
  const old = await prisma.distributorApplication.findUniqueOrThrow({ where: { id: "ldb-app-test-old" } });
  assert.equal(old.business, "FDH");
  const plain = await prisma.distributorApplication.create({ data: { fullName: "Plain", phone: "01632 960002", source: "GMAIL_IMPORT", receivedAt: FUTURE } });
  assert.equal(plain.business, "FDH");
});

test("real database: the LDB form's payload saves every field as a new LDB website application", { skip }, async () => {
  const res = await ldb(
    {
      fullName: "Sarah Jones",
      email: "sarah@example.com",
      phone: "07700900123",
      postcode: "bh8 9ab",
      hasCar: true,
      areas: ["Bournemouth", "Poole", "Christchurch"],
      about: "Retired, free most weekdays.",
    },
    FUTURE
  );
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  const saved = await prisma.distributorApplication.findMany({ where: { phone: "07700900123", receivedAt: FUTURE } });
  assert.equal(saved.length, 1);
  const { id, createdAt, updatedAt, ...fields } = saved[0];
  assert.ok(id && createdAt && updatedAt);
  assert.deepEqual(fields, {
    fullName: "Sarah Jones",
    phone: "07700900123",
    email: "sarah@example.com",
    area: "BH8 9AB, areas: Bournemouth, Poole, Christchurch",
    age: null,
    hasCar: true,
    hasLicence: null,
    availability: "Retired, free most weekdays.",
    status: "NEW",
    notes: null,
    source: "WEBSITE_FORM",
    business: "LDB",
    distributorId: null,
    gmailMessageId: null,
    receivedAt: FUTURE,
  });
});

test("real database: the same phone within 7 days, through either website, is noted on the first application, naming the website", { skip }, async () => {
  const first = await handleApplicationRequest(post(fdhForm("Dee Hart", "01632 960100"), {}), { db: prisma, allow: () => true, now: () => FUTURE });
  assert.equal(first.status, 200);
  const later = new Date(FUTURE.getTime() + 2 * 24 * 60 * 60 * 1000);
  const again = await ldb({ fullName: "Dee Hart", phone: "+44 1632 960100", postcode: "bh1 1aa", hasLicence: "yes" }, later);
  assert.equal(again.status, 200);
  const rows = await prisma.distributorApplication.findMany({ where: { phone: { in: ["01632 960100", "+44 1632 960100"] } } });
  assert.equal(rows.length, 1, "no second application");
  assert.equal(rows[0].business, "FDH", "the first one keeps its business");
  assert.match(rows[0].notes ?? "", /^Applied again through the Leaflet Distribution Bournemouth website on 17 Jan 2030\./);
  assert.match(rows[0].notes ?? "", /Where they live: BH1 1AA/);

  // An LDB application first, then the FDH form.
  await ldb({ fullName: "Ray Cole", phone: "01632 960200" }, FUTURE);
  await handleApplicationRequest(post(fdhForm("Ray Cole", "01632960200"), {}), { db: prisma, allow: () => true, now: () => later });
  const ray = await prisma.distributorApplication.findMany({ where: { phone: { startsWith: "01632 960200" } } });
  assert.equal(ray.length, 1);
  assert.equal(ray[0].business, "LDB");
  assert.match(ray[0].notes ?? "", /^Applied again through the Flyer Distribution Hampshire website on 17 Jan 2030\./);
});

test("real database: 60 LDB website applications in the hour stop the 61st, while the FDH form, with its own cap, still takes one", { skip }, async () => {
  const now = new Date();
  await prisma.distributorApplication.createMany({
    data: Array.from({ length: APPLICATIONS_PER_HOUR_CAP }, (_, i) => ({
      fullName: `Flood ${i}`,
      phone: `01632 960${String(300 + i).padStart(3, "0")}`,
      source: "WEBSITE_FORM" as const,
      business: "LDB" as const,
      receivedAt: now,
    })),
  });
  const res = await ldb({ fullName: "One Too Many", phone: "01632 960999" }, now);
  assert.equal(res.status, 429);
  assert.deepEqual(await res.json(), { error: "Too many requests" });
  assert.equal(await prisma.distributorApplication.count({ where: { phone: "01632 960999" } }), 0);

  const fdh = await handleApplicationRequest(post(fdhForm("Still Fine", "01632 960998"), {}), { db: prisma, allow: () => true, now: () => now });
  assert.equal(fdh.status, 200);
  const saved = await prisma.distributorApplication.findFirstOrThrow({ where: { phone: "01632 960998" } });
  assert.equal(saved.business, "FDH");
});
