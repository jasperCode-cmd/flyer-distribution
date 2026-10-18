import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { isUnpaidInvoice, parseDocumentInput, ukToday, addDays, type DocumentType } from "@/lib/documents/rules";
import {
  DocumentError,
  acceptQuote,
  createInvoice,
  createQuote,
  declineQuote,
  deleteInvoice,
  deleteQuote,
  listDocuments,
  markDocumentSent,
  markInvoicePaid,
  markSentOp,
  takeNumber,
  updateInvoice,
  voidInvoice,
} from "@/lib/documents/service";
import { renderStoredDocument } from "@/lib/documents/output";
import { sendDocumentEmail } from "@/lib/documents/email";
import { sendEmailVia } from "@/lib/gmail";
import { sendViaBrevo } from "@/lib/ldb-email";
import { toProfitJob, PROFIT_LEAD_SELECT } from "@/lib/profit-data";
import { placeholderBankEnv, readPdf } from "./documents-fixtures";

// Quotes and invoices against a real database, but only a throwaway local
// one: it needs CRM_TEST_DATABASE_URL pointing at localhost and is skipped
// otherwise, so it can never touch the production database. Email goes to a
// fake Gmail and a fake Brevo. It cleans up after itself.

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

const DOMAIN = "@documents-test.example";
const LDB_ENV = { apiKey: "test-key", senderAddress: "team@leafletdistributionbournemouth.co.uk", senderName: "Leaflet Distribution Bournemouth" };
let prisma: PrismaClient;
let userId: string;

async function cleanUp() {
  const ids = (await prisma.lead.findMany({ where: { email: { endsWith: DOMAIN } }, select: { id: true } })).map((l) => l.id);
  await prisma.invoiceDeduction.deleteMany({ where: { balanceInvoice: { leadId: { in: ids } } } });
  await prisma.invoice.deleteMany({ where: { leadId: { in: ids } } });
  await prisma.quote.deleteMany({ where: { leadId: { in: ids } } });
  await prisma.lead.deleteMany({ where: { id: { in: ids } } });
}

before(async () => {
  if (skip) return;
  prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  await cleanUp();
  const user = await prisma.user.findFirst({ select: { id: true } });
  assert.ok(user, "the local database needs a user");
  userId = user.id;
});

after(async () => {
  if (skip) return;
  await cleanUp();
  await prisma.$disconnect();
});

const now = new Date();
const today = ukToday(now);

let leadCount = 0;
async function makeLead(overrides: Record<string, unknown> = {}) {
  leadCount++;
  return prisma.lead.create({
    data: { name: `Test Client ${leadCount}`, email: `client${leadCount}${DOMAIN}`, business: "FDH", ...overrides },
  });
}

function input(type: DocumentType, lines: [string, string, string?][], extra: Record<string, unknown> = {}) {
  const parsed = parseDocumentInput(
    {
      client: { name: "Sophie Turner", businessName: "Turner's Bakery", email: `sophie${DOMAIN}`, address: "Boscombe", targetAreas: "Boscombe" },
      issueDate: today,
      lines: lines.map(([label, amount, quantity]) => ({ label, amount, quantity })),
      ...extra,
    },
    type
  );
  assert.ok(parsed.ok, parsed.ok ? "" : parsed.error);
  return parsed.data;
}

async function sentQuote(leadId: string, lines: [string, string, string?][]) {
  const quote = await createQuote(prisma, leadId, input("QUOTE", lines));
  await markSentOp(prisma, "quote", quote.id, now);
  return quote;
}

