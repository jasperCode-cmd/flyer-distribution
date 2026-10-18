import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { PDFDocument, PDFName, PDFRawStream, PDFDict } from "pdf-lib";
import type { PdfDocumentModel } from "@/lib/documents/pdf";
import type { PaymentDetails } from "@/lib/documents/bank";

// Shared by the quotes and invoices tests: made-up clients, placeholder bank
// details made up afresh on every run (so nothing resembling real ones is
// ever written down), and a PDF reader.

const digits = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join("");

// Placeholder bank settings, as the environment would hold them.
export function placeholderBankEnv(): Record<string, string> {
  return {
    PAYMENT_ACCOUNT_NAME: `Placeholder Account ${digits(4)}`,
    PAYMENT_SORT_CODE: digits(6),
    PAYMENT_ACCOUNT_NUMBER: digits(8),
  };
}

export function placeholderPayment(env = placeholderBankEnv()): PaymentDetails {
  const s = env.PAYMENT_SORT_CODE;
  return {
    accountName: env.PAYMENT_ACCOUNT_NAME,
    sortCode: `${s.slice(0, 2)}-${s.slice(2, 4)}-${s.slice(4, 6)}`,
    accountNumber: env.PAYMENT_ACCOUNT_NUMBER,
  };
}

export const CLIENT = {
  name: "Sophie Turner",
  businessName: "Turner's Bakery",
  email: "sophie@example.com",
  address: "14 Example Street, Boscombe, BH5 1AA",
  targetAreas: "Boscombe, Southbourne",
};

export function model(overrides: Partial<PdfDocumentModel>): PdfDocumentModel {
  return {
    type: "QUOTE",
    number: "QUO-1001",
    status: "SENT",
    business: "FDH",
    issueDate: "2026-10-18",
    validUntil: "2026-11-17",
    dueDate: null,
    dueOnReceipt: false,
    client: CLIENT,
    lines: [
      { label: "Printing and distribution", quantity: 5000, amountPence: 45000 },
      { label: "Design", quantity: null, amountPence: 15000 },
    ],
    totalPence: 60000,
    amountDuePence: 60000,
    deductions: [],
    notes: null,
    paidOn: null,
    ...overrides,
  };
}

// Everything a reader of the PDF could see: the text on every page, the
// metadata, the names of the embedded fonts, how many images it holds, and
// the raw file as text (for anything stored uncompressed).
export async function readPdf(bytes: Uint8Array) {
  const task = getDocument({ data: new Uint8Array(bytes), disableFontFace: true, verbosity: 0 });
  const doc = await task.promise;
  const meta = await doc.getMetadata();
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
  }
  await task.destroy();

  const parsed = await PDFDocument.load(bytes, { updateMetadata: false });
  const fonts: string[] = [];
  let images = 0;
  for (const [, object] of parsed.context.enumerateIndirectObjects()) {
    const dict = object instanceof PDFRawStream ? object.dict : object instanceof PDFDict ? object : null;
    if (!dict) continue;
    const subtype = dict.get(PDFName.of("Subtype"));
    if (subtype === PDFName.of("Image")) images++;
    const base = dict.get(PDFName.of("BaseFont"));
    if (base instanceof PDFName) fonts.push(base.decodeText());
  }
  return {
    text: pages.join("\n").replace(/\s+/g, " "),
    info: meta.info as Record<string, unknown>,
    fonts,
    images,
    raw: Buffer.from(bytes).toString("latin1"),
  };
}
