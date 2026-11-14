import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { Lru } from "@/lib/area-planner/lru";
import { boxesMeet, cellsMeeting, decodeCell, roadBox, type MercatorBox, type Road, type RoadsManifest } from "./roads-format";

// The bundled OS Open Roads data (data/os-roads), read on the server only
// for the cells a job's area touches, and kept in memory for later requests
// (about 25 KB a cell on disk). The folder is included in the Rounds API's
// server functions by next.config's outputFileTracingIncludes.

export function roadsDataDir(): string {
  return process.env.OS_ROADS_DATA_DIR || join(process.cwd(), "data", "os-roads");
}

let manifest: Promise<RoadsManifest | null> | null = null;
const cells = new Lru<Road[]>(96);

export function roadsManifest(): Promise<RoadsManifest | null> {
  manifest ??= readFile(join(roadsDataDir(), "manifest.json"), "utf8")
    .then((text) => JSON.parse(text) as RoadsManifest)
    .catch(() => null);
  return manifest;
}

async function cell(dir: string, key: string, cellM: number): Promise<Road[]> {
  const cached = cells.get(key);
  if (cached) return cached;
  const roads = decodeCell(gunzipSync(await readFile(join(dir, "cells", `${key}.bin.gz`))), key, cellM);
  cells.set(key, roads);
  return roads;
}

// Every road link meeting any of the boxes.
export async function roadsIn(boxes: MercatorBox[]): Promise<Road[]> {
  const m = await roadsManifest();
  if (!m) throw new Error("The street data isn't installed.");
  const dir = roadsDataDir();
  const keys = new Set<string>();
  for (const box of boxes) for (const key of cellsMeeting(box, m.cellM)) if (m.cells[key]) keys.add(key);
  const out: Road[] = [];
  for (const key of keys) {
    for (const road of await cell(dir, key, m.cellM)) {
      const rb = roadBox(road);
      if (boxes.some((b) => boxesMeet(rb, b))) out.push(road);
    }
  }
  return out;
}
