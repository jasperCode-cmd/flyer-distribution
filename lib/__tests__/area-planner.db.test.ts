import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import {
  AreaPlannerError,
  createArea,
  createPostcodeAreas,
  createProject,
  createShareLink,
  deleteArea,
  loadProject,
  resolveShareToken,
  revokeShareLinks,
  shareViewForDistributor,
  updateArea,
  updateProject,
} from "@/lib/area-planner/service";
import { clearAreaPlannerDataCache } from "@/lib/area-planner/data";
import { DISTRIBUTOR_COLOURS } from "@/lib/area-planner/colours";
import { loadProfitJob } from "@/lib/profit-data";
import { buildData, writeData } from "@/scripts/area-planner/build-lib";
import { makeSampleSource } from "@/scripts/area-planner/make-sample-data";

// The Area Planner against a real database, but only a throwaway local one:
// it needs CRM_TEST_DATABASE_URL pointing at localhost and is skipped
// otherwise, so it can never touch the production database. Postcode shapes
// come from made-up sample data built into a temp folder. Every lead and
// distributor here is made up, named "AP Test ...", and removed after.

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

let prisma: PrismaClient;
let dataDir = "";
const ids = { sam: "", kim: "", old: "", wonLead: "", wonLead2: "", ldbLead: "", lostLead: "" };

const CENTRE = { lat: 50.735, lng: -1.83 };
const square = (x: number, y: number, size = 0.005) => ({
  type: "Polygon" as const,
  coordinates: [[[x, y], [x + size, y], [x + size, y + size], [x, y + size], [x, y]]],
});

async function cleanUp() {
  await prisma.areaProject.deleteMany({ where: { OR: [{ name: { startsWith: "AP Test" } }, { lead: { name: { startsWith: "AP Test" } } }] } });
  await prisma.lead.deleteMany({ where: { name: { startsWith: "AP Test" } } });
  await prisma.distributor.deleteMany({ where: { name: { startsWith: "AP Test" } } });
}

before(async () => {
  if (skip) return;
  prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  await cleanUp();
  dataDir = await mkdtemp(join(tmpdir(), "ap-db-data-"));
  await writeData(buildData(makeSampleSource(), { sample: true }), dataDir);
  process.env.AREA_PLANNER_DATA_DIR = dataDir;
  clearAreaPlannerDataCache();
  const d = (name: string, active = true) => prisma.distributor.create({ data: { name, active }, select: { id: true } });
  ids.sam = (await d("AP Test Sam")).id;
  ids.kim = (await d("AP Test Kim")).id;
  ids.old = (await d("AP Test Old", false)).id;
  const lead = (name: string, stage: "WON" | "LOST", business: "FDH" | "LDB" = "FDH") =>
    prisma.lead.create({ data: { name, stage, business, leafletQuantity: "5000", wonAt: stage === "WON" ? new Date("2026-10-01T10:00:00Z") : null }, select: { id: true } });
  ids.wonLead = (await lead("AP Test Mitchell Interiors", "WON")).id;
  ids.wonLead2 = (await lead("AP Test Second Job", "WON")).id;
  ids.ldbLead = (await lead("AP Test Bournemouth Job", "WON", "LDB")).id;
  ids.lostLead = (await lead("AP Test Lost Job", "LOST")).id;
});

after(async () => {
  if (skip) return;
  await cleanUp();
  await prisma.$disconnect();
  delete process.env.AREA_PLANNER_DATA_DIR;
  clearAreaPlannerDataCache();
  await rm(dataDir, { recursive: true, force: true });
});

const costFor = (areaId: string) => prisma.jobCost.findUnique({ where: { areaId } });

