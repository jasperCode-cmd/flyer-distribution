import "server-only";
import sharp from "sharp";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import type { Business } from "@/lib/business";
import { WON_STAGES } from "@/lib/lead-stage";
import { mappablePostcodes } from "@/lib/area-planner/data";
import { geometryBbox, type AreaGeometry } from "@/lib/area-planner/geometry";
import { nextMapColour, UNASSIGNED_COLOUR } from "@/lib/area-planner/colours";
import { hashShareToken, isShareTokenShaped, newShareToken } from "@/lib/area-planner/share-links";
import { parsePostcodeList } from "@/lib/area-planner/postcodes";
import { solveAlignment, type Alignment } from "./alignment";
import type { Crop } from "./extract/image";
import { lineLengthM, linesBbox, roundCoords, roundDistanceM, type Lines } from "./geometry";
import { buildReportView, type ReportView } from "./report-view";
import { sectorsForLines } from "./sectors";
import { ALLOWED_TYPES, MAX_FILE_BYTES, type FileStream, type ScreenshotStorage } from "./storage";
import { DEFAULT_TRIM_M, MAX_SCREENSHOTS, type NewLink, type NewRound, type NewScreenshot, type RoundChanges, type ScreenshotWork } from "./validate";
import type {
  JobOption,
  MapRound,
  Markers,
  ReportLinkState,
  ReportLinkView,
  RoundDetail,
  RoundDistributor,
  RoundFilters,
  RoundOptions,
  RoundScreenshotView,
  RoundSummary,
  SectorShare,
} from "./types";

// Rounds in the database: each round with its screenshots' details (never
// the images), its worked-out distance and sectors, the Area Planner's
// Rounds layer, a lead's rounds, client report links and the privacy trim
// setting. Every list is one query; nothing is read until a page or the
// layer asks for it.

type Db = PrismaClient;
type Tx = Prisma.TransactionClient;

export class RoundsError extends Error {
  constructor(
    message: string,
    readonly status = 400
  ) {
    super(message);
  }
}

const notFound = () => new RoundsError("That round no longer exists.", 404);

export const LIST_LIMIT = 500;
export const TRIM_SETTING = "rounds.clientTrimM";
const DAY_MS = 24 * 60 * 60 * 1000;
const REPORT_VIEW_NOTE_MS = 5 * 60 * 1000;

// --- Shapes --------------------------------------------------------------------------------

const dateOnly = (d: Date) => d.toISOString().slice(0, 10);
const asDate = (s: string) => new Date(`${s}T00:00:00Z`);

function sectorsOf(value: unknown): SectorShare[] {
  if (!Array.isArray(value)) return [];
  return value.filter((s): s is SectorShare => !!s && typeof s === "object" && typeof s.code === "string" && typeof s.metres === "number");
}

function distributorOf(d: { id: string; name: string; mapColour: string | null } | null): RoundDistributor | null {
  return d ? { id: d.id, name: d.name, colour: d.mapColour ?? UNASSIGNED_COLOUR } : null;
}

function leadName(l: { name: string; businessName: string | null }): string {
  return l.businessName?.trim() || l.name;
}

const SUMMARY_SELECT = {
  id: true,
  business: true,
  date: true,
  distanceM: true,
  sectors: true,
  lead: { select: { id: true, name: true, businessName: true } },
  project: { select: { id: true, name: true } },
  distributor: { select: { id: true, name: true, mapColour: true } },
  screenshots: { select: { routeLengthM: true, blobUrl: true } },
} satisfies Prisma.RoundSelect;

type SummaryRow = Prisma.RoundGetPayload<{ select: typeof SUMMARY_SELECT }>;

function summaryOf(r: SummaryRow): RoundSummary {
  return {
    id: r.id,
    business: r.business,
    date: dateOnly(r.date),
    lead: r.lead ? { id: r.lead.id, name: leadName(r.lead) } : null,
    project: r.project,
    distributor: distributorOf(r.distributor),
    distanceM: r.distanceM,
    sectors: sectorsOf(r.sectors),
    screenshots: {
      total: r.screenshots.length,
      traced: r.screenshots.filter((s) => s.routeLengthM !== null).length,
      stored: r.screenshots.filter((s) => !!s.blobUrl).length,
    },
  };
}

