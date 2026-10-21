import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { documentFileName } from "./branding";
import { readPaymentDetails } from "./bank";
import { renderDocumentPdf, type PdfDocumentModel } from "./pdf";
import { dbDay, type DocumentKind } from "./rules";
import { getInvoice, getQuote, type InvoiceRecord, type QuoteRecord } from "./service";

// A saved quote or invoice as its PDF. Invoices need the bank details from
// the environment; without them nothing is rendered and the reason is
// returned instead (setting names only, never values). A deposit recorded
// from outside the CRM has no PDF.

export function quotePdfModel(q: QuoteRecord): PdfDocumentModel {
  return {
    type: "QUOTE",
    number: q.number,
    status: q.status,
    business: q.business,
    issueDate: dbDay(q.issueDate),
    validUntil: dbDay(q.validUntil),
    dueDate: null,
    dueOnReceipt: false,
    client: {
      name: q.clientName,
      businessName: q.clientBusinessName,
      email: q.clientEmail,
      address: q.clientAddress,
      targetAreas: q.targetAreas,
    },
    lines: q.lines.map((l) => ({ label: l.label, quantity: l.quantity, amountPence: l.amountPence })),
    totalPence: q.totalPence,
    amountDuePence: q.totalPence,
    deductions: [],
    notes: q.notes,
    paidOn: null,
  };
}

export function invoicePdfModel(i: InvoiceRecord): PdfDocumentModel {
  return {
    type: i.type,
    number: i.number,
    status: i.status,
    business: i.business,
    issueDate: dbDay(i.issueDate),
    validUntil: null,
    dueDate: i.dueDate ? dbDay(i.dueDate) : null,
    dueOnReceipt: i.dueOnReceipt,
    client: {
      name: i.clientName,
      businessName: i.clientBusinessName,
      email: i.clientEmail,
      address: i.clientAddress,
      targetAreas: i.targetAreas,
    },
    lines: i.lines.map((l) => ({ label: l.label, quantity: l.quantity, amountPence: l.amountPence })),
    totalPence: i.totalPence,
    amountDuePence: i.amountDuePence,
    deductions: i.deductions.map((d) => ({
      number: d.depositInvoice.number,
      paidOn: d.depositInvoice.paidAt ? dbDay(d.depositInvoice.paidAt) : null,
      amountPence: d.amountPence,
    })),
    notes: i.notes,
    paidOn: i.paidAt ? dbDay(i.paidAt) : null,
  };
}

export type RenderedDocument =
  | { ok: true; bytes: Uint8Array; fileName: string; record: QuoteRecord | InvoiceRecord }
  | { ok: false; status: number; error: string };

export async function renderStoredDocument(
  db: PrismaClient,
  kind: DocumentKind,
  id: string,
  env: Record<string, string | undefined> = process.env
): Promise<RenderedDocument> {
  if (kind === "quote") {
    const quote = await getQuote(db, id);
    if (!quote) return { ok: false, status: 404, error: "Quote not found" };
    const bytes = await renderDocumentPdf(quotePdfModel(quote), { payment: null });
    return { ok: true, bytes, fileName: documentFileName(quote.business, quote.number), record: quote };
  }
  const invoice = await getInvoice(db, id);
  if (!invoice) return { ok: false, status: 404, error: "Invoice not found" };
  // Never made into a PDF (or so emailed): the CRM didn't issue it.
  if (invoice.issuedOutsideCrm) return { ok: false, status: 409, error: `${invoice.number} was issued outside the CRM, so the CRM has no PDF of it.` };
  const payment = readPaymentDetails(env);
  if (!payment.ok) return { ok: false, status: 503, error: payment.message };
  const bytes = await renderDocumentPdf(invoicePdfModel(invoice), { payment: payment.details });
  return { ok: true, bytes, fileName: documentFileName(invoice.business, invoice.number), record: invoice };
}
