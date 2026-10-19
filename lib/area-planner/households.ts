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
// clipping; only the ones the part's edges touch or cross are clipped. A
// shape whose parts cross themselves or each other is clipped whole, Output
// Area by Output Area, as before. Either way each Output Area's share and the
// total come out the same.

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

export type ShapePart = { polygon: Polygon; bbox: Bbox; edges: Edge[] };

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
        for (const other of part.edges) if (edgesMeet(edge, other)) return null;
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

// How much of each nearby Output Area lies inside one part, in square
// metres, with each Output Area's whole area. Only Output Areas with homes
// and some area inside are listed.
export type PartCover = Map<string, { covered: number; whole: number }>;

export function partCover(part: ShapePart, oas: OutputArea[]): PartCover {
  const cover: PartCover = new Map();
  for (const oa of oas) {
    if (oa.households <= 0 || !bboxesMeet(part.bbox, oa.bbox)) continue;
    const whole = area(oa.geometry);
    if (!(whole > 0)) continue;
    const side = quickSide(part, oa);
    if (side === "outside") continue;
    let covered = whole;
    if (side === null) {
      const overlap = intersect(featureCollection([feature(part.polygon), feature(oa.geometry)]));
      covered = overlap ? area(overlap) : 0;
    }
    if (covered > 0) cover.set(oa.code, { covered, whole });
  }
  return cover;
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
export function clippedHouseholds(shape: Polygon | MultiPolygon, oas: OutputArea[]): number {
  const boxes = polygonBoxes(shape);
  let total = 0;
  for (const oa of oas) {
    if (oa.households <= 0 || !boxes.some((box) => bboxesMeet(box, oa.bbox))) continue;
    total += oa.households * shareInside(shape, oa.geometry);
  }
  return total;
}

export function polygonBoxes(shape: Polygon | MultiPolygon): Bbox[] {
  const polygons = shape.type === "Polygon" ? [shape.coordinates] : shape.coordinates;
  return polygons.map((rings) => geometryBbox({ type: "Polygon", coordinates: rings }));
}
