import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { MAX_PER_HOUR, THANK_YOU_NOTE, sendQuoteThankYou, type ThankYouSend } from "@/lib/quote-thank-you";
import { buildPriorities, type LeadFacts } from "@/lib/priorities";
import { isPersonLoggedContact } from "@/lib/activity-origin";
import type { SendEmailParams } from "@/lib/gmail";

// The automatic thank-you email to a website quote enquiry, against a real
// database, but only a throwaway local one: it needs CRM_TEST_DATABASE_URL
// pointing at localhost and is skipped otherwise, so it can never touch the
// production database. Every send goes to a fake; nothing is emailed. It
// cleans up after itself.

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

const DOMAIN = "@thank-you-test.example";
let prisma: PrismaClient;

async function cleanUp() {
  await prisma.lead.deleteMany({ where: { email: { endsWith: DOMAIN, mode: "insensitive" } } });
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

let count = 0;
async function websiteLead(overrides: Record<string, unknown> = {}) {
  count++;
  return prisma.lead.create({
    data: {
      name: `Sarah Example ${count}`,
      email: `sarah${count}${DOMAIN}`,
      source: "WEBSITE_QUOTE_FORM",
      business: "FDH",
      targetAreas: "Ringwood",
      activities: { create: { type: "NOTE", detail: "Service type: Leaflet Distribution" } },
      ...overrides,
    },
    select: { id: true, email: true, business: true },
  });
}

// A fake Gmail: records each email, or fails as told.
function fakeSend(result: "ok" | "reconnect" | "throw" = "ok") {
  const sent: SendEmailParams[] = [];
  const send: ThankYouSend = async (params) => {
    if (result === "throw") throw new Error("network down");
    if (result !== "ok") return { ok: false, reason: result, message: "Gmail needs reconnecting." };
    sent.push(params);
    return { ok: true, data: { messageId: "m", threadId: "t", signature: "none" } };
  };
  return { sent, send };
}

const ENQUIRY = { firstName: "Sarah", service: "Leaflet Distribution", targetAreas: "Ringwood" };
const notes = (leadId: string) => prisma.activity.findMany({ where: { leadId, detail: THANK_YOU_NOTE }, select: { type: true, userId: true } });

async function captureLogs<T>(fn: () => Promise<T>): Promise<{ result: T; logs: string }> {
  const lines: string[] = [];
  const methods = ["log", "info", "warn", "error"] as const;
  const originals = methods.map((m) => console[m]);
  methods.forEach((m) => (console[m] = (...args: unknown[]) => lines.push(args.map(String).join(" "))));
  try {
    return { result: await fn(), logs: lines.join("\n") };
  } finally {
    methods.forEach((m, i) => (console[m] = originals[i]));
  }
}

test("real database: an FDH quote enquiry gets one thank-you email, with the HTML, the text and the note", { skip }, async () => {
  const lead = await websiteLead();
  const fake = fakeSend();
  assert.equal(await sendQuoteThankYou({ db: prisma, lead, enquiry: ENQUIRY, send: fake.send }), "sent");
  assert.equal(fake.sent.length, 1);
  const [email] = fake.sent;
  assert.equal(email.to, lead.email);
  assert.equal(email.subject, "Congratulations Sarah, you've come to the right place");
  assert.match(email.html ?? "", /^<!DOCTYPE html>/);
  assert.ok(email.body.startsWith("Hi Sarah,\n\nThanks for getting in touch about your leaflet campaign in Ringwood."));
  assert.deepEqual(await notes(lead.id), [{ type: "NOTE", userId: null }]);
});

test("real database: never for a Bournemouth lead, nor without a usable address", { skip }, async () => {
  const fake = fakeSend();
  const ldb = await websiteLead({ business: "LDB" });
  assert.equal(await sendQuoteThankYou({ db: prisma, lead: ldb, enquiry: ENQUIRY, send: fake.send }), "not_fdh");
  for (const email of [null, "", "not an address", "two@example.com, three@example.com", "eve@example.com\r\nBcc: x@example.com"]) {
    const lead = await websiteLead({ email: email === null ? null : email });
    assert.equal(await sendQuoteThankYou({ db: prisma, lead, enquiry: ENQUIRY, send: fake.send }), "no_email", String(email));
    await prisma.lead.delete({ where: { id: lead.id } });
  }
  assert.equal(fake.sent.length, 0);
  assert.deepEqual(await notes(ldb.id), []);
});

test("real database: only for Leaflet Distribution enquiries, not Web Design & SEO, Screen Hire or none chosen", { skip }, async () => {
  const fake = fakeSend();
  for (const service of ["Web Design & SEO", "Screen Hire", "", null]) {
    const lead = await websiteLead();
    assert.equal(await sendQuoteThankYou({ db: prisma, lead, enquiry: { ...ENQUIRY, service }, send: fake.send }), "not_leaflet", String(service));
    assert.deepEqual(await notes(lead.id), [], String(service));
  }
  assert.equal(fake.sent.length, 0);
  // The same lead's leaflet enquiry does get one.
  const leaflet = await websiteLead();
  assert.equal(await sendQuoteThankYou({ db: prisma, lead: leaflet, enquiry: { ...ENQUIRY, service: " Leaflet Distribution " }, send: fake.send }), "sent");
  assert.equal(fake.sent.length, 1);
});

test("real database: at most once per email address in 24 hours, a double submission included", { skip }, async () => {
  const now = new Date("2030-03-01T10:00:00.000Z");
  const fake = fakeSend();
  const first = await websiteLead({ email: `twice${DOMAIN}` });
  assert.equal(await sendQuoteThankYou({ db: prisma, lead: first, enquiry: ENQUIRY, send: fake.send, now }), "sent");
  // The same person again an hour later, with their address in capitals: no second email.
  const again = await websiteLead({ email: `TWICE${DOMAIN}` });
  const { result, logs } = await captureLogs(() =>
    sendQuoteThankYou({ db: prisma, lead: again, enquiry: ENQUIRY, send: fake.send, now: new Date(now.getTime() + 60 * 60 * 1000) })
  );
  assert.equal(result, "sent_recently");
  assert.match(logs, /^Quote thank-you email skipped: one went to this address in the last 24 hours$/m);
  assert.doesNotMatch(logs, /twice/i, "no address in the logs");
  assert.equal(fake.sent.length, 1);
  assert.deepEqual(await notes(again.id), []);
  // A day later, they get one again.
  const later = await websiteLead({ email: `twice${DOMAIN}` });
  assert.equal(await sendQuoteThankYou({ db: prisma, lead: later, enquiry: ENQUIRY, send: fake.send, now: new Date(now.getTime() + 25 * 60 * 60 * 1000) }), "sent");
  assert.equal(fake.sent.length, 2);

  // Two submissions at the same moment: exactly one email.
  const at = new Date("2030-04-01T10:00:00.000Z");
  const a = await websiteLead({ email: `double${DOMAIN}` });
  const b = await websiteLead({ email: `double${DOMAIN}` });
  const both = fakeSend();
  const outcomes = await Promise.all([a, b].map((lead) => sendQuoteThankYou({ db: prisma, lead, enquiry: ENQUIRY, send: both.send, now: at })));
  assert.deepEqual(outcomes.sort(), ["sent", "sent_recently"]);
  assert.equal(both.sent.length, 1);
});

test("real database: a failed send changes nothing about the enquiry, logs a fixed reason, and a later one can try again", { skip }, async () => {
  const now = new Date("2030-05-01T10:00:00.000Z");
  for (const failure of ["reconnect", "throw"] as const) {
    const lead = await websiteLead({ email: `fails-${failure}${DOMAIN}` });
    const before = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id }, include: { activities: { orderBy: { createdAt: "asc" } } } });
    const { result, logs } = await captureLogs(() => sendQuoteThankYou({ db: prisma, lead, enquiry: ENQUIRY, send: fakeSend(failure).send, now }));
    assert.equal(result, "failed");
    assert.equal(logs, `Quote thank-you email not sent: ${failure === "throw" ? "error" : "reconnect"}`);
    const afterwards = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id }, include: { activities: { orderBy: { createdAt: "asc" } } } });
    assert.deepEqual(afterwards, before, "the lead and its notes are exactly as they were");
    // Nothing was sent, so the next enquiry from them gets one.
    const retry = fakeSend();
    assert.equal(await sendQuoteThankYou({ db: prisma, lead, enquiry: ENQUIRY, send: retry.send, now }), "sent");
    assert.equal(retry.sent.length, 1);
  }
});

