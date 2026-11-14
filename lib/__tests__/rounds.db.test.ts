import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import sharp from "sharp";
import { PrismaClient } from "@/generated/prisma/client";
import { holdRoundsLock } from "./rounds-db-lock";
import { imageToLngLat, toMercator, type PointPair, type Transform } from "@/lib/rounds/alignment";
import { localPlane, linesLengthM, type LngLat, type Lines } from "@/lib/rounds/geometry";
import {
  RoundsError,
  addScreenshots,
  attachScreenshotFile,
  clientTrimM,
  createRound,
  deleteRound,
  deleteScreenshot,
  getRound,
  leadRounds,
  listRounds,
  mapRounds,
  openScreenshotFile,
  roundOptions,
  saveScreenshotWork,
  saveScreenshotsWork,
  setClientTrimM,
  updateRound,
  TRIM_SETTING,
} from "@/lib/rounds/service";
import { screenshotStorage, type BlobClient } from "@/lib/rounds/storage";
import type { NewScreenshot } from "@/lib/rounds/validate";

// Rounds against a real database, but only a throwaway local one: it needs
// CRM_TEST_DATABASE_URL pointing at localhost and is skipped otherwise, so
// it can never touch the production database. File storage is a stand-in
// kept in memory (the real Vercel Blob is never called). Cleans up after
// itself.

const url = process.env.CRM_TEST_DATABASE_URL ?? "";
let host = "";
try {
  host = url ? new URL(url).hostname : "";
} catch {
  host = "";
}
const skip = !["localhost", "127.0.0.1", "::1", "[::1]"].includes(host) ? "set CRM_TEST_DATABASE_URL to a local throwaway database to run" : false;

const DOMAIN = "@rounds-test.example";
const MARK = "rounds-test";
let prisma: PrismaClient;
let queries = 0;

// Ringwood (BH24), and a point so many metres east and north of it.
const RINGWOOD: LngLat = [-1.7917, 50.8461];
const plane = localPlane(RINGWOOD[1]);
const at = (east: number, north: number): LngLat => {
  const [x, y] = plane.to(RINGWOOD);
  return plane.from([x + east, y + north]);
};

async function cleanUp() {
  const leads = (await prisma.lead.findMany({ where: { email: { endsWith: DOMAIN } }, select: { id: true } })).map((l) => l.id);
  await prisma.round.deleteMany({ where: { OR: [{ leadId: { in: leads } }, { notes: { startsWith: MARK } }] } });
  await prisma.areaProject.deleteMany({ where: { name: { startsWith: MARK } } });
  await prisma.lead.deleteMany({ where: { id: { in: leads } } });
  await prisma.distributor.deleteMany({ where: { name: { startsWith: MARK } } });
  await prisma.appSetting.deleteMany({ where: { key: TRIM_SETTING } });
}

let release: (() => Promise<void>) | null = null;

before(async () => {
  if (skip) return;
  // One Rounds database test file at a time (they share the trim setting).
  release = await holdRoundsLock(url);
  prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }), log: [{ emit: "event", level: "query" }] });
  (prisma as unknown as { $on(e: "query", cb: () => void): void }).$on("query", () => queries++);
  await cleanUp();
});

after(async () => {
  if (skip) return;
  await cleanUp();
  await prisma.$disconnect();
  await release?.();
});

const lead = (name: string, business: "FDH" | "LDB" = "FDH", extra: object = {}) =>
  prisma.lead.create({ data: { name, email: `${name.toLowerCase().replace(/\s+/g, ".")}${DOMAIN}`, business, stage: "WON", ...extra }, select: { id: true } });
const distributor = (name: string) => prisma.distributor.create({ data: { name: `${MARK} ${name}` }, select: { id: true } });
const shot = (w = 740, h = 1600, sha: string | null = null): NewScreenshot => ({ width: w, height: h, sha256: sha, originalName: "IMG_0001.PNG", takenAt: "2026-11-10T14:32:05.000Z" });

// A north-up screenshot of Ringwood at about a metre a pixel, and two pairs of points on it.
const TRANSFORM: Transform = (() => {
  const [x, y] = toMercator(RINGWOOD);
  const scale = 1 / Math.cos((RINGWOOD[1] * Math.PI) / 180);
  return { scale, rotationDeg: 0, offsetX: x - 370 * scale, offsetY: y - 800 * scale };
})();
const PAIRS: PointPair[] = [
  { image: [100, 300], map: imageToLngLat(TRANSFORM, [100, 300]) },
  { image: [620, 1400], map: imageToLngLat(TRANSFORM, [620, 1400]) },
];
const ROUTE: Lines = [[at(0, 0), at(0, 300), at(250, 300), at(250, 0)]];

