import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { nextMapColour } from "@/lib/area-planner/colours";
import {
  TEMP_PREFIX,
  applyChanges,
  areasBeingEstimated,
  movesAreas,
  provisionalArea,
  renameInChanges,
  replay,
  withPredictedColours,
  withoutFailed,
  type PendingChange,
} from "@/lib/area-planner/optimistic";
import { clearAreaPlannerDataCache } from "@/lib/area-planner/data";
import { createArea, createProject, loadProject, updateArea } from "@/lib/area-planner/service";
import type { PlannerArea } from "@/lib/area-planner/types";
import { validateAreaChanges, validateNewArea } from "@/lib/area-planner/validate";
import { buildData, writeData } from "@/scripts/area-planner/build-lib";
import { makeSampleSource } from "@/scripts/area-planner/make-sample-data";

// The page's own copy of a change while it saves (lib/area-planner/
// optimistic.ts): the order changes are shown in, an older reply never
// undoing a newer change, new areas getting their real ids, a failed change
// coming off, and, against a throwaway local database, every change applied
// on the page exactly as the server saves it. All data here is made up.

const square = (x: number, y: number, size = 0.005) => ({
  type: "Polygon" as const,
  coordinates: [[[x, y], [x + size, y], [x + size, y + size], [x, y + size], [x, y]]],
});

function area(id: string, extra: Partial<PlannerArea> = {}): PlannerArea {
  return {
    id,
    kind: "POLYGON",
    geometry: square(-1.86, 50.73),
    centre: null,
    radiusM: null,
    postcode: null,
    label: null,
    distributorId: null,
    leafletCount: null,
    status: "PLANNED",
    households: 120,
    payType: null,
    ratePence: null,
    amountPence: null,
    hasCostLine: false,
    ...extra,
  };
}

function changes(body: Record<string, unknown>) {
  const checked = validateAreaChanges(body);
  assert.ok(checked.ok, "a valid change");
  return checked.changes;
}

test("the page shows the saved areas with every change still waiting on top, in order", () => {
  const confirmed = [area("a"), area("b")];
  const pending: PendingChange[] = [
    { seq: 1, type: "update", areaId: "a", changes: changes({ label: "First" }) },
    { seq: 2, type: "update", areaId: "a", changes: changes({ label: "Second" }) },
  ];
  const shown = replay(confirmed, pending);
  assert.equal(shown[0].label, "Second");
  assert.equal(shown[1], confirmed[1], "an untouched area keeps its object");

  // The reply to the first change arrives: the saved copy now says First,
  // but the second change is still waiting, so the page still says Second.
  const afterFirstReply = replay([{ ...confirmed[0], label: "First" }, confirmed[1]], pending.slice(1));
  assert.equal(afterFirstReply[0].label, "Second", "an older reply never undoes a newer change");
});

test("a new area shows at once, then takes its real id, and later changes follow it", () => {
  const input = validateNewArea({ kind: "CIRCLE", centre: { lat: 50.73, lng: -1.83 }, radiusM: 600, distributorId: "d1" });
  assert.ok(input.ok);
  const tempId = `${TEMP_PREFIX}1`;
  const pending: PendingChange[] = [
    { seq: 1, type: "create", tempId, area: input.area },
    { seq: 2, type: "update", areaId: tempId, changes: changes({ leafletCount: "1,200" }) },
  ];
  const shown = replay([], pending);
  assert.equal(shown.length, 1);
  assert.equal(shown[0].status, "ASSIGNED");
  assert.equal(shown[0].leafletCount, 1200);
  assert.deepEqual([...areasBeingEstimated(pending)], [tempId]);
  const renamed = renameInChanges(pending.slice(1), tempId, "real-1");
  assert.deepEqual(renamed.map((c) => (c.type === "update" ? c.areaId : null)), ["real-1"]);
});

test("a failed change comes off; a new area that failed takes its later changes with it", () => {
  const tempId = `${TEMP_PREFIX}7`;
  const create: PendingChange = { seq: 7, type: "create", tempId, area: { kind: "RECTANGLE", geometry: square(-1.8, 50.7), distributorId: null } };
  const pending: PendingChange[] = [
    create,
    { seq: 8, type: "update", areaId: tempId, changes: changes({ label: "Gone" }) },
    { seq: 9, type: "update", areaId: "a", changes: changes({ label: "Kept" }) },
  ];
  assert.deepEqual(withoutFailed(pending, create).map((c) => c.seq), [9]);
  assert.deepEqual(withoutFailed(pending, pending[2]).map((c) => c.seq), [7, 8]);
  assert.equal(replay([area("a", { label: "Old" })], withoutFailed(pending, pending[2]))[0].label, "Old", "the failed label is put back");
});

test("which changes move areas (so homes and overlaps are worked out again)", () => {
  assert.equal(movesAreas({ seq: 1, type: "update", areaId: "a", changes: changes({ label: "x" }) }), false);
  assert.equal(movesAreas({ seq: 1, type: "update", areaId: "a", changes: changes({ shape: { kind: "CIRCLE", centre: { lat: 50.7, lng: -1.8 }, radiusM: 300 } }) }), true);
  assert.equal(movesAreas({ seq: 1, type: "delete", areaId: "a" }), true);
});

