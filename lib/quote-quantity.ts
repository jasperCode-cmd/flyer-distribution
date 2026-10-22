// The quote form's "Approximate quantity (flyers)": a whole number of flyers
// typed in, read the same way in the browser and in /api/quote-lead. Accepts
// 2000, 2,000, 2 000 and 2k (or 2.5k), between 100 and 1,000,000. Also the
// rough hours of distribution shown under the field (display only, never
// sent). No server imports.

export const MIN_FLYERS = 100;
export const MAX_FLYERS = 1_000_000;
export const QUANTITY_MESSAGE = "Please enter a number of flyers, for example 2,000";
// The distribution rate behind the estimate under the field.
export const LEAFLETS_PER_HOUR = 100;

// The number of flyers, or null if it isn't one we accept.
export function parseFlyerQuantity(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  // Spaces (including the narrow and non-breaking kinds) and commas group thousands.
  const text = String(value).trim().replace(/[\s  ,]/g, "");
  let count: number;
  const k = /^(\d+(?:\.\d+)?)k$/i.exec(text);
  if (k) count = Math.round(Number(k[1]) * 1000);
  else if (/^\d+$/.test(text)) count = Number(text);
  else return null;
  return Number.isSafeInteger(count) && count >= MIN_FLYERS && count <= MAX_FLYERS ? count : null;
}

// "Approximately 11 hours of distribution" for what was typed, rounded up to
// a whole hour, or null while it isn't a quantity we accept.
export function distributionEstimate(value: unknown): string | null {
  const flyers = parseFlyerQuantity(value);
  if (flyers === null) return null;
  const hours = Math.ceil(flyers / LEAFLETS_PER_HOUR);
  const shown = String(hours).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `Approximately ${shown} ${hours === 1 ? "hour" : "hours"} of distribution`;
}
