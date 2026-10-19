import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { gzipSync } from "node:zlib";
import type { MultiPolygon, Polygon } from "geojson";
import { union } from "@turf/union";
import { feature, featureCollection } from "@turf/helpers";
import { encodeBbox, encodeGeometry, type EncodedGeometry } from "@/lib/area-planner/compact-geometry";
import { geometryBbox, type Bbox } from "@/lib/area-planner/households";

// Turns the source file (built from ONS open data by
// build-area-planner-source.mjs, or made up by make-sample-data.ts) into the
// Area Planner's compact data files, read by lib/area-planner/data.ts.
//
// Each Output Area goes to the postcode sector holding most of its live
// postcodes (ties go to the first alphabetically). A sector's shape is the
// union of its Output Areas, and a district's the union of its sectors'
// Output Areas, so their household counts are exact sums. An Output Area
// whose postcodes are mostly outside BH, SO, PO, SP and DT still counts in
// estimates for drawn shapes but belongs to no sector here. A sector with
// live postcodes but no Output Area of its own (they all sit in neighbours'
// Output Areas) is listed as not mappable.
//
// Files written:
//   manifest.json            what was built, when, counts, credits
//   oa-index.json.gz         every Output Area: households, box, grid cell
//   oa/<cell>.json.gz        Output Area shapes, by 0.1 degree grid cell
//   postcodes/index.json.gz  every district and sector: households, box, file
//   postcodes/<district>.json.gz  the district's shape and its sectors'
//   SOURCES.md               the datasets used and their credits

export const SOURCE_FORMAT = "fdh-area-planner-source";
export const DATA_FORMAT = "fdh-area-planner-data";
export const DATA_VERSION = 1;
export const CELL_DEGREES = 0.1;

export const REAL_CREDITS = [
  "Source: Office for National Statistics licensed under the Open Government Licence v.3.0",
  "Contains OS data © Crown copyright and database right 2026",
  "Contains Royal Mail data © Royal Mail copyright and database right 2026",
  "Census 2021 household counts (TS041) by Output Area, ONS",
];
export const SAMPLE_CREDITS = ["Made-up sample data for testing only"];

export class BuildError extends Error {}

export type SourceOutputArea = { code: string; households: number; geometry: Polygon | MultiPolygon };

export type SourceFile = {
  format: typeof SOURCE_FORMAT;
  version: 1;
  builtAt: string;
  areas: string[];
  inputs: Record<string, unknown>;
  oas: SourceOutputArea[];
  postcodeCounts: [oa: string, sector: string, count: number][];
  sectorTotals: Record<string, number>;
};

const SECTOR_RE = /^[A-Z]{1,2}[0-9][A-Z0-9]? [0-9]$/;

export function districtOf(sector: string): string {
  return sector.split(" ")[0];
}

export function postcodeArea(code: string): string {
  return /^[A-Z]{1,2}/.exec(code)?.[0] ?? "";
}

function isGeometry(g: unknown): g is Polygon | MultiPolygon {
  if (!g || typeof g !== "object") return false;
  const { type, coordinates } = g as { type?: unknown; coordinates?: unknown };
  return (type === "Polygon" || type === "MultiPolygon") && Array.isArray(coordinates) && coordinates.length > 0;
}

