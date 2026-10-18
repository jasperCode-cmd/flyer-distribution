import { NextResponse } from "next/server";
import { DocumentError, type InvoiceRecord, type QuoteRecord } from "./service";
import { dbDay, draftsFromDocument, type ClientDetails, type DocumentType, type LineDraft } from "./rules";

// What the builder and the lead's section are sent about one document.
export type DocumentDetail = {
  kind: "quote" | "invoice";
  id: string;
  number: string;
  type: DocumentType;
  status: string;
  business: "FDH" | "LDB";
  lead: { id: string; name: string; email: string | null; scrapped: boolean };
  quote: { id: string; number: string } | null;
  client: ClientDetails;
  lines: LineDraft[];
  issueDate: string;
  validUntil: string | null;
  dueDate: string | null;
  dueOnReceipt: boolean;
  notes: string;
  totalPence: number;
  amountDuePence: number;
  deductions: { number: string; paidOn: string | null; amountPence: number }[];
  paidAt: string | null;
  sentAt: string | null;
};

export function quoteDetail(q: QuoteRecord): DocumentDetail {
  const drafts = draftsFromDocument(q);
  return {
    kind: "quote",
    id: q.id,
    number: q.number,
    type: "QUOTE",
    status: q.status,
    business: q.business,
    lead: { id: q.lead.id, name: q.lead.name, email: q.lead.email, scrapped: q.lead.scrapped },
    quote: null,
    client: drafts.client,
    lines: drafts.lines,
    issueDate: dbDay(q.issueDate),
    validUntil: dbDay(q.validUntil),
    dueDate: null,
    dueOnReceipt: false,
    notes: q.notes ?? "",
    totalPence: q.totalPence,
    amountDuePence: q.totalPence,
    deductions: [],
    paidAt: null,
    sentAt: q.sentAt?.toISOString() ?? null,
  };
}

export function invoiceDetail(i: InvoiceRecord): DocumentDetail {
  const drafts = draftsFromDocument(i);
  return {
    kind: "invoice",
    id: i.id,
    number: i.number,
    type: i.type,
    status: i.status,
    business: i.business,
    lead: { id: i.lead.id, name: i.lead.name, email: i.lead.email, scrapped: i.lead.scrapped },
    quote: i.quote,
    client: drafts.client,
    lines: drafts.lines,
    issueDate: dbDay(i.issueDate),
    validUntil: null,
    dueDate: i.dueDate ? dbDay(i.dueDate) : null,
    dueOnReceipt: i.dueOnReceipt,
    notes: i.notes ?? "",
    totalPence: i.totalPence,
    amountDuePence: i.amountDuePence,
    deductions: i.deductions.map((d) => ({
      number: d.depositInvoice.number,
      paidOn: d.depositInvoice.paidAt ? dbDay(d.depositInvoice.paidAt) : null,
      amountPence: d.amountPence,
    })),
    paidAt: i.paidAt ? dbDay(i.paidAt) : null,
    sentAt: i.sentAt?.toISOString() ?? null,
  };
}

// A known problem (bad input, wrong status) as its status and message; anything
// else as a plain 500, logged without the request's contents.
export function documentErrorResponse(err: unknown, action: string): NextResponse {
  if (err instanceof DocumentError) return NextResponse.json({ error: err.message }, { status: err.status });
  console.error(`Document ${action} failed:`, err instanceof Error ? err.name : "unknown error");
  return NextResponse.json({ error: `Could not ${action}. Please try again.` }, { status: 500 });
}
