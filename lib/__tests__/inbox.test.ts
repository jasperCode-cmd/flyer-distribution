import { test, mock } from "node:test";
import assert from "node:assert/strict";
import type { gmail_v1 } from "@googleapis/gmail";
import {
  shouldExcludeThread,
  summarizeThread,
  findCounterparty,
  findReplyTarget,
  singleReplyTo,
  parseConversationMessage,
  parseMailbox,
  decodeHtmlEntities,
  normalizeInboxSearch,
  mapWithConcurrency,
  isThreadInInbox,
} from "@/lib/gmail";
import { matchLeadsByEmail, findLeadsForAddresses, pickThreadLead, type InboxLeadCandidate } from "@/lib/inbox-leads";
import { sendInboxReply } from "@/lib/inbox-reply";
import { awaitingResponseStageData } from "@/lib/crm-data";
import type { SendLeadEmailPrisma, SendEmailFn } from "@/lib/send-lead-email";

const US = "flyerdistributionhampshire@gmail.com";

function b64url(input: string): string {
  return Buffer.from(input, "utf-8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function msg(
  headers: Record<string, string>,
  opts: { id?: string; internalDate?: number; labelIds?: string[]; snippet?: string; payload?: gmail_v1.Schema$MessagePart } = {}
): gmail_v1.Schema$Message {
  return {
    id: opts.id ?? "m1",
    threadId: "t1",
    labelIds: opts.labelIds ?? ["INBOX"],
    snippet: opts.snippet ?? "",
    internalDate: String(opts.internalDate ?? 1_700_000_000_000),
    payload: {
      ...(opts.payload ?? {}),
      headers: Object.entries(headers).map(([name, value]) => ({ name, value })),
    },
  };
}

// --- Exclusion on threads ---------------------------------------------------

test("thread exclusion: a thread is dropped when any one message has an excluded From", () => {
  const thread = [
    msg({ From: "Alice <alice@example.com>", To: US }),
    msg({ From: "Team <list@internal.example>", To: US }),
  ];
  assert.equal(shouldExcludeThread(thread, ["list@internal.example"]), true);
});

for (const header of ["To", "Cc", "Delivered-To"]) {
  test(`thread exclusion: an excluded address in ${header} drops the thread`, () => {
    const thread = [
      msg({ From: "Alice <alice@example.com>", To: US }),
      msg({ From: US, To: "alice@example.com", [header]: "Someone <list@internal.example>" }),
    ];
    assert.equal(shouldExcludeThread(thread, ["list@internal.example"]), true);
  });
}

test("thread exclusion: matching is case-insensitive", () => {
  const thread = [msg({ From: "Alice <alice@example.com>", Cc: "LIST@Internal.Example" })];
  assert.equal(shouldExcludeThread(thread, ["list@internal.example"]), true);
});

test("thread exclusion: a thread with no excluded address is kept", () => {
  const thread = [
    msg({ From: "Alice <alice@example.com>", To: US, "Delivered-To": US }),
    msg({ From: US, To: "alice@example.com" }),
  ];
  assert.equal(shouldExcludeThread(thread, ["list@internal.example"]), false);
});

test("thread exclusion: an empty exclusion list keeps every thread", () => {
  assert.equal(shouldExcludeThread([msg({ From: "list@internal.example" })], []), false);
});

test("thread exclusion: filtering a page of threads drops only the excluded ones", () => {
  const threads: gmail_v1.Schema$Thread[] = [
    { id: "keep1", messages: [msg({ From: "a@example.com", Subject: "One" })] },
    { id: "drop", messages: [msg({ From: "a@example.com" }), msg({ From: US, Cc: "list@internal.example" })] },
    { id: "keep2", messages: [msg({ From: "b@example.com", Subject: "Two" })] },
  ];
  const kept = threads
    .filter((t) => !shouldExcludeThread(t.messages, ["list@internal.example"]))
    .map((t) => summarizeThread(t, US)?.id);
  assert.deepEqual(kept, ["keep1", "keep2"]);
});

test("isThreadInInbox needs at least one INBOX-labelled message", () => {
  assert.equal(isThreadInInbox([msg({ From: "a@example.com" }, { labelIds: ["SENT"] })]), false);
  assert.equal(isThreadInInbox([msg({ From: "a@example.com" }, { labelIds: ["SENT"] }), msg({ From: "a@example.com" })]), true);
});

// --- Thread summaries ---------------------------------------------------------

test("summarizeThread: sender is the latest non-us sender, unread and attachment come from labels and headers", () => {
  const summary = summarizeThread(
    {
      id: "t1",
      messages: [
        msg({ From: '"Alice Smith" <Alice@Example.com>', Subject: "Quote for 5,000 leaflets" }, { internalDate: 1, snippet: "Hi there" }),
        msg({ From: US, To: "alice@example.com" }, { internalDate: 2, labelIds: ["SENT"] }),
        msg(
          { From: "Alice Smith <alice@example.com>", "Content-Type": 'multipart/mixed; boundary="x"' },
          { internalDate: 3, labelIds: ["INBOX", "UNREAD"], snippet: "Thanks &amp; here&#39;s the map" }
        ),
      ],
    },
    US
  );
  assert.ok(summary);
  assert.equal(summary.fromName, "Alice Smith");
  assert.equal(summary.fromAddress, "alice@example.com");
  assert.equal(summary.subject, "Quote for 5,000 leaflets");
  assert.equal(summary.snippet, "Thanks & here's the map");
  assert.equal(summary.unread, true);
  assert.equal(summary.hasAttachment, true);
  assert.equal(summary.messageCount, 3);
});

test("summarizeThread: a plain read thread has no unread dot or attachment marker", () => {
  const summary = summarizeThread(
    { id: "t2", messages: [msg({ From: "bob@example.com", "Content-Type": "text/plain" })] },
    US
  );
  assert.equal(summary?.unread, false);
  assert.equal(summary?.hasAttachment, false);
});

test("findCounterparty falls back to the recipient when every message is ours", () => {
  const party = findCounterparty([msg({ From: US, To: "Carol <carol@example.com>" })], US);
  assert.deepEqual(party, { name: "Carol", address: "carol@example.com" });
});

test("parseMailbox handles bare addresses, quoted names and lists", () => {
  assert.deepEqual(parseMailbox("dave@example.com"), { name: "dave@example.com", address: "dave@example.com" });
  assert.deepEqual(parseMailbox('"Smith, Eve" <eve@example.com>, other@example.com'), {
    name: "Smith, Eve",
    address: "eve@example.com",
  });
});

// --- Never rendering HTML -----------------------------------------------------

test("an HTML-only message body comes back as plain text with no tags or script", () => {
  const html = '<html><body><p>Hello <b>there</b></p><script>alert("x")</script><img src="https://tracker.example/p.gif"></body></html>';
  const parsed = parseConversationMessage(
    msg({ From: "a@example.com" }, { payload: { mimeType: "text/html", body: { data: b64url(html) } } }),
    US
  );
  assert.ok(parsed);
  assert.doesNotMatch(parsed.bodyText, /<[^>]+>/);
  assert.doesNotMatch(parsed.bodyText, /alert/);
  assert.match(parsed.bodyText, /Hello there/i);
});

test("decodeHtmlEntities only decodes entities and never produces markup from them", () => {
  assert.equal(decodeHtmlEntities("&lt;b&gt;hi&lt;/b&gt; &#169; &#x41;"), "<b>hi</b> © A");
  assert.equal(decodeHtmlEntities("no entities"), "no entities");
});

// --- Search and concurrency ----------------------------------------------------

test("normalizeInboxSearch trims and caps the query at 200 characters", () => {
  assert.equal(normalizeInboxSearch("   from:alice   "), "from:alice");
  assert.equal(normalizeInboxSearch("x".repeat(500)).length, 200);
  assert.equal(normalizeInboxSearch(undefined), "");
  assert.equal(normalizeInboxSearch(42), "");
});

test("mapWithConcurrency keeps order and never runs more than the limit at once", async () => {
  let inFlight = 0;
  let peak = 0;
  const out = await mapWithConcurrency([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
    inFlight++;
    peak = Math.max(peak, inFlight);
    await new Promise((r) => setTimeout(r, 5));
    inFlight--;
    return n * 10;
  });
  assert.deepEqual(out, [10, 20, 30, 40, 50, 60, 70]);
  assert.equal(peak, 3);
});

// --- Lead matching --------------------------------------------------------------

function lead(overrides: Partial<InboxLeadCandidate>): InboxLeadCandidate {
  return {
    id: "lead1",
    name: "Alice Smith",
    stage: "UNCONTACTED",
    email: "alice@example.com",
    scrapped: false,
    createdAt: new Date("2026-01-01"),
    ...overrides,
  };
}

test("lead matching is case-insensitive on the exact address", () => {
  const matches = matchLeadsByEmail(["ALICE@Example.COM "], [lead({ email: " Alice@example.com" })]);
  assert.equal(matches.get("alice@example.com")?.id, "lead1");
});

test("lead matching never matches a partial address", () => {
  const matches = matchLeadsByEmail(
    ["alice@example.com"],
    [lead({ id: "a", email: "malice@example.com" }), lead({ id: "b", email: "alice@example.co" })]
  );
  assert.equal(matches.size, 0);
});

test("lead matching prefers a live lead over a scrapped one, then the newest", () => {
  const matches = matchLeadsByEmail(
    ["alice@example.com"],
    [
      lead({ id: "scrapped-new", scrapped: true, createdAt: new Date("2026-06-01") }),
      lead({ id: "live-old", createdAt: new Date("2026-01-01") }),
      lead({ id: "live-new", createdAt: new Date("2026-03-01") }),
    ]
  );
  assert.equal(matches.get("alice@example.com")?.id, "live-new");
});

test("lead matching ignores leads without an email", () => {
  assert.equal(matchLeadsByEmail(["alice@example.com"], [lead({ email: null })]).size, 0);
});

test("findLeadsForAddresses asks the database case-insensitively, once per unique address", async () => {
  const findMany = mock.fn(async (_args: unknown) => [lead({})]);
  const matches = await findLeadsForAddresses({ lead: { findMany } }, ["Alice@Example.com", "alice@example.com", ""]);
  assert.equal(findMany.mock.callCount(), 1);
  const args = findMany.mock.calls[0].arguments[0] as { where: { OR: unknown[] } };
  assert.deepEqual(args.where.OR, [{ email: { equals: "alice@example.com", mode: "insensitive" } }]);
  assert.equal(matches.get("alice@example.com")?.name, "Alice Smith");
});

test("findLeadsForAddresses skips the database entirely when there are no addresses", async () => {
  const findMany = mock.fn(async (_args: unknown) => [] as InboxLeadCandidate[]);
  await findLeadsForAddresses({ lead: { findMany } }, ["", "  "]);
  assert.equal(findMany.mock.callCount(), 0);
});

// --- Replying from the inbox ---------------------------------------------------

function fakePrisma() {
  const activityCreate = mock.fn((args: unknown) => ({ __op: "activity.create", args }));
  const leadUpdate = mock.fn((args: unknown) => ({ __op: "lead.update", args }));
  const transaction = mock.fn(async (ops: unknown[]) => ops);
  const prisma: SendLeadEmailPrisma = {
    activity: { create: activityCreate },
    lead: { update: leadUpdate },
    $transaction: transaction,
  };
  return { prisma, activityCreate, leadUpdate, transaction };
}

function okSend() {
  return mock.fn<SendEmailFn>(async () => ({ ok: true as const, data: { messageId: "sent1", threadId: "t1" } }));
}

test("reply to an Uncontacted lead goes through the shared send-and-record path and moves the stage", async () => {
  const { prisma, activityCreate, leadUpdate } = fakePrisma();
  const sendEmailFn = okSend();
  const result = await sendInboxReply({
    threadId: "t1",
    lastMessageId: "<abc@mail.example.com>",
    recipientAddress: "alice@example.com",
    lead: { id: "lead1", name: "Alice Smith", stage: "UNCONTACTED", email: "alice@example.com", scrapped: false, business: "FDH", businesses: ["FDH"] },
    subject: "Re: Quote",
    body: "Thanks",
    userId: "user1",
    sendEmailFn,
    prismaClient: prisma,
  });

  assert.equal(result.ok, true);
  assert.equal(result.ok && result.movedToAwaitingResponse, true);
  const sent = sendEmailFn.mock.calls[0].arguments[0];
  assert.equal(sent.to, "alice@example.com", "sent to the recipient worked out from the thread");
  assert.deepEqual(sent.threadContext, { threadId: "t1", lastMessageId: "<abc@mail.example.com>" });

  assert.equal(leadUpdate.mock.callCount(), 1);
  const update = leadUpdate.mock.calls[0].arguments[0] as { where: { id: string }; data: unknown };
  assert.deepEqual(update.where, { id: "lead1" });
  assert.deepEqual(update.data, awaitingResponseStageData(), "uses the shared Awaiting Response data");

  const types = activityCreate.mock.calls.map((c) => (c.arguments[0] as { data: { type: string } }).data.type);
  assert.deepEqual(types, ["EMAIL", "STAGE_CHANGE"]);
});

test("reply to a lead already past Uncontacted records the email but leaves the stage alone", async () => {
  const { prisma, activityCreate, leadUpdate } = fakePrisma();
  const result = await sendInboxReply({
    threadId: "t1",
    lastMessageId: "<abc@mail.example.com>",
    recipientAddress: "alice@example.com",
    lead: { id: "lead1", name: "Alice Smith", stage: "WON", email: "alice@example.com", scrapped: false, business: "FDH", businesses: ["FDH"] },
    subject: "Re: Quote",
    body: "Thanks",
    userId: "user1",
    sendEmailFn: okSend(),
    prismaClient: prisma,
  });
  assert.equal(result.ok && result.movedToAwaitingResponse, false);
  assert.equal(leadUpdate.mock.callCount(), 0);
  assert.equal(activityCreate.mock.callCount(), 1);
});

test("reply to a lead uses the shared send-lead-email function by default, and an injected one when given", async () => {
  const { prisma } = fakePrisma();
  const sendLeadEmailFn = mock.fn(async (_args: unknown) => ({ ok: true as const, movedToAwaitingResponse: true, threadId: "t1" }));
  await sendInboxReply({
    threadId: "t1",
    lastMessageId: null,
    recipientAddress: "alice@example.com",
    lead: { id: "lead1", name: "Alice Smith", stage: "UNCONTACTED", email: "alice@example.com", scrapped: false, business: "FDH", businesses: ["FDH"] },
    subject: "Re: Quote",
    body: "Thanks",
    userId: "user1",
    sendEmailFn: okSend(),
    prismaClient: prisma,
    sendLeadEmailFn,
  });
  assert.equal(sendLeadEmailFn.mock.callCount(), 1);
  const args = sendLeadEmailFn.mock.calls[0].arguments[0] as { lead: unknown; threadContext: unknown };
  assert.deepEqual(args.lead, { id: "lead1", stage: "UNCONTACTED" });
  assert.deepEqual(args.threadContext, { threadId: "t1", lastMessageId: "" });
});

test("reply to someone who isn't a lead is sent threaded with nothing written to the database", async () => {
  const { prisma, activityCreate, leadUpdate, transaction } = fakePrisma();
  const sendEmailFn = okSend();
  const result = await sendInboxReply({
    threadId: "t9",
    lastMessageId: "<xyz@mail.example.com>",
    recipientAddress: "stranger@example.com",
    lead: null,
    subject: "Re: Hello",
    body: "Hi",
    userId: "user1",
    sendEmailFn,
    prismaClient: prisma,
  });
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.movedToAwaitingResponse, false);
  const sent = sendEmailFn.mock.calls[0].arguments[0];
  assert.equal(sent.to, "stranger@example.com");
  assert.deepEqual(sent.threadContext, { threadId: "t9", lastMessageId: "<xyz@mail.example.com>" });
  assert.equal(activityCreate.mock.callCount() + leadUpdate.mock.callCount() + transaction.mock.callCount(), 0);
});

