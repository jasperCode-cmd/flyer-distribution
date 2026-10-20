import { nextMapColour } from "./colours";
import { circleGeometry } from "./geometry";
import type { PlannerArea, PlannerDistributor } from "./types";
import type { AreaChanges, NewArea } from "./validate";

// The page's own copy of a change while it's being saved, so the map and
// summary show it at once. Each change is applied here exactly as the
// server applies it (lib/area-planner/service.ts: createArea, updateArea,
// deleteArea), from the same checked input. What only the server can know
// (homes, a Profit cost line) keeps its last saved value until the reply.
//
// The page keeps the areas as last confirmed by the server and the changes
// not yet confirmed, in order; what it shows is the confirmed areas with
// those changes applied on top. A reply only ever updates the confirmed
// areas, so a reply to an older change can't undo a newer one. Pure.

export type PendingChange =
  | { seq: number; type: "create"; tempId: string; area: NewArea }
  | { seq: number; type: "update"; areaId: string; changes: AreaChanges }
  | { seq: number; type: "delete"; areaId: string };

export const TEMP_PREFIX = "new:";

export function isTempId(id: string): boolean {
  return id.startsWith(TEMP_PREFIX);
}

export function provisionalArea(tempId: string, input: NewArea): PlannerArea {
  const circle = input.kind === "CIRCLE";
  return {
    id: tempId,
    kind: input.kind,
    geometry: circle ? circleGeometry(input.centre, input.radiusM) : input.geometry,
    centre: circle ? { lat: input.centre.lat, lng: input.centre.lng } : null,
    radiusM: circle ? input.radiusM : null,
    postcode: null,
    label: null,
    distributorId: input.distributorId,
    leafletCount: null,
    status: input.distributorId ? "ASSIGNED" : "PLANNED",
    households: null,
    payType: null,
    ratePence: null,
    amountPence: null,
    hasCostLine: false,
  };
}

export function applyChanges(area: PlannerArea, changes: AreaChanges): PlannerArea {
  const next: PlannerArea = { ...area };
  if (changes.label !== undefined) next.label = changes.label;
  if (changes.leafletCount !== undefined) next.leafletCount = changes.leafletCount;
  if (changes.payType !== undefined) next.payType = changes.payType;
  if (changes.ratePence !== undefined) next.ratePence = changes.ratePence;
  if (changes.amountPence !== undefined) next.amountPence = changes.amountPence;
  if (changes.status !== undefined) next.status = changes.status;
  if (changes.distributorId !== undefined && changes.distributorId !== area.distributorId) {
    next.distributorId = changes.distributorId;
    // Assigning moves a Planned area to Assigned; unassigning an Assigned
    // one moves it back. A status sent alongside wins.
    if (changes.status === undefined) {
      if (changes.distributorId && area.status === "PLANNED") next.status = "ASSIGNED";
      if (!changes.distributorId && area.status === "ASSIGNED") next.status = "PLANNED";
    }
  }
  if (changes.shape) {
    const shape = changes.shape;
    const circle = shape.kind === "CIRCLE";
    next.kind = shape.kind;
    next.geometry = circle ? circleGeometry(shape.centre, shape.radiusM) : shape.geometry;
    next.centre = circle ? { lat: shape.centre.lat, lng: shape.centre.lng } : null;
    next.radiusM = circle ? shape.radiusM : null;
    next.postcode = null;
  }
  return next;
}

// One change on top of a list of areas. Areas it doesn't touch keep their
// object, so the map can tell what changed by identity alone.
export function applyChange<C extends PendingChange>(areas: PlannerArea[], change: C): PlannerArea[] {
  if (change.type === "create") return [...areas, provisionalArea(change.tempId, change.area)];
  if (change.type === "delete") return areas.filter((a) => a.id !== change.areaId);
  return areas.map((a) => (a.id === change.areaId ? applyChanges(a, change.changes) : a));
}

export function replay<C extends PendingChange>(confirmed: PlannerArea[], pending: C[]): PlannerArea[] {
  return pending.reduce<PlannerArea[]>((areas, change) => applyChange(areas, change), confirmed);
}

// Once a new area is saved, the changes still waiting that point at its
// temporary id point at its real one.
export function renameInChanges<C extends PendingChange>(pending: C[], from: string, to: string): C[] {
  return pending.map((c) => (c.type !== "create" && c.areaId === from ? { ...c, areaId: to } : c));
}

// The changes left once one has failed: a new area that couldn't be saved
// takes the later changes to it with it.
export function withoutFailed<C extends PendingChange>(pending: C[], failed: PendingChange): C[] {
  const gone = failed.type === "create" ? failed.tempId : null;
  return pending.filter((c) => c.seq !== failed.seq && !(gone && c.type !== "create" && c.areaId === gone));
}

// Whether a change alters where areas are, so the homes and overlaps shown
// are out of date until the server's reply.
export function movesAreas(change: PendingChange): boolean {
  return change.type !== "update" || !!change.changes.shape;
}

// The areas whose own homes figure is being worked out again.
export function areasBeingEstimated(pending: PendingChange[]): Set<string> {
  const ids = new Set<string>();
  for (const c of pending) {
    if (c.type === "create") ids.add(c.tempId);
    else if (c.type === "update" && c.changes.shape) ids.add(c.areaId);
  }
  return ids;
}

// Colours for distributors placed on the map before the server has given
// them one, worked out as the server will (nextMapColour, in the order they
// were placed), so a new distributor shows in their colour at once.
export function withPredictedColours(distributors: PlannerDistributor[], areas: PlannerArea[]): PlannerDistributor[] {
  const placed = [...new Set(areas.map((a) => a.distributorId).filter((id): id is string => !!id))];
  const needing = placed.filter((id) => distributors.some((d) => d.id === id && !d.colour));
  if (needing.length === 0) return distributors;
  const taken = distributors.map((d) => d.colour);
  const given = new Map<string, string>();
  for (const id of needing) {
    const colour = nextMapColour(taken);
    given.set(id, colour);
    taken.push(colour);
  }
  return distributors.map((d) => (given.has(d.id) ? { ...d, colour: given.get(d.id)! } : d));
}
