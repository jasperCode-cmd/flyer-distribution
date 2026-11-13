import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { CRM_NAV_GROUPS } from "@/lib/crm-nav";
import { screenshotStorage, type BlobClient } from "@/lib/rounds/storage";
import { dateLabel, formatDistance } from "@/lib/rounds/format";
import { parseFilters, validateNewLink, validateNewRound, validateScreenshotWork, validateTrim } from "@/lib/rounds/validate";

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
});

test("how figures read", () => {
  assert.equal(formatDistance(850), "850 m");
  assert.equal(formatDistance(4250), "4.3 km");
  assert.equal(formatDistance(null), "Not traced yet");
  assert.equal(dateLabel(new Date("2026-11-10T00:00:00Z")), "Tuesday 10 November 2026");
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
  ];
  for (const f of all) assert.doesNotMatch(read(f), /[\u2013\u2014]/, f);
});
