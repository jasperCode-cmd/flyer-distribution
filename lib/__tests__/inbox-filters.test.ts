import { test } from "node:test";
import assert from "node:assert/strict";
import type { gmail_v1 } from "@googleapis/gmail";
import {
  INBOX_CATEGORIES,
  QUOTE_NOTIFICATION_SUBJECT,
  WEB3FORMS_SENDER,
  findInboxCategory,
  isFormNotification,
  type CrmRecordMatches,
  type InboxCategory,
} from "@/lib/inbox-categories";
import { DISTRIBUTOR_APPLICATION_SUBJECT } from "@/lib/distributor-application-form";
import { crmMatchesFor, lookupCrm, type CrmLookups, type InboxCrmPrisma } from "@/lib/inbox-crm";
import { decodeScanCursor, encodeScanCursor, scanInbox, SCAN_LIMIT, type InboxThreadReader } from "@/lib/inbox-scan";
import { filterInboxPage, inboxListParams, summarizeThread } from "@/lib/gmail";
import { appendUniqueThreads, inboxFilterUrl } from "@/lib/inbox-list";

const US = "flyerdistributionhampshire@gmail.com";
const EXCLUDED = ["other-business.example"];

type Msg = { from: string; subject: string; to?: string; cc?: string; deliveredTo?: string; replyTo?: string; labels?: string[] };

function thread(id: string, messages: Msg[]): gmail_v1.Schema$Thread {
  return {
    id,
    messages: messages.map((m, i) => ({
      id: `${id}m${i}`,
      threadId: id,
      labelIds: m.labels ?? ["INBOX"],
      internalDate: String(1_790_000_000_000 - Number(id.replace(/\D/g, "") || 0) * 60_000 + i),
      payload: {
        headers: Object.entries({
          From: m.from,
          To: m.to ?? US,
          Subject: m.subject,
          ...(m.cc ? { Cc: m.cc } : {}),
          ...(m.deliveredTo ? { "Delivered-To": m.deliveredTo } : {}),
          ...(m.replyTo ? { "Reply-To": m.replyTo } : {}),
        }).map(([name, value]) => ({ name, value })),
      },
    })),
  };
}

const W3F = `Web3Forms <${WEB3FORMS_SENDER}>`;
const quote = (id: string, extra: Partial<Msg> = {}) =>
  thread(id, [{ from: W3F, subject: QUOTE_NOTIFICATION_SUBJECT, replyTo: "Kim Lee <kim.lee@example.com>", ...extra }]);
const application = (id: string, extra: Partial<Msg> = {}) =>
  thread(id, [{ from: W3F, subject: DISTRIBUTOR_APPLICATION_SUBJECT, ...extra }]);
const person = (id: string, from: string, extra: Partial<Msg> = {}) => thread(id, [{ from, subject: "Hello", ...extra }]);

const NONE: CrmRecordMatches = { lead: null, distributor: null, applicant: null };
const LEAD = { id: "l1", name: "Alice", stage: "UNCONTACTED", email: "alice@example.com", scrapped: false, business: "FDH" as const, businesses: ["FDH" as const] };

function category(id: string): InboxCategory {
  const c = findInboxCategory(id);
  assert.ok(c, id);
  return c;
}

// --- Each category ------------------------------------------------------------------------

test("the four categories, in order, each a Gmail query or a CRM matcher", () => {
  assert.deepEqual(
    INBOX_CATEGORIES.map((c) => [c.id, c.label, c.kind]),
    [
      ["all", "All", "gmail"],
      ["leads", "Leads", "crm"],
      ["enquiries", "New enquiries", "gmail"],
      ["distributors", "Distributors", "crm"],
    ]
  );
  assert.equal(findInboxCategory(null)?.id, "all");
  assert.equal(findInboxCategory("nope"), null);
});

test("All: no extra query and no extra check", () => {
  const all = category("all");
  assert.ok(all.kind === "gmail" && all.query === "" && all.keep === undefined);
});

