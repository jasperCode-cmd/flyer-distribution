import { test, mock } from "node:test";
import assert from "node:assert/strict";
import type { gmail_v1 } from "@googleapis/gmail";
import {
  validateWebsiteApplication,
  saveWebsiteApplication,
  parseApplicationEmail,
  parseApplicationText,
  approveApplicationAsDistributor,
  normalizePhone,
  phonesMatch,
  whatsAppHref,
  telHref,
  filterApplications,
  type ApplicationFields,
  type ApplicationListItem,
  type ApproveDb,
} from "@/lib/distributor-applications";
import { handleApplicationRequest, APPLICATIONS_PER_HOUR_CAP, type ApplicationEndpointDb } from "@/lib/application-endpoint";
import {
  APPLICATION_HONEYPOT_FIELD,
  DISTRIBUTOR_APPLICATION_SUBJECT,
  WEB3FORMS_ENDPOINT,
  APPLICATION_ENDPOINT,
  submitDistributorApplication,
} from "@/lib/distributor-application-form";
import {
  findApplicationEmails,
  loadSelectedApplicationEmails,
  flagDuplicates,
  saveImportedApplications,
  type ImportCandidate,
} from "@/lib/application-import";
import { extractTextVariants, type GmailMessageReader } from "@/lib/gmail";
import { buildDistributorData } from "@/lib/distributors";
import { createRateLimiter } from "@/lib/rate-limit";

const US = "flyerdistributionhampshire@gmail.com";
const NOW = new Date("2026-10-10T12:00:00Z");

// What the real Work With Us form sends (Object.fromEntries of its FormData).
function formEntries(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    access_key: "test-access-key",
    subject: DISTRIBUTOR_APPLICATION_SUBJECT,
    [APPLICATION_HONEYPOT_FIELD]: "",
    name: "Sam Example",
    phone: "07700 900123",
    email: "sam@example.com",
    area: "Southampton, SO15 2AB",
    age: "17",
    "has-car": "No",
    "has-licence": "No",
    availability: "Weekday mornings and most weekends",
    ...overrides,
  };
}

// --- Validation ----------------------------------------------------------------

test("validation accepts what the real form sends and tidies it", () => {
  const result = validateWebsiteApplication(
    formEntries({ name: "  Sam   Example ", availability: "Mornings\r\nand weekends, any day" }),
    APPLICATION_HONEYPOT_FIELD
  );
  assert.ok(result.ok && !result.honeypot);
  assert.deepEqual(result.fields, {
    fullName: "Sam Example",
    phone: "07700 900123",
    email: "sam@example.com",
    area: "Southampton, SO15 2AB",
    age: "17",
    hasCar: false,
    hasLicence: false,
    availability: "Mornings\nand weekends, any day",
  });
});

test("validation: email is optional, age is kept exactly as given", () => {
  const result = validateWebsiteApplication(formEntries({ email: "", age: "016" }), APPLICATION_HONEYPOT_FIELD);
  assert.ok(result.ok && !result.honeypot);
  assert.equal(result.fields.email, null);
  assert.equal(result.fields.age, "016");
});

const BAD_INPUTS: [string, unknown][] = [
  ["not an object", "hello"],
  ["an array", [1, 2]],
  ["a missing name", formEntries({ name: "  " })],
  ["a name that isn't a string", { ...formEntries(), name: 42 }],
  ["a phone with too few digits", formEntries({ phone: "12345" })],
  ["a phone with markup", formEntries({ phone: "<b>07700900123</b>" })],
  ["a bad email", formEntries({ email: "not-an-email" })],
  ["a missing area", formEntries({ area: "" })],
  ["an age of zero", formEntries({ age: "0" })],
  ["an age that isn't a number", formEntries({ age: "old" })],
  ["car access that isn't Yes or No", formEntries({ "has-car": "maybe" })],
  ["a missing licence answer", formEntries({ "has-licence": "" })],
  ["empty availability", formEntries({ availability: "   " })],
  ["a name over 120 characters", formEntries({ name: "a".repeat(121) })],
  ["availability over 2000 characters", formEntries({ availability: "a".repeat(2001) })],
  ["a honeypot that isn't a string", { ...formEntries(), [APPLICATION_HONEYPOT_FIELD]: ["x"] }],
];

for (const [label, input] of BAD_INPUTS) {
  test(`validation rejects ${label}`, () => {
    const result = validateWebsiteApplication(input, APPLICATION_HONEYPOT_FIELD);
    assert.equal(result.ok, false);
  });
}

// --- The public endpoint --------------------------------------------------------

type Stored = ApplicationFields & { id: string; notes: string | null; receivedAt: Date };

