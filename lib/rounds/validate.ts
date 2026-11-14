import { isBusiness, type Business } from "@/lib/business";
import { MAX_ROTATION_DEG, type AlignmentSource, type LocateRecord, type PointPair } from "./alignment";
import type { Point } from "./extract/image";
import type { Crop } from "./extract/image";
import type { LngLat, Lines } from "./geometry";
import type { Markers, RoundFilters } from "./types";

// Checking what the browser sends the Rounds API. Pure, so the pages use the
// same limits. Anything not understood is refused with a plain reason.

// Screenshots in one round, and in one upload (they are created together,
// in one request).
export const MAX_SCREENSHOTS = 100;
// The distributor filter's value for rounds with no distributor recorded.
export const NOT_SPECIFIED_FILTER = "none";
export const MAX_NOTES = 2000;
export const MAX_NAME = 200;
export const MAX_IMAGE_SIDE = 4000;
export const MAX_ROUTE_POINTS = 20000;
export const MAX_ROUTE_LINES = 400;
export const MIN_TRIM_M = 0;
export const MAX_TRIM_M = 1000;
export const DEFAULT_TRIM_M = 150;
// Roughly Great Britain: anything outside is a mistake.
const BOUNDS = { west: -9, east: 3, south: 49, north: 61 };

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string };
const fail = <T>(error: string): Checked<T> => ({ ok: false, error });
const okay = <T>(value: T): Checked<T> => ({ ok: true, value });

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const SHA256 = /^[0-9a-f]{64}$/;
const ID = /^[a-z0-9]{10,40}$/i;

export function isDateOnly(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const m = DATE.exec(value);
  if (!m) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value && Number(m[1]) >= 2000 && Number(m[1]) <= 2100;
}