test("real database: numbers come from one counter per sequence; the seeded counters give INV-1106 and QUO-1001", { skip }, async () => {
  // In a transaction that is rolled back, so the shared counters are left as they were.
  const rolledBack = new Error("roll back");
  await assert.rejects(
    prisma.$transaction(async (tx) => {
      await tx.documentCounter.update({ where: { sequence: "INVOICE" }, data: { next: 1106 } });
      await tx.documentCounter.update({ where: { sequence: "QUOTE" }, data: { next: 1001 } });
      assert.equal(await takeNumber(tx, "INVOICE"), "INV-1106");
      assert.equal(await takeNumber(tx, "INVOICE"), "INV-1107");
      assert.equal(await takeNumber(tx, "QUOTE"), "QUO-1001");
      throw rolledBack;
    }),
    (err) => err === rolledBack
  );
});

test("real database: two saved at once never share a number, and a deleted draft's number is never reused", { skip }, async () => {
  const lead = await makeLead();
  const data = input("FULL", [["Distribution", "100.00"]]);
  const made = await Promise.all(Array.from({ length: 8 }, () => createInvoice(prisma, { leadId: lead.id, type: "FULL", data })));
  const numbers = made.map((m) => Number(m.number.replace("INV-", ""))).sort((a, b) => a - b);
  assert.equal(new Set(numbers).size, 8, "all different");
  assert.deepEqual(numbers, numbers.map((_, i) => numbers[0] + i), "one after another, no gaps");

  const quotes = await Promise.all(Array.from({ length: 4 }, () => createQuote(prisma, lead.id, input("QUOTE", [["Distribution", "100.00"]]))));
  assert.equal(new Set(quotes.map((q) => q.number)).size, 4);

  const draft = await createQuote(prisma, lead.id, input("QUOTE", [["Distribution", "50.00"]]));
  await deleteQuote(prisma, draft.id);
  const next = await createQuote(prisma, lead.id, input("QUOTE", [["Distribution", "50.00"]]));
  assert.ok(Number(next.number.slice(4)) > Number(draft.number.slice(4)), "the deleted draft's number is skipped, not reused");
  // Only a draft can be deleted; a sent invoice is voided instead.
  await deleteInvoice(prisma, made[0].id);
  await markSentOp(prisma, "invoice", made[1].id, now);
  await assert.rejects(deleteInvoice(prisma, made[1].id), (err: unknown) => err instanceof DocumentError && err.status === 409);
});

test("real database: Mark accepted wins the lead (wonAt set), sets the deal value to the total and drafts a 50% deposit, rounded up, due on receipt", { skip }, async () => {
  const lead = await makeLead({ stage: "UNCONTACTED" });
  const quote = await sentQuote(lead.id, [["Printing and distribution", "450.00", "5000"], ["Design", "150.01"]]);
  const result = await acceptQuote(prisma, quote.id, { userId: null, now });

  const won = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id }, include: { job: true, activities: { orderBy: { createdAt: "asc" } } } });
  assert.equal(won.stage, "WON");
  assert.equal(won.wonAt?.toISOString(), now.toISOString());
  assert.equal(won.dealValue?.toFixed(2), "600.01");
  assert.ok(won.job, "a Job is made");
  assert.deepEqual(won.activities.map((a) => a.type), ["STAGE_CHANGE", "NOTE"]);
  assert.match(won.activities[1].detail, new RegExp(`^Quote ${quote.number} accepted\\. Deal value set to £600\\.01; deposit invoice ${result.depositNumber} drafted for £300\\.01\\.$`));

  const deposit = await prisma.invoice.findUniqueOrThrow({ where: { id: result.depositInvoiceId }, include: { lines: { orderBy: { sortOrder: "asc" } } } });
  assert.equal(deposit.status, "DRAFT");
  assert.equal(deposit.type, "DEPOSIT");
  assert.equal(deposit.dueOnReceipt, true);
  assert.equal(deposit.dueDate, null);
  assert.equal(deposit.totalPence, 60001);
  assert.equal(deposit.amountDuePence, 30001);
  assert.equal(deposit.quoteId, quote.id);
  assert.deepEqual(deposit.lines.map((l) => [l.label, l.quantity, l.amountPence]), [["Printing and distribution", 5000, 45000], ["Design", null, 15001]]);
  assert.equal((await prisma.quote.findUniqueOrThrow({ where: { id: quote.id } })).status, "ACCEPTED");

  // Only once, and only a sent quote.
  await assert.rejects(acceptQuote(prisma, quote.id, { userId: null, now }), (err: unknown) => err instanceof DocumentError && err.status === 409);
  const draft = await createQuote(prisma, lead.id, input("QUOTE", [["Distribution", "10.00"]]));
  await assert.rejects(acceptQuote(prisma, draft.id, { userId: null, now }), /Only a sent quote can be accepted/);
});