test("reply to a scrapped lead is a plain threaded reply: no Activity, no stage change", async () => {
  const { prisma, activityCreate, leadUpdate } = fakePrisma();
  const sendEmailFn = okSend();
  await sendInboxReply({
    threadId: "t1",
    lastMessageId: "<abc@mail.example.com>",
    recipientAddress: "alice@example.com",
    lead: { id: "lead1", name: "Alice Smith", stage: "UNCONTACTED", email: "alice@example.com", scrapped: true, business: "FDH", businesses: ["FDH"] },
    subject: "Re: Quote",
    body: "Thanks",
    userId: "user1",
    sendEmailFn,
    prismaClient: prisma,
  });
  assert.equal(sendEmailFn.mock.calls[0].arguments[0].to, "alice@example.com");
  assert.equal(activityCreate.mock.callCount() + leadUpdate.mock.callCount(), 0);
});

test("a failed Gmail send from the inbox reports the reason and writes nothing", async () => {
  const { prisma, activityCreate } = fakePrisma();
  const sendEmailFn = mock.fn<SendEmailFn>(async () => ({ ok: false as const, reason: "reconnect" as const, message: "Gmail needs to be reconnected." }));
  const result = await sendInboxReply({
    threadId: "t1",
    lastMessageId: null,
    recipientAddress: "stranger@example.com",
    lead: null,
    subject: "Re: Hello",
    body: "Hi",
    userId: "user1",
    sendEmailFn,
    prismaClient: prisma,
  });
  assert.equal(result.ok, false);
  assert.equal(!result.ok && !result.sent && result.reason, "reconnect");
  assert.equal(activityCreate.mock.callCount(), 0);
});

