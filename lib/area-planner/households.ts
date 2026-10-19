import type { MultiPolygon, Polygon } from "geojson";
import { area } from "@turf/area";
import { bbox as bboxOf } from "@turf/bbox";
import { intersect } from "@turf/intersect";
import { feature, featureCollection } from "@turf/helpers";

// The household estimate for any shape: each Census 2021 Output Area's
// household count, weighted by how much of the Output Area falls inside the
// shape (so homes are taken to be spread evenly across each one).

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

// The share of an Output Area inside the shape, from 0 to 1. Rounding in the
// geometry can push a fully covered one a hair over or under, so anything
// within a millionth of the whole counts as the whole.
export function shareInside(shape: Polygon | MultiPolygon, oa: Polygon | MultiPolygon): number {
  const whole = area(oa);
  if (!(whole > 0)) return 0;
  const overlap = intersect(featureCollection([feature(shape), feature(oa)]));
  if (!overlap) return 0;
  const share = area(overlap) / whole;
  if (share >= 1 - 1e-6) return 1;
  return share > 0 ? share : 0;
}

// Unrounded; the caller rounds once, at the end.
export function weightedHouseholds(shape: Polygon | MultiPolygon, oas: OutputArea[]): number {
  const box = geometryBbox(shape);
  let total = 0;
  for (const oa of oas) {
    if (oa.households <= 0 || !bboxesMeet(box, oa.bbox)) continue;
    total += oa.households * shareInside(shape, oa.geometry);
  }
  return total;
}
