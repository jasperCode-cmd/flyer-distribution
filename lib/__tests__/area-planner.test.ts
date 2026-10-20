import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Polygon } from "geojson";
import { parsePostcodeList, POSTCODE_AREAS, sectorReading, MAX_POSTCODES } from "@/lib/area-planner/postcodes";
import { DATA_AREAS } from "@/lib/area-planner/data";
import { areaM2, circleGeometry, labelPoint, pointInArea, validateGeometry, MAX_VERTICES } from "@/lib/area-planner/geometry";
import { findOverlaps, overlapOf, MIN_OVERLAP_M2 } from "@/lib/area-planner/overlaps";
import { DISTRIBUTOR_COLOURS, UNASSIGNED_COLOUR, areaColour, nextMapColour } from "@/lib/area-planner/colours";
import { areaPayPence, costLineFor, syncAreaCostLine, type AreaForCost, type CostSyncDb } from "@/lib/area-planner/costs";
import { buildShareView, defaultDistributorTitle, shareFileName, type ShareSource, type ShareView } from "@/lib/area-planner/share-view";
import { hashShareToken, isShareTokenShaped, linkState, newShareToken, shareExpiryFrom, SHARE_EXPIRY_DAYS } from "@/lib/area-planner/share-links";
import { drawShareImage, IMAGE_BRANDS, planImage, type Canvas2D } from "@/lib/area-planner/image";
import { projectSummary } from "@/lib/area-planner/summary";
import { validateAreaChanges, validateNewArea, validateProjectChanges } from "@/lib/area-planner/validate";
import { DELIVERY_CSP, PLANNER_CSP, SITE_CSP, MAP_PAGE_HEADER_RULES } from "@/lib/security-headers";
import { hidesSiteChrome } from "@/lib/site-chrome";
import type { PlannerArea } from "@/lib/area-planner/types";

// The Area Planner's pure rules. All places and people here are made up.

// A square about `size` degrees across with its south-west corner at (x, y).
function square(x: number, y: number, size = 0.01): Polygon {
  return { type: "Polygon", coordinates: [[[x, y], [x + size, y], [x + size, y + size], [x, y + size], [x, y]]] };
}

// --- Postcodes ------------------------------------------------------------------------

test("postcodes: a pasted list of districts becomes one request each", () => {
  const { requests, problems } = parsePostcodeList("BH6, PO14, SO14");
  assert.deepEqual(requests, [
    { input: "BH6", code: "BH6", kind: "district" },
    { input: "PO14", code: "PO14", kind: "district" },
    { input: "SO14", code: "SO14", kind: "district" },
  ]);
  assert.deepEqual(problems, []);
});

test("postcodes: sectors, mixed separators, any case and spacing, and duplicates once", () => {
  const { requests } = parsePostcodeList("bh6 3; BH7   6\nBH8\tsp1 2, BH6 3, BH6  3");
  assert.deepEqual(
    requests.map((r) => [r.code, r.kind]),
    [
      ["BH6 3", "sector"],
      ["BH7 6", "sector"],
      ["BH8", "district"],
      ["SP1 2", "sector"],
    ]
  );
  assert.deepEqual(parsePostcodeList("BH6 BH7 3").requests.map((r) => r.code), ["BH6", "BH7 3"], "space-separated districts split");
});

test("postcodes: invalid and unusable ones are listed with a reason, never dropped", () => {
  const { requests, problems } = parsePostcodeList("XYZ, 12, SW1A 1, BH, BH6 3AB, BH63AB, DT1");
  assert.deepEqual(requests.map((r) => r.code), ["DT1"]);
  const reasons = Object.fromEntries(problems.map((p) => [p.input, p.reason]));
  assert.equal(reasons.XYZ, "not a postcode district or sector");
  assert.equal(reasons["12"], "not a postcode district or sector");
  assert.match(reasons["SW1A 1"], /^outside the areas the planner has data for \(BH, SO, PO, SP and DT\)$/);
  assert.match(reasons.BH, /whole postcode area is too big/);
  assert.equal(reasons["BH6 3AB"], "a full postcode: use its sector, BH6 3");
  assert.equal(reasons.BH63AB, "a full postcode: use its sector, BH6 3");
  assert.equal(problems.length, 6);
});

