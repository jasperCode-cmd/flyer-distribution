// Builds the Area Planner's source file from official open data, on any
// computer with Node.js 18 or later. Nothing to install: it needs only Node,
// the two downloaded zips and an internet connection for the Output Area
// boundaries.
//
//   node build-area-planner-source.mjs --onspd onspd.zip --ts041 census2021-ts041.zip
//
// Optional: --out <file> (default area-planner-source.json.gz) and
// --oa-service <FeatureServer layer URL> if ONS ever renames the boundary
// service.
//
// It reads, without unzipping them:
//   - the ONS Postcode Directory (multi-CSV zip): every live, small-user
//     postcode in BH, SO, PO, SP and DT, with its 2021 Output Area, then
//     every other postcode in those same Output Areas;
//   - Census 2021 TS041 (Number of Households) by Output Area, from Nomis;
// and fetches those Output Areas' boundaries (December 2021, generalised and
// clipped, V2) from the ONS ArcGIS service.
//
// It writes area-planner-source.json.gz and area-planner-source-report.txt.
// Those two files are what to send back. No personal data is involved: it is
// all published open data under the Open Government Licence.

import { createHash } from "node:crypto";
import { closeSync, existsSync, openSync, readFileSync, readSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { gzipSync, inflateRawSync } from "node:zlib";

export const TARGET_AREAS = ["BH", "SO", "PO", "SP", "DT"];
export const OA_SERVICE =
  "https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/Output_Areas_2021_EW_BGC_V2/FeatureServer/0/query";
export const ONSPD_PAGE = "https://geoportal.statistics.gov.uk/datasets/9e5a92a3cfb14dc7ad43d6ea7a7b8c7f/about";
const OA_BATCH = 100;
const OA_CONCURRENCY = 4;
const RETRY_WAITS_MS = [2000, 4000, 8000, 16000];
const OA_CODE_RE = /^[EW]00\d{6}$/;

export class SourceError extends Error {}

// --- Zip files --------------------------------------------------------------

const EOCD_SIG = 0x06054b50;
const ZIP64_LOCATOR_SIG = 0x07064b50;
const ZIP64_EOCD_SIG = 0x06064b50;
const CENTRAL_SIG = 0x02014b50;
const LOCAL_SIG = 0x04034b50;

function u64(buf, offset) {
  return Number(buf.readBigUInt64LE(offset));
}

// The entries of a zip held in memory, each readable on its own: stored and
// deflated entries, with ZIP64 sizes and offsets where a zip needs them.
export function readZip(buf) {
  if (buf.length < 22) throw new SourceError("This file is too small to be a zip.");
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 0xffff); i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new SourceError("This file is not a complete zip (no end of central directory found).");

  let count = buf.readUInt16LE(eocd + 10);
  let cdOffset = buf.readUInt32LE(eocd + 16);
  if (count === 0xffff || cdOffset === 0xffffffff) {
    const locator = eocd - 20;
    if (locator < 0 || buf.readUInt32LE(locator) !== ZIP64_LOCATOR_SIG) {
      throw new SourceError("This zip says it is ZIP64 but has no ZIP64 locator.");
    }
    const z64 = u64(buf, locator + 8);
    if (buf.readUInt32LE(z64) !== ZIP64_EOCD_SIG) throw new SourceError("This zip's ZIP64 directory is damaged.");
    count = u64(buf, z64 + 32);
    cdOffset = u64(buf, z64 + 48);
  }

  const entries = [];
  let p = cdOffset;
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== CENTRAL_SIG) throw new SourceError("This zip's directory is damaged.");
    const method = buf.readUInt16LE(p + 10);
    let compressedSize = buf.readUInt32LE(p + 20);
    let size = buf.readUInt32LE(p + 24);
    const nameLength = buf.readUInt16LE(p + 28);
    const extraLength = buf.readUInt16LE(p + 30);
    const commentLength = buf.readUInt16LE(p + 32);
    let localOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLength);
    // ZIP64 extra field: only the values whose 32-bit fields are full, in order.
    let e = p + 46 + nameLength;
    const extraEnd = e + extraLength;
    while (e + 4 <= extraEnd) {
      const id = buf.readUInt16LE(e);
      const length = buf.readUInt16LE(e + 2);
      if (id === 0x0001) {
        let q = e + 4;
        if (size === 0xffffffff) {
          size = u64(buf, q);
          q += 8;
        }
        if (compressedSize === 0xffffffff) {
          compressedSize = u64(buf, q);
          q += 8;
        }
        if (localOffset === 0xffffffff) localOffset = u64(buf, q);
      }
      e += 4 + length;
    }
    entries.push({ name, method, compressedSize, size, localOffset });
    p = extraEnd + commentLength;
  }

  function read(entry) {
    const h = entry.localOffset;
    if (buf.readUInt32LE(h) !== LOCAL_SIG) throw new SourceError(`The zip entry ${entry.name} is damaged.`);
    const start = h + 30 + buf.readUInt16LE(h + 26) + buf.readUInt16LE(h + 28);
    const data = buf.subarray(start, start + entry.compressedSize);
    if (entry.method === 0) return data;
    if (entry.method === 8) return inflateRawSync(data);
    throw new SourceError(
      `The zip entry ${entry.name} uses compression method ${entry.method}, which this script can't read. ` +
        "Extract the zip, zip the folder again with Windows (Send to > Compressed folder) and try again."
    );
  }

  return { entries, read };
}

