// Quotes and invoices: the rules both the browser and the server use. No
// server imports. All money is whole pence; there is no VAT anywhere. Days
// are UK calendar days as "YYYY-MM-DD".

import { MAX_PENCE, decimalToPence, parsePoundsToPence } from "@/lib/money";

export type DocumentKind = "quote" | "invoice";
export type InvoiceType = "DEPOSIT" | "BALANCE" | "FULL";
export type DocumentType = "QUOTE" | InvoiceType;
export type QuoteStatus = "DRAFT" | "SENT" | "ACCEPTED" | "DECLINED";
export type InvoiceStatus = "DRAFT" | "SENT" | "PAID" | "VOID";
export type DocumentStatus = QuoteStatus | InvoiceStatus;

export const INVOICE_TYPES: readonly InvoiceType[] = ["DEPOSIT", "BALANCE", "FULL"];
export const DOCUMENT_TYPES: readonly DocumentType[] = ["QUOTE", ...INVOICE_TYPES];
export const QUOTE_STATUSES: readonly QuoteStatus[] = ["DRAFT", "SENT", "ACCEPTED", "DECLINED"];
export const INVOICE_STATUSES: readonly InvoiceStatus[] = ["DRAFT", "SENT", "PAID", "VOID"];

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  QUOTE: "Quote",
  DEPOSIT: "Deposit invoice",
  BALANCE: "Balance invoice",
  FULL: "Full invoice",
};

// The title printed at the top of the PDF.
export const DOCUMENT_TITLES: Record<DocumentType, string> = {
  QUOTE: "Quote",
  DEPOSIT: "Deposit invoice",
  BALANCE: "Invoice",
  FULL: "Invoice",
};

export const STATUS_LABELS: Record<DocumentStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
  PAID: "Paid",
  VOID: "Void",
};

export function isInvoiceType(value: unknown): value is InvoiceType {
  return value === "DEPOSIT" || value === "BALANCE" || value === "FULL";
}

export function isDocumentKind(value: unknown): value is DocumentKind {
  return value === "quote" || value === "invoice";
}

// --- Numbers --------------------------------------------------------------------

export type DocumentSequence = "INVOICE" | "QUOTE";

export function formatDocumentNumber(sequence: DocumentSequence, n: number): string {
  return `${sequence === "INVOICE" ? "INV" : "QUO"}-${n}`;
}

// --- Money ----------------------------------------------------------------------

// The optional design line's starting price.
export const DESIGN_DEFAULT_PENCE = 15000;

export function linesTotalPence(lines: { amountPence: number }[]): number {
  return lines.reduce((sum, line) => sum + line.amountPence, 0);
}

// Half the total, rounded up to the penny, so the deposit and the balance
// left after it always add up to the total: £1,000.01 is a £500.01 deposit
// and a £500.00 balance.
export function depositPence(totalPence: number): number {
  return Math.ceil(totalPence / 2);
}

// The total less the paid deposits a balance invoice deducts.
export function balancePence(totalPence: number, deductedPence: number[]): number {
  return totalPence - deductedPence.reduce((sum, n) => sum + n, 0);
}

// What an invoice asks for.
export function amountDuePence(type: InvoiceType, totalPence: number, deductedPence: number[] = []): number {
  if (type === "DEPOSIT") return depositPence(totalPence);
  if (type === "BALANCE") return balancePence(totalPence, deductedPence);
  return totalPence;
}

// --- Which deposits a balance invoice deducts ------------------------------------

export type DepositForBalance = {
  id: string;
  type: InvoiceType;
  status: InvoiceStatus;
  amountDuePence: number;
  // The balance invoices (with their status) that already deduct it.
  deductedBy: { balanceInvoiceId: string; status: InvoiceStatus }[];
};

// Paid deposits only, and not one a different balance invoice already
// deducts (a voided balance invoice gives its deposits back).
export function deductibleDeposits<T extends DepositForBalance>(invoices: T[], balanceInvoiceId: string | null): T[] {
  return invoices.filter(
    (inv) =>
      inv.type === "DEPOSIT" &&
      inv.status === "PAID" &&
      !inv.deductedBy.some((d) => d.balanceInvoiceId !== balanceInvoiceId && d.status !== "VOID")
  );
}