test("real database: an area's Profit cost line is made, updated and removed with the area", { skip }, async () => {
  const projectId = await createProject(prisma, { leadId: ids.wonLead });
  const project = await prisma.areaProject.findUniqueOrThrow({ where: { id: projectId } });
  assert.equal(project.name, "AP Test Mitchell Interiors");

  // Dropped on empty map: an 800m circle for Sam, Assigned, no pay yet.
  const area = await createArea(prisma, projectId, { kind: "CIRCLE", centre: CENTRE, radiusM: 800, distributorId: ids.sam });
  assert.equal(area.status, "ASSIGNED");
  assert.equal(area.radiusM, 800);
  assert.ok(area.households && area.households > 0, "a household estimate from the sample data");
  assert.equal(await costFor(area.id), null, "no pay, no line");

  await updateArea(prisma, area.id, { leafletCount: 1500, payType: "PER_THOUSAND", ratePence: 4500, amountPence: null });
  let line = await costFor(area.id);
  assert.ok(line);
  assert.deepEqual(
    { leadId: line!.leadId, category: line!.category, distributorId: line!.distributorId, payType: line!.payType, ratePence: line!.ratePence, leafletCount: line!.leafletCount, amountPence: line!.amountPence, note: line!.note },
    { leadId: ids.wonLead, category: "DISTRIBUTOR", distributorId: ids.sam, payType: "PER_THOUSAND", ratePence: 4500, leafletCount: 1500, amountPence: 6750, note: "Area Planner: Circle" }
  );
  const job = await loadProfitJob(prisma, ids.wonLead);
  assert.equal(job?.costs.find((c) => c.id === line!.id)?.fromMap, true, "the Profit page knows it comes from the map");

  await updateArea(prisma, area.id, { leafletCount: 2000, label: "Southbourne" });
  line = await costFor(area.id);
  assert.equal(line?.amountPence, 9000, "updated with the area");
  assert.equal(line?.note, "Area Planner: Southbourne");

  await updateArea(prisma, area.id, { payType: "FLAT", amountPence: 11000, ratePence: null });
  assert.equal((await costFor(area.id))?.amountPence, 11000);

  await updateArea(prisma, area.id, { distributorId: ids.kim });
  assert.equal((await costFor(area.id))?.distributorId, ids.kim, "moves with the area to the new distributor");

  await updateArea(prisma, area.id, { distributorId: null });
  assert.equal(await costFor(area.id), null, "unassigned: the line goes");
  const unassigned = (await loadProject(prisma, projectId))!.areas.find((a) => a.id === area.id)!;
  assert.equal(unassigned.status, "PLANNED");
  assert.equal(unassigned.payType, "FLAT", "the pay stays on the area");

  await updateArea(prisma, area.id, { distributorId: ids.sam });
  const lineId = (await costFor(area.id))!.id;
  await deleteArea(prisma, area.id);
  assert.equal(await prisma.jobCost.findUnique({ where: { id: lineId } }), null, "deleted with the area");
});

test("real database: a map-only project holds its costs until it is linked to a Won job", { skip }, async () => {
  const projectId = await createProject(prisma, { leadId: null, name: "AP Test Poole drop", notes: null, business: "FDH" });
  const a = await createArea(prisma, projectId, { kind: "RECTANGLE", geometry: square(-1.86, 50.73), distributorId: ids.sam });
  await updateArea(prisma, a.id, { leafletCount: 1000, payType: "FLAT", amountPence: 5000, ratePence: null });
  const b = await createArea(prisma, projectId, { kind: "POLYGON", geometry: square(-1.85, 50.74), distributorId: ids.kim });
  await updateArea(prisma, b.id, { leafletCount: 800 });
  assert.equal(await prisma.jobCost.count({ where: { areaId: { in: [a.id, b.id] } } }), 0, "held: no lead yet");

  await assert.rejects(updateProject(prisma, projectId, { leadId: ids.lostLead }), (e: AreaPlannerError) => e.status === 409);
  await updateProject(prisma, projectId, { leadId: ids.wonLead2 });
  const lines = await prisma.jobCost.findMany({ where: { areaId: { in: [a.id, b.id] } } });
  assert.deepEqual(lines.map((l) => [l.areaId, l.leadId, l.amountPence]), [[a.id, ids.wonLead2, 5000]], "made on linking; the area with no pay makes none");

  await assert.rejects(createProject(prisma, { leadId: ids.wonLead2 }), (e: AreaPlannerError) => e.status === 409, "one project per job");

  await updateProject(prisma, projectId, { leadId: null });
  assert.equal(await prisma.jobCost.count({ where: { areaId: { in: [a.id, b.id] } } }), 0, "unlinked: held again");
  const again = await loadProject(prisma, projectId);
  assert.equal(again?.lead, null);
  assert.equal(again?.areas.find((x) => x.id === a.id)?.amountPence, 5000);
});

