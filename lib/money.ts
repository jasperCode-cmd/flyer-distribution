// Money for the Profit calculator. New values are whole pence (integers);
// the Lead's existing deal value and amount paid stay Decimal pounds in the
// database and are converted here exactly, from their decimal text, never
// through floating point.

export const MAX_PENCE = 100_000_000; // £1,000,000

type DecimalLike = { toFixed(digits: number): string };

// "1234.5" or a Prisma Decimal -> 123450. Null stays null.
export function decimalToPence(value: DecimalLike | string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const text =
    typeof value === "string" ? value.trim() : typeof value === "number" ? value.toFixed(2) : value.toFixed(2);
  if (text === "") return null;
  const match = /^(-?)(\d+)(?:\.(\d{1,2})\d*)?$/.exec(text);
  if (!match) return null;
  const pence = Number(match[2]) * 100 + Number((match[3] ?? "").padEnd(2, "0"));
  return match[1] === "-" ? -pence : pence;
}

// What someone types as an amount in pounds: "150", "1,250.5", "£99.99".
// Null for anything else, a negative, more than 2 decimal places, or over the cap.
export function parsePoundsToPence(input: unknown): number | null {
  if (typeof input === "number") input = String(input);
  if (typeof input !== "string") return null;
  const text = input.trim().replace(/^£/, "").replace(/,/g, "").trim();
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) return null;
  const pence = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return pence <= MAX_PENCE ? pence : null;
}

// For filling a form back in: 12345 -> "123.45".
export function penceToInput(pence: number | null | undefined): string {
  if (pence === null || pence === undefined) return "";
  return (pence / 100).toFixed(2);
}

const GBP = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// "£1,234.56", "-£120.00", or "-" when there is no value.
export function formatPence(pence: number | null | undefined): string {
  if (pence === null || pence === undefined) return "-";
  return GBP.format(pence / 100).replace("−", "-");
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  return `${value.toFixed(1)}%`;
}
