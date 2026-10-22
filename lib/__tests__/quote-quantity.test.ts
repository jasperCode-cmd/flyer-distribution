import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import {
  LEAFLETS_PER_HOUR,
  MAX_FLYERS,
  MIN_FLYERS,
  QUANTITY_MESSAGE,
  distributionEstimate,
  parseFlyerQuantity,
} from "@/lib/quote-quantity";

// The quote form's number of flyers: what is accepted, the limits, the form
// asking for it on leaflet enquiries only, the hours estimate under it, and
// /api/quote-lead checking it again and saving the plain number. The route tests need a throwaway local
// database (CRM_TEST_DATABASE_URL on localhost) and are skipped otherwise;
// no Gmail is set up, so nothing is emailed. Made-up details throughout.

test("the formats people type are read as a whole number", () => {
  const cases: [unknown, number][] = [
    ["2000", 2000],
    ["2,000", 2000],
    ["2 000", 2000],
    ["2 000", 2000],
    ["2k", 2000],
    ["2K", 2000],
    [" 2k ", 2000],
    ["2.5k", 2500],
    ["12,500", 12500],
    ["1 000 000", 1_000_000],
    [5000, 5000],
  ];
  for (const [typed, flyers] of cases) assert.equal(parseFlyerQuantity(typed), flyers, JSON.stringify(typed));
});

test("between 100 and 1,000,000, and anything else is refused", () => {
  assert.equal(MIN_FLYERS, 100);
  assert.equal(MAX_FLYERS, 1_000_000);
  assert.equal(parseFlyerQuantity("100"), 100);
  assert.equal(parseFlyerQuantity("99"), null);
  assert.equal(parseFlyerQuantity("0.1k"), 100);
  assert.equal(parseFlyerQuantity("0.05k"), null);
  assert.equal(parseFlyerQuantity("1,000,000"), 1_000_000);
  assert.equal(parseFlyerQuantity("1000k"), 1_000_000);
  assert.equal(parseFlyerQuantity("1,000,001"), null);
  assert.equal(parseFlyerQuantity("1001k"), null);
  for (const typed of ["", "   ", "0", "abc", "-2000", "2000.5", "2k5", "1e5", "about 2000", "2000 flyers", "5,000 - 10,000", null, undefined, {}]) {
    assert.equal(parseFlyerQuantity(typed), null, JSON.stringify(typed));
  }
  assert.equal(QUANTITY_MESSAGE, "Please enter a number of flyers, for example 2,000");
});