function whereFor(filters: RoundFilters): Prisma.RoundWhereInput {
  const where: Prisma.RoundWhereInput = {};
  if (filters.from || filters.to) where.date = { ...(filters.from && { gte: asDate(filters.from) }), ...(filters.to && { lte: asDate(filters.to) }) };
  if (filters.business) where.business = filters.business;
  if (filters.leadId) where.leadId = filters.leadId;
  if (filters.distributorId !== undefined) where.distributorId = filters.distributorId;
  if (filters.projectId) where.projectId = filters.projectId;
  return where;
}

function linkState(l: { revokedAt: Date | null; expiresAt: Date | null }, now: Date): ReportLinkState {
  if (l.revokedAt) return "revoked";
  if (l.expiresAt && now.getTime() >= l.expiresAt.getTime()) return "expired";
  return "active";
}

const LINK_SELECT = { id: true, roundId: true, leadId: true, createdAt: true, expiresAt: true, revokedAt: true, lastViewedAt: true } satisfies Prisma.RouteReportLinkSelect;

function linkView(l: Prisma.RouteReportLinkGetPayload<{ select: typeof LINK_SELECT }>, now: Date): ReportLinkView {
  return {
    id: l.id,
    scope: l.roundId ? "round" : "lead",
    createdAt: l.createdAt.toISOString(),
    expiresAt: l.expiresAt?.toISOString() ?? null,
    revokedAt: l.revokedAt?.toISOString() ?? null,
    lastViewedAt: l.lastViewedAt?.toISOString() ?? null,
    state: linkState(l, now),
  };
}

function screenshotView(s: {
  id: string;
  position: number;
  width: number;
  height: number;
  originalName: string | null;
  takenAt: Date | null;
  sourceSha256: string | null;
  blobUrl: string | null;
  crop: unknown;
  alignment: unknown;
  route: unknown;
  markers: unknown;
  routeLengthM: number | null;
}): RoundScreenshotView {
  return {
    id: s.id,
    position: s.position,
    width: s.width,
    height: s.height,
    originalName: s.originalName,
    takenAt: s.takenAt?.toISOString() ?? null,
    sha256: s.sourceSha256,
    stored: !!s.blobUrl,
    crop: (s.crop as Crop | null) ?? null,
    alignment: (s.alignment as Alignment | null) ?? null,
    route: (s.route as Lines | null) ?? null,
    markers: (s.markers as Markers | null) ?? null,
    routeLengthM: s.routeLengthM,
  };
}

// --- Reading -------------------------------------------------------------------------------

export async function listRounds(db: Db, filters: RoundFilters, limit = LIST_LIMIT): Promise<{ rounds: RoundSummary[]; more: boolean }> {
  const rows = await db.round.findMany({
    where: whereFor(filters),
    select: SUMMARY_SELECT,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: limit + 1,
  });
  return { rounds: rows.slice(0, limit).map(summaryOf), more: rows.length > limit };
}

