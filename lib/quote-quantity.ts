// The quote form's "Approximate quantity (flyers)": a required dropdown of
// ranges, and the same list /api/quote-lead accepts, so the two can't
// disagree. The chosen text is sent as it reads ("1,000 to 2,500") and saved
// as the lead's leafletQuantity. No server imports.

export const QUANTITY_PLACEHOLDER = "Select a range...";

export const QUANTITY_RANGES = [
  "Under 1,000",
  "1,000 to 2,500",
  "2,500 to 5,000",
  "5,000 to 10,000",
  "10,000 to 25,000",
  "25,000+",
  "Not sure yet",
] as const;

export type QuantityRange = (typeof QUANTITY_RANGES)[number];

export const QUANTITY_MESSAGE = "Please choose an approximate quantity from the list";

export function isQuantityRange(value: unknown): value is QuantityRange {
  return typeof value === "string" && (QUANTITY_RANGES as readonly string[]).includes(value);
}