// Checks the source file's shape and says what is wrong if it isn't right.
export function validateSource(raw: unknown): SourceFile {
  if (!raw || typeof raw !== "object") throw new BuildError("The source file is not a JSON object.");
  const s = raw as Partial<SourceFile>;
  if (s.format !== SOURCE_FORMAT) throw new BuildError(`The source file's format is ${String(s.format)}, not ${SOURCE_FORMAT}.`);
  if (s.version !== 1) throw new BuildError(`The source file is version ${String(s.version)}; this build reads version 1.`);
  if (!Array.isArray(s.areas) || s.areas.length === 0) throw new BuildError("The source file lists no postcode areas.");
  if (!Array.isArray(s.oas) || s.oas.length === 0) throw new BuildError("The source file has no Output Areas.");
  for (const oa of s.oas) {
    if (!oa || typeof oa.code !== "string" || !oa.code) throw new BuildError("An Output Area in the source file has no code.");
    if (typeof oa.households !== "number" || !(oa.households >= 0)) {
      throw new BuildError(`Output Area ${oa.code} has no valid household count.`);
    }
    if (!isGeometry(oa.geometry)) throw new BuildError(`Output Area ${oa.code} has no polygon boundary.`);
  }
  if (!Array.isArray(s.postcodeCounts)) throw new BuildError("The source file has no postcode counts.");
  for (const row of s.postcodeCounts) {
    if (!Array.isArray(row) || typeof row[0] !== "string" || typeof row[1] !== "string" || typeof row[2] !== "number") {
      throw new BuildError("A postcode count in the source file is not [Output Area, sector, count].");
    }
    if (!SECTOR_RE.test(row[1])) throw new BuildError(`"${row[1]}" in the source file is not a postcode sector.`);
  }
  if (!s.sectorTotals || typeof s.sectorTotals !== "object") throw new BuildError("The source file has no sector totals.");
  for (const [sector, n] of Object.entries(s.sectorTotals)) {
    if (!SECTOR_RE.test(sector) || typeof n !== "number") throw new BuildError(`The sector total for "${sector}" is not valid.`);
  }
  return s as SourceFile;
}

// Each Output Area's sector: the one with most of its postcodes, or null when
// that sector is outside the source's postcode areas (or it has none).
export function assignOutputAreas(source: SourceFile): Map<string, string | null> {
  const areas = new Set(source.areas);
  const counts = new Map<string, Map<string, number>>();
  for (const [oa, sector, n] of source.postcodeCounts) {
    let bySector = counts.get(oa);
    if (!bySector) counts.set(oa, (bySector = new Map()));
    bySector.set(sector, (bySector.get(sector) ?? 0) + n);
  }
  const assigned = new Map<string, string | null>();
  for (const oa of source.oas) {
    const bySector = counts.get(oa.code);
    let best: string | null = null;
    let bestCount = 0;
    for (const [sector, n] of [...(bySector ?? [])].sort((a, b) => a[0].localeCompare(b[0]))) {
      if (n > bestCount) {
        best = sector;
        bestCount = n;
      }
    }
    assigned.set(oa.code, best && areas.has(postcodeArea(best)) ? best : null);
  }
  return assigned;
}

export function unionAll(geometries: (Polygon | MultiPolygon)[]): Polygon | MultiPolygon | null {
  if (geometries.length === 0) return null;
  if (geometries.length === 1) return geometries[0];
  const merged = union(featureCollection(geometries.map((g) => feature(g))));
  return merged ? merged.geometry : null;
}

export function cellKey(lon: number, lat: number): string {
  const ix = Math.floor(lon / CELL_DEGREES + 1e-9);
  const iy = Math.floor(lat / CELL_DEGREES + 1e-9);
  return `${ix < 0 ? `w${-ix}` : `e${ix}`}${iy < 0 ? `s${-iy}` : `n${iy}`}`;
}

export type PostcodeShape = {
  code: string;
  kind: "district" | "sector";
  households: number;
  mappable: boolean;
  geometry: Polygon | MultiPolygon | null;
  bbox: Bbox | null;
};

export type Manifest = {
  format: typeof DATA_FORMAT;
  version: number;
  builtAt: string;
  sample: boolean;
  areas: string[];
  counts: {
    outputAreas: number;
    outputAreasInSectors: number;
    districts: number;
    sectors: number;
    unmappableSectors: number;
    households: number;
  };
  bbox: Bbox;
  credits: string[];
  sourceBuiltAt: string;
};

export type BuildResult = {
  manifest: Manifest;
  files: { path: string; data: Buffer }[];
  shapes: PostcodeShape[];
};

const gz = (value: unknown) => gzipSync(Buffer.from(JSON.stringify(value)), { level: 9 });