test("New enquiries: Gmail query on the Web3Forms sender plus the quote subject, then an exact check", () => {
  const c = category("enquiries");
  assert.ok(c.kind === "gmail");
  assert.equal(c.query, 'from:notify@web3forms.com subject:"New Quote Request - Flyer Distribution Hampshire"');
  assert.equal(c.keep!(quote("t1")), true);
  assert.equal(c.keep!(quote("t2", { from: "NOTIFY@Web3Forms.com" })), true, "sender is case-insensitive");
  assert.equal(c.keep!(quote("t3", { subject: `Re: ${QUOTE_NOTIFICATION_SUBJECT}` })), false, "a reply isn't a notification");
  assert.equal(c.keep!(quote("t4", { from: `FDH <${US}>`, labels: ["SENT"] })), false, "our sent mail never counts");
  assert.equal(c.keep!(quote("t5", { from: "Someone <someone@example.com>" })), false, "same subject, wrong sender");
  assert.equal(c.keep!(application("t6")), false, "an application isn't a quote");
  // A notification we replied to in the same thread is still that notification's thread.
  assert.equal(
    c.keep!(thread("t7", [
      { from: W3F, subject: QUOTE_NOTIFICATION_SUBJECT },
      { from: US, subject: `Re: ${QUOTE_NOTIFICATION_SUBJECT}`, labels: ["SENT"] },
    ])),
    true
  );
});

test("Leads: a CRM matcher that takes any thread matching a lead", () => {
  const c = category("leads");
  assert.ok(c.kind === "crm");
  assert.equal(c.matches(person("t1", "Alice <alice@example.com>"), { ...NONE, lead: LEAD }), true);
  assert.equal(c.matches(person("t2", "Bob <bob@example.com>"), NONE), false);
  assert.equal(c.matches(person("t3", "Dee <dee@example.com>"), { ...NONE, distributor: { id: "d1", name: "Dee" } }), false);
});

test("Distributors: application notifications, plus anyone who is a Distributor or an applicant", () => {
  const c = category("distributors");
  assert.ok(c.kind === "crm");
  assert.equal(c.matches(application("t1"), NONE), true, "the notification itself, even with no CRM record");
  assert.equal(c.matches(application("t2", { subject: `Re: ${DISTRIBUTOR_APPLICATION_SUBJECT}`, from: US, labels: ["SENT"] }), NONE), false);
  assert.equal(c.matches(person("t3", "Dee <dee@example.com>"), { ...NONE, distributor: { id: "d1", name: "Dee" } }), true);
  assert.equal(c.matches(person("t4", "Ann <ann@example.com>"), { ...NONE, applicant: { id: "a1", fullName: "Ann" } }), true);
  assert.equal(c.matches(quote("t5"), NONE), false, "a quote notification isn't a distributor thread");
  assert.equal(c.matches(person("t6", "Bob <bob@example.com>"), { ...NONE, lead: LEAD }), false);
  assert.equal(isFormNotification(application("t7"), WEB3FORMS_SENDER, DISTRIBUTOR_APPLICATION_SUBJECT), true);
});

// --- CRM matching, From and Reply-To --------------------------------------------------------

