import { test } from "node:test";
import assert from "node:assert/strict";
import {
  filterApplications,
  type ApplicationFields,
  type ApplicationListItem,
} from "@/lib/distributor-applications";
import { APPLICATIONS_PER_HOUR_CAP, handleApplicationRequest, type ApplicationEndpointDb } from "@/lib/application-endpoint";
import { handleLdbApplicationIntake, validateLdbApplication } from "@/lib/ldb-application-intake";
import { saveImportedApplications, type ImportCandidate } from "@/lib/application-import";
import { buildPriorities, rowsForBusiness, type PriorityInputs } from "@/lib/priorities";
import { APPLICATION_HONEYPOT_FIELD } from "@/lib/distributor-application-form";

// Distributor applications from the Leaflet Distribution Bournemouth website:
// the intake endpoint's protection and checks, the LDB form's own fields, the
// duplicate rule across both websites, each website's own hourly cap, and
// the business showing through the Applications filter and Priorities. No
// database here; documents-free fakes stand in for Prisma.

const SECRET = "test-intake-secret";
const NOW = new Date("2026-10-19T12:00:00Z");

// The LDB form's real payload, as given.
const SARAH = {
  fullName: "Sarah Jones",
  email: "sarah@example.com",
  phone: "07700900123",
  postcode: "bh8 9ab",
  hasCar: true,
  areas: ["Bournemouth", "Poole", "Christchurch"],
  about: "Retired, free most weekdays.",
};

type Stored = ApplicationFields & { id: string; notes: string | null; receivedAt: Date };
type CountWhere = { source: string; business: string; createdAt: { gte: Date } };

function fakeDb(seed: Stored[] = [], opts: { lastHour?: number; failCreate?: boolean } = {}) {
  const created: Record<string, unknown>[] = [];
  const updates: { where: { id: string }; data: { notes: string } }[] = [];
  const counts: CountWhere[] = [];
  const db: ApplicationEndpointDb = {
    distributorApplication: {
      async findMany(args) {
        return seed.filter((r) => r.receivedAt >= args.where.receivedAt.gte && r.phone !== null);
      },
      async create(args) {
        if (opts.failCreate) throw Object.assign(new Error(`insert failed for ${args.data.fullName} ${args.data.phone}`), { code: "P1001" });
        created.push(args.data);
        return { id: `new${created.length}` };
      },
      async update(args) {
        updates.push(args);
        return {};
      },
      async count(args) {
        counts.push(args.where);
        return opts.lastHour ?? 0;
      },
    },
  };
  return { db, created, updates, counts };
}

