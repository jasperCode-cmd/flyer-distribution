import "server-only";
import { featureCollection } from "@turf/helpers";
import { union } from "@turf/union";
import type { Feature, MultiPolygon, Polygon } from "geojson";
import { estimateHouseholds, geometryKey } from "./data";
import type { AreaGeometry } from "./geometry";
import { Lru } from "./lru";
import { findOverlaps, overlapOf, type OverlapInput } from "./overlaps";
import type { PlannerOverlap } from "./types";

// A project's overlaps, with the homes in each, and its homes counted once
// across all its areas, for loadProject. Everything here follows from the
// areas' shapes alone, so each piece is remembered by the shapes it came
// from: a save that changes no shape works nothing out again, and one that
// moves, adds or removes an area only works out what that area is part of.
// Each area's own homes are stored with it and never worked out here.

type Shared = { geometry: AreaGeometry; areaM2: number } | null;

const overlapsByPair = new Lru<Shared>(5000);
const combinedByAreas = new Lru<AreaGeometry | null>(20);

// For tests and timings: start again from nothing.
export function clearProjectEstimatesCache(): void {
  overlapsByPair.clear();
  combinedByAreas.clear();
}

function feature(geometry: AreaGeometry): Feature<Polygon | MultiPolygon> {
  return { type: "Feature", properties: {}, geometry };
}

// All of a project's areas as one shape, so overlaps count once.
export function combinedGeometry(geometries: AreaGeometry[]): AreaGeometry | null {
  if (geometries.length === 0) return null;
  if (geometries.length === 1) return geometries[0];
  try {
    return union(featureCollection(geometries.map(feature)))?.geometry ?? null;
  } catch {
    return null;
  }
}

export async function projectHouseholds(areas: OverlapInput[]): Promise<{ overlaps: PlannerOverlap[]; totalHouseholds: number | null }> {
  const keys = new Map(areas.map((a) => [a.id, geometryKey(a.geometry)]));
  const found = findOverlaps(areas, (a, b) => {
    const key = `${keys.get(a.id)}|${keys.get(b.id)}`;
    let shared = overlapsByPair.get(key);
    if (shared === undefined) {
      shared = overlapOf(a.geometry, b.geometry);
      overlapsByPair.set(key, shared);
    }
    return shared;
  });
  const overlaps = await Promise.all(found.map(async (o) => ({ ...o, households: await estimateHouseholds(o.geometry) })));
  if (areas.length === 0) return { overlaps, totalHouseholds: 0 };

  const allKey = areas.map((a) => keys.get(a.id)).join("|");
  let combined = combinedByAreas.get(allKey);
  if (combined === undefined) {
    combined = combinedGeometry(areas.map((a) => a.geometry));
    combinedByAreas.set(allKey, combined);
  }
  return { overlaps, totalHouseholds: combined ? await estimateHouseholds(combined) : null };
}