function fakePrisma(): InboxCrmPrisma & { calls: string[] } {
  const calls: string[] = [];
  const wanted = (where: { OR: { email: { equals: string } }[] }) => new Set(where.OR.map((o) => o.email.equals));
  return {
    calls,
    lead: {
      async findMany(args) {
        calls.push("lead");
        const rows = [
          { id: "l1", name: "Alice", stage: "UNCONTACTED", email: "Alice@Example.com", scrapped: false, createdAt: new Date(1) },
          { id: "l2", name: "Kim Lee", stage: "UNCONTACTED", email: "kim.lee@example.com", scrapped: false, createdAt: new Date(1) },
        ];
        const w = wanted(args.where);
        return rows.filter((r) => w.has(r.email.toLowerCase()));
      },
    },
    distributor: {
      async findMany(args) {
        calls.push("distributor");
        const rows = [
          { id: "d-old", name: "Dee (retired)", email: "dee@example.com", active: false },
          { id: "d1", name: "Dee", email: "DEE@example.com", active: true },
        ];
        const w = wanted(args.where);
        return rows.filter((r) => w.has(r.email.toLowerCase()));
      },
    },
    distributorApplication: {
      async findMany(args) {
        calls.push("application");
        const rows = [
          { id: "a2", fullName: "Megan Hall", email: "megan.hall@example.com", receivedAt: new Date(2) },
          { id: "a1", fullName: "Megan Hall (old)", email: "megan.hall@example.com", receivedAt: new Date(1) },
        ];
        const w = wanted(args.where);
        return rows.filter((r) => w.has(r.email.toLowerCase()));
      },
    },
  };
}

test("Reply-To matching for leads: a form notification finds the customer's lead through its Reply-To", async () => {
  const t = quote("t1");
  const s = summarizeThread(t, US)!;
  const lookups = await lookupCrm(fakePrisma(), [s.replyToAddress ?? "", s.fromAddress]);
  const crm = crmMatchesFor(lookups, { replyTo: s.replyToAddress, from: s.fromAddress });
  assert.equal(crm.lead?.id, "l2");
  assert.equal(category("leads").kind === "crm" && (category("leads") as Extract<InboxCategory, { kind: "crm" }>).matches(t, crm), true);
});

test("Reply-To matching for applicants: an application notification links to the applicant", async () => {
  const t = application("t1", { replyTo: "Megan Hall <Megan.Hall@example.com>" });
  const s = summarizeThread(t, US)!;
  const lookups = await lookupCrm(fakePrisma(), [s.replyToAddress ?? "", s.fromAddress]);
  const crm = crmMatchesFor(lookups, { replyTo: s.replyToAddress, from: s.fromAddress });
  assert.deepEqual(crm.applicant, { id: "a2", fullName: "Megan Hall" }, "the newest application for that address");
  assert.equal(crm.lead, null);
});

test("From matching for applicants and distributors, case-insensitive; an active distributor wins", async () => {
  const lookups = await lookupCrm(fakePrisma(), ["megan.hall@EXAMPLE.com", "dee@example.com"]);
  assert.equal(crmMatchesFor(lookups, { replyTo: null, from: "Megan.Hall@example.com" }).applicant?.id, "a2");
  assert.deepEqual(crmMatchesFor(lookups, { replyTo: null, from: "dee@example.com" }).distributor, { id: "d1", name: "Dee" });
});

test("Reply-To wins over From when both match different records", () => {
  const lookups: CrmLookups = {
    leads: new Map([
      ["kim@example.com", { ...LEAD, id: "lk", email: "kim@example.com" }],
      ["notify@web3forms.com", { ...LEAD, id: "lw", email: "notify@web3forms.com" }],
    ]),
    distributors: new Map(),
    applicants: new Map(),
  };
  assert.equal(crmMatchesFor(lookups, { replyTo: "kim@example.com", from: "notify@web3forms.com" }).lead?.id, "lk");
});

test("no addresses means no database calls", async () => {
  const prisma = fakePrisma();
  await lookupCrm(prisma, ["", "  "]);
  assert.deepEqual(prisma.calls, []);
});

// --- Unread, category and search together ----------------------------------------------------

test("Unread only combines with a category and with the search box", () => {
  const enquiries = category("enquiries") as Extract<InboxCategory, { kind: "gmail" }>;
  assert.deepEqual(inboxListParams({ unread: true, q: "  ringwood ", categoryQuery: enquiries.query }), {
    labelIds: ["INBOX", "UNREAD"],
    q: 'ringwood from:notify@web3forms.com subject:"New Quote Request - Flyer Distribution Hampshire"',
  });
  assert.deepEqual(inboxListParams({ unread: false, q: "ringwood" }), { labelIds: ["INBOX"], q: "ringwood" });
  assert.deepEqual(inboxListParams({ unread: true }), { labelIds: ["INBOX", "UNREAD"], q: "" });
  assert.equal(inboxListParams({ q: "x".repeat(500) }).q.length, 200, "search is still capped");
});