function fakeEndpointDb(seed: Stored[] = [], opts: { failCreate?: boolean; lastHour?: number } = {}) {
  const rows = [...seed];
  const created: unknown[] = [];
  const updates: { where: { id: string }; data: { notes: string } }[] = [];
  let countCalls = 0;
  const db: ApplicationEndpointDb = {
    distributorApplication: {
      async findMany(args) {
        return rows.filter((r) => r.receivedAt >= args.where.receivedAt.gte && r.phone !== null);
      },
      async create(args) {
        if (opts.failCreate) throw Object.assign(new Error(`insert failed for ${args.data.fullName}`), { code: "P1001" });
        created.push(args.data);
        return { id: `new${created.length}` };
      },
      async update(args) {
        updates.push(args);
        return {};
      },
      async count() {
        countCalls++;
        return opts.lastHour ?? 0;
      },
    },
  };
  return { db, created, updates, countCalls: () => countCalls };
}

function post(body: unknown, headers: Record<string, string> = {}): Request {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return new Request("http://localhost/api/distributor-application", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.9", ...headers },
    body: text,
  });
}

const allowAll = () => true;

test("endpoint saves a valid application and returns nothing that was stored", async () => {
  const { db, created } = fakeEndpointDb();
  const res = await handleApplicationRequest(post(formEntries()), { db, allow: allowAll, now: () => NOW });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  assert.equal(created.length, 1);
  assert.deepEqual(created[0], {
    fullName: "Sam Example",
    phone: "07700 900123",
    email: "sam@example.com",
    area: "Southampton, SO15 2AB",
    age: "17",
    hasCar: false,
    hasLicence: false,
    availability: "Weekday mornings and most weekends",
    source: "WEBSITE_FORM",
    business: "FDH",
    receivedAt: NOW,
  });
});

test("endpoint rejects bad input and saves nothing", async () => {
  const { db, created } = fakeEndpointDb();
  const bad = await handleApplicationRequest(post(formEntries({ phone: "" })), { db, allow: allowAll });
  assert.equal(bad.status, 400);
  const notJson = await handleApplicationRequest(post("{not json"), { db, allow: allowAll });
  assert.equal(notJson.status, 400);
  const wrongType = await handleApplicationRequest(post({ ...formEntries(), age: 17 }), { db, allow: allowAll });
  assert.equal(wrongType.status, 400);
  assert.equal(created.length, 0);
});

test("endpoint refuses an oversized body before reading it as JSON", async () => {
  const { db, created } = fakeEndpointDb();
  const huge = JSON.stringify({ ...formEntries(), availability: "a".repeat(20_000) });
  const res = await handleApplicationRequest(post(huge), { db, allow: allowAll });
  assert.equal(res.status, 413);
  assert.equal(created.length, 0);
});

test("honeypot: a filled hidden field gets the normal success answer but nothing is saved", async () => {
  const { db, created, updates, countCalls } = fakeEndpointDb();
  const res = await handleApplicationRequest(
    post(formEntries({ [APPLICATION_HONEYPOT_FIELD]: "http://spam.example" })),
    { db, allow: allowAll }
  );
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  assert.equal(created.length, 0);
  assert.equal(updates.length, 0);
  assert.equal(countCalls(), 0);
});

test("rate limit: a caller over the limit gets 429 and nothing is saved", async () => {
  const { db, created } = fakeEndpointDb();
  const res = await handleApplicationRequest(post(formEntries()), { db, allow: () => false });
  assert.equal(res.status, 429);
  assert.equal(created.length, 0);
});

test("rate limit: the hourly cap across all callers is enforced from the database", async () => {
  const { db, created } = fakeEndpointDb([], { lastHour: APPLICATIONS_PER_HOUR_CAP });
  const res = await handleApplicationRequest(post(formEntries()), { db, allow: allowAll });
  assert.equal(res.status, 429);
  assert.equal(created.length, 0);
});

test("the limiter allows the set number per window per caller, then lets them back in", () => {
  const allow = createRateLimiter({ max: 2, windowMs: 1000 });
  assert.equal(allow("a", 0), true);
  assert.equal(allow("a", 10), true);
  assert.equal(allow("a", 20), false);
  assert.equal(allow("b", 20), true);
  assert.equal(allow("a", 1011), true);
});

test("a database failure answers 500 and never logs the applicant's details", async () => {
  const { db } = fakeEndpointDb([], { failCreate: true });
  const errors: unknown[][] = [];
  const spy = mock.method(console, "error", (...args: unknown[]) => {
    errors.push(args);
  });
  try {
    const res = await handleApplicationRequest(post(formEntries()), { db, allow: allowAll });
    assert.equal(res.status, 500);
  } finally {
    spy.mock.restore();
  }
  const logged = JSON.stringify(errors);
  assert.ok(errors.length > 0);
  for (const secret of ["Sam Example", "07700", "sam@example.com", "SO15", "Weekday"]) {
    assert.ok(!logged.includes(secret), `log must not contain ${secret}`);
  }
});

