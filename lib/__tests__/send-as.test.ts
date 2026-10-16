import { test } from "node:test";
import assert from "node:assert/strict";
import type { gmail_v1 } from "@googleapis/gmail";
import {
  conversationQuery,
  findCounterparty,
  findReplyTarget,
  inLeadConversation,
  isLdbThread,
  latestUnanswered,
  messageSender,
  parseConversationMessage,
  summarizeThread,
  type SendEmailParams,
} from "@/lib/gmail";
import { matchLeadsByEmail, type InboxLeadCandidate } from "@/lib/inbox-leads";
import { crmMatchesFor, type CrmLookups } from "@/lib/inbox-crm";
import { replyBusiness, senderFor, type ChannelSenders } from "@/lib/email-channel";
import { sendInboxReply } from "@/lib/inbox-reply";
import { unansweredLeadEmails } from "@/lib/priorities-email";
import { crmCopy, daysAgo, FDH, msg, notification, OURS, SARAH, SENDER, thread } from "./ldb-backfill-fixtures";

// A form notification sent as one of our own addresses (the LDB website's,
// through the send-as Bournemouth address) with the enquirer as its only
// Reply-To is treated as received from the enquirer. Anything else from our
// addresses stays sent by us. OURS is the Hampshire Gmail and the Bournemouth
// address, as ownAddresses gives them with LDB_SENDER_ADDRESS set.

const SARAH_EMAIL = "sarah@example.com";
const CANDIDATES: InboxLeadCandidate[] = [
  { id: "ldb-sarah", name: "Sarah Mitchell", stage: "UNCONTACTED", email: SARAH_EMAIL, scrapped: false, createdAt: new Date("2026-10-01"), business: "LDB" },
  { id: "fdh-kim", name: "Kim Lee", stage: "AWAITING_RESPONSE", email: "kim@example.com", scrapped: false, createdAt: new Date("2026-09-01"), business: "FDH" },
];

function lookupsFor(addresses: string[]): CrmLookups {
  return {
    leads: matchLeadsByEmail(addresses, CANDIDATES, { prefer: "FDH" }),
    ldbLeads: matchLeadsByEmail(addresses, CANDIDATES, { only: "LDB" }),
    distributors: new Map(),
    applicants: new Map(),
  };
}

const headersOf = (m: gmail_v1.Schema$Message) => m.payload?.headers;

test("send-as: an LDB notification shows as received from the enquirer, with the lead badge", () => {
  const n = notification("n1", daysAgo(2), SARAH);
  assert.deepEqual(n.labelIds, ["SENT", "INBOX"]);
  assert.deepEqual(messageSender(headersOf(n), OURS), {
    from: { name: "Sarah Mitchell", address: SARAH_EMAIL },
    sent: false,
    viaReplyTo: true,
  });

  // The thread view: received, and the sender shown is the enquirer.
  const parsed = parseConversationMessage(n, OURS)!;
  assert.equal(parsed.direction, "received");
  assert.equal(parsed.from, `Sarah Mitchell <${SARAH_EMAIL}>`);
  assert.deepEqual(findCounterparty([n], OURS), { name: "Sarah Mitchell", address: SARAH_EMAIL });

  // The Inbox list row: the enquirer as sender and Reply-To, so the lead is matched.
  const t = thread("t1", [n]);
  const summary = summarizeThread(t, OURS)!;
  assert.equal(summary.fromName, "Sarah Mitchell");
  assert.equal(summary.fromAddress, SARAH_EMAIL);
  assert.equal(summary.replyToAddress, SARAH_EMAIL);
  const ldbThread = isLdbThread(t.messages, SENDER);
  assert.equal(ldbThread, true);
  const lookups = lookupsFor([summary.fromAddress, summary.replyToAddress ?? ""]);
  const matched = crmMatchesFor(lookups, { replyTo: summary.replyToAddress, from: summary.fromAddress }, { ldbThread });
  assert.equal(matched.lead?.id, "ldb-sarah", "the lead badge");
  assert.equal(matched.lead?.business, "LDB");
});

function fakeSenders() {
  const sent: { channel: "gmail" | "ldb"; params: SendEmailParams }[] = [];
  const send = (channel: "gmail" | "ldb") => async (params: SendEmailParams) => {
    sent.push({ channel, params });
    return { ok: true as const, data: { messageId: "m1", threadId: params.threadContext?.threadId ?? "t-new", signature: "added" as const } };
  };
  const senders: ChannelSenders = { gmail: send("gmail"), ldb: send("ldb") };
  return { senders, sent };
}

