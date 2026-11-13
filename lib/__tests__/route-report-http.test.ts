import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { join } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { imageToLngLat, toMercator, type PointPair, type Transform } from "@/lib/rounds/alignment";
import { localPlane, type LngLat } from "@/lib/rounds/geometry";
import { createReportLink, createRound, revokeReportLink, saveScreenshotWork } from "@/lib/rounds/service";
import { REPORT_CSP } from "@/lib/security-headers";

// A client's route report page, served by a local production build that
// uses the same throwaway local database as this test (both must be local:
// QUOTE_FORM_TEST_URL and CRM_TEST_DATABASE_URL; skipped otherwise). The
// page shows only its own client's rounds and nothing CRM-only; revoked,
// expired, unknown and malformed links are plain 404s; it is never indexed,
// carries the site's security headers, is left out of the sitemap, fits a
// phone, and links nowhere but the business's own website and email (and
// the map's credit).

const BASE = process.env.QUOTE_FORM_TEST_URL ?? "";
const DB = process.env.CRM_TEST_DATABASE_URL ?? "";
const isLocal = (u: string) => {
  try {
    return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(new URL(u).hostname);
  } catch {
    return false;
  }
};
const skip = !isLocal(BASE) || !isLocal(DB) ? "set QUOTE_FORM_TEST_URL and CRM_TEST_DATABASE_URL to a local build and database to run" : false;

/* eslint-disable @typescript-eslint/no-explicit-any */
let playwright: { chromium: { launch(): Promise<any> } } | null = null;
try {
  if (!skip) playwright = createRequire(join(process.cwd(), "package.json"))("playwright");
} catch {
  playwright = null;
}

const DOMAIN = "@route-report-http-test.example";
const MARK = "route-report-http-test";
const SECRETS = [`${MARK} Desmond Distributor`, `${MARK} PRIVATE NOTE side gate`, "Oscar Otherclient", "Otherclient Opticians", "4321.99"];
let prisma: PrismaClient;
const tokens: Record<string, string> = {};

const RINGWOOD: LngLat = [-1.7917, 50.8461];
const plane = localPlane(RINGWOOD[1]);
const at = (east: number, north: number): LngLat => {
  const [x, y] = plane.to(RINGWOOD);
  return plane.from([x + east, y + north]);
};
const T: Transform = (() => {
  const [x, y] = toMercator(RINGWOOD);
  const scale = 1 / Math.cos((RINGWOOD[1] * Math.PI) / 180);
  return { scale, rotationDeg: 0, offsetX: x - 370 * scale, offsetY: y - 800 * scale };
})();
const PAIRS: PointPair[] = [
  { image: [100, 300], map: imageToLngLat(T, [100, 300]) },
  { image: [620, 1400], map: imageToLngLat(T, [620, 1400]) },
];

async function cleanUp() {
  const leads = (await prisma.lead.findMany({ where: { email: { endsWith: DOMAIN } }, select: { id: true } })).map((l) => l.id);
  await prisma.round.deleteMany({ where: { leadId: { in: leads } } });
  await prisma.lead.deleteMany({ where: { id: { in: leads } } });
  await prisma.distributor.deleteMany({ where: { name: { startsWith: MARK } } });
}

async function client(name: string, businessName: string, date: string, east: number) {
  const lead = await prisma.lead.create({
    data: { name, businessName, email: `${name.split(" ")[0].toLowerCase()}${DOMAIN}`, stage: "WON", dealValue: "4321.99" },
    select: { id: true },
  });
  const distributor = await prisma.distributor.create({ data: { name: SECRETS[0] }, select: { id: true } });
  const round = await createRound(prisma, {
    business: "FDH",
    leadId: lead.id,
    projectId: null,
    distributorId: distributor.id,
    date,
    notes: SECRETS[1],
    screenshots: [{ width: 740, height: 1600, sha256: null, originalName: null, takenAt: null }],
  });
  await saveScreenshotWork(prisma, round.screenshotIds[0], {
    pairs: PAIRS,
    route: [[at(east, 0), at(east, 600), at(east + 400, 600), at(east + 400, 0)]],
    markers: { start: at(east, 0), end: at(east + 400, 0) },
  });
  return lead.id;
}

