import "server-only";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { decimalToPence, formatPence } from "@/lib/money";
import { isWonStage, stageChangeOps } from "@/lib/lead-stage";
import { shouldMoveToAwaitingResponse } from "@/lib/crm-data";
import { moveToAwaitingResponseOps } from "@/lib/send-lead-email";
import { brandingFor } from "./branding";
import {
  addDays,
  amountDuePence,
  balancePence,
  dayToDb,
  dbDay,
  deductibleDeposits,
  depositPence,
  draftsFromDocument,
  formatDocumentNumber,
  formatLongDate,
  isValidDay,
  leadPaymentFromInvoices,
  prefillFromLead,
  ukToday,
  type DocumentData,
  type DocumentSequence,
  type InvoiceStatus,
  type InvoiceType,
} from "./rules";

// Quotes and invoices in the database. Every change that decides a number,
// a deposit deduction or the lead's payment runs in one transaction. Taking
// a number increments its counter row in the same transaction as the save,
// so two people can never get the same number and a failed save uses none;
// nothing ever gives a number back. Changes to a lead's invoices first lock
// the lead's row, so two at once can't both deduct the same deposit or
// race on its amount paid.

type Db = PrismaClient;
type Tx = Prisma.TransactionClient;

export class DocumentError extends Error {
  constructor(message: string, readonly status: number = 400) {
    super(message);
  }
}

const notFound = (what: string) => new DocumentError(`${what} not found`, 404);

const LINES = { orderBy: { sortOrder: "asc" as const } };

// 12345 -> "123.45", for the lead's Decimal pounds columns, without floating point.
export function penceToDecimalText(pence: number): string {
  return `${Math.trunc(pence / 100)}.${String(Math.abs(pence) % 100).padStart(2, "0")}`;
}

export async function takeNumber(tx: Tx, sequence: DocumentSequence): Promise<string> {
  const row = await tx.documentCounter.update({
    where: { sequence },
    data: { next: { increment: 1 } },
    select: { next: true },
  });
  return formatDocumentNumber(sequence, row.next - 1);
}

async function lockLead(tx: Tx, leadId: string): Promise<void> {
  await tx.$queryRaw`SELECT "id" FROM "Lead" WHERE "id" = ${leadId} FOR UPDATE`;
}

// Notes the CRM writes about its documents. They start "Quote QUO-" or
// "Invoice INV-", which marks them as the CRM's own (see activity-origin.ts),
// so they never count as contact with the lead.
function noteData(leadId: string, detail: string, userId: string | null) {
  return { leadId, type: "NOTE" as const, detail, userId };
}

function lineCreates(data: DocumentData) {
  return data.lines.map((l) => ({ label: l.label, quantity: l.quantity, amountPence: l.amountPence, sortOrder: l.sortOrder }));
}

function clientFields(data: DocumentData) {
  return {
    clientName: data.clientName,
    clientBusinessName: data.clientBusinessName,
    clientEmail: data.clientEmail,
    clientAddress: data.clientAddress,
    targetAreas: data.targetAreas,
  };
}

async function leadForNew(tx: Tx, leadId: string) {
  const lead = await tx.lead.findUnique({ where: { id: leadId }, select: { id: true, business: true, scrapped: true } });
  if (!lead) throw notFound("Lead");
  if (lead.scrapped) throw new DocumentError("This lead is scrapped");
  return lead;
}

// --- Quotes ------------------------------------------------------------------------

export async function createQuote(db: Db, leadId: string, data: DocumentData) {
  return db.$transaction(async (tx) => {
    const lead = await leadForNew(tx, leadId);
    const branding = brandingFor(lead.business);
    const number = await takeNumber(tx, "QUOTE");
    return tx.quote.create({
      data: {
        number,
        leadId,
        business: lead.business,
        issueDate: dayToDb(data.issueDate),
        validUntil: dayToDb(addDays(data.issueDate, branding.quoteValidDays)),
        ...clientFields(data),
        totalPence: data.totalPence,
        notes: data.notes,
        lines: { create: lineCreates(data) },
      },
      select: { id: true, number: true },
    });
  });
}

