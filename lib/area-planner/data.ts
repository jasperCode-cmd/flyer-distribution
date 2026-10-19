import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import type { MultiPolygon, Polygon } from "geojson";
import { decodeBbox, decodeGeometry, type EncodedGeometry } from "./compact-geometry";
import { bboxesMeet, geometryBbox, weightedHouseholds, type Bbox, type OutputArea } from "./households";

// Reads the Area Planner's postcode and household data (built by
// scripts/area-planner/build-data.ts) on the server, on demand: the indexes
// when first needed, and only the district and grid cell files a request
// touches. Parsed files stay in memory per data folder. Output Area shapes
// never go to the browser.
//
// When no data is installed (no manifest.json), lookups return null and the
// status says so; once installed, an unreadable file is an error.

export const DATA_AREAS = ["BH", "SO", "PO", "SP", "DT"] as const;

export type PostcodeKind = "district" | "sector";
export type PostcodeInfo = { code: string; kind: PostcodeKind; households: number; mappable: boolean };
export type AreaPlannerDataStatus = { installed: boolean; sample: boolean; builtAt: string | null; credits: string[] };

type Manifest = { format?: string; version?: number; builtAt?: string; sample?: boolean; credits?: string[] };
type PostcodeEntry = PostcodeInfo & { bbox: Bbox | null; file: string | null };
type OaEntry = { code: string; households: number; bbox: Bbox; cell: string };

type DirCache = {
  manifest?: Promise<Manifest | null>;
  postcodes?: Promise<Map<string, PostcodeEntry>>;
  oaIndex?: Promise<OaEntry[]>;
  districtFiles: Map<string, Promise<Record<string, EncodedGeometry>>>;
  cells: Map<string, Promise<Map<string, Polygon | MultiPolygon>>>;
};

const caches = new Map<string, DirCache>();

export function areaPlannerDataDir(): string {
  return process.env.AREA_PLANNER_DATA_DIR || join(process.cwd(), "data", "area-planner");
}

export function clearAreaPlannerDataCache(): void {
  caches.clear();
}

function cacheFor(dir: string): DirCache {
  let cache = caches.get(dir);
  if (!cache) caches.set(dir, (cache = { districtFiles: new Map(), cells: new Map() }));
  return cache;
}

// A failed read is not kept, so the next request tries again.
function remember<T>(get: () => Promise<T> | undefined, set: (p: Promise<T> | undefined) => void, load: () => Promise<T>): Promise<T> {
  const existing = get();
  if (existing) return existing;
  const p = load();
  set(p);
  p.catch(() => set(undefined));
  return p;
}

async function readGz<T>(path: string): Promise<T> {
  return JSON.parse(gunzipSync(await readFile(path)).toString("utf8")) as T;
}

function manifestOf(dir: string): Promise<Manifest | null> {
  const cache = cacheFor(dir);
  return remember(
    () => cache.manifest,
    (p) => (cache.manifest = p),
    async () => {
      try {
        const m = JSON.parse(await readFile(join(dir, "manifest.json"), "utf8")) as Manifest;
        return m && m.format === "fdh-area-planner-data" ? m : null;
      } catch {
        return null;
      }
    }
  );
}

function postcodesOf(dir: string): Promise<Map<string, PostcodeEntry>> {
  const cache = cacheFor(dir);
  return remember(
    () => cache.postcodes,
    (p) => (cache.postcodes = p),
    async () => {
      const file = await readGz<{ items: [string, "d" | "s", number, 0 | 1, number, number, number, number, string | null][] }>(
        join(dir, "postcodes", "index.json.gz")
      );
      const map = new Map<string, PostcodeEntry>();
      for (const [code, kind, households, mappable, x0, y0, x1, y1, fileKey] of file.items) {
        map.set(code, {
          code,
          kind: kind === "d" ? "district" : "sector",
          households,
          mappable: mappable === 1,
          bbox: mappable === 1 ? decodeBbox([x0, y0, x1, y1]) : null,
          file: fileKey,
        });
      }
      return map;
    }
  );
}