before(async () => {
  if (skip) return;
  prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: DB }) });
  await cleanUp();
  const mine = await client("Hannah Httpclient", "Hannah's Hairdressers", "2026-11-03", 0);
  await client("Oscar Otherclient", "Otherclient Opticians", "2026-11-04", 3000);
  tokens.live = (await createReportLink(prisma, { roundId: null, leadId: mine, expiresOn: null })).token;
  const revoked = await createReportLink(prisma, { roundId: null, leadId: mine, expiresOn: null });
  await revokeReportLink(prisma, revoked.link.id);
  tokens.revoked = revoked.token;
  // A link whose expiry date has passed (the API itself refuses a past date).
  const expired = await createReportLink(prisma, { roundId: null, leadId: mine, expiresOn: null });
  await prisma.routeReportLink.update({ where: { id: expired.link.id }, data: { expiresAt: new Date("2026-01-01T00:00:00Z") } });
  tokens.expired = expired.token;
});

after(async () => {
  if (skip) return;
  await cleanUp();
  await prisma.$disconnect();
});

test("a live report: its client's round, none of another client's, nothing CRM-only, never indexed, the site's security headers", { skip }, async () => {
  const res = await fetch(`${BASE}/route-report/${tokens.live}`);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /Leaflet delivery report/);
  assert.match(html, /Hannah&#x27;s Hairdressers|Hannah's Hairdressers/);
  assert.match(html, /Tuesday 3 November 2026/);
  assert.doesNotMatch(html, /Wednesday 4 November 2026/, "another client's round");
  for (const secret of SECRETS) assert.ok(!html.includes(secret), `"${secret}" reached the page`);
  assert.doesNotMatch(html, /\/admin\/crm|\/api\/crm/, "no way into the CRM");
  assert.match(html, /<meta name="robots" content="noindex, nofollow, nocache"/);
  assert.equal(res.headers.get("x-robots-tag"), "noindex, nofollow, noarchive");
  assert.equal(res.headers.get("content-security-policy"), REPORT_CSP);
  assert.equal(res.headers.get("x-frame-options"), "DENY");
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  assert.equal(res.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
  assert.match(res.headers.get("strict-transport-security") ?? "", /max-age=63072000/);
});

test("revoked, expired, unknown and malformed links are a plain 404", { skip }, async () => {
  for (const [what, token] of [
    ["revoked", tokens.revoked],
    ["expired", tokens.expired],
    ["unknown", "A".repeat(43)],
    ["malformed", "not-a-token"],
  ]) {
    const res = await fetch(`${BASE}/route-report/${token}`);
    assert.equal(res.status, 404, what);
    const html = await res.text();
    for (const secret of SECRETS) assert.ok(!html.includes(secret), `${what}: "${secret}"`);
    assert.doesNotMatch(html, /Hannah/);
  }
  // Screenshots from a dead link, or one not on the report, are not found either.
  assert.equal((await fetch(`${BASE}/route-report/${tokens.revoked}/screenshots/abcdefghij12`)).status, 404);
  assert.equal((await fetch(`${BASE}/route-report/${tokens.live}/screenshots/abcdefghij12`)).status, 404);
});

test("reports are left out of the sitemap", { skip }, async () => {
  const xml = await (await fetch(`${BASE}/sitemap.xml`)).text();
  assert.match(xml, /<urlset/);
  assert.doesNotMatch(xml, /route-report/);
});

test("on a phone: fits the screen, shows the map and the round, and links only to the business's website, its email and the map credit", { skip: skip || (!playwright && "Playwright is not available") }, async () => {
  const browser = await playwright!.chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 664 }, isMobile: true, hasTouch: true });
    await ctx.route("**/*", (route: any) => {
      const u: string = route.request().url();
      return u.startsWith(BASE) ? route.continue() : route.abort();
    });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/route-report/${tokens.live}`, { waitUntil: "networkidle" });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "no sideways scrolling");
    assert.ok(await page.locator(".leaflet-container").isVisible());
    assert.ok(await page.getByText("Tuesday 3 November 2026").isVisible());
    assert.equal(await page.locator("header nav, footer nav").count(), 0, "none of the site's navigation");
    // Every link on the page (the map's own zoom buttons are on-page controls, not links).
    const hrefs: string[] = await page
      .locator("a[href]:not(.leaflet-control-zoom-in):not(.leaflet-control-zoom-out)")
      .evaluateAll((as: Element[]) => as.map((a) => a.getAttribute("href") ?? ""));
    for (const href of hrefs) {
      assert.ok(
        href === "https://www.flyerdistributionhampshire.co.uk" || href === "mailto:flyerdistributionhampshire@gmail.com" || href.startsWith("https://www.openstreetmap.org/copyright"),
        `unexpected link ${href}`
      );
    }
    assert.ok(hrefs.includes("https://www.flyerdistributionhampshire.co.uk"));
    await ctx.close();
  } finally {
    await browser.close();
  }
});