test("duplicate: the same phone within 7 days, in another format, is noted on the existing application, not created", async () => {
  const existing: Stored = {
    id: "app1",
    fullName: "Sam Example",
    phone: "+44 7700 900123",
    email: null,
    area: "Southampton",
    age: "17",
    hasCar: false,
    hasLicence: false,
    availability: "Weekends",
    notes: "Spoke on WhatsApp.",
    receivedAt: new Date("2026-10-06T09:00:00Z"),
  };
  const { db, created, updates } = fakeEndpointDb([existing]);
  const res = await handleApplicationRequest(post(formEntries()), { db, allow: allowAll, now: () => NOW });
  assert.deepEqual(await res.json(), { ok: true });
  assert.equal(created.length, 0);
  assert.equal(updates.length, 1);
  assert.equal(updates[0].where.id, "app1");
  const notes = updates[0].data.notes;
  assert.ok(notes.startsWith("Spoke on WhatsApp.\n\nApplied again through the Flyer Distribution Hampshire website on 10 Oct 2026."));
  assert.ok(notes.includes("Email: sam@example.com"));
  assert.ok(notes.includes("Where they live: Southampton, SO15 2AB"));
  assert.ok(!notes.includes("Age:"), "unchanged fields aren't repeated");
  assert.ok(!notes.includes("Phone:"), "the same number in another format isn't a change");
});

test("duplicate: the same phone more than 7 days ago is a new application", async () => {
  const old: Stored = {
    id: "app0",
    fullName: "Sam Example",
    phone: "07700900123",
    email: null,
    area: null,
    age: null,
    hasCar: null,
    hasLicence: null,
    availability: null,
    notes: null,
    receivedAt: new Date("2026-09-01T09:00:00Z"),
  };
  const { db, created, updates } = fakeEndpointDb([old]);
  await handleApplicationRequest(post(formEntries()), { db, allow: allowAll, now: () => NOW });
  assert.equal(created.length, 1);
  assert.equal(updates.length, 0);
});

test("saveWebsiteApplication only looks back 7 days", async () => {
  const seen: Date[] = [];
  await saveWebsiteApplication(
    {
      distributorApplication: {
        async findMany(args) {
          seen.push(args.where.receivedAt.gte);
          return [];
        },
        async create() {
          return { id: "x" };
        },
        async update() {
          return {};
        },
      },
    },
    { fullName: "A", phone: "07700900123", email: null, area: null, age: null, hasCar: null, hasLicence: null, availability: null },
    NOW
  );
  assert.equal(seen[0].toISOString(), "2026-10-03T12:00:00.000Z");
});

// --- The form: success never depends on the CRM -----------------------------------

function fakeFetch(handlers: { web3forms: () => Promise<Response>; crm: () => Promise<Response> }) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fn = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return String(url) === WEB3FORMS_ENDPOINT ? handlers.web3forms() : handlers.crm();
  }) as typeof fetch;
  return { fn, calls };
}

const web3formsOk = async () => Response.json({ success: true });

for (const [label, crm] of [
  ["the CRM save fails with a server error", async () => new Response("{}", { status: 500 })],
  ["the CRM save can't connect at all", async () => Promise.reject(new TypeError("Failed to fetch"))],
  ["the CRM save hangs", () => new Promise<Response>(() => {})],
] as const) {
  test(`form still shows success when ${label}`, async () => {
    const { fn, calls } = fakeFetch({ web3forms: web3formsOk, crm });
    const entries = formEntries();
    assert.equal(await submitDistributorApplication(entries, fn), true);
    assert.equal(calls.length, 2);
    assert.equal(calls[1].url, APPLICATION_ENDPOINT);
  });
}

test("form: a CRM request that throws before it starts still leaves the form successful", async () => {
  let n = 0;
  const fn = (async () => {
    n++;
    if (n === 2) throw new Error("boom");
    return Response.json({ success: true });
  }) as unknown as typeof fetch;
  const throwing = ((url: string | URL | Request, init?: RequestInit) => {
    if (String(url) === APPLICATION_ENDPOINT) throw new TypeError("keepalive body too large");
    return fn(url, init);
  }) as typeof fetch;
  assert.equal(await submitDistributorApplication(formEntries(), throwing), true);
});