function sourcesMarkdown(source: SourceFile, manifest: Manifest): string {
  const inputs = source.inputs as {
    onspd?: { file?: string; sha256?: string; entries?: string[] };
    ts041?: { file?: string; sha256?: string; entry?: string };
    oaService?: { url?: string; fetchedAt?: string; features?: number };
  };
  if (manifest.sample) {
    return [
      "# Area Planner data: made-up sample",
      "",
      "Made-up sample data for testing only. The Output Areas are an invented grid",
      "and the postcode sectors invented blocks of it; none of it is real.",
      "",
      `Built ${manifest.builtAt}.`,
      "",
    ].join("\n");
  }
  const release = inputs.onspd?.entries?.map((e) => /ONSPD_([A-Z]{3}_\d{4})/i.exec(e)?.[1]).find(Boolean);
  return [
    "# Area Planner data sources",
    "",
    `Built ${manifest.builtAt} from a source file made ${source.builtAt}.`,
    "",
    "## Datasets",
    "",
    `- ONS Postcode Directory${release ? ` (${release.replace("_", " ")})` : ""}, multi-CSV release: ${inputs.onspd?.file ?? "?"}`,
    `  (sha256 ${inputs.onspd?.sha256 ?? "?"}). Live, small-user postcodes and their 2021 Output Areas.`,
    `- Census 2021 TS041 Number of Households by Output Area (Nomis bulk download): ${inputs.ts041?.file ?? "?"},`,
    `  entry ${inputs.ts041?.entry ?? "?"} (sha256 ${inputs.ts041?.sha256 ?? "?"}).`,
    "- Output Areas (December 2021) Boundaries EW BGC (V2), generalised (20m) and clipped to the coastline,",
    `  from ${inputs.oaService?.url ?? "?"}, fetched ${inputs.oaService?.fetchedAt ?? "?"} (${inputs.oaService?.features ?? "?"} Output Areas).`,
    "",
    "## How the shapes are made",
    "",
    "Each Output Area is put in the postcode sector holding most of its live postcodes, and a sector's",
    "shape is the union of its Output Areas (a district's, of its sectors'). These are approximations of",
    "the Royal Mail boundaries, which are not open data: an edge can be out by up to one Output Area.",
    "Household estimates weight each Output Area's Census 2021 households by how much of it falls inside",
    "a shape.",
    "",
    "## Credits",
    "",
    ...manifest.credits.map((c) => `- ${c}`),
    "",
    `Postcode areas: ${manifest.areas.join(", ")}. Output Areas: ${manifest.counts.outputAreas}. Sectors: ${manifest.counts.sectors}`,
    `(${manifest.counts.unmappableSectors} too small to map). Districts: ${manifest.counts.districts}. Households: ${manifest.counts.households}.`,
    "",
  ].join("\n");
}

