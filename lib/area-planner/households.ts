import type { MultiPolygon, Polygon, Position } from "geojson";
import { area } from "@turf/area";
import { bbox as bboxOf } from "@turf/bbox";
import { intersect } from "@turf/intersect";
import { feature, featureCollection } from "@turf/helpers";

// The household estimate for any shape: each Census 2021 Output Area's
// household count, weighted by how much of the Output Area falls inside the
// shape (so homes are taken to be spread evenly across each one).
//
// A shape is worked out one polygon part at a time, against only the Output
// Areas near that part. An Output Area whose edges come nowhere near the
// part's edges is wholly inside or wholly outside it, which needs no
// clipping; only the ones the part's edges touch or cross are clipped, and
// a large part is first cut down to a box just around the Output Area, which
// leaves everything inside the Output Area as it was. A shape whose parts
// cross themselves or each other is clipped whole, Output Area by Output
// Area, as before. Either way each Output Area's share and the total come
// out the same. The work comes in small steps, so the server can hand back
// control between them (see the async versions).

export type Bbox = [minLon: number, minLat: number, maxLon: number, maxLat: number];

export type OutputArea = {
  code: string;
  households: number;
  bbox: Bbox;
  geometry: Polygon | MultiPolygon;
};

export function bboxesMeet(a: Bbox, b: Bbox): boolean {
  return a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
}

export function geometryBbox(geometry: Polygon | MultiPolygon): Bbox {
  const [minLon, minLat, maxLon, maxLat] = bboxOf(geometry);
  return [minLon, minLat, maxLon, maxLat];
}

// Rounding in the geometry can push a fully covered Output Area a hair over
// or under, so anything within a millionth of the whole counts as the whole.
function snapShare(share: number): number {
  if (share >= 1 - 1e-6) return 1;
  return share > 0 ? share : 0;
}

// The share of an Output Area inside the shape, from 0 to 1.
export function shareInside(shape: Polygon | MultiPolygon, oa: Polygon | MultiPolygon): number {
  const whole = area(oa);
  if (!(whole > 0)) return 0;
  const overlap = intersect(featureCollection([feature(shape), feature(oa)]));
  if (!overlap) return 0;
  return snapShare(area(overlap) / whole);
}

// --- Parts ---------------------------------------------------------------------------

// Edges closer than this (in degrees, about 0.1 mm) count as touching.
const EPS = 1e-9;

type Edge = { x1: number; y1: number; x2: number; y2: number; minX: number; maxX: number; minY: number; maxY: number; ring: number; at: number; last: boolean };

type EdgeGrid = { x0: number; y0: number; cellW: number; cellH: number; n: number; cells: Edge[][] };

export type ShapePart = { polygon: Polygon; bbox: Bbox; edges: Edge[]; grid?: EdgeGrid };

// The part's edges filed in a grid over its box, so the edges near a point
// are found without looking at all of them. Made the first time it's needed.
function gridOf(part: ShapePart): EdgeGrid {
  if (part.grid) return part.grid;
  const [x0, y0, x1, y1] = part.bbox;
  const n = Math.max(1, Math.min(64, Math.ceil(Math.sqrt(part.edges.length / 2))));
  const cellW = (x1 - x0) / n || EPS;
  const cellH = (y1 - y0) / n || EPS;
  const cells: Edge[][] = Array.from({ length: n * n }, () => []);
  const grid = { x0, y0, cellW, cellH, n, cells };
  for (const e of part.edges) {
    const [i0, j0, i1, j1] = cellRange(grid, e.minX - EPS, e.minY - EPS, e.maxX + EPS, e.maxY + EPS);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) cells[j * n + i].push(e);
  }
  part.grid = grid;
  return grid;
}

function cellRange(g: EdgeGrid, minX: number, minY: number, maxX: number, maxY: number): [number, number, number, number] {
  const clamp = (v: number) => Math.max(0, Math.min(g.n - 1, v));
  return [
    clamp(Math.floor((minX - g.x0) / g.cellW)),
    clamp(Math.floor((minY - g.y0) / g.cellH)),
    clamp(Math.floor((maxX - g.x0) / g.cellW)),
    clamp(Math.floor((maxY - g.y0) / g.cellH)),
  ];
}

// Whether any of the part's edges come near this edge.
function touchesPartEdge(part: ShapePart, edge: Edge): boolean {
  const g = gridOf(part);
  const [i0, j0, i1, j1] = cellRange(g, edge.minX - EPS, edge.minY - EPS, edge.maxX + EPS, edge.maxY + EPS);
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      for (const other of g.cells[j * g.n + i]) if (edgesMeet(edge, other)) return true;
    }
  }
  return false;
}