test("real database: distributors get one fixed colour the first time they are placed; inactive ones can't be placed", { skip }, async () => {
  const projectId = await createProject(prisma, { leadId: null, name: "AP Test Colours", notes: null, business: "FDH" });
  await createArea(prisma, projectId, { kind: "CIRCLE", centre: CENTRE, radiusM: 500, distributorId: ids.sam });
  const sam = await prisma.distributor.findUniqueOrThrow({ where: { id: ids.sam } });
  assert.ok((DISTRIBUTOR_COLOURS as readonly string[]).includes(sam.mapColour!));
  const colour = sam.mapColour;
  await createArea(prisma, projectId, { kind: "CIRCLE", centre: { lat: 50.74, lng: -1.84 }, radiusM: 500, distributorId: ids.sam });
  assert.equal((await prisma.distributor.findUniqueOrThrow({ where: { id: ids.sam } })).mapColour, colour, "never changes");
  await assert.rejects(
    createArea(prisma, projectId, { kind: "CIRCLE", centre: CENTRE, radiusM: 500, distributorId: ids.old }),
    (e: AreaPlannerError) => e.status === 400
  );
});

test("real database: postcode districts and sectors become shapes; unknown and unmappable ones are listed", { skip }, async () => {
  const projectId = await createProject(prisma, { leadId: null, name: "AP Test Postcodes", notes: null, business: "FDH" });
  const { created, problems } = await createPostcodeAreas(prisma, projectId, "BH6 3, BH7, BH1 9, SW1, BH99, BH6 3AB, BH63");
  assert.deepEqual(created.map((a) => [a.kind, a.postcode]), [
    ["POSTCODE", "BH6 3"],
    ["POSTCODE", "BH7"],
  ]);
  assert.ok(created.every((a) => (a.households ?? 0) > 0));
  const reasons = Object.fromEntries(problems.map((p) => [p.input, p.reason]));
  assert.match(reasons["BH1 9"], /too small to map from open data/);
  assert.match(reasons.SW1, /^outside the areas/);
  assert.equal(reasons.BH99, "no such postcode district");
  assert.match(reasons["BH6 3AB"], /full postcode/);
  assert.equal(reasons.BH63, "no such postcode district: did you mean BH6 3?");
});

test("real database: overlapping areas are reported with where they overlap, and homes are counted once", { skip }, async () => {
  const projectId = await createProject(prisma, { leadId: null, name: "AP Test Overlaps", notes: null, business: "FDH" });
  await createArea(prisma, projectId, { kind: "POLYGON", geometry: square(-1.86, 50.73, 0.01), distributorId: ids.sam });
  await createArea(prisma, projectId, { kind: "POLYGON", geometry: square(-1.855, 50.73, 0.01), distributorId: ids.kim });
  const project = await loadProject(prisma, projectId);
  assert.equal(project?.overlaps.length, 1);
  assert.ok(project!.overlaps[0].areaM2 > 0 && project!.overlaps[0].households! > 0);
  const sum = project!.areas.reduce((n, a) => n + (a.households ?? 0), 0);
  assert.ok(project!.totalHouseholds! < sum, "the overlap is counted once");
});