test("the form asks for it on leaflet enquiries only, as a numeric text field, and sends the plain number", () => {
  const form = readFileSync("components/QuoteForm.tsx", "utf8");
  const leafletSection = form.slice(form.indexOf("{isLeaflet && ("), form.indexOf("{isWebDesign && ("));
  assert.match(leafletSection, /<input\s+type="text"\s+inputMode="numeric"\s+id="quantity"\s+name="quantity"\s+required\s+placeholder="e\.g\. 2,000"/);
  assert.ok(leafletSection.includes("Approximate quantity (flyers)"));
  assert.ok(leafletSection.includes("Not sure? Your best guess is fine."));
  assert.doesNotMatch(form, /<select\s+id="quantity"/, "the dropdown is gone");
  assert.equal((form.match(/name="quantity"/g) ?? []).length, 1, "only the leaflet section has the field");
  // Checked only for a leaflet enquiry, then sent on as the cleaned number.
  assert.match(form, /if \(isLeaflet\) \{\s+const flyers = parseFlyerQuantity\(data\.quantity\);/);
  assert.match(form, /data\.quantity = String\(flyers\);/);
});

test("the estimate: 100 leaflets an hour, rounded up to a whole hour", () => {
  assert.equal(LEAFLETS_PER_HOUR, 100);
  assert.equal(distributionEstimate("1,000"), "Approximately 10 hours of distribution");
  assert.equal(distributionEstimate("1,050"), "Approximately 11 hours of distribution");
  assert.equal(distributionEstimate("100"), "Approximately 1 hour of distribution");
  assert.equal(distributionEstimate("101"), "Approximately 2 hours of distribution");
  assert.equal(distributionEstimate("2k"), "Approximately 20 hours of distribution");
  // Over 999 hours with a comma.
  assert.equal(distributionEstimate("99,900"), "Approximately 999 hours of distribution");
  assert.equal(distributionEstimate("125,000"), "Approximately 1,250 hours of distribution");
  assert.equal(distributionEstimate("1,000,000"), "Approximately 10,000 hours of distribution");
});

test("the estimate is hidden while the number is empty or invalid", () => {
  for (const typed of ["", "   ", "lots", "1", "50", "99", "2,000,000", "2000.5", "5,000 - 10,000", null, undefined]) {
    assert.equal(distributionEstimate(typed), null, JSON.stringify(typed));
  }
});

test("the form shows the estimate politely after a pause or on leaving the field, and never sends it", () => {
  const form = readFileSync("components/QuoteForm.tsx", "utf8");
  const leafletSection = form.slice(form.indexOf("{isLeaflet && ("), form.indexOf("{isWebDesign && ("));
  assert.match(form, /const ESTIMATE_PAUSE_MS = 600;/);
  assert.match(leafletSection, /onChange=\{\(e\) => \{[^}]*updateEstimate\(e\.target\.value, ESTIMATE_PAUSE_MS\);/);
  assert.match(leafletSection, /onBlur=\{\(e\) => updateEstimate\(e\.target\.value, 0\)\}/);
  // An invalid or empty number hides it at once, without waiting.
  assert.match(form, /if \(line === null \|\| pause === 0\) setEstimate\(line\);/);
  // A polite live region in the site's blue, not an error.
  assert.match(leafletSection, /<div id="quantity-estimate" aria-live="polite">\s*\{estimate && <p className="[^"]*text-blue-700[^"]*">\{estimate\}<\/p>\}/);
  const estimateBlock = leafletSection.slice(leafletSection.indexOf('<div id="quantity-estimate"'));
  assert.doesNotMatch(estimateBlock.slice(0, estimateBlock.indexOf("</div>")), /text-red|role="alert"/);
  // Display only: not a named field, so it is never in what is sent.
  assert.doesNotMatch(form, /name="[^"]*estimate[^"]*"/i);
  assert.doesNotMatch(form, /data\.[a-z]*estimate|estimate:/i);
});

// --- The route, against a throwaway local database -----------------------------------

const url = process.env.CRM_TEST_DATABASE_URL ?? "";
let host = "";
try {
  host = url ? new URL(url).hostname : "";
} catch {
  host = "";
}
const skip = !["localhost", "127.0.0.1", "::1", "[::1]"].includes(host)
  ? "set CRM_TEST_DATABASE_URL to a local throwaway database to run"
  : false;

const DOMAIN = "@quote-quantity-test.example";
let prisma: PrismaClient;
let POST: (req: Request) => Promise<Response>;

before(async () => {
  if (skip) return;
  prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  await prisma.lead.deleteMany({ where: { email: { endsWith: DOMAIN } } });
  // The route's own client on the throwaway database, and no Gmail at all.
  process.env.DATABASE_URL = url;
  for (const name of ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GMAIL_REFRESH_TOKEN", "GMAIL_SENDER_ADDRESS"]) delete process.env[name];
  ({ POST } = await import("@/app/api/quote-lead/route"));
});

after(async () => {
  if (skip) return;
  // Let any thank-you attempt (it can't send) finish before cleaning up.
  await new Promise((r) => setTimeout(r, 300));
  await prisma.lead.deleteMany({ where: { email: { endsWith: DOMAIN } } });
  await prisma.$disconnect();
});

let n = 0;
async function submit(fields: Record<string, string>) {
  n++;
  const email = `quantity${n}${DOMAIN}`;
  const original = console.error;
  console.error = () => {};
  try {
    const res = await POST(
      new Request("http://localhost/api/quote-lead", {
        method: "POST",
        body: JSON.stringify({ "first-name": "Quinn", "last-name": "Test", email, ...fields }),
      })
    );
    return { res, body: await res.json(), lead: await prisma.lead.findFirst({ where: { email }, select: { leafletQuantity: true } }) };
  } finally {
    console.error = original;
  }
}

test("real database: a leaflet enquiry's quantity is saved as the plain number", { skip }, async () => {
  for (const [typed, saved] of [["2,000", "2000"], ["2 000", "2000"], ["2k", "2000"], ["15000", "15000"]]) {
    const { res, lead } = await submit({ service: "Leaflet Distribution", quantity: typed });
    assert.equal(res.status, 201, typed);
    assert.equal(lead?.leafletQuantity, saved, typed);
  }
});

test("real database: the server refuses a leaflet enquiry with no quantity or one it can't read, and saves nothing", { skip }, async () => {
  for (const quantity of [undefined, "", "lots", "50", "2,000,000", "5,000 - 10,000"]) {
    const { res, body, lead } = await submit({ service: "Leaflet Distribution", ...(quantity === undefined ? {} : { quantity }) });
    assert.equal(res.status, 400, String(quantity));
    assert.deepEqual(body, { error: QUANTITY_MESSAGE });
    assert.equal(lead, null, "no lead saved");
  }
});

test("real database: other services don't need a quantity", { skip }, async () => {
  for (const service of ["Web Design & SEO", "Screen Hire"]) {
    const { res, lead } = await submit({ service });
    assert.equal(res.status, 201, service);
    assert.equal(lead?.leafletQuantity, null, service);
  }
});