test("postcodes: no more than the limit at once, the rest listed", () => {
  const many = Array.from({ length: MAX_POSTCODES + 3 }, (_, i) => `BH${i + 1}`).join(",");
  const { requests, problems } = parsePostcodeList(many);
  assert.equal(requests.length, MAX_POSTCODES);
  assert.equal(problems.length, 3);
  assert.match(problems[0].reason, /more than 50 at once/);
});

test("postcodes: a run-together sector is offered as a suggestion, and the areas match the data's", () => {
  assert.equal(sectorReading("BH63"), "BH6 3");
  assert.equal(sectorReading("BH6"), null);
  assert.deepEqual([...POSTCODE_AREAS], [...DATA_AREAS]);
});

// --- Geometry ------------------------------------------------------------------------

test("geometry: shapes from the browser are checked, rounded and closed", () => {
  const open = { type: "Polygon", coordinates: [[[-1.8, 50.72], [-1.79, 50.72], [-1.79, 50.73], [-1.8, 50.73]]] };
  const checked = validateGeometry(open);
  assert.ok(checked.ok);
  if (checked.ok && checked.geometry.type === "Polygon") {
    const ring = checked.geometry.coordinates[0];
    assert.deepEqual(ring[0], ring[ring.length - 1], "closed");
  }
  assert.equal(validateGeometry({ type: "Point", coordinates: [-1.8, 50.7] }).ok, false);
  assert.equal(validateGeometry({ type: "Polygon", coordinates: [[[-1.8, 50.7], [-1.79, 50.7], [-1.8, 50.7]]] }).ok, false, "too few points");
  assert.equal(validateGeometry(square(20, 50)).ok, false, "off the map");
  assert.equal(validateGeometry({ type: "Polygon", coordinates: [[["a", 1]]] }).ok, false);
  assert.equal(validateGeometry(square(-1.8, 50.72, 0.00005)).ok, false, "too small to deliver");
  const huge = { type: "Polygon", coordinates: [Array.from({ length: MAX_VERTICES + 2 }, (_, i) => [-1.8 + Math.cos(i) * 0.01, 50.72 + Math.sin(i) * 0.01])] };
  assert.equal(validateGeometry(huge).ok, false, "too many points");
});

test("geometry: an 800m circle has the area of an 800m circle, and its label sits inside", () => {
  const circle = circleGeometry({ lat: 50.72, lng: -1.8 }, 800);
  const expected = Math.PI * 800 * 800;
  assert.ok(Math.abs(areaM2(circle) - expected) / expected < 0.01);
  const at = labelPoint(circle);
  assert.ok(Math.abs(at.lat - 50.72) < 0.001 && Math.abs(at.lng + 1.8) < 0.001);
  // A C shape, whose centre is outside it: the label still lands inside.
  const c: Polygon = { type: "Polygon", coordinates: [[[0, 0], [3, 0], [3, 1], [1, 1], [1, 2], [3, 2], [3, 3], [0, 3], [0, 0]]].map((r) => r.map(([x, y]) => [-1.9 + x * 0.01, 50.7 + y * 0.01])) };
  assert.ok(pointInArea(labelPoint(c), c));
});

// --- Overlaps ------------------------------------------------------------------------

test("overlaps: two overlapping areas are found, with where and how big", () => {
  const a = square(-1.8, 50.72, 0.01);
  const b = square(-1.795, 50.72, 0.01); // overlaps the east half of a
  const found = overlapOf(a, b);
  assert.ok(found);
  const ratio = found!.areaM2 / areaM2(a);
  assert.ok(Math.abs(ratio - 0.5) < 0.01, `about half of a, got ${ratio}`);
  assert.deepEqual(
    findOverlaps([{ id: "a", geometry: a }, { id: "b", geometry: b }]).map((o) => [o.a, o.b]),
    [["a", "b"]]
  );
});

