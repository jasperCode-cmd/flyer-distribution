import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { QUANTITY_PLACEHOLDER, QUANTITY_RANGES } from "@/lib/quote-quantity";
import { DISTRIBUTION_TYPES } from "@/lib/quote-services";

// Leaflet Distribution on the quote form: "About your campaign" first asks
// Company / Organisation, what kind of leaflet distribution, Areas required /
// target postcodes (named to suit the kind) and Approximate quantity
// (flyers), with a hint to choose a quantity. Leaflet Printing waits for its
// quantity the same way. Any choice, "Not sure
// yet" included, folds in the rest of the section below it, which then stays
// for the visit, even if the quantity is changed back. Nothing above it moves
// and nothing typed is lost. Web Design & SEO and Screen Hire show everything
// at once, as before. What is sent is unchanged: the fields are in the order
// they are sent. Checked on the source; the browser test checks the
// behaviour, and the browser run compares what is sent against the form
// before the change.

const form = readFileSync("components/QuoteForm.tsx", "utf8");
const namesIn = (source: string) => [...source.matchAll(/\bname="([^"]+)"/g)].map((m) => m[1]);
const section = form.slice(form.indexOf("?.heading}"), form.indexOf("        </form>"));
// The part shown with the heading, and the rest, hidden for leaflets and printing until a quantity is chosen.
const REST = "<div\n                  hidden={(isLeaflet || isPrinting) && !quantityChosen}";
const shown = section.slice(section.indexOf('<div className="space-y-5">'), section.indexOf(REST));
const rest = section.slice(section.indexOf(REST));
const quantityField = shown.slice(shown.indexOf("{/* Quantity:"), shown.indexOf("</>"));
const PRINTING = "{/* \u2500\u2500 Leaflet Printing fields \u2500\u2500 */}";
const PRINTING_REST = "{/* \u2500\u2500 Leaflet Printing, after the quantity \u2500\u2500 */}";