// --- The lead's payment, from its invoices --------------------------------------

export type LeadPayment = { amountPaidPence: number | null; paymentStatus: "NOT_PAID" | "DEPOSIT_PAID" | "PAID_IN_FULL" };

// Amount paid is the sum of the paid invoices. Paid in Full once a balance or
// full invoice is paid, or the paid invoices reach the deal value; Deposit
// Paid while only deposits are; Not Paid with nothing paid (a voided invoice
// no longer counts).
export function leadPaymentFromInvoices(
  invoices: { type: InvoiceType; status: InvoiceStatus; amountDuePence: number }[],
  dealPence: number | null
): LeadPayment {
  const paid = invoices.filter((inv) => inv.status === "PAID");
  if (paid.length === 0) return { amountPaidPence: null, paymentStatus: "NOT_PAID" };
  const sum = paid.reduce((total, inv) => total + inv.amountDuePence, 0);
  const full =
    paid.some((inv) => inv.type === "BALANCE" || inv.type === "FULL") ||
    (dealPence !== null && dealPence > 0 && sum >= dealPence);
  return { amountPaidPence: sum, paymentStatus: full ? "PAID_IN_FULL" : "DEPOSIT_PAID" };
}

// --- What can be done to a document ------------------------------------------------

export function canEdit(status: DocumentStatus): boolean {
  return status === "DRAFT";
}
export function canDelete(status: DocumentStatus): boolean {
  return status === "DRAFT";
}
export function canEmail(status: DocumentStatus): boolean {
  return status === "DRAFT" || status === "SENT";
}
export function canAcceptOrDecline(status: QuoteStatus): boolean {
  return status === "SENT";
}
export function canMarkPaid(status: InvoiceStatus): boolean {
  return status === "DRAFT" || status === "SENT";
}
export function canVoid(status: InvoiceStatus): boolean {
  return status === "SENT" || status === "PAID";
}