export function buildData(input: unknown, options: { sample?: boolean; builtAt?: string } = {}): BuildResult {
  const source = validateSource(input);
  const sample = options.sample ?? false;
  const assigned = assignOutputAreas(source);

  const oaRecords = source.oas.map((oa) => {
    const bbox = geometryBbox(oa.geometry);
    return { ...oa, bbox, cell: cellKey((bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2) };
  });

  // Sectors: every target sector with live postcodes, and any an Output Area went to.
  const membersOf = new Map<string, typeof oaRecords>();
  for (const oa of oaRecords) {
    const sector = assigned.get(oa.code);
    if (!sector) continue;
    const list = membersOf.get(sector) ?? [];
    list.push(oa);
    membersOf.set(sector, list);
  }
  const areas = new Set(source.areas);
  const sectorCodes = new Set([
    ...Object.entries(source.sectorTotals)
      .filter(([s, n]) => n > 0 && areas.has(postcodeArea(s)))
      .map(([s]) => s),
    ...membersOf.keys(),
  ]);

  const shapes: PostcodeShape[] = [];
  const sectorsByDistrict = new Map<string, string[]>();
  for (const code of [...sectorCodes].sort()) {
    const members = membersOf.get(code) ?? [];
    const geometry = unionAll(members.map((m) => m.geometry));
    shapes.push({
      code,
      kind: "sector",
      households: members.reduce((sum, m) => sum + m.households, 0),
      mappable: geometry !== null,
      geometry,
      bbox: geometry ? geometryBbox(geometry) : null,
    });
    const district = districtOf(code);
    sectorsByDistrict.set(district, [...(sectorsByDistrict.get(district) ?? []), code]);
  }
  for (const [district, sectors] of [...sectorsByDistrict].sort((a, b) => a[0].localeCompare(b[0]))) {
    const members = sectors.flatMap((s) => membersOf.get(s) ?? []);
    const geometry = unionAll(members.map((m) => m.geometry));
    shapes.push({
      code: district,
      kind: "district",
      households: members.reduce((sum, m) => sum + m.households, 0),
      mappable: geometry !== null,
      geometry,
      bbox: geometry ? geometryBbox(geometry) : null,
    });
  }

  // The files.
  const files: { path: string; data: Buffer }[] = [];
  const cells = new Map<string, [string, EncodedGeometry][]>();
  const oaIndex: (string | number)[][] = [];
  for (const oa of oaRecords) {
    const encoded = encodeGeometry(oa.geometry);
    if (!encoded) continue;
    oaIndex.push([oa.code, oa.households, ...encodeBbox(oa.bbox), oa.cell]);
    const list = cells.get(oa.cell) ?? [];
    list.push([oa.code, encoded]);
    cells.set(oa.cell, list);
  }
  files.push({ path: "oa-index.json.gz", data: gz({ v: DATA_VERSION, cellDegrees: CELL_DEGREES, items: oaIndex }) });
  for (const [cell, list] of [...cells].sort((a, b) => a[0].localeCompare(b[0]))) {
    files.push({ path: `oa/${cell}.json.gz`, data: gz(list) });
  }

  const postcodeIndex: (string | number | null)[][] = [];
  const districtFiles = new Map<string, Record<string, EncodedGeometry>>();
  for (const shape of shapes) {
    const district = shape.kind === "district" ? shape.code : districtOf(shape.code);
    const encoded = shape.geometry ? encodeGeometry(shape.geometry) : null;
    const mappable = encoded !== null;
    if (encoded) {
      const file = districtFiles.get(district) ?? {};
      file[shape.code] = encoded;
      districtFiles.set(district, file);
    }
    postcodeIndex.push([
      shape.code,
      shape.kind === "district" ? "d" : "s",
      shape.households,
      mappable ? 1 : 0,
      ...(mappable && shape.bbox ? encodeBbox(shape.bbox) : [0, 0, 0, 0]),
      mappable ? district : null,
    ]);
    shape.mappable = mappable;
  }
  files.push({ path: "postcodes/index.json.gz", data: gz({ v: DATA_VERSION, items: postcodeIndex }) });
  for (const [district, file] of [...districtFiles].sort((a, b) => a[0].localeCompare(b[0]))) {
    files.push({ path: `postcodes/${district}.json.gz`, data: gz(file) });
  }

  const boxes = oaRecords.map((o) => o.bbox);
  const sectors = shapes.filter((s) => s.kind === "sector");
  const manifest: Manifest = {
    format: DATA_FORMAT,
    version: DATA_VERSION,
    builtAt: options.builtAt ?? new Date().toISOString(),
    sample,
    areas: [...source.areas],
    counts: {
      outputAreas: oaIndex.length,
      outputAreasInSectors: [...membersOf.values()].reduce((n, l) => n + l.length, 0),
      districts: shapes.length - sectors.length,
      sectors: sectors.length,
      unmappableSectors: sectors.filter((s) => !s.mappable).length,
      households: sectors.reduce((sum, s) => sum + s.households, 0),
    },
    bbox: [
      Math.min(...boxes.map((b) => b[0])),
      Math.min(...boxes.map((b) => b[1])),
      Math.max(...boxes.map((b) => b[2])),
      Math.max(...boxes.map((b) => b[3])),
    ],
    credits: sample ? SAMPLE_CREDITS : REAL_CREDITS,
    sourceBuiltAt: source.builtAt,
  };
  files.push({ path: "manifest.json", data: Buffer.from(JSON.stringify(manifest, null, 2) + "\n") });
  files.push({ path: "SOURCES.md", data: Buffer.from(sourcesMarkdown(source, manifest)) });

  return { manifest, files, shapes };
}

// Replaces a previous build in outDir: only the files and folders a build
// writes are removed first, so nothing else there is touched.
export async function writeData(result: BuildResult, outDir: string): Promise<void> {
  await mkdir(outDir, { recursive: true });
  for (const old of ["manifest.json", "oa-index.json.gz", "SOURCES.md", "oa", "postcodes"]) {
    await rm(join(outDir, old), { recursive: true, force: true });
  }
  for (const file of result.files) {
    const path = join(outDir, file.path);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, file.data);
  }
}