test("overlaps: neighbours sharing an edge, areas far apart and a sliver don't count", () => {
  const a = square(-1.8, 50.72, 0.01);
  assert.equal(overlapOf(a, square(-1.79, 50.72, 0.01)), null, "shared edge");
  assert.equal(overlapOf(a, square(-1.7, 50.72, 0.01)), null, "far apart");
  const sliver = square(-1.7901, 50.72, 0.01); // overlaps by 0.0001 degrees, about 7m wide
  const tiny = overlapOf(a, sliver);
  assert.ok(tiny === null || tiny.areaM2 >= MIN_OVERLAP_M2);
  const threeWay = findOverlaps([
    { id: "a", geometry: a },
    { id: "b", geometry: square(-1.795, 50.72) },
    { id: "c", geometry: square(-1.797, 50.725) },
  ]);
  assert.equal(threeWay.length, 3, "every pair is checked");
  assert.ok(threeWay[0].areaM2 >= threeWay[1].areaM2, "largest first");
});

// --- Colours ------------------------------------------------------------------------

test("colours: given in order, then the least used; unassigned is grey", () => {
  assert.equal(nextMapColour([]), DISTRIBUTOR_COLOURS[0]);
  assert.equal(nextMapColour([DISTRIBUTOR_COLOURS[0], null]), DISTRIBUTOR_COLOURS[1]);
  assert.equal(nextMapColour([...DISTRIBUTOR_COLOURS, DISTRIBUTOR_COLOURS[0]]), DISTRIBUTOR_COLOURS[1]);
  assert.equal(areaColour("#2A78D6", false), UNASSIGNED_COLOUR);
  assert.equal(areaColour("#2A78D6", true), "#2A78D6");
  assert.ok(!(DISTRIBUTOR_COLOURS as readonly string[]).includes("#E34948"), "red is kept for overlaps");
});

// --- Cost lines ------------------------------------------------------------------------

const AREA: AreaForCost & { id: string } = {
  id: "area-1",
  distributorId: "d1",
  leafletCount: 1500,
  label: "Southbourne north",
  postcode: null,
  kind: "POLYGON",
  payType: "PER_THOUSAND",
  ratePence: 4500,
  amountPence: null,
};

test("cost lines: an area with a distributor, leaflets and pay makes one Distributor line, worked out like the Profit page", () => {
  assert.deepEqual(costLineFor(AREA), {
    category: "DISTRIBUTOR",
    distributorId: "d1",
    payType: "PER_THOUSAND",
    ratePence: 4500,
    leafletCount: 1500,
    amountPence: 6750,
    label: null,
    note: "Area Planner: Southbourne north",
  });
  const flat = costLineFor({ ...AREA, payType: "FLAT", amountPence: 12000, ratePence: null });
  assert.equal(flat?.amountPence, 12000);
  assert.equal(flat?.payType, "FLAT");
  assert.equal(costLineFor({ ...AREA, label: null, postcode: "BH6 3", kind: "POSTCODE" })?.note, "Area Planner: BH6 3");
});

test("cost lines: no distributor, no leaflets or no pay means no line (pay not set)", () => {
  assert.equal(costLineFor({ ...AREA, distributorId: null }), null);
  assert.equal(costLineFor({ ...AREA, leafletCount: null }), null);
  assert.equal(costLineFor({ ...AREA, payType: null }), null);
  assert.equal(costLineFor({ ...AREA, ratePence: null }), null);
  assert.equal(costLineFor({ ...AREA, payType: "FLAT", amountPence: null }), null);
  assert.equal(areaPayPence({ ...AREA, payType: null }), null);
  assert.equal(areaPayPence(AREA), 6750);
});

function fakeCostDb(existing: string | null) {
  const calls: string[] = [];
  const db: CostSyncDb = {
    jobCost: {
      async findUnique() {
        return existing ? { id: existing } : null;
      },
      async create(args) {
        calls.push(`create ${args.data.leadId} ${args.data.areaId} ${args.data.amountPence}`);
      },
      async update(args) {
        calls.push(`update ${args.where.id} ${args.data.leadId} ${args.data.amountPence}`);
      },
      async delete(args) {
        calls.push(`delete ${args.where.id}`);
      },
    },
  };
  return { db, calls };
}

