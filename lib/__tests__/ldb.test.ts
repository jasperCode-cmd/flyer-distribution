import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { gmail_v1 } from "@googleapis/gmail";
import {
  handleLdbIntake,
  intakeSecretMatches,
  LDB_INTAKE_PER_CONTACT_PER_HOUR,
  LDB_INTAKE_PER_HOUR,
  validateLdbEnquiry,
  type LdbIntakeDb,
} from "@/lib/ldb-intake";
import { BREVO_SEND_URL, buildBrevoEmail, LDB_NOT_CONNECTED, readLdbEnv, sendViaBrevo, type LdbEnv } from "@/lib/ldb-email";
import { newEmailBusiness, replyBusiness, senderFor, type ChannelSenders } from "@/lib/email-channel";
import { sendLeadEmailAndRecord, type SendEmailFn } from "@/lib/send-lead-email";
import { sendInboxReply } from "@/lib/inbox-reply";
import { sendNewEmail } from "@/lib/new-email";
import {
  filterInboxPage,
  getHiddenAddresses,
  latestUnanswered,
  ownAddresses,
  parseConversationMessage,
  threadInView,
  viewExcluded,
} from "@/lib/gmail";
import { matchLeadsByEmail, type InboxLeadCandidate } from "@/lib/inbox-leads";
import { crmMatchesFor, type CrmLookups } from "@/lib/inbox-crm";
import { unansweredLeadEmails } from "@/lib/priorities-email";
import { candidatesFromThread } from "@/lib/application-import";
import { defaultComposeBody } from "@/lib/email-compose";
import {
  expenseMatchesBusiness,
  filterByBusiness,
  filterExpensesByBusiness,
  itemInFilter,
  leadInFilter,
  parseBusinessFilter,
} from "@/lib/business";
import { periodFigures } from "@/lib/profit-overview";
import { ALL_TIME, type ProfitJob } from "@/lib/profit";
import type { ExpenseRecord } from "@/lib/expenses";
import { JAMES_LEAD, JAMES_NOTE, JAMES_PAYLOAD, SARAH_LEAD, SARAH_NOTE, SARAH_PAYLOAD } from "./ldb-website-payloads";
import { applyLeadFilters } from "@/lib/crm-constants";
import { buildPriorities, rowsForBusiness, type LeadFacts } from "@/lib/priorities";
import { inboxFilterUrl } from "@/lib/inbox-list";
import { periodSearch } from "@/lib/dashboard";

const SECRET = "test-intake-secret-not-real";
const LDB = "hello@ldb.example";
const FDH = "fdh@example.com";
const NOW = new Date("2026-10-16T10:00:00.000Z");

// --- The intake endpoint --------------------------------------------------------

function fakeIntakeDb(counts: { hour?: number; contact?: number } = {}) {
  const created: { data: Record<string, any> }[] = [];
  const countCalls: Record<string, any>[] = [];
  const db: LdbIntakeDb = {
    lead: {
      async count(args) {
        countCalls.push(args.where);
        return args.where.OR ? counts.contact ?? 0 : counts.hour ?? 0;
      },
      async create(args) {
        created.push(args);
        return { id: "new-lead" };
      },
    },
  };
  return { db, created, countCalls };
}

function intakeRequest(body: unknown, secret: string | null = SECRET, raw?: string) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (secret !== null) headers["x-intake-secret"] = secret;
  return new Request("http://localhost/api/crm/intake/ldb", {
    method: "POST",
    headers,
    body: raw ?? JSON.stringify(body),
  });
}

const ENQUIRY = {
  name: "Sam Rivers",
  email: "sam@example.com",
  phone: "07700 900123",
  company: "Rivers Cafe",
  postcode: "bh1 1aa",
  areas: "Westbourne, Boscombe",
  quantity: "5,000",
  service: "Leaflet distribution",
  budget: "£300 - £500",
  message: "Hoping to start next month.",
};

async function intake(body: unknown, opts: { secret?: string | null; env?: string; counts?: { hour?: number; contact?: number }; duplicates?: { id: string; name: string }[]; raw?: string } = {}) {
  const fake = fakeIntakeDb(opts.counts);
  const res = await handleLdbIntake(intakeRequest(body, opts.secret === undefined ? SECRET : opts.secret, opts.raw), {
    db: fake.db,
    secret: opts.env === undefined ? SECRET : opts.env,
    findDuplicates: async () => opts.duplicates ?? [],
    now: () => NOW,
  });
  return { res, json: await res.json(), ...fake };
}

test("intake: a missing or wrong secret is 401 and nothing is read or written", async () => {
  for (const secret of [null, "", "wrong", `${SECRET}x`]) {
    const { res, json, created, countCalls } = await intake(ENQUIRY, { secret });
    assert.equal(res.status, 401, String(secret));
    assert.deepEqual(json, { error: "Unauthorized" });
    assert.equal(created.length, 0);
    assert.equal(countCalls.length, 0);
  }
  // With LDB_INTAKE_SECRET unset, nothing gets in, whatever is sent.
  const unset = await intake(ENQUIRY, { env: "", secret: "" });
  assert.equal(unset.res.status, 401);
  assert.equal(intakeSecretMatches(SECRET, SECRET), true);
  assert.equal(intakeSecretMatches(SECRET, undefined), false);
});