export function isId(value: unknown): value is string {
  return typeof value === "string" && ID.test(value);
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const intIn = (v: unknown, min: number, max: number): v is number => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

function optionalId(v: unknown, what: string): Checked<string | null> {
  if (v === undefined || v === null || v === "") return okay(null);
  return isId(v) ? okay(v) : fail(`That ${what} isn't valid.`);
}

function notes(v: unknown): Checked<string | null> {
  if (v === undefined || v === null) return okay(null);
  if (typeof v !== "string") return fail("Notes must be text.");
  const t = v.trim();
  if (t.length > MAX_NOTES) return fail(`Notes can be at most ${MAX_NOTES} characters.`);
  return okay(t || null);
}

export type NewScreenshot = { width: number; height: number; sha256: string | null; originalName: string | null; takenAt: string | null };

function screenshot(v: unknown): Checked<NewScreenshot> {
  if (!isObject(v)) return fail("A screenshot's details are missing.");
  if (!intIn(v.width, 1, MAX_IMAGE_SIDE) || !intIn(v.height, 1, MAX_IMAGE_SIDE)) return fail("A screenshot's size isn't valid.");
  if (v.sha256 !== undefined && v.sha256 !== null && !(typeof v.sha256 === "string" && SHA256.test(v.sha256))) return fail("A screenshot's fingerprint isn't valid.");
  const name = typeof v.originalName === "string" ? v.originalName.trim().slice(0, MAX_NAME) || null : null;
  let takenAt: string | null = null;
  if (v.takenAt !== undefined && v.takenAt !== null) {
    if (typeof v.takenAt !== "string" || Number.isNaN(Date.parse(v.takenAt))) return fail("A screenshot's time isn't valid.");
    takenAt = new Date(v.takenAt).toISOString();
  }
  return okay({ width: v.width, height: v.height, sha256: (v.sha256 as string | null | undefined) ?? null, originalName: name, takenAt });
}

export type NewRound = {
  business: Business;
  leadId: string | null;
  projectId: string | null;
  distributorId: string | null;
  date: string;
  notes: string | null;
  screenshots: NewScreenshot[];
};

export function validateNewRound(body: unknown): Checked<NewRound> {
  if (!isObject(body)) return fail("Nothing was sent.");
  if (!isBusiness(body.business)) return fail("Choose FDH or LDB.");
  if (!isDateOnly(body.date)) return fail("Choose the date of the round.");
  const lead = optionalId(body.leadId, "lead");
  const project = optionalId(body.projectId, "project");
  const distributor = optionalId(body.distributorId, "distributor");
  const n = notes(body.notes);
  for (const c of [lead, project, distributor, n]) if (!c.ok) return fail(c.error);
  if (!Array.isArray(body.screenshots) || body.screenshots.length === 0) return fail("Add at least one screenshot.");
  if (body.screenshots.length > MAX_SCREENSHOTS) return fail(`A round can have at most ${MAX_SCREENSHOTS} screenshots.`);
  const shots: NewScreenshot[] = [];
  for (const s of body.screenshots) {
    const c = screenshot(s);
    if (!c.ok) return fail(c.error);
    shots.push(c.value);
  }
  return okay({
    business: body.business,
    leadId: (lead as { value: string | null }).value,
    projectId: (project as { value: string | null }).value,
    distributorId: (distributor as { value: string | null }).value,
    date: body.date,
    notes: (n as { value: string | null }).value,
    screenshots: shots,
  });
}

export function validateNewScreenshots(body: unknown): Checked<NewScreenshot[]> {
  if (!isObject(body) || !Array.isArray(body.screenshots) || body.screenshots.length === 0) return fail("Add at least one screenshot.");
  if (body.screenshots.length > MAX_SCREENSHOTS) return fail(`Add at most ${MAX_SCREENSHOTS} at a time.`);
  const out: NewScreenshot[] = [];
  for (const s of body.screenshots) {
    const c = screenshot(s);
    if (!c.ok) return fail(c.error);
    out.push(c.value);
  }
  return okay(out);
}

export type RoundChanges = Partial<{
  business: Business;
  leadId: string | null;
  projectId: string | null;
  distributorId: string | null;
  date: string;
  notes: string | null;
}>;

export function validateRoundChanges(body: unknown): Checked<RoundChanges> {
  if (!isObject(body)) return fail("Nothing was sent.");
  const out: RoundChanges = {};
  if ("business" in body) {
    if (!isBusiness(body.business)) return fail("Choose FDH or LDB.");
    out.business = body.business;
  }
  for (const [key, what] of [
    ["leadId", "lead"],
    ["projectId", "project"],
    ["distributorId", "distributor"],
  ] as const) {
    if (!(key in body)) continue;
    const c = optionalId(body[key], what);
    if (!c.ok) return fail(c.error);
    out[key] = c.value;
  }
  if ("date" in body) {
    if (!isDateOnly(body.date)) return fail("Choose the date of the round.");
    out.date = body.date;
  }
  if ("notes" in body) {
    const n = notes(body.notes);
    if (!n.ok) return fail(n.error);
    out.notes = n.value;
  }
  if (Object.keys(out).length === 0) return fail("Nothing to change.");
  return okay(out);
}

function lngLat(v: unknown): v is LngLat {
  return (
    Array.isArray(v) &&
    v.length === 2 &&
    typeof v[0] === "number" &&
    typeof v[1] === "number" &&
    v[0] >= BOUNDS.west &&
    v[0] <= BOUNDS.east &&
    v[1] >= BOUNDS.south &&
    v[1] <= BOUNDS.north
  );
}

export function validateRoute(v: unknown): Checked<Lines> {
  if (!Array.isArray(v)) return fail("The route isn't valid.");
  if (v.length > MAX_ROUTE_LINES) return fail("The route has too many pieces. Erase the stray bits and try again.");
  let points = 0;
  const lines: Lines = [];
  for (const line of v) {
    if (!Array.isArray(line) || line.length < 2) return fail("The route isn't valid.");
    for (const p of line) if (!lngLat(p)) return fail("The route goes outside Great Britain. Check the alignment.");
    points += line.length;
    lines.push(line.map((p) => [p[0], p[1]] as LngLat));
  }
  if (points > MAX_ROUTE_POINTS) return fail("The route is too detailed to save.");
  return okay(lines);
}

export type ScreenshotWork = {
  crop?: Crop;
  pairs?: PointPair[] | null;
  // The turn to start the fit from: the compass's, or one measured automatically.
  turnDeg?: number | null;
  source?: AlignmentSource;
  locate?: LocateRecord;
  route?: Lines | null;
  markers?: Markers | null;
};

export function validateScreenshotWork(body: unknown, size: { width: number; height: number }): Checked<ScreenshotWork> {
  if (!isObject(body)) return fail("Nothing was sent.");
  const out: ScreenshotWork = {};
  if ("crop" in body) {
    const c = body.crop;
    if (!isObject(c) || ![c.top, c.bottom, c.left, c.right].every((n) => typeof n === "number" && Number.isInteger(n))) return fail("The crop isn't valid.");
    const crop = c as Crop;
    if (crop.top < 0 || crop.left < 0 || crop.bottom > size.height || crop.right > size.width || crop.top >= crop.bottom || crop.left >= crop.right) {
      return fail("The crop is outside the screenshot.");
    }
    out.crop = { top: crop.top, bottom: crop.bottom, left: crop.left, right: crop.right };
  }
  if ("pairs" in body) {
    if (body.pairs === null) out.pairs = null;
    else {
      if (!Array.isArray(body.pairs) || body.pairs.length < 2 || body.pairs.length > 4) return fail("Click two points on each.");
      const pairs: PointPair[] = [];
      for (const p of body.pairs) {
        if (!isObject(p) || !Array.isArray(p.image) || p.image.length !== 2 || !lngLat(p.map)) return fail("A point isn't valid.");
        const [x, y] = p.image as unknown[];
        if (typeof x !== "number" || typeof y !== "number" || x < 0 || y < 0 || x > size.width || y > size.height) return fail("A point is off the screenshot.");
        pairs.push({ image: [x, y], map: [p.map[0], p.map[1]] });
      }
      out.pairs = pairs;
    }
  }
  if ("turnDeg" in body && body.turnDeg !== null && body.turnDeg !== undefined) {
    if (typeof body.turnDeg !== "number" || !Number.isFinite(body.turnDeg) || Math.abs(body.turnDeg) > MAX_ROTATION_DEG) return fail(`The map can be turned at most ${MAX_ROTATION_DEG} degrees.`);
    out.turnDeg = body.turnDeg;
  }
  if ("source" in body && body.source !== null && body.source !== undefined) {
    const src = body.source;
    if (!isObject(src)) return fail("How the line-up was made isn't valid.");
    if (src.kind === "hand") out.source = { kind: "hand" };
    else if (src.kind === "auto" && typeof src.confidence === "number" && src.confidence >= 0 && src.confidence <= 1 && (src.from === null || src.from === undefined || isId(src.from))) {
      out.source = { kind: "auto", confidence: Math.round(src.confidence * 1000) / 1000, from: (src.from as string | undefined) ?? null };
    } else if (src.kind === "located" && typeof src.confidence === "number" && src.confidence >= 0 && src.confidence <= 1 && Number.isInteger(src.names) && (src.names as number) >= 0 && (src.names as number) <= 100) {
      out.source = { kind: "located", confidence: Math.round(src.confidence * 1000) / 1000, names: src.names as number };
    } else return fail("How the line-up was made isn't valid.");
  }
  if ("locate" in body && body.locate !== null && body.locate !== undefined) {
    const l = body.locate;
    if (
      !isObject(l) ||
      typeof l.costUsd !== "number" ||
      !(l.costUsd >= 0 && l.costUsd <= 10) ||
      typeof l.seconds !== "number" ||
      !(l.seconds >= 0 && l.seconds <= 600) ||
      typeof l.model !== "string" ||
      !/^[a-z0-9.-]{1,60}$/.test(l.model) ||
      typeof l.placed !== "boolean" ||
      !Number.isInteger(l.names) ||
      (l.names as number) < 0 ||
      (l.names as number) > 100
    )
      return fail("Locate's record isn't valid.");
    out.locate = { costUsd: Math.round(l.costUsd * 1e6) / 1e6, seconds: Math.round(l.seconds * 10) / 10, model: l.model, placed: l.placed, names: l.names as number };
  }
  if ("route" in body) {
    if (body.route === null) out.route = null;
    else {
      const r = validateRoute(body.route);
      if (!r.ok) return fail(r.error);
      out.route = r.value;
    }
  }
  if ("markers" in body) {
    if (body.markers === null) out.markers = null;
    else {
      if (!isObject(body.markers)) return fail("The start and end aren't valid.");
      const m: Markers = {};
      for (const key of ["start", "end"] as const) {
        const v = body.markers[key];
        if (v === undefined || v === null) continue;
        if (!lngLat(v)) return fail("The start and end aren't valid.");
        m[key] = [v[0], v[1]];
      }
      out.markers = m;
    }
  }
  if (Object.keys(out).length === 0) return fail("Nothing to save.");
  return okay(out);
}

// Several screenshots' work saved together (accepting automatic line-ups).
export type ScreenshotWorkItem = { id: string; body: unknown };

export function validateWorkBatch(body: unknown): Checked<ScreenshotWorkItem[]> {
  if (!isObject(body) || !Array.isArray(body.items) || body.items.length === 0) return fail("Nothing to save.");
  if (body.items.length > MAX_SCREENSHOTS) return fail(`Save at most ${MAX_SCREENSHOTS} at a time.`);
  const seen = new Set<string>();
  const out: ScreenshotWorkItem[] = [];
  for (const item of body.items) {
    if (!isObject(item) || !isId(item.id) || seen.has(item.id)) return fail("A screenshot in the list isn't valid.");
    seen.add(item.id);
    out.push({ id: item.id, body: item.work });
  }
  return okay(out);
}

export type NewLink = { roundId: string | null; leadId: string | null; expiresOn: string | null };

export function validateNewLink(body: unknown, today: string): Checked<NewLink> {
  if (!isObject(body)) return fail("Nothing was sent.");
  const round = optionalId(body.roundId, "round");
  const lead = optionalId(body.leadId, "lead");
  if (!round.ok) return fail(round.error);
  if (!lead.ok) return fail(lead.error);
  if (!!round.value === !!lead.value) return fail("Share either one round or one lead's rounds.");
  let expiresOn: string | null = null;
  if (body.expiresOn !== undefined && body.expiresOn !== null && body.expiresOn !== "") {
    if (!isDateOnly(body.expiresOn)) return fail("The expiry date isn't valid.");
    if (body.expiresOn < today) return fail("The expiry date has already passed.");
    expiresOn = body.expiresOn;
  }
  return okay({ roundId: round.value, leadId: lead.value, expiresOn });
}

export function validateTrim(body: unknown): Checked<number> {
  if (!isObject(body) || !intIn(body.trimM, MIN_TRIM_M, MAX_TRIM_M)) return fail(`Enter a whole number of metres from ${MIN_TRIM_M} to ${MAX_TRIM_M}.`);
  return okay(body.trimM);
}

// From an address bar: anything not understood is left out.
export function parseFilters(params: URLSearchParams): RoundFilters {
  const out: RoundFilters = {};
  const from = params.get("from");
  const to = params.get("to");
  if (isDateOnly(from)) out.from = from;
  if (isDateOnly(to)) out.to = to;
  const business = params.get("business");
  if (isBusiness(business)) out.business = business;
  for (const key of ["leadId", "distributorId", "projectId"] as const) {
    const v = params.get(key);
    if (isId(v)) out[key] = v;
  }
  // "Not specified": rounds with no distributor.
  if (params.get("distributorId") === NOT_SPECIFIED_FILTER) out.distributorId = null;
  return out;
}

// What the browser sends with a screenshot for Locate, besides the image:
// the compass's turn where it shows, and points along its traced route.
export const MAX_LOCATE_ROUTE_POINTS = 4000;
export const MAX_LOCATE_IMAGE_BYTES = 3 * 1024 * 1024;
export type LocateMeta = { compassTurn: number | null; route: Point[] };

export function validateLocateMeta(body: unknown, size: { width: number; height: number }): Checked<LocateMeta> {
  if (!isObject(body)) return fail("Nothing was sent.");
  const turn = body.compassTurn;
  if (turn !== null && turn !== undefined && (typeof turn !== "number" || !Number.isFinite(turn) || Math.abs(turn) > 45)) return fail("The compass reading isn't valid.");
  if (!Array.isArray(body.route) || body.route.length > MAX_LOCATE_ROUTE_POINTS) return fail("The route points aren't valid.");
  const route: Point[] = [];
  for (const p of body.route) {
    if (!Array.isArray(p) || p.length !== 2) return fail("The route points aren't valid.");
    const [x, y] = p as unknown[];
    if (typeof x !== "number" || typeof y !== "number" || !(x >= 0 && x <= size.width && y >= 0 && y <= size.height)) return fail("A route point is off the screenshot.");
    route.push([x, y]);
  }
  return okay({ compassTurn: typeof turn === "number" ? turn : null, route });
}