test("cost lines: kept in step with the area: created, updated, removed, or held on a map-only project", async () => {
  let f = fakeCostDb(null);
  assert.equal(await syncAreaCostLine(f.db, AREA, "lead-1"), "created");
  assert.deepEqual(f.calls, ["create lead-1 area-1 6750"]);
  f = fakeCostDb("cost-1");
  assert.equal(await syncAreaCostLine(f.db, { ...AREA, leafletCount: 2000 }, "lead-1"), "updated");
  assert.deepEqual(f.calls, ["update cost-1 lead-1 9000"]);
  f = fakeCostDb("cost-1");
  assert.equal(await syncAreaCostLine(f.db, { ...AREA, distributorId: null }, "lead-1"), "removed");
  assert.deepEqual(f.calls, ["delete cost-1"]);
  f = fakeCostDb(null);
  assert.equal(await syncAreaCostLine(f.db, AREA, null), "none", "held: no lead yet");
  assert.deepEqual(f.calls, []);
  f = fakeCostDb("cost-1");
  assert.equal(await syncAreaCostLine(f.db, AREA, null), "removed", "unlinked: the line goes, the pay stays on the area");
});

// --- What distributors see ------------------------------------------------------------------------

const SOURCE: ShareSource = {
  name: "Mitchell Interiors",
  distributorTitle: null,
  business: "LDB",
  createdAt: new Date("2026-10-02T10:00:00Z"),
  campaignStart: new Date("2026-11-03T00:00:00Z"),
  linked: true,
  areas: [
    { id: "a1", distributorId: "sam", label: null, postcode: "BH6 3", leafletCount: 1200, geometry: square(-1.8, 50.72) },
    { id: "a2", distributorId: "sam", label: "Tuckton", postcode: null, leafletCount: 800, geometry: square(-1.79, 50.73) },
    { id: "a3", distributorId: "kim", label: "Kim's patch", postcode: null, leafletCount: 2000, geometry: square(-1.75, 50.74) },
    { id: "a4", distributorId: null, label: "Spare", postcode: null, leafletCount: null, geometry: square(-1.74, 50.75) },
  ],
};
const SAM = { id: "sam", name: "Sam Example", colour: "#2A78D6" };
const NOW = new Date("2026-10-19T12:00:00Z");

test("share view: only that distributor's areas, labels and leaflets, and nothing else at all", () => {
  const view = buildShareView(SOURCE, SAM, NOW);
  assert.deepEqual(Object.keys(view).sort(), ["areas", "business", "campaignStart", "distributor", "preparedOn", "title", "totalLeaflets"]);
  assert.deepEqual(view.areas.map((a) => [a.id, a.label, a.leafletCount]), [
    ["a1", "BH6 3", 1200],
    ["a2", "Tuckton", 800],
  ]);
  for (const area of view.areas) assert.deepEqual(Object.keys(area).sort(), ["geometry", "id", "label", "leafletCount"]);
  assert.equal(view.totalLeaflets, 2000);
  const text = JSON.stringify(view);
  for (const hidden of ["Kim", "Spare", "Mitchell", "a3", "a4"]) assert.ok(!text.includes(hidden), `${hidden} must not appear`);
  assert.equal(view.title, "Leaflet delivery, November 2026", "a lead's project hides the client's name");
  assert.equal(view.preparedOn, "19 Oct 2026");
  assert.equal(view.campaignStart, "3 Nov 2026");
});

test("share view: titles for distributors", () => {
  assert.equal(defaultDistributorTitle({ name: "Poole drop", linked: false, campaignStart: null, createdAt: NOW }), "Poole drop");
  assert.equal(defaultDistributorTitle({ name: "Client Ltd", linked: true, campaignStart: null, createdAt: NOW }), "Leaflet delivery, October 2026");
  assert.equal(buildShareView({ ...SOURCE, distributorTitle: "  Boscombe flyers  " }, SAM, NOW).title, "Boscombe flyers");
  assert.equal(shareFileName({ title: "Leaflet delivery, November 2026", distributor: { name: "Sam Example", colour: "" } }, NOW), "Leaflet-delivery-November-2026-Sam-Example-2026-10-19.png");
});