test("intake: a good enquiry becomes an LDB lead, Website Quote Form, Uncontacted, with a note, and the reply is only ok", async () => {
  const { res, json, created } = await intake(ENQUIRY);
  assert.equal(res.status, 200);
  assert.deepEqual(json, { ok: true });
  assert.equal(created.length, 1);
  const data = created[0].data;
  assert.equal(data.business, "LDB");
  assert.equal(data.source, "WEBSITE_QUOTE_FORM");
  assert.equal(data.stage, "UNCONTACTED");
  assert.equal(data.name, "Sam Rivers");
  assert.equal(data.businessName, "Rivers Cafe");
  assert.equal(data.postcode, "BH1 1AA");
  assert.equal(data.targetAreas, "Westbourne, Boscombe");
  const note = data.activities.create;
  assert.equal(note.type, "NOTE");
  assert.equal("userId" in note, false, "the CRM's own note has no user");
  assert.match(note.detail, /^Service type: Leaflet distribution\n/);
  assert.match(note.detail, /Budget range: £300 - £500/);
  assert.match(note.detail, /Message: Hoping to start next month\./);
});

test("intake: every field is validated and length-limited", async () => {
  const cases: [unknown, string][] = [
    [{ ...ENQUIRY, name: "" }, "Name is required"],
    [{ ...ENQUIRY, name: "x".repeat(101) }, "name is too long"],
    [{ ...ENQUIRY, email: null, phone: null }, "An email address or phone number is required"],
    [{ ...ENQUIRY, email: "not an email" }, "Invalid email"],
    [{ ...ENQUIRY, phone: "call me" }, "Invalid phone"],
    [{ ...ENQUIRY, message: "x".repeat(2001) }, "message is too long"],
    [{ ...ENQUIRY, areas: "x".repeat(301) }, "areas is too long"],
    [{ ...ENQUIRY, company: 42 }, "Invalid businessName"],
    [[ENQUIRY], "Invalid enquiry"],
  ];
  for (const [body, error] of cases) {
    const { res, json, created } = await intake(body);
    assert.equal(res.status, 400, error);
    assert.deepEqual(json, { error });
    assert.equal(created.length, 0);
  }
  const broken = await intake(null, { raw: "{not json" });
  assert.equal(broken.res.status, 400);
  const huge = await intake(null, { raw: JSON.stringify({ ...ENQUIRY, message: "x".repeat(30_000) }) });
  assert.equal(huge.res.status, 413);
  // The FDH form's field names work too, and control characters go.
  const fdhNames = validateLdbEnquiry({ "first-name": "Ann", "last-name": "Lee", phone: "+44 7700 900456", "areas-required": "Poole\u0007" });
  assert.ok(fdhNames.ok);
  assert.equal(fdhNames.ok && fdhNames.enquiry.name, "Ann Lee");
  assert.equal(fdhNames.ok && fdhNames.enquiry.areas, "Poole");
});

test("intake: the LDB website's own payloads are accepted and every field is saved", async () => {
  for (const [raw, lead, note] of [
    [SARAH_PAYLOAD, SARAH_LEAD, SARAH_NOTE],
    [JAMES_PAYLOAD, JAMES_LEAD, JAMES_NOTE],
  ] as const) {
    const { res, json, created } = await intake(null, { raw });
    assert.equal(res.status, 200, lead.name);
    assert.deepEqual(json, { ok: true });
    assert.equal(created.length, 1);
    const { activities, ...saved } = created[0].data;
    assert.deepEqual(saved, lead);
    assert.deepEqual(activities, { create: { type: "NOTE", detail: note } });
  }
});

test("intake: areas may be a list, joined and tidied, with the limit on the joined text", async () => {
  const listed = (areas: unknown, extra: Record<string, unknown> = {}) =>
    validateLdbEnquiry({ name: "Ann Lee", email: "ann@example.com", areas, ...extra });
  const tidy = listed(["  Poole ", "", "Boscombe\u0007", "   "]);
  assert.ok(tidy.ok);
  assert.equal(tidy.ok && tidy.enquiry.areas, "Poole, Boscombe");
  const empty = listed([]);
  assert.equal(empty.ok && empty.enquiry.areas, null);
  assert.deepEqual(listed(["x".repeat(75), "x".repeat(75), "x".repeat(75), "x".repeat(75)]), { ok: false, error: "areas is too long" });
  assert.deepEqual(listed(["Poole", 3]), { ok: false, error: "Invalid areas" });
  const asText = listed("Poole, Boscombe");
  assert.equal(asText.ok && asText.enquiry.areas, "Poole, Boscombe", "a string still works");

  // Areas win for Target Area(s); with none, the project location is used.
  const both = await intake({ name: "Ann Lee", email: "ann@example.com", areas: ["Poole"], projectLocation: "Lansdowne Road" });
  assert.equal(both.created[0].data.targetAreas, "Poole");
  assert.match(both.created[0].data.activities.create.detail, /^Project location: Lansdowne Road$/m);
  const none = await intake({ name: "Ann Lee", email: "ann@example.com", areas: [], projectLocation: "Lansdowne Road" });
  assert.equal(none.created[0].data.targetAreas, "Lansdowne Road");
});

