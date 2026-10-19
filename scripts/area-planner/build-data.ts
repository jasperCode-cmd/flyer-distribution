// Builds the Area Planner's data files from the source file made on a laptop
// by build-area-planner-source.mjs (see scripts/area-planner/build-lib.ts for
// what is built and how).
//
//   npx tsx scripts/area-planner/build-data.ts --source area-planner-source.json.gz [--out data/area-planner]
//
// Writes only into the output folder, replacing a previous build there.

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { BuildError, buildData, writeData } from "./build-lib";

function parseArgs(argv: string[]): { source: string; out: string } {
  let source: string | null = null;
  let out = "data/area-planner";
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--source" && argv[i + 1]) source = argv[++i];
    else if (a === "--out" && argv[i + 1]) out = argv[++i];
    else throw new BuildError(`Unknown or incomplete option: ${a}`);
  }
  if (!source) throw new BuildError("Usage: npx tsx scripts/area-planner/build-data.ts --source <file.json.gz> [--out <dir>]");
  return { source, out };
}

const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`;

async function main() {
  const started = Date.now();
  const args = parseArgs(process.argv.slice(2));
  const raw = await readFile(resolve(args.source));
  let parsed: unknown;
  try {
    parsed = JSON.parse((raw[0] === 0x1f && raw[1] === 0x8b ? gunzipSync(raw) : raw).toString("utf8"));
  } catch {
    throw new BuildError(`${args.source} is not a gzip JSON source file.`);
  }
  const result = buildData(parsed);
  const out = resolve(args.out);
  await writeData(result, out);

  const sizes = result.files.map((f) => ({ path: f.path, bytes: f.data.length }));
  const total = sizes.reduce((sum, s) => sum + s.bytes, 0);
  const largest = [...sizes].sort((a, b) => b.bytes - a.bytes)[0];
  const group = (prefix: string) => sizes.filter((s) => s.path.startsWith(prefix));
  const { counts } = result.manifest;
  console.log(`Wrote ${sizes.length} files to ${out} in ${Math.round((Date.now() - started) / 1000)}s`);
  for (const s of sizes.filter((s) => !s.path.includes("/"))) console.log(`  ${s.path.padEnd(22)} ${kb(s.bytes)}`);
  for (const prefix of ["oa/", "postcodes/"]) {
    const g = group(prefix);
    console.log(`  ${(prefix + "*").padEnd(22)} ${g.length} files, ${kb(g.reduce((n, s) => n + s.bytes, 0))}`);
  }
  console.log(`  total                  ${kb(total)}; largest ${largest.path} (${kb(largest.bytes)})`);
  console.log(
    `Output Areas ${counts.outputAreas} (${counts.outputAreasInSectors} in sectors), sectors ${counts.sectors} ` +
      `(${counts.unmappableSectors} too small to map), districts ${counts.districts}, households ${counts.households}`
  );
}

main().catch((err) => {
  console.error(err instanceof BuildError ? err.message : err);
  process.exit(1);
});
