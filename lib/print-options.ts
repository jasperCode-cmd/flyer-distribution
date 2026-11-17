// What can be printed, and how: the one list the print builder on
// /leaflet-printing and the quote form's Leaflet Printing questions both use,
// so a choice made in one is always one the other understands. Also the
// rules that keep a choice valid as it changes, the sentence that describes
// it, and the short URL parameters that carry it to the quote form. No
// server imports.

export type Product = "flyers" | "folded" | "cards" | "custom";
export type Size = "A6" | "A5" | "A4" | "DL";
export type Sides = "double" | "single";
export type PaperType = "silk" | "uncoated" | "gloss";
export type Fold = "half" | "c" | "z" | "cross";
export type CardType = "standard" | "folded";
export type PaperId = "450-silk" | "350-uncoated" | "250-silk" | "350-silk" | "250-uncoated";

export const PRODUCTS: readonly { id: Product; label: string }[] = [
  { id: "flyers", label: "Flyers and leaflets" },
  { id: "folded", label: "Folded leaflets" },
  { id: "cards", label: "Business cards" },
  { id: "custom", label: "Custom-shaped flyers" },
];
export const SIZES: readonly Size[] = ["A6", "A5", "A4", "DL"];
export const SIDES: readonly { id: Sides; label: string }[] = [
  { id: "double", label: "Double-sided" },
  { id: "single", label: "Single-sided" },
];
export const PAPER_TYPES: readonly { id: PaperType; label: string }[] = [
  { id: "silk", label: "Silk" },
  { id: "uncoated", label: "Uncoated" },
  { id: "gloss", label: "Gloss" },
];
export const FOLDS: readonly { id: Fold; label: string }[] = [
  { id: "half", label: "Half fold" },
  { id: "c", label: "C-fold" },
  { id: "z", label: "Z-fold" },
  { id: "cross", label: "Cross fold" },
];
export const CARD_TYPES: readonly { id: CardType; label: string }[] = [
  { id: "standard", label: "Standard" },
  { id: "folded", label: "Folded" },
];
const PAPER_LABELS: Record<PaperId, string> = {
  "450-silk": "450gsm silk",
  "350-uncoated": "350gsm uncoated",
  "250-silk": "250gsm silk",
  "350-silk": "350gsm silk",
  "250-uncoated": "250gsm uncoated",
};

// Paper weights (gsm) by product and paper type.
const WEIGHTS: Record<"flyers" | "folded", Record<PaperType, readonly number[]>> = {
  flyers: { silk: [115, 150, 170, 250, 350, 450], uncoated: [90, 120, 170, 250, 350], gloss: [130] },
  folded: { silk: [115, 150, 170, 250, 350], uncoated: [90, 120, 170, 250, 350], gloss: [130] },
};
const CARD_PAPERS: Record<CardType, readonly PaperId[]> = { standard: ["450-silk", "350-uncoated"], folded: ["350-uncoated"] };
const CUSTOM_PAPERS: readonly PaperId[] = ["250-silk", "350-silk", "250-uncoated", "350-uncoated"];
// Business cards are always this size.
export const CARD_SIZE = "85 x 55mm";

export type PrintSpec =
  | { product: "flyers"; size: Size; sides: Sides; ptype: PaperType; weight: number }
  | { product: "folded"; fold: Fold; size: Size; ptype: PaperType; weight: number }
  | { product: "cards"; card: CardType; paper: PaperId }
  | { product: "custom"; sides: Sides; paper: PaperId };

// Each product's starting choice: flyers A5, double-sided, 250gsm silk; folded C-fold, A5, 250gsm silk.
export function defaultSpec(product: Product = "flyers"): PrintSpec {
  switch (product) {
    case "flyers":
      return { product, size: "A5", sides: "double", ptype: "silk", weight: 250 };
    case "folded":
      return { product, fold: "c", size: "A5", ptype: "silk", weight: 250 };
    case "cards":
      return { product, card: "standard", paper: "450-silk" };
    case "custom":
      return { product, sides: "double", paper: "250-silk" };
  }
}

// The choices each option offers for a spec.
export function sizesFor(spec: PrintSpec): readonly Size[] {
  if (spec.product === "folded" && spec.fold === "cross") return ["A6", "A5", "A4"];
  return spec.product === "flyers" || spec.product === "folded" ? SIZES : [];
}
export function weightsFor(product: "flyers" | "folded", ptype: PaperType): readonly number[] {
  return WEIGHTS[product][ptype];
}
export function papersFor(spec: PrintSpec): readonly { id: PaperId; label: string }[] {
  const ids = spec.product === "cards" ? CARD_PAPERS[spec.card] : spec.product === "custom" ? CUSTOM_PAPERS : [];
  return ids.map((id) => ({ id, label: PAPER_LABELS[id] }));
}
export function weightLabel(weight: number, ptype: PaperType): string {
  return weight === 250 && ptype === "silk" ? "250gsm (recommended)" : `${weight}gsm`;
}