test("real database: Mark accepted leaves a Completed lead's stage and won date alone; Mark declined only marks the quote", { skip }, async () => {
  const wonAt = new Date("2026-09-01T10:00:00.000Z");
  const lead = await makeLead({ stage: "COMPLETED", wonAt });
  const quote = await sentQuote(lead.id, [["Distribution", "200.00"]]);
  await acceptQuote(prisma, quote.id, { userId: null, now });
  const after = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
  assert.equal(after.stage, "COMPLETED");
  assert.equal(after.wonAt?.toISOString(), wonAt.toISOString());
  assert.equal(after.dealValue?.toFixed(2), "200.00");

  const other = await makeLead({ stage: "AWAITING_RESPONSE" });
  const declined = await sentQuote(other.id, [["Distribution", "300.00"]]);
  await declineQuote(prisma, declined.id, { userId: null, now });
  assert.equal((await prisma.quote.findUniqueOrThrow({ where: { id: declined.id } })).status, "DECLINED");
  assert.equal((await prisma.lead.findUniqueOrThrow({ where: { id: other.id } })).stage, "AWAITING_RESPONSE");
});

test("real database: Mark paid sets amount paid and payment status; the balance deducts paid deposits only; voiding recalculates", { skip }, async () => {
  const lead = await makeLead({ stage: "UNCONTACTED" });
  const quote = await sentQuote(lead.id, [["Distribution", "600.01"]]);
  const { depositInvoiceId } = await acceptQuote(prisma, quote.id, { userId: null, now });
  const payment = async () => {
    const l = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id }, select: { ...PROFIT_LEAD_SELECT, paymentStatus: true } });
    return { status: l.paymentStatus, amountPaid: l.amountPaid?.toFixed(2) ?? null, profitPaidPence: toProfitJob(l).paidPence };
  };

  // A second deposit that is never paid must not be deducted.
  const unpaid = await createInvoice(prisma, { leadId: lead.id, type: "DEPOSIT", data: input("DEPOSIT", [["Distribution", "50.00"]]) });
  // A draft balance made before the deposit is paid deducts nothing yet...
  const early = await createInvoice(prisma, { leadId: lead.id, type: "BALANCE", data: input("BALANCE", [["Distribution", "600.01"]]) });
  assert.equal((await prisma.invoice.findUniqueOrThrow({ where: { id: early.id } })).amountDuePence, 60001);

  await assert.rejects(markInvoicePaid(prisma, depositInvoiceId, { paidOn: addDays(today, 1), userId: null, now }), /can't be in the future/);
  await markInvoicePaid(prisma, depositInvoiceId, { paidOn: addDays(today, -2), userId: null, now });
  assert.deepEqual(await payment(), { status: "DEPOSIT_PAID", amountPaid: "300.01", profitPaidPence: 30001 });
  // ...and picks it up once it is paid.
  const refreshed = await prisma.invoice.findUniqueOrThrow({ where: { id: early.id }, include: { deductions: true } });
  assert.equal(refreshed.amountDuePence, 30000);
  assert.deepEqual(refreshed.deductions.map((d) => [d.depositInvoiceId, d.amountPence]), [[depositInvoiceId, 30001]]);
  await deleteInvoice(prisma, early.id);

  const balance = await createInvoice(prisma, { leadId: lead.id, type: "BALANCE", data: input("BALANCE", [["Distribution", "600.01"]]) });
  const made = await prisma.invoice.findUniqueOrThrow({ where: { id: balance.id }, include: { deductions: true } });
  assert.deepEqual(made.deductions.map((d) => d.depositInvoiceId), [depositInvoiceId], "the paid deposit only, not the unpaid one");
  assert.equal(made.amountDuePence, 30000, "£600.01 less £300.01");
  assert.equal(made.dueDate?.toISOString().slice(0, 10), addDays(today, 7));
  // Editing the draft keeps the deduction and works the balance out again.
  await updateInvoice(prisma, balance.id, input("BALANCE", [["Distribution", "700.01"]]));
  assert.equal((await prisma.invoice.findUniqueOrThrow({ where: { id: balance.id } })).amountDuePence, 40000);

  await markSentOp(prisma, "invoice", balance.id, now);
  await markInvoicePaid(prisma, balance.id, { paidOn: today, userId: null, now });
  assert.deepEqual(await payment(), { status: "PAID_IN_FULL", amountPaid: "700.01", profitPaidPence: 70001 });

  await assert.rejects(voidInvoice(prisma, depositInvoiceId, { userId: null, now }), new RegExp(`Balance invoice ${balance.number} deducts this deposit`));
  await voidInvoice(prisma, balance.id, { userId: null, now });
  assert.deepEqual(await payment(), { status: "DEPOSIT_PAID", amountPaid: "300.01", profitPaidPence: 30001 });
  await voidInvoice(prisma, depositInvoiceId, { userId: null, now });
  assert.deepEqual(await payment(), { status: "NOT_PAID", amountPaid: null, profitPaidPence: null });
  await assert.rejects(voidInvoice(prisma, unpaid.id, { userId: null, now }), /A draft is deleted, not voided/);

  const notes = await prisma.activity.findMany({ where: { leadId: lead.id, type: "NOTE" }, orderBy: { createdAt: "asc" }, select: { detail: true } });
  assert.ok(notes.some((n) => n.detail.startsWith(`Invoice ${balance.number} marked paid: £400.00 received`)));
  assert.ok(notes.some((n) => n.detail === `Invoice ${balance.number} voided.`));
});