// --- Days -------------------------------------------------------------------------

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidDay(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const m = DAY_RE.exec(value);
  if (!m) return false;
  const y = Number(m[1]);
  const d = new Date(Date.UTC(y, Number(m[2]) - 1, Number(m[3])));
  return y >= 2000 && y <= 2100 && d.toISOString().slice(0, 10) === value;
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

// Today in the UK, "YYYY-MM-DD".
export function ukToday(now: Date): string {
  return now.toLocaleDateString("en-CA", { timeZone: "Europe/London" });
}

const LONG_DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

// "2026-10-18" -> "18 October 2026".
export function formatLongDate(day: string): string {
  return LONG_DATE.format(new Date(`${day}T00:00:00Z`));
}

// A day stored in a DATE column, as "YYYY-MM-DD".
export function dbDay(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function dayToDb(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}

// --- Prefilling from the lead -----------------------------------------------------

export type ClientDetails = {
  name: string;
  businessName: string;
  email: string;
  address: string;
  targetAreas: string;
};

export type LineDraft = { label: string; quantity: string; amount: string };

export type LeadForDocument = {
  name: string;
  businessName: string | null;
  email: string | null;
  addressArea: string | null;
  postcode: string | null;
  targetAreas: string | null;
  leafletQuantity: string | null;
  printingIncluded: boolean;
  designIncluded: boolean;
  dealValue: { toFixed(digits: number): string } | string | null;
};

// "5,000", "5000 leaflets", "2.5k" -> a whole number of leaflets, or null.
export function parseLeafletQuantity(text: string | null | undefined): number | null {
  if (!text) return null;
  const k = /(\d+(?:\.\d+)?)\s*k\b/i.exec(text);
  if (k) {
    const n = Math.round(Number(k[1]) * 1000);
    return n > 0 && n <= MAX_QUANTITY ? n : null;
  }
  const m = /\d[\d,]*/.exec(text);
  if (!m) return null;
  const n = Number(m[0].replace(/,/g, ""));
  return Number.isInteger(n) && n > 0 && n <= MAX_QUANTITY ? n : null;
}

export function mainLineLabel(printingIncluded: boolean): string {
  return printingIncluded ? "Printing and distribution" : "Distribution";
}

const toInput = (pence: number) => (pence / 100).toFixed(2);

// The client details and lines a new document starts with, from the lead:
// the main line at the deal value (less the design line, when there is one
// and the deal value covers it), and a design line when design is included.
export function prefillFromLead(lead: LeadForDocument): { client: ClientDetails; lines: LineDraft[] } {
  const address = [lead.addressArea?.trim(), lead.postcode?.trim()]
    .filter((part): part is string => !!part)
    .filter((part, i, parts) => i === 0 || !parts[0].toUpperCase().includes(part.toUpperCase()))
    .join(", ");
  const dealPence = decimalToPence(lead.dealValue);
  const design = lead.designIncluded;
  const mainPence =
    dealPence === null ? null : design && dealPence >= DESIGN_DEFAULT_PENCE ? dealPence - DESIGN_DEFAULT_PENCE : dealPence;
  const quantity = parseLeafletQuantity(lead.leafletQuantity);
  const lines: LineDraft[] = [
    {
      label: mainLineLabel(lead.printingIncluded),
      quantity: quantity === null ? "" : String(quantity),
      amount: mainPence === null ? "" : toInput(mainPence),
    },
  ];
  if (design) lines.push({ label: "Design", quantity: "", amount: toInput(DESIGN_DEFAULT_PENCE) });
  return {
    client: {
      name: lead.name,
      businessName: lead.businessName ?? "",
      email: lead.email ?? "",
      address,
      targetAreas: lead.targetAreas ?? "",
    },
    lines,
  };
}

// Lines and client details copied from another document, for the form.
export function draftsFromDocument(doc: {
  clientName: string;
  clientBusinessName: string | null;
  clientEmail: string | null;
  clientAddress: string | null;
  targetAreas: string | null;
  lines: { label: string; quantity: number | null; amountPence: number }[];
}): { client: ClientDetails; lines: LineDraft[] } {
  return {
    client: {
      name: doc.clientName,
      businessName: doc.clientBusinessName ?? "",
      email: doc.clientEmail ?? "",
      address: doc.clientAddress ?? "",
      targetAreas: doc.targetAreas ?? "",
    },
    lines: doc.lines.map((l) => ({
      label: l.label,
      quantity: l.quantity === null ? "" : String(l.quantity),
      amount: toInput(l.amountPence),
    })),
  };
}

// --- Checking what the builder sends ------------------------------------------------

export const LIMITS = {
  clientName: 120,
  clientBusinessName: 120,
  clientEmail: 254,
  clientAddress: 300,
  targetAreas: 300,
  label: 120,
  notes: 2000,
  lines: 20,
} as const;

export const MAX_QUANTITY = 10_000_000;
const EMAIL_RE = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/;

export type LineData = { label: string; quantity: number | null; amountPence: number; sortOrder: number };

export type DocumentData = {
  clientName: string;
  clientBusinessName: string | null;
  clientEmail: string | null;
  clientAddress: string | null;
  targetAreas: string | null;
  issueDate: string;
  // Full invoices only; the others work theirs out.
  dueDate: string | null;
  notes: string | null;
  lines: LineData[];
  totalPence: number;
};

// No em dashes on documents: one typed into a field becomes a hyphen.
export function tidyDocumentText(value: string): string {
  return value.replace(/\u2014/g, "-");
}

function text(value: unknown, multiline = false): string | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return undefined;
  let v = tidyDocumentText(value).replace(/\r\n|\r/g, "\n");
  v = multiline
    ? v.replace(/[^\S\n]+/g, " ").replace(/\n{3,}/g, "\n\n")
    : v.replace(/\s+/g, " ");
  v = v.trim();
  return v === "" ? null : v;
}

function quantity(value: unknown): number | null | undefined {
  if (value === undefined || value === null || value === "") return null;
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value.replace(/,/g, "").trim()) : NaN;
  return Number.isInteger(n) && n > 0 && n <= MAX_QUANTITY ? n : undefined;
}

