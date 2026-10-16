import { isExpenseBusiness, type ExpenseBusiness } from "./business";
import { parsePoundsToPence } from "./money";

// Business expenses and retainers for the Profit page. Pure and client-safe.
//
// Dates are calendar dates, not moments in time. A one-off expense's date is
// the UK calendar day it was for ("2026-08-01"), and months are "2026-08".
// In the database both are DATE columns (a month is stored as its 1st), which
// Prisma hands over as midnight UTC on that day, so they are always read by
// their UTC date parts and never shifted by a time zone.

export const EXPENSE_CATEGORIES = ["OFFICE", "SOFTWARE", "VEHICLE", "MARKETING", "EQUIPMENT", "OTHER"] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  OFFICE: "Office",
  SOFTWARE: "Software",
  VEHICLE: "Vehicle",
  MARKETING: "Marketing",
  EQUIPMENT: "Equipment",
  OTHER: "Other",
};

export type ExpenseKind = "ONE_OFF" | "MONTHLY";

export type ExpenseRecord = {
  id: string;
  label: string;
  category: ExpenseCategory;
  amountPence: number;
  kind: ExpenseKind;
  // One-off only: the UK calendar day, "YYYY-MM-DD".
  date: string | null;
  // Monthly only: "YYYY-MM"; no endMonth means it carries on every month.
  startMonth: string | null;
  endMonth: string | null;
  note: string | null;
  createdAt: string;
  // Missing means shared, as every expense from before businesses existed is.
  business?: ExpenseBusiness;
};

export const MAX_EXPENSE_LABEL = 100;
export const MAX_EXPENSE_NOTE = 500;

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

// "2026-08-01" -> midnight UTC on that day, ready for a DATE column.
export function dateInputToDb(value: string): Date | null {
  const m = DATE_RE.exec(value);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (y < 2000 || y > 2100) return null;
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCMonth() === mo - 1 && date.getUTCDate() === d ? date : null;
}

// "2026-08" -> the 1st of that month, midnight UTC.
export function monthInputToDb(value: string): Date | null {
  const m = MONTH_RE.exec(value);
  if (!m) return null;
  const y = Number(m[1]);
  if (y < 2000 || y > 2100) return null;
  return new Date(Date.UTC(y, Number(m[2]) - 1, 1));
}

export function dbDateToInput(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

export function dbMonthToInput(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(0, 7) : null;
}

// Today's UK calendar day, "YYYY-MM-DD". Just after midnight on the 1st in
// UK time it is already the 1st, even while UTC is still on the 31st.
export function ukToday(now: Date): string {
  return now.toLocaleDateString("en-CA", { timeZone: "Europe/London" });
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export type ExpenseData = {
  label: string;
  category: ExpenseCategory;
  amountPence: number;
  kind: ExpenseKind;
  date: Date | null;
  startMonth: Date | null;
  endMonth: Date | null;
  note: string | null;
  business: ExpenseBusiness;
};

export function validateExpenseInput(raw: unknown): { ok: true; data: ExpenseData } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Invalid request." };
  const body = raw as Record<string, unknown>;

  const label = text(body.label);
  if (!label) return { ok: false, error: "Give the expense a label, for example Office rent." };
  if (label.length > MAX_EXPENSE_LABEL) return { ok: false, error: `The label can be up to ${MAX_EXPENSE_LABEL} characters.` };

  const category = body.category as ExpenseCategory;
  if (!EXPENSE_CATEGORIES.includes(category)) return { ok: false, error: "Choose a category." };

  const amountPence = parsePoundsToPence(body.amount);
  if (amountPence === null || amountPence === 0) {
    return { ok: false, error: "Enter an amount in pounds, for example 45 or 45.99." };
  }

  const note = text(body.note);
  if (note.length > MAX_EXPENSE_NOTE) return { ok: false, error: `The note can be up to ${MAX_EXPENSE_NOTE} characters.` };

  const business = body.business === undefined ? "SHARED" : body.business;
  if (!isExpenseBusiness(business)) return { ok: false, error: "Choose which business the expense is for." };

  const base = { label, category, amountPence, note: note || null, business };
  if (body.kind === "ONE_OFF") {
    const date = dateInputToDb(text(body.date));
    if (!date) return { ok: false, error: "Choose the date of the expense." };
    return { ok: true, data: { ...base, kind: "ONE_OFF", date, startMonth: null, endMonth: null } };
  }
  if (body.kind === "MONTHLY") {
    const startMonth = monthInputToDb(text(body.startMonth));
    if (!startMonth) return { ok: false, error: "Choose the month it starts." };
    const endText = text(body.endMonth);
    const endMonth = endText ? monthInputToDb(endText) : null;
    if (endText && !endMonth) return { ok: false, error: "Choose a valid end month, or leave it empty for ongoing." };
    if (endMonth && endMonth < startMonth) return { ok: false, error: "The end month can't be before the start month." };
    return { ok: true, data: { ...base, kind: "MONTHLY", date: null, startMonth, endMonth } };
  }
  return { ok: false, error: "Choose one-off or every month." };
}

// The retainer settings on a job. Turning it off keeps the stored amount and
// months (so turning it back on restores them) but stops all its revenue.
export type RetainerData =
  | { isRetainer: false }
  | { isRetainer: true; retainerMonthlyPence: number; retainerStart: Date; retainerEnd: Date | null };

export function validateRetainerInput(raw: unknown): { ok: true; data: RetainerData } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Invalid request." };
  const body = raw as Record<string, unknown>;
  if (body.isRetainer === false) return { ok: true, data: { isRetainer: false } };
  if (body.isRetainer !== true) return { ok: false, error: "Invalid request." };

  const monthly = parsePoundsToPence(body.monthly);
  if (monthly === null || monthly === 0) return { ok: false, error: "Enter the monthly amount in pounds, for example 250." };
  const start = monthInputToDb(text(body.startMonth));
  if (!start) return { ok: false, error: "Choose the month the retainer starts." };
  const endText = text(body.endMonth);
  const end = endText ? monthInputToDb(endText) : null;
  if (endText && !end) return { ok: false, error: "Choose a valid end month, or leave it empty for ongoing." };
  if (end && end < start) return { ok: false, error: "The end month can't be before the start month." };
  return { ok: true, data: { isRetainer: true, retainerMonthlyPence: monthly, retainerStart: start, retainerEnd: end } };
}
