import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import sharp from "sharp";
import { PrismaClient } from "@/generated/prisma/client";
import { postcodeGeometry } from "@/lib/area-planner/data";
import { pairsFor, traceOnMap } from "@/lib/rounds/auto";
import { findCompass } from "@/lib/rounds/compass";
import { detectCrop, extractRoute } from "@/lib/rounds/extract";
import type { RgbaImage } from "@/lib/rounds/extract/image";
import { routeSamples } from "@/lib/rounds/locate/fit";
import { parseReading } from "@/lib/rounds/locate/labels";
import type { ReadResult } from "@/lib/rounds/locate/read-labels";
import { locateScreenshot } from "@/lib/rounds/locate/service";
import { createRound, getRound, leadRounds, roundOptions, saveScreenshotWork, saveScreenshotsWork } from "@/lib/rounds/service";
import { holdRoundsLock } from "./rounds-db-lock";
import { fixtureFile, fixturesDir } from "./rounds-locate-mock";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Locate against a real database, but only a throwaway local one (skipped
// unless CRM_TEST_DATABASE_URL points at localhost). Claude's reading is a
// stand-in returning the labels recorded from the three real screenshots.
// The job's area comes from the round's Area Planner project or else its
// lead's; a round elsewhere, or with no areas, is refused; a busy API gives
// its reason and wait. Saving keeps what Locate cost with the line-up, and
// the lead's page shows all its rounds on one map, trimmed. Cleans up.

const url = process.env.CRM_TEST_DATABASE_URL ?? "";
let host = "";
try {
  host = url ? new URL(url).hostname : "";
} catch {
  host = "";
}
const skip = !["localhost", "127.0.0.1", "::1", "[::1]"].includes(host) ? "set CRM_TEST_DATABASE_URL to a local throwaway database to run" : false;

const DOMAIN = "@rounds-locate-test.example";
const MARK = "rounds-locate-test";
let prisma: PrismaClient;
let release: (() => Promise<void>) | null = null;

async function cleanUp() {
  const leads = (await prisma.lead.findMany({ where: { email: { endsWith: DOMAIN } }, select: { id: true } })).map((l) => l.id);
  await prisma.round.deleteMany({ where: { OR: [{ leadId: { in: leads } }, { notes: { startsWith: MARK } }] } });
  await prisma.areaProject.deleteMany({ where: { name: { startsWith: MARK } } });
  await prisma.lead.deleteMany({ where: { id: { in: leads } } });
}

before(async () => {
  if (skip) return;
  release = await holdRoundsLock(url);
  prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  await cleanUp();
});

after(async () => {
  if (skip) return;
  await cleanUp();
  await prisma.$disconnect();
  await release?.();
});

const READINGS = JSON.parse(readFileSync(join(fixturesDir(), "locate-readings.json"), "utf8")).readings as Record<string, unknown>;

async function prepared(n: string) {
  const { data, info } = await sharp(fixtureFile(n)).resize(738, 1600, { kernel: "lanczos3" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const img: RgbaImage = { width: info.width, height: info.height, data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength) };
  const crop = detectCrop(img);
  const compass = findCompass(img, crop);
  const traced = extractRoute(img, { crop });
  return { crop, traced, inputs: { image: await sharp(fixtureFile(n)).resize(738, 1600).jpeg().toBuffer(), compassTurn: compass ? compass.turnDeg : null, route: routeSamples(traced.lines) } };
}

// Claude's reading, as recorded for screenshot n; counts its calls.
function reader(n: string, calls = { count: 0 }) {
  return async (_image: Buffer, width: number, height: number): Promise<ReadResult> => {
    calls.count++;
    return { ok: true, labels: parseReading(READINGS[n], width, height), costUsd: 0.0257, seconds: 11.4, model: "claude-opus-5-5", tokens: { input: 2104, output: 906 } };
  };
}

async function projectWith(name: string, codes: string[], leadId: string | null = null) {
  const geometries = await Promise.all(codes.map((c) => postcodeGeometry(c)));
  return prisma.areaProject.create({
    data: { name: `${MARK} ${name}`, leadId, areas: { create: geometries.map((g, i) => ({ kind: "POSTCODE" as const, postcode: codes[i], geometry: g as object })) } },
    select: { id: true },
  });
}

const shot = () => ({ width: 738, height: 1600, sha256: null, originalName: "IMG_LOCATE.JPEG", takenAt: null });

test("Locate on a round: the job's area from its lead's project; placed there, refused elsewhere or with no area; a busy API's reason and wait", { skip }, async () => {
  const lead = await prisma.lead.create({ data: { name: "Locate Test", email: `locate${DOMAIN}`, business: "FDH", stage: "WON" }, select: { id: true } });
  await projectWith("Sholing and Hamble", ["SO18", "SO19", "SO30", "SO31"], lead.id);
  // No project on the round itself: its lead's project's areas are used.
  const round = await createRound(prisma, { business: "FDH", leadId: lead.id, projectId: null, distributorId: null, date: "2026-11-12", notes: `${MARK} job`, screenshots: [shot(), shot(), shot()] });
  for (const [i, n] of ["1", "2", "3"].entries()) {
    const p = await prepared(n);
    const out = await locateScreenshot(prisma, round.screenshotIds[i], p.inputs, reader(n));
    assert.ok(out.ok, `screenshot ${n}: ${out.reason}`);
    assert.ok(out.transform && out.confidence >= 0.6 && out.names.length >= 10);
    assert.equal(out.costUsd, 0.0257);
    assert.equal(out.model, "claude-opus-5-5");
  }
  assert.equal((await getRound(prisma, round.id))!.locateArea, true);

  // A round whose project is in Bournemouth: refused, never placed there.
  const bh = await projectWith("Bournemouth", ["BH1", "BH2", "BH3", "BH4", "BH5", "BH6", "BH7", "BH8", "BH9", "BH10", "BH11", "BH12"]);
  const elsewhere = await createRound(prisma, { business: "FDH", leadId: null, projectId: bh.id, distributorId: null, date: "2026-11-12", notes: `${MARK} elsewhere`, screenshots: [shot()] });
  const refused = await locateScreenshot(prisma, elsewhere.screenshotIds[0], (await prepared("1")).inputs, reader("1"));
  assert.equal(refused.ok, false);
  assert.equal(refused.transform, null);
  assert.equal(refused.costUsd, 0.0257, "what the reading cost is still reported");

  // No areas at all: refused before anything is sent.
  const bare = await createRound(prisma, { business: "FDH", leadId: null, projectId: null, distributorId: null, date: "2026-11-12", notes: `${MARK} bare`, screenshots: [shot()] });
  const calls = { count: 0 };
  const none = await locateScreenshot(prisma, bare.screenshotIds[0], (await prepared("1")).inputs, reader("1", calls));
  assert.match(none.reason, /no Area Planner areas/);
  assert.equal(calls.count, 0);
  assert.equal((await getRound(prisma, bare.id))!.locateArea, false);

  // The API busy: its reason and how long to wait, nothing placed.
  const busy = await locateScreenshot(prisma, round.screenshotIds[0], (await prepared("1")).inputs, async () => ({ ok: false, reason: "Claude is busy (rate limited); try Locate again shortly", retryAfterS: 7, costUsd: 0, seconds: 0.3, model: null }));
  assert.equal(busy.ok, false);
  assert.match(busy.reason, /busy/);
  assert.equal(busy.retryAfterS, 7);

  // Whether Locate is set up is passed through to the round options.
  assert.equal((await roundOptions(prisma, false, true)).locate, true);
  assert.equal((await roundOptions(prisma, false, false)).locate, false);
});

test("saving a located line-up keeps what Locate cost; saving it again by hand keeps that too; the lead's map shows its rounds trimmed", { skip }, async () => {
  const lead = await prisma.lead.create({ data: { name: "Locate Save Test", email: `locate.save${DOMAIN}`, business: "FDH", stage: "WON" }, select: { id: true } });
  const project = await projectWith("Save", ["SO18", "SO19", "SO30", "SO31"]);
  const round = await createRound(prisma, { business: "FDH", leadId: lead.id, projectId: project.id, distributorId: null, date: "2026-11-12", notes: `${MARK} save`, screenshots: [shot(), shot()] });
  const items = [];
  for (const [i, n] of ["2", "3"].entries()) {
    const p = await prepared(n);
    const out = await locateScreenshot(prisma, round.screenshotIds[i], p.inputs, reader(n));
    assert.ok(out.ok && out.transform);
    const onMap = traceOnMap(out.transform!, p.traced.lines, p.traced.start, p.traced.end);
    items.push({
      id: round.screenshotIds[i],
      work: {
        crop: p.crop,
        pairs: pairsFor(out.transform!, 738, p.crop),
        turnDeg: out.transform!.rotationDeg,
        source: { kind: "located" as const, confidence: out.confidence, names: out.names.length },
        locate: { costUsd: out.costUsd, seconds: out.seconds, model: out.model!, placed: true, names: out.names.length },
        route: onMap.lines,
        markers: onMap.markers,
      },
    });
  }
  const saved = await saveScreenshotsWork(prisma, round.id, items);
  for (const s of saved) {
    assert.equal(s.alignment?.source?.kind, "located");
    assert.equal(s.alignment?.locate?.costUsd, 0.0257);
    assert.equal(s.alignment?.locate?.placed, true);
  }
  // Lined up again by hand: made by hand now, and what Locate cost is still there.
  const again = await saveScreenshotWork(prisma, round.screenshotIds[0], { pairs: items[0].work.pairs.slice(0, 2) });
  assert.equal(again.alignment?.source?.kind, "hand");
  assert.equal(again.alignment?.locate?.costUsd, 0.0257);

  // The lead's page: both screenshots' lines on one map, start and end trimmed off.
  const { map } = await leadRounds(prisma, lead.id);
  assert.equal(map.length, 1);
  const full = items.flatMap((i) => i.work.route).flat().length;
  const shown = map[0].lines.flat().length;
  assert.ok(shown > 0 && shown <= full, `${shown} of ${full} points shown`);
});