test("assigning and unassigning moves the status as the server does", () => {
  assert.equal(applyChanges(area("a"), changes({ distributorId: "d1" })).status, "ASSIGNED");
  assert.equal(applyChanges(area("a", { distributorId: "d1", status: "ASSIGNED" }), changes({ distributorId: "" })).status, "PLANNED");
  assert.equal(applyChanges(area("a"), changes({ distributorId: "d1", status: "DONE" })).status, "DONE", "a status sent alongside wins");
  const reshaped = applyChanges(area("a", { kind: "POSTCODE", postcode: "BH6 3" }), changes({ shape: { kind: "POLYGON", geometry: square(-1.85, 50.72) } }));
  assert.equal(reshaped.kind, "POLYGON");
  assert.equal(reshaped.postcode, null, "an edited postcode shape becomes an ordinary shape");
});

test("a newly placed distributor shows the colour the server will give them", () => {
  const distributors = [
    { id: "d1", name: "A", colour: "#2A78D6", active: true },
    { id: "d2", name: "B", colour: null, active: true },
    { id: "d3", name: "C", colour: null, active: true },
  ];
  const shown = withPredictedColours(distributors, [area("x", { distributorId: "d3" }), area("y", { distributorId: "d2" })]);
  const first = nextMapColour(["#2A78D6", null, null]);
  const second = nextMapColour(["#2A78D6", null, null, first]);
  assert.equal(shown.find((d) => d.id === "d3")?.colour, first, "in the order placed");
  assert.equal(shown.find((d) => d.id === "d2")?.colour, second);
  assert.equal(withPredictedColours(distributors, []), distributors, "nothing placed: nothing changes");
});

// --- The page's copy against what the server saves -----------------------------------

const url = process.env.CRM_TEST_DATABASE_URL ?? "";
let host = "";
try {
  host = url ? new URL(url).hostname : "";
} catch {
  host = "";
}
const skip = !["localhost", "127.0.0.1", "::1", "[::1]"].includes(host) ? "set CRM_TEST_DATABASE_URL to a local throwaway database to run" : false;
let prisma: PrismaClient | null = null;
let dataDir = "";

before(async () => {
  if (skip) return;
  prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  dataDir = await mkdtemp(join(tmpdir(), "ap-optimistic-data-"));
  await writeData(buildData(makeSampleSource(), { sample: true }), dataDir);
  process.env.AREA_PLANNER_DATA_DIR = dataDir;
  clearAreaPlannerDataCache();
  await prisma.areaProject.deleteMany({ where: { name: { startsWith: "AP Optimistic Test" } } });
  await prisma.distributor.deleteMany({ where: { name: { startsWith: "AP Optimistic Test" } } });
});

after(async () => {
  if (!prisma) return;
  await prisma.areaProject.deleteMany({ where: { name: { startsWith: "AP Optimistic Test" } } });
  await prisma.distributor.deleteMany({ where: { name: { startsWith: "AP Optimistic Test" } } });
  await prisma.$disconnect();
  if (dataDir) await rm(dataDir, { recursive: true, force: true });
});

const SHOWN_FIELDS = ["kind", "geometry", "centre", "radiusM", "postcode", "label", "distributorId", "leafletCount", "status", "payType", "ratePence", "amountPence"] as const;
const shownPart = (a: PlannerArea) => Object.fromEntries(SHOWN_FIELDS.map((k) => [k, a[k]]));

test("every change shows on the page exactly as the server saves it", { skip }, async () => {
  const db = prisma!;
  const sam = await db.distributor.create({ data: { name: "AP Optimistic Test Sam", active: true }, select: { id: true } });
  const projectId = await createProject(db, { leadId: null, name: "AP Optimistic Test", notes: null, business: "FDH" });

  const newBody = { kind: "CIRCLE", centre: { lat: 50.7353, lng: -1.8395 }, radiusM: 650, distributorId: null };
  const checkedNew = validateNewArea(newBody);
  assert.ok(checkedNew.ok);
  const saved = await createArea(db, projectId, checkedNew.area);
  assert.deepEqual(shownPart(provisionalArea(saved.id, checkedNew.area)), shownPart(saved), "a new circle");

  const bodies: Record<string, unknown>[] = [
    { distributorId: sam.id },
    { leafletCount: "2,400", label: "  Southbourne   north " },
    { payType: "PER_THOUSAND", rate: "45.50" },
    { payType: "FLAT", amount: "120" },
    { status: "DONE" },
    { distributorId: "" },
    { distributorId: sam.id, status: "PLANNED" },
    { shape: { kind: "CIRCLE", centre: { lat: 50.736, lng: -1.84 }, radiusM: 900 } },
    { shape: { kind: "RECTANGLE", geometry: square(-1.8512345678, 50.7312345678, 0.004) } },
    { payType: null, label: "" },
  ];
  let shown = saved;
  for (const body of bodies) {
    const checked = validateAreaChanges(body);
    assert.ok(checked.ok, JSON.stringify(body));
    shown = applyChanges(shown, checked.changes);
    const { area: fromServer } = await updateArea(db, saved.id, checked.changes);
    assert.deepEqual(shownPart(shown), shownPart(fromServer), `after ${JSON.stringify(body)}`);
    shown = fromServer;
  }
  const project = await loadProject(db, projectId);
  assert.deepEqual(shownPart(project!.areas[0]), shownPart(shown), "and as loaded afterwards");
});