export async function updateQuote(db: Db, id: string, data: DocumentData) {
  return db.$transaction(async (tx) => {
    const existing = await tx.quote.findUnique({ where: { id }, select: { business: true } });
    if (!existing) throw notFound("Quote");
    const branding = brandingFor(existing.business);
    const changed = await tx.quote.updateMany({
      where: { id, status: "DRAFT" },
      data: {
        issueDate: dayToDb(data.issueDate),
        validUntil: dayToDb(addDays(data.issueDate, branding.quoteValidDays)),
        ...clientFields(data),
        totalPence: data.totalPence,
        notes: data.notes,
      },
    });
    if (changed.count === 0) throw new DocumentError("Only a draft can be edited", 409);
    await tx.quoteLine.deleteMany({ where: { quoteId: id } });
    await tx.quoteLine.createMany({ data: lineCreates(data).map((l) => ({ ...l, quoteId: id })) });
    return { id };
  });
}

export async function deleteQuote(db: Db, id: string) {
  const deleted = await db.quote.deleteMany({ where: { id, status: "DRAFT" } });
  if (deleted.count === 0) {
    const exists = await db.quote.findUnique({ where: { id }, select: { id: true } });
    throw exists ? new DocumentError("Only a draft can be deleted. Mark it declined instead.", 409) : notFound("Quote");
  }
}

// Accepting a sent quote: the lead is won (through the shared stage change,
// so wonAt is set) unless it is already Won or Completed, its deal value
// becomes the quote's total, it gets a Job if it has none, and a draft
// deposit invoice for half the total, due on receipt, is made for review.
export async function acceptQuote(db: Db, id: string, opts: { userId: string | null; now: Date }) {
  return db.$transaction(async (tx) => {
    const changed = await tx.quote.updateMany({
      where: { id, status: "SENT" },
      data: { status: "ACCEPTED", acceptedAt: opts.now },
    });
    if (changed.count === 0) {
      const exists = await tx.quote.findUnique({ where: { id }, select: { id: true } });
      throw exists ? new DocumentError("Only a sent quote can be accepted", 409) : notFound("Quote");
    }
    const quote = await tx.quote.findUniqueOrThrow({
      where: { id },
      include: { lines: LINES, lead: { select: { id: true, stage: true, wonAt: true } } },
    });
    const lead = quote.lead;
    await lockLead(tx, lead.id);

    const dealValue = penceToDecimalText(quote.totalPence);
    if (isWonStage(lead.stage)) {
      await tx.lead.update({ where: { id: lead.id }, data: { dealValue } });
    } else {
      for (const op of stageChangeOps(tx, lead, "WON", { userId: opts.userId, now: opts.now, extraData: { dealValue } })) {
        await op;
      }
    }
    const job = await tx.job.findUnique({ where: { leadId: lead.id }, select: { id: true } });
    if (!job) await tx.job.create({ data: { leadId: lead.id } });

    const number = await takeNumber(tx, "INVOICE");
    const due = depositPence(quote.totalPence);
    const deposit = await tx.invoice.create({
      data: {
        number,
        leadId: lead.id,
        quoteId: quote.id,
        business: quote.business,
        type: "DEPOSIT",
        issueDate: dayToDb(ukToday(opts.now)),
        dueOnReceipt: true,
        clientName: quote.clientName,
        clientBusinessName: quote.clientBusinessName,
        clientEmail: quote.clientEmail,
        clientAddress: quote.clientAddress,
        targetAreas: quote.targetAreas,
        totalPence: quote.totalPence,
        amountDuePence: due,
        lines: {
          create: quote.lines.map((l) => ({ label: l.label, quantity: l.quantity, amountPence: l.amountPence, sortOrder: l.sortOrder })),
        },
      },
      select: { id: true, number: true },
    });
    await tx.activity.create({
      data: noteData(
        lead.id,
        `Quote ${quote.number} accepted. Deal value set to ${formatPence(quote.totalPence)}; deposit invoice ${number} drafted for ${formatPence(due)}.`,
        opts.userId
      ),
    });
    return { depositInvoiceId: deposit.id, depositNumber: deposit.number };
  });
}