function post(body: unknown, headers: Record<string, string> = { "x-intake-secret": SECRET }): Request {
  return new Request("http://localhost/api/crm/intake/ldb-application", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

// The secret the CRM holds; pass undefined to test it not being set.
const intake = (req: Request, db: ApplicationEndpointDb, ...secret: [string | undefined] | []) =>
  handleLdbApplicationIntake(req, { db, secret: secret.length ? secret[0] : SECRET, now: () => NOW });

// --- The secret --------------------------------------------------------------------

test("a missing or wrong secret is 401, as is any request while LDB_INTAKE_SECRET isn't set, and nothing is touched", async () => {
  for (const [headers, secret] of [
    [{}, SECRET],
    [{ "x-intake-secret": "wrong" }, SECRET],
    [{ "x-intake-secret": `${SECRET}x` }, SECRET],
    [{ "x-intake-secret": "" }, SECRET],
    [{ "x-intake-secret": SECRET }, undefined],
    [{ "x-intake-secret": SECRET }, ""],
  ] as [Record<string, string>, string | undefined][]) {
    const { db, created, updates, counts } = fakeDb();
    const res = await intake(post(SARAH, headers), db, secret);
    assert.equal(res.status, 401);
    assert.deepEqual(await res.json(), { error: "Unauthorized" });
    assert.equal(created.length + updates.length + counts.length, 0);
  }
});

// --- The agreed payload ------------------------------------------------------------

test("the LDB form's payload returns 200 with only {ok:true} and saves every field, as business LDB from the website form", async () => {
  const { db, created } = fakeDb();
  const res = await intake(post(SARAH), db);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  assert.deepEqual(created, [
    {
      fullName: "Sarah Jones",
      phone: "07700900123",
      email: "sarah@example.com",
      area: "BH8 9AB, areas: Bournemouth, Poole, Christchurch",
      age: null,
      hasCar: true,
      hasLicence: null,
      availability: "Retired, free most weekdays.",
      source: "WEBSITE_FORM",
      business: "LDB",
      receivedAt: NOW,
    },
  ]);
});

test("the original keys still work, and with both availability and about, about follows it", () => {
  const result = validateLdbApplication({
    fullName: "  Tom   Reed ",
    phone: "+44 7700 900456",
    email: "tom@example.com",
    area: "Boscombe",
    postcode: "bh5 1aa",
    areas: "Southbourne, Pokesdown",
    age: "34",
    hasCar: "yes",
    hasLicence: "no",
    availability: "Weekends\n\n\n\nand evenings",
    about: "Used to deliver for a local paper.",
    unknownField: "ignored",
  });
  assert.ok(result.ok);
  if (!result.ok) return;
  assert.deepEqual(result.fields, {
    fullName: "Tom Reed",
    phone: "+44 7700 900456",
    email: "tom@example.com",
    area: "Boscombe, BH5 1AA, areas: Southbourne, Pokesdown",
    age: "34",
    hasCar: true,
    hasLicence: false,
    availability: "Weekends\n\nand evenings\n\nAbout: Used to deliver for a local paper.",
  });
  // Name and phone are all it needs; the rest stay empty.
  const minimal = validateLdbApplication({ fullName: "Ana", phone: "01202 555000" });
  assert.ok(minimal.ok && minimal.fields.area === null && minimal.fields.age === null && minimal.fields.hasLicence === null && minimal.fields.availability === null);
});

// --- Checks ---------------------------------------------------------------------------

test("validation: required fields, types, email shape and every length limit, each with a reason", () => {
  const base = { fullName: "Sarah Jones", phone: "07700900123" };
  const cases: [Record<string, unknown>, string][] = [
    [{ phone: "07700900123" }, "fullName is required"],
    [{ fullName: "   ", phone: "07700900123" }, "fullName is required"],
    [{ fullName: "Sarah" }, "phone is required"],
    [{ ...base, phone: "call me" }, "Invalid phone"],
    [{ ...base, fullName: 42 }, "Invalid fullName"],
    [{ ...base, phone: 7700900123 }, "Invalid phone"],
    [{ ...base, email: "not-an-email" }, "Invalid email"],
    [{ ...base, email: ["a@b.co"] }, "Invalid email"],
    [{ ...base, fullName: "a".repeat(101) }, "fullName is too long"],
    [{ ...base, phone: `0${"1".repeat(30)}` }, "phone is too long"],
    [{ ...base, email: `${"a".repeat(250)}@b.co` }, "email is too long"],
    [{ ...base, area: "a".repeat(101) }, "area is too long"],
    [{ ...base, postcode: "BH8 9AB XYZ" }, "postcode is too long"],
    [{ ...base, age: "a".repeat(21) }, "age is too long"],
    [{ ...base, availability: "a".repeat(1001) }, "availability is too long"],
    [{ ...base, about: "a".repeat(1001) }, "about is too long"],
    [{ ...base, areas: ["a".repeat(150), "b".repeat(150)] }, "areas is too long"],
    [{ ...base, areas: ["Poole", 3] }, "Invalid areas"],
    [{ ...base, areas: { town: "Poole" } }, "Invalid areas"],
  ];
  for (const [body, error] of cases) assert.deepEqual(validateLdbApplication(body), { ok: false, error }, JSON.stringify(body).slice(0, 60));
  // Exactly at the limits is fine.
  assert.equal(validateLdbApplication({ ...base, fullName: "a".repeat(100), area: "a".repeat(100), postcode: "a".repeat(10), about: "a".repeat(1000) }).ok, true);
  assert.deepEqual(validateLdbApplication([]), { ok: false, error: "Invalid application" });
});

test("the endpoint answers 400 for bad JSON or a bad field, 413 for an oversized body, and saves nothing", async () => {
  const { db, created } = fakeDb();
  const bad = await intake(post("{not json"), db);
  assert.equal(bad.status, 400);
  assert.deepEqual(await bad.json(), { error: "Invalid application" });
  const field = await intake(post({ ...SARAH, email: "nope" }), db);
  assert.equal(field.status, 400);
  assert.deepEqual(await field.json(), { error: "Invalid email" });
  const big = await intake(post({ ...SARAH, about: "a".repeat(20_000) }), db);
  assert.equal(big.status, 413);
  assert.equal(created.length, 0);
});

test("hasCar and hasLicence: true or false, or yes or no in any case; empty means not given; anything else is refused", () => {
  const base = { fullName: "Sarah", phone: "07700900123" };
  const ok: [unknown, boolean | null][] = [
    [true, true],
    [false, false],
    ["yes", true],
    ["no", false],
    ["YES", true],
    [" No ", false],
    ["", null],
    [null, null],
    [undefined, null],
  ];
  for (const [value, expected] of ok) {
    for (const key of ["hasCar", "hasLicence"] as const) {
      const result = validateLdbApplication({ ...base, [key]: value });
      assert.ok(result.ok, `${key} ${JSON.stringify(value)}`);
      assert.equal(result.ok && result.fields[key], expected, `${key} ${JSON.stringify(value)}`);
    }
  }
  for (const value of ["maybe", "y", 1, 0, ["yes"]]) {
    assert.deepEqual(validateLdbApplication({ ...base, hasCar: value }), { ok: false, error: "Invalid hasCar" });
    assert.deepEqual(validateLdbApplication({ ...base, hasLicence: value }), { ok: false, error: "Invalid hasLicence" });
  }
});

// --- Duplicates and the cap ----------------------------------------------------------

const stored = (overrides: Partial<Stored>): Stored => ({
  id: "app1",
  fullName: "Sarah Jones",
  phone: "07700 900123",
  email: null,
  area: "Ferndown",
  age: null,
  hasCar: null,
  hasLicence: null,
  availability: null,
  notes: null,
  receivedAt: new Date("2026-10-15T09:00:00Z"),
  ...overrides,
});

test("duplicates: the same phone within 7 days, from either website, adds a note naming the website instead of a second application", async () => {
  // An FDH application, then the same person through the Bournemouth website.
  const ldb = fakeDb([stored({})]);
  const res = await intake(post(SARAH), ldb.db);
  assert.deepEqual(await res.json(), { ok: true });
  assert.equal(ldb.created.length, 0);
  assert.equal(ldb.updates.length, 1);
  assert.match(ldb.updates[0].data.notes, /^Applied again through the Leaflet Distribution Bournemouth website on 19 Oct 2026\./);
  assert.ok(ldb.updates[0].data.notes.includes("Where they live: BH8 9AB, areas: Bournemouth, Poole, Christchurch"));

  // And the other way round: a Bournemouth application, then the FDH form.
  const fdh = fakeDb([stored({ phone: "+447700900123" })]);
  const form = {
    access_key: "k",
    [APPLICATION_HONEYPOT_FIELD]: "",
    name: "Sarah Jones",
    phone: "07700900123",
    area: "Ferndown",
    age: "40",
    "has-car": "Yes",
    "has-licence": "Yes",
    availability: "Weekdays",
  };
  await handleApplicationRequest(post(form, {}), { db: fdh.db, allow: () => true, now: () => NOW });
  assert.equal(fdh.created.length, 0);
  assert.match(fdh.updates[0].data.notes, /^Applied again through the Flyer Distribution Hampshire website on 19 Oct 2026\./);

  // More than 7 days ago is a new application.
  const old = fakeDb([stored({ receivedAt: new Date("2026-10-01T09:00:00Z") })]);
  await intake(post(SARAH), old.db);
  assert.equal(old.created.length, 1);
});

test("each website has its own hourly cap of 60, counting only its own business's applications", async () => {
  const full = fakeDb([], { lastHour: APPLICATIONS_PER_HOUR_CAP });
  const res = await intake(post(SARAH), full.db);
  assert.equal(res.status, 429);
  assert.deepEqual(await res.json(), { error: "Too many requests" });
  assert.equal(full.created.length, 0);
  assert.deepEqual(full.counts.map((w) => [w.source, w.business, NOW.getTime() - w.createdAt.gte.getTime()]), [["WEBSITE_FORM", "LDB", 60 * 60 * 1000]]);

  const under = fakeDb([], { lastHour: APPLICATIONS_PER_HOUR_CAP - 1 });
  assert.equal((await intake(post(SARAH), under.db)).status, 200);

  // The FDH form's cap counts FDH ones only.
  const fdh = fakeDb();
  const form = { access_key: "k", [APPLICATION_HONEYPOT_FIELD]: "", name: "Sam", phone: "07700900999", area: "Ringwood", age: "30", "has-car": "No", "has-licence": "No", availability: "Any" };
  await handleApplicationRequest(post(form, {}), { db: fdh.db, allow: () => true, now: () => NOW });
  assert.deepEqual(fdh.counts.map((w) => [w.source, w.business]), [["WEBSITE_FORM", "FDH"]]);
});

test("a database failure is a 500 that logs nothing about the applicant", async () => {
  const { db } = fakeDb([], { failCreate: true });
  const lines: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => lines.push(args.map(String).join(" "));
  try {
    const res = await intake(post(SARAH), db);
    assert.equal(res.status, 500);
    assert.deepEqual(await res.json(), { error: "Could not save application" });
  } finally {
    console.error = original;
  }
  assert.ok(lines.length > 0);
  for (const value of ["Sarah", "07700900123", "sarah@example.com", "BH8", "Retired"]) {
    assert.ok(!lines.join("\n").includes(value), value);
  }
});

// --- Where the business shows ---------------------------------------------------------

const listItem = (id: string, business: "FDH" | "LDB" | undefined): ApplicationListItem => ({
  id,
  status: "NEW",
  business,
  fullName: id,
  phone: null,
  email: null,
  area: null,
  age: null,
  hasCar: null,
  hasLicence: null,
  availability: null,
});

test("the Applications filter: All, FDH (including ones from before businesses) or LDB", () => {
  const apps = [listItem("fdh", "FDH"), listItem("ldb", "LDB"), listItem("old", undefined)];
  assert.deepEqual(filterApplications(apps, {}).map((a) => a.id), ["fdh", "ldb", "old"]);
  assert.deepEqual(filterApplications(apps, { business: "FDH" }).map((a) => a.id), ["fdh", "old"]);
  assert.deepEqual(filterApplications(apps, { business: "LDB" }).map((a) => a.id), ["ldb"]);
  assert.deepEqual(filterApplications(apps, { business: "LDB", status: "CONTACTED" }), []);
});

test("Priorities: a new LDB application is Low with its business, and follows the business filter", () => {
  const app = (id: string, business?: "FDH" | "LDB") => ({
    id,
    fullName: id,
    email: null,
    phone: null,
    business,
    status: "NEW",
    receivedAt: "2026-10-18T09:00:00.000Z",
    updatedAt: "2026-10-18T09:00:00.000Z",
  });
  const inputs: PriorityInputs = {
    now: NOW,
    leads: [],
    applications: [app("ldb-app", "LDB"), app("fdh-app", "FDH"), app("old-app")],
    tasks: [],
    emails: [],
    dismissals: [],
  };
  const rows = buildPriorities(inputs);
  const ldb = rows.find((r) => r.id === "application:ldb-app")!;
  assert.equal(ldb.level, "LOW");
  assert.deepEqual(ldb.primary.subject, { kind: "application", id: "ldb-app", name: "ldb-app", email: null, phone: null, business: "LDB" });
  const keys = (filter: "ALL" | "FDH" | "LDB") => rowsForBusiness(rows, filter).map((r) => r.id).sort();
  assert.deepEqual(keys("ALL"), ["application:fdh-app", "application:ldb-app", "application:old-app"]);
  assert.deepEqual(keys("LDB"), ["application:ldb-app"]);
  assert.deepEqual(keys("FDH"), ["application:fdh-app", "application:old-app"]);
});

test("the Gmail import stays FDH: every imported application is saved as FDH", async () => {
  let saved: Record<string, unknown>[] = [];
  const candidate = {
    messageId: "m1",
    receivedAt: "2026-10-01T09:00:00.000Z",
    parsed: {
      readable: true,
      fields: { fullName: "Old Applicant", phone: "07700900321", email: null, area: null, age: null, hasCar: null, hasLicence: null, availability: null },
    },
  } as unknown as ImportCandidate;
  await saveImportedApplications(
    {
      distributorApplication: {
        async createMany(args) {
          saved = args.data;
          return { count: args.data.length };
        },
      },
    },
    [candidate],
    new Map()
  );
  assert.equal(saved.length, 1);
  assert.equal(saved[0].business, "FDH");
  assert.equal(saved[0].source, "GMAIL_IMPORT");
});
