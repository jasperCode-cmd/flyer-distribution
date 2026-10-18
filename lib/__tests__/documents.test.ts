import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import {
  amountDuePence,
  balancePence,
  deductibleDeposits,
  depositPence,
  fillTemplate,
  formatDocumentNumber,
  leadPaymentFromInvoices,
  linesTotalPence,
  parseDocumentInput,
  parseLeafletQuantity,
  prefillFromLead,
  type DepositForBalance,
} from "@/lib/documents/rules";
import { FDH_DOCUMENTS } from "@/lib/documents/business/fdh";
import { LDB_DOCUMENTS } from "@/lib/documents/business/ldb";
import { documentFileName } from "@/lib/documents/branding";
import { PAYMENT_ENV_NAMES, readPaymentDetails } from "@/lib/documents/bank";
import { renderDocumentPdf, PdfError } from "@/lib/documents/pdf";
import { isSystemNote } from "@/lib/activity-origin";
import { buildRawMessage, sendEmailVia } from "@/lib/gmail";
import { buildBrevoEmail, sendViaBrevo } from "@/lib/ldb-email";
import { model, placeholderBankEnv, placeholderPayment, readPdf } from "./documents-fixtures";

// Quotes and invoices without a database: numbers, money, which deposits a
// balance deducts, the lead's payment, prefilling, the PDFs (read back as a
// client would see them), bank details and email attachments.

// --- Numbers ---------------------------------------------------------------------------

test("numbers: INV- and QUO- prefixes, and the migration seeds the next invoice as INV-1106 and the next quote as QUO-1001", () => {
  assert.equal(formatDocumentNumber("INVOICE", 1106), "INV-1106");
  assert.equal(formatDocumentNumber("QUOTE", 1001), "QUO-1001");
  const dir = readdirSync("prisma/migrations").find((d) => d.endsWith("_add_quotes_and_invoices"))!;
  const sql = readFileSync(`prisma/migrations/${dir}/migration.sql`, "utf8");
  assert.match(sql, /INSERT INTO "DocumentCounter" \("sequence", "next"\) VALUES \('INVOICE', 1106\), \('QUOTE', 1001\);/);
});

// --- Money ------------------------------------------------------------------------------

test("totals are whole pence, added exactly, from amounts typed in pounds", () => {
  const parsed = parseDocumentInput(
    {
      client: { name: "Sophie Turner" },
      issueDate: "2026-10-18",
      lines: [
        { label: "Printing and distribution", quantity: "5,000", amount: "1,250.10" },
        { label: "Design", amount: "0.20" },
        { label: "Extra", amount: "£0.10" },
      ],
    },
    "QUOTE"
  );
  assert.ok(parsed.ok);
  if (!parsed.ok) return;
  assert.deepEqual(parsed.data.lines.map((l) => [l.amountPence, l.quantity]), [[125010, 5000], [20, null], [10, null]]);
  assert.equal(parsed.data.totalPence, 125040);
  assert.equal(linesTotalPence(parsed.data.lines), 125040);
});

test("deposit: half the total rounded up to the penny, so deposit and balance always add up to the total", () => {
  assert.equal(depositPence(60000), 30000);
  assert.equal(depositPence(100001), 50001);
  assert.equal(balancePence(100001, [50001]), 50000);
  assert.equal(depositPence(1), 1);
  for (const total of [1, 2, 3, 99, 12345, 100001, 9999999]) {
    const deposit = depositPence(total);
    assert.equal(deposit + balancePence(total, [deposit]), total, `total ${total}`);
    assert.ok(deposit >= total / 2 && deposit - total / 2 < 1);
  }
  assert.equal(amountDuePence("DEPOSIT", 100001), 50001);
  assert.equal(amountDuePence("FULL", 100001), 100001);
  assert.equal(amountDuePence("BALANCE", 100001, [50001]), 50000);
});

