import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Autofill on the public forms: the quote form (on /quote and in the
// floating Get a Quote panel, which uses the same component) and the
// distributor application. Each field the browser can fill carries the
// standard autocomplete value and the right input type, and keeps its name,
// label and validation, so what is sent is unchanged. Checked on the
// source; the browser run checks the rendered fields.

// The whole tag of the field with this id.
function tagOf(source: string, id: string): string {
  const at = source.indexOf(`id="${id}"`);
  assert.ok(at > 0, id);
  const start = source.lastIndexOf("<", at);
  const end = source.indexOf("/>", at);
  return source.slice(start, end + 2);
}
const attr = (tag: string, name: string) => new RegExp(`\\b${name}=(?:"([^"]*)"|\\{([^}]*)\\})`).exec(tag)?.slice(1).find((v) => v !== undefined);

type Field = { id: string; name: string; type: string; autoComplete: string; inputMode?: string; required: boolean; label: string };

const QUOTE: Field[] = [
  { id: "first-name", name: "first-name", type: "text", autoComplete: "given-name", required: true, label: "First name" },
  { id: "last-name", name: "last-name", type: "text", autoComplete: "family-name", required: false, label: "Last name" },
  { id: "email", name: "email", type: "email", autoComplete: "email", required: true, label: "Email address" },
  { id: "phone", name: "phone", type: "tel", autoComplete: "tel", inputMode: "tel", required: true, label: "Contact number" },
  { id: "company", name: "company", type: "text", autoComplete: "organization", required: false, label: "Company / Organisation" },
];
const APPLICATION: Field[] = [
  { id: "dist-name", name: "name", type: "text", autoComplete: "name", required: true, label: "Full name" },
  { id: "dist-phone", name: "phone", type: "tel", autoComplete: "tel", inputMode: "tel", required: true, label: "Phone number" },
  { id: "dist-email", name: "email", type: "email", autoComplete: "email", required: false, label: "Email address" },
  // "Where do you live?" takes a town or a postcode; autofill offers the postcode.
  { id: "dist-area", name: "area", type: "text", autoComplete: "postal-code", required: true, label: "Where do you live?" },
];

for (const [file, fields] of [
  ["components/QuoteForm.tsx", QUOTE],
  ["components/DistributorApplicationForm.tsx", APPLICATION],
] as const) {
  test(`${file}: each field autofills with the standard value and keeps its name, label and validation`, () => {
    const source = readFileSync(file, "utf8");
    for (const f of fields) {
      const tag = tagOf(source, f.id);
      assert.match(tag, /^<input\s/, f.id);
      assert.equal(attr(tag, "name"), f.name, f.id);
      assert.equal(attr(tag, "type"), f.type, f.id);
      assert.equal(attr(tag, "autoComplete"), f.autoComplete, f.id);
      assert.equal(attr(tag, "inputMode"), f.inputMode, f.id);
      assert.equal(/\srequired\s/.test(tag), f.required, f.id);
      // The label, word for word.
      const label = new RegExp(`htmlFor="${f.id}"[^>]*>\\s*([^<]+?)\\s*(?:<span className="text-red-500">\\*</span>\\s*)?</label>`).exec(source);
      assert.equal(label?.[1], f.label, f.id);
    }
  });
}

test("the quote form's own fields: one autofill value each, and none on the questions about the campaign", () => {
  const source = readFileSync("components/QuoteForm.tsx", "utf8");
  assert.deepEqual([...source.matchAll(/autoComplete="([^"]+)"/g)].map((m) => m[1]), ["given-name", "family-name", "email", "tel", "organization"]);
  // The areas to leaflet are the target, not the visitor's own postcode.
  assert.equal(attr(tagOf(source, "areas-required"), "autoComplete"), undefined);
});

test("the application's own fields: one autofill value each, and the hidden bot trap still off", () => {
  const source = readFileSync("components/DistributorApplicationForm.tsx", "utf8");
  assert.deepEqual([...source.matchAll(/autoComplete="([^"]+)"/g)].map((m) => m[1]), ["off", "name", "tel", "email", "postal-code"]);
  assert.equal(attr(tagOf(source, "dist-extra-details"), "autoComplete"), "off");
});