test("form: Web3Forms gets exactly what it got before (no honeypot, same order) and the CRM gets only the fields", async () => {
  const { fn, calls } = fakeFetch({ web3forms: web3formsOk, crm: async () => Response.json({ ok: true }) });
  const entries = formEntries();
  await submitDistributorApplication(entries, fn);

  const before = { ...entries };
  delete before[APPLICATION_HONEYPOT_FIELD];
  assert.equal(calls[0].url, WEB3FORMS_ENDPOINT);
  assert.equal(calls[0].init.body, JSON.stringify(before));
  assert.deepEqual(calls[0].init.headers, { "Content-Type": "application/json", Accept: "application/json" });

  const crmBody = JSON.parse(String(calls[1].init.body));
  assert.equal(crmBody.access_key, undefined);
  assert.equal(crmBody.subject, undefined);
  assert.equal(crmBody.name, "Sam Example");
  assert.equal(crmBody[APPLICATION_HONEYPOT_FIELD], "");
  assert.equal(calls[1].init.keepalive, true);
});

test("form: when Web3Forms fails the form shows its error and the CRM is never called", async () => {
  const { fn, calls } = fakeFetch({
    web3forms: async () => Response.json({ success: false }),
    crm: async () => Response.json({ ok: true }),
  });
  assert.equal(await submitDistributorApplication(formEntries(), fn), false);
  assert.equal(calls.length, 1);
});

// --- Reading an application email --------------------------------------------------