test("a balance invoice deducts paid deposits only, and not one another balance invoice already deducts", () => {
  const deposit = (id: string, status: DepositForBalance["status"], deductedBy: DepositForBalance["deductedBy"] = []): DepositForBalance => ({
    id,
    type: "DEPOSIT",
    status,
    amountDuePence: 30000,
    deductedBy,
  });
  const invoices: DepositForBalance[] = [
    deposit("paid", "PAID"),
    deposit("draft", "DRAFT"),
    deposit("sent", "SENT"),
    deposit("void", "VOID"),
    deposit("taken", "PAID", [{ balanceInvoiceId: "other", status: "SENT" }]),
    // Given back when the balance invoice that deducted it was voided.
    deposit("released", "PAID", [{ balanceInvoiceId: "old", status: "VOID" }]),
    // Already this balance invoice's own (a draft being saved again).
    deposit("mine", "PAID", [{ balanceInvoiceId: "this", status: "DRAFT" }]),
    { id: "full", type: "FULL", status: "PAID", amountDuePence: 1000, deductedBy: [] },
  ];
  assert.deepEqual(deductibleDeposits(invoices, "this").map((d) => d.id), ["paid", "released", "mine"]);
  assert.deepEqual(deductibleDeposits(invoices, null).map((d) => d.id), ["paid", "released"]);
});

test("the lead's payment: the sum of paid invoices; Deposit Paid or Paid in Full; Not Paid once nothing paid is left", () => {
  const inv = (type: "DEPOSIT" | "BALANCE" | "FULL", status: "DRAFT" | "SENT" | "PAID" | "VOID", amountDuePence: number) => ({ type, status, amountDuePence });
  assert.deepEqual(leadPaymentFromInvoices([inv("DEPOSIT", "SENT", 30000)], 60000), { amountPaidPence: null, paymentStatus: "NOT_PAID" });
  assert.deepEqual(leadPaymentFromInvoices([inv("DEPOSIT", "PAID", 30000)], 60000), { amountPaidPence: 30000, paymentStatus: "DEPOSIT_PAID" });
  assert.deepEqual(
    leadPaymentFromInvoices([inv("DEPOSIT", "PAID", 30000), inv("BALANCE", "PAID", 30000)], 60000),
    { amountPaidPence: 60000, paymentStatus: "PAID_IN_FULL" }
  );
  assert.deepEqual(leadPaymentFromInvoices([inv("FULL", "PAID", 60000)], null), { amountPaidPence: 60000, paymentStatus: "PAID_IN_FULL" });
  // Two deposits reaching the deal value count as paid in full.
  assert.deepEqual(
    leadPaymentFromInvoices([inv("DEPOSIT", "PAID", 30000), inv("DEPOSIT", "PAID", 30000)], 60000),
    { amountPaidPence: 60000, paymentStatus: "PAID_IN_FULL" }
  );
  // A voided paid balance no longer counts.
  assert.deepEqual(
    leadPaymentFromInvoices([inv("DEPOSIT", "PAID", 30000), inv("BALANCE", "VOID", 30000)], 60000),
    { amountPaidPence: 30000, paymentStatus: "DEPOSIT_PAID" }
  );
  assert.deepEqual(leadPaymentFromInvoices([inv("DEPOSIT", "VOID", 30000)], 60000), { amountPaidPence: null, paymentStatus: "NOT_PAID" });
});

// --- Prefill and checks -------------------------------------------------------------------

test("prefill: Printing and distribution or Distribution with the leaflet quantity, and a £150.00 design line when design is included", () => {
  const lead = {
    name: "Sophie Turner",
    businessName: "Turner's Bakery",
    email: "sophie@example.com",
    addressArea: "Boscombe",
    postcode: "BH5 1AA",
    targetAreas: "Boscombe, Southbourne",
    leafletQuantity: "5,000",
    printingIncluded: true,
    designIncluded: true,
    dealValue: "600.00",
  };
  const withDesign = prefillFromLead(lead);
  assert.deepEqual(withDesign.lines, [
    { label: "Printing and distribution", quantity: "5000", amount: "450.00" },
    { label: "Design", quantity: "", amount: "150.00" },
  ]);
  assert.deepEqual(withDesign.client, {
    name: "Sophie Turner",
    businessName: "Turner's Bakery",
    email: "sophie@example.com",
    address: "Boscombe, BH5 1AA",
    targetAreas: "Boscombe, Southbourne",
  });
  const plain = prefillFromLead({ ...lead, printingIncluded: false, designIncluded: false, dealValue: null, leafletQuantity: null });
  assert.deepEqual(plain.lines, [{ label: "Distribution", quantity: "", amount: "" }]);
  assert.equal(parseLeafletQuantity("2.5k"), 2500);
  assert.equal(parseLeafletQuantity("2000 households"), 2000);
  assert.equal(parseLeafletQuantity("lots"), null);
});