test("real database: Mark as sent sets Sent and sentAt, notes it on the lead, emails nobody, and the invoice shows as unpaid", { skip }, async () => {
  const lead = await makeLead({ stage: "UNCONTACTED" });
  const quote = await createQuote(prisma, lead.id, input("QUOTE", [["Distribution", "450.00"]]));
  const invoice = await createInvoice(prisma, { leadId: lead.id, type: "FULL", data: input("FULL", [["Distribution", "450.00"]]) });
  const stillDraft = await createInvoice(prisma, { leadId: lead.id, type: "FULL", data: input("FULL", [["Distribution", "100.00"]]) });

  // Any network call (Brevo goes through fetch) would be counted here.
  const realFetch = globalThis.fetch;
  let fetches = 0;
  globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
    fetches++;
    return realFetch(...args);
  }) as typeof fetch;
  try {
    await markDocumentSent(prisma, "quote", quote.id, { userId, now });
    await markDocumentSent(prisma, "invoice", invoice.id, { userId, now });
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.equal(fetches, 0, "nothing sent");

  const q = await prisma.quote.findUniqueOrThrow({ where: { id: quote.id } });
  const i = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
  assert.deepEqual([q.status, q.sentAt?.toISOString()], ["SENT", now.toISOString()]);
  assert.deepEqual([i.status, i.sentAt?.toISOString()], ["SENT", now.toISOString()]);

  const after = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id }, include: { activities: { orderBy: { createdAt: "asc" } } } });
  assert.deepEqual(
    after.activities.map((a) => [a.type, a.detail, a.userId]),
    [
      ["NOTE", `Quote ${quote.number} marked as sent`, userId],
      ["NOTE", `Invoice ${invoice.number} marked as sent`, userId],
    ],
    "a note each, and no email recorded"
  );
  assert.equal(after.stage, "UNCONTACTED", "no email, so the stage is left alone");

  // Drafts only.
  await assert.rejects(markDocumentSent(prisma, "invoice", invoice.id, { userId, now }), (err: unknown) =>
    err instanceof DocumentError && err.status === 409 && err.message === "Only a draft can be marked as sent"
  );

  // Unpaid invoices lists the marked invoice, not the draft or the quote.
  const unpaid = (await listDocuments(prisma, { leadId: lead.id })).filter(isUnpaidInvoice).map((d) => d.number);
  assert.deepEqual(unpaid, [invoice.number]);
  assert.ok(!unpaid.includes(stillDraft.number) && !unpaid.includes(quote.number));
});