function b64url(input: string): string {
  return Buffer.from(input, "utf-8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// The layout of a Web3Forms notification is assumed (one row per field, the
// input's name as the label). The parser is written to cope with other
// layouts too, covered below.
const SAMPLE_HTML = `<html><body>
<h2>New Distributor Application - Flyer Distribution Hampshire</h2>
<table>
<tr><td><b>Name</b></td><td>Sam Example</td></tr>
<tr><td><b>Phone</b></td><td>07700 900123</td></tr>
<tr><td><b>Email</b></td><td><a href="mailto:sam@example.com">sam@example.com</a></td></tr>
<tr><td><b>Area</b></td><td>Southampton, SO15 2AB</td></tr>
<tr><td><b>Age</b></td><td>17</td></tr>
<tr><td><b>Has-car</b></td><td>No</td></tr>
<tr><td><b>Has-licence</b></td><td>Yes</td></tr>
<tr><td><b>Availability</b></td><td>Weekday mornings<br>and most weekends</td></tr>
</table>
<p>This email was sent via Web3Forms. Unsubscribe.</p>
</body></html>`;

function htmlMessage(html: string, opts: { id?: string; threadId?: string; headers?: Record<string, string>; labelIds?: string[]; internalDate?: number } = {}): gmail_v1.Schema$Message {
  return {
    id: opts.id ?? "m1",
    threadId: opts.threadId ?? "t1",
    labelIds: opts.labelIds ?? ["INBOX"],
    internalDate: String(opts.internalDate ?? Date.parse("2026-09-25T10:30:00Z")),
    payload: {
      mimeType: "multipart/alternative",
      headers: Object.entries({
        From: "Notifications <notify@forms.example>",
        To: US,
        Subject: DISTRIBUTOR_APPLICATION_SUBJECT,
        ...(opts.headers ?? {}),
      }).map(([name, value]) => ({ name, value })),
      parts: [{ mimeType: "text/html", body: { data: b64url(html) } }],
    },
  };
}

test("parsing a sample Web3Forms application email (HTML table) reads every field", () => {
  const { plain, fromHtml } = extractTextVariants(htmlMessage(SAMPLE_HTML).payload);
  assert.equal(plain, null);
  assert.ok(fromHtml && !fromHtml.includes("<"), "only plain text, never HTML");
  const parsed = parseApplicationEmail({ plain, fromHtml, replyTo: null });
  assert.equal(parsed.readable, true);
  assert.deepEqual(parsed.missing, []);
  assert.deepEqual(parsed.fields, {
    fullName: "Sam Example",
    phone: "07700 900123",
    email: "sam@example.com",
    area: "Southampton, SO15 2AB",
    age: "17",
    hasCar: false,
    hasLicence: true,
    availability: "Weekday mornings\nand most weekends",
  });
});

test("parsing an application email with a missing field lists it as missing and keeps the rest", () => {
  const html = SAMPLE_HTML.replace("<tr><td><b>Age</b></td><td>17</td></tr>", "");
  const parsed = parseApplicationEmail({ plain: null, fromHtml: extractTextVariants(htmlMessage(html).payload).fromHtml, replyTo: null });
  assert.equal(parsed.readable, true);
  assert.deepEqual(parsed.missing, ["age"]);
  assert.equal(parsed.fields.age, null);
  assert.equal(parsed.fields.fullName, "Sam Example");
  assert.equal(parsed.fields.availability, "Weekday mornings\nand most weekends");
});

test("parsing a plain text 'Label: value' email, with the form's own labels", () => {
  const text = [
    "New Distributor Application - Flyer Distribution Hampshire",
    "",
    "Full name: Alex Rivers",
    "Phone number : +44 7700 900456",
    "Where do you live?: Eastleigh",
    "Age: 34",
    "Access to a car?: Yes",
    "Full UK licence?: Yes",
    "Availability: Any weekday afternoon",
    "",
    "--",
    "Sent from Web3Forms",
  ].join("\n");
  const parsed = parseApplicationEmail({ plain: text, fromHtml: null, replyTo: "alex@example.com" });
  assert.deepEqual(parsed.missing, []);
  assert.equal(parsed.fields.fullName, "Alex Rivers");
  assert.equal(parsed.fields.phone, "+44 7700 900456");
  assert.equal(parsed.fields.area, "Eastleigh");
  assert.equal(parsed.fields.hasCar, true);
  assert.equal(parsed.fields.availability, "Any weekday afternoon");
  assert.equal(parsed.fields.email, "alex@example.com", "falls back to the single Reply-To address");
});

test("parsing: an email with no name can't be imported, and the footer never runs into a field", () => {
  const parsed = parseApplicationEmail({
    plain: "Phone: 07700 900789\nAvailability: Saturdays\n\nPowered by Web3Forms\nUnsubscribe",
    fromHtml: null,
    replyTo: null,
  });
  assert.equal(parsed.readable, false);
  assert.equal(parsed.fields.availability, "Saturdays");
  assert.equal(parseApplicationText("Availability: Sundays\nThis email was sent by Web3Forms").availability, "Sundays");
});

test("parsing: when both versions exist, the one that reads more fields wins", () => {
  const parsed = parseApplicationEmail({
    plain: "You have a new submission.",
    fromHtml: extractTextVariants(htmlMessage(SAMPLE_HTML).payload).fromHtml,
    replyTo: null,
  });
  assert.equal(parsed.fields.fullName, "Sam Example");
});

// --- Import from Gmail -------------------------------------------------------------

function fakeReader(threads: Record<string, gmail_v1.Schema$Thread>, pages: { id: string; threadId: string }[][]) {
  const fetched: string[] = [];
  const queries: string[] = [];
  const reader: GmailMessageReader = {
    async listMessageIds(q, pageToken) {
      queries.push(q);
      const i = pageToken ? Number(pageToken) : 0;
      return { messages: pages[i] ?? [], nextPageToken: i + 1 < pages.length ? String(i + 1) : null };
    },
    async getThread(id) {
      fetched.push(id);
      return threads[id] ?? null;
    },
  };
  return { reader, fetched, queries };
}

const CONTEXT = { senderAddress: US, excluded: ["other-business.example"], subject: DISTRIBUTOR_APPLICATION_SUBJECT };

function app(id: string, threadId: string, name: string, phone: string, extra: Partial<Parameters<typeof htmlMessage>[1]> = {}) {
  const html = SAMPLE_HTML.replace("Sam Example", name).replace("07700 900123", phone);
  return htmlMessage(html, { id, threadId, ...extra });
}

test("import searches Gmail by the application subject only, across pages", async () => {
  const { reader, queries } = fakeReader({}, [[], []]);
  await findApplicationEmails(reader, CONTEXT, { alreadyImported: async () => new Set() });
  assert.deepEqual(queries, [
    `subject:"${DISTRIBUTOR_APPLICATION_SUBJECT}"`,
    `subject:"${DISTRIBUTOR_APPLICATION_SUBJECT}"`,
  ]);
});

test("import skips already-imported messages without even fetching them", async () => {
  const threads = {
    t1: { id: "t1", messages: [app("m1", "t1", "Imported Already", "07700900001")] },
    t2: { id: "t2", messages: [app("m2", "t2", "Brand New", "07700900002")] },
  };
  const { reader, fetched } = fakeReader(threads, [[{ id: "m1", threadId: "t1" }, { id: "m2", threadId: "t2" }]]);
  const result = await findApplicationEmails(reader, CONTEXT, { alreadyImported: async () => new Set(["m1"]) });
  assert.equal(result.alreadyImported, 1);
  assert.deepEqual(result.candidates.map((c) => c.messageId), ["m2"]);
  assert.deepEqual(fetched, ["t2"]);
});

test("import drops every thread touching an excluded address, in any header or any message", async () => {
  const threads = {
    t1: { id: "t1", messages: [app("m1", "t1", "Ours", "07700900001")] },
    t2: { id: "t2", messages: [app("m2", "t2", "Theirs To", "07700900002", { headers: { To: "jobs@other-business.example" } })] },
    t3: { id: "t3", messages: [app("m3", "t3", "Theirs Delivered", "07700900003", { headers: { "Delivered-To": "jobs@other-business.example" } })] },
    t4: {
      id: "t4",
      messages: [
        app("m4", "t4", "Theirs Later", "07700900004"),
        htmlMessage("<p>Forwarded</p>", { id: "m4b", threadId: "t4", headers: { From: "boss@other-business.example", Subject: "Re: x" } }),
      ],
    },
    t5: { id: "t5", messages: [app("m5", "t5", "Theirs Cc", "07700900005", { headers: { Cc: "Office <office@OTHER-BUSINESS.example>" } })] },
  };
  const refs = ["1", "2", "3", "4", "5"].map((n) => ({ id: `m${n}`, threadId: `t${n}` }));
  const { reader } = fakeReader(threads, [refs]);
  const result = await findApplicationEmails(reader, CONTEXT, { alreadyImported: async () => new Set() });
  assert.deepEqual(result.candidates.map((c) => c.parsed.fields.fullName), ["Ours"]);
});

test("import only takes the exact notification: not replies, forwards, quotes or our own sent mail", async () => {
  const threads = {
    t1: { id: "t1", messages: [app("m1", "t1", "Real One", "07700900001")] },
    t2: { id: "t2", messages: [app("m2", "t2", "Reply", "07700900002", { headers: { Subject: `Re: ${DISTRIBUTOR_APPLICATION_SUBJECT}` } })] },
    t3: { id: "t3", messages: [app("m3", "t3", "Quote", "07700900003", { headers: { Subject: "New Quote Request - Flyer Distribution Hampshire" } })] },
    t4: { id: "t4", messages: [app("m4", "t4", "Sent By Us", "07700900004", { labelIds: ["SENT"] })] },
    t5: { id: "t5", messages: [app("m5", "t5", "From Us", "07700900005", { headers: { From: `FDH <${US}>` } })] },
  };
  const refs = ["1", "2", "3", "4", "5"].map((n) => ({ id: `m${n}`, threadId: `t${n}` }));
  const { reader } = fakeReader(threads, [refs]);
  const result = await findApplicationEmails(reader, CONTEXT, { alreadyImported: async () => new Set() });
  assert.deepEqual(result.candidates.map((c) => c.parsed.fields.fullName), ["Real One"]);
});

test("import: several notifications Gmail grouped into one thread each come through, newest first", async () => {
  const threads = {
    t1: {
      id: "t1",
      messages: [
        app("m1", "t1", "First", "07700900001", { internalDate: Date.parse("2026-09-23T09:00:00Z") }),
        app("m2", "t1", "Second", "07700900002", { internalDate: Date.parse("2026-09-24T09:00:00Z") }),
      ],
    },
  };
  const { reader, fetched } = fakeReader(threads, [[{ id: "m1", threadId: "t1" }, { id: "m2", threadId: "t1" }]]);
  const result = await findApplicationEmails(reader, CONTEXT, { alreadyImported: async () => new Set() });
  assert.deepEqual(result.candidates.map((c) => c.parsed.fields.fullName), ["Second", "First"]);
  assert.equal(result.candidates[1].receivedAt, "2026-09-23T09:00:00.000Z");
  assert.deepEqual(fetched, ["t1"], "a thread is fetched once");
});

test("import confirm reads the chosen emails again and still skips imported and excluded ones", async () => {
  const threads = {
    t1: { id: "t1", messages: [app("m1", "t1", "Keep", "07700900001")] },
    t2: { id: "t2", messages: [app("m2", "t2", "Imported Meanwhile", "07700900002")] },
    t3: { id: "t3", messages: [app("m3", "t3", "Excluded", "07700900003", { headers: { To: "x@other-business.example" } })] },
  };
  const { reader } = fakeReader(threads, []);
  const chosen = await loadSelectedApplicationEmails(
    reader,
    CONTEXT,
    [
      { messageId: "m1", threadId: "t1" },
      { messageId: "m2", threadId: "t2" },
      { messageId: "m3", threadId: "t3" },
      { messageId: "m9", threadId: "t1" },
    ],
    async () => new Set(["m2"])
  );
  assert.deepEqual(chosen.map((c) => c.messageId), ["m1"]);
});

test("import flags likely duplicates by phone, against the CRM and within the same import", () => {
  const candidate = (id: string, phone: string, date: string): ImportCandidate => ({
    messageId: id,
    threadId: id,
    receivedAt: date,
    business: "FDH",
    parsed: parseApplicationEmail({ plain: `Name: P ${id}\nPhone: ${phone}`, fromHtml: null, replyTo: null }),
  });
  const flags = flagDuplicates(
    [
      candidate("a", "07700 900111", "2026-09-23T00:00:00Z"),
      candidate("b", "+447700900222", "2026-09-24T00:00:00Z"),
      candidate("c", "07700900222", "2026-09-25T00:00:00Z"),
      candidate("d", "07700900333", "2026-09-26T00:00:00Z"),
    ],
    [{ fullName: "Existing Person", phone: "+44 (0)7700 900111", receivedAt: new Date("2026-09-01T00:00:00Z") }]
  );
  assert.deepEqual(flags.get("a"), { kind: "existing", name: "Existing Person", receivedAt: "2026-09-01T00:00:00.000Z" });
  assert.equal(flags.get("b"), null);
  assert.deepEqual(flags.get("c"), { kind: "batch", name: "P b" });
  assert.equal(flags.get("d"), null);
});

test("import saves with source GMAIL_IMPORT, the email's date, and lets the database skip any already there", async () => {
  const calls: { data: unknown[]; skipDuplicates: boolean }[] = [];
  const db = {
    distributorApplication: {
      async createMany(args: { data: unknown[]; skipDuplicates: true }) {
        calls.push(args);
        return { count: args.data.length - 1 };
      },
    },
  };
  const parsed = parseApplicationEmail({ plain: "Name: Jo Bloggs\nPhone: 07700900444", fromHtml: null, replyTo: null });
  const unreadable = parseApplicationEmail({ plain: "Phone: 07700900555", fromHtml: null, replyTo: null });
  const count = await saveImportedApplications(
    db,
    [
      { messageId: "m1", threadId: "t1", receivedAt: "2026-09-25T10:30:00.000Z", business: "FDH", parsed },
      { messageId: "m2", threadId: "t2", receivedAt: "2026-09-26T10:30:00.000Z", business: "FDH", parsed },
      { messageId: "m3", threadId: "t3", receivedAt: "2026-09-27T10:30:00.000Z", business: "FDH", parsed: unreadable },
    ],
    new Map([["m2", { kind: "existing", name: "Jo Bloggs", receivedAt: "2026-09-01T00:00:00.000Z" }]])
  );
  assert.equal(count, 1);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].skipDuplicates, true);
  const rows = calls[0].data as Record<string, unknown>[];
  assert.equal(rows.length, 2, "the unreadable one is never saved");
  assert.equal(rows[0].source, "GMAIL_IMPORT");
  assert.equal(rows[0].gmailMessageId, "m1");
  assert.deepEqual(rows[0].receivedAt, new Date("2026-09-25T10:30:00.000Z"));
  assert.equal(rows[0].notes, null);
  assert.equal(rows[1].notes, "Possible duplicate: same phone number as Jo Bloggs's application from 1 Sept 2026.");
});