test("the builder's input is checked, and an em dash typed anywhere becomes a hyphen", () => {
  const base = { client: { name: "Sophie" }, issueDate: "2026-10-18", lines: [{ label: "Distribution", amount: "100" }] };
  assert.deepEqual(parseDocumentInput({ ...base, client: {} }, "QUOTE"), { ok: false, error: "Client name is required" });
  assert.deepEqual(parseDocumentInput({ ...base, lines: [] }, "QUOTE"), { ok: false, error: "Add at least one line" });
  assert.deepEqual(parseDocumentInput({ ...base, lines: [{ label: "x", amount: "12.345" }] }, "QUOTE"), {
    ok: false,
    error: "Line 1's amount must be in pounds, like 450.00",
  });
  assert.deepEqual(parseDocumentInput({ ...base, lines: [{ label: "x", amount: "0" }] }, "QUOTE"), {
    ok: false,
    error: "The total must be more than £0.00",
  });
  assert.deepEqual(parseDocumentInput({ ...base, issueDate: "2026-02-30" }, "QUOTE"), { ok: false, error: "Choose an issue date" });
  assert.deepEqual(parseDocumentInput({ ...base, dueDate: "2026-10-01" }, "FULL"), {
    ok: false,
    error: "The due date can't be before the issue date",
  });
  const tidy = parseDocumentInput({ ...base, notes: "Week one \u2014 Boscombe", lines: [{ label: "Distribution \u2014 area A", amount: "100" }] }, "QUOTE");
  assert.ok(tidy.ok && tidy.data.notes === "Week one - Boscombe" && tidy.data.lines[0].label === "Distribution - area A");
});

// --- Business settings ----------------------------------------------------------------------

test("each business file: terms in step with its day counts, Not VAT registered, and no em dashes", () => {
  for (const brand of [FDH_DOCUMENTS, LDB_DOCUMENTS]) {
    assert.equal(brand.vatNote, "Not VAT registered");
    assert.ok(brand.terms.quote.some((t) => t.includes(`valid for ${brand.quoteValidDays} days`)));
    assert.ok(brand.terms.quote.includes("To go ahead, just reply to this email."));
    assert.ok(brand.terms.quote.includes("50% deposit to book, balance on completion."));
    const nonRefundable = "The deposit is non-refundable once printing has been ordered or distribution has been scheduled.";
    assert.ok(brand.terms.quote.includes(nonRefundable) && brand.terms.invoice.includes(nonRefundable));
    assert.equal(brand.balance.due, `Payable within ${brand.balanceDueDays} days`);
    assert.equal(brand.legalLine, "", "the legal line stays empty until confirmed");
    assert.doesNotMatch(JSON.stringify(brand), /\u2014/);
  }
});

const FDH_MARKS = [/flyer/i, /hampshire/i, /\bFDH\b/, /forest reach/i, /st leonards/i, /ringwood/i, /BH24/i, /atkinson/i, /schibsted/i, /fdh-logo/i];

test("the Bournemouth settings name nothing of Flyer Distribution Hampshire", () => {
  const text = JSON.stringify(LDB_DOCUMENTS);
  for (const mark of FDH_MARKS) assert.doesNotMatch(text, mark);
  assert.equal(documentFileName("LDB", "INV-1106"), "Leaflet-Distribution-Bournemouth-INV-1106.pdf");
  assert.equal(documentFileName("FDH", "QUO-1001"), "Flyer-Distribution-Hampshire-QUO-1001.pdf");
});

// --- PDFs ----------------------------------------------------------------------------------

