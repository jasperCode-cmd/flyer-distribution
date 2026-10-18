import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb, type PDFFont, type PDFImage, type PDFPage, type RGB } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { Business } from "@/lib/business";
import { formatPence } from "@/lib/money";
import { brandingFor, type DocumentBranding } from "./branding";
import type { PaymentDetails } from "./bank";
import { DOCUMENT_TITLES, fillTemplate, formatLongDate, tidyDocumentText, type DocumentStatus, type DocumentType } from "./rules";

// Quotes and invoices as A4 PDFs, in the branding of the business they are
// for: its name or logo, details, colours and fonts, and nothing of the
// other business, metadata included. Everything that carries meaning is
// dark text on white, so a black and white print reads the same; the
// accent colour is only ever a thin rule.

export type PdfDocumentModel = {
  type: DocumentType;
  number: string;
  status: DocumentStatus;
  business: Business;
  issueDate: string;
  // Quotes.
  validUntil: string | null;
  // Invoices.
  dueDate: string | null;
  dueOnReceipt: boolean;
  client: {
    name: string;
    businessName: string | null;
    email: string | null;
    address: string | null;
    targetAreas: string | null;
  };
  lines: { label: string; quantity: number | null; amountPence: number }[];
  totalPence: number;
  amountDuePence: number;
  // Balance invoices: the paid deposits deducted.
  deductions: { number: string; paidOn: string | null; amountPence: number }[];
  notes: string | null;
  paidOn: string | null;
};

export class PdfError extends Error {}

const ASSETS_DIR = path.join(process.cwd(), "lib", "documents", "assets");
const assetCache = new Map<string, Promise<Uint8Array>>();

function loadAsset(kind: "fonts" | "logos", file: string): Promise<Uint8Array> {
  const key = `${kind}/${file}`;
  let bytes = assetCache.get(key);
  if (!bytes) {
    bytes = readFile(path.join(ASSETS_DIR, kind, file)).then((b) => new Uint8Array(b));
    // A failed read isn't kept, so the next request tries again.
    bytes.catch(() => assetCache.delete(key));
    assetCache.set(key, bytes);
  }
  return bytes;
}

const A4 = { width: 595.28, height: 841.89 };
const MARGIN = 50;
const FOOTER_TOP = 62;
const CONTENT_RIGHT = A4.width - MARGIN;

const INK = rgb(0.067, 0.094, 0.153); // #111827
const MUTED = rgb(0.29, 0.333, 0.388); // #4B5563
const RULE = rgb(0.82, 0.835, 0.859); // #D1D5DB

function hex(colour: string): RGB {
  const n = parseInt(colour.replace("#", ""), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

// Anything a font can't draw on one line (tabs, control characters) is a space.
function clean(text: string): string {
  return tidyDocumentText(text).replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, " ");
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  for (const paragraph of clean(text).split("\n")) {
    const words = paragraph.split(/ +/).filter(Boolean);
    if (words.length === 0) {
      out.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= maxWidth) {
        line = next;
        continue;
      }
      if (line) out.push(line);
      // A single word wider than the column is split by characters.
      let rest = word;
      while (font.widthOfTextAtSize(rest, size) > maxWidth) {
        let cut = rest.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > maxWidth) cut--;
        out.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      line = rest;
    }
    out.push(line);
  }
  return out;
}

const QTY = new Intl.NumberFormat("en-GB");

type Fonts = { regular: PDFFont; bold: PDFFont; heading: PDFFont };

class Layout {
  page!: PDFPage;
  y = 0;
  readonly pages: PDFPage[] = [];

  constructor(
    readonly doc: PDFDocument,
    readonly fonts: Fonts,
    readonly brand: DocumentBranding,
    readonly title: string,
    readonly number: string
  ) {
    this.addPage();
  }