test("links: tokens are unguessable and only their hash is kept; revoked, expired and switched-off links don't work", () => {
  const token = newShareToken();
  assert.ok(isShareTokenShaped(token));
  assert.notEqual(newShareToken(), token);
  assert.match(hashShareToken(token), /^[0-9a-f]{64}$/);
  assert.equal(isShareTokenShaped("short"), false);
  assert.equal(isShareTokenShaped(`${token}x`), false);
  const fdh = { business: "FDH" as const, ldbLinksEnabled: false };
  assert.equal(linkState({ revokedAt: null, expiresAt: null }, fdh, NOW), "active");
  assert.equal(linkState({ revokedAt: NOW, expiresAt: null }, fdh, NOW), "revoked");
  const closedAt = new Date("2026-10-01T12:00:00Z");
  assert.equal(SHARE_EXPIRY_DAYS, 14);
  assert.deepEqual(shareExpiryFrom(closedAt), new Date("2026-10-15T12:00:00Z"));
  assert.equal(linkState({ revokedAt: null, expiresAt: shareExpiryFrom(closedAt) }, fdh, new Date("2026-10-15T11:59:59Z")), "active");
  assert.equal(linkState({ revokedAt: null, expiresAt: shareExpiryFrom(closedAt) }, fdh, new Date("2026-10-15T12:00:00Z")), "expired");
  assert.equal(linkState({ revokedAt: null, expiresAt: null }, { business: "LDB", ldbLinksEnabled: false }, NOW), "switched-off");
  assert.equal(linkState({ revokedAt: null, expiresAt: null }, { business: "LDB", ldbLinksEnabled: true }, NOW), "active");
});

// --- The image ------------------------------------------------------------------------

// Records everything drawn: every piece of text, and every image's source.
function recordingCanvas() {
  const texts: string[] = [];
  const images: string[] = [];
  const ctx = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    lineJoin: "miter",
    font: "",
    textAlign: "left",
    textBaseline: "alphabetic",
    globalAlpha: 1,
    fillRect() {},
    fillText(text: string) {
      texts.push(text);
    },
    measureText(text: string) {
      return { width: text.length * 11 } as TextMetrics;
    },
    beginPath() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    fill() {},
    stroke() {},
    drawImage(image: { src: string }) {
      images.push(image.src);
    },
    save() {},
    restore() {},
    rect() {},
    clip() {},
  };
  return { ctx: ctx as unknown as Canvas2D, texts, images };
}
const fakeLoad = async (src: string) => ({ src }) as unknown as CanvasImageSource;

test("image: a Bournemouth image carries LDB's name and nothing of FDH, no pay, no client and no other distributor", async () => {
  const view: ShareView = buildShareView(SOURCE, SAM, NOW);
  const { ctx, texts, images } = recordingCanvas();
  const result = await drawShareImage(ctx, view, fakeLoad);
  assert.equal(result.missingTiles, 0);
  assert.ok(texts.includes("Leaflet Distribution Bournemouth"));
  assert.ok(texts.includes("Leaflet delivery, November 2026"));
  assert.ok(texts.includes("Prepared 19 Oct 2026, delivery from 3 Nov 2026"));
  assert.ok(texts.includes("Sam Example"));
  assert.ok(texts.includes("BH6 3: 1,200 leaflets"));
  assert.ok(texts.includes("Tuckton: 800 leaflets"));
  assert.ok(texts.includes("Total: 2,000 leaflets"));
  assert.ok(texts.some((t) => t.startsWith("Map © OpenStreetMap contributors")));
  const everything = [...texts, ...images].join("\n");
  for (const banned of [/flyer distribution/i, /\bFDH\b/, /hampshire/i, /£/, /Kim/, /Mitchell/, /Spare/]) {
    assert.doesNotMatch(everything, banned);
  }
  assert.ok(images.every((src) => src.startsWith("https://tile.openstreetmap.org/")), "only map tiles, no logo");
});