export async function declineQuote(db: Db, id: string, opts: { userId: string | null; now: Date }) {
  return db.$transaction(async (tx) => {
    const changed = await tx.quote.updateMany({ where: { id, status: "SENT" }, data: { status: "DECLINED", declinedAt: opts.now } });
    if (changed.count === 0) {
      const exists = await tx.quote.findUnique({ where: { id }, select: { id: true } });
      throw exists ? new DocumentError("Only a sent quote can be marked declined", 409) : notFound("Quote");
    }
    const quote = await tx.quote.findUniqueOrThrow({ where: { id }, select: { number: true, leadId: true } });
    await tx.activity.create({ data: noteData(quote.leadId, `Quote ${quote.number} marked declined.`, opts.userId) });
  });
}

// --- Invoices ----------------------------------------------------------------------

type LeadInvoiceRow = {
  id: string;
  number: string;
  type: InvoiceType;
  status: InvoiceStatus;
  amountDuePence: number;
  paidAt: Date | null;
  deductedBy: { balanceInvoiceId: string; status: InvoiceStatus }[];
};

async function leadInvoices(tx: Tx, leadId: string): Promise<LeadInvoiceRow[]> {
  const rows = await tx.invoice.findMany({
    where: { leadId },
    orderBy: { number: "asc" },
    select: {
      id: true,
      number: true,
      type: true,
      status: true,
      amountDuePence: true,
      paidAt: true,
      deductedBy: { select: { balanceInvoiceId: true, balanceInvoice: { select: { status: true } } } },
    },
  });
  return rows.map((r) => ({
    ...r,
    deductedBy: r.deductedBy.map((d) => ({ balanceInvoiceId: d.balanceInvoiceId, status: d.balanceInvoice.status })),
  }));
}

function dueFields(type: InvoiceType, issueDate: string, requestedDue: string | null, branding: ReturnType<typeof brandingFor>) {
  if (type === "DEPOSIT") return { dueOnReceipt: true, dueDate: null };
  const days = type === "BALANCE" ? branding.balanceDueDays : branding.fullInvoiceDueDays;
  const due = type === "FULL" && requestedDue ? requestedDue : addDays(issueDate, days);
  return { dueOnReceipt: false, dueDate: dayToDb(due) };
}

export async function createInvoice(
  db: Db,
  params: { leadId: string; type: InvoiceType; data: DocumentData; quoteId?: string | null }
) {
  const { leadId, type, data } = params;
  return db.$transaction(async (tx) => {
    const lead = await leadForNew(tx, leadId);
    await lockLead(tx, leadId);
    const branding = brandingFor(lead.business);

    let quoteId: string | null = null;
    if (params.quoteId) {
      const quote = await tx.quote.findUnique({ where: { id: params.quoteId }, select: { leadId: true } });
      if (!quote || quote.leadId !== leadId) throw new DocumentError("That quote is not for this lead");
      quoteId = params.quoteId;
    }

    let deductions: { depositInvoiceId: string; amountPence: number }[] = [];
    if (type === "BALANCE") {
      deductions = deductibleDeposits(await leadInvoices(tx, leadId), null).map((d) => ({
        depositInvoiceId: d.id,
        amountPence: d.amountDuePence,
      }));
    }
    const due = amountDuePence(type, data.totalPence, deductions.map((d) => d.amountPence));
    if (due < 0) throw new DocumentError("The paid deposits come to more than this invoice's total");

    const number = await takeNumber(tx, "INVOICE");
    return tx.invoice.create({
      data: {
        number,
        leadId,
        quoteId,
        business: lead.business,
        type,
        issueDate: dayToDb(data.issueDate),
        ...dueFields(type, data.issueDate, data.dueDate, branding),
        ...clientFields(data),
        totalPence: data.totalPence,
        amountDuePence: due,
        notes: data.notes,
        lines: { create: lineCreates(data) },
        deductions: { create: deductions },
      },
      select: { id: true, number: true },
    });
  });
}

