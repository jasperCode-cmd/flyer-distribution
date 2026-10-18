import type { Business } from "@/lib/business";

// What a business's quotes and invoices are printed and emailed with. Each
// business has its own file (fdh.ts, ldb.ts) holding these as plain
// constants, nothing secret: bank details never go here, they come from the
// environment (see lib/documents/bank.ts).

export type DocumentBranding = {
  business: Business;
  // The trading name, printed on every document and used in emails.
  name: string;
  // Optional legal line printed under the name, for example "Jane Smith,
  // trading as ...". Empty means it is left off.
  legalLine: string;
  addressLines: string[];
  email: string;
  // Without "https://", as printed.
  website: string;
  // The start of every PDF file name, before the document number.
  fileNamePrefix: string;

  colours: {
    // Headings, the document title and the table header text.
    primary: string;
    // Body text that is not plain black, such as labels.
    dark: string;
    // A thin decorative rule only, never text: it may not show in black and
    // white printing.
    accent: string;
    // Light background tint for the table header and boxes.
    tint: string;
  };

  // Font files in lib/documents/assets/fonts.
  fonts: { regular: string; bold: string; heading: string };

  // A logo file in lib/documents/assets/logos, drawn at the top left at
  // logoHeight points tall. Null prints the name as a text heading instead.
  logo: string | null;
  logoHeight: number;

  // Days a quote is valid for, and days to pay a balance or full invoice.
  // Keep the terms text below in step with these (a test checks it).
  quoteValidDays: number;
  balanceDueDays: number;
  fullInvoiceDueDays: number;

  // Every document says this; there is no VAT anywhere.
  vatNote: string;

  terms: {
    // Printed at the foot of every quote.
    quote: string[];
    // Printed at the foot of every invoice.
    invoice: string[];
  };

  // Wording printed on deposit and balance invoices.
  deposit: { line: string; due: string; booked: string };
  balance: { lessDeposit: string; due: string };

  // The email each document is sent with, before the sign-off. {number},
  // {amount}, {firstName}, {validUntil} and {dueText} are filled in.
  emails: Record<"quote" | "deposit" | "balance" | "full", { subject: string; body: string }>;
};