test("intake: includePrinting and includeDesign follow the yes rules; the new fields are length-limited; a first name alone is a name", async () => {
  const base = { name: "Ann Lee", email: "ann@example.com" };
  const flags = (extra: Record<string, unknown>) => {
    const r = validateLdbEnquiry({ ...base, ...extra });
    return r.ok ? [r.enquiry.printingIncluded, r.enquiry.designIncluded] : r.error;
  };
  assert.deepEqual(flags({ includePrinting: true, includeDesign: false }), [true, false]);
  assert.deepEqual(flags({ includePrinting: "yes", includeDesign: "on" }), [true, true]);
  assert.deepEqual(flags({ includePrinting: "true", includeDesign: "true" }), [true, true]);
  assert.deepEqual(flags({ includePrinting: "no", includeDesign: 1 }), [false, false]);
  assert.deepEqual(flags({ printingIncluded: true, "include-design": "yes" }), [true, true], "the older names still work");
  assert.deepEqual(flags({}), [false, false]);

  for (const [field, limit] of [["projectLocation", 200], ["deadline", 50], ["scale", 100]] as const) {
    assert.deepEqual(validateLdbEnquiry({ ...base, [field]: "x".repeat(limit + 1) }), { ok: false, error: `${field} is too long` });
    const fits = validateLdbEnquiry({ ...base, [field]: "x".repeat(limit) });
    assert.equal(fits.ok && fits.enquiry[field], "x".repeat(limit));
    assert.deepEqual(validateLdbEnquiry({ ...base, [field]: 5 }), { ok: false, error: `Invalid ${field}` });
  }

  const first = validateLdbEnquiry({ firstName: "James", email: "james@example.com" });
  assert.equal(first.ok && first.enquiry.name, "James");
  const firstDashed = validateLdbEnquiry({ "first-name": "James", email: "james@example.com" });
  assert.equal(firstDashed.ok && firstDashed.enquiry.name, "James");
});

test("intake: a possible duplicate is noted on the new lead, like the FDH form", async () => {
  const { created } = await intake(ENQUIRY, { duplicates: [{ id: "lead-1", name: "Sam Rivers" }] });
  assert.match(created[0].data.activities.create.detail, /Possible duplicate of existing lead\(s\): Sam Rivers \(lead-1\)/);
});

test("intake: the database caps all LDB intake per hour, and one email or phone more tightly", async () => {
  const busy = await intake(ENQUIRY, { counts: { hour: LDB_INTAKE_PER_HOUR } });
  assert.equal(busy.res.status, 429);
  assert.equal(busy.created.length, 0);
  assert.deepEqual(busy.countCalls[0], { business: "LDB", source: "WEBSITE_QUOTE_FORM", createdAt: { gte: new Date(NOW.getTime() - 3_600_000) } });

  const repeat = await intake(ENQUIRY, { counts: { hour: 1, contact: LDB_INTAKE_PER_CONTACT_PER_HOUR } });
  assert.equal(repeat.res.status, 429);
  assert.equal(repeat.created.length, 0);
  assert.deepEqual(repeat.countCalls[1].OR, [
    { email: { equals: "sam@example.com", mode: "insensitive" } },
    { phone: "07700 900123" },
  ]);

  const fine = await intake(ENQUIRY, { counts: { hour: LDB_INTAKE_PER_HOUR - 1, contact: LDB_INTAKE_PER_CONTACT_PER_HOUR - 1 } });
  assert.equal(fine.res.status, 200);
});

// --- Choosing the channel -------------------------------------------------------

function fakeSenders() {
  const calls = { gmail: 0, ldb: 0 };
  const ok: SendEmailFn = async (p) => ({ ok: true, data: { messageId: "m1", threadId: p.threadContext?.threadId ?? "t-new", signature: "added" } });
  const senders: ChannelSenders = {
    gmail: async (p) => {
      calls.gmail++;
      return ok(p);
    },
    ldb: async (p) => {
      calls.ldb++;
      return ok(p);
    },
  };
  return { senders, calls };
}

function fakeDb() {
  const writes: string[] = [];
  return {
    writes,
    db: {
      activity: { create: (args: { data: any }) => (writes.push(`activity:${args.data.type}`), args) },
      lead: { update: (args: { data: any }) => (writes.push(`lead:${args.data.stage}`), args) },
      $transaction: async (ops: unknown[]) => ops,
    },
  };
}