test("leaflets: Company, the kind, Areas, then the quantity, with its hints, shown with the heading", () => {
  assert.ok(section.indexOf(REST) > 0);
  // In this order, and nothing else asked before a quantity is chosen (printing's own part follows).
  assert.deepEqual(namesIn(shown.slice(0, shown.indexOf(PRINTING))), ["company", "service", "distribution-type", "areas-required", "quantity"]);
  assert.deepEqual(namesIn(shown.slice(shown.indexOf(PRINTING))), ["print-spec", "print-items", "print-quantity"]);
  const at = ['htmlFor="company"', 'name="distribution-type"', 'htmlFor="areas-required"', 'htmlFor="quantity"'].map((p) => shown.indexOf(p));
  assert.ok(at.every((i, n) => i > 0 && (n === 0 || i > at[n - 1])), at.join(" "));
  assert.match(shown, /Company \/ Organisation/);
  // The kind: required, four cards, Door to door first; the areas field's label and example follow it.
  assert.match(shown, /What kind of leaflet distribution\? <span className="text-red-500">\*<\/span>/);
  assert.match(shown, /<div className="grid grid-cols-1 sm:grid-cols-2 gap-2">\s+\{DISTRIBUTION_TYPES\.map\(/);
  assert.match(shown, /type="radio"\s+name="distribution-type"\s+value=\{t\.value\}\s+required\s+checked=\{picked\}/);
  assert.match(form, /useState<DistributionType\["value"\]>\(DEFAULT_DISTRIBUTION_TYPE\)/);
  assert.match(shown, /htmlFor="areas-required"[^>]*>\s+\{areasField\.areasLabel\}\s+<\/label>/);
  assert.match(shown, /name="areas-required"\s+placeholder=\{areasField\.areasPlaceholder\}/);
  assert.deepEqual(
    DISTRIBUTION_TYPES.map((t) => [t.value, t.line, t.areasLabel, t.areasPlaceholder]),
    [
      ["Door to door", "Through letterboxes in your chosen areas", "Areas required / target postcodes", "e.g. Southampton SO15, SO16"],
      ["Public notice leafleting", "Road closures, works and consultations", "Where are the works?", "e.g. The roads affected, or the postcodes to cover"],
      ["Hand-to-hand", "Handed out at events and busy spots", "Where and when?", "e.g. Event name, location and date"],
      ["B2B", "Delivered to local businesses", "Target areas or types of business", "e.g. Offices and shops in Southampton city centre"],
    ]
  );
  // Areas and the quantity are for leaflets only; Company is for every service.
  assert.ok(shown.indexOf("{isLeaflet && (") < shown.indexOf('htmlFor="areas-required"'));
  assert.ok(shown.indexOf('htmlFor="company"') < shown.indexOf("{isLeaflet && ("));
  // The quantity: required, from the shared list, with both hints until a choice.
  assert.match(quantityField, /Approximate quantity \(flyers\) <span className="text-red-500">\*<\/span>/);
  assert.match(quantityField, /<select\s+id="quantity"\s+name="quantity"\s+required\s+value=\{quantity\}/);
  assert.match(quantityField, /<option value="">\{QUANTITY_PLACEHOLDER\}<\/option>\s+\{QUANTITY_RANGES\.map\(/);
  assert.match(quantityField, /<p id="quantity-hint" className="mt-1\.5 text-xs text-gray-500">\s+Not sure\? Your best guess is fine\.\s+<\/p>/);
  assert.match(
    quantityField,
    /\{!quantityChosen && \(\s+<p id="quantity-continue-hint" className="mt-1\.5 text-xs text-gray-500">\s+Choose a quantity to continue\s+<\/p>\s+\)\}/
  );
  assert.match(quantityField, /aria-describedby=\{quantityChosen \? "quantity-hint" : "quantity-hint quantity-continue-hint"\}/);
});

test("the rest waits for a quantity: print, design, budget, details, newsletter and send", () => {
  assert.match(rest, /^<div\s+hidden=\{\(isLeaflet \|\| isPrinting\) && !quantityChosen\}/);
  const leafletRest = rest.slice(rest.indexOf("{isLeaflet && ("), rest.indexOf(PRINTING_REST));
  assert.deepEqual(namesIn(leafletRest), ["printing-included", "item-size", "print-sides", "print-sides", "include-design", "budget", "message"]);
  const order = ['question="Would you like us to print?"', 'question="Would you like us to design it?"', 'htmlFor="budget"', 'htmlFor="message"'].map((p) => leafletRest.indexOf(p));
  assert.ok(order.every((i, n) => i > 0 && (n === 0 || i > order[n - 1])), order.join(" "));
  for (const piece of ['name="newsletter"', 'type="submit"', "Send Quote Request"]) assert.ok(rest.includes(piece), piece);
  // Nothing of the first part is in it.
  for (const name of ["company", "service", "areas-required", "quantity"]) assert.ok(!rest.includes(`name="${name}"`), name);
});

test("any choice reveals the rest, \"Not sure yet\" included; the placeholder does not", () => {
  assert.match(
    quantityField,
    /onChange=\{\(e\) => \{\s+setQuantity\(e\.target\.value\);\s+\/\/ [^\n]*\n\s+if \(e\.target\.value\) setQuantityChosen\(true\);\s+\}\}/
  );
  // Every option has a value, so each one reveals; only the placeholder is empty.
  assert.ok(QUANTITY_RANGES.includes("Not sure yet"));
  for (const range of QUANTITY_RANGES) assert.ok(range.length > 0, range);
  assert.equal(QUANTITY_PLACEHOLDER, "Select a range...");
});

test("once revealed it stays for the visit, and what was typed above it is never touched", () => {
  assert.match(form, /const \[quantityChosen, setQuantityChosen\] = useState\(false\);/);
  // Only ever switched on (by the leaflet quantity or the printing one).
  assert.deepEqual(form.match(/setQuantityChosen\([^)]*\)/g), ["setQuantityChosen(true)", "setQuantityChosen(true)"]);
  // Changing back only changes the dropdown's value.
  assert.deepEqual(form.match(/setQuantity\([^)]*\)/g), ['setQuantity("")', "setQuantity(e.target.value)", "setQuantity(e.target.value)"]);
  assert.match(form, /const \[quantity, setQuantity\] = useState\(""\);/);
  // Company and Areas sit in the part that is always shown, so the reveal
  // never re-creates them, and the rest is added below the quantity.
  assert.ok(section.indexOf('name="areas-required"') < section.indexOf(REST));
});

test("it folds in with the same animation as the other reveals, at once with reduced motion", () => {
  assert.match(rest, /className=\{isLeaflet \|\| isPrinting \? "quote-fold-in mt-5 space-y-5" : "mt-5 space-y-5"\}/);
  const css = readFileSync("app/globals.css", "utf8");
  assert.match(css, /\.quote-fold-in \{\s*animation: quote-fold-in 0\.35s ease-out;\s*\}/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.quote-fold-in \{\s*animation: none;\s*\}\s*\}/);
});

test("Web Design & SEO and Screen Hire: no areas or quantity, everything shown at once, no extra animation", () => {
  assert.equal(form.split('id="quantity"').length - 1, 1);
  assert.equal(form.split('id="areas-required"').length - 1, 1);
  // The wait applies to leaflets and printing only, and the others' part keeps its old spacing.
  assert.match(rest, /hidden=\{\(isLeaflet \|\| isPrinting\) && !quantityChosen\}/);
  assert.match(rest, /: "mt-5 space-y-5"\}/);
  const web = form.slice(form.indexOf("{isWebDesign && ("), form.indexOf("{isScreenHire && ("));
  const screen = form.slice(form.indexOf("{isScreenHire && ("), form.indexOf("{/* Newsletter opt-in */}"));
  assert.deepEqual(namesIn(web), ["business-type", "budget", "message"]);
  assert.deepEqual(namesIn(screen), ["event-date", "event-location", "event-duration", "message"]);
  // A link chooses the service, and for leaflets possibly its kind; nothing else.
  assert.match(form, /const params = new URLSearchParams\(window\.location\.search\);\s+const param = params\.get\("service"\);\s+const chosen = serviceFromParam\(param\);\s+if \(chosen\) setServiceType\(chosen\);\s+const kind = distributionTypeFromParam\(param\);\s+if \(kind\) setDistributionType\(kind\);/);
});