  addPage() {
    this.page = this.doc.addPage([A4.width, A4.height]);
    this.pages.push(this.page);
    this.y = A4.height - MARGIN;
    if (this.pages.length > 1) {
      // A continuation page names the document at the top.
      this.text(`${this.title} ${this.number} (continued)`, MARGIN, this.y - 9, { font: this.fonts.bold, size: 9, colour: MUTED });
      this.y -= 30;
    }
  }

  // Starts a new page unless `height` more points fit above the footer.
  need(height: number) {
    if (this.y - height < FOOTER_TOP + 14) this.addPage();
  }

  text(value: string, x: number, y: number, opts: { font?: PDFFont; size?: number; colour?: RGB } = {}) {
    const font = opts.font ?? this.fonts.regular;
    this.page.drawText(clean(value), { x, y, size: opts.size ?? 9.5, font, color: opts.colour ?? INK });
  }

  textRight(value: string, right: number, y: number, opts: { font?: PDFFont; size?: number; colour?: RGB } = {}) {
    const font = opts.font ?? this.fonts.regular;
    const size = opts.size ?? 9.5;
    this.text(value, right - font.widthOfTextAtSize(clean(value), size), y, { ...opts, font, size });
  }

  // Wrapped lines from the cursor down, each line kept on one page.
  paragraph(value: string, x: number, width: number, opts: { font?: PDFFont; size?: number; colour?: RGB; leading?: number } = {}) {
    const font = opts.font ?? this.fonts.regular;
    const size = opts.size ?? 9.5;
    const leading = opts.leading ?? size * 1.45;
    for (const line of wrap(value, font, size, width)) {
      this.need(leading);
      this.text(line, x, this.y - size, { ...opts, font, size });
      this.y -= leading;
    }
  }

  heading(value: string) {
    // A heading never ends a page on its own.
    this.need(46);
    this.y -= 12;
    this.text(value, MARGIN, this.y - 11, { font: this.fonts.heading, size: 11, colour: hex(this.brand.colours.primary) });
    this.y -= 19;
  }

  rule(y: number, colour: RGB = RULE, thickness = 0.75, x0 = MARGIN, x1 = CONTENT_RIGHT) {
    this.page.drawLine({ start: { x: x0, y }, end: { x: x1, y }, thickness, color: colour });
  }
}

function dueText(model: PdfDocumentModel, brand: DocumentBranding): string | null {
  if (model.type === "QUOTE") return null;
  if (model.dueOnReceipt) return brand.deposit.due;
  return model.dueDate ? formatLongDate(model.dueDate) : null;
}