function oaIndexOf(dir: string): Promise<OaEntry[]> {
  const cache = cacheFor(dir);
  return remember(
    () => cache.oaIndex,
    (p) => (cache.oaIndex = p),
    async () => {
      const file = await readGz<{ items: [string, number, number, number, number, number, string][] }>(join(dir, "oa-index.json.gz"));
      return file.items.map(([code, households, x0, y0, x1, y1, cell]) => ({
        code,
        households,
        bbox: decodeBbox([x0, y0, x1, y1]),
        cell,
      }));
    }
  );
}

function districtFileOf(dir: string, key: string): Promise<Record<string, EncodedGeometry>> {
  const cache = cacheFor(dir);
  return remember(
    () => cache.districtFiles.get(key),
    (p) => (p ? cache.districtFiles.set(key, p) : cache.districtFiles.delete(key)),
    () => readGz<Record<string, EncodedGeometry>>(join(dir, "postcodes", `${key}.json.gz`))
  );
}

function cellOf(dir: string, key: string): Promise<Map<string, Polygon | MultiPolygon>> {
  const cache = cacheFor(dir);
  return remember(
    () => cache.cells.get(key),
    (p) => (p ? cache.cells.set(key, p) : cache.cells.delete(key)),
    async () => {
      const list = await readGz<[string, EncodedGeometry][]>(join(dir, "oa", `${key}.json.gz`));
      return new Map(list.map(([code, encoded]) => [code, decodeGeometry(encoded)]));
    }
  );
}

export async function areaPlannerDataStatus(): Promise<AreaPlannerDataStatus> {
  try {
    const manifest = await manifestOf(areaPlannerDataDir());
    if (!manifest) return { installed: false, sample: false, builtAt: null, credits: [] };
    return {
      installed: true,
      sample: manifest.sample === true,
      builtAt: manifest.builtAt ?? null,
      credits: Array.isArray(manifest.credits) ? manifest.credits.map(String) : [],
    };
  } catch {
    return { installed: false, sample: false, builtAt: null, credits: [] };
  }
}

async function entryFor(code: string): Promise<PostcodeEntry | null> {
  const dir = areaPlannerDataDir();
  if (!(await manifestOf(dir))) return null;
  return (await postcodesOf(dir)).get(code) ?? null;
}

// "BH6" or "BH6 3", already tidied by the caller. Null when unknown or when
// no data is installed.
export async function findPostcode(code: string): Promise<PostcodeInfo | null> {
  const entry = await entryFor(code);
  if (!entry) return null;
  return { code: entry.code, kind: entry.kind, households: entry.households, mappable: entry.mappable };
}

export async function postcodeGeometry(code: string): Promise<Polygon | MultiPolygon | null> {
  const entry = await entryFor(code);
  if (!entry || !entry.mappable || !entry.file) return null;
  const encoded = (await districtFileOf(areaPlannerDataDir(), entry.file))[code];
  return encoded ? decodeGeometry(encoded) : null;
}

// About how many homes are in a shape, from Census 2021 households by Output
// Area. Null when no data is installed.
export async function estimateHouseholds(geometry: Polygon | MultiPolygon): Promise<number | null> {
  const dir = areaPlannerDataDir();
  if (!(await manifestOf(dir))) return null;
  const box = geometryBbox(geometry);
  const near = (await oaIndexOf(dir)).filter((oa) => oa.households > 0 && bboxesMeet(box, oa.bbox));
  const cellKeys = [...new Set(near.map((oa) => oa.cell))];
  const cells = new Map(await Promise.all(cellKeys.map(async (key) => [key, await cellOf(dir, key)] as const)));
  const oas: OutputArea[] = [];
  for (const oa of near) {
    const shape = cells.get(oa.cell)?.get(oa.code);
    if (shape) oas.push({ code: oa.code, households: oa.households, bbox: oa.bbox, geometry: shape });
  }
  return Math.round(weightedHouseholds(geometry, oas));
}