// A draft balance invoice deducts whatever deposits are paid when it is
// saved, and again whenever one of the lead's deposits is paid or voided.
async function refreshDraftBalances(tx: Tx, leadId: string): Promise<void> {
  const drafts = await tx.invoice.findMany({
    where: { leadId, type: "BALANCE", status: "DRAFT" },
    select: { id: true, totalPence: true },
  });
  for (const draft of drafts) {
    const deposits = deductibleDeposits(await leadInvoices(tx, leadId), draft.id);
    await tx.invoiceDeduction.deleteMany({ where: { balanceInvoiceId: draft.id } });
    if (deposits.length > 0) {
      await tx.invoiceDeduction.createMany({
        data: deposits.map((d) => ({ balanceInvoiceId: draft.id, depositInvoiceId: d.id, amountPence: d.amountDuePence })),
      });
    }
    const due = balancePence(draft.totalPence, deposits.map((d) => d.amountDuePence));
    await tx.invoice.update({ where: { id: draft.id }, data: { amountDuePence: Math.max(0, due) } });
  }
}

export async function updateInvoice(db: Db, id: string, data: DocumentData) {
  return db.$transaction(async (tx) => {
    const existing = await tx.invoice.findUnique({ where: { id }, select: { leadId: true, type: true, business: true } });
    if (!existing) throw notFound("Invoice");
    await lockLead(tx, existing.leadId);
    const branding = brandingFor(existing.business);

    let deposits: LeadInvoiceRow[] = [];
    if (existing.type === "BALANCE") deposits = deductibleDeposits(await leadInvoices(tx, existing.leadId), id);
    const due = amountDuePence(existing.type, data.totalPence, deposits.map((d) => d.amountDuePence));
    if (due < 0) throw new DocumentError("The paid deposits come to more than this invoice's total");

    const changed = await tx.invoice.updateMany({
      where: { id, status: "DRAFT" },
      data: {
        issueDate: dayToDb(data.issueDate),
        ...dueFields(existing.type, data.issueDate, data.dueDate, branding),
        ...clientFields(data),
        totalPence: data.totalPence,
        amountDuePence: due,
        notes: data.notes,
      },
    });
    if (changed.count === 0) throw new DocumentError("Only a draft can be edited", 409);
    await tx.invoiceLine.deleteMany({ where: { invoiceId: id } });
    await tx.invoiceLine.createMany({ data: lineCreates(data).map((l) => ({ ...l, invoiceId: id })) });
    if (existing.type === "BALANCE") {
      await tx.invoiceDeduction.deleteMany({ where: { balanceInvoiceId: id } });
      if (deposits.length > 0) {
        await tx.invoiceDeduction.createMany({
          data: deposits.map((d) => ({ balanceInvoiceId: id, depositInvoiceId: d.id, amountPence: d.amountDuePence })),
        });
      }
    }
    return { id };
  });
}

export async function deleteInvoice(db: Db, id: string) {
  const deleted = await db.invoice.deleteMany({ where: { id, status: "DRAFT" } });
  if (deleted.count === 0) {
    const exists = await db.invoice.findUnique({ where: { id }, select: { id: true } });
    throw exists ? new DocumentError("Only a draft can be deleted. Void it instead.", 409) : notFound("Invoice");
  }
}