test("real database: a lead with quotes or invoices can't be deleted", { skip }, async () => {
  const lead = await makeLead();
  await createQuote(prisma, lead.id, input("QUOTE", [["Distribution", "10.00"]]));
  await assert.rejects(prisma.lead.delete({ where: { id: lead.id } }));
});

// Every console line written while the callback runs.
async function captureLogs(fn: () => Promise<void>): Promise<string> {
  const lines: string[] = [];
  const methods = ["log", "info", "warn", "error", "debug"] as const;
  const originals = methods.map((m) => console[m]);
  methods.forEach((m) => {
    console[m] = (...args: unknown[]) => lines.push(args.map((a) => (a instanceof Error ? `${a.message} ${a.stack}` : typeof a === "string" ? a : JSON.stringify(a))).join(" "));
  });
  try {
    await fn();
  } finally {
    methods.forEach((m, i) => (console[m] = originals[i]));
  }
  return lines.join("\n");
}

test("real database: Email to client attaches the PDF through fake Gmail (FDH) and fake Brevo (LDB), records it on the lead and marks it sent", { skip }, async () => {
  const bank = placeholderBankEnv();
  const gmailSent: string[] = [];
  const brevoSent: Record<string, unknown>[] = [];
  const senders = {
    gmail: (p: Parameters<typeof sendEmailVia>[2]) =>
      sendEmailVia(
        {
          async send(body) {
            gmailSent.push(Buffer.from(body.raw, "base64url").toString("utf8"));
            return { id: "g1", threadId: "t1" };
          },
          async listSendAs() {
            return [];
          },
        },
        "flyerdistributionhampshire@gmail.com",
        p
      ),
    ldb: (p: Parameters<typeof sendViaBrevo>[0]) =>
      sendViaBrevo(p, {
        env: LDB_ENV,
        fetchFn: (async (_u: string, init: RequestInit) => {
          brevoSent.push(JSON.parse(String(init.body)));
          return new Response(JSON.stringify({ messageId: "<b1@brevo>" }), { status: 201 });
        }) as unknown as typeof fetch,
      }),
  };

  const fdhLead = await makeLead({ stage: "UNCONTACTED" });
  const quote = await createQuote(prisma, fdhLead.id, input("QUOTE", [["Distribution", "450.00"]]));
  const ldbLead = await makeLead({ business: "LDB", stage: "WON" });
  const invoice = await createInvoice(prisma, { leadId: ldbLead.id, type: "FULL", data: input("FULL", [["Distribution", "1000.01"]]) });

  const logs = await captureLogs(async () => {
    const fdh = await sendDocumentEmail({ db: prisma, kind: "quote", id: quote.id, subject: "Your quote", body: "Hi Sophie", userId, now, senders, env: bank });
    assert.ok(fdh.ok, fdh.ok ? "" : fdh.error);
    const ldb = await sendDocumentEmail({ db: prisma, kind: "invoice", id: invoice.id, subject: "Your invoice", body: "Hi", userId, now, senders, env: bank });
    assert.ok(ldb.ok, ldb.ok ? "" : ldb.error);
  });

  // FDH: through Gmail, with the PDF attached.
  assert.equal(gmailSent.length, 1);
  assert.match(gmailSent[0], /Content-Type: multipart\/mixed/);
  assert.match(gmailSent[0], new RegExp(`filename="Flyer-Distribution-Hampshire-${quote.number}\\.pdf"`));
  const encoded = gmailSent[0].split("Content-Transfer-Encoding: base64\r\n\r\n")[1].split("\r\n--")[0];
  const attached = await readPdf(new Uint8Array(Buffer.from(encoded.replace(/\r\n/g, ""), "base64")));
  assert.ok(attached.text.includes(quote.number) && attached.text.includes("Flyer Distribution Hampshire"));
  const sentQuote = await prisma.quote.findUniqueOrThrow({ where: { id: quote.id } });
  assert.equal(sentQuote.status, "SENT");
  assert.equal(sentQuote.sentAt?.toISOString(), now.toISOString());
  const fdhAfter = await prisma.lead.findUniqueOrThrow({ where: { id: fdhLead.id }, include: { activities: true } });
  assert.equal(fdhAfter.stage, "AWAITING_RESPONSE");
  assert.ok(fdhAfter.activities.some((a) => a.type === "EMAIL" && a.detail.endsWith(`Attached: Flyer-Distribution-Hampshire-${quote.number}.pdf`)));

  // LDB: through Brevo only, with the PDF attached and the LDB BCC.
  assert.equal(brevoSent.length, 1);
  assert.deepEqual(brevoSent[0].bcc, [{ email: LDB_ENV.senderAddress }]);
  const files = brevoSent[0].attachment as { name: string; content: string }[];
  assert.equal(files[0].name, `Leaflet-Distribution-Bournemouth-${invoice.number}.pdf`);
  const ldbPdf = await readPdf(new Uint8Array(Buffer.from(files[0].content, "base64")));
  assert.ok(ldbPdf.text.includes("Leaflet Distribution Bournemouth") && ldbPdf.text.includes(`Please use ${invoice.number} as your payment reference.`));
  assert.ok(ldbPdf.text.includes(bank.PAYMENT_ACCOUNT_NUMBER), "the invoice carries the bank details");
  assert.doesNotMatch(ldbPdf.text, /Flyer|Hampshire/);
  assert.equal((await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).status, "SENT");

  // The bank details never reach a log.
  for (const value of Object.values(bank)) assert.ok(!logs.includes(value), "no bank detail in the logs");
});

