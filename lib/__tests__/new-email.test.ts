import { test } from "node:test";
import assert from "node:assert/strict";
import { checkNewEmailAddress, sendNewEmail } from "@/lib/new-email";
import { composeSendPayload, looksLikeOneAddress, replySubject } from "@/lib/email-compose";
import { sendLeadEmailAndRecord, type SendEmailFn, type SendLeadEmailPrisma } from "@/lib/send-lead-email";
import { sendEmailVia, type GmailSendApi, type SendAsEntry } from "@/lib/gmail";

const US = "flyerdistributionhampshire@gmail.com";

function fakeSend(ok = true) {
  const calls: Parameters<SendEmailFn>[0][] = [];
  const fn: SendEmailFn = async (params) => {
    calls.push(params);
    return ok
      ? { ok: true, data: { messageId: "m1", threadId: "t-new", signature: "added" } }
      : { ok: false, reason: "error", message: "Gmail is having problems right now." };
  };
  return { fn, calls };
}

// Records what would be written. If touched is false at the end, nothing was.
function fakePrisma() {
  const writes: { kind: string; data: unknown }[] = [];
  let touched = false;
  const prisma: SendLeadEmailPrisma = {
    activity: {
      create: (args) => {
        touched = true;
        writes.push({ kind: "activity", data: args.data });
        return args;
      },
    },
    lead: {
      update: (args) => {
        touched = true;
        writes.push({ kind: "lead", data: args.data });
        return args;
      },
    },
    $transaction: async (ops) => {
      touched = true;
      return ops;
    },
  };
  return { prisma, writes, touched: () => touched };
}

const LEAD = { id: "lead1", name: "Hannah Cole", stage: "UNCONTACTED", email: "hannah@example.com", scrapped: false };

// --- The address ------------------------------------------------------------

test("an invalid address is refused: not one plain address, or too long", () => {
  for (const bad of [
    "",
    "   ",
    "not-an-email",
    "hannah@example",
    "hannah@example.com, dan@example.com",
    "hannah@example.com dan@example.com",
    "hannah@example.com;dan@example.com",
    "Hannah Cole <hannah@example.com>",
    `${"a".repeat(250)}@example.com`,
    42,
    null,
  ]) {
    const checked = checkNewEmailAddress(bad, []);
    assert.equal(checked.ok, false, String(bad));
    assert.equal(!checked.ok && checked.reason, "invalid", String(bad));
  }
  assert.deepEqual(checkNewEmailAddress("  hannah@example.com ", []), { ok: true, address: "hannah@example.com" });
  assert.equal(looksLikeOneAddress("Hannah <hannah@example.com>"), false);
});

test("an address in GMAIL_EXCLUDE_ADDRESSES is refused, whatever its case", () => {
  const excluded = ["team-list@example.org"];
  for (const address of ["team-list@example.org", "Team-List@Example.ORG"]) {
    const checked = checkNewEmailAddress(address, excluded);
    assert.deepEqual(checked, { ok: false, reason: "excluded", error: "The CRM doesn't send to this address." });
  }
  assert.equal(checkNewEmailAddress("someone@example.org", excluded).ok, true);
});

// --- Who it goes to -----------------------------------------------------------

test("a new email to a lead records the Activity and moves an Uncontacted lead to Awaiting Response", async () => {
  const send = fakeSend();
  const db = fakePrisma();
  const result = await sendNewEmail({
    to: "Hannah@Example.com",
    lead: LEAD,
    subject: "Your leaflet quote",
    body: "Hi Hannah, here is the quote.",
    userId: "user1",
    sendEmailFn: send.fn,
    prismaClient: db.prisma,
  });
  assert.deepEqual(result, { ok: true, recordedOnLead: true, movedToAwaitingResponse: true, signature: "added" });
  assert.equal(send.calls.length, 1);
  assert.equal(send.calls[0].threadContext, null, "always a fresh thread");
  assert.deepEqual(db.writes, [
    {
      kind: "activity",
      data: { leadId: "lead1", type: "EMAIL", detail: 'Email: "Your leaflet quote"\n\nHi Hannah, here is the quote.', userId: "user1" },
    },
    { kind: "lead", data: { stage: "AWAITING_RESPONSE", noAnswerStreak: 0, nextCallableAt: null } },
    {
      kind: "activity",
      data: {
        leadId: "lead1",
        type: "STAGE_CHANGE",
        detail: "Stage changed from Uncontacted to Warm / Awaiting Response because an email was sent.",
        userId: "user1",
      },
    },
  ]);
});

test("a new email to a lead past Uncontacted records the Activity without moving it", async () => {
  const db = fakePrisma();
  const result = await sendNewEmail({
    to: LEAD.email,
    lead: { ...LEAD, stage: "WON" },
    subject: "Next campaign",
    body: "Hello again",
    userId: "user1",
    sendEmailFn: fakeSend().fn,
    prismaClient: db.prisma,
  });
  assert.equal(result.ok && result.movedToAwaitingResponse, false);
  assert.deepEqual(db.writes.map((w) => w.kind), ["activity"]);
});

