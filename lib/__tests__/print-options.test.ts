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
  specFields,
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

test("the structured fields the quote form sends beside the summary", () => {
  assert.deepEqual(specFields(defaultSpec()), { item: "Flyers and leaflets", size: "A5", sides: "Double-sided", paper: "250gsm silk" });
  assert.deepEqual(specFields({ product: "flyers", size: "A4", sides: "single", ptype: "uncoated", weight: 170 }), {
    item: "Flyers and leaflets",
    size: "A4",
    sides: "Single-sided",
    paper: "170gsm uncoated",
  });
  // Folded leaflets: always double-sided, and their fold.
  assert.deepEqual(specFields({ product: "folded", fold: "z", size: "DL", ptype: "gloss", weight: 130 }), {
    item: "Folded leaflets",
    size: "DL",
    sides: "Double-sided",
    fold: "Z-fold",
    paper: "130gsm gloss",
  });
  // Business cards: 85 x 55mm, no sides; folded ones say so.
  assert.deepEqual(specFields(defaultSpec("cards")), { item: "Business cards", size: "85 x 55mm", paper: "450gsm silk" });
  assert.deepEqual(specFields({ product: "cards", card: "folded", paper: "350-uncoated" }), { item: "Business cards", size: "85 x 55mm", fold: "Folded", paper: "350gsm uncoated" });
  // Custom shapes: the size is confirmed on the call.
  assert.deepEqual(specFields({ product: "custom", sides: "single", paper: "350-silk" }), { item: "Custom-shaped flyers", size: "Custom", sides: "Single-sided", paper: "350gsm silk" });
  // Every choice the builder can reach has an item, a size and a paper, and the same item as its quote form tick used to.
  for (const spec of reachable().values()) {
    const f = specFields(spec);
    assert.equal(f.item, QUOTE_ITEM[spec.product]);
    assert.ok(f.size && f.paper, keyOf(spec));
    assert.equal(f.fold !== undefined, spec.product === "folded" || (spec.product === "cards" && spec.card === "folded"), keyOf(spec));
    assert.equal(f.sides !== undefined, spec.product !== "cards", keyOf(spec));
  }
});

