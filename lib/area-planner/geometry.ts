import type { MultiPolygon, Polygon, Position } from "geojson";
import { area as turfArea } from "@turf/area";
import { bbox as turfBbox } from "@turf/bbox";
import { booleanPointInPolygon } from "@turf/boolean-point-in-polygon";
import { circle as turfCircle } from "@turf/circle";

// Shapes on the Area Planner, as GeoJSON in longitude and latitude. Pure and
// client-safe. Everything from the browser is checked here before it is
// stored: the right types, real coordinates in or near Great Britain,
// closed rings and a sensible size.

export type AreaGeometry = Polygon | MultiPolygon;
export type LatLng = { lat: number; lng: number };
export type Bbox = [west: number, south: number, east: number, north: number];

export const DEFAULT_RADIUS_M = 800;
export const MIN_RADIUS_M = 50;
export const MAX_RADIUS_M = 20_000;
export const MAX_VERTICES = 5_000;
const CIRCLE_STEPS = 64;

// A generous box around Great Britain: anything outside is a mistake.
const BOUNDS = { west: -9, east: 3, south: 49, north: 61 };

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

export function isLatLng(value: unknown): value is LatLng {
  const v = value as LatLng | null;
  return (
    !!v &&
    typeof v.lat === "number" &&
    typeof v.lng === "number" &&
    v.lat >= BOUNDS.south &&
    v.lat <= BOUNDS.north &&
    v.lng >= BOUNDS.west &&
    v.lng <= BOUNDS.east
  );
}

// A circle as the polygon used for estimates, overlaps and images. The
// centre and radius stay the record of the circle itself.
export function circleGeometry(centre: LatLng, radiusM: number): Polygon {
  const poly = turfCircle([centre.lng, centre.lat], radiusM / 1000, { steps: CIRCLE_STEPS, units: "kilometers" });
  return { type: "Polygon", coordinates: poly.geometry.coordinates.map((ring) => ring.map(([x, y]) => [round6(x), round6(y)])) };
}

function checkRing(raw: unknown): Position[] | null {
  if (!Array.isArray(raw)) return null;
  const ring: Position[] = [];
  for (const point of raw) {
    if (!Array.isArray(point) || point.length < 2) return null;
    const [lng, lat] = point;
    if (typeof lng !== "number" || typeof lat !== "number" || !Number.isFinite(lng) || !Number.isFinite(lat)) return null;
    if (lng < BOUNDS.west || lng > BOUNDS.east || lat < BOUNDS.south || lat > BOUNDS.north) return null;
    const p: Position = [round6(lng), round6(lat)];
    const last = ring[ring.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) ring.push(p);
  }
  if (ring.length < 3) return null;
  const [first, last] = [ring[0], ring[ring.length - 1]];
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push([first[0], first[1]]);
  return ring.length >= 4 ? ring : null;
}

function checkPolygon(raw: unknown): Position[][] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const rings = raw.map(checkRing);
  return rings.every((r): r is Position[] => r !== null) ? rings : null;
}

export function vertexCount(geometry: AreaGeometry): number {
  const polys = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polys.reduce((n, rings) => n + rings.reduce((m, ring) => m + ring.length, 0), 0);
}

export type GeometryResult = { ok: true; geometry: AreaGeometry } | { ok: false; error: string };

export function validateGeometry(raw: unknown): GeometryResult {
  const bad = { ok: false as const, error: "That shape couldn't be read. Draw it again." };
  if (!raw || typeof raw !== "object") return bad;
  const g = raw as { type?: unknown; coordinates?: unknown };
  let geometry: AreaGeometry;
  if (g.type === "Polygon") {
    const rings = checkPolygon(g.coordinates);
    if (!rings) return bad;
    geometry = { type: "Polygon", coordinates: rings };
  } else if (g.type === "MultiPolygon") {
    if (!Array.isArray(g.coordinates) || g.coordinates.length === 0) return bad;
    const polys = g.coordinates.map(checkPolygon);
    if (!polys.every((p): p is Position[][] => p !== null)) return bad;
    geometry = { type: "MultiPolygon", coordinates: polys };
  } else {
    return bad;
  }
  if (vertexCount(geometry) > MAX_VERTICES) return { ok: false, error: "That shape has too many points. Draw it more simply." };
  if (areaM2(geometry) < 100) return { ok: false, error: "That shape is too small to deliver." };
  return { ok: true, geometry };
}

export function areaM2(geometry: AreaGeometry): number {
  return turfArea({ type: "Feature", properties: {}, geometry });
}

export function geometryBbox(geometry: AreaGeometry): Bbox {
  const [w, s, e, n] = turfBbox(geometry);
  return [w, s, e, n];
}

export function bboxesMeet(a: Bbox, b: Bbox): boolean {
  return a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
}

// The centroid of a ring (planar, fine at this scale).
function ringCentroid(ring: Position[]): { x: number; y: number; area: number } {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[i + 1];
    const f = x0 * y1 - x1 * y0;
    a += f;
    cx += (x0 + x1) * f;
    cy += (y0 + y1) * f;
  }
  if (a === 0) return { x: ring[0][0], y: ring[0][1], area: 0 };
  return { x: cx / (3 * a), y: cy / (3 * a), area: Math.abs(a / 2) };
}

// Where an area's label goes: the centre of its largest part, or, when that
// falls outside the shape (a crescent, say), the inside point furthest from
// the bounding box edges on a coarse grid.
export function labelPoint(geometry: AreaGeometry): LatLng {
  const polys = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  let best = polys[0];
  let bestArea = -1;
  for (const rings of polys) {
    const c = ringCentroid(rings[0]);
    if (c.area > bestArea) {
      bestArea = c.area;
      best = rings;
    }
  }
  const c = ringCentroid(best[0]);
  const part: Polygon = { type: "Polygon", coordinates: best };
  if (booleanPointInPolygon([c.x, c.y], part)) return { lat: c.y, lng: c.x };
  const [w, s, e, n] = turfBbox(part);
  let pick: LatLng | null = null;
  let pickScore = -1;
  const steps = 16;
  for (let i = 1; i < steps; i++) {
    for (let j = 1; j < steps; j++) {
      const x = w + ((e - w) * i) / steps;
      const y = s + ((n - s) * j) / steps;
      if (!booleanPointInPolygon([x, y], part)) continue;
      const score = Math.min(x - w, e - x, (y - s) * 1.6, (n - y) * 1.6);
      if (score > pickScore) {
        pickScore = score;
        pick = { lat: y, lng: x };
      }
    }
  }
  return pick ?? { lat: c.y, lng: c.x };
}

export function pointInArea(point: LatLng, geometry: AreaGeometry): boolean {
  return booleanPointInPolygon([point.lng, point.lat], geometry);
}

// Rough size for people: "0.42 km²" or "3.2 hectares".
export function formatArea(m2: number): string {
  if (m2 >= 100_000) return `${(m2 / 1_000_000).toFixed(2)} km²`;
  return `${(m2 / 10_000).toFixed(1)} hectares`;
}