test("a CRM filter scan asks Gmail for Unread and the search text too", async () => {
  const seen: unknown[] = [];
  const reader: InboxThreadReader = {
    async listThreadIds(params) {
      seen.push(params);
      return { ids: [], nextPageToken: null };
    },
    async getThreadMetadata() {
      return null;
    },
  };
  await scanInbox(reader, { ...inboxListParams({ unread: true, q: "poole" }), cursor: null, excluded: [], accept: async (t) => t.map(() => true) });
  assert.deepEqual(seen, [{ labelIds: ["INBOX", "UNREAD"], q: "poole", pageToken: undefined, maxResults: 20 }]);
});

// --- Exclusions inside every filter ------------------------------------------------------------

const EXCLUDED_THREADS = [
  quote("x1", { to: "jobs@other-business.example" }),
  application("x2", { deliveredTo: "office@OTHER-BUSINESS.example" }),
  thread("x3", [
    { from: "Alice <alice@example.com>", subject: "Hello" },
    { from: US, subject: "Re: Hello", cc: "boss@other-business.example", labels: ["SENT"] },
  ]),
  person("x4", "Dee <dee@other-business.example>"),
];

for (const c of INBOX_CATEGORIES) {
  test(`exclusions apply inside the ${c.label} filter`, async () => {
    if (c.kind === "gmail") {
      const kept = filterInboxPage([...EXCLUDED_THREADS, quote("ok1")], EXCLUDED, c.keep);
      assert.ok(kept.every((t) => t.id === "ok1"));
      return;
    }
    // Every excluded thread would match if it got through; none must.
    const ids = [...EXCLUDED_THREADS.map((t) => t.id!), "ok1"];
    const byId = new Map([...EXCLUDED_THREADS, application("ok1")].map((t) => [t.id!, t]));
    const offered: string[] = [];
    const reader: InboxThreadReader = {
      async listThreadIds() {
        return { ids, nextPageToken: null };
      },
      async getThreadMetadata(id) {
        return byId.get(id) ?? null;
      },
    };
    const everything: CrmRecordMatches = { lead: LEAD, distributor: { id: "d", name: "D" }, applicant: { id: "a", fullName: "A" } };
    const result = await scanInbox(reader, {
      labelIds: ["INBOX"],
      cursor: null,
      excluded: EXCLUDED,
      accept: async (threads) => {
        offered.push(...threads.map((t) => t.id!));
        return threads.map((t) => c.matches(t, everything));
      },
    });
    assert.deepEqual(offered, ["ok1"], "excluded threads never reach the matcher");
    assert.deepEqual(result.matches.map((t) => t.id), ["ok1"]);
  });
}

// --- Load more ---------------------------------------------------------------------------------

// 95 threads over five Gmail pages of 20; every 4th is a match.
function bigInbox(total = 95) {
  const ids = Array.from({ length: total }, (_, i) => `t${i}`);
  const listCalls: (string | undefined)[] = [];
  let metadataCalls = 0;
  const reader: InboxThreadReader = {
    async listThreadIds({ pageToken, maxResults }) {
      listCalls.push(pageToken);
      const start = pageToken ? Number(pageToken.slice(1)) : 0;
      const end = start + maxResults;
      return { ids: ids.slice(start, end), nextPageToken: end < ids.length ? `p${end}` : null };
    },
    async getThreadMetadata(id) {
      metadataCalls++;
      return person(id, `Person ${id} <${id}@example.com>`);
    },
  };
  const accept = async (threads: gmail_v1.Schema$Thread[]) => threads.map((t) => Number(t.id!.slice(1)) % 4 === 0);
  return { reader, accept, listCalls, metadataCalls: () => metadataCalls };
}