const LDB_MATCH = { id: "l-ldb", name: "Sam", stage: "UNCONTACTED", email: "sam@example.com", scrapped: false, business: "LDB" as const, businesses: ["LDB" as const] };
const FDH_MATCH = { ...LDB_MATCH, id: "l-fdh", business: "FDH" as const, businesses: ["FDH" as const] };

test("an LDB lead's email from its page or the Kanban goes through Brevo, never Gmail, and is recorded exactly as for FDH", async () => {
  const { senders, calls } = fakeSenders();
  const { db, writes } = fakeDb();
  const result = await sendLeadEmailAndRecord({
    lead: { id: "l-ldb", stage: "UNCONTACTED" },
    to: "sam@example.com",
    subject: "Your leaflet quote",
    body: "Hello",
    userId: "u1",
    sendEmailFn: senderFor("LDB", senders),
    prismaClient: db,
  });
  assert.equal(result.ok, true);
  assert.deepEqual(calls, { gmail: 0, ldb: 1 });
  assert.deepEqual(writes, ["activity:EMAIL", "lead:AWAITING_RESPONSE", "activity:STAGE_CHANGE"]);
  assert.equal(senderFor("FDH", senders), senders.gmail);
});

test("an inbox reply in a Bournemouth conversation, or to an LDB lead, goes through Brevo", async () => {
  assert.equal(replyBusiness(true, null), "LDB");
  assert.equal(replyBusiness(false, LDB_MATCH), "LDB");
  assert.equal(replyBusiness(true, FDH_MATCH), "LDB");
  assert.equal(replyBusiness(false, FDH_MATCH), "FDH");
  assert.equal(replyBusiness(false, null), "FDH");
  for (const [ldbThread, lead] of [[true, null], [false, LDB_MATCH]] as const) {
    const { senders, calls } = fakeSenders();
    const { db } = fakeDb();
    await sendInboxReply({
      threadId: "t1",
      lastMessageId: "<m@x>",
      recipientAddress: "sam@example.com",
      lead,
      subject: "Re: Quote",
      body: "Thanks",
      userId: "u1",
      sendEmailFn: senderFor(replyBusiness(ldbThread, lead), senders),
      prismaClient: db,
    });
    assert.deepEqual(calls, { gmail: 0, ldb: 1 });
  }
});

test("a new email from the Inbox to an LDB lead goes through Brevo; one on both businesses is refused; no lead uses Gmail", async () => {
  const ldb = newEmailBusiness(LDB_MATCH);
  assert.deepEqual(ldb, { ok: true, business: "LDB" });
  const { senders, calls } = fakeSenders();
  const { db } = fakeDb();
  await sendNewEmail({ to: "sam@example.com", lead: LDB_MATCH, subject: "Hi", body: "Hello", userId: "u1", sendEmailFn: senderFor(ldb.ok ? ldb.business : "FDH", senders), prismaClient: db });
  assert.deepEqual(calls, { gmail: 0, ldb: 1 });

  const both = newEmailBusiness({ ...FDH_MATCH, businesses: ["FDH", "LDB"] });
  assert.equal(both.ok, false);
  assert.match(!both.ok ? both.error : "", /both an FDH lead and a Bournemouth lead/);
  assert.deepEqual(newEmailBusiness(null), { ok: true, business: "FDH" });
  assert.deepEqual(newEmailBusiness(FDH_MATCH), { ok: true, business: "FDH" });
});

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "__tests__" ? [] : sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

test("only the channel picker can reach Gmail's send function, so no route can send an LDB email through Gmail", () => {
  const users = [...sourceFiles("app"), ...sourceFiles("lib"), ...sourceFiles("components")].filter((file) =>
    /import\s*\{[^}]*\bsendEmail\b[^}]*\}\s*from\s*["'](@\/lib\/gmail|\.\/gmail)["']/.test(readFileSync(file, "utf8"))
  );
  assert.deepEqual(users, ["lib/email-channel.ts"]);
  // And every send route picks its channel there.
  for (const route of [
    "app/api/crm/leads/[id]/email/route.ts",
    "app/api/crm/inbox/threads/[id]/reply/route.ts",
    "app/api/crm/inbox/new-email/route.ts",
  ]) {
    assert.match(readFileSync(route, "utf8"), /sendEmailFn: senderFor\(/, route);
  }
});

// --- Brevo -----------------------------------------------------------------------

const ENV: LdbEnv = { apiKey: "brevo-test-key-not-real", senderAddress: LDB, senderName: "Leaflet Distribution Bournemouth" };