function fakeDb() {
  return {
    activity: { create: (args: { data: unknown }) => args },
    lead: { update: (args: { data: unknown }) => args },
    $transaction: async (ops: unknown[]) => ops,
  };
}

async function replyInThread(messages: gmail_v1.Schema$Message[]) {
  const t = thread("t-reply", messages);
  const target = findReplyTarget(t.messages, OURS);
  const ldbThread = isLdbThread(t.messages, SENDER);
  const addresses = { replyTo: target.replyTo?.address ?? null, from: target.from?.address ?? null };
  const lookups = lookupsFor([addresses.replyTo ?? "", addresses.from ?? ""]);
  const lead = crmMatchesFor(lookups, addresses, { ldbThread }).lead;
  const { senders, sent } = fakeSenders();
  await sendInboxReply({
    threadId: "t-reply",
    lastMessageId: "<n1@mail.example>",
    recipientAddress: target.recipient!.address,
    lead,
    subject: "Re: Leaflet Distribution enquiry from Sarah Mitchell",
    body: "Hi Sarah\n\nKind regards,\nDan",
    userId: "u1",
    sendEmailFn: senderFor(replyBusiness(ldbThread, lead), senders),
    prismaClient: fakeDb(),
  });
  return { target, lead, sent };
}

test("send-as: an Inbox reply to an LDB notification goes to the enquirer through Brevo", async () => {
  const { target, lead, sent } = await replyInThread([notification("n1", daysAgo(2), SARAH)]);
  assert.equal(target.recipient?.address, SARAH_EMAIL);
  assert.equal(lead?.id, "ldb-sarah");
  assert.equal(sent.length, 1);
  assert.equal(sent[0].channel, "ldb", "through Brevo, never the Hampshire Gmail");
  assert.equal(sent[0].params.to, SARAH_EMAIL, "to the enquirer, not our own Gmail");
  assert.equal(sent[0].params.threadContext?.lastMessageId, "<n1@mail.example>");

  // With the CRM's own reply already in the thread, the next reply still goes to her.
  const again = await replyInThread([
    notification("n1", daysAgo(2), SARAH),
    crmCopy("c1", daysAgo(1), SARAH_EMAIL, "Re: Leaflet Distribution enquiry from Sarah Mitchell"),
  ]);
  assert.equal(again.sent[0].channel, "ldb");
  assert.equal(again.sent[0].params.to, SARAH_EMAIL);
});

test("send-as: a notification sent as the Hampshire Gmail is received from its Reply-To person, and a reply goes by Gmail", async () => {
  const fdhForm = msg("f1", { from: `Flyer Distribution Hampshire <${FDH}>`, to: FDH, replyTo: "Kim Lee <kim@example.com>", subject: "Quote request from Kim Lee", at: daysAgo(1), labels: ["SENT", "INBOX"], text: "Name: Kim Lee" });
  assert.equal(parseConversationMessage(fdhForm, OURS)!.direction, "received");
  const { target, lead, sent } = await replyInThread([fdhForm]);
  assert.equal(target.recipient?.address, "kim@example.com");
  assert.equal(lead?.id, "fdh-kim");
  assert.deepEqual(sent.map((s) => [s.channel, s.params.to]), [["gmail", "kim@example.com"]]);
});

test("send-as: the CRM's own sent copies (Reply-To the LDB address) stay as sent", () => {
  const copy = crmCopy("c1", daysAgo(1), SARAH_EMAIL, "Re: Leaflet Distribution enquiry from Sarah Mitchell");
  assert.deepEqual(messageSender(headersOf(copy), OURS).sent, true);
  const parsed = parseConversationMessage(copy, OURS)!;
  assert.equal(parsed.direction, "sent");
  assert.equal(parsed.from, `"Leaflet Distribution Bournemouth" <${SENDER}>`, "shown as it was sent");
  // In a thread with the notification, the reply target is still the enquirer.
  const n = notification("n1", daysAgo(2), SARAH);
  assert.equal(findReplyTarget([n, copy], OURS).recipient?.address, SARAH_EMAIL);
  // On its own, the thread is ours and goes to whoever it was sent to.
  assert.deepEqual(findReplyTarget([copy], OURS), { from: null, replyTo: null, recipient: { name: SARAH_EMAIL, address: SARAH_EMAIL } });
});

