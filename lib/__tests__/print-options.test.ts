// The print options (lib/print-options.ts) that the print builder on
// /leaflet-printing and the quote form share: every choice the builder can
// reach is one we print (checked against the list as given, typed out here
// on its own), the corrections it makes as choices change, the summary
// sentence, and the URL parameters that carry a choice to the quote form,
// with anything invalid in them ignored.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  applyChange,
  CARD_TYPES,
  defaultSpec,
  FOLDS,
  isValidSpec,
  PAPER_TYPES,
  papersFor,
  PRODUCTS,
  QUOTE_ITEM,
  quoteHrefFor,
  SIDES,
  sizesFor,
  specFromParams,
  specParams,
  specSummary,
  weightLabel,
  weightsFor,
  type Change,
  type PrintSpec,
} from "@/lib/print-options";

// The list as given, one key per combination.
const SIZES4 = ["A6", "A5", "A4", "DL"];
const FLYER_PAPER = { silk: [115, 150, 170, 250, 350, 450], uncoated: [90, 120, 170, 250, 350], gloss: [130] };
const FOLDED_PAPER = { silk: [115, 150, 170, 250, 350], uncoated: [90, 120, 170, 250, 350], gloss: [130] };
function expectedKeys(): Set<string> {
  const keys = new Set<string>();
  for (const size of SIZES4)
    for (const sides of ["double", "single"])
      for (const [ptype, weights] of Object.entries(FLYER_PAPER)) for (const w of weights) keys.add(`flyers ${size} ${sides} ${ptype} ${w}`);
  for (const fold of ["half", "c", "z", "cross"])
    for (const size of fold === "cross" ? ["A6", "A5", "A4"] : SIZES4)
      for (const [ptype, weights] of Object.entries(FOLDED_PAPER)) for (const w of weights) keys.add(`folded ${fold} ${size} ${ptype} ${w}`);
  for (const paper of ["450-silk", "350-uncoated"]) keys.add(`cards standard ${paper}`);
  keys.add("cards folded 350-uncoated");
  for (const sides of ["double", "single"]) for (const paper of ["250-silk", "350-silk", "250-uncoated", "350-uncoated"]) keys.add(`custom ${sides} ${paper}`);
  return keys;
}
const keyOf = (s: PrintSpec) => {
  switch (s.product) {
    case "flyers":
      return `flyers ${s.size} ${s.sides} ${s.ptype} ${s.weight}`;
    case "folded":
      return `folded ${s.fold} ${s.size} ${s.ptype} ${s.weight}`;
    case "cards":
      return `cards ${s.card} ${s.paper}`;
    case "custom":
      return `custom ${s.sides} ${s.paper}`;
  }
};

// Every pill the builder shows for a choice, as the change it makes (the same groups, in the same way, as components/PrintBuilder.tsx).
function pillsFor(s: PrintSpec): Change[] {
  const out: Change[] = PRODUCTS.map((p) => ({ product: p.id }));
  if (s.product === "folded") out.push(...FOLDS.map((f) => ({ fold: f.id })));
  if (s.product === "cards") out.push(...CARD_TYPES.map((c) => ({ card: c.id })));
  if (s.product === "flyers" || s.product === "folded") out.push(...sizesFor(s).map((size) => ({ size })));
  if (s.product === "flyers" || s.product === "custom") out.push(...SIDES.map((x) => ({ sides: x.id })));
  if (s.product === "flyers" || s.product === "folded") {
    out.push(...PAPER_TYPES.map((t) => ({ ptype: t.id })));
    out.push(...weightsFor(s.product, s.ptype).map((weight) => ({ weight })));
  }
  if (s.product === "cards" || s.product === "custom") out.push(...papersFor(s).map((p) => ({ paper: p.id })));
  return out;
}
// Every choice reachable from the default by pressing pills.
function reachable(): Map<string, PrintSpec> {
  const seen = new Map<string, PrintSpec>();
  const queue = [defaultSpec()];
  while (queue.length) {
    const s = queue.shift()!;
    if (seen.has(keyOf(s))) continue;
    seen.set(keyOf(s), s);
    for (const c of pillsFor(s)) queue.push(applyChange(s, c));
  }
  return seen;
}

test("every choice the builder can reach exists in the list, and every one in the list can be reached", () => {
  const reached = reachable();
  const expected = expectedKeys();
  assert.equal(expected.size, 272);
  for (const [key, spec] of reached) {
    assert.ok(expected.has(key), `not in the list: ${key}`);
    assert.ok(isValidSpec(spec), key);
  }
  assert.deepEqual([...reached.keys()].sort(), [...expected].sort());
  // And a pill the builder shows is never one that leaves the choice invalid.
  for (const spec of reached.values()) for (const c of pillsFor(spec)) assert.ok(isValidSpec(applyChange(spec, c)), `${keyOf(spec)} + ${JSON.stringify(c)}`);
});