test("the quote form: the same builder, starting on the link's spec or the defaults, its summary at the top, its fields sent", () => {
  const form = readFileSync("components/QuoteForm.tsx", "utf8");
  // The builder in form mode, holding the form's spec, which starts on the defaults; a valid link replaces them.
  assert.match(form, /const \[printSpec, setPrintSpec\] = useState<PrintSpec>\(\(\) => defaultSpec\(\)\);/);
  assert.match(form, /const spec = chosen === "Leaflet Printing" \? specFromParams\(params\) : null;\s+if \(spec\) setPrintSpec\(spec\);/);
  assert.match(form, /<PrintBuilder mode="form" id=\{printBuilderId\} spec=\{printSpec\} onSpecChange=\{setPrintSpec\} \/>/);
  // After sending, back to the defaults.
  assert.match(form, /setPrintSpec\(defaultSpec\(\)\);/);
  // What it sends, summary first, before the builder.
  const fields = form.slice(form.indexOf('<input type="hidden" name="print-spec"'), form.indexOf("<PrintBuilder mode="));
  assert.deepEqual([...fields.matchAll(/name="([^"]+)" value=\{([^}]+)\}/g)].map((m) => [m[1], m[2]]), [
    ["print-spec", "specSummary(printSpec)"],
    ["print-item", "printFields.item"],
    ["print-size", "printFields.size"],
    ["print-sides", "printFields.sides"],
    ["print-fold", "printFields.fold"],
    ["print-paper", "printFields.paper"],
  ]);
  assert.match(fields, /\{printFields\.sides && <input type="hidden" name="print-sides"/);
  assert.match(fields, /\{printFields\.fold && <input type="hidden" name="print-fold"/);
  // The summary bar: only for printing, after the service picker, just above Your details (inside its block, under
  // its divider, so it comes into view with it), with Change once the builder is there; nothing of it above the picker.
  const card = form.slice(form.indexOf('<div className={`bg-white rounded-lg border border-gray-200 p-8'), form.indexOf("What do you need?"));
  assert.doesNotMatch(card, /Your print:/);
  const details = form.slice(form.indexOf('<div ref={detailsRef} className="border-t border-gray-200 pt-6 scroll-mt-20">'), form.indexOf("Your details</h3>"));
  const bar = details.slice(details.indexOf("{isPrinting && ("));
  assert.ok(details.indexOf("{isPrinting && (") > 0);
  assert.match(bar, /\)\}\s+<h3 className="text-lg font-bold text-blue-900">$/);
  assert.equal(form.split("Your print: <strong").length - 1, 1);
  assert.match(bar, /className="[^"]*rounded-md border border-blue-100 bg-\[#eff6ff\][^"]*"/);
  assert.match(bar, /Your print: <strong className="font-semibold">\{specSummary\(printSpec\)\}<\/strong>/);
  assert.match(bar, /\{showQuestions && \(\s+<a\s+href=\{`#\$\{printBuilderId\}`\}\s+onClick=\{goToPrintBuilder\}[\s\S]*?>\s+Change\s+<\/a>/);
  // Change scrolls the builder into view (at once with reduced motion) and focuses it.
  const go = form.slice(form.indexOf("function goToPrintBuilder("), form.indexOf("\n  }\n", form.indexOf("function goToPrintBuilder(")));
  assert.match(go, /e\.preventDefault\(\);/);
  assert.match(go, /scrollIntoView\(\{ behavior: reduce \? "instant" : "smooth", block: "start" \}\)/);
  assert.match(go, /builder\.focus\(\{ preventScroll: true \}\)/);
  // The old printing fields are gone: the item pills, the size and sides, the paper note, the chosen spec box and its link back.
  for (const gone of ["What would you like printed?", 'name="print-items"', 'id="print-size"', "Double sided (recommended)", "Paper: we recommend 250gsm silk", "Your chosen spec", "/leaflet-printing#paper-and-finish", "PRINT_ITEMS"]) {
    assert.ok(!form.includes(gone), gone);
  }
  // Additional details asks about anything else to print, since the item pills (with Something else) are gone.
  assert.match(form, /id="print-message"[\s\S]*?placeholder="Paper or finish you have in mind, when you need them, or anything else you'd like printed\.\.\."/);
  // The route records the summary and each part in the lead's note.
  const route = readFileSync("app/api/quote-lead/route.ts", "utf8");
  for (const [field, label] of [["print-spec", "Print spec"], ["print-item", "Print item"], ["print-fold", "Fold"], ["print-sides", "Print sides"], ["print-paper", "Paper"]]) {
    assert.ok(route.includes(`if (isPrinting && data["${field}"]) noteLines.push(\`${label}: \${data["${field}"]}\`);`), field);
  }
  assert.ok(route.includes('if (data["print-size"]) noteLines.push(`Item size: ${data["print-size"]}`);'));
});

test("the builder's form mode: the same groups on a light panel headed Your print, no link, and it can be focused", () => {
  const source = readFileSync("components/PrintBuilder.tsx", "utf8");
  const formMode = source.slice(source.indexOf("if (form) {"), source.indexOf("\n  }\n", source.indexOf("if (form) {")));
  assert.match(formMode, /id=\{form\.id\}\s+tabIndex=\{-1\}\s+role="group"\s+aria-labelledby=\{`\$\{form\.id\}-heading`\}/);
  assert.match(formMode, /className="[^"]*rounded-xl border border-\[#e2e8f0\] bg-\[#f8fafc\] p-5[^"]*"/);
  assert.doesNotMatch(formMode, /shadow/);
  assert.match(formMode, />\s+Your print\s+<\/h4>/);
  assert.match(formMode, /\{groups\}/);
  assert.doesNotMatch(formMode, /Get this printed|<Link/);
  // The page's card is unchanged: the same groups, its shadow, Build your print and its link.
  const pageMode = source.slice(source.indexOf("if (form) {") + formMode.length);
  assert.match(pageMode, /shadow-\[/);
  assert.match(pageMode, /Build your print/);
  assert.match(pageMode, /\{groups\}/);
  assert.match(pageMode, /<Link href=\{quoteHrefFor\(spec\)\}/);
});