// A clear message when a download is a web page (a sign-in or error page)
// rather than the zip itself.
export function checkZipFile(path, what, help) {
  if (!existsSync(path)) throw new SourceError(`Can't find ${what} at ${path}.`);
  const head = Buffer.alloc(4);
  const fd = openSync(path, "r");
  try {
    readSync(fd, head, 0, 4, 0);
  } finally {
    closeSync(fd);
  }
  if (head.readUInt32LE(0) !== LOCAL_SIG) {
    const looksHtml = head.toString("latin1").trimStart().startsWith("<");
    throw new SourceError(
      `${path} is not a zip file${looksHtml ? " (it looks like a web page)" : ""}. ${help}`
    );
  }
}

// --- CSV ---------------------------------------------------------------------

// One CSV line into fields: quoted fields may contain commas, and "" inside
// quotes is a quote.
export function splitCsvLine(line) {
  if (!line.includes('"')) return line.split(",");
  const fields = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      fields.push(field);
      field = "";
    } else field += c;
  }
  fields.push(field);
  return fields;
}

// Calls onLine for every line of a text buffer, without splitting it all at
// once. The first line is the header.
export function eachLine(buf, onLine) {
  let text = buf.toString("utf8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  let start = 0;
  while (start < text.length) {
    let end = text.indexOf("\n", start);
    if (end < 0) end = text.length;
    let line = text.slice(start, end);
    if (line.endsWith("\r")) line = line.slice(0, -1);
    if (line) onLine(line);
    start = end + 1;
  }
}

const tidyHeader = (h) => h.trim().replace(/^"|"$/g, "").trim().toLowerCase();

function headerError(what, header) {
  return new SourceError(
    `Couldn't find the ${what} column in this file's header. Please send this line to Claude:\n${header.join(",")}`
  );
}

// The ONS Postcode Directory columns this needs, found by name so that a
// release that renames them slightly still works.
export function onspdColumns(header) {
  const names = header.map(tidyHeader);
  const find = (tests) => {
    for (const test of tests) {
      const i = names.findIndex((n) => (typeof test === "string" ? n === test : test.test(n)));
      if (i >= 0) return i;
    }
    return -1;
  };
  const postcode = find(["pcds", "pcd", "pcd8", "pcd7", "pcd2", "postcode", /^pcd/]);
  const terminated = find([/^doterm/, /term/]);
  const userType = find([/^usertype/, /^usrtypind/, /^user_?type/, /^usrtyp/]);
  const oa21 = find([/^oa21/]);
  const missing = [];
  if (postcode < 0) missing.push("postcode (pcds)");
  if (terminated < 0) missing.push("termination date (doterm)");
  if (userType < 0) missing.push("user type (usertype)");
  if (oa21 < 0) missing.push("2021 Output Area (oa21)");
  if (missing.length > 0) throw headerError(missing.join(", "), header);
  return { postcode, terminated, userType, oa21 };
}

// The TS041 columns: the Output Area code and the total number of households.
export function ts041Columns(header) {
  const names = header.map(tidyHeader);
  const code = names.findIndex((n) => n === "geography code" || n === "geography_code" || /geography.?code/.test(n));
  if (code < 0) throw headerError("geography code", header);
  const candidates = names
    .map((n, i) => ({ n, i }))
    .filter(({ n, i }) => i !== code && n.includes("household"));
  if (candidates.length === 0) throw headerError("number of households", header);
  const total = candidates.find(({ n }) => n.includes("total")) ?? candidates[0];
  return { code, households: total.i };
}

// "BH6 3AB" (any spacing or case) to its sector "BH6 3"; null when it isn't
// a full postcode.
export function sectorOf(postcode) {
  const pc = String(postcode).toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (pc.length < 5 || pc.length > 7) return null;
  const outward = pc.slice(0, -3);
  const inward = pc.slice(-3);
  if (!/^[A-Z]{1,2}[0-9][A-Z0-9]?$/.test(outward) || !/^[0-9][A-Z]{2}$/.test(inward)) return null;
  return `${outward} ${inward[0]}`;
}

export function areaOf(code) {
  const m = /^[A-Z]{1,2}/.exec(code);
  return m ? m[0] : "";
}

// The postcode area of a multi-CSV entry, from its name: ..._UK_BH.csv.
export function entryArea(name) {
  if (!/multi_csv/i.test(name)) return null;
  const m = /_([A-Za-z]{1,2})\.csv$/.exec(name);
  return m ? m[1].toUpperCase() : null;
}

// --- Esri JSON to GeoJSON ------------------------------------------------------

function ringArea(ring) {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return sum / 2;
}

function pointInRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Esri polygons list rings with exteriors clockwise and holes anticlockwise.
// GeoJSON wants each exterior (anticlockwise) followed by its holes
// (clockwise), so holes are matched to the smallest exterior around them.
export function esriRingsToGeoJSON(rings) {
  const exteriors = [];
  const holes = [];
  for (const ring of rings ?? []) {
    if (!ring || ring.length < 4) continue;
    if (ringArea(ring) < 0) exteriors.push({ ring: [...ring].reverse(), area: -ringArea(ring), holes: [] });
    else holes.push([...ring].reverse());
  }
  for (const hole of holes) {
    const around = exteriors
      .filter((e) => pointInRing(hole[0], e.ring))
      .sort((a, b) => a.area - b.area)[0];
    if (around) around.holes.push(hole);
    // A hole with nothing around it is really an exterior drawn the wrong way.
    else exteriors.push({ ring: [...hole].reverse(), area: Math.abs(ringArea(hole)), holes: [] });
  }
  if (exteriors.length === 0) return null;
  const polygons = exteriors.map((e) => [e.ring, ...e.holes]);
  return polygons.length === 1
    ? { type: "Polygon", coordinates: polygons[0] }
    : { type: "MultiPolygon", coordinates: polygons };
}

export function roundGeometry(geometry, decimals = 6) {
  const f = 10 ** decimals;
  const r = (ring) => ring.map(([x, y]) => [Math.round(x * f) / f, Math.round(y * f) / f]);
  if (geometry.type === "Polygon") return { type: "Polygon", coordinates: geometry.coordinates.map(r) };
  if (geometry.type === "MultiPolygon") {
    return { type: "MultiPolygon", coordinates: geometry.coordinates.map((p) => p.map(r)) };
  }
  return null;
}

// --- Reading the postcode directory ---------------------------------------------

// Counts live small-user postcodes per Output Area and sector. With onlyOas
// set (the second pass), only those Output Areas are counted.
/**
 * @param {Buffer} buf
 * @param {Map<string, Map<string, number>>} counts
 * @param {{ onlyOas?: Set<string> | null, sectorTotals?: Map<string, number> | null }} [options]
 */
export function countPostcodes(buf, counts, { onlyOas = null, sectorTotals = null } = {}) {
  let cols = null;
  let rows = 0;
  let kept = 0;
  eachLine(buf, (line) => {
    if (!cols) {
      cols = onspdColumns(splitCsvLine(line));
      return;
    }
    rows++;
    const f = splitCsvLine(line);
    const oa = (f[cols.oa21] ?? "").trim();
    if (!OA_CODE_RE.test(oa)) return;
    if (onlyOas && !onlyOas.has(oa)) return;
    if ((f[cols.terminated] ?? "").trim() !== "") return;
    if ((f[cols.userType] ?? "").trim() !== "0") return;
    const sector = sectorOf(f[cols.postcode] ?? "");
    if (!sector) return;
    kept++;
    let bySector = counts.get(oa);
    if (!bySector) counts.set(oa, (bySector = new Map()));
    bySector.set(sector, (bySector.get(sector) ?? 0) + 1);
    if (sectorTotals) sectorTotals.set(sector, (sectorTotals.get(sector) ?? 0) + 1);
  });
  return { rows, kept };
}

export function readHouseholds(buf, wanted) {
  let cols = null;
  const households = new Map();
  eachLine(buf, (line) => {
    const f = splitCsvLine(line);
    if (!cols) {
      cols = ts041Columns(f);
      return;
    }
    const code = (f[cols.code] ?? "").trim();
    if (!wanted.has(code)) return;
    const n = Number((f[cols.households] ?? "").replace(/,/g, "").trim());
    if (Number.isFinite(n) && n >= 0) households.set(code, Math.round(n));
  });
  return households;
}

// --- Fetching Output Area boundaries ---------------------------------------------

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function postQuery(url, params) {
  let lastError = null;
  for (let attempt = 0; attempt <= RETRY_WAITS_MS.length; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": "fdh-area-planner-data-build/1" },
        body: new URLSearchParams(params).toString(),
      });
      const text = await res.text();
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) {
        throw new SourceError(`The boundary service at ${url} answered HTTP ${res.status}: ${text.slice(0, 300)}`);
      }
      try {
        return JSON.parse(text);
      } catch {
        throw new SourceError(`The boundary service at ${url} did not send JSON: ${text.slice(0, 300)}`);
      }
    } catch (err) {
      if (err instanceof SourceError) throw err;
      lastError = err;
      if (attempt < RETRY_WAITS_MS.length) await wait(RETRY_WAITS_MS[attempt]);
    }
  }
  throw new SourceError(`Couldn't reach the boundary service at ${url} after 5 tries (${lastError?.message ?? "no answer"}).`);
}

