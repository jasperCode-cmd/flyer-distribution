// Flyer Distribution Hampshire's business address, written once here and
// used wherever it appears: the site footer, the business and job posting
// structured data, the privacy policy, the automatic emails' footer and the
// CRM's FDH quotes and invoices. public/llms.txt is a plain file, so a test
// checks it carries the same address. Leaflet Distribution Bournemouth keeps
// its own address (lib/documents/business/ldb.ts). No imports, so anything
// can use it, in the browser or on the server.

// One line each, as in the site footer and the email footers.
export const FDH_ADDRESS_LINES = ["Flat 11, Forest Reach", "184 Ringwood Road", "St. Leonards", "Ringwood", "BH24 2NR"] as const;

// On a single line, as in the privacy policy, llms.txt and the PDFs:
// "Flat 11, Forest Reach, 184 Ringwood Road, St. Leonards, Ringwood, BH24 2NR".
export const FDH_ADDRESS = FDH_ADDRESS_LINES.join(", ");

// As a schema.org PostalAddress, for the structured data.
export const FDH_POSTAL_ADDRESS = {
  "@type": "PostalAddress",
  streetAddress: FDH_ADDRESS_LINES.slice(0, 3).join(", "),
  addressLocality: FDH_ADDRESS_LINES[3],
  addressRegion: "Dorset",
  postalCode: FDH_ADDRESS_LINES[4],
  addressCountry: "GB",
} as const;