test("the defaults: flyers A5, double-sided, 250gsm silk (recommended); folded C-fold, A5, 250gsm silk", () => {
  assert.deepEqual(defaultSpec(), { product: "flyers", size: "A5", sides: "double", ptype: "silk", weight: 250 });
  assert.deepEqual(defaultSpec("folded"), { product: "folded", fold: "c", size: "A5", ptype: "silk", weight: 250 });
  assert.deepEqual(applyChange(defaultSpec(), { product: "folded" }), defaultSpec("folded"));
  assert.equal(weightLabel(250, "silk"), "250gsm (recommended)");
  assert.equal(weightLabel(250, "uncoated"), "250gsm");
  assert.equal(weightLabel(130, "gloss"), "130gsm");
  assert.deepEqual(PRODUCTS.map((p) => p.label), ["Flyers and leaflets", "Folded leaflets", "Business cards", "Custom-shaped flyers"]);
  assert.deepEqual(FOLDS.map((f) => f.label), ["Half fold", "C-fold", "Z-fold", "Cross fold"]);
  assert.deepEqual(SIDES.map((s) => s.label), ["Double-sided", "Single-sided"]);
  assert.deepEqual(PAPER_TYPES.map((t) => t.label), ["Silk", "Uncoated", "Gloss"]);
});

test("a choice that makes another invalid corrects it", () => {
  const flyers = defaultSpec();
  // Gloss sets 130gsm; back to silk or uncoated keeps 250gsm where it can.
  const gloss = applyChange(flyers, { ptype: "gloss" });
  assert.equal(gloss.product === "flyers" && gloss.weight, 130);
  const silk = applyChange(gloss, { ptype: "silk" });
  assert.equal(silk.product === "flyers" && silk.weight, 250);
  assert.equal(applyChange(flyers, { ptype: "uncoated" }).product === "flyers" && (applyChange(flyers, { ptype: "uncoated" }) as { weight: number }).weight, 250);
  // A weight the new paper type has too is kept; one it doesn't have becomes 250gsm.
  const silk450 = applyChange(flyers, { weight: 450 });
  assert.equal((applyChange(silk450, { ptype: "uncoated" }) as { weight: number }).weight, 250);
  assert.equal((applyChange(applyChange(flyers, { weight: 350 }), { ptype: "uncoated" }) as { weight: number }).weight, 350);
  // Folded with 450gsm drops to 350gsm.
  assert.deepEqual(applyChange(silk450, { product: "folded" }), { product: "folded", fold: "c", size: "A5", ptype: "silk", weight: 350 });
  // Cross fold with DL switches to A5, and offers no DL.
  const dl = applyChange(defaultSpec("folded"), { size: "DL" });
  const cross = applyChange(dl, { fold: "cross" });
  assert.equal(cross.product === "folded" && cross.size, "A5");
  assert.deepEqual(sizesFor(cross), ["A6", "A5", "A4"]);
  assert.deepEqual(sizesFor(dl), ["A6", "A5", "A4", "DL"]);
  // Folded business cards are 350gsm uncoated only.
  const cards = defaultSpec("cards");
  assert.deepEqual(cards, { product: "cards", card: "standard", paper: "450-silk" });
  const folded = applyChange(cards, { card: "folded" });
  assert.deepEqual(folded, { product: "cards", card: "folded", paper: "350-uncoated" });
  assert.deepEqual(papersFor(folded), [{ id: "350-uncoated", label: "350gsm uncoated" }]);
  assert.deepEqual(papersFor(cards).map((p) => p.label), ["450gsm silk", "350gsm uncoated"]);
  assert.deepEqual(papersFor(defaultSpec("custom")).map((p) => p.label), ["250gsm silk", "350gsm silk", "250gsm uncoated", "350gsm uncoated"]);
});

test("the summary sentence", () => {
  assert.equal(specSummary(defaultSpec()), "A5 flyers, double-sided, 250gsm silk");
  assert.equal(specSummary({ product: "flyers", size: "DL", sides: "single", ptype: "gloss", weight: 130 }), "DL flyers, single-sided, 130gsm gloss");
  assert.equal(specSummary(defaultSpec("folded")), "A5 C-fold leaflets, double-sided, 250gsm silk");
  assert.equal(specSummary({ product: "folded", fold: "cross", size: "A4", ptype: "uncoated", weight: 170 }), "A4 cross fold leaflets, double-sided, 170gsm uncoated");
  assert.equal(specSummary({ product: "cards", card: "folded", paper: "350-uncoated" }), "Folded business cards, 85 x 55mm, 350gsm uncoated");
  assert.equal(specSummary({ product: "custom", sides: "single", paper: "350-silk" }), "Custom-shaped flyers, single-sided, 350gsm silk");
  // Each product ticks its own item on the quote form.
  assert.deepEqual(Object.values(QUOTE_ITEM), PRODUCTS.map((p) => p.label));
});