// After a paper type change: the same weight if the new type has it, else 250gsm if it has that, else its lightest.
function weightAfterTypeChange(weight: number, options: readonly number[]): number {
  if (options.includes(weight)) return weight;
  return options.includes(250) ? 250 : options[0];
}
// After any other change: the same weight if it is still offered, else the heaviest one below it, else the lightest.
function nearestWeight(weight: number, options: readonly number[]): number {
  if (options.includes(weight)) return weight;
  const lower = options.filter((w) => w < weight);
  return lower.length ? lower[lower.length - 1] : options[0];
}

export type Change =
  | { product: Product }
  | { size: Size }
  | { sides: Sides }
  | { ptype: PaperType }
  | { weight: number }
  | { fold: Fold }
  | { card: CardType }
  | { paper: PaperId };

// A spec with one choice changed, and anything that change made invalid put right:
// Gloss is 130gsm only; a new paper type keeps the weight if it can (else 250gsm, else
// the lightest); folded leaflets go no heavier than 350gsm (450gsm drops to 350gsm);
// a cross fold has no DL (DL becomes A5); folded business cards are 350gsm uncoated.
export function applyChange(spec: PrintSpec, change: Change): PrintSpec {
  if ("product" in change) {
    if (change.product === spec.product) return spec;
    const next = defaultSpec(change.product);
    // Moving between flyers and folded leaflets keeps the size and paper where it can.
    if ((next.product === "flyers" || next.product === "folded") && (spec.product === "flyers" || spec.product === "folded")) {
      const size = SIZES.includes(spec.size) ? spec.size : next.size;
      const weight = nearestWeight(spec.weight, weightsFor(next.product, spec.ptype));
      return { ...next, size, ptype: spec.ptype, weight } as PrintSpec;
    }
    return next;
  }
  switch (spec.product) {
    case "flyers":
    case "folded": {
      const next = { ...spec } as Extract<PrintSpec, { product: "flyers" | "folded" }>;
      if ("size" in change) next.size = change.size;
      if ("sides" in change && next.product === "flyers") next.sides = change.sides;
      if ("weight" in change) next.weight = change.weight;
      if ("fold" in change && next.product === "folded") next.fold = change.fold;
      if ("ptype" in change) {
        next.ptype = change.ptype;
        next.weight = weightAfterTypeChange(next.weight, weightsFor(next.product, next.ptype));
      }
      // Whatever changed, the size and weight end up ones this product offers.
      if (!sizesFor(next).includes(next.size)) next.size = "A5";
      next.weight = nearestWeight(next.weight, weightsFor(next.product, next.ptype));
      return next;
    }
    case "cards": {
      const next = { ...spec };
      if ("card" in change) next.card = change.card;
      if ("paper" in change) next.paper = change.paper;
      if (!CARD_PAPERS[next.card].includes(next.paper)) next.paper = CARD_PAPERS[next.card][0];
      return next;
    }
    case "custom": {
      const next = { ...spec };
      if ("sides" in change) next.sides = change.sides;
      if ("paper" in change && CUSTOM_PAPERS.includes(change.paper)) next.paper = change.paper;
      return next;
    }
  }
}

// Whether a spec is one this list offers.
export function isValidSpec(spec: PrintSpec): boolean {
  switch (spec.product) {
    case "flyers":
      return SIZES.includes(spec.size) && SIDES.some((s) => s.id === spec.sides) && PAPER_TYPES.some((t) => t.id === spec.ptype) && weightsFor("flyers", spec.ptype).includes(spec.weight);
    case "folded":
      return FOLDS.some((f) => f.id === spec.fold) && sizesFor(spec).includes(spec.size) && PAPER_TYPES.some((t) => t.id === spec.ptype) && weightsFor("folded", spec.ptype).includes(spec.weight);
    case "cards":
      return CARD_TYPES.some((c) => c.id === spec.card) && CARD_PAPERS[spec.card].includes(spec.paper);
    case "custom":
      return SIDES.some((s) => s.id === spec.sides) && CUSTOM_PAPERS.includes(spec.paper);
  }
}

