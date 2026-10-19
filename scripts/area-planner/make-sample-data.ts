// Made-up Area Planner data for tests and local screenshots, never real:
// an invented grid of "Output Areas" around Bournemouth and Christchurch,
// grouped into invented blocks named like real sectors.
//
//   npx tsx scripts/area-planner/make-sample-data.ts <outDir>
//
// The folder must be given; the real data folder is only written when it is
// passed exactly.

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { Polygon } from "geojson";
import { buildData, SOURCE_FORMAT, writeData, type SourceFile } from "./build-lib";

const WEST = -1.92;
const EAST = -1.74;
const SOUTH = 50.715;
const NORTH = 50.765;
const COLS = 42;
const ROWS = 18;

// A small seeded random number generator (mulberry32), so every run is the same.
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// West to east the invented districts, and their sectors by rows (row 0 is
// the south edge).
function sectorAt(col: number, row: number): string {
  if (col < 8) return "BH1 3";
  if (col < 16) return "BH8 9";
  if (col < 24) return row < 9 ? "BH7 6" : "BH7 7";
  if (col < 33) return row < 9 ? "BH5 1" : "BH5 2";
  return row < 6 ? "BH6 3" : row < 12 ? "BH6 4" : "BH6 5";
}

export function makeSampleSource(seed = 20261019): SourceFile {
  const random = seeded(seed);
  const dx = (EAST - WEST) / COLS;
  const dy = (NORTH - SOUTH) / ROWS;
  const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

  // Shared corners, nudged inside the grid so the shapes are irregular but
  // neighbours still meet exactly.
  const corner: [number, number][][] = [];
  for (let c = 0; c <= COLS; c++) {
    corner.push([]);
    for (let r = 0; r <= ROWS; r++) {
      const inside = c > 0 && c < COLS && r > 0 && r < ROWS;
      const jx = inside ? (random() - 0.5) * 0.36 * dx : 0;
      const jy = inside ? (random() - 0.5) * 0.36 * dy : 0;
      corner[c].push([round6(WEST + c * dx + jx), round6(SOUTH + r * dy + jy)]);
    }
  }

  const oas: SourceFile["oas"] = [];
  const counts = new Map<string, Map<string, number>>();
  const add = (oa: string, sector: string, n: number) => {
    const bySector = counts.get(oa) ?? new Map<string, number>();
    bySector.set(sector, (bySector.get(sector) ?? 0) + n);
    counts.set(oa, bySector);
  };
  const codeAt = (c: number, r: number) => `E00${String(900000 + c * ROWS + r).padStart(6, "0")}`;

  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      const code = codeAt(c, r);
      const ring = [corner[c][r], corner[c + 1][r], corner[c + 1][r + 1], corner[c][r + 1], corner[c][r]];
      const geometry: Polygon = { type: "Polygon", coordinates: [ring] };
      oas.push({ code, households: 90 + Math.floor(random() * 81), geometry });
      const own = sectorAt(c, r);
      add(code, own, 4 + Math.floor(random() * 6));
      // A few postcodes of a neighbouring sector, never the most.
      for (const [nc, nr] of [[c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]]) {
        if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;
        const other = sectorAt(nc, nr);
        if (other !== own && random() < 0.5) add(code, other, 1);
      }
      // BH1 9: a few postcodes, all inside BH1 3's Output Areas.
      if (own === "BH1 3" && r >= 8 && r <= 9 && c >= 2 && c <= 4) add(code, "BH1 9", 2);
    }
  }

  const postcodeCounts: SourceFile["postcodeCounts"] = [];
  const sectorTotals: Record<string, number> = {};
  for (const [oa, bySector] of [...counts].sort((a, b) => a[0].localeCompare(b[0]))) {
    for (const [sector, n] of [...bySector].sort((a, b) => a[0].localeCompare(b[0]))) {
      postcodeCounts.push([oa, sector, n]);
      sectorTotals[sector] = (sectorTotals[sector] ?? 0) + n;
    }
  }

  return {
    format: SOURCE_FORMAT,
    version: 1,
    builtAt: "2026-10-19T00:00:00.000Z",
    areas: ["BH", "SO", "PO", "SP", "DT"],
    inputs: { sample: true },
    oas,
    postcodeCounts,
    sectorTotals,
  };
}

async function main() {
  const outDir = process.argv[2];
  if (!outDir) {
    console.error("Usage: npx tsx scripts/area-planner/make-sample-data.ts <outDir>");
    process.exit(1);
  }
  const result = buildData(makeSampleSource(), { sample: true });
  await writeData(result, resolve(outDir));
  const total = result.files.reduce((sum, f) => sum + f.data.length, 0);
  const { counts } = result.manifest;
  console.log(
    `Made-up sample data in ${resolve(outDir)}: ${result.files.length} files, ${(total / 1024).toFixed(1)} KB; ` +
      `${counts.outputAreas} Output Areas, ${counts.sectors} sectors (${counts.unmappableSectors} not mappable), ` +
      `${counts.districts} districts, ${counts.households} households`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