test("an LDB deposit invoice: LDB's details, the deposit wording and the payment reference, and nothing of FDH in its text, metadata, fonts, images or file name", async () => {
  const payment = placeholderPayment();
  const bytes = await renderDocumentPdf(
    model({ type: "DEPOSIT", business: "LDB", number: "INV-1108", status: "DRAFT", validUntil: null, dueOnReceipt: true, totalPence: 100001, amountDuePence: 50001, lines: [{ label: "Distribution", quantity: 2000, amountPence: 100001 }] }),
    { payment }
  );
  const pdf = await readPdf(bytes);
  for (const expected of [
    "Leaflet Distribution Bournemouth",
    "Office 21",
    "18 Christchurch Road",
    "BH1 3NE",
    "team@leafletdistributionbournemouth.co.uk",
    "www.leafletdistributionbournemouth.co.uk",
    "Deposit invoice",
    "Campaign total £1,000.01",
    "50% deposit to book your campaign £500.01",
    "Amount due £500.01",
    "Due on receipt",
    "Your campaign is booked and scheduled once this deposit is received.",
    "Please use INV-1108 as your payment reference.",
    "Not VAT registered",
    payment.accountName,
    payment.sortCode,
    payment.accountNumber,
  ]) {
    assert.ok(pdf.text.includes(expected), `shows "${expected}"`);
  }
  for (const mark of FDH_MARKS) {
    assert.doesNotMatch(pdf.text, mark, `text: ${mark}`);
    assert.doesNotMatch(JSON.stringify(pdf.info), mark, `metadata: ${mark}`);
    assert.doesNotMatch(pdf.fonts.join(" "), mark, `fonts: ${mark}`);
  }
  for (const mark of [/flyer/i, /hampshire/i, /atkinson/i, /schibsted/i, /pdf-lib/i]) assert.doesNotMatch(pdf.raw, mark, `file: ${mark}`);
  assert.equal(pdf.images, 0, "no logo, so no image at all");
  assert.ok(pdf.fonts.length > 0 && pdf.fonts.every((f) => /Geist/.test(f)));
  assert.equal(pdf.info.Title, "Deposit invoice INV-1108");
  assert.equal(pdf.info.Author, "Leaflet Distribution Bournemouth");
  assert.equal(pdf.info.Producer, "Leaflet Distribution Bournemouth");
  assert.equal(pdf.info.Creator, "Leaflet Distribution Bournemouth");
});

test("an FDH quote: the logo, FDH's details, the quote terms and no bank details; an FDH balance invoice lists each deposit deducted", async () => {
  const quote = await readPdf(await renderDocumentPdf(model({ notes: "Week of 9 November \u2014 Boscombe first." }), { payment: placeholderPayment() }));
  for (const expected of [
    "Quote",
    "QUO-1001",
    "11 Forest Reach",
    "BH24 2NR",
    "flyerdistributionhampshire@gmail.com",
    "www.flyerdistributionhampshire.co.uk",
    "Valid until 17 November 2026",
    "Total £600.00",
    "This quote is valid for 30 days from the date of issue.",
    "To go ahead, just reply to this email.",
    "50% deposit to book, balance on completion.",
    "The deposit is non-refundable once printing has been ordered or distribution has been scheduled.",
    "Not VAT registered",
    "Week of 9 November - Boscombe first.",
  ]) {
    assert.ok(quote.text.includes(expected), `quote shows "${expected}"`);
  }
  assert.doesNotMatch(quote.text, /Sort code|Account number|payment reference/);
  assert.ok(quote.images >= 1, "the FDH logo");
  assert.doesNotMatch(quote.text, /\u2014/);

  const balance = await readPdf(
    await renderDocumentPdf(
      model({
        type: "BALANCE",
        number: "INV-1107",
        validUntil: null,
        dueDate: "2026-11-23",
        issueDate: "2026-11-16",
        amountDuePence: 30000,
        deductions: [{ number: "INV-1106", paidOn: "2026-10-20", amountPence: 30000 }],
      }),
      { payment: placeholderPayment() }
    )
  );
  for (const expected of [
    "Campaign total £600.00",
    "Less deposit received, INV-1106 (paid 20 October 2026) -£300.00",
    "Balance due £300.00",
    "Payable within 7 days (by 23 November 2026)",
    "Please use INV-1107 as your payment reference.",
  ]) {
    assert.ok(balance.text.includes(expected), `balance shows "${expected}"`);
  }
});