// --- Reply-To ---------------------------------------------------------------------

test("singleReplyTo accepts exactly one valid address that isn't ours", () => {
  assert.deepEqual(singleReplyTo('"Jo Bloggs" <jo@example.com>', US), { name: "Jo Bloggs", address: "jo@example.com" });
  assert.equal(singleReplyTo("jo@example.com, sam@example.com", US), null, "two addresses");
  assert.equal(singleReplyTo("not an address", US), null, "invalid");
  assert.equal(singleReplyTo(`Us <${US.toUpperCase()}>`, US), null, "our own address");
  assert.equal(singleReplyTo(null, US), null, "missing");
});

test("a later message from the customer themselves replies to their own address", () => {
  const target = findReplyTarget(
    [
      msg({ From: "Web3Forms <notify@web3forms.com>", "Reply-To": "Kim Lee <kim.lee@example.com>" }, { internalDate: 1 }),
      msg({ From: US, To: "kim.lee@example.com" }, { internalDate: 2, labelIds: ["SENT"] }),
      msg({ From: "Kim Lee <kim.lee@example.com>" }, { internalDate: 3 }),
    ],
    US
  );
  assert.equal(target.recipient?.address, "kim.lee@example.com");
  assert.equal(target.replyTo, null);
});

test("pickThreadLead prefers the Reply-To match, then falls back to the sender", () => {
  const matches = matchLeadsByEmail(
    ["kim.lee@example.com", "notify@web3forms.com"],
    [lead({ id: "customer", email: "kim.lee@example.com" }), lead({ id: "service", email: "notify@web3forms.com" })]
  );
  assert.equal(pickThreadLead(matches, { replyTo: "Kim.Lee@example.com", from: "notify@web3forms.com" })?.id, "customer");
  assert.equal(pickThreadLead(matches, { replyTo: null, from: "notify@web3forms.com" })?.id, "service");
  assert.equal(pickThreadLead(matches, { replyTo: "nobody@example.com", from: "nobody2@example.com" }), null);
});