// The lead's amount paid and payment status, from its invoices, through the
// one rule in leadPaymentFromInvoices. Profit, the Dashboard and Priorities
// read these two fields, so they follow.
async function recalcLeadPayment(tx: Tx, leadId: string): Promise<void> {
  const [lead, invoices] = await Promise.all([
    tx.lead.findUniqueOrThrow({ where: { id: leadId }, select: { dealValue: true } }),
    tx.invoice.findMany({ where: { leadId }, select: { type: true, status: true, amountDuePence: true } }),
  ]);
  const payment = leadPaymentFromInvoices(invoices, decimalToPence(lead.dealValue));
  await tx.lead.update({
    where: { id: leadId },
    data: {
      amountPaid: payment.amountPaidPence === null ? null : penceToDecimalText(payment.amountPaidPence),
      paymentStatus: payment.paymentStatus,
    },
  });
}

export async function markInvoicePaid(db: Db, id: string, opts: { paidOn: string; userId: string | null; now: Date }) {
  if (!isValidDay(opts.paidOn)) throw new DocumentError("Choose the day the payment was received");
  if (opts.paidOn > ukToday(opts.now)) throw new DocumentError("The payment date can't be in the future");
  return db.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({ where: { id }, select: { leadId: true, number: true, type: true, amountDuePence: true } });
    if (!invoice) throw notFound("Invoice");
    await lockLead(tx, invoice.leadId);
    const changed = await tx.invoice.updateMany({
      where: { id, status: { in: ["DRAFT", "SENT"] } },
      data: { status: "PAID", paidAt: dayToDb(opts.paidOn) },
    });
    if (changed.count === 0) throw new DocumentError("This invoice is already paid or void", 409);
    await recalcLeadPayment(tx, invoice.leadId);
    if (invoice.type === "DEPOSIT") await refreshDraftBalances(tx, invoice.leadId);
    await tx.activity.create({
      data: noteData(
        invoice.leadId,
        `Invoice ${invoice.number} marked paid: ${formatPence(invoice.amountDuePence)} received ${formatLongDate(opts.paidOn)}.`,
        opts.userId
      ),
    });
  });
}

export async function voidInvoice(db: Db, id: string, opts: { userId: string | null; now: Date }) {
  return db.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({ where: { id }, select: { leadId: true, number: true, type: true, status: true } });
    if (!invoice) throw notFound("Invoice");
    await lockLead(tx, invoice.leadId);
    if (invoice.type === "DEPOSIT") {
      const deductedBy = await tx.invoiceDeduction.findMany({
        where: { depositInvoiceId: id, balanceInvoice: { status: { in: ["SENT", "PAID"] } } },
        select: { balanceInvoice: { select: { number: true } } },
      });
      if (deductedBy.length > 0) {
        throw new DocumentError(
          `Balance invoice ${deductedBy[0].balanceInvoice.number} deducts this deposit. Void that first.`,
          409
        );
      }
    }
    const changed = await tx.invoice.updateMany({
      where: { id, status: { in: ["SENT", "PAID"] } },
      data: { status: "VOID", voidedAt: opts.now },
    });
    if (changed.count === 0) {
      throw new DocumentError(invoice.status === "DRAFT" ? "A draft is deleted, not voided" : "This invoice is already void", 409);
    }
    if (invoice.status === "PAID") await recalcLeadPayment(tx, invoice.leadId);
    if (invoice.type === "DEPOSIT") await refreshDraftBalances(tx, invoice.leadId);
    await tx.activity.create({ data: noteData(invoice.leadId, `Invoice ${invoice.number} voided.`, opts.userId) });
  });
}

// --- Sending ---------------------------------------------------------------------

// As when a document is emailed from the CRM: an Uncontacted lead moves to
// Awaiting Response, by the email path's own rule and writes. A lead in any
// other stage is left alone.
async function moveUncontactedLead(tx: Tx, leadId: string, what: string, userId: string | null): Promise<boolean> {
  await lockLead(tx, leadId);
  const lead = await tx.lead.findUniqueOrThrow({ where: { id: leadId }, select: { stage: true } });
  if (!shouldMoveToAwaitingResponse(lead.stage)) return false;
  for (const op of moveToAwaitingResponseOps(tx, leadId, `${what} was marked as sent`, userId)) await op;
  return true;
}

