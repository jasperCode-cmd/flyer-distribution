// The quote form's three services: the value each sends as "service" (the
// same words the old dropdown sent, which /api/quote-lead and the thank-you
// email go by), the ?service= word a link uses to choose it, the card's
// title and line, and the heading over its questions. No server imports.

export type QuoteService = {
  value: "Leaflet Distribution" | "Web Design & SEO" | "Screen Hire";
  param: "leaflet" | "web" | "screen";
  title: string;
  line: string;
  heading: string;
};

export const QUOTE_SERVICES: readonly QuoteService[] = [
  {
    value: "Leaflet Distribution",
    param: "leaflet",
    title: "Leaflet Distribution",
    line: "Door to door, GPS tracked",
    heading: "About your campaign",
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

// The service a link asks for (/quote?service=web), or "" when it names none we offer.
export function serviceFromParam(param: string | null | undefined): QuoteService["value"] | "" {
  const word = (param ?? "").trim().toLowerCase();
  return QUOTE_SERVICES.find((s) => s.param === word)?.value ?? "";
}