test("Web3Forms-style notification: list row and thread match the customer's lead, and a reply goes to the customer", async () => {
  // From the form service, Reply-To the customer, as a website form notification arrives.
  const thread: gmail_v1.Schema$Thread = {
    id: "wf1",
    messages: [
      msg(
        {
          From: "Web3Forms <notify@web3forms.com>",
          To: US,
          "Reply-To": "Kim Lee <Kim.Lee@example.com>",
          Subject: "New Quote Request - Flyer Distribution Hampshire",
          "Message-ID": "<wf1@web3forms.com>",
        },
        { id: "wf1m0", labelIds: ["INBOX", "UNREAD"] }
      ),
    ],
  };

  // The list row keeps the real sender but carries the Reply-To for matching.
  const summary = summarizeThread(thread, US);
  assert.equal(summary?.fromAddress, "notify@web3forms.com");
  assert.equal(summary?.replyToAddress, "Kim.Lee@example.com");

  // Same steps the routes take: match on Reply-To and From, Reply-To first.
  const target = findReplyTarget(thread.messages, US);
  assert.equal(target.recipient?.address, "Kim.Lee@example.com", "reply goes to the customer, not the form service");
  const findMany = mock.fn(async (_args: unknown) => [
    lead({ id: "kim", name: "Kim Lee", email: "kim.lee@example.com", stage: "UNCONTACTED" }),
  ]);
  const matches = await findLeadsForAddresses({ lead: { findMany } }, [target.replyTo?.address ?? "", target.from?.address ?? ""]);
  const asked = (findMany.mock.calls[0].arguments[0] as { where: { OR: { email: { equals: string } }[] } }).where.OR.map((o) => o.email.equals);
  assert.deepEqual(asked, ["kim.lee@example.com", "notify@web3forms.com"]);
  const matched = pickThreadLead(matches, { replyTo: target.replyTo?.address, from: target.from?.address });
  assert.equal(matched?.id, "kim", "matched to the customer's lead");

  // And the reply itself: to the customer, recorded on her lead via the shared logic.
  const { prisma, activityCreate, leadUpdate } = fakePrisma();
  const sendEmailFn = okSend();
  const result = await sendInboxReply({
    threadId: "wf1",
    lastMessageId: "<wf1@web3forms.com>",
    recipientAddress: target.recipient!.address,
    lead: matched,
    subject: "Re: New Quote Request - Flyer Distribution Hampshire",
    body: "Hi Kim, thanks for your enquiry.",
    userId: "user1",
    sendEmailFn,
    prismaClient: prisma,
  });
  assert.equal(result.ok && result.movedToAwaitingResponse, true);
  const sent = sendEmailFn.mock.calls[0].arguments[0];
  assert.equal(sent.to, "Kim.Lee@example.com");
  assert.notEqual(sent.to.toLowerCase(), "notify@web3forms.com");
  assert.deepEqual(sent.threadContext, { threadId: "wf1", lastMessageId: "<wf1@web3forms.com>" });
  assert.equal((leadUpdate.mock.calls[0].arguments[0] as { where: { id: string } }).where.id, "kim");
  assert.deepEqual(
    activityCreate.mock.calls.map((c) => {
      const { leadId, type } = (c.arguments[0] as { data: { leadId: string; type: string } }).data;
      return { leadId, type };
    }),
    [
      { leadId: "kim", type: "EMAIL" },
      { leadId: "kim", type: "STAGE_CHANGE" },
    ]
  );
});