test("with any Brevo setting missing nothing is sent, through Brevo or Gmail, and it says Bournemouth email isn't connected", async () => {
  const saved = { ...process.env };
  try {
    for (const missing of ["BREVO_API_KEY", "LDB_SENDER_ADDRESS", "LDB_SENDER_NAME"]) {
      process.env.BREVO_API_KEY = "k";
      process.env.LDB_SENDER_ADDRESS = LDB;
      process.env.LDB_SENDER_NAME = "LDB";
      delete process.env[missing];
      assert.equal(readLdbEnv(), null, missing);
    }
  } finally {
    process.env = saved;
  }
  let fetched = 0;
  const result = await sendViaBrevo({ to: "sam@example.com", subject: "s", body: "b" }, { env: null, fetchFn: (async () => (fetched++, new Response())) as typeof fetch });
  assert.deepEqual(result, { ok: false, reason: "not_configured", message: LDB_NOT_CONNECTED });
  assert.equal(fetched, 0);

  // Through the routing, as a route sends it: no Gmail, and nothing recorded.
  let gmailCalls = 0;
  const { db, writes } = fakeDb();
  const outcome = await sendLeadEmailAndRecord({
    lead: { id: "l-ldb", stage: "UNCONTACTED" },
    to: "sam@example.com",
    subject: "Quote",
    body: "Hello",
    userId: "u1",
    sendEmailFn: senderFor("LDB", {
      gmail: async () => {
        gmailCalls++;
        throw new Error("Gmail must never be used for LDB");
      },
      ldb: (p) => sendViaBrevo(p, { env: null }),
    }),
    prismaClient: db,
  });
  assert.equal(outcome.ok, false);
  assert.equal(!outcome.ok && outcome.message, LDB_NOT_CONNECTED);
  assert.equal(gmailCalls, 0);
  assert.deepEqual(writes, []);
});

test("Brevo: from and Reply-To the LDB address, BCC to it, the LDB signature, the body escaped, and threading on a reply", async () => {
  const email = buildBrevoEmail(ENV, {
    to: "sam@example.com",
    subject: "Re: Your quote",
    body: "Hi Sam,\n<b>not bold</b>\n\nKind regards,\nDan",
    threadContext: { threadId: "t1", lastMessageId: "<abc@mail.example>" },
  });
  assert.deepEqual(email.sender, { name: "Leaflet Distribution Bournemouth", email: LDB });
  assert.deepEqual(email.replyTo, { name: "Leaflet Distribution Bournemouth", email: LDB });
  assert.deepEqual(email.bcc, [{ email: LDB }]);
  assert.deepEqual(email.to, [{ email: "sam@example.com" }]);
  assert.equal(
    email.textContent,
    "Hi Sam,\n<b>not bold</b>\n\nKind regards,\nDan\n\n-- \nLeaflet Distribution Bournemouth\nwww.ldb.example\nhello@ldb.example"
  );
  assert.match(email.htmlContent, /&lt;b&gt;not bold&lt;\/b&gt;/);
  assert.doesNotMatch(email.htmlContent, /<b>/);
  assert.match(email.htmlContent, /<a href="https:\/\/www\.ldb\.example">www\.ldb\.example<\/a>/);
  assert.match(email.htmlContent, /<a href="mailto:hello@ldb\.example">hello@ldb\.example<\/a>/);
  assert.deepEqual(email.headers, { "In-Reply-To": "<abc@mail.example>", References: "<abc@mail.example>" });
  assert.equal(buildBrevoEmail(ENV, { to: "a@b.co", subject: "s", body: "b" }).headers, undefined);

  // The sign-off a new LDB email starts with, whoever is signed in.
  assert.equal(defaultComposeBody("LDB", "Jasper"), "\nKind regards,\nDan");
  assert.equal(defaultComposeBody("FDH", "Jasper"), "\nKind regards,\nJasper");
});

test("Brevo: the request goes to the transactional endpoint with the key in its header, and a refusal never logs the key", async () => {
  let seen: { url: string; init: RequestInit } | null = null;
  const fakeFetch = (async (url: string, init: RequestInit) => {
    seen = { url, init };
    return Response.json({ messageId: "<brevo-1@relay>" }, { status: 201 });
  }) as unknown as typeof fetch;
  const ok = await sendViaBrevo({ to: "sam@example.com", subject: "s", body: "b", threadContext: { threadId: "t9", lastMessageId: "<x@y>" } }, { env: ENV, fetchFn: fakeFetch });
  assert.deepEqual(ok, { ok: true, data: { messageId: "<brevo-1@relay>", threadId: "t9", signature: "added" } });
  assert.equal(seen!.url, BREVO_SEND_URL);
  assert.equal((seen!.init.headers as Record<string, string>)["api-key"], ENV.apiKey);
  assert.equal(JSON.parse(String(seen!.init.body)).bcc[0].email, LDB);

  const logged: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => logged.push(args.join(" "));
  try {
    const refused = await sendViaBrevo({ to: "sam@example.com", subject: "s", body: "b" }, {
      env: ENV,
      fetchFn: (async () => Response.json({ message: `bad key ${ENV.apiKey}` }, { status: 401 })) as unknown as typeof fetch,
    });
    assert.equal(refused.ok, false);
    assert.match(!refused.ok ? refused.message : "", /Brevo refused the API key/);
  } finally {
    console.error = original;
  }
  assert.ok(logged.length > 0 && logged.every((l) => !l.includes(ENV.apiKey)));
});