// --- Approve and add as distributor --------------------------------------------------

function fakeApproveDb(application: (Stored & { distributorId: string | null }) | null, opts: { raceLinked?: boolean } = {}) {
  const created: { name: string; phone: string | null; email: string | null; notes: string | null }[] = [];
  const linked: { distributorId: string; status: string }[] = [];
  let rolledBack = false;
  const tx = {
    distributorApplication: {
      async findUnique() {
        return application;
      },
      async updateMany(args: { where: { id: string; distributorId: null }; data: { distributorId: string; status: "APPROVED" } }) {
        if (opts.raceLinked) return { count: 0 };
        linked.push(args.data);
        return { count: 1 };
      },
    },
    distributor: {
      async create(args: { data: { name: string; phone: string | null; email: string | null; notes: string | null } }) {
        created.push(args.data);
        return { id: "dist1", name: args.data.name };
      },
    },
  };
  const db: ApproveDb = {
    async $transaction(fn) {
      try {
        return await fn(tx);
      } catch (err) {
        rolledBack = true;
        throw err;
      }
    },
  };
  return { db, created, linked, rolledBack: () => rolledBack };
}

const APPLICATION: Stored & { distributorId: string | null } = {
  id: "app1",
  fullName: "  Sam Example ",
  phone: "07700 900123",
  email: "sam@example.com",
  area: "Southampton, SO15",
  age: "17",
  hasCar: false,
  hasLicence: null,
  availability: "Weekends",
  notes: "Lovely on the phone.",
  receivedAt: new Date("2026-09-25T10:30:00Z"),
  distributorId: null,
};

