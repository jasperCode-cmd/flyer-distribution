import type { DocumentBranding } from "./types";

// Leaflet Distribution Bournemouth: how its quotes and invoices look and
// read. Edit the wording here; nothing secret belongs in this file. Nothing
// about the other business may appear here or on these documents.

export const LDB_DOCUMENTS: DocumentBranding = {
  business: "LDB",
  name: "Leaflet Distribution Bournemouth",

  // TO CONFIRM: the legal line printed under the business name, for example
  // "Jane Smith, trading as Leaflet Distribution Bournemouth". Left empty
  // until confirmed; while it is empty nothing is printed.
  legalLine: "",

  addressLines: ["Office 21", "18 Christchurch Road", "Bournemouth", "BH1 3NE"],
  email: "team@leafletdistributionbournemouth.co.uk",
  website: "www.leafletdistributionbournemouth.co.uk",
  fileNamePrefix: "Leaflet-Distribution-Bournemouth",

  colours: {
    primary: "#487531",
    dark: "#1D3215",
    accent: "#8FB135",
    tint: "#F6F5F2",
  },

  // The website's font, Geist.
  fonts: {
    regular: "Geist-Regular.ttf",
    bold: "Geist-SemiBold.ttf",
    heading: "Geist-Bold.ttf",
  },

  // No logo yet: the name is printed as a text heading in the green above.
  // To use a logo, put a PNG in lib/documents/assets/logos and name it here.
  logo: null,
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
      subject: "Your quote {number} from Leaflet Distribution Bournemouth",
      body:
        "Hi {firstName},\n\nThank you for your enquiry. Please find attached your quote {number} for {amount}, valid until {validUntil}.\n\nTo go ahead, just reply to this email.\n",
    },
    deposit: {
      subject: "Deposit invoice {number} from Leaflet Distribution Bournemouth",
      body:
        "Hi {firstName},\n\nThank you for booking with us. Please find attached deposit invoice {number} for {amount}, {dueText}. Your campaign is booked and scheduled once the deposit is received.\n\nPlease use {number} as your payment reference.\n",
    },
    balance: {
      subject: "Invoice {number} from Leaflet Distribution Bournemouth",
      body:
        "Hi {firstName},\n\nThank you for choosing us for your campaign. Please find attached invoice {number} for the balance of {amount}, {dueText}.\n\nPlease use {number} as your payment reference.\n",
    },
    full: {
      subject: "Invoice {number} from Leaflet Distribution Bournemouth",
      body:
        "Hi {firstName},\n\nThank you for choosing us for your campaign. Please find attached invoice {number} for {amount}, {dueText}.\n\nPlease use {number} as your payment reference.\n",
    },
  },
};