// --- Reading the shared inbox --------------------------------------------------

function message(id: string, headers: Record<string, string>, extra: Partial<gmail_v1.Schema$Message> = {}): gmail_v1.Schema$Message {
  return {
    id,
    threadId: extra.threadId ?? "t",
    labelIds: ["INBOX"],
    internalDate: extra.internalDate ?? "1000",
    payload: { headers: Object.entries(headers).map(([name, value]) => ({ name, value })) },
    ...extra,
  };
}

const LDB_THREAD: gmail_v1.Schema$Thread = {
  id: "t-ldb",
  messages: [
    message("m1", { From: "Sam <sam@example.com>", To: LDB, Subject: "Quote" }, { internalDate: "1000", threadId: "t-ldb" }),
    message("m2", { From: `LDB <${LDB}>`, To: "sam@example.com", Subject: "Re: Quote" }, { internalDate: "2000", threadId: "t-ldb" }),
  ],
};
const FDH_THREAD: gmail_v1.Schema$Thread = {
  id: "t-fdh",
  messages: [message("m3", { From: "Kim <kim@example.com>", To: FDH, Subject: "Hello" }, { threadId: "t-fdh" })],
};
const HIDDEN_THREAD: gmail_v1.Schema$Thread = {
  id: "t-hidden",
  messages: [message("m4", { From: "list@internal.example", To: FDH, Subject: "Team" }, { threadId: "t-hidden" })],
};

test("Bournemouth threads never appear in FDH views; they do in LDB and All; other excluded addresses stay hidden everywhere", () => {
  const context = { hidden: ["list@internal.example"], ldbAddress: LDB };
  const threads = [LDB_THREAD, FDH_THREAD, HIDDEN_THREAD];
  const shown = (view: "ALL" | "FDH" | "LDB") => threads.filter((t) => threadInView(t.messages, view, context)).map((t) => t.id);
  assert.deepEqual(shown("FDH"), ["t-fdh"]);
  assert.deepEqual(shown("LDB"), ["t-ldb"]);
  assert.deepEqual(shown("ALL"), ["t-ldb", "t-fdh"]);
  assert.deepEqual(filterInboxPage(threads, viewExcluded("FDH", context.hidden, LDB)).map((t) => t.id), ["t-fdh"]);
  assert.deepEqual(filterInboxPage(threads, viewExcluded("ALL", context.hidden, LDB)).map((t) => t.id), ["t-ldb", "t-fdh"]);
  // Without the LDB address set, Bournemouth mail stays in the hidden list it
  // was always in, so it still never shows in an FDH view.
  assert.deepEqual(viewExcluded("FDH", ["list@internal.example", LDB], null), ["list@internal.example", LDB]);
});

test("the hidden list keeps every excluded address except the Bournemouth one, and messages from it count as ours", () => {
  const saved = { ...process.env };
  try {
    process.env.GMAIL_EXCLUDE_ADDRESSES = `${LDB}, list@internal.example`;
    process.env.LDB_SENDER_ADDRESS = "Hello@LDB.example";
    assert.deepEqual(getHiddenAddresses(), ["list@internal.example"]);
    assert.deepEqual(ownAddresses(FDH), [FDH, LDB]);
  } finally {
    process.env = saved;
  }
  const own = [FDH, LDB];
  assert.equal(parseConversationMessage(LDB_THREAD.messages![1], own)?.direction, "sent");
  assert.equal(parseConversationMessage(LDB_THREAD.messages![0], own)?.direction, "received");
  // Our LDB reply was the last word, so it isn't unanswered.
  assert.equal(latestUnanswered(LDB_THREAD, own), null);
  assert.equal(latestUnanswered(LDB_THREAD, FDH)?.fromAddress, LDB, "with only the FDH address, it would look unanswered");
});

const CANDIDATES: InboxLeadCandidate[] = [
  { id: "fdh-sam", name: "Sam (FDH)", stage: "AWAITING_RESPONSE", email: "sam@example.com", scrapped: false, createdAt: new Date("2026-01-01"), business: "FDH" },
  { id: "ldb-sam", name: "Sam (LDB)", stage: "UNCONTACTED", email: "Sam@Example.com", scrapped: false, createdAt: new Date("2025-01-01"), business: "LDB" },
  { id: "old", name: "Kim", stage: "UNCONTACTED", email: "kim@example.com", scrapped: false, createdAt: new Date("2025-01-01") },
];