// File storage in memory.
function fakeBlob() {
  const files = new Map<string, { body: Buffer; contentType: string }>();
  const deleted: string[] = [];
  const client: BlobClient = {
    async put(pathname, body, options) {
      assert.equal(options.access, "private");
      assert.equal(options.token, "test-token");
      const url = `https://store.example/${pathname}`;
      files.set(url, { body: body as Buffer, contentType: options.contentType });
      return { url, pathname };
    },
    async get(url) {
      const f = files.get(url);
      if (!f) return null;
      return { stream: new Blob([new Uint8Array(f.body)]).stream(), contentType: f.contentType, size: f.body.length };
    },
    async del(url) {
      deleted.push(url);
      files.delete(url);
    },
  };
  return { client, files, deleted, storage: screenshotStorage({ BLOB_READ_WRITE_TOKEN: "test-token" }, client) };
}

test("a round is made with its screenshots' details only, takes its lead's business, and gives its distributor a map colour", { skip }, async () => {
  const l = await lead("Rita Round", "LDB");
  const d = await distributor("Dana");
  const made = await createRound(prisma, {
    business: "FDH",
    leadId: l.id,
    projectId: null,
    distributorId: d.id,
    date: "2026-11-10",
    notes: `${MARK} first`,
    screenshots: [shot(), shot(740, 1500)],
  });
  assert.equal(made.screenshotIds.length, 2);
  const round = await prisma.round.findUniqueOrThrow({ where: { id: made.id }, include: { screenshots: { orderBy: { position: "asc" } } } });
  assert.equal(round.business, "LDB", "the lead's business");
  assert.equal(round.date.toISOString(), "2026-11-10T00:00:00.000Z");
  assert.deepEqual(round.screenshots.map((s) => [s.position, s.width, s.height, s.blobUrl, s.contentType, s.bytes]), [
    [0, 740, 1600, null, null, null],
    [1, 740, 1500, null, null, null],
  ]);
  assert.equal(round.screenshots[0].takenAt?.toISOString(), "2026-11-10T14:32:05.000Z");
  const colour = (await prisma.distributor.findUniqueOrThrow({ where: { id: d.id } })).mapColour;
  assert.match(colour ?? "", /^#[0-9A-F]{6}$/i);
});

test("saving a screenshot's work: the alignment is worked out again from the points, the route stored, and the round's distance and sectors worked out", { skip }, async () => {
  const l = await lead("Sam Sectors");
  const made = await createRound(prisma, { business: "FDH", leadId: l.id, projectId: null, distributorId: null, date: "2026-11-11", notes: `${MARK} work`, screenshots: [shot(), shot()] });
  const [first, second] = made.screenshotIds;
  // A bad fit is refused.
  await assert.rejects(
    saveScreenshotWork(prisma, first, { pairs: [PAIRS[0], { image: [130, 320], map: PAIRS[1].map }] }),
    (e: unknown) => e instanceof RoundsError && /too close/.test(e.message)
  );
  const saved = await saveScreenshotWork(prisma, first, {
    crop: { top: 166, bottom: 1504, left: 0, right: 740 },
    pairs: PAIRS,
    route: ROUTE,
    markers: { start: at(0, 0), end: at(250, 0) },
  });
  assert.equal(saved.alignment?.rotated, false);
  assert.ok(saved.alignment!.errorsPx.every((e) => e < 0.01));
  // 300 m north, 250 m east, 300 m south.
  assert.ok(Math.abs((saved.routeLengthM ?? 0) - 850) < 2, `${saved.routeLengthM}`);
  assert.deepEqual(saved.crop, { top: 166, bottom: 1504, left: 0, right: 740 });

  let round = (await getRound(prisma, made.id))!;
  assert.ok(Math.abs((round.distanceM ?? 0) - 850) < 2);
  assert.ok(round.sectors.length >= 1 && round.sectors.every((s) => s.code.startsWith("BH24 ")), JSON.stringify(round.sectors));
  assert.ok(Math.abs(round.sectors.reduce((s, x) => s + x.metres, 0) - 850) < 40);
  assert.deepEqual(round.screenshots, { total: 2, traced: 1, stored: 0 });

  // A second screenshot showing the last stretch again and 300 m more adds
  // only the new part (less the few metres where the two meet).
  await saveScreenshotWork(prisma, second, { pairs: PAIRS, route: [[at(250, 300), at(250, 0), at(250, -300)]] });
  round = (await getRound(prisma, made.id))!;
  assert.ok((round.distanceM ?? 0) > 1130 && (round.distanceM ?? 0) <= 1150, `${round.distanceM}`);

  // Clearing it again takes it back out.
  await saveScreenshotWork(prisma, second, { route: null });
  round = (await getRound(prisma, made.id))!;
  assert.ok(Math.abs((round.distanceM ?? 0) - 850) < 2);
  assert.deepEqual(round.screenshots, { total: 2, traced: 1, stored: 0 });
});

test("the list, the map layer and a lead's rounds: filters, batched queries (no more for more rounds), only traced rounds on the map", { skip }, async () => {
  const fdh = await lead("Fiona Filter");
  const ldb = await lead("Lewis Layer", "LDB");
  const d = await distributor("Filter");
  const a = await createRound(prisma, { business: "FDH", leadId: fdh.id, projectId: null, distributorId: d.id, date: "2026-10-01", notes: `${MARK} a`, screenshots: [shot()] });
  await createRound(prisma, { business: "LDB", leadId: ldb.id, projectId: null, distributorId: null, date: "2026-10-05", notes: `${MARK} b`, screenshots: [shot()] });
  await saveScreenshotWork(prisma, a.screenshotIds[0], { pairs: PAIRS, route: ROUTE });

  queries = 0;
  const byLead = await listRounds(prisma, { leadId: fdh.id });
  const forOne = queries;
  // Prisma reads each relation in one batched statement, so the count is
  // the same for one round as for many.
  assert.ok(forOne <= 5, `${forOne} statements`);
  queries = 0;
  const many = await listRounds(prisma, {});
  assert.ok(many.rounds.length >= 3);
  assert.equal(queries, forOne, "no more statements for more rounds");
  assert.deepEqual(byLead.rounds.map((r) => r.id), [a.id]);
  assert.equal(byLead.rounds[0].lead?.name, "Fiona Filter");
  assert.equal(byLead.rounds[0].distributor?.name, `${MARK} Filter`);
  assert.equal((await listRounds(prisma, { business: "LDB", from: "2026-10-01", to: "2026-10-31" })).rounds.filter((r) => r.lead?.id === ldb.id).length, 1);
  assert.equal((await listRounds(prisma, { distributorId: d.id })).rounds.length, 1);
  assert.equal((await listRounds(prisma, { from: "2026-10-02", to: "2026-10-04", leadId: fdh.id })).rounds.length, 0);
  const limited = await listRounds(prisma, { from: "2026-10-01", to: "2026-10-05" }, 1);
  assert.equal(limited.rounds.length, 1);
  assert.equal(limited.more, true);

  queries = 0;
  const layer = await mapRounds(prisma, { from: "2026-10-01", to: "2026-10-31" });
  assert.ok(queries <= 4, `${queries} statements for the layer`);
  const mine = layer.rounds.filter((r) => r.id === a.id);
  assert.equal(mine.length, 1);
  assert.ok(!layer.rounds.some((r) => r.lead?.id === ldb.id), "an untraced round isn't drawn");
  assert.equal(mine[0].lines.length, 1);
  assert.ok(Math.abs(linesLengthM(mine[0].lines) - 850) < 2);

  queries = 0;
  const panel = await leadRounds(prisma, fdh.id);
  const forPanel = queries;
  assert.deepEqual(panel.rounds.map((r) => r.id), [a.id]);
  assert.equal(panel.map.length, 1);
  // The lead's rounds, its links, and its rounds' map (as the client's link
  // shows it), side by side: a fixed few statements, none per round.
  assert.ok(forPanel <= forOne + 6, `${forPanel} statements for the lead's panel (the list took ${forOne})`);
  const another = await createRound(prisma, { business: "FDH", leadId: fdh.id, projectId: null, distributorId: null, date: "2026-11-09", notes: `${MARK} panel`, screenshots: [shot()] });
  queries = 0;
  assert.equal((await leadRounds(prisma, fdh.id)).map.length, 2);
  assert.equal(queries, forPanel, "no more statements for the lead's panel with more rounds");
  await deleteRound(prisma, screenshotStorage({}), another.id);
});

test("changing a round: a new lead brings its business; a project for another lead is refused", { skip }, async () => {
  const fdh = await lead("Fred First");
  const ldb = await lead("Lara Later", "LDB");
  const made = await createRound(prisma, { business: "FDH", leadId: fdh.id, projectId: null, distributorId: null, date: "2026-11-01", notes: `${MARK} change`, screenshots: [shot()] });
  await updateRound(prisma, made.id, { leadId: ldb.id, date: "2026-11-02", notes: `${MARK} changed` });
  const round = (await getRound(prisma, made.id))!;
  assert.equal(round.business, "LDB");
  assert.equal(round.date, "2026-11-02");
  assert.equal(round.notes, `${MARK} changed`);
  const project = await prisma.areaProject.create({ data: { name: `${MARK} project`, leadId: fdh.id }, select: { id: true } });
  await assert.rejects(updateRound(prisma, made.id, { projectId: project.id }), /different lead/);
  await updateRound(prisma, made.id, { leadId: null, projectId: project.id });
  const moved = (await getRound(prisma, made.id))!;
  assert.equal(moved.lead?.id, fdh.id, "a project brings its lead");
  assert.equal(moved.project?.id, project.id);
  assert.equal(moved.business, "FDH");
  const options = await roundOptions(prisma, false);
  assert.ok(options.jobs.some((j) => j.projectId === project.id && j.leadId === fdh.id));
  assert.equal(options.storage, false);
});

test("deleting a lead keeps its rounds, unlinked; deleting a screenshot or a round removes its stored files", { skip }, async () => {
  const l = await lead("Gone Lead");
  const fake = fakeBlob();
  const made = await createRound(prisma, { business: "FDH", leadId: l.id, projectId: null, distributorId: null, date: "2026-11-03", notes: `${MARK} delete`, screenshots: [shot(10, 20), shot(10, 20)] });
  const webp = await sharp({ create: { width: 10, height: 20, channels: 3, background: "#079be5" } }).webp().toBuffer();
  await attachScreenshotFile(prisma, fake.storage, made.screenshotIds[0], { body: webp, sha256: null });
  await attachScreenshotFile(prisma, fake.storage, made.screenshotIds[1], { body: webp, sha256: null });
  await prisma.lead.delete({ where: { id: l.id } });
  const kept = await prisma.round.findUniqueOrThrow({ where: { id: made.id } });
  assert.equal(kept.leadId, null);
  await deleteScreenshot(prisma, fake.storage, made.screenshotIds[0]);
  assert.equal(fake.deleted.length, 1);
  await deleteRound(prisma, fake.storage, made.id);
  assert.equal(fake.deleted.length, 2);
  assert.equal(fake.files.size, 0);
  assert.equal(await prisma.round.count({ where: { id: made.id } }), 0);
  assert.equal(await prisma.roundScreenshot.count({ where: { roundId: made.id } }), 0);
});

test("attaching a screenshot: only with storage on, only a WebP or JPEG of its size, only the same file; then it is served back", { skip }, async () => {
  const sha = "a".repeat(64);
  const made = await createRound(prisma, { business: "FDH", leadId: null, projectId: null, distributorId: null, date: "2026-11-04", notes: `${MARK} attach`, screenshots: [shot(40, 80, sha)] });
  const sid = made.screenshotIds[0];
  const webp = await sharp({ create: { width: 40, height: 80, channels: 3, background: "#079be5" } }).webp().toBuffer();
  await assert.rejects(attachScreenshotFile(prisma, screenshotStorage({}), sid, { body: webp, sha256: sha }), /isn't switched on/);
  assert.equal(await openScreenshotFile(prisma, screenshotStorage({}), sid), null, "nothing to serve while storage is off");
  const fake = fakeBlob();
  const wrongSize = await sharp({ create: { width: 41, height: 80, channels: 3, background: "#000" } }).webp().toBuffer();
  await assert.rejects(attachScreenshotFile(prisma, fake.storage, sid, { body: wrongSize, sha256: sha }), /size/);
  const png = await sharp({ create: { width: 40, height: 80, channels: 3, background: "#000" } }).png().toBuffer();
  await assert.rejects(attachScreenshotFile(prisma, fake.storage, sid, { body: png, sha256: sha }), /WebP or JPEG/);
  await assert.rejects(attachScreenshotFile(prisma, fake.storage, sid, { body: webp, sha256: "b".repeat(64) }), /same screenshot/);
  await attachScreenshotFile(prisma, fake.storage, sid, { body: webp, sha256: sha });
  const row = await prisma.roundScreenshot.findUniqueOrThrow({ where: { id: sid } });
  assert.match(row.blobUrl ?? "", new RegExp(`^https://store.example/rounds/${made.id}/${sid}\\.webp$`));
  assert.equal(row.contentType, "image/webp");
  assert.equal(row.bytes, webp.length);
  const file = await openScreenshotFile(prisma, fake.storage, sid);
  assert.ok(file);
  assert.deepEqual(Buffer.from(await new Response(file!.stream).arrayBuffer()), webp);
  // The round now shows it as stored.
  assert.deepEqual((await getRound(prisma, made.id))!.screenshots, { total: 1, traced: 0, stored: 1 });
});

const fp = (n: number) => n.toString(16).padStart(64, "0");

test("more screenshots can be added, up to 100 in a round", { skip }, async () => {
  const made = await createRound(prisma, { business: "FDH", leadId: null, projectId: null, distributorId: null, date: "2026-11-05", notes: `${MARK} more`, screenshots: [shot()] });
  const ids = await addScreenshots(prisma, made.id, [shot(), shot()]);
  assert.equal(ids.length, 2);
  const positions = (await prisma.roundScreenshot.findMany({ where: { roundId: made.id }, orderBy: { position: "asc" } })).map((s) => s.position);
  assert.deepEqual(positions, [0, 1, 2]);
  await assert.rejects(addScreenshots(prisma, made.id, Array.from({ length: 98 }, () => shot())), /at most 100/);
  assert.equal((await addScreenshots(prisma, made.id, Array.from({ length: 97 }, () => shot()))).length, 97);
  assert.equal(await prisma.roundScreenshot.count({ where: { roundId: made.id } }), 100);
  await assert.rejects(addScreenshots(prisma, made.id, [shot()]), /at most 100/);
});

test("sixty screenshots are made in a few statements, not one each, and come back in the order sent", { skip }, async () => {
  const sixty = Array.from({ length: 60 }, (_, i) => ({ ...shot(), sha256: fp(1000 + i), originalName: `IMG_${1000 + i}.PNG` }));
  queries = 0;
  const made = await createRound(prisma, { business: "FDH", leadId: null, projectId: null, distributorId: null, date: "2026-11-06", notes: `${MARK} sixty`, screenshots: sixty });
  assert.ok(queries <= 6, `${queries} statements to make a round with 60 screenshots`);
  assert.equal(made.screenshotIds.length, 60);
  const rows = await prisma.roundScreenshot.findMany({ where: { roundId: made.id }, select: { id: true, position: true, originalName: true, sourceSha256: true }, orderBy: { position: "asc" } });
  assert.deepEqual(rows.map((r) => r.id), made.screenshotIds);
  assert.deepEqual(rows.map((r) => r.originalName), sixty.map((s) => s.originalName));

  // Adding forty more to another round: the same few statements.
  const other = await createRound(prisma, { business: "FDH", leadId: null, projectId: null, distributorId: null, date: "2026-11-06", notes: `${MARK} forty`, screenshots: [shot()] });
  queries = 0;
  const forty = await addScreenshots(prisma, other.id, Array.from({ length: 40 }, (_, i) => ({ ...shot(), sha256: fp(2000 + i) })));
  assert.ok(queries <= 6, `${queries} statements to add 40 screenshots`);
  assert.equal(forty.length, 40);
});

test("choosing the same files again: screenshots the round has are recognised by fingerprint, not made twice", { skip }, async () => {
  const first = [fp(3001), fp(3002), fp(3003)].map((sha256) => ({ ...shot(), sha256 }));
  const made = await createRound(prisma, { business: "FDH", leadId: null, projectId: null, distributorId: null, date: "2026-11-07", notes: `${MARK} again`, screenshots: [...first, first[1]] });
  // The same file twice in one upload is one screenshot.
  assert.equal(await prisma.roundScreenshot.count({ where: { roundId: made.id } }), 3);
  assert.equal(made.screenshotIds[3], made.screenshotIds[1]);
  await saveScreenshotWork(prisma, made.screenshotIds[0], { pairs: PAIRS, route: ROUTE });
  // Two of the same files again and one new: only the new one is made, and
  // the saved one keeps its work.
  const again = await addScreenshots(prisma, made.id, [first[0], { ...shot(), sha256: fp(3004) }, first[2]]);
  assert.equal(again[0], made.screenshotIds[0]);
  assert.equal(again[2], made.screenshotIds[2]);
  assert.equal(await prisma.roundScreenshot.count({ where: { roundId: made.id } }), 4);
  const round = (await getRound(prisma, made.id))!;
  assert.equal(round.shots.find((s) => s.id === made.screenshotIds[0])!.routeLengthM !== null, true);
  assert.deepEqual(round.shots.map((s) => s.position), [0, 1, 2, 3]);
});

test("Not specified: a round with no distributor is listed and filtered as such", { skip }, async () => {
  const d = await distributor("Specified");
  const none = await createRound(prisma, { business: "FDH", leadId: null, projectId: null, distributorId: null, date: "2026-09-01", notes: `${MARK} none`, screenshots: [shot()] });
  const some = await createRound(prisma, { business: "FDH", leadId: null, projectId: null, distributorId: d.id, date: "2026-09-01", notes: `${MARK} some`, screenshots: [shot()] });
  const onDay = { from: "2026-09-01", to: "2026-09-01" };
  const unset = (await listRounds(prisma, { ...onDay, distributorId: null })).rounds.map((r) => r.id);
  assert.ok(unset.includes(none.id));
  assert.ok(!unset.includes(some.id));
  assert.equal((await listRounds(prisma, { ...onDay })).rounds.filter((r) => r.id === none.id || r.id === some.id).length, 2);
  assert.equal((await getRound(prisma, none.id))!.distributor, null);
});

test("accepting automatic line-ups: several saved together, the turn and how each was made kept, the round's figures worked out once", { skip }, async () => {
  const made = await createRound(prisma, { business: "FDH", leadId: null, projectId: null, distributorId: null, date: "2026-11-08", notes: `${MARK} accept`, screenshots: [shot(), shot(), shot()] });
  const other = await createRound(prisma, { business: "FDH", leadId: null, projectId: null, distributorId: null, date: "2026-11-08", notes: `${MARK} other`, screenshots: [shot()] });
  // A line-up turned 9 degrees, as four exact points and the measured turn.
  const turned: Transform = { ...TRANSFORM, rotationDeg: 9 };
  const pairs = [[100, 400], [640, 400], [640, 1300], [100, 1300]].map(([x, y]) => ({ image: [x, y] as [number, number], map: imageToLngLat(turned, [x, y]) }));
  const work = (n: number) => ({ crop: { top: 166, bottom: 1600, left: 0, right: 740 }, pairs, turnDeg: 9, source: { kind: "auto" as const, confidence: 0.8 - n / 10, from: made.screenshotIds[0] }, route: ROUTE, markers: null });
  queries = 0;
  const saved = await saveScreenshotsWork(prisma, made.id, [
    { id: made.screenshotIds[1], work: work(1) },
    { id: made.screenshotIds[2], work: work(2) },
  ]);
  const used = queries;
  assert.equal(saved.length, 2);
  for (const s of saved) {
    assert.equal(s.alignment?.transform.rotationDeg, 9);
    assert.ok(s.alignment!.errorsPx.every((e) => e < 0.05));
    assert.equal(s.alignment?.source?.kind, "auto");
    assert.ok(s.routeLengthM! > 0);
  }
  // The round's distance and sectors, once: a handful of statements, not one set per screenshot.
  const round = (await getRound(prisma, made.id))!;
  assert.ok(round.distanceM! > 0);
  assert.ok(used <= 12, `${used} statements to accept two`);
  // A screenshot from another round isn't saved, and nothing is.
  await assert.rejects(saveScreenshotsWork(prisma, made.id, [{ id: made.screenshotIds[0], work: work(0) }, { id: other.screenshotIds[0], work: work(0) }]), /isn't in this round/);
  assert.equal((await prisma.roundScreenshot.findUnique({ where: { id: made.screenshotIds[0] } }))!.alignment, null);
  // A hand line-up saved alone is marked as made by hand.
  const hand = await saveScreenshotWork(prisma, made.screenshotIds[0], { pairs: PAIRS });
  assert.equal(hand.alignment?.source?.kind, "hand");
});

test("the privacy trim setting: 150 m until set", { skip }, async () => {
  assert.equal(await clientTrimM(prisma), 150);
  await setClientTrimM(prisma, 220);
  assert.equal(await clientTrimM(prisma), 220);
  await setClientTrimM(prisma, 0);
  assert.equal(await clientTrimM(prisma), 0);
});