function codeProperty(obj) {
  if (!obj) return null;
  const key = Object.keys(obj).find((k) => k.toLowerCase() === "oa21cd");
  return key ? String(obj[key]) : null;
}

async function fetchBatch(url, codes, mode) {
  const params = {
    where: `OA21CD IN (${codes.map((c) => `'${c}'`).join(",")})`,
    outFields: "OA21CD",
    returnGeometry: "true",
    outSR: "4326",
    geometryPrecision: "6",
    f: mode,
  };
  const data = await postQuery(url, params);
  if (data.error) {
    throw new SourceError(
      `The boundary service at ${url} returned an error: ${JSON.stringify(data.error).slice(0, 300)}`
    );
  }
  const found = new Map();
  for (const feat of data.features ?? []) {
    if (mode === "geojson") {
      const code = codeProperty(feat.properties);
      const g = feat.geometry && roundGeometry(feat.geometry);
      if (code && g) found.set(code, g);
    } else {
      const code = codeProperty(feat.attributes);
      const g = feat.geometry && esriRingsToGeoJSON(feat.geometry.rings);
      if (code && g) found.set(code, roundGeometry(g));
    }
  }
  return found;
}

export async function fetchBoundaries(url, codes, log = console.log) {
  const batches = [];
  for (let i = 0; i < codes.length; i += OA_BATCH) batches.push(codes.slice(i, i + OA_BATCH));
  const geometries = new Map();
  if (batches.length === 0) return { geometries, mode: "geojson" };
  // GeoJSON first; if the service won't give it, its own JSON.
  let mode = "geojson";
  let first = null;
  try {
    first = await fetchBatch(url, batches[0], mode);
  } catch (err) {
    if (!(err instanceof SourceError) || /HTTP 4\d\d/.test(err.message)) throw err;
  }
  if (!first || first.size === 0) {
    mode = "json";
    first = await fetchBatch(url, batches[0], mode);
  }
  for (const [code, g] of first) geometries.set(code, g);
  let done = 1;
  let next = 1;
  async function worker() {
    while (next < batches.length) {
      const batch = batches[next++];
      const found = await fetchBatch(url, batch, mode);
      for (const [code, g] of found) geometries.set(code, g);
      done++;
      if (done % 10 === 0 || done === batches.length) {
        log(`  boundaries: ${done} of ${batches.length} batches (${geometries.size} Output Areas so far)`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(OA_CONCURRENCY, batches.length) }, worker));
  return { geometries, mode };
}

// --- Main ---------------------------------------------------------------------

function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

export function parseArgs(argv) {
  const out = { onspd: null, ts041: null, out: "area-planner-source.json.gz", oaService: OA_SERVICE };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const value = () => {
      const v = argv[++i];
      if (!v) throw new SourceError(`${a} needs a value.`);
      return v;
    };
    if (a === "--onspd") out.onspd = value();
    else if (a === "--ts041") out.ts041 = value();
    else if (a === "--out") out.out = value();
    else if (a === "--oa-service") out.oaService = value();
    else throw new SourceError(`Unknown option ${a}.`);
  }
  if (!out.onspd || !out.ts041) {
    throw new SourceError("Usage: node build-area-planner-source.mjs --onspd onspd.zip --ts041 census2021-ts041.zip");
  }
  return out;
}