const sidesWord = (sides: Sides) => (sides === "double" ? "double-sided" : "single-sided");
const foldWord = (fold: Fold) => FOLDS.find((f) => f.id === fold)!.label.replace(/^(Half|Cross) fold$/, (m) => m.toLowerCase());

// The choice in one sentence, such as "A5 flyers, double-sided, 250gsm silk".
export function specSummary(spec: PrintSpec): string {
  switch (spec.product) {
    case "flyers":
      return `${spec.size} flyers, ${sidesWord(spec.sides)}, ${spec.weight}gsm ${spec.ptype}`;
    case "folded":
      return `${spec.size} ${foldWord(spec.fold)} leaflets, double-sided, ${spec.weight}gsm ${spec.ptype}`;
    case "cards":
      return `${spec.card === "folded" ? "Folded" : "Standard"} business cards, ${CARD_SIZE}, ${PAPER_LABELS[spec.paper]}`;
    case "custom":
      return `Custom-shaped flyers, ${sidesWord(spec.sides)}, ${PAPER_LABELS[spec.paper]}`;
  }
}

// The quote form's "What would you like printed?" item for each product.
export const QUOTE_ITEM: Record<Product, string> = {
  flyers: "Flyers and leaflets",
  folded: "Folded leaflets",
  cards: "Business cards",
  custom: "Custom-shaped flyers",
};

// The short URL parameters for a spec: item, then only the ones that product uses.
export function specParams(spec: PrintSpec): URLSearchParams {
  const params = new URLSearchParams({ item: spec.product });
  switch (spec.product) {
    case "flyers":
      params.set("size", spec.size);
      params.set("sides", spec.sides);
      params.set("ptype", spec.ptype);
      params.set("weight", String(spec.weight));
      break;
    case "folded":
      params.set("fold", spec.fold);
      params.set("size", spec.size);
      params.set("ptype", spec.ptype);
      params.set("weight", String(spec.weight));
      break;
    case "cards":
      params.set("card", spec.card);
      params.set("paper", spec.paper);
      break;
    case "custom":
      params.set("sides", spec.sides);
      params.set("paper", spec.paper);
      break;
  }
  return params;
}

// The quote link for a spec, choosing Leaflet Printing.
export function quoteHrefFor(spec: PrintSpec): string {
  return `/quote?service=printing&${specParams(spec).toString()}`;
}

// A spec from URL parameters, or null when there is no valid item. Each other
// parameter is used only if it is one this product offers; anything else is
// ignored (the product's default stands), and the result is always valid.
export function specFromParams(params: URLSearchParams): PrintSpec | null {
  const item = params.get("item");
  const product = PRODUCTS.find((p) => p.id === item)?.id;
  if (!product) return null;
  let spec = defaultSpec(product);
  const pick = <T extends string>(key: string, allowed: readonly T[]): T | undefined => {
    const v = params.get(key);
    return v !== null && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;
  };
  const weightParam = params.get("weight");
  const weight = weightParam !== null && /^\d{2,3}$/.test(weightParam) ? Number(weightParam) : undefined;
  if (spec.product === "flyers" || spec.product === "folded") {
    const fold = spec.product === "folded" ? pick("fold", FOLDS.map((f) => f.id)) : undefined;
    if (fold) spec = applyChange(spec, { fold });
    const ptype = pick("ptype", PAPER_TYPES.map((t) => t.id));
    if (ptype) spec = applyChange(spec, { ptype });
    const size = pick("size", sizesFor(spec));
    if (size) spec = applyChange(spec, { size });
    const sides = spec.product === "flyers" ? pick("sides", SIDES.map((s) => s.id)) : undefined;
    if (sides) spec = applyChange(spec, { sides });
    if (weight !== undefined && spec.product !== "cards" && spec.product !== "custom" && weightsFor(spec.product, spec.ptype).includes(weight)) {
      spec = applyChange(spec, { weight });
    }
  } else if (spec.product === "cards") {
    const card = pick("card", CARD_TYPES.map((c) => c.id));
    if (card) spec = applyChange(spec, { card });
    const paper = pick("paper", papersFor(spec).map((p) => p.id));
    if (paper) spec = applyChange(spec, { paper });
  } else {
    const sides = pick("sides", SIDES.map((s) => s.id));
    if (sides) spec = applyChange(spec, { sides });
    const paper = pick("paper", papersFor(spec).map((p) => p.id));
    if (paper) spec = applyChange(spec, { paper });
  }
  return isValidSpec(spec) ? spec : defaultSpec(product);
}
