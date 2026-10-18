import type { Business } from "@/lib/business";
import { FDH_DOCUMENTS } from "./business/fdh";
import { LDB_DOCUMENTS } from "./business/ldb";
import type { DocumentBranding } from "./business/types";

export type { DocumentBranding };

// A document is printed and sent as the business of its lead, copied onto
// the document when it is made.
export function brandingFor(business: Business): DocumentBranding {
  return business === "LDB" ? LDB_DOCUMENTS : FDH_DOCUMENTS;
}

// "Leaflet-Distribution-Bournemouth-INV-1106.pdf".
export function documentFileName(business: Business, number: string): string {
  return `${brandingFor(business).fileNamePrefix}-${number}.pdf`.replace(/[^A-Za-z0-9._-]/g, "-");
}
