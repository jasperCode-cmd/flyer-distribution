import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { CRM_NAV_GROUPS } from "@/lib/crm-nav";
import { OS_ATTRIBUTION } from "@/lib/rounds/attribution";
import { screenshotStorage, type BlobClient } from "@/lib/rounds/storage";
import { NOT_SPECIFIED, NOT_SPECIFIED_COLOUR, dateLabel, distributorColour, distributorName, formatDistance } from "@/lib/rounds/format";
import {
  MAX_SCREENSHOTS,
  NOT_SPECIFIED_FILTER,
  parseFilters,
  validateNewLink,
  validateNewRound,
  validateNewScreenshots,
  validateScreenshotWork,
  validateTrim,
} from "@/lib/rounds/validate";

// How the Rounds feature is put together, checked on the source and without
// a database: where it appears in the CRM, that rounds are only read when a
// page or the layer is open (never polled), that no image is ever kept in
// the database, that file storage stays off without its token, and what the
// API accepts.

const read = (f: string) => readFileSync(f, "utf8");
const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [join(dir, e.name)] : []));

test("Rounds sits under Jobs, after the Area Planner", () => {
  const jobs = CRM_NAV_GROUPS.find((g) => g.label === "Jobs")!;
  const hrefs = jobs.items.map((i) => i.href);
  assert.equal(hrefs[hrefs.indexOf("/admin/crm/map") + 1], "/admin/crm/rounds");
});

