import type { MultiPolygon, Polygon, Position } from "geojson";

// The Area Planner's data files store shapes compactly: every coordinate as a
// whole number of 0.00001 degrees (about a metre), each ring's first point in
// full and the rest as differences from the point before. Shared by the data
// build (scripts/area-planner) and the loader (lib/area-planner/data.ts).
//
// An encoded geometry is a list of polygons, each a list of rings, each ring
// [x0, y0, dx1, dy1, dx2, dy2, ...] with the closing point left out. One
// polygon decodes as a Polygon, more than one as a MultiPolygon.

export const COORD_SCALE = 1e5;

export type EncodedGeometry = number[][][];

function encodeRing(ring: Position[]): number[] | null {
  const points: [number, number][] = [];
  for (const [lon, lat] of ring) {
    const p: [number, number] = [Math.round(lon * COORD_SCALE), Math.round(lat * COORD_SCALE)];
    const last = points[points.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) points.push(p);
  }
  // The closing point, and any rounding that brought the end back to the start.
  while (points.length > 1 && points[0][0] === points[points.length - 1][0] && points[0][1] === points[points.length - 1][1]) {
    points.pop();
  }
  if (points.length < 3) return null;
  const out = [points[0][0], points[0][1]];
  for (let i = 1; i < points.length; i++) {
    out.push(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  }
  return out;
}

function decodeRing(encoded: number[]): Position[] {
  const ring: Position[] = [];
  let x = 0;
  let y = 0;
  for (let i = 0; i + 1 < encoded.length; i += 2) {
    x += encoded[i];
    y += encoded[i + 1];
    ring.push([x / COORD_SCALE, y / COORD_SCALE]);
  }
  if (ring.length > 0) ring.push([ring[0][0], ring[0][1]]);
  return ring;
}

// A polygon whose outer ring collapses when rounded is dropped, and so is a
// hole that does. Null when nothing is left.
export function encodeGeometry(geometry: Polygon | MultiPolygon): EncodedGeometry | null {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  const out: EncodedGeometry = [];
  for (const rings of polygons) {
    const outer = rings[0] ? encodeRing(rings[0]) : null;
    if (!outer) continue;
    const holes = rings.slice(1).map(encodeRing).filter((r): r is number[] => r !== null);
    out.push([outer, ...holes]);
  }
  return out.length > 0 ? out : null;
}

export function decodeGeometry(encoded: EncodedGeometry): Polygon | MultiPolygon {
  const polygons = encoded.map((rings) => rings.map(decodeRing));
  return polygons.length === 1
    ? { type: "Polygon", coordinates: polygons[0] }
    : { type: "MultiPolygon", coordinates: polygons };
}

// [minLon, minLat, maxLon, maxLat] as whole 0.00001 degrees, and back.
export function encodeBbox(bbox: [number, number, number, number]): [number, number, number, number] {
  return [
    Math.floor(bbox[0] * COORD_SCALE),
    Math.floor(bbox[1] * COORD_SCALE),
    Math.ceil(bbox[2] * COORD_SCALE),
    Math.ceil(bbox[3] * COORD_SCALE),
  ];
}

export function decodeBbox(bbox: number[]): [number, number, number, number] {
  return [bbox[0] / COORD_SCALE, bbox[1] / COORD_SCALE, bbox[2] / COORD_SCALE, bbox[3] / COORD_SCALE];
}