export async function renderDocumentPdf(
  model: PdfDocumentModel,
  options: { payment: PaymentDetails | null; now?: Date }
): Promise<Uint8Array> {
  const isInvoice = model.type !== "QUOTE";
  if (isInvoice && !options.payment) throw new PdfError("Invoices need the bank details");
  const brand = brandingFor(model.business);
  const primary = hex(brand.colours.primary);
  const dark = hex(brand.colours.dark);
  const title = DOCUMENT_TITLES[model.type];

  // updateMetadata: false, so the library never writes its own name in.
  const doc = await PDFDocument.create({ updateMetadata: false });
  doc.registerFontkit(fontkit);
  const [regular, bold, heading] = await Promise.all([
    loadAsset("fonts", brand.fonts.regular).then((b) => doc.embedFont(b, { subset: true })),
    loadAsset("fonts", brand.fonts.bold).then((b) => doc.embedFont(b, { subset: true })),
    loadAsset("fonts", brand.fonts.heading).then((b) => doc.embedFont(b, { subset: true })),
  ]);
  const logo: PDFImage | null = brand.logo ? await doc.embedPng(await loadAsset("logos", brand.logo)) : null;

  const now = options.now ?? new Date();
  doc.setTitle(`${title} ${model.number}`);
  doc.setAuthor(brand.name);
  doc.setSubject(`${title} ${model.number} from ${brand.name}`);
  doc.setCreator(brand.name);
  doc.setProducer(brand.name);
  doc.setKeywords([title, model.number]);
  doc.setLanguage("en-GB");
  doc.setCreationDate(now);
  doc.setModificationDate(now);

  const L = new Layout(doc, { regular, bold, heading }, brand, title, model.number);

  // --- Header: logo or name on the left, title and number on the right.
  const top = L.y;
  const titleWidth = heading.widthOfTextAtSize(title, 22);
  if (logo) {
    const h = brand.logoHeight;
    L.page.drawImage(logo, { x: MARGIN, y: top - h, width: (logo.width / logo.height) * h, height: h });
  } else {
    // The name as a heading, made smaller if it would run into the title.
    const room = CONTENT_RIGHT - MARGIN - titleWidth - 28;
    const size = Math.min(18, (18 * room) / heading.widthOfTextAtSize(brand.name, 18));
    L.text(brand.name, MARGIN, top - 19, { font: heading, size, colour: primary });
  }
  L.textRight(title, CONTENT_RIGHT, top - 20, { font: heading, size: 22, colour: primary });
  L.textRight(model.number, CONTENT_RIGHT, top - 38, { font: bold, size: 12 });
  L.y = top - 52;
  L.page.drawRectangle({ x: MARGIN, y: L.y - 3, width: CONTENT_RIGHT - MARGIN, height: 3, color: hex(brand.colours.accent) });
  L.y -= 18;

  // --- From (left) and the document's details (right).
  const detailsTop = L.y;
  const fromLines = [
    ...(brand.legalLine.trim() ? [brand.legalLine.trim()] : []),
    ...brand.addressLines,
    brand.email,
    brand.website,
  ];
  L.text(brand.name, MARGIN, L.y - 10, { font: bold, size: 10.5, colour: dark });
  L.y -= 16;
  for (const line of fromLines) {
    for (const part of wrap(line, regular, 9.5, 240)) {
      L.text(part, MARGIN, L.y - 9.5, { colour: MUTED });
      L.y -= 12.5;
    }
  }
  const fromBottom = L.y;

  const due = dueText(model, brand);
  const details: [string, string][] = [
    [isInvoice ? "Invoice number" : "Quote number", model.number],
    ["Date of issue", formatLongDate(model.issueDate)],
    ...(model.type === "QUOTE" && model.validUntil ? ([["Valid until", formatLongDate(model.validUntil)]] as [string, string][]) : []),
    ...(due ? ([["Due", due]] as [string, string][]) : []),
    ...(isInvoice ? ([["Payment reference", model.number]] as [string, string][]) : []),
    ...(model.status === "PAID" && model.paidOn ? ([["Paid", formatLongDate(model.paidOn)]] as [string, string][]) : []),
  ];
  let dy = detailsTop;
  const labelX = 330;
  for (const [label, value] of details) {
    L.text(label, labelX, dy - 10, { font: bold, size: 9.5, colour: dark });
    L.textRight(value, CONTENT_RIGHT, dy - 10, { size: 9.5 });
    dy -= 16;
  }
  L.y = Math.min(fromBottom, dy) - 14;

  // --- Who it is for.
  L.rule(L.y);
  L.y -= 16;
  L.text(isInvoice ? "Bill to" : "Prepared for", MARGIN, L.y - 9, { font: bold, size: 9, colour: dark });
  L.y -= 15;
  L.paragraph(model.client.name, MARGIN, 300, { font: bold, size: 10.5 });
  for (const part of [model.client.businessName, model.client.address, model.client.email]) {
    if (part) L.paragraph(part, MARGIN, 300, { colour: MUTED });
  }
  if (model.client.targetAreas) {
    L.y -= 4;
    L.paragraph(`Target areas: ${model.client.targetAreas}`, MARGIN, CONTENT_RIGHT - MARGIN);
  }

  // --- A void document says so plainly (a paid one says so in its details).
  if (model.status === "VOID") {
    L.y -= 10;
    L.need(30);
    L.page.drawRectangle({ x: MARGIN, y: L.y - 24, width: CONTENT_RIGHT - MARGIN, height: 24, borderColor: INK, borderWidth: 1.2 });
    L.text(`VOID: this ${isInvoice ? "invoice" : "quote"} has been cancelled and is not payable.`, MARGIN + 10, L.y - 16, { font: bold, size: 10 });
    L.y -= 24;
  }

  // --- Lines.
  const qtyRight = 430;
  const descWidth = 300;
  L.y -= 14;
  L.need(60);
  const tableHeader = () => {
    L.page.drawRectangle({ x: MARGIN, y: L.y - 22, width: CONTENT_RIGHT - MARGIN, height: 22, color: hex(brand.colours.tint) });
    L.text("Description", MARGIN + 8, L.y - 15, { font: bold, size: 9.5, colour: dark });
    L.textRight("Quantity", qtyRight, L.y - 15, { font: bold, size: 9.5, colour: dark });
    L.textRight("Amount", CONTENT_RIGHT - 8, L.y - 15, { font: bold, size: 9.5, colour: dark });
    L.y -= 22;
  };
  tableHeader();
  for (const line of model.lines) {
    const parts = wrap(line.label, regular, 10, descWidth);
    const height = parts.length * 14 + 10;
    const pagesBefore = L.pages.length;
    L.need(height);
    // Lines carried onto a new page get the column headings again.
    if (L.pages.length !== pagesBefore) tableHeader();
    const rowTop = L.y;
    parts.forEach((part, i) => L.text(part, MARGIN + 8, rowTop - 16 - i * 14, { size: 10 }));
    if (line.quantity !== null) L.textRight(QTY.format(line.quantity), qtyRight, rowTop - 16, { size: 10 });
    L.textRight(formatPence(line.amountPence), CONTENT_RIGHT - 8, rowTop - 16, { size: 10 });
    L.y = rowTop - height;
    L.rule(L.y);
  }

  // --- Totals.
  const totalsLabelX = 210;
  const totalsLabelWidth = 250;
  const totalRow = (label: string, value: string, strong = false) => {
    const size = strong ? 12 : 10;
    const font = strong ? bold : regular;
    const parts = wrap(label, font, size, totalsLabelWidth);
    const height = parts.length * (size + 4) + 6;
    L.need(height);
    const rowTop = L.y;
    parts.forEach((part, i) => L.text(part, totalsLabelX, rowTop - size - 4 - i * (size + 4), { font, size }));
    L.textRight(value, CONTENT_RIGHT - 8, rowTop - size - 4, { font, size });
    L.y = rowTop - height;
  };
  L.y -= 8;
  if (model.type === "QUOTE") {
    totalRow("Total", formatPence(model.totalPence), true);
  } else if (model.type === "DEPOSIT") {
    totalRow("Campaign total", formatPence(model.totalPence));
    totalRow(brand.deposit.line, formatPence(model.amountDuePence));
    L.rule(L.y - 2, RULE, 0.75, totalsLabelX, CONTENT_RIGHT);
    L.y -= 6;
    totalRow("Amount due", formatPence(model.amountDuePence), true);
    totalRow(brand.deposit.due, "");
  } else if (model.type === "BALANCE") {
    totalRow("Campaign total", formatPence(model.totalPence));
    for (const d of model.deductions) {
      const label = fillTemplate(brand.balance.lessDeposit, {
        number: d.number,
        paidOn: d.paidOn ? formatLongDate(d.paidOn) : "date not recorded",
      });
      totalRow(label, `-${formatPence(d.amountPence)}`);
    }
    L.rule(L.y - 2, RULE, 0.75, totalsLabelX, CONTENT_RIGHT);
    L.y -= 6;
    totalRow("Balance due", formatPence(model.amountDuePence), true);
    totalRow(model.dueDate ? `${brand.balance.due} (by ${formatLongDate(model.dueDate)})` : brand.balance.due, "");
  } else {
    totalRow("Total", formatPence(model.totalPence));
    L.rule(L.y - 2, RULE, 0.75, totalsLabelX, CONTENT_RIGHT);
    L.y -= 6;
    totalRow("Amount due", formatPence(model.amountDuePence), true);
    if (model.dueDate) totalRow(`Due by ${formatLongDate(model.dueDate)}`, "");
  }
  L.y -= 2;
  L.need(16);
  L.textRight(brand.vatNote, CONTENT_RIGHT - 8, L.y - 9, { size: 9, colour: MUTED });
  L.y -= 16;

  // --- The deposit's booking note.
  if (model.type === "DEPOSIT") {
    const parts = wrap(brand.deposit.booked, bold, 10, CONTENT_RIGHT - MARGIN - 28);
    const height = parts.length * 14 + 16;
    L.y -= 10;
    L.need(height);
    L.page.drawRectangle({ x: MARGIN, y: L.y - height, width: CONTENT_RIGHT - MARGIN, height, color: hex(brand.colours.tint) });
    L.page.drawRectangle({ x: MARGIN, y: L.y - height, width: 3, height, color: primary });
    parts.forEach((part, i) => L.text(part, MARGIN + 16, L.y - 18 - i * 14, { font: bold, size: 10 }));
    L.y -= height;
  }

  // --- Notes.
  if (model.notes) {
    L.heading("Notes");
    L.paragraph(model.notes, MARGIN, CONTENT_RIGHT - MARGIN);
  }

  // --- How to pay (invoices only).
  if (isInvoice && options.payment && model.status !== "VOID") {
    const p = options.payment;
    L.heading("How to pay");
    L.paragraph("By bank transfer to:", MARGIN, 300, { colour: MUTED });
    const rows: [string, string][] = [
      ["Account name", p.accountName],
      ["Sort code", p.sortCode],
      ["Account number", p.accountNumber],
    ];
    for (const [label, value] of rows) {
      L.need(16);
      L.text(label, MARGIN, L.y - 10, { font: bold, size: 10, colour: dark });
      L.text(value, MARGIN + 110, L.y - 10, { size: 10 });
      L.y -= 16;
    }
    L.y -= 4;
    L.paragraph(`Please use ${model.number} as your payment reference.`, MARGIN, CONTENT_RIGHT - MARGIN, { font: bold, size: 10 });
  }

  // --- Terms.
  const terms = isInvoice ? brand.terms.invoice : brand.terms.quote;
  if (terms.length > 0) {
    L.heading("Terms");
    for (const term of terms) {
      const parts = wrap(term, regular, 9.5, CONTENT_RIGHT - MARGIN - 12);
      parts.forEach((part, i) => {
        L.need(14);
        if (i === 0) L.text("-", MARGIN, L.y - 9.5, { colour: MUTED });
        L.text(part, MARGIN + 12, L.y - 9.5, { colour: MUTED });
        L.y -= 13.5;
      });
    }
  }

  // --- Footer on every page.
  const footer = [[brand.name, brand.email, brand.website].join("  |  "), brand.vatNote].join("\n");
  L.pages.forEach((page, i) => {
    page.drawLine({ start: { x: MARGIN, y: FOOTER_TOP - 18 }, end: { x: CONTENT_RIGHT, y: FOOTER_TOP - 18 }, thickness: 0.75, color: RULE });
    const footerLines = wrap(footer, regular, 8, CONTENT_RIGHT - MARGIN - 70);
    footerLines.forEach((line, j) =>
      page.drawText(line, { x: MARGIN, y: FOOTER_TOP - 32 - j * 11, size: 8, font: regular, color: MUTED })
    );
    const label = `Page ${i + 1} of ${L.pages.length}`;
    page.drawText(label, {
      x: CONTENT_RIGHT - regular.widthOfTextAtSize(label, 8),
      y: FOOTER_TOP - 32,
      size: 8,
      font: regular,
      color: MUTED,
    });
  });

  return doc.save();
}