test("real database: the lead stays Uncontacted, its New enquiry item stays on Priorities, and the note isn't contact", { skip }, async () => {
  const lead = await websiteLead({ email: `stays${DOMAIN}` });
  assert.equal(await sendQuoteThankYou({ db: prisma, lead, enquiry: ENQUIRY, send: fakeSend().send }), "sent");
  const row = await prisma.lead.findUniqueOrThrow({
    where: { id: lead.id },
    include: { activities: { select: { type: true, detail: true, createdAt: true, userId: true } } },
  });
  assert.equal(row.stage, "UNCONTACTED");
  const note = row.activities.find((a) => a.detail === THANK_YOU_NOTE)!;
  assert.equal(isPersonLoggedContact(note), false);
  const facts: LeadFacts = {
    id: row.id,
    name: row.name,
    businessName: row.businessName,
    email: row.email,
    phone: row.phone,
    stage: row.stage,
    business: row.business,
    source: row.source,
    paymentStatus: row.paymentStatus,
    reviewStatus: row.reviewStatus,
    createdAt: row.createdAt.toISOString(),
    scrapped: row.scrapped,
    activities: row.activities.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
    job: null,
  };
  const rows = buildPriorities({ now: new Date(), leads: [facts], applications: [], tasks: [], emails: [], dismissals: [] });
  const items = rows.flatMap((r) => [r.primary, ...r.others]);
  assert.deepEqual(items.map((i) => [i.type, i.title]), [["new_enquiry", "New enquiry"]]);
});

