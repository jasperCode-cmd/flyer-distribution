import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { QUANTITY_MESSAGE, QUANTITY_PLACEHOLDER, QUANTITY_RANGES, isQuantityRange } from "@/lib/quote-quantity";
import { leafletCountFromQuantity } from "@/lib/profit";
import { sendQuoteThankYou, type ThankYouSend } from "@/lib/quote-thank-you";
import { enquiryFromQuoteForm } from "@/lib/thank-you-email";
import type { SendEmailParams } from "@/lib/gmail";

// The quote form's "Approximate quantity (flyers)": a required dropdown of
// ranges from one shared list, sent as it reads, accepted by /api/quote-lead
// only from that list, saved as the lead's leafletQuantity and shown in the
// thank-you email as written. No campaign start date anywhere. The route
// tests need a throwaway local database (CRM_TEST_DATABASE_URL on
// localhost) and are skipped otherwise; every email goes to a fake, so
// nothing is emailed. Made-up details throughout.

const RANGES = ["Under 1,000", "1,000 to 2,500", "2,500 to 5,000", "5,000 to 10,000", "10,000 to 25,000", "25,000+", "Not sure yet"];

test("the ranges, word for word, and only they are a choice", () => {
  assert.deepEqual([...QUANTITY_RANGES], RANGES);
  assert.equal(QUANTITY_PLACEHOLDER, "Select a range...");
  for (const range of RANGES) assert.ok(isQuantityRange(range), range);
  for (const other of ["", QUANTITY_PLACEHOLDER, "2000", "2,000", "1,000 - 5,000", "5,000 - 10,000", " Under 1,000", "under 1,000", "25000+", null, undefined, 2000]) {
    assert.equal(isQuantityRange(other), false, String(other));
  }
});

test("the form asks with a required dropdown from the shared list, with no typed number, estimate or start date", () => {
  const form = readFileSync("components/QuoteForm.tsx", "utf8");
  const field = form.slice(form.indexOf('htmlFor="quantity"'), form.indexOf("</select>", form.indexOf('htmlFor="quantity"')));
  assert.match(field, /Approximate quantity \(flyers\) <span className="text-red-500">\*<\/span>/);
  assert.match(field, /<select\s+id="quantity"\s+name="quantity"\s+required\s+defaultValue=""/);
  assert.match(field, /<option value="">\{QUANTITY_PLACEHOLDER\}<\/option>\s+\{QUANTITY_RANGES\.map\(\(range\) => \(\s+<option key=\{range\} value=\{range\}>/);
  assert.match(form, /import \{ QUANTITY_PLACEHOLDER, QUANTITY_RANGES \} from "@\/lib\/quote-quantity";/);
  // Only on the leaflet form.
  const leaflet = form.slice(form.indexOf("{isLeaflet && ("), form.indexOf("{isWebDesign && ("));
  assert.ok(leaflet.includes('id="quantity"'));
  assert.equal(form.split('name="quantity"').length - 1, 1);
  // Gone: the typed number, its parsing and message, the hours estimate and the start date.
  assert.doesNotMatch(form, /inputMode="numeric"|parseFlyerQuantity|distributionEstimate|quantityError|estimate|campaign-start-date|Campaign start date/i);
  // The route takes the same list from the same place.
  const route = readFileSync("app/api/quote-lead/route.ts", "utf8");
  assert.match(route, /import \{ QUANTITY_MESSAGE, isQuantityRange \} from "@\/lib\/quote-quantity";/);
  assert.doesNotMatch(route, /campaign-start-date|start date/i);
});

test("a range never prefills the Area Planner or Profit leaflet count, and nothing breaks", () => {
  for (const range of RANGES) assert.equal(leafletCountFromQuantity(range), null, range);
  // A plain number still does, as before.
  assert.equal(leafletCountFromQuantity("2,000"), 2000);
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
    const lead = await prisma.lead.findFirst({
      where: { email },
      select: { id: true, email: true, business: true, leafletQuantity: true, activities: { select: { detail: true } } },
    });
    return { res, body: await res.json(), lead };
  } finally {
    console.error = original;
  }
}

test("real database: every range on the form is accepted and saved as it reads", { skip }, async () => {
  for (const range of RANGES) {
    const { res, lead } = await submit({ service: "Leaflet Distribution", "areas-required": "BH24", quantity: range });
    assert.equal(res.status, 201, range);
    assert.equal(lead?.leafletQuantity, range, range);
  }
});

test("real database: a leaflet enquiry with no quantity, or one not on the list, is refused with a clear 400 and saves nothing", { skip }, async () => {
  for (const quantity of [undefined, "", QUANTITY_PLACEHOLDER, "2000", "2,000", "1,000 - 5,000", "lots", "under 1,000"]) {
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

test("real database: an enquiry without a start date is saved and gets its thank-you email, showing the range", { skip }, async () => {
  const form = { service: "Leaflet Distribution", "areas-required": "Ringwood and BH24", quantity: "1,000 to 2,500", "printing-included": "yes" };
  const { res, lead } = await submit(form);
  assert.equal(res.status, 201);
  assert.equal(lead!.leafletQuantity, "1,000 to 2,500");
  assert.equal(lead!.business, "FDH");
  assert.doesNotMatch(lead!.activities.map((a) => a.detail).join("\n"), /start date/i);
  // The thank-you email, as the route builds it from what the form sent, to a fake Gmail.
  const sent: SendEmailParams[] = [];
  const send: ThankYouSend = async (params) => {
    sent.push(params);
    return { ok: true, data: { messageId: "m", threadId: "t", signature: "none" } };
  };
  // Its own hour, so the site's hourly limit isn't shared with other tests.
  const now = new Date("2031-03-03T10:00:00Z");
  assert.equal(await sendQuoteThankYou({ db: prisma, lead: lead!, enquiry: enquiryFromQuoteForm({ "first-name": "Quinn", ...form }), send, now }), "sent");
  assert.equal(sent.length, 1);
  const html = sent[0].html ?? "";
  const text = sent[0].body;
  assert.ok(text.includes("Leaflets: 1,000 to 2,500"), text);
  assert.ok(html.includes("1,000 to 2,500"));
  assert.doesNotMatch(html + text, /Start date/);
});