test("Approve creates a Distributor from the application with the shared rules and links it", async () => {
  const { db, created, linked } = fakeApproveDb(APPLICATION);
  const result = await approveApplicationAsDistributor(db, "app1");
  assert.deepEqual(result, { ok: true, distributor: { id: "dist1", name: "Sam Example" } });
  assert.equal(created.length, 1);
  assert.equal(created[0].name, "Sam Example", "trimmed, as the Distributors page does");
  assert.equal(created[0].phone, "07700 900123");
  assert.equal(created[0].email, "sam@example.com");
  assert.equal(
    created[0].notes,
    [
      "From their application received 25 Sept 2026.",
      "Lives in: Southampton, SO15",
      "Age: 17",
      "Car access: No. Full UK licence: not given.",
      "Availability: Weekends",
      "",
      "Lovely on the phone.",
    ].join("\n")
  );
  assert.deepEqual(linked, [{ distributorId: "dist1", status: "APPROVED" }]);
});

test("Approve never creates a second Distributor for an application already linked", async () => {
  const { db, created } = fakeApproveDb({ ...APPLICATION, distributorId: "existing" });
  assert.deepEqual(await approveApplicationAsDistributor(db, "app1"), { ok: false, reason: "already_linked" });
  assert.equal(created.length, 0);
});

