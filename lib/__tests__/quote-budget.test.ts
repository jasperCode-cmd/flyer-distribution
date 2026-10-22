import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// The quote form's "Approximate campaign budget" for leaflet enquiries: the
// options it offers, /api/quote-lead accepting exactly those and refusing the
// ones it no longer offers, and each one saved as sent. The route tests need
// a throwaway local database (CRM_TEST_DATABASE_URL on localhost) and are
// skipped otherwise; no Gmail is set up, so nothing is emailed. Made-up
// details throughout.

const BUDGETS = ["Under £300", "£300 - £500", "£500 - £1,000", "£1,000 - £2,000", "£2,000 - £4,000", "£4,000+"];
const REMOVED = ["£150 - £300", "£2,000+"];
const MESSAGE = "Please choose a campaign budget from the list";

const form = readFileSync("components/QuoteForm.tsx", "utf8");
const optionsOf = (selectId: string) => {
  const start = form.indexOf(`id="${selectId}"`);
  const select = form.slice(start, form.indexOf("</select>", start));
  return [...select.matchAll(/<option(?: value="[^"]*")?>([^<]*)<\/option>/g)].map((m) => m[1]).slice(1);
};

test("the leaflet budget dropdown offers the new ranges, with the same spaced hyphen as before", () => {
  assert.deepEqual(optionsOf("budget"), BUDGETS);
  for (const removed of REMOVED) assert.ok(!optionsOf("budget").includes(removed), removed);
  for (const option of BUDGETS) assert.doesNotMatch(option, /[\u2013\u2014]/, option);
  // The web design budget is a different dropdown and stays as it was.
  assert.deepEqual(optionsOf("web-budget"), ["Under £500", "£500 - £1,000", "£1,000 - £2,500", "£2,500+"]);
});

test("the route accepts exactly the options the form offers", () => {
  const route = readFileSync("app/api/quote-lead/route.ts", "utf8");
  const list = /const LEAFLET_BUDGETS = \[([^\]]*)\]/.exec(route);
  assert.ok(list, "the route keeps its own list");
  assert.deepEqual([...list[1].matchAll(/"([^"]*)"/g)].map((m) => m[1]), optionsOf("budget"));
  assert.ok(route.includes(`const BUDGET_MESSAGE = "${MESSAGE}";`));
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

const DOMAIN = "@quote-budget-test.example";
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
  const email = `budget${n}${DOMAIN}`;
  const original = console.error;
  console.error = () => {};
  try {
    const res = await POST(
      new Request("http://localhost/api/quote-lead", {
        method: "POST",
        body: JSON.stringify({ "first-name": "Bea", "last-name": "Test", email, ...fields }),
      })
    );
    const lead = await prisma.lead.findFirst({ where: { email }, select: { activities: { select: { detail: true } } } });
    return { res, body: await res.json(), lead };
  } finally {
    console.error = original;
  }
}

test("real database: each budget the form offers is accepted and saved as sent", { skip }, async () => {
  for (const budget of optionsOf("budget")) {
    const { res, lead } = await submit({ service: "Leaflet Distribution", quantity: "2000", budget });
    assert.equal(res.status, 201, budget);
    assert.ok(lead?.activities.some((a) => a.detail.split("\n").includes(`Budget range: ${budget}`)), budget);
  }
});

test("real database: a leaflet budget the form no longer offers is refused, and nothing is saved", { skip }, async () => {
  for (const budget of [...REMOVED, "£150\u2013£300", "£2,000 to £4,000", "£1,000,000+"]) {
    const { res, body, lead } = await submit({ service: "Leaflet Distribution", quantity: "2000", budget });
    assert.equal(res.status, 400, budget);
    assert.deepEqual(body, { error: MESSAGE });
    assert.equal(lead, null, "no lead saved");
  }
});

test("real database: the web design budget is untouched by the leaflet list", { skip }, async () => {
  const { res, lead } = await submit({ service: "Web Design & SEO", budget: "£2,500+" });
  assert.equal(res.status, 201);
  assert.ok(lead?.activities.some((a) => a.detail.includes("Budget range: £2,500+")));
});