test("the quote link carries the choice in short parameters, and every choice comes back from them unchanged", () => {
  assert.equal(quoteHrefFor(defaultSpec()), "/quote?service=printing&item=flyers&size=A5&sides=double&ptype=silk&weight=250");
  assert.equal(quoteHrefFor(defaultSpec("folded")), "/quote?service=printing&item=folded&fold=c&size=A5&ptype=silk&weight=250");
  assert.equal(quoteHrefFor(defaultSpec("cards")), "/quote?service=printing&item=cards&card=standard&paper=450-silk");
  assert.equal(quoteHrefFor(defaultSpec("custom")), "/quote?service=printing&item=custom&sides=double&paper=250-silk");
  for (const spec of reachable().values()) {
    const params = new URLSearchParams(quoteHrefFor(spec).split("?")[1]);
    assert.deepEqual(specFromParams(params), spec, keyOf(spec));
    for (const key of params.keys()) assert.ok(["service", "item", "size", "sides", "ptype", "weight", "fold", "card", "paper"].includes(key), key);
  }
  assert.deepEqual([...specParams(defaultSpec("cards")).keys()], ["item", "card", "paper"]);
});

test("an invalid URL parameter is ignored", () => {
  const from = (q: string) => specFromParams(new URLSearchParams(q));
  // No item, or one we don't offer: no spec at all, so the form behaves as before.
  for (const q of ["", "size=A5", "item=", "item=posters", "item=Flyers", "item=flyers%20", "item=perforated", "item=<script>"]) assert.equal(from(q), null, q);
  // A valid item with invalid choices: each invalid one ignored, the product's default kept, the valid ones used.
  assert.deepEqual(from("item=flyers&size=B2&sides=both&ptype=matt&weight=999"), defaultSpec());
  assert.deepEqual(from("item=flyers&size=A4&sides=triple&weight=abc"), { ...defaultSpec(), size: "A4" });
  assert.deepEqual(from("item=flyers&size=a4"), defaultSpec());
  // A weight the paper type doesn't come in.
  assert.deepEqual(from("item=flyers&ptype=gloss&weight=250"), { product: "flyers", size: "A5", sides: "double", ptype: "gloss", weight: 130 });
  assert.deepEqual(from("item=folded&weight=450"), defaultSpec("folded"));
  // A size the fold doesn't come in.
  assert.deepEqual(from("item=folded&fold=cross&size=DL"), { ...defaultSpec("folded"), fold: "cross" });
  // A paper the card type doesn't come in, and parameters that belong to other products.
  assert.deepEqual(from("item=cards&card=folded&paper=450-silk"), { product: "cards", card: "folded", paper: "350-uncoated" });
  assert.deepEqual(from("item=cards&size=A4&sides=single&fold=z&weight=130"), defaultSpec("cards"));
  assert.deepEqual(from("item=custom&paper=450-silk&size=A6"), defaultSpec("custom"));
  assert.deepEqual(from("item=folded&sides=single"), defaultSpec("folded"));
  // Whatever comes in, what comes out is always in the list.
  for (const q of ["item=folded&fold=cross&size=DL&ptype=gloss&weight=450", "item=cards&card=nope&paper=nope", "item=custom&sides=&paper="]) assert.ok(isValidSpec(from(q)!), q);
});

test("the quote form reads the spec only for Leaflet Printing, through these same options", () => {
  const form = readFileSync("components/QuoteForm.tsx", "utf8");
  assert.match(form, /import \{[^}]*specFromParams[^}]*\} from "@\/lib\/print-options";/);
  assert.match(form, /const spec = chosen === "Leaflet Printing" \? specFromParams\(params\) : null;\s+if \(spec\) \{\s+setPrintSpec\(spec\);\s+setPrintItems\(\[QUOTE_ITEM\[spec\.product\]\]\);/);
  // The spec box: a light blue box first in the print questions, the summary, a Change link back to the builder, and print-spec.
  const box = form.slice(form.indexOf("{printSpec && ("), form.indexOf("{/* What to print"));
  assert.match(box, /className="rounded-md border border-blue-100 bg-\[#eff6ff\]/);
  assert.match(box, />Your chosen spec</);
  assert.match(box, /href="\/leaflet-printing#paper-and-finish"[\s\S]*?>\s*Change\s*<\/a>/);
  assert.match(box, /<input type="hidden" name="print-spec" value=\{specSummary\(printSpec\)\} \/>/);
  // The paper note only without a spec.
  assert.match(form, /\{!printSpec && \(\s*<p [^>]*>\s*Paper: we recommend 250gsm silk\./);
  // The route records it in the lead's note.
  assert.match(readFileSync("app/api/quote-lead/route.ts", "utf8"), /if \(isPrinting && data\["print-spec"\]\) noteLines\.push\(`Print spec: \$\{data\["print-spec"\]\}`\);/);
});
