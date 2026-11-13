import "server-only";
import { postcodeGeometry, sectorsMeeting } from "@/lib/area-planner/data";
import { pointInArea } from "@/lib/area-planner/geometry";
import { distanceM, linesBbox, samplesAlong, type Lines } from "./geometry";

// The postcode sectors a round's lines pass through, with about how many
// metres of line fall in each: points every SAMPLE_M metres along the lines,
// checked against the Area Planner's sector shapes (built from ONS data, so
// approximations of the Royal Mail boundaries; see data/area-planner). Only
// the district files the lines' box touches are read.

export type SectorShare = { code: string; metres: number };

export const SAMPLE_M = 10;
// A sector with less line than this in it is left out (a corner clipped).
export const MIN_SECTOR_M = 20;

export async function sectorsForLines(lines: Lines): Promise<SectorShare[]> {
  const bbox = linesBbox(lines);
  if (!bbox) return [];
  const candidates = await sectorsMeeting(bbox);
  if (candidates.length === 0) return [];
  const shapes = (await Promise.all(candidates.map(async (c) => ({ ...c, geometry: await postcodeGeometry(c.code) })))).filter((c) => c.geometry);
  const metres = new Map<string, number>();
  for (const line of samplesAlong(lines, SAMPLE_M)) {
    for (let k = 1; k < line.length; k++) {
      const a = line[k - 1];
      const b = line[k];
      const mid = { lng: (a[0] + b[0]) / 2, lat: (a[1] + b[1]) / 2 };
      const hit = shapes.find(
        (s) => mid.lng >= s.bbox[0] && mid.lng <= s.bbox[2] && mid.lat >= s.bbox[1] && mid.lat <= s.bbox[3] && pointInArea(mid, s.geometry!)
      );
      if (hit) metres.set(hit.code, (metres.get(hit.code) ?? 0) + distanceM(a, b));
    }
  }
  return [...metres]
    .filter(([, m]) => m >= MIN_SECTOR_M)
    .map(([code, m]) => ({ code, metres: Math.round(m) }))
    .sort((x, y) => y.metres - x.metres || x.code.localeCompare(y.code));
}
