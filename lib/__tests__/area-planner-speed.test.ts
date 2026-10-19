import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import type { Polygon } from "geojson";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { areaPlannerDataStatus, clearAreaPlannerDataCache, estimateHouseholds, postcodeGeometry } from "@/lib/area-planner/data";
import { circleGeometry, type AreaGeometry } from "@/lib/area-planner/geometry";
import { clearProjectEstimatesCache, projectHouseholds } from "@/lib/area-planner/project-estimates";
import { createPostcodeAreas, createProject, loadProject, updateArea } from "@/lib/area-planner/service";

// The Area Planner's estimates on the real postcode and household data in
// data/area-planner: a project spread from Dorchester to the Isle of Wight
// (which used to take about a minute to save or open) must come out in under
// three seconds from cold, with every figure exactly what the earlier code
// gave. The expected figures below were worked out by that code. Skipped
// when the real data isn't installed. The timed save needs a throwaway local
// database (CRM_TEST_DATABASE_URL on localhost); everything it makes is named
// "AP Speed Test" and removed after.

const SPREAD = ["BH6 3", "BH6 4", "BH6 5", "BH7", "BH5", "BH8 9", "SO14 0", "PO30 1", "SP1 2", "DT1 1"];
const SPREAD_HOMES = [4468, 1813, 4034, 5106, 5484, 3850, 2765, 3256, 1864, 3525];
const SPREAD_TOTAL = 36165;
const TARGET_MS = 3000;

let noData: string | false = false;
before(async () => {
  delete process.env.AREA_PLANNER_DATA_DIR;
  clearAreaPlannerDataCache();
  const status = await areaPlannerDataStatus();
  if (!status.installed || status.sample) noData = "the real Area Planner data isn't installed";
});

function cold() {
  clearAreaPlannerDataCache();
  clearProjectEstimatesCache();
}

async function spreadAreas() {
  return Promise.all(SPREAD.map(async (code) => ({ id: code, geometry: (await postcodeGeometry(code))! })));
}

test("the spread-out project: the same total as before, from cold in under three seconds", async (t) => {
  if (noData) return t.skip(noData);
  const areas = await spreadAreas();
  cold();
  const start = performance.now();
  const result = await projectHouseholds(areas);
  const coldMs = performance.now() - start;
  assert.equal(result.totalHouseholds, SPREAD_TOTAL);
  assert.deepEqual(result.overlaps, []);
  assert.ok(coldMs < TARGET_MS, `took ${Math.round(coldMs)} ms`);

  const again = performance.now();
  assert.equal((await projectHouseholds(areas)).totalHouseholds, SPREAD_TOTAL);
  const warmMs = performance.now() - again;
  assert.ok(warmMs < 250, `unchanged shapes are remembered (took ${Math.round(warmMs)} ms)`);
  t.diagnostic(`spread-out project: ${Math.round(coldMs)} ms cold, ${Math.round(warmMs)} ms with nothing changed`);
});

test("drawn shapes, overlaps and totals: the same figures as before", async (t) => {
  if (noData) return t.skip(noData);
  cold();
  const circles: [string, { lat: number; lng: number }, number][] = [
    ["Bournemouth Square", { lat: 50.7203, lng: -1.8794 }, 5327],
    ["Southsea", { lat: 50.7836, lng: -1.0903 }, 6132],
    ["Salisbury", { lat: 51.0688, lng: -1.7945 }, 4428],
    ["Dorchester", { lat: 50.7154, lng: -2.4368 }, 3064],
    ["the sea off Bournemouth", { lat: 50.66, lng: -1.86 }, 0],
  ];
  for (const [place, centre, homes] of circles) assert.equal(await estimateHouseholds(circleGeometry(centre, 800)), homes, place);

  const circle = circleGeometry({ lat: 50.725134, lng: -1.803189 }, 700);
  const [x, y] = [-1.799189, 50.721134];
  const rectangle: Polygon = { type: "Polygon", coordinates: [[[x, y], [x + 0.016, y], [x + 0.016, y + 0.008], [x, y + 0.008], [x, y]]] };
  assert.equal(await estimateHouseholds(circle), 3561);
  assert.equal(await estimateHouseholds(rectangle), 2206);
  const areas: { id: string; geometry: AreaGeometry }[] = [
    { id: "BH6 3", geometry: (await postcodeGeometry("BH6 3"))! },
    { id: "circle", geometry: circle },
    { id: "rectangle", geometry: rectangle },
    { id: "SO14 0", geometry: (await postcodeGeometry("SO14 0"))! },
    { id: "DT1 1", geometry: (await postcodeGeometry("DT1 1"))! },
  ];
  const result = await projectHouseholds(areas);
  assert.deepEqual(
    result.overlaps.map((o) => [o.a, o.b, o.households]),
    [["BH6 3", "circle", 3005], ["BH6 3", "rectangle", 1421], ["circle", "rectangle", 1057]]
  );
  assert.equal(result.totalHouseholds, 12020);
});

// --- A timed save, against a throwaway local database ---------------------------------

const url = process.env.CRM_TEST_DATABASE_URL ?? "";
let host = "";
try {
  host = url ? new URL(url).hostname : "";
} catch {
  host = "";
}
const noDb = !["localhost", "127.0.0.1", "::1", "[::1]"].includes(host) ? "set CRM_TEST_DATABASE_URL to a local throwaway database to run" : false;
let prisma: PrismaClient | null = null;

async function cleanUp(db: PrismaClient) {
  await db.areaProject.deleteMany({ where: { name: { startsWith: "AP Speed Test" } } });
  await db.distributor.deleteMany({ where: { name: { startsWith: "AP Speed Test" } } });
}

after(async () => {
  if (!prisma) return;
  await cleanUp(prisma);
  await prisma.$disconnect();
});

test("saving an area on the spread-out project takes under three seconds", async (t) => {
  if (noData) return t.skip(noData);
  if (noDb) return t.skip(noDb);
  const db = (prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) }));
  await cleanUp(db);
  const distributor = await db.distributor.create({ data: { name: "AP Speed Test Sam", active: true }, select: { id: true } });
  const projectId = await createProject(db, { leadId: null, name: "AP Speed Test spread", notes: null, business: "FDH" });
  const { created, problems } = await createPostcodeAreas(db, projectId, [...SPREAD, "BH1 9", "ZZ1 1"].join(", "));
  assert.deepEqual(created.map((a) => a.households), SPREAD_HOMES);
  assert.deepEqual(problems.map((p) => p.input), ["ZZ1 1", "BH1 9"]);

  cold();
  const start = performance.now();
  await updateArea(db, created[0].id, { distributorId: distributor.id, leafletCount: 1200 });
  const project = await loadProject(db, projectId);
  const coldMs = performance.now() - start;
  assert.equal(project?.totalHouseholds, SPREAD_TOTAL);
  assert.deepEqual(project?.overlaps, []);
  assert.ok(coldMs < TARGET_MS, `took ${Math.round(coldMs)} ms`);

  const again = performance.now();
  await updateArea(db, created[0].id, { leafletCount: 1300 });
  assert.equal((await loadProject(db, projectId))?.totalHouseholds, SPREAD_TOTAL);
  const warmMs = performance.now() - again;
  assert.ok(warmMs < TARGET_MS, `took ${Math.round(warmMs)} ms`);
  t.diagnostic(`save and reload: ${Math.round(coldMs)} ms cold, ${Math.round(warmMs)} ms after`);
});