test("what leaflets send is unchanged but for the kind: the same fields in the same order", () => {
  // The quantity is sent once, from its dropdown, and there is no hidden copy.
  assert.equal(form.split('name="quantity"').length - 1, 1);
  assert.doesNotMatch(form, /<input type="hidden" name="quantity"/);
  // The fields a leaflet enquiry sends, in the order they were sent before, with the kind added after the service.
  const upToWeb = form.slice(form.indexOf("<form "), form.indexOf("{isWebDesign && ("));
  const cut = (s: string, from: string, to: string) => s.slice(0, s.indexOf(from)) + s.slice(s.indexOf(to));
  const leafletOnly = cut(cut(upToWeb, PRINTING, "{/* The rest of the section."), PRINTING_REST, "{/* \u2500\u2500 Web Design");
  assert.deepEqual(namesIn(leafletOnly), [
    "access_key",
    "subject",
    "first-name",
    "last-name",
    "email",
    "phone",
    "company",
    "service",
    "distribution-type",
    "areas-required",
    "quantity",
    "printing-included",
    "item-size",
    "print-sides",
    "print-sides",
    "include-design",
    "budget",
    "message",
  ]);
  // Still the form as it stands, to both places, and the choice cleared after sending.
  assert.match(form, /const data = Object\.fromEntries\(formData\);/);
  assert.equal((form.match(/body: JSON\.stringify\(data\),/g) ?? []).length, 2);
  assert.match(form, /setIncludeDesign\(false\);\s+setQuantity\(""\);/);
});