test("an invoice can't be made into a PDF without the bank details", async () => {
  await assert.rejects(renderDocumentPdf(model({ type: "FULL", number: "INV-1200" }), { payment: null }), PdfError);
});

// --- Bank details -----------------------------------------------------------------------------

test("bank details: each missing or malformed setting is named, and no value ever appears in the message", () => {
  const missing = readPaymentDetails({});
  assert.equal(missing.ok, false);
  assert.ok(!missing.ok && PAYMENT_ENV_NAMES.every((name) => missing.message.includes(name)));
  const env = placeholderBankEnv();
  const bad = readPaymentDetails({ ...env, PAYMENT_SORT_CODE: env.PAYMENT_SORT_CODE.slice(0, 5), PAYMENT_ACCOUNT_NUMBER: `${env.PAYMENT_ACCOUNT_NUMBER}9` });
  assert.ok(!bad.ok);
  if (bad.ok) return;
  assert.match(bad.message, /PAYMENT_SORT_CODE is not 6 digits, PAYMENT_ACCOUNT_NUMBER is not 8 digits/);
  assert.ok(!bad.message.includes(env.PAYMENT_SORT_CODE.slice(0, 5)) && !bad.message.includes(env.PAYMENT_ACCOUNT_NUMBER));
  const good = readPaymentDetails(env);
  assert.ok(good.ok && /^\d{2}-\d{2}-\d{2}$/.test(good.details.sortCode));
});

test("bank details are nowhere in the repository: only the setting names, empty, in .env.local.example", () => {
  const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { encoding: "utf8" })
    .split("\n")
    .filter((f) => f && !/\.(ttf|png|webp|jpe?g|ico|pdf|woff2?|gif|svg)$/i.test(f) && !f.startsWith("node_modules/"));
  for (const file of files) {
    let text: string;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const name of PAYMENT_ENV_NAMES) {
      const assigned = new RegExp(`${name}\\s*=\\s*["']?([^"'\\s#]+)`).exec(text);
      assert.equal(assigned, null, `${file} sets ${name}`);
    }
    // Nothing shaped like a sort code: three pairs of digits joined by hyphens.
    assert.doesNotMatch(text, /(^|[^\d-])\d{2}-\d{2}-\d{2}([^\d-]|$)/, `${file} has something like a sort code`);
  }
  const example = readFileSync(".env.local.example", "utf8");
  for (const name of PAYMENT_ENV_NAMES) assert.match(example, new RegExp(`^${name}=""$`, "m"));
});

// --- Notes -------------------------------------------------------------------------------------