function ringEdges(ring: Position[], ringId: number): Edge[] {
  const edges: Edge[] = [];
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    edges.push({
      x1, y1, x2, y2,
      minX: Math.min(x1, x2), maxX: Math.max(x1, x2), minY: Math.min(y1, y2), maxY: Math.max(y1, y2),
      ring: ringId, at: i, last: i === ring.length - 2,
    });
  }
  return edges;
}

function orient(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): number {
  return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
}

function properlyCross(a: Edge, b: Edge): boolean {
  const d1 = orient(a.x1, a.y1, a.x2, a.y2, b.x1, b.y1);
  const d2 = orient(a.x1, a.y1, a.x2, a.y2, b.x2, b.y2);
  const d3 = orient(b.x1, b.y1, b.x2, b.y2, a.x1, a.y1);
  const d4 = orient(b.x1, b.y1, b.x2, b.y2, a.x2, a.y2);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

function distanceSquared(px: number, py: number, e: Edge): number {
  const dx = e.x2 - e.x1;
  const dy = e.y2 - e.y1;
  const length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((px - e.x1) * dx + (py - e.y1) * dy) / length)) : 0;
  const qx = e.x1 + t * dx - px;
  const qy = e.y1 + t * dy - py;
  return qx * qx + qy * qy;
}

// Whether two edges cross, touch or come within EPS of each other.
function edgesMeet(a: Edge, b: Edge): boolean {
  if (a.minX > b.maxX + EPS || b.minX > a.maxX + EPS || a.minY > b.maxY + EPS || b.minY > a.maxY + EPS) return false;
  if (properlyCross(a, b)) return true;
  const e2 = EPS * EPS;
  return (
    distanceSquared(b.x1, b.y1, a) <= e2 ||
    distanceSquared(b.x2, b.y2, a) <= e2 ||
    distanceSquared(a.x1, a.y1, b) <= e2 ||
    distanceSquared(a.x2, a.y2, b) <= e2
  );
}

// Two edges of the same ring that follow one another share a point by design.
function neighbours(a: Edge, b: Edge): boolean {
  if (a.ring !== b.ring) return false;
  return Math.abs(a.at - b.at) === 1 || (a.at === 0 && b.last) || (b.at === 0 && a.last);
}

// Even-odd point in polygon, holes included.
function pointInPolygon(x: number, y: number, rings: Position[][]): boolean {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

function pointInBox(p: Position, box: Bbox): boolean {
  return p[0] >= box[0] && p[0] <= box[2] && p[1] >= box[1] && p[1] <= box[3];
}

// Inside a part and not on its edge (parts may share a corner).
function wellInside(p: Position, part: ShapePart): boolean {
  if (!pointInPolygon(p[0], p[1], part.polygon.coordinates)) return false;
  return part.edges.every((e) => distanceSquared(p[0], p[1], e) > EPS * EPS);
}

// A shape's polygon parts, or null when a ring crosses itself or another
// ring, two edges run along each other, or one part sits inside another;
// then the parts can't be worked out one at a time.
export function shapeParts(shape: Polygon | MultiPolygon): ShapePart[] | null {
  const polygons = shape.type === "Polygon" ? [shape.coordinates] : shape.coordinates;
  let ringId = 0;
  const parts = polygons.map((rings) => {
    const polygon: Polygon = { type: "Polygon", coordinates: rings };
    return { polygon, bbox: geometryBbox(polygon), edges: rings.flatMap((ring) => ringEdges(ring, ringId++)) };
  });

  const edges = parts.flatMap((p) => p.edges).sort((a, b) => a.minX - b.minX);
  for (let i = 0; i < edges.length; i++) {
    const a = edges[i];
    for (let j = i + 1; j < edges.length && edges[j].minX <= a.maxX; j++) {
      const b = edges[j];
      if (a.minY > b.maxY || b.minY > a.maxY || neighbours(a, b)) continue;
      if (properlyCross(a, b)) return null;
      // Running along each other: both ends of one on the other's line, and overlapping.
      if (orient(a.x1, a.y1, a.x2, a.y2, b.x1, b.y1) === 0 && orient(a.x1, a.y1, a.x2, a.y2, b.x2, b.y2) === 0) {
        const alongX = a.maxX - a.minX >= a.maxY - a.minY;
        const overlap = alongX ? Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX) : Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY);
        if (overlap > 0) return null;
      }
    }
  }
  for (const part of parts) {
    const [outer, ...holes] = part.polygon.coordinates;
    for (const hole of holes) if (!pointInPolygon(hole[0][0], hole[0][1], [outer])) return null;
  }
  for (let i = 0; i < parts.length; i++) {
    for (let j = 0; j < parts.length; j++) {
      if (i === j || !bboxesMeet(parts[i].bbox, parts[j].bbox)) continue;
      for (const ring of parts[i].polygon.coordinates) {
        for (const p of ring) if (pointInBox(p, parts[j].bbox) && wellInside(p, parts[j])) return null;
      }
    }
  }
  return parts;
}

