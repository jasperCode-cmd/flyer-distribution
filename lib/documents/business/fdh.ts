import type { DocumentBranding } from "./types";

// Flyer Distribution Hampshire: how its quotes and invoices look and read.
// Edit the wording here; nothing secret belongs in this file.

export const FDH_DOCUMENTS: DocumentBranding = {
  business: "FDH",
  name: "Flyer Distribution Hampshire",

  // TO CONFIRM: the legal line printed under the business name, for example
  // "Jasper Adams and Daniel Whitby, trading as Flyer Distribution Hampshire".
  // Left empty until confirmed; while it is empty nothing is printed.
  legalLine: "",

  addressLines: ["11 Forest Reach", "St Leonards", "Ringwood", "BH24 2NR"],
  email: "flyerdistributionhampshire@gmail.com",
  website: "www.flyerdistributionhampshire.co.uk",
  fileNamePrefix: "Flyer-Distribution-Hampshire",

  // The website's blue and yellow.
  colours: {
    primary: "#004AAC",
    dark: "#1C398E",
    accent: "#FDC700",
    tint: "#EFF6FF",
  },

  // The website's fonts: Atkinson Hyperlegible Next for text, Schibsted
  // Grotesk for headings.
  fonts: {
    regular: "AtkinsonHyperlegibleNext-Regular.ttf",
    bold: "AtkinsonHyperlegibleNext-Bold.ttf",
    heading: "SchibstedGrotesk-Bold.ttf",
  },

  logo: "fdh-logo.png",
  logoHeight: 30,

  quoteValidDays: 30,
  balanceDueDays: 7,
  fullInvoiceDueDays: 7,

  vatNote: "Not VAT registered",

  terms: {
    quote: [
      "This quote is valid for 30 days from the date of issue.",
      "To go ahead, just reply to this email.",
      "50% deposit to book, balance on completion.",
      "The deposit is non-refundable once printing has been ordered or distribution has been scheduled.",
    ],
    invoice: [
      "The deposit is non-refundable once printing has been ordered or distribution has been scheduled.",
    ],
  },

  deposit: {
    line: "50% deposit to book your campaign",
    due: "Due on receipt",
    booked: "Your campaign is booked and scheduled once this deposit is received.",
  },
  balance: {
    lessDeposit: "Less deposit received, {number} (paid {paidOn})",
    due: "Payable within 7 days",
  },

  emails: {
    quote: {
      subject: "Your quote {number} from Flyer Distribution Hampshire",
      body:
        "Hi {firstName},\n\nThank you for your enquiry. Please find attached your quote {number} for {amount}, valid until {validUntil}.\n\nTo go ahead, just reply to this email.\n",
    },
    deposit: {
      subject: "Deposit invoice {number} from Flyer Distribution Hampshire",
      body:
        "Hi {firstName},\n\nThank you for booking with us. Please find attached deposit invoice {number} for {amount}, {dueText}. Your campaign is booked and scheduled once the deposit is received.\n\nPlease use {number} as your payment reference.\n",
    },
    balance: {
      subject: "Invoice {number} from Flyer Distribution Hampshire",
      body:
        "Hi {firstName},\n\nThank you for choosing us for your campaign. Please find attached invoice {number} for the balance of {amount}, {dueText}.\n\nPlease use {number} as your payment reference.\n",
    },
    full: {
      subject: "Invoice {number} from Flyer Distribution Hampshire",
      body:
        "Hi {firstName},\n\nThank you for choosing us for your campaign. Please find attached invoice {number} for {amount}, {dueText}.\n\nPlease use {number} as your payment reference.\n",
    },
  },
};
