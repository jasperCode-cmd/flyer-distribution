import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { QUANTITY_PLACEHOLDER, QUANTITY_RANGES } from "@/lib/quote-quantity";

// Leaflet Distribution on the quote form: "About your campaign" asks the
// approximate quantity first, on its own, with a hint to choose one. Any
// choice, "Not sure yet" included, folds in the rest of the section, which
// then stays for the visit, even if the quantity is changed back. Web Design
// & SEO and Screen Hire show everything at once, as before. What is sent is
// unchanged: the quantity goes from a hidden field where its dropdown used
// to be. Checked on the source; the browser run checks the behaviour and
// compares what is sent against the form before the change.

const form = readFileSync("components/QuoteForm.tsx", "utf8");
const namesIn = (source: string) => [...source.matchAll(/\bname="([^"]+)"/g)].map((m) => m[1]);
const section = form.slice(form.indexOf("?.heading}"), form.indexOf("        </form>"));
// The quantity block, asked straight after the heading for leaflets only.
const quantityBlock = section.slice(section.indexOf("{isLeaflet && ("), section.indexOf("{/* The rest of the section."));
// The rest of the section, hidden for leaflets until a quantity is chosen.
const restStart = section.indexOf("<div\n                  hidden={isLeaflet && !quantityChosen}");
const rest = section.slice(restStart);

test("leaflets: the heading, then only the quantity, with the hint until a choice is made", () => {
  assert.ok(section.indexOf("{isLeaflet && (") < section.indexOf('name="company"'), "the quantity comes before Company");
  assert.match(quantityBlock, /^\{isLeaflet && \(\s+<div>\s+<label\s+htmlFor="quantity"/);
  assert.match(quantityBlock, /Approximate quantity \(flyers\) <span className="text-red-500">\*<\/span>/);
  assert.match(quantityBlock, /<select\s+id="quantity"\s+required\s+value=\{quantity\}/);
  assert.match(quantityBlock, /<option value="">\{QUANTITY_PLACEHOLDER\}<\/option>\s+\{QUANTITY_RANGES\.map\(/);
  // Its hint stays, and the new one, in the grey helper style, until a choice.
  assert.match(quantityBlock, /<p id="quantity-hint" className="mt-1\.5 text-xs text-gray-500">\s+Not sure\? Your best guess is fine\.\s+<\/p>/);
  assert.match(
    quantityBlock,
    /\{!quantityChosen && \(\s+<p id="quantity-continue-hint" className="mt-1\.5 text-xs text-gray-500">\s+Choose a quantity to continue\s+<\/p>\s+\)\}/
  );
  assert.match(quantityBlock, /aria-describedby=\{quantityChosen \? "quantity-hint" : "quantity-hint quantity-continue-hint"\}/);
  // Nothing in it is sent: the choice goes from the hidden field below.
  assert.deepEqual(namesIn(quantityBlock), []);
  // Everything else in the section is in the part that waits for a choice.
  assert.ok(restStart > 0);
  for (const piece of ['name="company"', 'name="service"', "\u2500\u2500 Leaflet Distribution fields", 'name="areas-required"', 'name="budget"', 'name="message"', 'name="newsletter"', 'type="submit"', "Send Quote Request"]) {
    assert.ok(rest.includes(piece), piece);
  }
});

test("any choice reveals the rest, \"Not sure yet\" included; the placeholder does not", () => {
  assert.match(
    quantityBlock,
    /onChange=\{\(e\) => \{\s+setQuantity\(e\.target\.value\);\s+\/\/ [^\n]*\n\s+if \(e\.target\.value\) setQuantityChosen\(true\);\s+\}\}/
  );
  // Every option has a value, so each one reveals; only the placeholder is empty.
  assert.ok(QUANTITY_RANGES.includes("Not sure yet"));
  for (const range of QUANTITY_RANGES) assert.ok(range.length > 0, range);
  assert.match(quantityBlock, /<option value="">\{QUANTITY_PLACEHOLDER\}<\/option>/);
  assert.equal(QUANTITY_PLACEHOLDER, "Select a range...");
  // Hidden until then, not removed, so a Company typed for another service is kept.
  assert.match(rest, /^<div\s+hidden=\{isLeaflet && !quantityChosen\}/);
});

test("once revealed it stays for the visit, even if the quantity is changed back", () => {
  assert.match(form, /const \[quantityChosen, setQuantityChosen\] = useState\(false\);/);
  // Only ever switched on.
  assert.deepEqual(form.match(/setQuantityChosen\([^)]*\)/g), ["setQuantityChosen(true)"]);
  // Changing back only changes the dropdown's value.
  assert.deepEqual(form.match(/setQuantity\([^)]*\)/g), ['setQuantity("")', "setQuantity(e.target.value)"]);
  assert.match(form, /const \[quantity, setQuantity\] = useState\(""\);/);
});

test("it folds in with the same animation as the other reveals, at once with reduced motion", () => {
  assert.match(rest, /className=\{isLeaflet \? "quote-fold-in mt-5 space-y-5" : "space-y-5"\}/);
  const css = readFileSync("app/globals.css", "utf8");
  assert.match(css, /\.quote-fold-in \{\s*animation: quote-fold-in 0\.35s ease-out;\s*\}/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.quote-fold-in \{\s*animation: none;\s*\}\s*\}/);
});

test("Web Design & SEO and Screen Hire: no quantity, everything shown at once, no extra animation", () => {
  // The quantity is only for leaflets, the wait only applies to leaflets,
  // and the others' part of the section keeps its old spacing.
  assert.equal(form.split('id="quantity"').length - 1, 1);
  assert.match(quantityBlock, /^\{isLeaflet && \(/);
  assert.match(rest, /hidden=\{isLeaflet && !quantityChosen\}/);
  assert.match(rest, /: "space-y-5"\}/);
  const web = form.slice(form.indexOf("{isWebDesign && ("), form.indexOf("{isScreenHire && ("));
  const screen = form.slice(form.indexOf("{isScreenHire && ("), form.indexOf("{/* Newsletter opt-in */}"));
  assert.deepEqual(namesIn(web), ["business-type", "budget", "message"]);
  assert.deepEqual(namesIn(screen), ["event-date", "event-location", "event-duration", "message"]);
  // A link choosing a service still only sets the service.
  assert.match(form, /const chosen = serviceFromParam\(new URLSearchParams\(window\.location\.search\)\.get\("service"\)\);\s+if \(chosen\) setServiceType\(chosen\);/);
});

test("what is sent is unchanged: the quantity goes from a hidden field where its dropdown used to be", () => {
  // Sent once, from the hidden field, with the dropdown's value.
  assert.equal(form.split('name="quantity"').length - 1, 1);
  const leaflet = form.slice(form.indexOf("\u2500\u2500 Leaflet Distribution fields"), form.indexOf("{isWebDesign && ("));
  assert.match(leaflet, /<input type="hidden" name="quantity" value=\{quantity\} \/>/);
  // The fields in the order they were sent before the change.
  assert.deepEqual(namesIn(form.slice(form.indexOf("<form "), form.indexOf("{isWebDesign && ("))), [
    "access_key",
    "subject",
    "first-name",
    "last-name",
    "email",
    "phone",
    "company",
    "service",
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