// Whether an Output Area is wholly inside or wholly outside a part, when
// that can be told without clipping: none of its edges come near the part's
// edges, none of the part's rings start inside its box (a hole of the part,
// or the whole part, could be inside it), and all its rings are on the same
// side. Null when clipping is needed.
function quickSide(part: ShapePart, oa: OutputArea): "inside" | "outside" | null {
  for (const ring of part.polygon.coordinates) if (pointInBox(ring[0], oa.bbox)) return null;
  const polygons = oa.geometry.type === "Polygon" ? [oa.geometry.coordinates] : oa.geometry.coordinates;
  const box = part.bbox;
  for (const rings of polygons) {
    for (const ring of rings) {
      for (const edge of ringEdges(ring, -1)) {
        if (edge.minX > box[2] + EPS || edge.maxX < box[0] - EPS || edge.minY > box[3] + EPS || edge.maxY < box[1] - EPS) continue;
        if (touchesPartEdge(part, edge)) return null;
      }
    }
  }
  let side: boolean | null = null;
  for (const rings of polygons) {
    for (const ring of rings) {
      const inside = pointInPolygon(ring[0][0], ring[0][1], part.polygon.coordinates);
      if (side === null) side = inside;
      else if (side !== inside) return null;
    }
  }
  return side ? "inside" : "outside";
}

// A large part cut down to a box a little bigger than the Output Area, so
// clipping it against the Output Area handles a few dozen edges rather than
// thousands. Everything inside the box is unchanged; where a ring leaves
// the box it runs along the box's edge instead, which is outside the Output
// Area. Null when nothing of the part is in the box.
const CUT_DOWN_EDGES = 200;
const CUT_MARGIN = 1e-4;

function clipRing(ring: Position[], box: Bbox): Position[] {
  const [x0, y0, x1, y1] = box;
  const sides: [(p: Position) => boolean, (a: Position, b: Position) => Position][] = [
    [(p) => p[0] >= x0, (a, b) => [x0, a[1] + ((b[1] - a[1]) * (x0 - a[0])) / (b[0] - a[0])]],
    [(p) => p[0] <= x1, (a, b) => [x1, a[1] + ((b[1] - a[1]) * (x1 - a[0])) / (b[0] - a[0])]],
    [(p) => p[1] >= y0, (a, b) => [a[0] + ((b[0] - a[0]) * (y0 - a[1])) / (b[1] - a[1]), y0]],
    [(p) => p[1] <= y1, (a, b) => [a[0] + ((b[0] - a[0]) * (y1 - a[1])) / (b[1] - a[1]), y1]],
  ];
  let points = ring.slice(0, -1);
  for (const [inside, cut] of sides) {
    const out: Position[] = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[(i + points.length - 1) % points.length];
      const b = points[i];
      if (inside(b)) {
        if (!inside(a)) out.push(cut(a, b));
        out.push(b);
      } else if (inside(a)) {
        out.push(cut(a, b));
      }
    }
    points = out;
    if (points.length === 0) return [];
  }
  const tidy = points.filter((p, i) => i === 0 || p[0] !== points[i - 1][0] || p[1] !== points[i - 1][1]);
  if (tidy.length > 1 && tidy[0][0] === tidy[tidy.length - 1][0] && tidy[0][1] === tidy[tidy.length - 1][1]) tidy.pop();
  return tidy.length >= 3 ? [...tidy, tidy[0]] : [];
}

function partNear(part: ShapePart, oaBox: Bbox): Polygon | null {
  const box: Bbox = [oaBox[0] - CUT_MARGIN, oaBox[1] - CUT_MARGIN, oaBox[2] + CUT_MARGIN, oaBox[3] + CUT_MARGIN];
  const [outer, ...holes] = part.polygon.coordinates.map((ring) => clipRing(ring, box));
  if (!outer || outer.length === 0) return null;
  return { type: "Polygon", coordinates: [outer, ...holes.filter((h) => h.length > 0)] };
}