test("rounds are read only when a page or the layer is open, never polled", () => {
  // The code, without its comments.
  const sources = [...files("components/rounds"), "components/area-planner/RoundsLayerControls.tsx"]
    .map((f) => read(f).replace(/^\s*\/\/.*$/gm, ""))
    .join("\n");
  assert.doesNotMatch(sources, /setInterval|refreshInterval|useStatusPoll|poll\(/i);
  const layer = read("components/area-planner/RoundsLayerControls.tsx");
  assert.match(layer, /const \[on, setOn\] = useState\(false\);/, "the layer starts off");
  assert.match(layer, /if \(!on\) \{\s+onRounds\(null\);/);
  // The lead page reads its rounds alongside the lead, in the same Promise.all.
  assert.match(read("app/admin/crm/leads/[id]/page.tsx"), /Promise\.all\(\[[\s\S]*leadRounds\(prisma, id\),\s+\]\)/);
});

test("no image is ever kept in the database: a screenshot has a file URL at most", () => {
  const schema = read("prisma/schema.prisma");
  const model = schema.slice(schema.indexOf("model RoundScreenshot {"), schema.indexOf("}", schema.indexOf("model RoundScreenshot {")));
  assert.doesNotMatch(model, /\bBytes\b/);
  assert.match(model, /blobUrl\s+String\?/);
  const sql = readdirSync("prisma/migrations").filter((d) => d.endsWith("_add_rounds")).map((d) => read(`prisma/migrations/${d}/migration.sql`)).join("");
  assert.doesNotMatch(sql, /BYTEA/i);
});

test("screenshots show as not stored, and can be attached once storage is on", () => {
  const page = read("components/rounds/RoundPage.tsx");
  assert.match(page, /Screenshot not stored/);
  assert.match(page, /Attach screenshot/);
  assert.match(page, /options\?\.storage \?/);
});

test("file storage: off without BLOB_READ_WRITE_TOKEN; on with it, private, through the client it is given", async () => {
  assert.deepEqual(screenshotStorage({}), { enabled: false });
  assert.deepEqual(screenshotStorage({ BLOB_READ_WRITE_TOKEN: "   " }), { enabled: false });
  const calls: string[] = [];
  const client: BlobClient = {
    async put(pathname, _body, o) {
      calls.push(`put ${pathname} ${o.access} ${o.contentType} ${o.addRandomSuffix}`);
      return { url: `https://store.example/${pathname}`, pathname };
    },
    async get(url, o) {
      calls.push(`get ${url} ${o.access}`);
      return null;
    },
    async del(url) {
      calls.push(`del ${url}`);
    },
  };
  const storage = screenshotStorage({ BLOB_READ_WRITE_TOKEN: "test-token" }, client);
  assert.equal(storage.enabled, true);
  if (!storage.enabled) return;
  const stored = await storage.put("rounds/r/s.webp", Buffer.from("abc"), "image/webp");
  assert.deepEqual(stored, { url: "https://store.example/rounds/r/s.webp", pathname: "rounds/r/s.webp", contentType: "image/webp", bytes: 3 });
  assert.equal(await storage.get(stored.url), null);
  await storage.del(stored.url);
  assert.deepEqual(calls, ["put rounds/r/s.webp private image/webp true", "get https://store.example/rounds/r/s.webp private", "del https://store.example/rounds/r/s.webp"]);
  // The token is never in anything a route sends back.
  assert.ok(!JSON.stringify(stored).includes("test-token"));
});

test("the API's checks: a round, a screenshot's work, a client link, the trim, the filters", () => {
  const shot = { width: 740, height: 1600, sha256: "a".repeat(64), originalName: "IMG.PNG", takenAt: "2026-11-10T14:32:05Z" };
  assert.ok(validateNewRound({ business: "FDH", date: "2026-11-10", screenshots: [shot] }).ok);
  assert.ok(!validateNewRound({ business: "XYZ", date: "2026-11-10", screenshots: [shot] }).ok);
  assert.ok(!validateNewRound({ business: "FDH", date: "2026-02-30", screenshots: [shot] }).ok);
  assert.ok(!validateNewRound({ business: "FDH", date: "2026-11-10", screenshots: [] }).ok);
  assert.ok(!validateNewRound({ business: "FDH", date: "2026-11-10", screenshots: [{ ...shot, width: 0 }] }).ok);
  const size = { width: 740, height: 1600 };
  assert.ok(validateScreenshotWork({ crop: { top: 166, bottom: 1504, left: 0, right: 740 } }, size).ok);
  assert.ok(!validateScreenshotWork({ crop: { top: 0, bottom: 1700, left: 0, right: 740 } }, size).ok, "crop off the image");
  assert.ok(!validateScreenshotWork({ route: [[[-1.79, 50.85]]] }, size).ok, "a line needs two points");
  assert.ok(!validateScreenshotWork({ route: [[[10, 50], [10.1, 50.1]]] }, size).ok, "outside Great Britain");
  assert.ok(validateScreenshotWork({ route: null, markers: null }, size).ok);
  assert.ok(!validateScreenshotWork({ pairs: [{ image: [10, 10], map: [-1.79, 50.85] }] }, size).ok, "two pairs needed");
  assert.ok(validateNewLink({ leadId: "clead00000001" }, "2026-11-13").ok);
  assert.ok(!validateNewLink({ leadId: "clead00000001", roundId: "cround0000001" }, "2026-11-13").ok, "both");
  assert.ok(!validateNewLink({}, "2026-11-13").ok, "neither");
  assert.ok(!validateNewLink({ leadId: "clead00000001", expiresOn: "2026-11-12" }, "2026-11-13").ok, "already expired");
  assert.ok(validateNewLink({ roundId: "cround0000001", expiresOn: "2026-11-13" }, "2026-11-13").ok, "expires today");
  assert.ok(validateTrim({ trimM: 150 }).ok);
  assert.ok(!validateTrim({ trimM: -1 }).ok);
  assert.ok(!validateTrim({ trimM: 1.5 }).ok);
  assert.deepEqual(parseFilters(new URLSearchParams("from=2026-11-01&to=nope&business=LDB&leadId=clead00000001&distributorId=../x")), {
    from: "2026-11-01",
    business: "LDB",
    leadId: "clead00000001",
  });
  // "Not specified": rounds with no distributor.
  assert.deepEqual(parseFilters(new URLSearchParams(`distributorId=${NOT_SPECIFIED_FILTER}`)), { distributorId: null });
  assert.deepEqual(parseFilters(new URLSearchParams("distributorId=cdist00000001")), { distributorId: "cdist00000001" });
});

test("up to 100 screenshots in a round and in one upload, the same limit everywhere", () => {
  assert.equal(MAX_SCREENSHOTS, 100);
  const many = (n: number) => Array.from({ length: n }, (_, i) => ({ width: 738, height: 1600, sha256: i.toString(16).padStart(64, "0"), originalName: `IMG_${i}.PNG`, takenAt: null }));
  assert.ok(validateNewRound({ business: "FDH", date: "2026-11-10", screenshots: many(100) }).ok);
  assert.ok(!validateNewRound({ business: "FDH", date: "2026-11-10", screenshots: many(101) }).ok);
  assert.ok(validateNewScreenshots({ screenshots: many(100) }).ok);
  assert.ok(!validateNewScreenshots({ screenshots: many(101) }).ok);
  // No other limit left behind: the pages and the service use the shared one.
  for (const f of ["components/rounds/NewRound.tsx", "components/rounds/RoundPage.tsx", "lib/rounds/service.ts", "lib/rounds/validate.ts"]) {
    assert.doesNotMatch(read(f).replace(/^\s*\/\/.*$/gm, ""), /\b12\b/, f);
  }
  assert.match(read("components/rounds/NewRound.tsx"), /MAX_SCREENSHOTS/);
  assert.match(read("components/rounds/RoundPage.tsx"), /MAX_SCREENSHOTS/);
  assert.match(read("lib/rounds/service.ts"), /MAX_SCREENSHOTS/);
});

test("picked screenshots are read one at a time and only the one in hand at full size; records are made in one request", () => {
  const helper = read("lib/rounds/working-image.ts");
  // One after another, never all at once.
  const readAll = helper.slice(helper.indexOf("export async function readAllFacts"), helper.indexOf("export async function makeWorkingImage"));
  assert.match(readAll, /for \(const \[i, file\] of files\.entries\(\)\) \{[\s\S]*await readFileFacts\(file\)/);
  assert.doesNotMatch(readAll, /Promise\.all/);
  assert.match(helper, /bitmap\.close\(\)/);
  for (const f of ["components/rounds/NewRound.tsx", "components/rounds/RoundPage.tsx"]) {
    const page = read(f);
    assert.match(page, /readAllFacts\(/, f);
    // Picking files never makes full working copies.
    assert.doesNotMatch(page.slice(page.indexOf("async function " + (f.includes("New") ? "pick" : "choose"))), /^\s*for [\s\S]{0,200}makeWorkingImage/m, f);
  }
  const queue = read("components/rounds/ScreenshotQueue.tsx");
  assert.match(queue, /makeWorkingImage\(source\)/);
  assert.match(queue, /URL\.revokeObjectURL/);
  // The upload page sends every screenshot's details in its one request,
  // and the round page adds new ones in one request too.
  assert.match(read("components/rounds/NewRound.tsx"), /screenshots: picked\.map\(/);
  assert.match(read("components/rounds/RoundPage.tsx"), /screenshots: plan\.fresh\.map\(/);
  const service = read("lib/rounds/service.ts");
  assert.match(service, /screenshots: \{ createMany:/);
  assert.match(service, /tx\.roundScreenshot\.createMany\(/);
  assert.doesNotMatch(service, /roundScreenshot\.create\(/);
});

test("distributor: Not specified by default, saved as none, shown and filtered as Not specified, grey on the map", () => {
  assert.equal(distributorName(null), NOT_SPECIFIED);
  assert.equal(distributorName({ name: "Dan" }), "Dan");
  assert.equal(distributorColour(null), NOT_SPECIFIED_COLOUR);
  assert.equal(NOT_SPECIFIED_COLOUR, "#8A8F98");
  assert.equal(distributorColour({ colour: "#2A78D6" }), "#2A78D6");
  for (const f of ["components/rounds/NewRound.tsx", "components/rounds/RoundPage.tsx"]) {
    const page = read(f);
    assert.match(page, /<option value="">\{NOT_SPECIFIED\}<\/option>/, f);
    assert.match(page, /distributorId: (form\.)?distributorId \|\| null/, f);
  }
  assert.match(read("components/rounds/NewRound.tsx"), /const \[distributorId, setDistributorId\] = useState\(""\);/);
  for (const f of ["components/rounds/RoundsView.tsx", "components/area-planner/RoundsLayerControls.tsx"]) {
    assert.match(read(f), /<option value=\{NOT_SPECIFIED_FILTER\}>\{NOT_SPECIFIED\}<\/option>/, f);
  }
  const shown = [...files("components/rounds"), "components/area-planner/PlannerMap.tsx"].map(read).join("\n");
  assert.doesNotMatch(shown, /No distributor"|>Not set</);
  assert.match(read("components/area-planner/PlannerMap.tsx"), /distributorColour\(round\.distributor\)/);
});

test("how figures read", () => {
  assert.equal(formatDistance(850), "850 m");
  assert.equal(formatDistance(4250), "4.3 km");
  assert.equal(formatDistance(null), "Not traced yet");
  assert.equal(dateLabel(new Date("2026-11-10T00:00:00Z")), "Tuesday 10 November 2026");
});

test("auto line-up: one screenshot read at a time in a background worker, drafts kept in the browser until accepted together", () => {
  const worker = read("components/rounds/auto.worker.ts");
  // One file decoded per message, the bitmap closed, only compact copies kept.
  assert.match(worker, /const \{ img, canvas \} = await decode\(msg\.file\)/);
  assert.match(worker, /bitmap\.close\(\)/);
  assert.match(worker, /packed: pack\(prepared\.gray\)/);
  assert.doesNotMatch(worker, /Promise\.all/);
  const run = read("components/rounds/auto-process.ts");
  assert.match(run, /new Worker\(new URL\("\.\/auto\.worker\.ts", import\.meta\.url\)/);
  assert.match(run, /while \(todo\.length && !this\.stopped\)/);
  assert.doesNotMatch(run, /Promise\.all/);
  // Drafts: IndexedDB only, never sent anywhere.
  const drafts = read("components/rounds/drafts.ts");
  assert.match(drafts, /indexedDB\.open\(DB_NAME, 2\)/);
  assert.doesNotMatch(drafts, /fetch\(|\/api\//);
  // Accepting saves them together, in one request.
  const queue = read("components/rounds/ScreenshotQueue.tsx");
  assert.match(queue, /api<\{ shots: RoundScreenshotView\[\] \}>\(`\/api\/crm\/rounds\/\$\{roundId\}\/screenshots`, send\("PATCH", \{ items \}\)\)/);
  assert.match(queue, /Auto-process the rest/);
  const grid = read("components/rounds/ReviewGrid.tsx");
  for (const label of ["Accept all", "Open to fix", "Skip", "% sure"]) assert.match(grid, new RegExp(label), label);
  // The manual line-up is still there as it was: crop, line up, trace, with Skip and Save and next.
  const workspace = read("components/rounds/ScreenshotWorkspace.tsx");
  for (const step of ["1. Crop", "2. Line up", "3. Trace", "Redo A", "Redo B", "Eraser", "Save and next"]) assert.match(workspace + queue, new RegExp(step), step);
  // The upload page's tip.
  assert.match(read("components/rounds/NewRound.tsx"), /For quicker auto line-up, keep the same zoom, overlap each screenshot by about half a screen, and tap the compass so north is up\./);
});

test("Locate: one screenshot a request inside the time limit, the key on the server only, nothing logged but a status, OS data traced and credited", () => {
  const route = read("app/api/crm/rounds/screenshots/[sid]/locate/route.ts");
  assert.match(route, /export const maxDuration = 60;/);
  assert.match(route, /locateConfigured\(\)/);
  assert.match(route, /Locate isn't set up yet\./);
  assert.doesNotMatch(route, /console\./);
  const reader = read("lib/rounds/locate/read-labels.ts");
  assert.match(reader, /import "server-only";/);
  assert.match(reader, /maxRetries: 0/);
  assert.match(reader, /fallbacks: "default"/);
  // Only the status is logged: never the screenshot, the answer or the key.
  const logs = reader.match(/console\.\w+\([^;]*\);/g) ?? [];
  assert.deepEqual(logs, ["console.warn(`Rounds: Locate's call to Claude failed (${f.status})`);"]);
  assert.match(read("lib/rounds/locate/pricing.ts"), /LOCATE_MODEL = "claude-opus-5-5"/);
  // The key is never sent to the browser: no client code mentions it.
  for (const f of [...files("components"), ...files("app").filter((f) => !f.startsWith(join("app", "api")))]) assert.doesNotMatch(read(f), /ANTHROPIC_API_KEY/, f);
  assert.match(read("app/api/crm/rounds/options/route.ts"), /roundOptions\(prisma, storageEnabled\(\), locateConfigured\(\)\)/);
  // The bundled OS Open Roads data ships with the Locate route; the postcode shapes with every Rounds route.
  const config = read("next.config.ts");
  assert.match(config, /"\/api\/crm\/rounds\/screenshots\/\*\*\/locate": \["\.\/data\/os-roads\/\*\*\/\*"\]/);
  assert.match(config, /"\/api\/crm\/rounds\/\*\*\/\*": \["\.\/data\/area-planner\/\*\*\/\*"\]/);
  // OS's credit beside OpenStreetMap's wherever rounds' routes are shown, as the manifest words it.
  const manifest = JSON.parse(read("data/os-roads/manifest.json"));
  assert.equal(OS_ATTRIBUTION, manifest.attribution);
  for (const f of ["components/rounds/AlignMap.tsx", "components/rounds/RoundMap.tsx", "components/route-report/ReportMap.tsx", "components/area-planner/PlannerMap.tsx", "components/route-report/RouteReportView.tsx"]) assert.match(read(f), /OS_ATTRIBUTION/, f);
  for (const f of ["components/rounds/ReviewGrid.tsx", "components/rounds/LeadRounds.tsx"]) assert.match(read(f), /ROUNDS_MAP_CREDIT/, f);
  // The queue: the button, the running cost, and the not-set-up note; everything else as it was.
  const queue = read("components/rounds/ScreenshotQueue.tsx");
  for (const text of ["Locate and trace all", "Running cost", "Locate isn&apos;t set up yet.", "Auto-process the rest", "Review automatic line-ups"]) assert.match(queue, new RegExp(text), text);
  // One screenshot per request, a few at a time; a busy API pauses the rest, it doesn't stop them.
  const runner = read("components/rounds/locate-process.ts");
  assert.match(runner, /export const LOCATE_AT_ONCE = 3;/);
  assert.match(runner, /pauseUntil/);
  assert.match(runner, /fetch\(`\/api\/crm\/rounds\/screenshots\/\$\{item\.id\}\/locate`/);
});

test("Locate's checks: what the browser sends with a screenshot, and the line-up's source and cost record", async () => {
  const { validateLocateMeta } = await import("@/lib/rounds/validate");
  const size = { width: 738, height: 1600 };
  assert.deepEqual(validateLocateMeta({ compassTurn: -8.5, route: [[10, 20], [30, 40]] }, size), { ok: true, value: { compassTurn: -8.5, route: [[10, 20], [30, 40]] } });
  assert.deepEqual(validateLocateMeta({ route: [] }, size), { ok: true, value: { compassTurn: null, route: [] } });
  assert.equal(validateLocateMeta({ compassTurn: 60, route: [] }, size).ok, false);
  assert.equal(validateLocateMeta({ route: [[900, 10]] }, size).ok, false);
  assert.equal(validateLocateMeta({ route: Array.from({ length: 4001 }, () => [1, 1]) }, size).ok, false);
  const pairs = [
    { image: [100, 300], map: [-1.38, 50.91] },
    { image: [600, 1300], map: [-1.37, 50.9] },
  ];
  const located = validateScreenshotWork({ pairs, source: { kind: "located", confidence: 0.83, names: 18 }, locate: { costUsd: 0.0312, seconds: 12.4, model: "claude-opus-5-5", placed: true, names: 18 } }, size);
  assert.ok(located.ok && located.value.source?.kind === "located" && located.value.locate?.costUsd === 0.0312);
  assert.equal(validateScreenshotWork({ pairs, locate: { costUsd: -1, seconds: 1, model: "x", placed: true, names: 1 } }, size).ok, false);
  assert.equal(validateScreenshotWork({ pairs, locate: { costUsd: 0.1, seconds: 1, model: "<script>", placed: true, names: 1 } }, size).ok, false);
  assert.equal(validateScreenshotWork({ pairs, source: { kind: "located", confidence: 2, names: 1 } }, size).ok, false);
});

test("no em or en dashes in any Rounds file", () => {
  const all = [
    ...files("lib/rounds"),
    ...files("components/rounds"),
    ...files("components/route-report"),
    ...files("app/admin/crm/rounds"),
    ...files("app/api/crm/rounds"),
    ...files("app/api/crm/route-reports"),
    ...files("app/route-report"),
    "components/area-planner/RoundsLayerControls.tsx",
    "lib/__tests__/rounds-queue.test.ts",
    "lib/__tests__/rounds-db-lock.ts",
    "lib/__tests__/rounds-match.test.ts",
    "lib/__tests__/rounds-auto.test.ts",
    "lib/__tests__/rounds-locate.test.ts",
    "lib/__tests__/rounds-locate-api.test.ts",
    "lib/__tests__/rounds-locate.db.test.ts",
    "lib/__tests__/rounds-locate-mock.ts",
    "lib/__tests__/rounds-wiring.test.ts",
    "components/area-planner/PlannerMap.tsx",
    "components/crm/LeadDetail.tsx",
    "scripts/os-roads/refresh.py",
    "data/os-roads/README.md",
    "next.config.ts",
  ];
  for (const f of all) assert.doesNotMatch(read(f), /[\u2013\u2014]/, f);
});
