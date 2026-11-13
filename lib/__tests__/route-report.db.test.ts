import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { holdRoundsLock } from "./rounds-db-lock";
import { distanceM, localPlane, type LngLat, type Lines } from "@/lib/rounds/geometry";
import { imageToLngLat, toMercator, type PointPair, type Transform } from "@/lib/rounds/alignment";
import { hashShareToken } from "@/lib/area-planner/share-links";
import {
  createReportLink,
  createRound,
  getRound,
  leadRounds,
  reportScreenshotFile,
  resolveReportToken,
  revokeReportLink,
  saveScreenshotWork,
  setClientTrimM,
  attachScreenshotFile,
  TRIM_SETTING,
} from "@/lib/rounds/service";
import { screenshotStorage, type BlobClient } from "@/lib/rounds/storage";
import sharp from "sharp";

// Client route reports against a throwaway local database only (skipped
// unless CRM_TEST_DATABASE_URL points at localhost). A report shows only the
// rounds its link covers, picked through a short list of fields, so another
// client's rounds and anything CRM-only (distributor, notes, prices,
// payments, ids, links into the CRM) can never appear; revoked, expired and
// unknown tokens find nothing. Cleans up after itself.

const url = process.env.CRM_TEST_DATABASE_URL ?? "";
let host = "";
try {
  host = url ? new URL(url).hostname : "";
} catch {
  host = "";
}
const skip = !["localhost", "127.0.0.1", "::1", "[::1]"].includes(host) ? "set CRM_TEST_DATABASE_URL to a local throwaway database to run" : false;

const DOMAIN = "@route-report-test.example";
const MARK = "route-report-test";
let prisma: PrismaClient;

const RINGWOOD: LngLat = [-1.7917, 50.8461];
const plane = localPlane(RINGWOOD[1]);
const at = (east: number, north: number): LngLat => {
  const [x, y] = plane.to(RINGWOOD);
  return plane.from([x + east, y + north]);
};
const TRANSFORM: Transform = (() => {
  const [x, y] = toMercator(RINGWOOD);
  const scale = 1 / Math.cos((RINGWOOD[1] * Math.PI) / 180);
  return { scale, rotationDeg: 0, offsetX: x - 370 * scale, offsetY: y - 800 * scale };
})();
const PAIRS: PointPair[] = [
  { image: [100, 300], map: imageToLngLat(TRANSFORM, [100, 300]) },
  { image: [620, 1400], map: imageToLngLat(TRANSFORM, [620, 1400]) },
];

// Words that must never reach a client's page.
const SECRETS = {
  distributor: `${MARK} Dmitri Secretname`,
  notes: `${MARK} NOTE-ONLY-FOR-CRM gate code 4321`,
  otherClient: "Otto Otherclient",
  otherBusiness: "Otherclient Pizzas Ltd",
  dealValue: "987.65",
  amountPaid: "123.45",
};

async function cleanUp() {
  const leads = (await prisma.lead.findMany({ where: { email: { endsWith: DOMAIN } }, select: { id: true } })).map((l) => l.id);
  await prisma.round.deleteMany({ where: { OR: [{ leadId: { in: leads } }, { notes: { startsWith: MARK } }] } });
  await prisma.lead.deleteMany({ where: { id: { in: leads } } });
  await prisma.distributor.deleteMany({ where: { name: { startsWith: MARK } } });
  await prisma.appSetting.deleteMany({ where: { key: TRIM_SETTING } });
}

let release: (() => Promise<void>) | null = null;