function clippedArea(part: ShapePart, oa: OutputArea): number {
  let shape: Polygon | null = part.polygon;
  if (part.edges.length > CUT_DOWN_EDGES) {
    shape = partNear(part, oa.bbox);
    if (!shape) return 0;
  }
  try {
    const overlap = intersect(featureCollection([feature(shape), feature(oa.geometry)]));
    return overlap ? area(overlap) : 0;
  } catch (err) {
    if (shape === part.polygon) throw err;
    const overlap = intersect(featureCollection([feature(part.polygon), feature(oa.geometry)]));
    return overlap ? area(overlap) : 0;
  }
}

// How much of each nearby Output Area lies inside one part, in square
// metres, with each Output Area's whole area. Only Output Areas with homes
// and some area inside are listed. One step per Output Area.
export type PartCover = Map<string, { covered: number; whole: number }>;

function* coverSteps(part: ShapePart, oas: OutputArea[]): Generator<void, PartCover> {
  const cover: PartCover = new Map();
  for (const oa of oas) {
    if (oa.households <= 0 || !bboxesMeet(part.bbox, oa.bbox)) continue;
    const whole = area(oa.geometry);
    if (!(whole > 0)) continue;
    const side = quickSide(part, oa);
    if (side === "outside") continue;
    const covered = side === "inside" ? whole : clippedArea(part, oa);
    if (covered > 0) cover.set(oa.code, { covered, whole });
    yield;
  }
  return cover;
}

function runSteps<T>(steps: Generator<void, T>): T {
  for (;;) {
    const next = steps.next();
    if (next.done) return next.value;
  }
}

// Runs the steps, handing control back every `sliceMs` so other work on the
// server (other requests, timers) isn't held up.
export async function runStepsAsync<T>(steps: Generator<void, T>, sliceMs = 20): Promise<T> {
  let since = performance.now();
  for (;;) {
    const next = steps.next();
    if (next.done) return next.value;
    if (performance.now() - since >= sliceMs) {
      await new Promise<void>((resolve) => setImmediate(resolve));
      since = performance.now();
    }
  }
}

export function partCover(part: ShapePart, oas: OutputArea[]): PartCover {
  return runSteps(coverSteps(part, oas));
}

export function partCoverAsync(part: ShapePart, oas: OutputArea[]): Promise<PartCover> {
  return runStepsAsync(coverSteps(part, oas));
}

// The parts' covers added up for each Output Area, in the order given, so
// the total adds up the same way however the parts were found.
export function householdsFromCovers(oas: { code: string; households: number }[], covers: PartCover[]): number {
  let total = 0;
  for (const oa of oas) {
    let covered = 0;
    let whole = 0;
    for (const cover of covers) {
      const c = cover.get(oa.code);
      if (c) {
        covered += c.covered;
        whole = c.whole;
      }
    }
    if (whole > 0) total += oa.households * snapShare(covered / whole);
  }
  return total;
}

// Unrounded; the caller rounds once, at the end.
export function weightedHouseholds(shape: Polygon | MultiPolygon, oas: OutputArea[]): number {
  const parts = shapeParts(shape);
  if (parts) return householdsFromCovers(oas, parts.map((part) => partCover(part, oas)));
  return clippedHouseholds(shape, oas);
}

// Each nearby Output Area clipped against the whole shape, for shapes whose
// parts can't be worked out one at a time. Only Output Areas whose box meets
// one of the shape's polygons can share any of it.
function* clippedSteps(shape: Polygon | MultiPolygon, oas: OutputArea[]): Generator<void, number> {
  const boxes = polygonBoxes(shape);
  let total = 0;
  for (const oa of oas) {
    if (oa.households <= 0 || !boxes.some((box) => bboxesMeet(box, oa.bbox))) continue;
    total += oa.households * shareInside(shape, oa.geometry);
    yield;
  }
  return total;
}

export function clippedHouseholds(shape: Polygon | MultiPolygon, oas: OutputArea[]): number {
  return runSteps(clippedSteps(shape, oas));
}

export function clippedHouseholdsAsync(shape: Polygon | MultiPolygon, oas: OutputArea[]): Promise<number> {
  return runStepsAsync(clippedSteps(shape, oas));
}

export function polygonBoxes(shape: Polygon | MultiPolygon): Bbox[] {
  const polygons = shape.type === "Polygon" ? [shape.coordinates] : shape.coordinates;
  return polygons.map((rings) => geometryBbox({ type: "Polygon", coordinates: rings }));
}