test("real database: without the bank details an invoice can't be downloaded or emailed, and nothing is sent", { skip }, async () => {
  const lead = await makeLead();
  const invoice = await createInvoice(prisma, { leadId: lead.id, type: "FULL", data: input("FULL", [["Distribution", "100.00"]]) });
  let sends = 0;
  const senders = {
    gmail: async () => {
      sends++;
      return { ok: true as const, data: { messageId: "x", threadId: "y" } };
    },
    ldb: async () => {
      sends++;
      return { ok: true as const, data: { messageId: "x", threadId: "y" } };
    },
  };
  const env = { ...placeholderBankEnv(), PAYMENT_SORT_CODE: "" };
  const download = await renderStoredDocument(prisma, "invoice", invoice.id, env);
  assert.equal(download.ok, false);
  assert.ok(!download.ok && download.status === 503 && /PAYMENT_SORT_CODE is not set/.test(download.error));
  const email = await sendDocumentEmail({ db: prisma, kind: "invoice", id: invoice.id, subject: "Invoice", body: "Hi", userId, now, senders, env });
  assert.ok(!email.ok && email.status === 503 && /bank details/.test(email.error));
  assert.equal(sends, 0);
  assert.equal((await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).status, "DRAFT");
  // A quote never needs them.
  const quote = await createQuote(prisma, lead.id, input("QUOTE", [["Distribution", "100.00"]]));
  assert.equal((await renderStoredDocument(prisma, "quote", quote.id, {})).ok, true);
});