before(async () => {
  if (skip) return;
  // One Rounds database test file at a time (they share the trim setting).
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

const shot = () => ({ width: 740, height: 1600, sha256: null, originalName: "IMG.PNG", takenAt: null });

// A lead with traced rounds: one line per round, starting and ending at its dots.
async function clientWithRounds(name: string, business: "FDH" | "LDB", businessName: string, rounds: { date: string; east: number }[]) {
  const lead = await prisma.lead.create({
    data: { name, businessName, email: `${name.toLowerCase().replace(/\s+/g, ".")}${DOMAIN}`, business, stage: "WON", dealValue: SECRETS.dealValue, amountPaid: SECRETS.amountPaid },
    select: { id: true },
  });
  const distributor = await prisma.distributor.create({ data: { name: SECRETS.distributor }, select: { id: true } });
  const ids: string[] = [];
  for (const r of rounds) {
    const made = await createRound(prisma, { business, leadId: lead.id, projectId: null, distributorId: distributor.id, date: r.date, notes: SECRETS.notes, screenshots: [shot()] });
    const route: Lines = [[at(r.east, 0), at(r.east, 600), at(r.east + 400, 600), at(r.east + 400, 0)]];
    await saveScreenshotWork(prisma, made.screenshotIds[0], { pairs: PAIRS, route, markers: { start: at(r.east, 0), end: at(r.east + 400, 0) } });
    ids.push(made.id);
  }
  return { leadId: lead.id, roundIds: ids };
}

const tokenOf = (path: string) => path.split("/").pop()!;

test("a lead's report: only that lead's rounds, oldest first, trimmed, and nothing CRM-only or about another client", { skip }, async () => {
  const mine = await clientWithRounds("Clara Client", "FDH", "Clara's Cakes", [
    { date: "2026-11-02", east: 0 },
    { date: "2026-11-01", east: 2000 },
  ]);
  await clientWithRounds(SECRETS.otherClient, "FDH", SECRETS.otherBusiness, [{ date: "2026-11-01", east: 5000 }]);
  const { token, link } = await createReportLink(prisma, { roundId: null, leadId: mine.leadId, expiresOn: null });
  assert.equal(link.scope, "lead");
  assert.equal(link.state, "active");
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  // Only the hash is kept.
  assert.equal(await prisma.routeReportLink.count({ where: { tokenHash: token } }), 0);
  assert.equal(await prisma.routeReportLink.count({ where: { tokenHash: hashShareToken(token) } }), 1);

  const view = await resolveReportToken(prisma, token);
  assert.ok(view);
  assert.deepEqual(Object.keys(view!).sort(), ["brand", "business", "clientName", "rounds", "totals"]);
  assert.equal(view!.clientName, "Clara's Cakes");
  assert.equal(view!.business, "FDH");
  assert.deepEqual(view!.brand, {
    name: "Flyer Distribution Hampshire",
    website: "www.flyerdistributionhampshire.co.uk",
    websiteUrl: "https://www.flyerdistributionhampshire.co.uk",
    email: "flyerdistributionhampshire@gmail.com",
  });
  assert.deepEqual(view!.rounds.map((r) => r.date), ["2026-11-01", "2026-11-02"]);
  assert.equal(view!.rounds[0].dateLabel, "Sunday 1 November 2026");
  for (const r of view!.rounds) {
    assert.deepEqual(Object.keys(r).sort(), ["date", "dateLabel", "distanceM", "lines", "screenshots", "sectors"]);
    assert.ok(r.sectors.every((s) => /^[A-Z]{1,2}\d[A-Z\d]? \d$/.test(s)), JSON.stringify(r.sectors));
    assert.deepEqual(r.screenshots, [], "nothing stored");
    assert.ok(r.distanceM && r.distanceM > 1300);
  }
  // The privacy trim (150 m by default) around each round's start and end dots.
  const [first] = view!.rounds;
  const start = at(2000, 0);
  const end = at(2400, 0);
  for (const line of first.lines) for (const p of line) assert.ok(distanceM(p, start) >= 149.9 && distanceM(p, end) >= 149.9);
  assert.ok(first.lines.length > 0);

  const text = JSON.stringify(view);
  for (const [what, secret] of Object.entries(SECRETS)) assert.ok(!text.includes(secret), `${what} reached the report`);
  for (const id of [mine.leadId, ...mine.roundIds]) assert.ok(!text.includes(id), "a CRM id reached the report");
  assert.doesNotMatch(text, /admin\/crm|distributor|notes|dealValue|amountPaid|price|payment/i);

  // A round added to the lead later is on the same link.
  const later = await createRound(prisma, { business: "FDH", leadId: mine.leadId, projectId: null, distributorId: null, date: "2026-11-05", notes: SECRETS.notes, screenshots: [shot()] });
  assert.deepEqual((await resolveReportToken(prisma, token))!.rounds.map((r) => r.date), ["2026-11-01", "2026-11-02", "2026-11-05"]);
  await prisma.round.delete({ where: { id: later.id } });
});

test("a round's report: just that round, not the lead's others", { skip }, async () => {
  const c = await clientWithRounds("Rory Round", "FDH", "Rory's Repairs", [
    { date: "2026-10-10", east: 0 },
    { date: "2026-10-12", east: 1000 },
  ]);
  const { token, link } = await createReportLink(prisma, { roundId: c.roundIds[1], leadId: null, expiresOn: null });
  assert.equal(link.scope, "round");
  const view = await resolveReportToken(prisma, token);
  assert.deepEqual(view!.rounds.map((r) => r.date), ["2026-10-12"]);
  assert.equal(view!.totals.rounds, 1);
  assert.equal(view!.clientName, "Rory's Repairs");
});

test("an LDB client's report carries LDB's name, website and email, and nothing of FDH", { skip }, async () => {
  const c = await clientWithRounds("Lily Ldb", "LDB", "Lily's Lettings", [{ date: "2026-10-20", east: 0 }]);
  const { token } = await createReportLink(prisma, { roundId: null, leadId: c.leadId, expiresOn: null });
  const view = await resolveReportToken(prisma, token);
  assert.equal(view!.business, "LDB");
  assert.equal(view!.brand.name, "Leaflet Distribution Bournemouth");
  assert.equal(view!.brand.email, "team@leafletdistributionbournemouth.co.uk");
  assert.doesNotMatch(JSON.stringify(view), /flyer|hampshire/i);
});

test("revoked, expired, unknown and malformed tokens find nothing; a view is noted at most every few minutes", { skip }, async () => {
  const c = await clientWithRounds("Vera Viewed", "FDH", "Vera's Vans", [{ date: "2026-10-01", east: 0 }]);
  const live = await createReportLink(prisma, { roundId: null, leadId: c.leadId, expiresOn: null });
  const now = new Date("2026-11-13T12:00:00Z");
  assert.ok(await resolveReportToken(prisma, live.token, now));
  const viewed = await prisma.routeReportLink.findUniqueOrThrow({ where: { id: live.link.id } });
  assert.equal(viewed.lastViewedAt?.toISOString(), now.toISOString());
  await resolveReportToken(prisma, live.token, new Date(now.getTime() + 60_000));
  assert.equal((await prisma.routeReportLink.findUniqueOrThrow({ where: { id: live.link.id } })).lastViewedAt?.toISOString(), now.toISOString(), "not noted again within five minutes");
  // The CRM shows when it was made and last viewed.
  const panel = await leadRounds(prisma, c.leadId);
  assert.equal(panel.links[0].lastViewedAt, now.toISOString());

  await revokeReportLink(prisma, live.link.id, now);
  assert.equal(await resolveReportToken(prisma, live.token, now), null, "revoked");
  assert.equal((await leadRounds(prisma, c.leadId, now)).links[0].state, "revoked");

  const dated = await createReportLink(prisma, { roundId: null, leadId: c.leadId, expiresOn: "2026-11-20" });
  assert.ok(await resolveReportToken(prisma, dated.token, new Date("2026-11-20T23:00:00Z")), "still live on its last day");
  assert.equal(await resolveReportToken(prisma, dated.token, new Date("2026-11-21T00:00:01Z")), null, "expired");

  assert.equal(await resolveReportToken(prisma, "A".repeat(43)), null, "unknown");
  for (const bad of ["", "short", "x".repeat(44), "../../admin", null, 42]) assert.equal(await resolveReportToken(prisma, bad), null);

  // A link for a round or a lead, never both or neither (the database checks too).
  await assert.rejects(prisma.routeReportLink.create({ data: { tokenHash: "x".repeat(64), roundId: c.roundIds[0], leadId: c.leadId } }));
  await assert.rejects(prisma.routeReportLink.create({ data: { tokenHash: "y".repeat(64) } }));
});

test("a stored screenshot is only served for a round the link covers", { skip }, async () => {
  const files = new Map<string, Buffer>();
  const client: BlobClient = {
    async put(pathname, body) {
      files.set(`https://store.example/${pathname}`, body as Buffer);
      return { url: `https://store.example/${pathname}`, pathname };
    },
    async get(u) {
      const b = files.get(u);
      return b ? { stream: new Blob([new Uint8Array(b)]).stream(), contentType: "image/webp", size: b.length } : null;
    },
    async del(u) {
      files.delete(u);
    },
  };
  const storage = screenshotStorage({ BLOB_READ_WRITE_TOKEN: "t" }, client);
  const a = await clientWithRounds("Sara Shots", "FDH", "Sara's Salon", [{ date: "2026-10-03", east: 0 }]);
  const b = await clientWithRounds("Ben Beyond", "FDH", "Ben's Bikes", [{ date: "2026-10-03", east: 3000 }]);
  const webp = await sharp({ create: { width: 740, height: 1600, channels: 3, background: "#079be5" } }).webp({ quality: 10 }).toBuffer();
  const aShot = (await getRound(prisma, a.roundIds[0]))!.shots[0].id;
  const bShot = (await getRound(prisma, b.roundIds[0]))!.shots[0].id;
  await attachScreenshotFile(prisma, storage, aShot, { body: webp, sha256: null });
  await attachScreenshotFile(prisma, storage, bShot, { body: webp, sha256: null });
  const { token } = await createReportLink(prisma, { roundId: null, leadId: a.leadId, expiresOn: null });
  const view = await resolveReportToken(prisma, token);
  assert.deepEqual(view!.rounds[0].screenshots, [aShot]);
  assert.ok(await reportScreenshotFile(prisma, storage, token, aShot));
  assert.equal(await reportScreenshotFile(prisma, storage, token, bShot), null, "another client's screenshot");
  assert.equal(await reportScreenshotFile(prisma, screenshotStorage({}), token, aShot), null, "storage off");
});

test("the trim setting changes what clients see", { skip }, async () => {
  const c = await clientWithRounds("Tom Trim", "FDH", "Tom's Taxis", [{ date: "2026-10-04", east: 0 }]);
  const { token } = await createReportLink(prisma, { roundId: null, leadId: c.leadId, expiresOn: null });
  await setClientTrimM(prisma, 0);
  const untrimmed = (await resolveReportToken(prisma, token))!.rounds[0].lines;
  await setClientTrimM(prisma, 300);
  const trimmed = (await resolveReportToken(prisma, token))!.rounds[0].lines;
  const len = (l: Lines) => l.reduce((s, line) => s + line.slice(1).reduce((t, p, k) => t + distanceM(line[k], p), 0), 0);
  assert.ok(Math.abs(len(untrimmed) - 1600) < 2);
  // 300 m off each end: the first and last 300 m along the line, at least.
  assert.ok(len(trimmed) <= len(untrimmed) - 600 + 1, `${len(trimmed)}`);
  assert.ok(len(trimmed) > 900);
  await setClientTrimM(prisma, 150);
});