// Mark as sent, for a draft sent outside the CRM (downloaded and emailed by
// hand): it becomes Sent now, the lead gets a note, and an Uncontacted lead
// moves to Awaiting Response as it would had the CRM sent it. Nothing is emailed.
export async function markDocumentSent(
  db: Db,
  kind: "quote" | "invoice",
  id: string,
  opts: { userId: string | null; now: Date }
): Promise<{ movedToAwaitingResponse: boolean }> {
  return db.$transaction(async (tx) => {
    if (kind === "quote") {
      const changed = await tx.quote.updateMany({ where: { id, status: "DRAFT" }, data: { status: "SENT", sentAt: opts.now } });
      if (changed.count === 0) {
        const exists = await tx.quote.findUnique({ where: { id }, select: { id: true } });
        throw exists ? new DocumentError("Only a draft can be marked as sent", 409) : notFound("Quote");
      }
      const quote = await tx.quote.findUniqueOrThrow({ where: { id }, select: { number: true, leadId: true } });
      await tx.activity.create({ data: noteData(quote.leadId, `Quote ${quote.number} marked as sent`, opts.userId) });
      return { movedToAwaitingResponse: await moveUncontactedLead(tx, quote.leadId, `Quote ${quote.number}`, opts.userId) };
    }
    const changed = await tx.invoice.updateMany({ where: { id, status: "DRAFT" }, data: { status: "SENT", sentAt: opts.now } });
    if (changed.count === 0) {
      const exists = await tx.invoice.findUnique({ where: { id }, select: { id: true } });
      throw exists ? new DocumentError("Only a draft can be marked as sent", 409) : notFound("Invoice");
    }
    const invoice = await tx.invoice.findUniqueOrThrow({ where: { id }, select: { number: true, leadId: true } });
    await tx.activity.create({ data: noteData(invoice.leadId, `Invoice ${invoice.number} marked as sent`, opts.userId) });
    return { movedToAwaitingResponse: await moveUncontactedLead(tx, invoice.leadId, `Invoice ${invoice.number}`, opts.userId) };
  });
}

// The write that goes in the same transaction as the sent email's Activity:
// a draft becomes Sent; anything already sent just gets the new time.
export function markSentOp(db: Db, kind: "quote" | "invoice", id: string, now: Date) {
  return kind === "quote"
    ? db.quote.updateMany({ where: { id, status: { in: ["DRAFT", "SENT"] } }, data: { status: "SENT", sentAt: now } })
    : db.invoice.updateMany({ where: { id, status: { in: ["DRAFT", "SENT"] } }, data: { status: "SENT", sentAt: now } });
}

// --- Reading ---------------------------------------------------------------------

const LEAD_REF = { select: { id: true, name: true, businessName: true, email: true, stage: true, business: true, scrapped: true } };

export async function getQuote(db: Db, id: string) {
  return db.quote.findUnique({ where: { id }, include: { lines: LINES, lead: LEAD_REF } });
}

export async function getInvoice(db: Db, id: string) {
  return db.invoice.findUnique({
    where: { id },
    include: {
      lines: LINES,
      lead: LEAD_REF,
      quote: { select: { id: true, number: true } },
      deductions: {
        orderBy: { depositInvoice: { number: "asc" } },
        include: { depositInvoice: { select: { id: true, number: true, paidAt: true } } },
      },
    },
  });
}

export type QuoteRecord = NonNullable<Awaited<ReturnType<typeof getQuote>>>;
export type InvoiceRecord = NonNullable<Awaited<ReturnType<typeof getInvoice>>>;