test("a new email to someone who isn't a lead, or a scrapped lead, writes nothing to the database", async () => {
  for (const lead of [null, { ...LEAD, scrapped: true }]) {
    const send = fakeSend();
    const db = fakePrisma();
    const result = await sendNewEmail({
      to: "printer@example.com",
      lead,
      subject: "Order",
      body: "Please print 5,000 A5 leaflets.",
      userId: "user1",
      sendEmailFn: send.fn,
      prismaClient: db.prisma,
    });
    assert.deepEqual(result, { ok: true, recordedOnLead: false, movedToAwaitingResponse: false, signature: "added" });
    assert.equal(send.calls[0].to, "printer@example.com");
    assert.equal(send.calls[0].threadContext, null);
    assert.equal(db.touched(), false);
  }
});

test("if Gmail fails, nothing is written for a lead either", async () => {
  const db = fakePrisma();
  const result = await sendNewEmail({
    to: LEAD.email,
    lead: LEAD,
    subject: "Quote",
    body: "Hi",
    userId: "user1",
    sendEmailFn: fakeSend(false).fn,
    prismaClient: db.prisma,
  });
  assert.equal(result.ok, false);
  assert.equal(db.touched(), false);
});

// --- Reply to latest, or a new email -----------------------------------------

const LATEST = { subject: "Your quote", threadId: "thread123", lastMessageId: "<abc123@mail.gmail.com>" };

test("the compose modal's payload: Reply to latest carries the thread, New email carries none", () => {
  assert.deepEqual(composeSendPayload({ mode: "reply", replyTo: LATEST, subject: " Re: Your quote ", body: "Thanks" }), {
    subject: "Re: Your quote",
    body: "Thanks",
    threadId: "thread123",
    lastMessageId: "<abc123@mail.gmail.com>",
  });
  const fresh = composeSendPayload({ mode: "new", replyTo: LATEST, subject: "A new idea", body: "Hello" });
  assert.deepEqual(fresh, { subject: "A new idea", body: "Hello" });
  assert.equal("threadId" in fresh, false);
  assert.equal("lastMessageId" in fresh, false);
  assert.deepEqual(composeSendPayload({ mode: "new", replyTo: null, subject: "Hi", body: "x", to: " a@b.com " }), {
    subject: "Hi",
    body: "x",
    to: "a@b.com",
  });
  assert.equal(replySubject("Your quote"), "Re: Your quote");
  assert.equal(replySubject("RE: Your quote"), "RE: Your quote");
});

test("New email on a lead with a conversation starts a new thread: no threadId, no In-Reply-To or References", async () => {
  const sent: { raw: string; threadId?: string }[] = [];
  const api: GmailSendApi = {
    async send(requestBody) {
      sent.push(requestBody);
      return { id: `m${sent.length}`, threadId: requestBody.threadId ?? "brand-new-thread" };
    },
    async listSendAs(): Promise<SendAsEntry[]> {
      return [{ sendAsEmail: US, signature: "" }];
    },
  };
  const sendViaGmail: SendEmailFn = (params) => sendEmailVia(api, US, params);
  // As the lead's email route reads it: thread details only if both are sent.
  const toContext = (p: { threadId?: string; lastMessageId?: string }) =>
    p.threadId && p.lastMessageId ? { threadId: p.threadId, lastMessageId: p.lastMessageId } : null;

  for (const mode of ["new", "reply"] as const) {
    const payload = composeSendPayload({ mode, replyTo: LATEST, subject: mode === "new" ? "Fresh" : "Re: Your quote", body: "Hi" });
    await sendLeadEmailAndRecord({
      lead: { id: "lead1", stage: "AWAITING_RESPONSE" },
      to: LEAD.email,
      subject: payload.subject,
      body: payload.body,
      userId: "user1",
      threadContext: toContext(payload),
      sendEmailFn: sendViaGmail,
      prismaClient: fakePrisma().prisma,
    });
  }
  const headersOf = (raw: string) => Buffer.from(raw.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8").split("\r\n\r\n")[0];
  const [fresh, reply] = sent;
  assert.equal(fresh.threadId, undefined);
  assert.doesNotMatch(headersOf(fresh.raw), /^In-Reply-To:/m);
  assert.doesNotMatch(headersOf(fresh.raw), /^References:/m);
  assert.match(headersOf(fresh.raw), /^Subject: Fresh$/m);
  // The same conversation, replied to, for contrast.
  assert.equal(reply.threadId, "thread123");
  assert.match(headersOf(reply.raw), /^In-Reply-To: <abc123@mail.gmail.com>$/m);
});