test("Load more carries on from exactly where the last scan stopped, with no duplicates or gaps", async () => {
  const { reader, accept } = bigInbox();
  const found: string[] = [];
  let cursor = null;
  let requests = 0;
  do {
    const r = await scanInbox(reader, { labelIds: ["INBOX"], cursor, excluded: [], accept, maxMatches: 5 });
    assert.ok(r.scanned <= SCAN_LIMIT, "never more than the cap per request");
    assert.ok(r.matches.length <= 5);
    found.push(...r.matches.map((t) => t.id!));
    // The cursor survives the trip to the browser and back.
    cursor = r.next ? decodeScanCursor(encodeScanCursor(r.next)) : null;
    requests++;
  } while (cursor && requests < 50);
  const expected = Array.from({ length: 95 }, (_, i) => `t${i}`).filter((id) => Number(id.slice(1)) % 4 === 0);
  assert.deepEqual(found, expected);
  assert.equal(new Set(found).size, found.length);
});

test("a scan stops at the cap with nothing found, and says where to carry on", async () => {
  const { reader, metadataCalls } = bigInbox();
  const r = await scanInbox(reader, { labelIds: ["INBOX"], cursor: null, excluded: [], accept: async (t) => t.map(() => false) });
  assert.equal(r.matches.length, 0);
  assert.equal(r.scanned, SCAN_LIMIT);
  assert.equal(metadataCalls(), SCAN_LIMIT);
  assert.deepEqual(r.next, { pageToken: "p60", offset: 0 });
});

test("a scan returns at most 20 matches and resumes mid-page", async () => {
  const { reader } = bigInbox();
  const r = await scanInbox(reader, { labelIds: ["INBOX"], cursor: null, excluded: [], accept: async (t) => t.map(() => true) });
  assert.equal(r.matches.length, 20);
  assert.deepEqual(r.next, { pageToken: "p20", offset: 0 });
  const r2 = await scanInbox(reader, { labelIds: ["INBOX"], cursor: { pageToken: "p20", offset: 7 }, excluded: [], accept: async (t) => t.map(() => true) });
  assert.equal(r2.matches[0].id, "t27");
});

test("the end of the inbox gives no cursor", async () => {
  const { reader, accept } = bigInbox(10);
  const r = await scanInbox(reader, { labelIds: ["INBOX"], cursor: null, excluded: [], accept });
  assert.deepEqual(r.matches.map((t) => t.id), ["t0", "t4", "t8"]);
  assert.equal(r.next, null);
});

test("the browser adds a Load more batch without repeating a thread already shown", () => {
  const merged = appendUniqueThreads([{ id: "a" }, { id: "b" }], [{ id: "b" }, { id: "c" }, { id: "c" }]);
  assert.deepEqual(merged.map((t) => t.id), ["a", "b", "c"]);
});

test("a cursor that's been tampered with is refused", () => {
  for (const bad of ["", "!!", "x".repeat(500), Buffer.from("[1,2,3]").toString("base64url"), encodeScanCursor({ pageToken: "p1", offset: 0 }).slice(0, 4), Buffer.from('["ok", 99]').toString("base64url"), Buffer.from('["bad token!", 0]').toString("base64url")]) {
    assert.equal(decodeScanCursor(bad), null, bad);
  }
  assert.deepEqual(decodeScanCursor(encodeScanCursor({ pageToken: null, offset: 3 })), { pageToken: null, offset: 3 });
});

// --- The address keeps the filter -----------------------------------------------------------

test("the page address carries the filter and Unread only", () => {
  assert.equal(inboxFilterUrl("all", false), "/admin/crm/inbox");
  assert.equal(inboxFilterUrl("leads", false), "/admin/crm/inbox?category=leads");
  assert.equal(inboxFilterUrl("all", true), "/admin/crm/inbox?unread=1");
  assert.equal(inboxFilterUrl("distributors", true), "/admin/crm/inbox?category=distributors&unread=1");
});