test("real database: a private link shows only that distributor's areas; revoked, replaced and expired links stop working", { skip }, async () => {
  const projectId = await createProject(prisma, { leadId: null, name: "AP Test Links", notes: null, business: "FDH" });
  await updateProject(prisma, projectId, { distributorTitle: "Christchurch leaflets" });
  const mine = await createArea(prisma, projectId, { kind: "POLYGON", geometry: square(-1.8, 50.73), distributorId: ids.sam });
  await updateArea(prisma, mine.id, { leafletCount: 1200, label: "Mudeford", payType: "FLAT", amountPence: 7000, ratePence: null });
  const theirs = await createArea(prisma, projectId, { kind: "POLYGON", geometry: square(-1.79, 50.74), distributorId: ids.kim });
  await updateArea(prisma, theirs.id, { leafletCount: 900, label: "Kim's street" });

  const token = await createShareLink(prisma, projectId, ids.sam);
  const stored = await prisma.areaShareLink.findFirstOrThrow({ where: { projectId, distributorId: ids.sam } });
  assert.notEqual(stored.tokenHash, token, "only the hash is stored");
  const view = await resolveShareToken(prisma, token);
  assert.ok(view);
  assert.deepEqual(view!.areas.map((a) => [a.label, a.leafletCount]), [["Mudeford", 1200]]);
  assert.equal(view!.title, "Christchurch leaflets");
  assert.equal(view!.distributor.name, "AP Test Sam");
  const text = JSON.stringify(view);
  for (const hidden of ["Kim", "7000", "70.00", "AP Test Links", theirs.id, "households", "payType"]) assert.ok(!text.includes(hidden), `${hidden} must not appear`);
  assert.deepEqual(await shareViewForDistributor(prisma, projectId, ids.sam), view, "the image gets exactly the same view");

  assert.equal(await resolveShareToken(prisma, "not-a-token"), null);
  assert.equal(await resolveShareToken(prisma, token.replace(/.$/, token.endsWith("A") ? "B" : "A")), null);

  const replacement = await createShareLink(prisma, projectId, ids.sam);
  assert.equal(await resolveShareToken(prisma, token), null, "replaced: the old link stops");
  assert.ok(await resolveShareToken(prisma, replacement));
  await revokeShareLinks(prisma, projectId, ids.sam);
  assert.equal(await resolveShareToken(prisma, replacement), null, "revoked at once");

  const live = await createShareLink(prisma, projectId, ids.sam);
  const closedAt = new Date();
  await updateProject(prisma, projectId, { closed: true }, closedAt);
  const link = await prisma.areaShareLink.findFirstOrThrow({ where: { projectId, distributorId: ids.sam, revokedAt: null } });
  assert.equal(link.expiresAt?.getTime(), closedAt.getTime() + 14 * 24 * 60 * 60 * 1000);
  assert.ok(await resolveShareToken(prisma, live, new Date(closedAt.getTime() + 13 * 24 * 60 * 60 * 1000)), "still works 13 days after closing");
  assert.equal(await resolveShareToken(prisma, live, new Date(closedAt.getTime() + 15 * 24 * 60 * 60 * 1000)), null, "expired 14 days after closing");
  await assert.rejects(createArea(prisma, projectId, { kind: "CIRCLE", centre: CENTRE, radiusM: 500, distributorId: null }), (e: AreaPlannerError) => e.status === 409);
  await assert.rejects(createShareLink(prisma, projectId, ids.sam), (e: AreaPlannerError) => e.status === 409);

  // Reopened in time, the link carries on.
  await updateProject(prisma, projectId, { closed: false }, new Date(closedAt.getTime() + 60_000));
  assert.ok(await resolveShareToken(prisma, live, new Date(closedAt.getTime() + 30 * 24 * 60 * 60 * 1000)));
});

test("real database: a Bournemouth project's links are off until switched on, and work only while on", { skip }, async () => {
  const projectId = await createProject(prisma, { leadId: ids.ldbLead });
  assert.equal((await loadProject(prisma, projectId))?.business, "LDB");
  await createArea(prisma, projectId, { kind: "POLYGON", geometry: square(-1.8, 50.73), distributorId: ids.sam });
  await assert.rejects(createShareLink(prisma, projectId, ids.sam), (e: AreaPlannerError) => e.status === 409 && /switched off/.test(e.message));
  const view = await shareViewForDistributor(prisma, projectId, ids.sam);
  assert.equal(view.business, "LDB", "the image is still available");
  assert.equal(view.title, "Leaflet delivery, October 2026");
  assert.ok(!JSON.stringify(view).includes("Bournemouth Job"), "no client name");

  await updateProject(prisma, projectId, { ldbLinksEnabled: true });
  const token = await createShareLink(prisma, projectId, ids.sam);
  assert.equal((await resolveShareToken(prisma, token))?.business, "LDB");
  await updateProject(prisma, projectId, { ldbLinksEnabled: false });
  assert.equal(await resolveShareToken(prisma, token), null, "switched off: the link stops");
});
