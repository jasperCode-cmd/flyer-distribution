import { after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as zlib from "node:zlib";
import type { MultiPolygon, Polygon, Position } from "geojson";
import { area } from "@turf/area";
import { circle } from "@turf/circle";
import { weightedHouseholds, type OutputArea } from "@/lib/area-planner/households";
import { decodeGeometry, encodeGeometry } from "@/lib/area-planner/compact-geometry";
import {
  areaPlannerDataStatus,
  clearAreaPlannerDataCache,
  estimateHouseholds,
  findPostcode,
  postcodeGeometry,
} from "@/lib/area-planner/data";
import {
  assignOutputAreas,
  buildData,
  BuildError,
  SOURCE_FORMAT,
  validateSource,
  writeData,
  type SourceFile,
} from "@/scripts/area-planner/build-lib";
import { makeSampleSource } from "@/scripts/area-planner/make-sample-data";
import {
  checkZipFile,
  countPostcodes,
  eachLine,
  entryArea,
  esriRingsToGeoJSON,
  onspdColumns,
  readHouseholds,
  readZip,
  sectorOf,
  SourceError,
  splitCsvLine,
  ts041Columns,
} from "@/scripts/area-planner/build-area-planner-source.mjs";

// The Area Planner's data pipeline: the household estimate maths, the laptop
// script's readers, the data build and the server loader. All data here is
// made up.

const square = (x0: number, y0: number, x1: number, y1: number): Polygon => ({
  type: "Polygon",
  coordinates: [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]],
});
const oa = (code: string, households: number, geometry: Polygon | MultiPolygon): OutputArea => {
  const pts = (geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates).flat(2) as Position[];
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return { code, households, geometry, bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] };
};
const near = (actual: number, expected: number, tolerance: number, message?: string) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message ?? ""} expected ${expected} +/- ${tolerance}, got ${actual}`);

// Two side-by-side one degree squares at the equator.
const A = oa("A", 100, square(0, 0, 1, 1));
const B = oa("B", 60, square(1, 0, 2, 1));

// --- Household estimate maths on known shapes ---------------------------------

test("estimate: a shape covering exactly half of one Output Area gets half its households", () => {
  near(weightedHouseholds(square(0, 0, 0.5, 1), [A, B]), 50, 1e-6);
  near(weightedHouseholds(square(0.25, 0, 0.5, 1), [A, B]), 25, 1e-6);
});

test("estimate: a shape covering two whole Output Areas gets their sum, and one matching an Output Area exactly gets all of it", () => {
  near(weightedHouseholds(square(-1, -1, 3, 2), [A, B]), 160, 1e-9);
  assert.equal(weightedHouseholds(square(0, 0, 1, 1), [A, B]), 100);
});

test("estimate: a shape that misses every Output Area gets 0, and one reaching past the data counts only what it covers", () => {
  assert.equal(weightedHouseholds(square(5, 5, 6, 6), [A, B]), 0);
  near(weightedHouseholds(square(1.5, 0, 3, 1), [A, B]), 30, 1e-6, "half of B, the rest outside the data");
  assert.equal(weightedHouseholds(square(0, 0, 1, 1), []), 0);
});

test("estimate: MultiPolygon shapes and MultiPolygon Output Areas", () => {
  const twoHalves: MultiPolygon = { type: "MultiPolygon", coordinates: [square(0, 0, 0.5, 1).coordinates, square(1.5, 0, 2, 1).coordinates] };
  near(weightedHouseholds(twoHalves, [A, B]), 80, 1e-6, "half of A and half of B");
  const split = oa("S", 200, { type: "MultiPolygon", coordinates: [square(10, 0, 11, 1).coordinates, square(12, 0, 13, 1).coordinates] });
  near(weightedHouseholds(square(9, -1, 11.5, 2), [split]), 100, 1e-6, "the whole of one of its two equal parts");
});

test("estimate: Output Areas with no households are skipped", () => {
  assert.equal(weightedHouseholds(square(-1, -1, 3, 2), [oa("Z", 0, square(0, 0, 1, 1))]), 0);
});

test("estimate: a circle over a grid of equal Output Areas gets the area-proportional answer, within 1%", () => {
  // A 20 by 20 grid of 0.002 degree squares near Bournemouth, 100 homes each.
  const grid: OutputArea[] = [];
  for (let i = 0; i < 20; i++) {
    for (let j = 0; j < 20; j++) {
      const x = -1.9 + i * 0.002;
      const y = 50.72 + j * 0.002;
      grid.push(oa(`G${i}-${j}`, 100, square(x, y, x + 0.002, y + 0.002)));
    }
  }
  const disc = circle([-1.88, 50.74], 0.8, { steps: 128, units: "kilometers" }).geometry;
  const meanArea = grid.reduce((sum, g) => sum + area(g.geometry), 0) / grid.length;
  const expected = (area(disc) / meanArea) * 100;
  const estimate = weightedHouseholds(disc, grid);
  near(estimate, expected, expected * 0.01);
});

// --- Compact geometry -----------------------------------------------------------------

test("compact geometry: a polygon with a hole and a MultiPolygon come back to within a metre", () => {
  const withHole: Polygon = {
    type: "Polygon",
    coordinates: [
      [[-1.9, 50.7], [-1.8, 50.7], [-1.8, 50.8], [-1.9, 50.8], [-1.9, 50.7]],
      [[-1.86, 50.74], [-1.86, 50.76], [-1.84, 50.76], [-1.84, 50.74], [-1.86, 50.74]],
    ],
  };
  const back = decodeGeometry(encodeGeometry(withHole)!) as Polygon;
  assert.equal(back.type, "Polygon");
  assert.equal(back.coordinates.length, 2);
  back.coordinates.flat().forEach((p, i) => {
    const q = withHole.coordinates.flat()[i];
    near(p[0], q[0], 1e-5);
    near(p[1], q[1], 1e-5);
  });
  const multi: MultiPolygon = { type: "MultiPolygon", coordinates: [square(0, 0, 1, 1).coordinates, square(2, 0, 3, 1).coordinates] };
  const backMulti = decodeGeometry(encodeGeometry(multi)!);
  assert.equal(backMulti.type, "MultiPolygon");
  near(area(backMulti), area(multi), area(multi) * 1e-6);
});

test("compact geometry: a ring that collapses when rounded is dropped", () => {
  const tiny = square(0, 0, 0.000001, 0.000001);
  assert.equal(encodeGeometry(tiny), null);
  const withTinyHole: Polygon = { type: "Polygon", coordinates: [square(0, 0, 1, 1).coordinates[0], tiny.coordinates[0]] };
  assert.equal((decodeGeometry(encodeGeometry(withTinyHole)!) as Polygon).coordinates.length, 1);
});

// --- The laptop script's readers ---------------------------------------------------------

function makeZip(files: { name: string; data: Buffer; deflate: boolean }[]): Buffer {
  const crc = (b: Buffer) => ((zlib as unknown as { crc32?: (b: Buffer) => number }).crc32?.(b) ?? 0) >>> 0;
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const f of files) {
    const body = f.deflate ? zlib.deflateRawSync(f.data) : f.data;
    const name = Buffer.from(f.name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(f.deflate ? 8 : 0, 8);
    local.writeUInt32LE(crc(f.data), 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(f.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(f.deflate ? 8 : 0, 10);
    entry.writeUInt32LE(crc(f.data), 16);
    entry.writeUInt32LE(body.length, 20);
    entry.writeUInt32LE(f.data.length, 24);
    entry.writeUInt16LE(name.length, 28);
    entry.writeUInt32LE(offset, 42);
    parts.push(local, name, body);
    central.push(entry, name);
    offset += local.length + name.length + body.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cd, end]);
}

test("zip reader: reads a stored and a deflated entry without extracting anything", () => {
  const csv = Buffer.from("pcds,doterm\nBH6 3AB,\n".repeat(50));
  const zip = makeZip([
    { name: "Documents/readme.txt", data: Buffer.from("hello"), deflate: false },
    { name: "Data/multi_csv/ONSPD_AUG_2026_UK_BH.csv", data: csv, deflate: true },
  ]);
  const { entries, read } = readZip(zip);
  assert.deepEqual(entries.map((e: { name: string }) => e.name), ["Documents/readme.txt", "Data/multi_csv/ONSPD_AUG_2026_UK_BH.csv"]);
  assert.equal(read(entries[0]).toString(), "hello");
  assert.equal(read(entries[1]).toString(), csv.toString());
  assert.equal(entryArea(entries[1].name), "BH");
  assert.equal(entryArea("Data/multi_csv/ONSPD_AUG_2026_UK_so.csv"), "SO");
  assert.equal(entryArea(entries[0].name), null);
  assert.equal(entryArea("Data/ONSPD_AUG_2026_UK.csv"), null);
  assert.throws(() => readZip(Buffer.from("not a zip at all, just some words")), SourceError);
});

test("zip check: a download that is really a web page gets a clear message", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ap-zip-"));
  try {
    const page = join(dir, "onspd.zip");
    await writeFile(page, "<!DOCTYPE html><html><body>Sign in</body></html>");
    assert.throws(() => checkZipFile(page, "the ONS Postcode Directory", "Download it with your browser."), (err: Error) => {
      assert.ok(err instanceof SourceError);
      assert.match(err.message, /not a zip file \(it looks like a web page\)\. Download it with your browser\./);
      return true;
    });
    const zip = join(dir, "real.zip");
    await writeFile(zip, makeZip([{ name: "a.txt", data: Buffer.from("x"), deflate: false }]));
    assert.doesNotThrow(() => checkZipFile(zip, "a zip", ""));
    assert.throws(() => checkZipFile(join(dir, "missing.zip"), "the TS041 zip", ""), /Can't find the TS041 zip/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("CSV: quoted fields with commas and doubled quotes, CRLF lines and a byte order mark", () => {
  assert.deepEqual(splitCsvLine('a,"b, c","say ""hi""",,d'), ["a", "b, c", 'say "hi"', "", "d"]);
  assert.deepEqual(splitCsvLine("x,y,z"), ["x", "y", "z"]);
  const lines: string[] = [];
  eachLine(Buffer.from("﻿one,two\r\nthree,four\r\n\r\nfive"), (l: string) => lines.push(l));
  assert.deepEqual(lines, ["one,two", "three,four", "five"]);
});

test("ONSPD columns: found by name in an older and a renamed header, and a missing one prints the header", () => {
  const old = onspdColumns(["pcd", "pcd2", "pcds", "dointr", "doterm", "oscty", "usertype", "oseast1m", "oa11", "oa21", "lat", "long"]);
  assert.deepEqual(old, { postcode: 2, terminated: 4, userType: 6, oa21: 9 });
  const renamed = onspdColumns(['"PCD7"', '"PCD8"', '"PCDS"', '"DOINTR"', '"DOTERM"', '"USRTYPIND"', '"OA21CD"', '"LSOA21CD"']);
  assert.deepEqual(renamed, { postcode: 2, terminated: 4, userType: 5, oa21: 6 });
  assert.throws(
    () => onspdColumns(["pcds", "doterm", "usertype", "lsoa21"]),
    (err: Error) => {
      assert.ok(err instanceof SourceError);
      assert.match(err.message, /2021 Output Area \(oa21\)/);
      assert.match(err.message, /pcds,doterm,usertype,lsoa21/);
      return true;
    }
  );
});

test("sector of a postcode: any spacing or case, and not for anything that isn't a full postcode", () => {
  assert.equal(sectorOf("BH6 3AB"), "BH6 3");
  assert.equal(sectorOf("bh63ab"), "BH6 3");
  assert.equal(sectorOf("SO14  0AA"), "SO14 0");
  assert.equal(sectorOf("PO1 2AB"), "PO1 2");
  assert.equal(sectorOf("W1A 1AA"), "W1A 1");
  assert.equal(sectorOf("BH6"), null);
  assert.equal(sectorOf("BH6 3A"), null);
  assert.equal(sectorOf("123 456"), null);
});

test("postcode counts: live small-user postcodes only, and the second pass only counts the Output Areas already found", () => {
  const csv = Buffer.from(
    [
      "pcds,doterm,usertype,oa21",
      "BH6 3AA,,0,E00000001",
      "BH6 3AB,,0,E00000001",
      "BH6 4AA,,0,E00000001",
      "BH6 3AD,202001,0,E00000001", // terminated
      "BH6 3AE,,1,E00000001", // large user
      "BH6 3AF,,0,", // no Output Area
      "BH6 3AG,,0,E99999999", // not an Output Area code
      "BH6 4AB,,0,E00000002",
    ].join("\n")
  );
  const counts = new Map<string, Map<string, number>>();
  const totals = new Map<string, number>();
  const { kept } = countPostcodes(csv, counts, { sectorTotals: totals });
  assert.equal(kept, 4);
  assert.deepEqual(Object.fromEntries(counts.get("E00000001")!), { "BH6 3": 2, "BH6 4": 1 });
  assert.deepEqual(Object.fromEntries(totals), { "BH6 3": 2, "BH6 4": 2 });

  const neighbours = Buffer.from(["pcds,doterm,usertype,oa21", "GU1 1AA,,0,E00000002", "GU1 1AB,,0,E00000002", "GU2 2AA,,0,E00000099"].join("\n"));
  countPostcodes(neighbours, counts, { onlyOas: new Set(["E00000001", "E00000002"]) });
  assert.deepEqual(Object.fromEntries(counts.get("E00000002")!), { "BH6 4": 1, "GU1 1": 2 });
  assert.equal(counts.has("E00000099"), false);
});

test("TS041: the Output Area code and total households columns are found by name", () => {
  assert.deepEqual(ts041Columns(["date", "geography", "geography code", "Number of households: Total; measures: Value"]), {
    code: 2,
    households: 3,
  });
  assert.deepEqual(ts041Columns(["Geography Code", "Households: one person", "Households: Total"]), { code: 0, households: 2 });
  assert.throws(() => ts041Columns(["date", "geography", "geography code", "Residents"]), /number of households/);
  const csv = Buffer.from('date,geography,geography code,"Number of households: Total"\n2021,E00000001,E00000001,"1,234"\n2021,E00000002,E00000002,98\n2021,E00000003,E00000003,77\n');
  assert.deepEqual(Object.fromEntries(readHouseholds(csv, new Set(["E00000001", "E00000002"]))), { E00000001: 1234, E00000002: 98 });
});

test("Esri JSON: clockwise exteriors and anticlockwise holes become GeoJSON polygons", () => {
  const exterior = [[0, 0], [0, 10], [10, 10], [10, 0], [0, 0]]; // clockwise
  const hole = [[2, 2], [4, 2], [4, 4], [2, 4], [2, 2]]; // anticlockwise
  const g = esriRingsToGeoJSON([exterior, hole]) as Polygon;
  assert.equal(g.type, "Polygon");
  assert.equal(g.coordinates.length, 2);
  near(area(g), area(square(0, 0, 10, 10)) - area(square(2, 2, 4, 4)), 1);
  const second = [[20, 0], [20, 5], [25, 5], [25, 0], [20, 0]];
  const m = esriRingsToGeoJSON([exterior, hole, second]) as MultiPolygon;
  assert.equal(m.type, "MultiPolygon");
  assert.deepEqual(m.coordinates.map((p) => p.length), [2, 1]);
  assert.equal(esriRingsToGeoJSON([]), null);
});

// --- The data build -----------------------------------------------------------------------

function tinySource(): SourceFile {
  // Four 0.01 degree squares in a row near Southbourne. O1 and O2 are BH6 3,
  // O3 is BH6 4 (narrowly, with some BH6 3 postcodes), O4 is mostly GU1 1.
  const x = (i: number) => -1.8 + i * 0.01;
  return {
    format: SOURCE_FORMAT,
    version: 1,
    builtAt: "2026-10-19T00:00:00.000Z",
    areas: ["BH", "SO", "PO", "SP", "DT"],
    inputs: {},
    oas: [1, 2, 3, 4].map((n) => ({ code: `E0000000${n}`, households: n * 100, geometry: square(x(n - 1), 50.72, x(n), 50.73) })),
    postcodeCounts: [
      ["E00000001", "BH6 3", 5],
      ["E00000002", "BH6 3", 4],
      ["E00000002", "BH6 4", 1],
      ["E00000003", "BH6 3", 3],
      ["E00000003", "BH6 4", 3],
      ["E00000004", "BH6 4", 1],
      ["E00000004", "GU1 1", 6],
    ],
    sectorTotals: { "BH6 3": 12, "BH6 4": 5, "BH6 9": 2 },
  };
}

test("assignment: each Output Area goes to the sector with most of its postcodes, ties alphabetically, and a mostly GU one to none", () => {
  const assigned = assignOutputAreas(tinySource());
  assert.deepEqual(Object.fromEntries(assigned), {
    E00000001: "BH6 3",
    E00000002: "BH6 3",
    E00000003: "BH6 3", // a 3 to 3 tie goes to BH6 3
    E00000004: null,
  });
});

test("build: sector and district shapes are unions with no interior edges, households are exact sums, and a sector with no Output Area is not mappable", () => {
  const source = tinySource();
  // Make O3 clearly BH6 4.
  source.postcodeCounts = source.postcodeCounts.map((r) => (r[0] === "E00000003" && r[1] === "BH6 4" ? [r[0], r[1], 4] : r));
  const { shapes, manifest } = buildData(source, { builtAt: "2026-10-19T12:00:00.000Z" });
  const byCode = new Map(shapes.map((s) => [s.code, s]));

  const s3 = byCode.get("BH6 3")!;
  assert.equal(s3.households, 300);
  assert.equal(s3.geometry!.type, "Polygon");
  const ring = (s3.geometry as Polygon).coordinates;
  assert.equal(ring.length, 1, "one ring, no holes");
  assert.equal(ring[0].length, 5, "two squares side by side become one rectangle: 4 corners and the closing point");
  near(area(s3.geometry!), area(source.oas[0].geometry) + area(source.oas[1].geometry), 1);

  const s4 = byCode.get("BH6 4")!;
  assert.equal(s4.households, 300);
  const s9 = byCode.get("BH6 9")!;
  assert.deepEqual([s9.mappable, s9.households, s9.geometry], [false, 0, null]);

  const d = byCode.get("BH6")!;
  assert.equal(d.kind, "district");
  assert.equal(d.households, 600, "the district is its sectors' sum; the mostly GU Output Area is in no sector");
  near(area(d.geometry!), area(s3.geometry!) + area(s4.geometry!), 1);
  assert.equal(byCode.has("GU1 1"), false);
  assert.equal(manifest.counts.outputAreas, 4, "the GU Output Area is still there for estimates");
  assert.deepEqual(
    [manifest.counts.sectors, manifest.counts.unmappableSectors, manifest.counts.districts, manifest.counts.households],
    [3, 1, 1, 600]
  );
  assert.equal(manifest.sample, false);
  assert.match(manifest.credits.join("\n"), /Open Government Licence v\.3\.0/);
});

test("build: a source file that isn't right says what is wrong", () => {
  assert.throws(() => validateSource({ format: "something else" }), BuildError);
  const noGeometry = { ...tinySource(), oas: [{ code: "E00000001", households: 1, geometry: null }] };
  assert.throws(() => validateSource(noGeometry), /E00000001 has no polygon boundary/);
  const badSector = { ...tinySource(), postcodeCounts: [["E00000001", "BH6", 1]] };
  assert.throws(() => validateSource(badSector), /not a postcode sector/);
});

// --- The loader, against made-up sample data ---------------------------------------------------

const dirs: string[] = [];
after(async () => {
  delete process.env.AREA_PLANNER_DATA_DIR;
  clearAreaPlannerDataCache();
  for (const d of dirs) await rm(d, { recursive: true, force: true });
});

async function sampleDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "ap-data-"));
  dirs.push(dir);
  await writeData(buildData(makeSampleSource(), { sample: true }), dir);
  return dir;
}

test("loader: postcodes, shapes, estimates and status from the sample data", async () => {
  process.env.AREA_PLANNER_DATA_DIR = await sampleDir();
  clearAreaPlannerDataCache();

  const status = await areaPlannerDataStatus();
  assert.equal(status.installed, true);
  assert.equal(status.sample, true);
  assert.deepEqual(status.credits, ["Made-up sample data for testing only"]);

  const district = await findPostcode("BH6");
  assert.equal(district?.kind, "district");
  assert.equal(district?.mappable, true);
  const sector = await findPostcode("BH6 3");
  assert.equal(sector?.kind, "sector");
  assert.ok((sector?.households ?? 0) > 1000);
  assert.equal(await findPostcode("BH6 9"), null);
  assert.equal(await findPostcode("SO14"), null);
  assert.deepEqual(await findPostcode("BH1 9"), { code: "BH1 9", kind: "sector", households: 0, mappable: false });
  assert.equal(await postcodeGeometry("BH1 9"), null);

  const shape = await postcodeGeometry("BH6 3");
  assert.ok(shape && (shape.type === "Polygon" || shape.type === "MultiPolygon"));
  near((await estimateHouseholds(shape))!, sector!.households, 1, "a postcode shape's estimate is its exact total");
  const bh6 = (await postcodeGeometry("BH6"))!;
  near((await estimateHouseholds(bh6))!, district!.households, 1);
  const sectors = ["BH6 3", "BH6 4", "BH6 5"];
  const sum = (await Promise.all(sectors.map(findPostcode))).reduce((n, s) => n + (s?.households ?? 0), 0);
  assert.equal(district!.households, sum, "a district is the sum of its sectors");

  const disc = circle([-1.85, 50.74], 0.8, { steps: 64, units: "kilometers" }).geometry;
  const estimate = (await estimateHouseholds(disc))!;
  assert.ok(estimate > 1000 && estimate < 5000, `an 800m circle in the sample gets ${estimate}`);
  assert.equal(await estimateHouseholds(square(10, 10, 11, 11)), 0, "outside the data");
});

test("loader: nothing installed means status not installed and every lookup null", async () => {
  const empty = await mkdtemp(join(tmpdir(), "ap-empty-"));
  dirs.push(empty);
  process.env.AREA_PLANNER_DATA_DIR = empty;
  clearAreaPlannerDataCache();
  assert.deepEqual(await areaPlannerDataStatus(), { installed: false, sample: false, builtAt: null, credits: [] });
  assert.equal(await findPostcode("BH6"), null);
  assert.equal(await postcodeGeometry("BH6"), null);
  assert.equal(await estimateHouseholds(square(-1.9, 50.7, -1.8, 50.8)), null);
});

test("build output: replacing a build leaves anything else in the folder alone", async () => {
  const dir = await sampleDir();
  await writeFile(join(dir, "keep.txt"), "mine");
  await writeData(buildData(makeSampleSource(), { sample: true }), dir);
  assert.equal(await readFile(join(dir, "keep.txt"), "utf8"), "mine");
  const manifest = JSON.parse(await readFile(join(dir, "manifest.json"), "utf8"));
  assert.equal(manifest.format, "fdh-area-planner-data");
  assert.match(await readFile(join(dir, "SOURCES.md"), "utf8"), /Made-up sample data for testing only/);
});