export function parseDocumentInput(
  raw: unknown,
  type: DocumentType
): { ok: true; data: DocumentData } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, error: "Invalid document" };
  const body = raw as Record<string, unknown>;
  const client = (body.client && typeof body.client === "object" ? body.client : {}) as Record<string, unknown>;

  const fields = {
    clientName: text(client.name),
    clientBusinessName: text(client.businessName),
    clientEmail: text(client.email),
    clientAddress: text(client.address),
    targetAreas: text(client.targetAreas),
  };
  const limits: Record<keyof typeof fields, number> = {
    clientName: LIMITS.clientName,
    clientBusinessName: LIMITS.clientBusinessName,
    clientEmail: LIMITS.clientEmail,
    clientAddress: LIMITS.clientAddress,
    targetAreas: LIMITS.targetAreas,
  };
  const names: Record<keyof typeof fields, string> = {
    clientName: "Client name",
    clientBusinessName: "Business name",
    clientEmail: "Email",
    clientAddress: "Address",
    targetAreas: "Target areas",
  };
  for (const key of Object.keys(fields) as (keyof typeof fields)[]) {
    const v = fields[key];
    if (v === undefined) return { ok: false, error: `Invalid ${names[key].toLowerCase()}` };
    if (v !== null && v.length > limits[key]) return { ok: false, error: `${names[key]} must be ${limits[key]} characters or fewer` };
  }
  if (!fields.clientName) return { ok: false, error: "Client name is required" };
  if (fields.clientEmail && !EMAIL_RE.test(fields.clientEmail)) return { ok: false, error: "Invalid email" };

  const notes = text(body.notes, true);
  if (notes === undefined) return { ok: false, error: "Invalid notes" };
  if (notes !== null && notes.length > LIMITS.notes) return { ok: false, error: `Notes must be ${LIMITS.notes} characters or fewer` };

  if (!isValidDay(body.issueDate)) return { ok: false, error: "Choose an issue date" };
  let dueDate: string | null = null;
  if (type === "FULL" && body.dueDate !== undefined && body.dueDate !== null && body.dueDate !== "") {
    if (!isValidDay(body.dueDate)) return { ok: false, error: "Invalid due date" };
    if (body.dueDate < body.issueDate) return { ok: false, error: "The due date can't be before the issue date" };
    dueDate = body.dueDate;
  }

  if (!Array.isArray(body.lines) || body.lines.length === 0) return { ok: false, error: "Add at least one line" };
  if (body.lines.length > LIMITS.lines) return { ok: false, error: `No more than ${LIMITS.lines} lines` };
  const lines: LineData[] = [];
  for (const [i, rawLine] of body.lines.entries()) {
    const line = (rawLine && typeof rawLine === "object" ? rawLine : {}) as Record<string, unknown>;
    const label = text(line.label);
    if (!label) return { ok: false, error: `Line ${i + 1} needs a description` };
    if (label.length > LIMITS.label) return { ok: false, error: `Line ${i + 1}'s description is too long` };
    const qty = quantity(line.quantity);
    if (qty === undefined) return { ok: false, error: `Line ${i + 1}'s quantity must be a whole number` };
    const pence = parsePoundsToPence(line.amount);
    if (pence === null) return { ok: false, error: `Line ${i + 1}'s amount must be in pounds, like 450.00` };
    lines.push({ label, quantity: qty, amountPence: pence, sortOrder: i });
  }
  const totalPence = linesTotalPence(lines);
  if (totalPence <= 0) return { ok: false, error: "The total must be more than £0.00" };
  if (totalPence > MAX_PENCE) return { ok: false, error: "The total is too large" };

  return {
    ok: true,
    data: {
      clientName: fields.clientName,
      // Each was checked above: a string or null, never undefined.
      clientBusinessName: fields.clientBusinessName as string | null,
      clientEmail: fields.clientEmail as string | null,
      clientAddress: fields.clientAddress as string | null,
      targetAreas: fields.targetAreas as string | null,
      issueDate: body.issueDate,
      dueDate,
      notes,
      lines,
      totalPence,
    },
  };
}

// --- Email wording -------------------------------------------------------------------

export function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => values[key] ?? whole);
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name.trim();
}