export async function mapRounds(db: Db, filters: RoundFilters, limit = LIST_LIMIT): Promise<{ rounds: MapRound[]; more: boolean }> {
  const rows = await db.round.findMany({
    where: { ...whereFor(filters), screenshots: { some: { routeLengthM: { not: null } } } },
    select: {
      id: true,
      business: true,
      date: true,
      distanceM: true,
      sectors: true,
      lead: { select: { id: true, name: true, businessName: true } },
      distributor: { select: { id: true, name: true, mapColour: true } },
      screenshots: { select: { id: true, route: true, blobUrl: true }, orderBy: { position: "asc" } },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: limit + 1,
  });
  const rounds = rows.slice(0, limit).map(
    (r): MapRound => ({
      id: r.id,
      business: r.business,
      date: dateOnly(r.date),
      lead: r.lead ? { id: r.lead.id, name: leadName(r.lead) } : null,
      distributor: distributorOf(r.distributor),
      distanceM: r.distanceM,
      sectors: sectorsOf(r.sectors).map((s) => s.code),
      lines: r.screenshots.flatMap((s) => (Array.isArray(s.route) ? (s.route as Lines) : [])),
      screenshots: r.screenshots.map((s) => ({ id: s.id, stored: !!s.blobUrl })),
    })
  );
  return { rounds, more: rows.length > limit };
}

// Where a round's job is, to centre the alignment map on: its project's
// planned areas, else the lead's postcode sector or district, else the first
// postcode in its target areas.
export async function focusFor(db: Db, ids: { projectId: string | null; leadId: string | null }): Promise<[number, number, number, number] | null> {
  if (ids.projectId) {
    const areas = await db.plannedArea.findMany({ where: { projectId: ids.projectId }, select: { geometry: true } });
    const boxes = areas.map((a) => geometryBbox(a.geometry as unknown as AreaGeometry));
    if (boxes.length) return [Math.min(...boxes.map((b) => b[0])), Math.min(...boxes.map((b) => b[1])), Math.max(...boxes.map((b) => b[2])), Math.max(...boxes.map((b) => b[3]))];
  }
  if (ids.leadId) {
    const lead = await db.lead.findUnique({ where: { id: ids.leadId }, select: { postcode: true, targetAreas: true } });
    if (!lead) return null;
    const codes: string[] = [];
    const pc = lead.postcode?.toUpperCase().replace(/\s+/g, "") ?? "";
    const m = /^([A-Z]{1,2}\d[A-Z\d]?)(\d)[A-Z]{2}$/.exec(pc);
    if (m) codes.push(`${m[1]} ${m[2]}`, m[1]);
    for (const r of parsePostcodeList(lead.targetAreas ?? "").requests) codes.push(r.code);
    if (codes.length) {
      const known = new Map((await mappablePostcodes()).map((p) => [p.code, p.bbox]));
      for (const c of codes) {
        const box = known.get(c);
        if (box) return box;
      }
    }
  }
  return null;
}

export async function getRound(db: Db, id: string, now = new Date()): Promise<(RoundDetail & { focus: [number, number, number, number] | null }) | null> {
  const row = await db.round.findUnique({
    where: { id },
    select: {
      ...SUMMARY_SELECT,
      notes: true,
      createdAt: true,
      projectId: true,
      leadId: true,
      screenshots: {
        select: {
          id: true,
          position: true,
          width: true,
          height: true,
          originalName: true,
          takenAt: true,
          sourceSha256: true,
          blobUrl: true,
          crop: true,
          alignment: true,
          route: true,
          markers: true,
          routeLengthM: true,
        },
        orderBy: { position: "asc" },
      },
      reportLinks: { select: LINK_SELECT, orderBy: { createdAt: "desc" } },
    },
  });
  if (!row) return null;
  const linesFocus = linesBbox(row.screenshots.flatMap((s) => (Array.isArray(s.route) ? (s.route as Lines) : [])));
  const focus = linesFocus ?? (await focusFor(db, { projectId: row.projectId, leadId: row.leadId }));
  return {
    ...summaryOf(row),
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    shots: row.screenshots.map(screenshotView),
    links: row.reportLinks.map((l) => linkView(l, now)),
    focus,
  };
}

// The lead page's Rounds section: its rounds and its own report links.
export async function leadRounds(db: Db, leadId: string, now = new Date()): Promise<{ rounds: RoundSummary[]; links: ReportLinkView[] }> {
  const [rows, links] = await Promise.all([
    db.round.findMany({ where: { leadId }, select: SUMMARY_SELECT, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: LIST_LIMIT }),
    db.routeReportLink.findMany({ where: { leadId }, select: LINK_SELECT, orderBy: { createdAt: "desc" } }),
  ]);
  return { rounds: rows.map(summaryOf), links: links.map((l) => linkView(l, now)) };
}

export async function roundOptions(db: Db, storage: boolean): Promise<RoundOptions> {
  const [projects, leads, distributors, trimM] = await Promise.all([
    db.areaProject.findMany({
      select: { id: true, name: true, business: true, closedAt: true, leadId: true, lead: { select: { business: true, name: true, businessName: true } } },
      orderBy: [{ closedAt: { sort: "desc", nulls: "first" } }, { createdAt: "desc" }],
    }),
    db.lead.findMany({
      where: { stage: { in: [...WON_STAGES] }, scrapped: false, areaProject: null },
      select: { id: true, name: true, businessName: true, business: true },
      orderBy: [{ wonAt: { sort: "desc", nulls: "last" } }, { name: "asc" }],
      take: 300,
    }),
    db.distributor.findMany({
      where: { OR: [{ active: true }, { rounds: { some: {} } }] },
      select: { id: true, name: true, mapColour: true, active: true },
      orderBy: { name: "asc" },
    }),
    clientTrimM(db),
  ]);
  const jobs: JobOption[] = [
    ...projects.map((p) => ({
      key: `project:${p.id}`,
      label: `${p.name}${p.closedAt ? " (closed)" : ""}`,
      business: (p.lead?.business ?? p.business) as Business,
      leadId: p.leadId,
      projectId: p.id,
      bbox: null,
    })),
    ...leads.map((l) => ({ key: `lead:${l.id}`, label: leadName(l), business: l.business as Business, leadId: l.id, projectId: null, bbox: null })),
  ];
  return {
    jobs,
    distributors: distributors.map((d) => ({ id: d.id, name: d.name, colour: d.mapColour ?? UNASSIGNED_COLOUR, active: d.active })),
    storage,
    trimM,
  };
}

// --- Writing -------------------------------------------------------------------------------

// The lead and project a round is for, checked, and the business they set.
async function jobFor(tx: Tx, leadId: string | null, projectId: string | null, business: Business) {
  let lead = leadId;
  let biz = business;
  if (projectId) {
    const project = await tx.areaProject.findUnique({ where: { id: projectId }, select: { leadId: true, business: true, lead: { select: { business: true } } } });
    if (!project) throw new RoundsError("That project no longer exists.");
    if (lead && project.leadId && project.leadId !== lead) throw new RoundsError("That project is for a different lead.");
    lead = lead ?? project.leadId;
    biz = project.lead?.business ?? project.business;
  }
  if (lead) {
    const row = await tx.lead.findUnique({ where: { id: lead }, select: { business: true } });
    if (!row) throw new RoundsError("That lead no longer exists.");
    biz = row.business;
  }
  return { leadId: lead, projectId, business: biz };
}

// A distributor on a round must exist, and gets their map colour the first time.
async function checkDistributor(tx: Tx, distributorId: string) {
  const d = await tx.distributor.findUnique({ where: { id: distributorId }, select: { mapColour: true } });
  if (!d) throw new RoundsError("That distributor no longer exists.");
  if (!d.mapColour) {
    const taken = await tx.distributor.findMany({ where: { mapColour: { not: null } }, select: { mapColour: true } });
    await tx.distributor.updateMany({ where: { id: distributorId, mapColour: null }, data: { mapColour: nextMapColour(taken.map((t) => t.mapColour)) } });
  }
}

function screenshotData(s: NewScreenshot, position: number) {
  return {
    position,
    width: s.width,
    height: s.height,
    sourceSha256: s.sha256,
    originalName: s.originalName,
    takenAt: s.takenAt ? new Date(s.takenAt) : null,
  };
}

// The same file picked twice (by its fingerprint) is one screenshot: each
// later copy is mapped to the first. Files without a fingerprint are each
// their own.
function distinctShots(shots: NewScreenshot[]): { unique: NewScreenshot[]; indexOf: number[] } {
  const unique: NewScreenshot[] = [];
  const bySha = new Map<string, number>();
  const indexOf = shots.map((s) => {
    const seen = s.sha256 ? bySha.get(s.sha256) : undefined;
    if (seen !== undefined) return seen;
    unique.push(s);
    if (s.sha256) bySha.set(s.sha256, unique.length - 1);
    return unique.length - 1;
  });
  return { unique, indexOf };
}

const tooMany = () => new RoundsError(`A round can have at most ${MAX_SCREENSHOTS} screenshots.`);

// A round with its screenshots' details, all created in one statement each
// (the round, then every screenshot together), never one per screenshot.
// The ids come back in the order the screenshots were sent.
export async function createRound(db: Db, input: NewRound): Promise<{ id: string; screenshotIds: string[] }> {
  const { unique, indexOf } = distinctShots(input.screenshots);
  if (unique.length > MAX_SCREENSHOTS) throw tooMany();
  return db.$transaction(async (tx) => {
    const job = await jobFor(tx, input.leadId, input.projectId, input.business);
    if (input.distributorId) await checkDistributor(tx, input.distributorId);
    const round = await tx.round.create({
      data: {
        ...job,
        distributorId: input.distributorId,
        date: asDate(input.date),
        notes: input.notes,
        screenshots: { createMany: { data: unique.map((s, i) => screenshotData(s, i)) } },
      },
      select: { id: true, screenshots: { select: { id: true }, orderBy: { position: "asc" } } },
    });
    return { id: round.id, screenshotIds: indexOf.map((i) => round.screenshots[i].id) };
  });
}

export async function updateRound(db: Db, id: string, changes: RoundChanges): Promise<void> {
  await db.$transaction(async (tx) => {
    const current = await tx.round.findUnique({ where: { id }, select: { leadId: true, projectId: true, business: true } });
    if (!current) throw notFound();
    const data: Prisma.RoundUncheckedUpdateInput = {};
    if ("leadId" in changes || "projectId" in changes || "business" in changes) {
      const job = await jobFor(
        tx,
        "leadId" in changes ? changes.leadId! : current.leadId,
        "projectId" in changes ? changes.projectId! : current.projectId,
        changes.business ?? current.business
      );
      Object.assign(data, job);
    }
    if ("distributorId" in changes) {
      if (changes.distributorId) await checkDistributor(tx, changes.distributorId);
      data.distributorId = changes.distributorId;
    }
    if (changes.date) data.date = asDate(changes.date);
    if ("notes" in changes) data.notes = changes.notes;
    await tx.round.update({ where: { id }, data });
  });
}

async function removeFiles(storage: ScreenshotStorage, urls: (string | null)[]) {
  const stored = urls.filter((u): u is string => !!u);
  if (stored.length === 0) return;
  if (!storage.enabled) {
    console.warn(`Rounds: ${stored.length} stored screenshot file(s) left in file storage, as storage is switched off.`);
    return;
  }
  for (const url of stored) await storage.del(url);
}

export async function deleteRound(db: Db, storage: ScreenshotStorage, id: string): Promise<void> {
  const shots = await db.roundScreenshot.findMany({ where: { roundId: id }, select: { blobUrl: true } });
  await removeFiles(storage, shots.map((s) => s.blobUrl));
  const result = await db.round.deleteMany({ where: { id } });
  if (result.count === 0) throw notFound();
}

// More screenshots for a round, all created in one statement. One the round
// already has (the same file, by its fingerprint) isn't made again: its id
// is given back, so picking the same files again to carry on is safe. The
// ids come back in the order the screenshots were sent.
export async function addScreenshots(db: Db, roundId: string, shots: NewScreenshot[]): Promise<string[]> {
  const { unique, indexOf } = distinctShots(shots);
  return db.$transaction(async (tx) => {
    const round = await tx.round.findUnique({ where: { id: roundId }, select: { screenshots: { select: { id: true, position: true, sourceSha256: true } } } });
    if (!round) throw notFound();
    const known = new Map(round.screenshots.filter((s) => s.sourceSha256).map((s) => [s.sourceSha256!, s.id]));
    const fresh = unique.filter((s) => !(s.sha256 && known.has(s.sha256)));
    if (round.screenshots.length + fresh.length > MAX_SCREENSHOTS) throw tooMany();
    const start = Math.max(-1, ...round.screenshots.map((s) => s.position)) + 1;
    let made: string[] = [];
    if (fresh.length) {
      await tx.roundScreenshot.createMany({ data: fresh.map((s, i) => ({ roundId, ...screenshotData(s, start + i) })) });
      made = (await tx.roundScreenshot.findMany({ where: { roundId, position: { gte: start } }, select: { id: true }, orderBy: { position: "asc" } })).map((r) => r.id);
    }
    const freshIndex = new Map(fresh.map((s, i) => [s, i]));
    const uniqueIds = unique.map((s) => (s.sha256 && known.get(s.sha256)) || made[freshIndex.get(s)!]);
    return indexOf.map((i) => uniqueIds[i]);
  });
}

export async function deleteScreenshot(db: Db, storage: ScreenshotStorage, sid: string): Promise<void> {
  const shot = await db.roundScreenshot.findUnique({ where: { id: sid }, select: { roundId: true, blobUrl: true } });
  if (!shot) throw new RoundsError("That screenshot no longer exists.", 404);
  await removeFiles(storage, [shot.blobUrl]);
  await db.roundScreenshot.delete({ where: { id: sid } });
  await refreshRoundSummary(db, shot.roundId);
}

// What saving a screenshot's work changes: the crop, the alignment (worked
// out again here from the points, starting from the turn sent: the
// compass's, or one measured automatically), how it was lined up, the traced
// route and its start and end.
function workData(work: ScreenshotWork): Prisma.RoundScreenshotUpdateInput {
  const data: Prisma.RoundScreenshotUpdateInput = {};
  if (work.crop) data.crop = work.crop;
  if ("pairs" in work) {
    if (work.pairs === null) data.alignment = Prisma.DbNull;
    else {
      const solved = solveAlignment(work.pairs!, { turnDeg: work.turnDeg ?? null });
      if (!solved.ok) throw new RoundsError(solved.error);
      data.alignment = { ...solved.alignment, source: work.source ?? { kind: "hand" } } as unknown as Prisma.InputJsonValue;
    }
  }
  if ("route" in work) {
    if (work.route === null || work.route!.length === 0) {
      data.route = Prisma.DbNull;
      data.routeLengthM = null;
    } else {
      const lines = roundCoords(work.route!);
      data.route = lines as unknown as Prisma.InputJsonValue;
      data.routeLengthM = Math.round(lines.reduce((s, l) => s + lineLengthM(l), 0));
    }
  }
  if ("markers" in work) data.markers = work.markers ? (work.markers as unknown as Prisma.InputJsonValue) : Prisma.DbNull;
  return data;
}

const SHOT_SELECT = {
  id: true,
  position: true,
  width: true,
  height: true,
  originalName: true,
  takenAt: true,
  sourceSha256: true,
  blobUrl: true,
  crop: true,
  alignment: true,
  route: true,
  markers: true,
  routeLengthM: true,
} satisfies Prisma.RoundScreenshotSelect;

// One screenshot's work; then the round's distance and sectors afresh.
export async function saveScreenshotWork(db: Db, sid: string, work: ScreenshotWork): Promise<RoundScreenshotView> {
  const shot = await db.roundScreenshot.findUnique({ where: { id: sid }, select: { roundId: true } });
  if (!shot) throw new RoundsError("That screenshot no longer exists.", 404);
  const row = await db.roundScreenshot.update({ where: { id: sid }, data: workData(work), select: SHOT_SELECT });
  if ("route" in work) await refreshRoundSummary(db, shot.roundId);
  return screenshotView(row);
}

// Several screenshots of one round saved together (accepting automatic
// line-ups): every one checked first, all saved in one transaction, then
// the round's distance and sectors worked out once.
export async function saveScreenshotsWork(db: Db, roundId: string, items: { id: string; work: ScreenshotWork }[]): Promise<RoundScreenshotView[]> {
  const datas = items.map((item) => ({ id: item.id, data: workData(item.work) }));
  const rows = await db.$transaction(async (tx) => {
    const owned = await tx.roundScreenshot.findMany({ where: { roundId, id: { in: items.map((i) => i.id) } }, select: { id: true } });
    if (owned.length !== items.length) throw new RoundsError("A screenshot in the list isn't in this round.", 404);
    const out = [];
    for (const d of datas) out.push(await tx.roundScreenshot.update({ where: { id: d.id }, data: d.data, select: SHOT_SELECT }));
    return out;
  });
  if (items.some((i) => "route" in i.work)) await refreshRoundSummary(db, roundId);
  return rows.map(screenshotView);
}

export async function refreshRoundSummary(db: Db, roundId: string): Promise<void> {
  const shots = await db.roundScreenshot.findMany({ where: { roundId }, select: { route: true }, orderBy: { position: "asc" } });
  const lines = shots.map((s) => (Array.isArray(s.route) ? (s.route as Lines) : [])).filter((l) => l.length > 0);
  if (lines.length === 0) {
    await db.round.updateMany({ where: { id: roundId }, data: { distanceM: null, sectors: Prisma.DbNull } });
    return;
  }
  const sectors = await sectorsForLines(lines.flat());
  await db.round.updateMany({
    where: { id: roundId },
    data: { distanceM: Math.round(roundDistanceM(lines)), sectors: sectors as unknown as Prisma.InputJsonValue },
  });
}

// Attaching the image once storage is on: it must be a WebP or JPEG of the
// screenshot's working size, and the same file (by its fingerprint) where
// that was recorded.
export async function attachScreenshotFile(
  db: Db,
  storage: ScreenshotStorage,
  sid: string,
  file: { body: Buffer; sha256: string | null }
): Promise<void> {
  if (!storage.enabled) throw new RoundsError("Screenshot storage isn't switched on.", 409);
  const shot = await db.roundScreenshot.findUnique({ where: { id: sid }, select: { roundId: true, width: true, height: true, sourceSha256: true, blobUrl: true } });
  if (!shot) throw new RoundsError("That screenshot no longer exists.", 404);
  if (file.body.length === 0 || file.body.length > MAX_FILE_BYTES) throw new RoundsError("The image must be under 3 MB.");
  if (shot.sourceSha256 && file.sha256 && shot.sourceSha256 !== file.sha256) throw new RoundsError("That isn't the same screenshot file as the one this was traced from.");
  const meta = await sharp(file.body).metadata().catch(() => null);
  const type = meta?.format === "webp" ? "image/webp" : meta?.format === "jpeg" ? "image/jpeg" : null;
  if (!meta || !type || !(ALLOWED_TYPES as readonly string[]).includes(type)) throw new RoundsError("The image must be a WebP or JPEG.");
  if (meta.width !== shot.width || meta.height !== shot.height) throw new RoundsError("The image isn't the screenshot's size.");
  const stored = await storage.put(`rounds/${shot.roundId}/${sid}.${type === "image/webp" ? "webp" : "jpg"}`, file.body, type);
  await db.roundScreenshot.update({ where: { id: sid }, data: { blobUrl: stored.url, contentType: type, bytes: stored.bytes } });
  if (shot.blobUrl) await removeFiles(storage, [shot.blobUrl]);
}

export async function openScreenshotFile(db: Db, storage: ScreenshotStorage, sid: string): Promise<FileStream | null> {
  if (!storage.enabled) return null;
  const shot = await db.roundScreenshot.findUnique({ where: { id: sid }, select: { blobUrl: true } });
  if (!shot?.blobUrl) return null;
  return storage.get(shot.blobUrl);
}

// --- Client report links -------------------------------------------------------------------

export async function createReportLink(db: Db, input: NewLink): Promise<{ token: string; link: ReportLinkView }> {
  if (input.roundId) {
    const round = await db.round.findUnique({ where: { id: input.roundId }, select: { id: true } });
    if (!round) throw notFound();
  } else {
    const lead = await db.lead.findUnique({ where: { id: input.leadId! }, select: { id: true } });
    if (!lead) throw new RoundsError("That lead no longer exists.", 404);
  }
  const token = newShareToken();
  const link = await db.routeReportLink.create({
    data: {
      roundId: input.roundId,
      leadId: input.leadId,
      tokenHash: hashShareToken(token),
      expiresAt: input.expiresOn ? new Date(asDate(input.expiresOn).getTime() + DAY_MS) : null,
    },
    select: LINK_SELECT,
  });
  return { token, link: linkView(link, new Date()) };
}

export async function revokeReportLink(db: Db, id: string, now = new Date()): Promise<void> {
  const result = await db.routeReportLink.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: now } });
  if (result.count === 0) {
    const exists = await db.routeReportLink.count({ where: { id } });
    if (!exists) throw new RoundsError("That link no longer exists.", 404);
  }
}