test("image: an FDH image has the FDH heading and logo; a tile that won't load is grey and counted", async () => {
  const view = buildShareView({ ...SOURCE, business: "FDH" }, SAM, NOW);
  const { ctx, texts, images } = recordingCanvas();
  const plan = planImage(view.areas.map((a) => a.geometry));
  const result = await drawShareImage(ctx, view, fakeLoad);
  assert.equal(result.missingTiles, 0);
  assert.ok(texts.includes("Flyer Distribution Hampshire"));
  assert.ok(images.includes(IMAGE_BRANDS.FDH.logo!));
  assert.ok(plan.tiles.length > 0 && plan.zoom >= 10 && plan.zoom <= 17);
  const missing = await drawShareImage(recordingCanvas().ctx, view, async (src) => (src.includes("tile.openstreetmap") ? null : fakeLoad(src)));
  assert.equal(missing.missingTiles, plan.tiles.length);
});

// --- Summary and inputs ------------------------------------------------------------------------

test("summary: leaflets, pay per distributor and pay not set", () => {
  const area = (o: Partial<PlannerArea>): PlannerArea => ({
    id: "x",
    kind: "POLYGON",
    geometry: square(-1.8, 50.72),
    centre: null,
    radiusM: null,
    postcode: null,
    label: null,
    distributorId: null,
    leafletCount: null,
    status: "PLANNED",
    households: null,
    payType: null,
    ratePence: null,
    amountPence: null,
    hasCostLine: false,
    ...o,
  });
  const summary = projectSummary(
    [
      area({ id: "1", distributorId: "sam", leafletCount: 1000, payType: "PER_THOUSAND", ratePence: 5000 }),
      area({ id: "2", distributorId: "sam", leafletCount: 500 }),
      area({ id: "3", distributorId: "kim", leafletCount: 2000, payType: "FLAT", amountPence: 9000 }),
      area({ id: "4" }),
    ],
    [
      { id: "sam", name: "Sam Example", colour: "#2A78D6", active: true },
      { id: "kim", name: "Kim Example", colour: "#EB6834", active: true },
    ],
    5000
  );
  assert.equal(summary.assignedLeaflets, 3500);
  assert.equal(summary.unassignedAreas, 1);
  assert.deepEqual(summary.distributors.map((d) => [d.name, d.leaflets, d.payPence, d.payNotSet]), [
    ["Kim Example", 2000, 9000, false],
    ["Sam Example", 1500, 5000, true],
  ]);
  assert.equal(summary.totalPayPence, 14000);
});

test("inputs: areas and projects are checked before anything is stored", () => {
  assert.deepEqual(validateNewArea({ kind: "CIRCLE", centre: { lat: 50.72, lng: -1.8 } }), {
    ok: true,
    area: { kind: "CIRCLE", centre: { lat: 50.72, lng: -1.8 }, radiusM: 800, distributorId: null },
  });
  assert.equal(validateNewArea({ kind: "CIRCLE", centre: { lat: 50.72, lng: -1.8 }, radiusM: 10 }).ok, false);
  assert.equal(validateNewArea({ kind: "CIRCLE", centre: { lat: 10, lng: 10 } }).ok, false);
  assert.equal(validateNewArea({ kind: "HEXAGON" }).ok, false);
  const changes = validateAreaChanges({ leafletCount: "1,250", label: " North ", payType: "PER_THOUSAND", rate: "£45.50", status: "DONE" });
  assert.deepEqual(changes, { ok: true, changes: { label: "North", leafletCount: 1250, status: "DONE", payType: "PER_THOUSAND", ratePence: 4550, amountPence: null } });
  assert.deepEqual(validateAreaChanges({ payType: null }), { ok: true, changes: { payType: null, ratePence: null, amountPence: null } });
  assert.equal(validateAreaChanges({ leafletCount: "0" }).ok, false);
  assert.equal(validateAreaChanges({ leafletCount: "lots" }).ok, false);
  assert.equal(validateAreaChanges({ payType: "FLAT", amount: "abc" }).ok, false);
  assert.equal(validateAreaChanges({ status: "LOST" }).ok, false);
  assert.equal(validateAreaChanges({ label: "x".repeat(61) }).ok, false);
  assert.deepEqual(validateProjectChanges({ closed: true, distributorTitle: "", targetLeaflets: "" }), {
    ok: true,
    changes: { distributorTitle: null, targetLeaflets: null, closed: true },
  });
  assert.equal(validateProjectChanges({ name: "" }).ok, false);
  assert.equal(validateProjectChanges({ business: "XYZ" }).ok, false);
});