test("real database: no more than the hourly limit across the site", { skip }, async () => {
  const now = new Date("2030-06-01T10:00:00.000Z");
  const fake = fakeSend();
  for (let i = 0; i < MAX_PER_HOUR; i++) {
    const lead = await websiteLead({ email: `hourly${i}${DOMAIN}` });
    assert.equal(await sendQuoteThankYou({ db: prisma, lead, enquiry: ENQUIRY, send: fake.send, now: new Date(now.getTime() + i * 1000) }), "sent");
  }
  const one = await websiteLead({ email: `hourly-over${DOMAIN}` });
  const { result } = await captureLogs(() => sendQuoteThankYou({ db: prisma, lead: one, enquiry: ENQUIRY, send: fake.send, now: new Date(now.getTime() + 30 * 60 * 1000) }));
  assert.equal(result, "hourly_limit");
  assert.equal(fake.sent.length, MAX_PER_HOUR);
  // An hour on, they go again.
  assert.equal(await sendQuoteThankYou({ db: prisma, lead: one, enquiry: ENQUIRY, send: fake.send, now: new Date(now.getTime() + 61 * 60 * 1000 + MAX_PER_HOUR * 1000) }), "sent");
});

test("real database: the website form still gets its 201 and the lead is saved when the email can't be sent", { skip }, async () => {
  // The route's own database client, on the throwaway database, and no Gmail
  // at all, so the email can't go anywhere.
  process.env.DATABASE_URL = url;
  for (const name of ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GMAIL_REFRESH_TOKEN", "GMAIL_SENDER_ADDRESS"]) delete process.env[name];
  const { POST } = await import("@/app/api/quote-lead/route");

  const email = `route${DOMAIN}`;
  const lines: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => lines.push(args.map(String).join(" "));
  let res: Response;
  try {
    res = await POST(
      new Request("http://localhost/api/quote-lead", {
        method: "POST",
        body: JSON.stringify({ "first-name": "Rita", "last-name": "Route", email, service: "Leaflet Distribution", "areas-required": "BH24" }),
      })
    );
    // The email is tried after the reply; wait for its outcome.
    for (let i = 0; i < 100 && !lines.some((l) => l.startsWith("Quote thank-you email not sent")); i++) await new Promise((r) => setTimeout(r, 50));
  } finally {
    console.error = original;
  }
  assert.equal(res!.status, 201);
  assert.ok(lines.includes("Quote thank-you email not sent: not_configured"), lines.join("\n"));
  const lead = await prisma.lead.findFirstOrThrow({ where: { email }, include: { activities: true } });
  assert.equal(lead.stage, "UNCONTACTED");
  assert.equal(lead.business, "FDH");
  assert.deepEqual(lead.activities.map((a) => a.detail.split("\n")[0]), ["Service type: Leaflet Distribution"], "no thank-you note, as none was sent");
});
