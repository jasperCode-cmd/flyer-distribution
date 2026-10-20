import "server-only";
import { featureCollection } from "@turf/helpers";
import { union } from "@turf/union";
import { waitUntil } from "@vercel/functions";
import type { Feature, MultiPolygon, Polygon } from "geojson";
import { estimateHouseholds, geometryKey } from "./data";
import type { AreaGeometry } from "./geometry";
import { Lru } from "./lru";
import { findOverlapsAsync, overlapOf, type OverlapInput } from "./overlaps";
import { untimed, type StepTimer } from "./timing";
import type { ProjectTotals } from "./types";

// A project's overlaps, with the homes in each, and its homes counted once
// across all its areas. Everything here follows from the areas' shapes
// alone, so each piece is remembered by the shapes it came from: a save that
// changes no shape works nothing out again, and one that moves, adds or
// removes an area only works out what that area is part of. Each area's own
// homes are stored with it and never worked out here.
//
// The work for one set of shapes runs once, however many requests ask for
// it at the same time. A request waits for it only so long (see
// projectHouseholdsWithin): past that it answers without the totals, the
// work carries on, and the page asks again.

type Shared = { geometry: AreaGeometry; areaM2: number } | null;

const overlapsByPair = new Lru<Shared>(5000);
const combinedByAreas = new Lru<AreaGeometry | null>(20);
const totalsByAreas = new Lru<ProjectTotals>(50);
const running = new Map<string, Promise<ProjectTotals>>();

// For tests and timings: start again from nothing.
export function clearProjectEstimatesCache(): void {
  overlapsByPair.clear();
  combinedByAreas.clear();
  totalsByAreas.clear();
  running.clear();
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

async function workOut(areas: OverlapInput[], keys: Map<string, string>, allKey: string, timer: StepTimer): Promise<ProjectTotals> {
  const found = await timer.step("overlaps", () =>
    findOverlapsAsync(areas, (a, b) => {
      const key = `${keys.get(a.id)}|${keys.get(b.id)}`;
      let shared = overlapsByPair.get(key);
      if (shared === undefined) {
        shared = overlapOf(a.geometry, b.geometry);
        overlapsByPair.set(key, shared);
      }
      return shared;
    })
  );
  const overlaps = [];
  for (const o of found) overlaps.push({ ...o, households: await estimateHouseholds(o.geometry, timer) });
  if (areas.length === 0) return { overlaps, totalHouseholds: 0 };

  let combined = combinedByAreas.get(allKey);
  if (combined === undefined) {
    combined = await timer.step("combine", () => combinedGeometry(areas.map((a) => a.geometry)));
    combinedByAreas.set(allKey, combined);
  }
  return { overlaps, totalHouseholds: combined ? await estimateHouseholds(combined, timer) : null };
}

// The totals for these areas (in the order given), worked out or joined.
export function projectHouseholds(areas: OverlapInput[], timer: StepTimer = untimed): Promise<ProjectTotals> {
  const keys = new Map(areas.map((a) => [a.id, geometryKey(a.geometry)]));
  const allKey = areas.map((a) => `${a.id}:${keys.get(a.id)}`).join("|");
  const known = totalsByAreas.get(allKey);
  if (known) return Promise.resolve(known);
  const inFlight = running.get(allKey);
  if (inFlight) return timer.step("totals-wait", () => inFlight);
  const job = workOut(areas, keys, allKey, timer)
    .then((totals) => {
      totalsByAreas.set(allKey, totals);
      return totals;
    })
    .finally(() => running.delete(allKey));
  running.set(allKey, job);
  return job;
}

// Waits up to `budgetMs` for the totals. Null when they aren't ready by then
// (or couldn't be worked out): the work carries on in the background, kept
// alive on Vercel, so asking again soon finds them done. Logs a fixed reason
// either way, never any project data.
export async function projectHouseholdsWithin(
  areas: OverlapInput[],
  budgetMs: number,
  timer: StepTimer = untimed,
  route = "a request"
): Promise<ProjectTotals | null> {
  const job = projectHouseholds(areas, timer);
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<"late">((resolve) => (timeout = setTimeout(() => resolve("late"), budgetMs)));
  try {
    const result = await Promise.race([job, late]);
    if (result !== "late") return result;
    console.warn(`Area Planner: totals not ready within ${budgetMs} ms on ${route}; sent the areas first`);
    waitUntil(
      job.then(
        () => undefined,
        (err) => console.error("Area Planner: totals failed in the background:", err instanceof Error ? err.name : "unknown error")
      )
    );
    return null;
  } catch (err) {
    console.error(`Area Planner: totals failed on ${route}:`, err instanceof Error ? err.name : "unknown error");
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