// --- Headers, branding and sessions ------------------------------------------------------------------------

test("CSP: the public site's policy is exactly as before; only the map pages may load tiles, from the one host", () => {
  assert.equal(
    SITE_CSP,
    "default-src 'self'; img-src 'self' images.unsplash.com images.pexels.com data:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self' fonts.gstatic.com; connect-src 'self' api.web3forms.com;"
  );
  assert.equal(PLANNER_CSP, SITE_CSP.replace("data:;", "data: https://tile.openstreetmap.org blob:;"));
  assert.equal(DELIVERY_CSP, SITE_CSP.replace("data:;", "data: https://tile.openstreetmap.org;"));
  assert.deepEqual(MAP_PAGE_HEADER_RULES.map((r) => r.source), ["/admin/crm/map", "/admin/crm/map/:path*", "/delivery/:path*"]);
  const delivery = MAP_PAGE_HEADER_RULES[2].headers.find((h) => h.key === "X-Robots-Tag");
  assert.equal(delivery?.value, "noindex, nofollow, noarchive");
});

test("delivery pages show none of the website around them", () => {
  assert.equal(hidesSiteChrome("/delivery/abc"), true);
  assert.equal(hidesSiteChrome("/admin/crm/map"), true);
  assert.equal(hidesSiteChrome("/"), false);
  assert.equal(hidesSiteChrome("/deliveryx"), false);
  for (const file of ["components/Header.tsx", "components/Footer.tsx", "components/AnnouncementBar.tsx", "components/SlotPopup.tsx", "components/FloatingQuoteButton.tsx", "components/SiteSchema.tsx"]) {
    assert.match(readFileSync(file, "utf8"), /hidesSiteChrome\(pathname\)/, file);
  }
  assert.doesNotMatch(readFileSync("app/layout.tsx", "utf8"), /application\/ld\+json/, "the site's structured data lives in SiteSchema");
  const view = readFileSync("components/delivery/DeliveryView.tsx", "utf8");
  assert.match(view, /showBusiness && <p[^>]*>Flyer Distribution Hampshire<\/p>/, "FDH's name only behind showBusiness");
  assert.doesNotMatch(readFileSync("app/delivery/[token]/page.tsx", "utf8"), /Flyer Distribution|FDH logo/);
});

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? routeFiles(path) : name === "route.ts" ? [path] : [];
  });
}

test("every Area Planner route checks the session itself before anything else", () => {
  const files = routeFiles("app/api/crm/area-planner");
  assert.equal(files.length, 8);
  let handlers = 0;
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    for (const m of source.matchAll(/export async function (GET|POST|PATCH|DELETE)\([^)]*\)[^{]*\{([\s\S]*?)\n\}/g)) {
      handlers++;
      const body = m[2];
      assert.match(body, /^\s*const session = await auth\(\);\s*if \(!session\?\.user\) \{\s*return NextResponse\.json\(\{ error: "Unauthorized" \}, \{ status: 401 \}\);/, `${file} ${m[1]}`);
    }
  }
  assert.equal(handlers, 12);
});

test("the Profit page's cost routes refuse lines made by the map", () => {
  const source = readFileSync("app/api/crm/profit/costs/[id]/route.ts", "utf8");
  assert.equal(source.match(/if \(existing\.areaId\) \{\s*return NextResponse\.json\(\{ error: FROM_MAP \}, \{ status: 409 \}\);/g)?.length, 2);
});
