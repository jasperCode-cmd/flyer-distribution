import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { FDH_ADDRESS, FDH_ADDRESS_LINES, FDH_POSTAL_ADDRESS } from "@/lib/fdh-address";
import { buildThankYouEmail } from "@/lib/thank-you-email";
import { buildApplicantThankYouEmail } from "@/lib/applicant-thank-you-email";
import { FDH_DOCUMENTS } from "@/lib/documents/business/fdh";
import { LDB_DOCUMENTS } from "@/lib/documents/business/ldb";

// Flyer Distribution Hampshire's business address: written once in
// lib/fdh-address.ts, in its three forms, and used everywhere it appears.
// Leaflet Distribution Bournemouth keeps its own.

const read = (file: string) => readFileSync(file, "utf8");

test("the address in its three forms", () => {
  assert.deepEqual([...FDH_ADDRESS_LINES], ["Flat 11, Forest Reach", "184 Ringwood Road", "St. Leonards", "Ringwood", "BH24 2NR"]);
  assert.equal(FDH_ADDRESS, "Flat 11, Forest Reach, 184 Ringwood Road, St. Leonards, Ringwood, BH24 2NR");
  // In this order, as the structured data had it.
  assert.deepEqual(Object.entries(FDH_POSTAL_ADDRESS), [
    ["@type", "PostalAddress"],
    ["streetAddress", "Flat 11, Forest Reach, 184 Ringwood Road, St. Leonards"],
    ["addressLocality", "Ringwood"],
    ["addressRegion", "Dorset"],
    ["postalCode", "BH24 2NR"],
    ["addressCountry", "GB"],
  ]);
});

test("the footer gives it a line at a time; the business and job posting structured data use the PostalAddress", () => {
  const footer = read("components/Footer.tsx");
  assert.match(footer, /import \{ FDH_ADDRESS_LINES \} from "@\/lib\/fdh-address";/);
  assert.match(footer, /<address className="not-italic">\s*\{FDH_ADDRESS_LINES\.map\(\(line, i\) => \(\s*<Fragment key=\{line\}>\s*\{i > 0 && <br \/>\}\s*\{line\}\s*<\/Fragment>\s*\)\)\}\s*<\/address>/);
  assert.match(read("components/SiteSchema.tsx"), /"address": FDH_POSTAL_ADDRESS,/);
  assert.match(read("app/leaflet-distribution-jobs/page.tsx"), /jobLocation: \{\s*"@type": "Place",\s*address: FDH_POSTAL_ADDRESS,\s*\},/);
});

test("the privacy policy and llms.txt give it on one line", () => {
  const privacy = read("app/privacy-policy/page.tsx");
  assert.match(privacy, /<li>Address: \{FDH_ADDRESS\}<\/li>/);
  assert.match(privacy, /<li>Post: Flyer Distribution Hampshire, \{FDH_ADDRESS\}<\/li>/);
  // A plain file, so it is checked against the constant instead.
  assert.ok(read("public/llms.txt").split("\n").includes(`Address: ${FDH_ADDRESS}`));
});

test("the automatic emails' footer gives it a line at a time, in the HTML and the plain text", () => {
  const emails = [
    buildThankYouEmail({ firstName: "Sam", service: "Leaflet Distribution", targetAreas: "Ferndown", quantity: null, printingIncluded: null, designIncluded: null }, { slotsRemaining: 3, monthLabel: "November" }),
    buildApplicantThankYouEmail({ fullName: "Sam Test" }),
  ];
  for (const email of emails) {
    assert.ok(email.html.includes(">Flat 11, Forest Reach<br>184 Ringwood Road<br>St. Leonards<br>Ringwood<br>BH24 2NR</p>"), email.subject);
    assert.ok(email.text.includes("\nFlyer Distribution Hampshire\nFlat 11, Forest Reach\n184 Ringwood Road\nSt. Leonards\nRingwood\nBH24 2NR\nflyerdistributionhampshire@gmail.com\n"), email.subject);
  }
});

test("FDH's quotes and invoices print it on one line; LDB's keep their own address", () => {
  assert.deepEqual(FDH_DOCUMENTS.addressLines, [FDH_ADDRESS]);
  assert.deepEqual(LDB_DOCUMENTS.addressLines, ["Office 21", "18 Christchurch Road", "Bournemouth", "BH1 3NE"]);
});

test("the old form of the address is gone everywhere: no Forest Reach without Flat 11, no St Leonards without the full stop next to it", () => {
  const files = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? files(join(dir, e.name)) : /\.(tsx?|mts|txt|md|json|html)$/.test(e.name) ? [join(dir, e.name)] : []
    );
  const all = ["app", "components", "lib", "public", "scripts"].flatMap(files).filter((f) => f !== join("lib", "__tests__", "fdh-address.test.ts"));
  assert.ok(all.length > 100);
  for (const f of all) {
    const text = read(f);
    assert.doesNotMatch(text, /(?<!Flat )11,? Forest Reach/, f);
    assert.doesNotMatch(text, /Forest Reach,? St\.? Leonards/, f);
    assert.doesNotMatch(text, /St Leonards,? Ringwood,? BH24/, f);
  }
  // Only the shared file writes the address out; everything else uses it.
  const writers = all.filter((f) => read(f).includes("184 Ringwood Road"));
  assert.deepEqual(
    writers.filter((f) => !f.startsWith(join("lib", "__tests__"))),
    [join("lib", "fdh-address.ts"), join("public", "llms.txt")]
  );
});

test("no em or en dashes in the address file", () => {
  assert.doesNotMatch(read("lib/fdh-address.ts"), /[\u2013\u2014]/);
});
