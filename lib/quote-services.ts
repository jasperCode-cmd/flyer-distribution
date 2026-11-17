// The quote form's four services: the value each sends as "service" (the
// same words the old dropdown sent, which /api/quote-lead and the thank-you
// email go by), the ?service= word a link uses to choose it, the card's
// title and line, and the heading over its questions. Then the kinds of
// leaflet distribution, which a link can also choose (?service=b2b chooses
// Leaflet Distribution, B2B). No server imports.

export type QuoteService = {
  value: "Leaflet Distribution" | "Leaflet Printing" | "Web Design & SEO" | "Screen Hire";
  param: "leaflet" | "printing" | "web" | "screen";
  title: string;
  line: string;
  heading: string;
};

export const QUOTE_SERVICES: readonly QuoteService[] = [
  {
    value: "Leaflet Distribution",
    param: "leaflet",
    title: "Leaflet Distribution",
    line: "Door to door, GPS tracked. We can design and print it too.",
    heading: "About your campaign",
  },
  {
    value: "Leaflet Printing",
    param: "printing",
    title: "Leaflet Printing",
    line: "Printed and sent to you",
    heading: "About your print job",
  },
  {
    value: "Web Design & SEO",
    param: "web",
    title: "Web Design & SEO",
    line: "A site that brings in enquiries",
    heading: "About your business",
  },
  {
    value: "Screen Hire",
    param: "screen",
    title: "Screen Hire",
    line: "Mobile screen trailer for events",
    heading: "About your event",
  },
];

// "What kind of leaflet distribution?": the value each sends as
// "distribution-type", the ?service= word that chooses it, its card, and the
// label and placeholder the areas field takes with it (the field's name,
// "areas-required", never changes). Door to door is the default.
export type DistributionType = {
  value: "Door to door" | "Public notice leafleting" | "Hand-to-hand" | "B2B";
  param: "public-notice" | "hand-to-hand" | "b2b" | null;
  line: string;
  areasLabel: string;
  areasPlaceholder: string;
};

export const DISTRIBUTION_TYPES: readonly DistributionType[] = [
  {
    value: "Door to door",
    param: null,
    line: "Through letterboxes in your chosen areas",
    areasLabel: "Areas required / target postcodes",
    areasPlaceholder: "e.g. Southampton SO15, SO16",
  },
  {
    value: "Public notice leafleting",
    param: "public-notice",
    line: "Road closures, works and consultations",
    areasLabel: "Where are the works?",
    areasPlaceholder: "e.g. The roads affected, or the postcodes to cover",
  },
  {
    value: "Hand-to-hand",
    param: "hand-to-hand",
    line: "Handed out at events and busy spots",
    areasLabel: "Where and when?",
    areasPlaceholder: "e.g. Event name, location and date",
  },
  {
    value: "B2B",
    param: "b2b",
    line: "Delivered to local businesses",
    areasLabel: "Target areas or types of business",
    areasPlaceholder: "e.g. Offices and shops in Southampton city centre",
  },
];

export const DEFAULT_DISTRIBUTION_TYPE: DistributionType["value"] = "Door to door";

const word = (param: string | null | undefined) => (param ?? "").trim().toLowerCase();

// The kind of distribution a link asks for (/quote?service=b2b), or "" when it names none.
export function distributionTypeFromParam(param: string | null | undefined): DistributionType["value"] | "" {
  const w = word(param);
  return DISTRIBUTION_TYPES.find((t) => t.param !== null && t.param === w)?.value ?? "";
}

// The service a link asks for (/quote?service=web), or "" when it names none we
// offer. A kind of distribution (?service=public-notice) asks for Leaflet Distribution.
export function serviceFromParam(param: string | null | undefined): QuoteService["value"] | "" {
  if (distributionTypeFromParam(param)) return "Leaflet Distribution";
  return QUOTE_SERVICES.find((s) => s.param === word(param))?.value ?? "";
}
