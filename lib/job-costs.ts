import { MAX_PENCE, parsePoundsToPence } from "./money";
import { COST_CATEGORIES, MAX_LEAFLETS, perThousandAmountPence, type CostCategory, type PayType } from "./profit";

// Checks a cost line sent from the Profit page and turns it into what is
// stored. Amounts arrive as pounds text and are stored as whole pence. A
// per-1,000 distributor amount is always worked out here from the rate and
// the leaflet count; an amount sent alongside them is ignored.

export const MAX_LABEL = 100;
export const MAX_NOTE = 500;

export type CostData = {
  category: CostCategory;
  distributorId: string | null;
  payType: PayType | null;
  ratePence: number | null;
  leafletCount: number | null;
  amountPence: number;
  label: string | null;
  note: string | null;
};

type Result = { ok: true; data: CostData } | { ok: false; error: string };

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function wholeNumber(value: unknown): number | null {
  const raw = typeof value === "number" ? String(value) : text(value).replace(/,/g, "");
  if (!/^\d+$/.test(raw)) return null;
  return Number(raw);
}

export function validateCostInput(
  raw: unknown,
  options: { fixedCategory?: CostCategory; keepDeletedDistributor?: boolean } = {}
): Result {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Invalid request." };
  const body = raw as Record<string, unknown>;

  const category = options.fixedCategory ?? (body.category as CostCategory);
  if (!COST_CATEGORIES.includes(category)) return { ok: false, error: "Choose what the cost is for." };

  const label = text(body.label);
  const note = text(body.note);
  if (label.length > MAX_LABEL) return { ok: false, error: `The label can be up to ${MAX_LABEL} characters.` };
  if (note.length > MAX_NOTE) return { ok: false, error: `The note can be up to ${MAX_NOTE} characters.` };

  const distributorId = text(body.distributorId) || null;
  const base = { category, label: null, note: note || null, distributorId: null, payType: null, ratePence: null, leafletCount: null };

  function amount(): number | null {
    return parsePoundsToPence(body.amount);
  }
  const badAmount = { ok: false as const, error: "Enter an amount in pounds, for example 120 or 120.50." };

  if (category === "DISTRIBUTOR") {
    // A line whose distributor was deleted can still be edited; it just
    // keeps no distributor.
    if (!distributorId && !options.keepDeletedDistributor) return { ok: false, error: "Choose a distributor." };
    const payType = body.payType;
    if (payType === "FLAT") {
      const amountPence = amount();
      if (amountPence === null) return badAmount;
      return { ok: true, data: { ...base, distributorId, payType, amountPence } };
    }
    if (payType === "PER_THOUSAND") {
      const ratePence = parsePoundsToPence(body.rate);
      if (ratePence === null) return { ok: false, error: "Enter the rate per 1,000 leaflets in pounds, for example 45." };
      const leafletCount = wholeNumber(body.leafletCount);
      if (leafletCount === null || leafletCount < 1 || leafletCount > MAX_LEAFLETS) {
        return { ok: false, error: "Enter how many leaflets, as a whole number from 1 to 10,000,000." };
      }
      const amountPence = perThousandAmountPence(ratePence, leafletCount);
      if (amountPence > MAX_PENCE) return { ok: false, error: "That comes to more than £1,000,000." };
      return { ok: true, data: { ...base, distributorId, payType, ratePence, leafletCount, amountPence } };
    }
    return { ok: false, error: "Choose a set amount or a rate per 1,000 leaflets." };
  }

  const amountPence = amount();
  if (amountPence === null) return badAmount;

  if (category === "FUEL") {
    return { ok: true, data: { ...base, distributorId, amountPence } };
  }
  if (category === "ADDITIONAL" && !label) {
    return { ok: false, error: "Give the additional cost a label, for example Parking." };
  }
  return { ok: true, data: { ...base, label: label || null, amountPence } };
}
