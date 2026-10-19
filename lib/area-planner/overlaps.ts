import { booleanIntersects } from "@turf/boolean-intersects";
import { intersect } from "@turf/intersect";
import { featureCollection } from "@turf/helpers";
import type { Feature, MultiPolygon, Polygon } from "geojson";
import { areaM2, bboxesMeet, geometryBbox, type AreaGeometry } from "./geometry";

// Where two areas on the same project overlap, so a street isn't leafleted
// twice. Every pair is checked, whoever the areas belong to. Neighbouring
// postcode shapes share their edges exactly, and two drawn shapes can touch
// along a line, so anything smaller than MIN_OVERLAP_M2 is not an overlap.

export const MIN_OVERLAP_M2 = 200;

export type OverlapInput = { id: string; geometry: AreaGeometry };
export type Overlap = { a: string; b: string; geometry: AreaGeometry; areaM2: number };

function feature(geometry: AreaGeometry): Feature<Polygon | MultiPolygon> {
  return { type: "Feature", properties: {}, geometry };
}

export function overlapOf(a: AreaGeometry, b: AreaGeometry): { geometry: AreaGeometry; areaM2: number } | null {
  if (!bboxesMeet(geometryBbox(a), geometryBbox(b))) return null;
  const fa = feature(a);
  const fb = feature(b);
  if (!booleanIntersects(fa, fb)) return null;
  const shared = intersect(featureCollection([fa, fb]));
  if (!shared) return null;
  const size = areaM2(shared.geometry);
  return size >= MIN_OVERLAP_M2 ? { geometry: shared.geometry, areaM2: size } : null;
}

// Largest first.
export function findOverlaps(areas: OverlapInput[]): Overlap[] {
  const found: Overlap[] = [];
  for (let i = 0; i < areas.length; i++) {
    for (let j = i + 1; j < areas.length; j++) {
      const shared = overlapOf(areas[i].geometry, areas[j].geometry);
      if (shared) found.push({ a: areas[i].id, b: areas[j].id, ...shared });
    }
  }
  return found.sort((x, y) => y.areaM2 - x.areaM2);
}
