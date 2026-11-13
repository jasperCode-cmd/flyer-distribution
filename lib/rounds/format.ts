// How rounds' figures read, in the CRM and on a client's report. Pure.

// "850 m" or "4.2 km".
export function formatDistance(metres: number | null | undefined): string {
  if (metres === null || metres === undefined || !Number.isFinite(metres)) return "Not traced yet";
  if (metres < 1000) return `${Math.round(metres)} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}

// Distinct colours for telling rounds apart on a client's map, by order.
export const ROUND_COLOURS = ["#2563EB", "#DB2777", "#059669", "#D97706", "#7C3AED", "#0891B2", "#DC2626", "#4D7C0F"] as const;

export function roundColour(index: number): string {
  return ROUND_COLOURS[index % ROUND_COLOURS.length];
}

const LONG_DATE = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

// "Tuesday 10 November 2026" (a round's date, held as midnight UTC).
export function dateLabel(date: Date): string {
  const parts = Object.fromEntries(LONG_DATE.formatToParts(date).map((p) => [p.type, p.value]));
  return `${parts.weekday} ${parts.day} ${parts.month} ${parts.year}`;
}

// "10 Nov 2026" from "2026-11-10".
export function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(d);
}
