import { fromMercator, toMercator } from "../alignment";
import type { MercatorBox } from "./roads-format";

// A job's area for Locate: the box around each of its Area Planner areas,
// widened by a margin, in Web Mercator metres. Street names are looked up
// only inside these, so a name repeated elsewhere in Hampshire or Dorset
// can't pull a screenshot away. Pure.

export const AREA_MARGIN_M = 1500;
const MAX_BOXES = 200;

type Ring = number[][];
const ringsOf = (g: unknown): Ring[] => {
  if (!g || typeof g !== "object") return [];
  const geo = g as { type?: string; coordinates?: unknown };
  if (geo.type === "Polygon" && Array.isArray(geo.coordinates)) return geo.coordinates as Ring[];
  if (geo.type === "MultiPolygon" && Array.isArray(geo.coordinates)) return (geo.coordinates as Ring[][]).flat();
  return [];
};

// One box per area (GeoJSON Polygon or MultiPolygon in lng/lat), widened by
// `marginM` on the ground; boxes that overlap are merged.
export function areaBoxes(geometries: unknown[], marginM = AREA_MARGIN_M): MercatorBox[] {
  let boxes: MercatorBox[] = [];
  for (const g of geometries) {
    let w = Infinity;
    let s = Infinity;
    let e = -Infinity;
    let n = -Infinity;
    for (const ring of ringsOf(g))
      for (const p of ring) {
        if (!Array.isArray(p) || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) continue;
        w = Math.min(w, p[0]);
        e = Math.max(e, p[0]);
        s = Math.min(s, p[1]);
        n = Math.max(n, p[1]);
      }
    if (!Number.isFinite(w)) continue;
    const [x0, y0] = toMercator([w, n]);
    const [x1, y1] = toMercator([e, s]);
    // Ground metres to Mercator metres here.
    const grow = marginM / Math.cos((((s + n) / 2) * Math.PI) / 180);
    boxes.push([x0 - grow, y0 - grow, x1 + grow, y1 + grow]);
  }
  // Merge overlapping boxes until none overlap.
  for (let changed = true; changed; ) {
    changed = false;
    const out: MercatorBox[] = [];
    for (const b of boxes) {
      const hit = out.find((o) => o[0] <= b[2] && b[0] <= o[2] && o[1] <= b[3] && b[1] <= o[3]);
      if (hit) {
        hit[0] = Math.min(hit[0], b[0]);
        hit[1] = Math.min(hit[1], b[1]);
        hit[2] = Math.max(hit[2], b[2]);
        hit[3] = Math.max(hit[3], b[3]);
        changed = true;
      } else out.push([...b] as MercatorBox);
    }
    boxes = out;
  }
  return boxes.slice(0, MAX_BOXES);
}

// The latitude in the middle of the boxes, for turning Mercator metres into ground metres.
export function areaLatitude(boxes: MercatorBox[]): number {
  if (!boxes.length) return 51;
  const y = boxes.reduce((sum, b) => sum + (b[1] + b[3]) / 2, 0) / boxes.length;
  return fromMercator([0, y])[1];
}

export function insideAreas(boxes: MercatorBox[], p: [number, number]): boolean {
  return boxes.some((b) => p[0] >= b[0] && p[0] <= b[2] && p[1] >= b[1] && p[1] <= b[3]);
}