test("send-as: a normal sent message stays as sent", () => {
  const plain = msg("s1", { from: `Flyer Distribution Hampshire <${FDH}>`, to: "kim@example.com", subject: "Your quote", at: daysAgo(1), labels: ["SENT"], text: "Hi" });
  assert.equal(messageSender(headersOf(plain), OURS).sent, true);
  assert.equal(parseConversationMessage(plain, OURS)!.direction, "sent");
  // A Reply-To of ours, or more than one Reply-To, changes nothing.
  for (const replyTo of [FDH, SENDER, "kim@example.com, sam@example.com"]) {
    const m = msg("s2", { from: FDH, to: "kim@example.com", replyTo, subject: "Your quote", at: daysAgo(1), labels: ["SENT"], text: "Hi" });
    assert.equal(parseConversationMessage(m, OURS)!.direction, "sent", replyTo);
  }
  // A message from someone else is received, as before, Reply-To or not.
  const theirs = msg("r1", { from: "Kim Lee <kim@example.com>", subject: "Re: Your quote", at: daysAgo(1), text: "Thanks" });
  assert.deepEqual(messageSender(headersOf(theirs), OURS), { from: { name: "Kim Lee", address: "kim@example.com" }, sent: false, viaReplyTo: false });
});

test("send-as: Priorities never counts a notification as an unanswered email; the lead's own replies still count", async () => {
  const n = notification("n1", daysAgo(3), SARAH);
  const onlyNotification = thread("t-n", [n]);
  assert.equal(latestUnanswered(onlyNotification, OURS), null);
  assert.equal(latestUnanswered(thread("t-n2", [{ ...n, labelIds: ["INBOX"] }]), OURS), null, "with or without the SENT label");

  const herReply = msg("r1", { from: `Sarah Mitchell <${SARAH_EMAIL}>`, to: SENDER, subject: "Re: Leaflet Distribution enquiry from Sarah Mitchell", at: daysAgo(1), text: "Any update?" });
  const replied = thread("t-r", [n, herReply]);
  assert.equal(latestUnanswered(replied, OURS)?.fromAddress, SARAH_EMAIL);

  const db = { lead: { findMany: async () => CANDIDATES } };
  const context = { senderAddress: FDH, excluded: [], own: OURS, ldbAddress: SENDER };
  const emails = await unansweredLeadEmails([onlyNotification, replied], context, db);
  assert.deepEqual(emails.map((e) => [e.threadId, e.lead.id]), [["t-r", "ldb-sarah"]]);
});

test("send-as: the enquirer's lead page finds the notification and shows it as received", () => {
  assert.equal(conversationQuery(SARAH_EMAIL), `(from:"${SARAH_EMAIL}" OR to:"${SARAH_EMAIL}" OR "${SARAH_EMAIL}")`);
  const n = notification("n1", daysAgo(2), SARAH);
  assert.equal(inLeadConversation(n, SARAH_EMAIL, OURS), true, "as its Reply-To person");
  assert.equal(inLeadConversation(n, "SARAH@Example.com", OURS), true);
  assert.equal(parseConversationMessage(n, OURS)!.direction, "received");
  assert.equal(inLeadConversation(crmCopy("c1", daysAgo(1), SARAH_EMAIL, "Re: hi"), SARAH_EMAIL, OURS), true, "to her");
  assert.equal(inLeadConversation(msg("r1", { from: SARAH_EMAIL, subject: "Hi", at: daysAgo(1), text: "Hi" }), SARAH_EMAIL, OURS), true, "from her");
  assert.equal(inLeadConversation(msg("b1", { from: FDH, to: "someone@example.org", subject: "Hi", at: daysAgo(1), text: "Hi" }), SARAH_EMAIL, OURS), false);
  const bcc = msg("b2", { from: FDH, to: "someone@example.org", subject: "Hi", at: daysAgo(1), text: "Hi" });
  bcc.payload!.headers!.push({ name: "Bcc", value: SARAH_EMAIL });
  assert.equal(inLeadConversation(bcc, SARAH_EMAIL, OURS), true, "blind-copied to her");
  // Her address only mentioned in someone else's email doesn't bring it in.
  const mention = msg("x1", { from: "Kim Lee <kim@example.com>", subject: "Referral", at: daysAgo(1), text: `You could try ${SARAH_EMAIL}` });
  assert.equal(inLeadConversation(mention, SARAH_EMAIL, OURS), false);
  // Nor does another enquirer's notification.
  const other = notification("n2", daysAgo(2), { ...SARAH, replyTo: '"Kim Lee" <kim@example.com>' });
  assert.equal(inLeadConversation(other, SARAH_EMAIL, OURS), false);
});