test("Approve: if it was linked in the meantime, the new Distributor is rolled back", async () => {
  const { db, rolledBack } = fakeApproveDb(APPLICATION, { raceLinked: true });
  assert.deepEqual(await approveApplicationAsDistributor(db, "app1"), { ok: false, reason: "already_linked" });
  assert.equal(rolledBack(), true);
});

test("Approve on a missing application creates nothing", async () => {
  const { db, created } = fakeApproveDb(null);
  assert.deepEqual(await approveApplicationAsDistributor(db, "nope"), { ok: false, reason: "not_found" });
  assert.equal(created.length, 0);
});

test("the shared distributor rules: name required and trimmed, blanks become empty", () => {
  assert.deepEqual(buildDistributorData({ name: " " }), { ok: false, error: "Distributor name is required" });
  assert.deepEqual(buildDistributorData({ name: " Jo ", phone: " ", email: 5, notes: " hi " }), {
    ok: true,
    data: { name: "Jo", phone: null, email: null, notes: "hi" },
  });
});

// --- Phones, links, filters -----------------------------------------------------------

test("phone matching ignores format and +44", () => {
  assert.equal(normalizePhone("+44 (0)7700 900123"), "07700900123");
  assert.equal(normalizePhone("0044 7700 900123"), "07700900123");
  assert.equal(normalizePhone("447700900123"), "07700900123");
  assert.equal(phonesMatch("07700-900-123", "+447700900123"), true);
  assert.equal(phonesMatch("07700900123", "07700900124"), false);
  assert.equal(phonesMatch("", ""), false);
});

test("tap-to-call and WhatsApp links", () => {
  assert.equal(telHref("07700 900123"), "tel:07700900123");
  assert.equal(whatsAppHref("07700 900123"), "https://wa.me/447700900123");
  assert.equal(whatsAppHref("+44 (0)7700 900123"), "https://wa.me/447700900123");
  assert.equal(whatsAppHref("+353 87 123 4567"), "https://wa.me/353871234567");
  assert.equal(telHref("123"), null);
  assert.equal(whatsAppHref(null), null);
});

const LIST: ApplicationListItem[] = [
  { id: "1", fullName: "Sam Example", phone: "07700 900123", email: null, area: "Southampton, SO15 2AB", age: "17", hasCar: false, hasLicence: false, availability: "x", status: "NEW" },
  { id: "2", fullName: "Alex Rivers", phone: "+44 7700 900456", email: null, area: "Eastleigh SO50", age: "34", hasCar: true, hasLicence: true, availability: "x", status: "CONTACTED" },
  { id: "3", fullName: "Jo Bloggs", phone: null, email: null, area: "Ringwood", age: null, hasCar: null, hasLicence: true, availability: null, status: "NEW" },
];

test("filters by status, car, licence and where they live", () => {
  const ids = (f: Parameters<typeof filterApplications>[1]) => filterApplications(LIST, f).map((a) => a.id);
  assert.deepEqual(ids({ status: "NEW" }), ["1", "3"]);
  assert.deepEqual(ids({ car: "yes" }), ["2"]);
  assert.deepEqual(ids({ car: "no" }), ["1"]);
  assert.deepEqual(ids({ licence: "yes" }), ["2", "3"]);
  assert.deepEqual(ids({ area: "eastleigh" }), ["2"]);
  assert.deepEqual(ids({ status: "NEW", licence: "yes" }), ["3"]);
});

test("search by name, phone in any format, or postcode with or without spaces", () => {
  const ids = (q: string) => filterApplications(LIST, { q }).map((a) => a.id);
  assert.deepEqual(ids("rivers"), ["2"]);
  assert.deepEqual(ids("07700900456"), ["2"]);
  assert.deepEqual(ids("+44 7700 900123"), ["1"]);
  assert.deepEqual(ids("900 123"), ["1"]);
  assert.deepEqual(ids("so152ab"), ["1"]);
  assert.deepEqual(ids("SO15 2AB"), ["1"]);
  assert.deepEqual(ids(""), ["1", "2", "3"]);
});