// One row per document, for the lead's section and the Documents page.
export type DocumentRow = {
  kind: "quote" | "invoice";
  id: string;
  number: string;
  type: "QUOTE" | InvoiceType;
  status: string;
  business: "FDH" | "LDB";
  leadId: string;
  leadName: string;
  clientName: string;
  totalPence: number;
  // What it asks for: a quote's total, an invoice's amount due.
  amountPence: number;
  issueDate: string;
  dueDate: string | null;
  dueOnReceipt: boolean;
  paidAt: string | null;
  sentAt: string | null;
};

export async function listDocuments(db: Db, where: { leadId?: string } = {}): Promise<DocumentRow[]> {
  const [quotes, invoices] = await Promise.all([
    db.quote.findMany({ where, include: { lead: { select: { name: true } } } }),
    db.invoice.findMany({ where, include: { lead: { select: { name: true } } } }),
  ]);
  const rows: DocumentRow[] = [
    ...quotes.map((q) => ({
      kind: "quote" as const,
      id: q.id,
      number: q.number,
      type: "QUOTE" as const,
      status: q.status,
      business: q.business,
      leadId: q.leadId,
      leadName: q.lead.name,
      clientName: q.clientName,
      totalPence: q.totalPence,
      amountPence: q.totalPence,
      issueDate: dbDay(q.issueDate),
      dueDate: dbDay(q.validUntil),
      dueOnReceipt: false,
      paidAt: null,
      sentAt: q.sentAt?.toISOString() ?? null,
    })),
    ...invoices.map((i) => ({
      kind: "invoice" as const,
      id: i.id,
      number: i.number,
      type: i.type,
      status: i.status,
      business: i.business,
      leadId: i.leadId,
      leadName: i.lead.name,
      clientName: i.clientName,
      totalPence: i.totalPence,
      amountPence: i.amountDuePence,
      issueDate: dbDay(i.issueDate),
      dueDate: i.dueDate ? dbDay(i.dueDate) : null,
      dueOnReceipt: i.dueOnReceipt,
      paidAt: i.paidAt ? dbDay(i.paidAt) : null,
      sentAt: i.sentAt?.toISOString() ?? null,
    })),
  ];
  // Newest first; a quote and an invoice on the same day by number.
  return rows.sort((a, b) => (a.issueDate === b.issueDate ? b.number.localeCompare(a.number) : b.issueDate.localeCompare(a.issueDate)));
}

// What the builder starts a new document with: the lead's details, or for an
// invoice the lines of the lead's accepted quote when it has one; for a
// balance invoice, the paid deposits it will deduct.
export async function newDocumentPrefill(db: Db, leadId: string, type: "QUOTE" | InvoiceType, now: Date) {
  const lead = await db.lead.findUnique({
    where: { id: leadId },
    select: {
      id: true,
      name: true,
      businessName: true,
      email: true,
      addressArea: true,
      postcode: true,
      targetAreas: true,
      leafletQuantity: true,
      printingIncluded: true,
      designIncluded: true,
      dealValue: true,
      business: true,
      scrapped: true,
    },
  });
  if (!lead) return null;
  const quote =
    type === "QUOTE"
      ? null
      : await db.quote.findFirst({
          where: { leadId, status: "ACCEPTED" },
          orderBy: { acceptedAt: "desc" },
          include: { lines: LINES },
        });
  const start = quote ? draftsFromDocument(quote) : prefillFromLead(lead);
  const deposits =
    type === "BALANCE"
      ? deductibleDeposits(await leadInvoices(db as unknown as Tx, leadId), null).map((d) => ({
          number: d.number,
          paidOn: d.paidAt ? dbDay(d.paidAt) : null,
          amountPence: d.amountDuePence,
        }))
      : [];
  const branding = brandingFor(lead.business);
  const issueDate = ukToday(now);
  return {
    lead: { id: lead.id, name: lead.name, business: lead.business, scrapped: lead.scrapped },
    quote: quote ? { id: quote.id, number: quote.number } : null,
    client: start.client,
    lines: start.lines,
    issueDate,
    dueDate: type === "FULL" ? addDays(issueDate, branding.fullInvoiceDueDays) : null,
    deposits,
  };
}