async function liveLink(db: Db, token: unknown, now: Date) {
  if (!isShareTokenShaped(token)) return null;
  const link = await db.routeReportLink.findUnique({
    where: { tokenHash: hashShareToken(token) },
    select: { id: true, roundId: true, leadId: true, revokedAt: true, expiresAt: true, lastViewedAt: true },
  });
  if (!link || linkState(link, now) !== "active") return null;
  return link;
}

function scopeWhere(link: { roundId: string | null; leadId: string | null }): Prisma.RoundWhereInput {
  // A link always has exactly one of the two (the database checks it too).
  return link.roundId ? { id: link.roundId } : { leadId: link.leadId ?? "-" };
}

// The public report: the view for a live token, or null for anything else
// (unknown, revoked and expired all look the same).
export async function resolveReportToken(db: Db, token: unknown, now = new Date()): Promise<ReportView | null> {
  const link = await liveLink(db, token, now);
  if (!link) return null;
  const [rounds, lead, trimM] = await Promise.all([
    db.round.findMany({
      where: scopeWhere(link),
      select: {
        business: true,
        date: true,
        distanceM: true,
        sectors: true,
        lead: { select: { name: true, businessName: true, business: true } },
        screenshots: { select: { id: true, route: true, markers: true, blobUrl: true }, orderBy: { position: "asc" } },
      },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    }),
    link.leadId ? db.lead.findUnique({ where: { id: link.leadId }, select: { name: true, businessName: true, business: true } }) : null,
    clientTrimM(db),
  ]);
  const owner = lead ?? rounds[0]?.lead ?? null;
  if (!owner && rounds.length === 0) return null;
  const business = (lead?.business ?? rounds[0]?.business ?? "FDH") as Business;
  if (!link.lastViewedAt || now.getTime() - link.lastViewedAt.getTime() > REPORT_VIEW_NOTE_MS) {
    await db.routeReportLink.update({ where: { id: link.id }, data: { lastViewedAt: now } });
  }
  return buildReportView(
    {
      business,
      clientName: owner ? leadName(owner) : null,
      rounds: rounds.map((r) => ({
        date: r.date,
        distanceM: r.distanceM,
        sectors: r.sectors,
        screenshots: r.screenshots.map((s) => ({ id: s.id, route: s.route, markers: s.markers, stored: !!s.blobUrl })),
      })),
    },
    trimM
  );
}

// A stored screenshot on a report, only if it belongs to one of the link's rounds.
export async function reportScreenshotFile(db: Db, storage: ScreenshotStorage, token: unknown, sid: string, now = new Date()): Promise<FileStream | null> {
  if (!storage.enabled) return null;
  const link = await liveLink(db, token, now);
  if (!link) return null;
  const shot = await db.roundScreenshot.findFirst({ where: { id: sid, blobUrl: { not: null }, round: scopeWhere(link) }, select: { blobUrl: true } });
  return shot?.blobUrl ? storage.get(shot.blobUrl) : null;
}

// --- The privacy trim setting --------------------------------------------------------------

export async function clientTrimM(db: Db): Promise<number> {
  const row = await db.appSetting.findUnique({ where: { key: TRIM_SETTING }, select: { value: true } });
  const v = row?.value;
  return typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : DEFAULT_TRIM_M;
}

export async function setClientTrimM(db: Db, metres: number): Promise<void> {
  await db.appSetting.upsert({ where: { key: TRIM_SETTING }, create: { key: TRIM_SETTING, value: metres }, update: { value: metres } });
}