test("a Bournemouth conversation only matches an LDB lead; others prefer FDH; every business on an address is known", () => {
  const any = matchLeadsByEmail(["sam@example.com", "kim@example.com"], CANDIDATES, { prefer: "FDH" });
  const ldbOnly = matchLeadsByEmail(["sam@example.com", "kim@example.com"], CANDIDATES, { only: "LDB" });
  assert.equal(any.get("sam@example.com")?.id, "fdh-sam");
  assert.deepEqual(any.get("sam@example.com")?.businesses, ["FDH", "LDB"]);
  assert.equal(ldbOnly.get("sam@example.com")?.id, "ldb-sam");
  assert.equal(ldbOnly.get("kim@example.com"), undefined, "an existing lead with no business recorded is FDH");
  assert.equal(any.get("kim@example.com")?.business, "FDH");

  const lookups: CrmLookups = { leads: any, ldbLeads: ldbOnly, distributors: new Map(), applicants: new Map() };
  assert.equal(crmMatchesFor(lookups, { replyTo: null, from: "sam@example.com" }, { ldbThread: true }).lead?.id, "ldb-sam");
  assert.equal(crmMatchesFor(lookups, { replyTo: null, from: "kim@example.com" }, { ldbThread: true }).lead, null);
  assert.equal(crmMatchesFor(lookups, { replyTo: null, from: "sam@example.com" }).lead?.id, "fdh-sam");
});

test("Priorities: an unanswered Bournemouth email is an LDB lead's, and an LDB reply counts as answered", async () => {
  const db = { lead: { findMany: async () => CANDIDATES } };
  const context = { senderAddress: FDH, excluded: [], own: [FDH, LDB], ldbAddress: LDB };
  const waiting: gmail_v1.Schema$Thread = { id: "t-wait", messages: [LDB_THREAD.messages![0]] };
  const emails = await unansweredLeadEmails([waiting, LDB_THREAD], context, db);
  assert.deepEqual(emails.map((e) => [e.threadId, e.lead.id, e.lead.business]), [["t-wait", "ldb-sam", "LDB"]]);
  // The same message to the FDH address is the FDH lead's.
  const toFdh: gmail_v1.Schema$Thread = { id: "t-f", messages: [message("m9", { From: "sam@example.com", To: FDH, Subject: "Hi" }, { threadId: "t-f" })] };
  const fdh = await unansweredLeadEmails([toFdh], context, db);
  assert.deepEqual(fdh.map((e) => [e.lead.id, e.lead.business]), [["fdh-sam", "FDH"]]);
});

test("the applications import still never reads Bournemouth mail", () => {
  const thread: gmail_v1.Schema$Thread = { id: "t", messages: [message("m1", { From: "notify@web3forms.com", To: LDB, Subject: "New Distributor Application" })] };
  const found = candidatesFromThread(thread, new Set(["m1"]), {
    senderAddress: FDH,
    excluded: [],
    ldbAddress: LDB,
    subject: "New Distributor Application",
  });
  assert.deepEqual(found, []);
});

// --- Business filters --------------------------------------------------------

function job(leadId: string, business: "FDH" | "LDB" | undefined, paidPence: number): ProfitJob {
  return {
    leadId,
    name: leadId,
    businessName: null,
    business,
    stage: "WON",
    wonAt: "2026-09-10T10:00:00.000Z",
    dealPence: paidPence,
    paidPence,
    leafletQuantity: null,
    printingIncluded: false,
    designIncluded: false,
    costs: [],
    isRetainer: false,
    retainerMonthlyPence: null,
    retainerStart: null,
    retainerEnd: null,
  };
}

function expense(id: string, business: "FDH" | "LDB" | "SHARED" | undefined, amountPence: number): ExpenseRecord {
  return { id, label: id, category: "OTHER", amountPence, kind: "ONE_OFF", date: "2026-09-12", startMonth: null, endMonth: null, note: null, createdAt: "2026-09-12T00:00:00.000Z", business };
}

test("Profit totals under each business filter: shared costs count under both, All shows every expense once", () => {
  const jobs = [job("a", "FDH", 100_00), job("b", "LDB", 50_00), job("c", undefined, 10_00)];
  const expenses = [expense("e1", "FDH", 10_00), expense("e2", "LDB", 5_00), expense("e3", "SHARED", 3_00), expense("e4", undefined, 1_00)];
  const figures = (filter: "ALL" | "FDH" | "LDB") =>
    periodFigures(filterByBusiness(jobs, filter), filterExpensesByBusiness(expenses, filter), ALL_TIME, "2026-10");
  const pick = (f: ReturnType<typeof figures>) => [f.revenuePence, f.expensesPence, f.netProfitPence];
  assert.deepEqual(pick(figures("ALL")), [160_00, 19_00, 141_00]);
  assert.deepEqual(pick(figures("FDH")), [110_00, 14_00, 96_00]);
  assert.deepEqual(pick(figures("LDB")), [50_00, 9_00, 41_00]);
  assert.equal(expenseMatchesBusiness("SHARED", "LDB"), true);
  assert.equal(expenseMatchesBusiness("FDH", "LDB"), false);
  assert.equal(itemInFilter(null, "LDB"), true, "something with no lead shows under every filter");
  assert.equal(itemInFilter({ business: "FDH" }, "LDB"), false);
  assert.equal(leadInFilter(undefined, "FDH"), true, "a lead with no business recorded is FDH");
  assert.equal(leadInFilter(undefined, "LDB"), false);
  assert.equal(parseBusinessFilter("LDB"), "LDB");
  assert.equal(parseBusinessFilter("nonsense"), "ALL");
  assert.equal(parseBusinessFilter(undefined), "ALL");
});