async function main() {
  const started = Date.now();
  const major = Number(process.versions.node.split(".")[0]);
  if (major < 18) throw new SourceError(`This needs Node.js 18 or later; this computer has ${process.versions.node}.`);
  const args = parseArgs(process.argv.slice(2));
  const warnings = [];
  const log = (m) => console.log(m);

  checkZipFile(args.onspd, "the ONS Postcode Directory", `Download it with your browser from ${ONSPD_PAGE} (the Download button) and try again.`);
  checkZipFile(args.ts041, "the Census 2021 TS041 zip", "Download https://www.nomisweb.co.uk/output/census/2021/census2021-ts041.zip with your browser and try again.");

  log("Reading the ONS Postcode Directory...");
  const onspdBuf = readFileSync(args.onspd);
  const onspd = readZip(onspdBuf);
  const areaEntries = onspd.entries.filter((e) => entryArea(e.name));
  if (areaEntries.length === 0) {
    throw new SourceError(
      "No multi-CSV files (Data/multi_csv/..._BH.csv and so on) were found in the postcode directory zip. " +
        `Its first entries are: ${onspd.entries.slice(0, 20).map((e) => e.name).join(", ")}`
    );
  }
  const targets = areaEntries.filter((e) => TARGET_AREAS.includes(entryArea(e.name)));
  const missingAreas = TARGET_AREAS.filter((a) => !targets.some((e) => entryArea(e.name) === a));
  if (missingAreas.length > 0) throw new SourceError(`The postcode directory has no file for ${missingAreas.join(", ")}.`);

  const counts = new Map();
  const sectorTotals = new Map();
  const perArea = new Map();
  for (const entry of targets) {
    const area = entryArea(entry.name);
    const { kept } = countPostcodes(onspd.read(entry), counts, { sectorTotals });
    perArea.set(area, { postcodes: kept });
    log(`  ${area}: ${kept} live postcodes`);
  }
  const oaSet = new Set(counts.keys());
  log(`  ${oaSet.size} Output Areas hold those postcodes. Now counting their other postcodes...`);
  for (const entry of areaEntries) {
    if (TARGET_AREAS.includes(entryArea(entry.name))) continue;
    countPostcodes(onspd.read(entry), counts, { onlyOas: oaSet });
  }

  log("Reading Census 2021 households (TS041)...");
  const tsBuf = readFileSync(args.ts041);
  const ts = readZip(tsBuf);
  const tsEntry = ts.entries.find((e) => /-oa\.csv$/i.test(e.name));
  if (!tsEntry) {
    throw new SourceError(`No Output Area file (ending -oa.csv) in the TS041 zip. It holds: ${ts.entries.map((e) => e.name).join(", ")}`);
  }
  const households = readHouseholds(ts.read(tsEntry), oaSet);
  const noHouseholds = [...oaSet].filter((c) => !households.has(c));
  if (noHouseholds.length > 0) {
    warnings.push(`${noHouseholds.length} Output Areas had no household figure and count as 0: ${noHouseholds.slice(0, 20).join(", ")}`);
  }

  log(`Fetching ${oaSet.size} Output Area boundaries from ONS (a few minutes)...`);
  const codes = [...oaSet].sort();
  const { geometries, mode } = await fetchBoundaries(args.oaService, codes, log);
  const noGeometry = codes.filter((c) => !geometries.has(c));
  if (noGeometry.length > 0) {
    warnings.push(`${noGeometry.length} Output Areas came back with no boundary: ${noGeometry.slice(0, 20).join(", ")}`);
  }

  const oas = codes
    .filter((c) => geometries.has(c))
    .map((code) => ({ code, households: households.get(code) ?? 0, geometry: geometries.get(code) }));
  const postcodeCounts = [];
  for (const [oa, bySector] of [...counts].sort((a, b) => a[0].localeCompare(b[0]))) {
    for (const [sector, n] of [...bySector].sort((a, b) => a[0].localeCompare(b[0]))) postcodeCounts.push([oa, sector, n]);
  }

  const source = {
    format: "fdh-area-planner-source",
    version: 1,
    builtAt: new Date().toISOString(),
    areas: TARGET_AREAS,
    inputs: {
      onspd: {
        file: basename(args.onspd),
        bytes: statSync(args.onspd).size,
        sha256: sha256(onspdBuf),
        entries: areaEntries.map((e) => e.name),
      },
      ts041: { file: basename(args.ts041), bytes: statSync(args.ts041).size, sha256: sha256(tsBuf), entry: tsEntry.name },
      oaService: { url: args.oaService, fetchedAt: new Date().toISOString(), features: oas.length, format: mode },
    },
    oas,
    postcodeCounts,
    sectorTotals: Object.fromEntries([...sectorTotals].sort((a, b) => a[0].localeCompare(b[0]))),
  };

  const outPath = resolve(args.out);
  const gz = gzipSync(Buffer.from(JSON.stringify(source)));
  writeFileSync(outPath, gz);

  // The report: what was read, per postcode area.
  const lines = [
    "Area Planner source build",
    `Built: ${source.builtAt}`,
    `Took: ${Math.round((Date.now() - started) / 1000)} seconds`,
    "",
    `ONS Postcode Directory: ${source.inputs.onspd.file} (${source.inputs.onspd.bytes} bytes)`,
    `  sha256 ${source.inputs.onspd.sha256}`,
    `  ${areaEntries.length} area files, for example ${targets[0].name}`,
    `Census 2021 TS041: ${source.inputs.ts041.file} (${source.inputs.ts041.bytes} bytes), entry ${tsEntry.name}`,
    `  sha256 ${source.inputs.ts041.sha256}`,
    `Output Area boundaries: ${args.oaService} (${mode}), ${oas.length} of ${codes.length} found`,
    "",
    "Per postcode area (an Output Area on a border counts in both):",
  ];
  for (const area of TARGET_AREAS) {
    const areaOas = new Set();
    for (const [oa, bySector] of counts) {
      if ([...bySector.keys()].some((s) => areaOf(s) === area && (sectorTotals.get(s) ?? 0) > 0)) areaOas.add(oa);
    }
    const hh = [...areaOas].reduce((sum, oa) => sum + (households.get(oa) ?? 0), 0);
    const sectors = [...sectorTotals.keys()].filter((s) => areaOf(s) === area).length;
    lines.push(`  ${area}: ${perArea.get(area)?.postcodes ?? 0} live postcodes, ${sectors} sectors, ${areaOas.size} Output Areas, ${hh} households`);
  }
  const allHouseholds = oas.reduce((sum, o) => sum + o.households, 0);
  lines.push(`  Total: ${oas.length} Output Areas, ${allHouseholds} households`);
  lines.push("", warnings.length > 0 ? "Warnings:" : "No warnings.", ...warnings.map((w) => `  ${w}`));
  lines.push("", `Output: ${basename(outPath)} (${gz.length} bytes)`);
  const reportPath = join(dirname(outPath), basename(outPath).replace(/\.json\.gz$/, "") + "-report.txt");
  writeFileSync(reportPath, lines.join("\n") + "\n");

  log("");
  log(lines.slice(lines.indexOf("Per postcode area (an Output Area on a border counts in both):")).join("\n"));
  log("");
  log("Done. Send back these two files:");
  log(`  ${outPath}`);
  log(`  ${reportPath}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((err) => {
    console.error("");
    console.error(err instanceof SourceError ? err.message : err?.stack ?? String(err));
    console.error("");
    console.error("Nothing was written. If this keeps happening, send the message above to Claude.");
    process.exit(1);
  });
}