test("the notes the CRM writes about documents start with Quote QUO- or Invoice INV-, so they never count as contact", () => {
  const source = readFileSync("lib/documents/service.ts", "utf8");
  const calls = [...source.matchAll(/noteData\(\s*[\w.]+,\s*`([^`]*)`/g)].map((m) => m[1]);
  assert.equal(calls.length, 4, "accepted, declined, paid, voided");
  for (const detail of calls) assert.match(detail, /^(Quote \$\{quote\.number\}|Invoice \$\{invoice\.number\}) /);
  for (const sample of ["Quote QUO-1001 accepted. Deal value set to £600.00", "Quote QUO-1001 marked declined.", "Invoice INV-1106 marked paid: £300.00", "Invoice INV-1106 voided."]) {
    assert.equal(isSystemNote(sample), true, sample);
  }
});

// --- Email attachments ---------------------------------------------------------------------------

const PDF_BYTES = new Uint8Array(Buffer.from("%PDF-1.7 made-up test content \u00ff\u0000\u0001", "latin1"));

test("Gmail: an attachment wraps the usual message in multipart/mixed with the PDF after it; without one the message is unchanged", async () => {
  let sent = "";
  const api = {
    async send(body: { raw: string }) {
      sent = Buffer.from(body.raw, "base64url").toString("utf8");
      return { id: "m1", threadId: "t1" };
    },
    async listSendAs() {
      return [];
    },
  };
  const result = await sendEmailVia(api, "us@example.com", {
    to: "sophie@example.com",
    subject: "Your quote QUO-1001",
    body: "Hi Sophie",
    attachments: [{ filename: "Flyer-Distribution-Hampshire-QUO-1001.pdf", mimeType: "application/pdf", content: PDF_BYTES }],
  });
  assert.equal(result.ok, true);
  const mixed = /Content-Type: multipart\/mixed; boundary="([^"]+)"/.exec(sent)?.[1];
  assert.ok(mixed, "multipart/mixed at the top");
  assert.match(sent, /Content-Type: multipart\/alternative; boundary="[^"]+"/);
  assert.match(sent, /Content-Type: text\/plain; charset="UTF-8"/);
  assert.match(sent, /Content-Type: application\/pdf; name="Flyer-Distribution-Hampshire-QUO-1001\.pdf"\r\nContent-Disposition: attachment; filename="Flyer-Distribution-Hampshire-QUO-1001\.pdf"\r\nContent-Transfer-Encoding: base64\r\n\r\n/);
  const encoded = sent.split('filename="Flyer-Distribution-Hampshire-QUO-1001.pdf"\r\nContent-Transfer-Encoding: base64\r\n\r\n')[1].split(`\r\n--${mixed}--`)[0];
  assert.deepEqual(new Uint8Array(Buffer.from(encoded.replace(/\r\n/g, ""), "base64")), PDF_BYTES);
  assert.ok(sent.trimEnd().endsWith(`--${mixed}--`));

  const plain = Buffer.from(buildRawMessage({ from: "a@example.com", to: "b@example.com", subject: "s", body: "b", boundary: "B" }), "base64url").toString("utf8");
  const withEmptyList = Buffer.from(buildRawMessage({ from: "a@example.com", to: "b@example.com", subject: "s", body: "b", boundary: "B", attachments: [] }), "base64url").toString("utf8");
  assert.equal(withEmptyList, plain);
  assert.match(plain, /^From: a@example\.com\r\nTo: b@example\.com\r\nSubject: s\r\nMIME-Version: 1\.0\r\nContent-Type: multipart\/alternative; boundary="B"\r\n\r\n--B\r\n/);
  assert.doesNotMatch(plain, /multipart\/mixed|Content-Disposition/);
});

test("Brevo: an attachment goes as base64 with its file name; without one the request has no attachment field", async () => {
  const env = { apiKey: "test-key", senderAddress: "team@leafletdistributionbournemouth.co.uk", senderName: "Leaflet Distribution Bournemouth" };
  let request: Record<string, unknown> = {};
  const fetchFn = (async (_url: string, init: RequestInit) => {
    request = JSON.parse(String(init.body));
    return new Response(JSON.stringify({ messageId: "<b1@brevo>" }), { status: 201 });
  }) as unknown as typeof fetch;
  const result = await sendViaBrevo(
    {
      to: "james@example.com",
      subject: "Deposit invoice INV-1108",
      body: "Hi James",
      attachments: [{ filename: "Leaflet-Distribution-Bournemouth-INV-1108.pdf", mimeType: "application/pdf", content: PDF_BYTES }],
    },
    { env, fetchFn }
  );
  assert.equal(result.ok, true);
  const attachment = request.attachment as { name: string; content: string }[];
  assert.equal(attachment.length, 1);
  assert.equal(attachment[0].name, "Leaflet-Distribution-Bournemouth-INV-1108.pdf");
  assert.deepEqual(new Uint8Array(Buffer.from(attachment[0].content, "base64")), PDF_BYTES);
  assert.deepEqual(request.bcc, [{ email: env.senderAddress }]);
  assert.equal("attachment" in buildBrevoEmail(env, { to: "a@b.co", subject: "s", body: "b" }), false);
  assert.equal("attachment" in buildBrevoEmail(env, { to: "a@b.co", subject: "s", body: "b", attachments: [] }), false);
});

test("the email wording for each document fills in, with no em dashes", () => {
  for (const brand of [FDH_DOCUMENTS, LDB_DOCUMENTS]) {
    for (const template of Object.values(brand.emails)) {
      const filled = fillTemplate(template.subject + template.body, {
        number: "INV-1106",
        firstName: "Sophie",
        amount: "£300.00",
        validUntil: "17 November 2026",
        dueText: "due on receipt",
      });
      assert.doesNotMatch(filled, /\{\w+\}|\u2014/);
      assert.match(filled, new RegExp(brand.name));
    }
  }
});