test("the migration gives every existing lead FDH and every existing expense Shared", () => {
  const sql = readFileSync("prisma/migrations/20261016095326_add_business_to_leads_and_expenses/migration.sql", "utf8");
  assert.match(sql, /ALTER TABLE "Lead" ADD COLUMN\s+"business" "Business" NOT NULL DEFAULT 'FDH'/);
  assert.match(sql, /ALTER TABLE "Expense" ADD COLUMN\s+"business" "ExpenseBusiness" NOT NULL DEFAULT 'SHARED'/);
});

// --- The filters on the pages ----------------------------------------------------

test("Leads: the business filter keeps each business's leads, and a lead with none recorded is FDH", () => {
  const base = { stage: "UNCONTACTED", source: "WEBSITE_QUOTE_FORM", priority: "MEDIUM", atRisk: false, assignedTo: null };
  const leads = [
    { ...base, id: "ldb", business: "LDB" as const },
    { ...base, id: "fdh", business: "FDH" as const },
    { ...base, id: "old" },
  ];
  const ids = (filters: Parameters<typeof applyLeadFilters>[1]) => applyLeadFilters(leads, filters).map((l) => l.id);
  assert.deepEqual(ids({}), ["ldb", "fdh", "old"]);
  assert.deepEqual(ids({ business: "LDB" }), ["ldb"]);
  assert.deepEqual(ids({ business: "FDH" }), ["fdh", "old"]);
  assert.deepEqual(ids({ business: "LDB", stage: "WON" }), [], "it combines with the other filters");
});

test("Priorities: an LDB lead's rows show under LDB only; applications and tasks with no lead show under every filter", () => {
  const leadFacts = (id: string, business?: "FDH" | "LDB"): LeadFacts => ({
    id,
    name: `Lead ${id}`,
    businessName: null,
    email: `${id}@example.com`,
    phone: null,
    stage: "UNCONTACTED",
    source: "WEBSITE_QUOTE_FORM",
    paymentStatus: "NOT_PAID",
    reviewStatus: "NOT_REQUESTED",
    createdAt: "2026-10-15T09:00:00.000Z",
    scrapped: false,
    activities: [],
    job: null,
    ...(business ? { business } : {}),
  });
  const rows = buildPriorities({
    now: NOW,
    leads: [leadFacts("ldb", "LDB"), leadFacts("fdh", "FDH"), leadFacts("old")],
    applications: [
      { id: "app", fullName: "Applicant", email: null, phone: null, status: "NEW", receivedAt: "2026-10-15T09:00:00.000Z", updatedAt: "2026-10-15T09:00:00.000Z" },
    ],
    tasks: [{ id: "task", description: "Order leaflets", dueDate: "2026-10-16T12:00:00.000Z", priority: "NORMAL", lead: null }],
    emails: [],
    dismissals: [],
  });
  const keys = (filter: "ALL" | "FDH" | "LDB") => rowsForBusiness(rows, filter).map((r) => r.primary.key).sort();
  assert.deepEqual(keys("ALL"), ["application:app", "new_enquiry:fdh", "new_enquiry:ldb", "new_enquiry:old", "task:task"]);
  assert.deepEqual(keys("LDB"), ["application:app", "new_enquiry:ldb", "task:task"]);
  assert.deepEqual(keys("FDH"), ["application:app", "new_enquiry:fdh", "new_enquiry:old", "task:task"]);
  const ldbRow = rows.find((r) => r.primary.key === "new_enquiry:ldb");
  assert.equal(ldbRow?.primary.subject.kind === "lead" && ldbRow.primary.subject.business, "LDB", "the row knows its badge");
});

test("the Inbox and Dashboard keep the business filter in the address, and All needs nothing there", () => {
  assert.equal(inboxFilterUrl("all", false), "/admin/crm/inbox");
  assert.equal(inboxFilterUrl("all", false, "LDB"), "/admin/crm/inbox?business=LDB");
  assert.equal(inboxFilterUrl("leads", true, "FDH"), "/admin/crm/inbox?category=leads&unread=1&business=FDH");
  assert.equal(periodSearch({ kind: "all" }), "");
  assert.equal(periodSearch({ kind: "all" }, "LDB"), "?business=LDB");
  assert.equal(periodSearch({ kind: "last30", from: "2026-09-17", to: "2026-10-16" }, "FDH"), "?period=30d&business=FDH");
  assert.equal(periodSearch({ kind: "custom", from: "2026-09-01", to: "2026-09-30" }, "LDB"), "?from=2026-09-01&to=2026-09-30&business=LDB");
});
