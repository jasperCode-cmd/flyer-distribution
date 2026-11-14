import { imageToLngLat, MAX_ROTATION_DEG, type AlignmentSource, type PointPair, type Transform } from "./alignment";
import type { Crop, Point } from "./extract/image";
import { roundCoords, type LngLat, type Lines } from "./geometry";
import type { Sim } from "./match/similarity";
import type { Markers } from "./types";

// Turning an automatic match into a line-up and trace waiting for review,
// and the order screenshots are worked through in. Pure.

// A screenshot lined up and traced automatically, kept in the browser until
// it is accepted (then saved like any other) or skipped.
export type AutoDraft = {
  crop: Crop;
  // Four points spread over the map, with where the line-up puts them, and
  // the measured turn: saved as they are, the server's fit keeps the line-up exactly.
  pairs: PointPair[];
  turnDeg: number;
  source: Extract<AlignmentSource, { kind: "auto" }>;
  lines: Lines;
  markers: Markers;
  // How sure: 0 to 1, after the screenshot it was matched from (a chain is
  // only as sure as its least sure link).
  confidence: number;
  // Links back to a line-up by hand.
  depth: number;
  blocks: number;
  rmsPx: number;
  metresPerPixel: number;
  // The screenshot's corners on the map: top left, top right, bottom right, bottom left.
  footprint: LngLat[];
  lengthM: number;
};

// The new screenshot's fit on the map: the lined-up one's fit after the match (new pixels to its pixels).
export function composeTransform(t: Transform, m: Sim): Transform {
  const r = (t.rotationDeg * Math.PI) / 180;
  const a = t.scale * Math.cos(r);
  const b = t.scale * Math.sin(r);
  // (a + ib)(c + id), and the offset carried through.
  const c = a * m.c - b * m.d;
  const d = a * m.d + b * m.c;
  return {
    scale: Math.hypot(c, d),
    rotationDeg: (Math.atan2(d, c) * 180) / Math.PI,
    offsetX: a * m.tx - b * m.ty + t.offsetX,
    offsetY: b * m.tx + a * m.ty + t.offsetY,
  };
}

// Four points well inside the map part of the screenshot.
export function spreadPoints(width: number, crop: Crop): Point[] {
  const left = crop.left + (crop.right - crop.left) * 0.15;
  const right = crop.left + (crop.right - crop.left) * 0.85;
  const top = crop.top + (crop.bottom - crop.top) * 0.12;
  const bottom = crop.top + (crop.bottom - crop.top) * 0.82;
  return [
    [left, top],
    [right, top],
    [right, bottom],
    [left, bottom],
  ].map(([x, y]) => [Math.round(Math.min(width, x) * 100) / 100, Math.round(y * 100) / 100] as Point);
}

export function pairsFor(t: Transform, width: number, crop: Crop): PointPair[] {
  return spreadPoints(width, crop).map((p) => ({ image: p, map: imageToLngLat(t, p) }));
}

export function footprintOf(t: Transform, width: number, height: number): LngLat[] {
  return [
    [0, 0],
    [width, 0],
    [width, height],
    [0, height],
  ].map(([x, y]) => imageToLngLat(t, [x, y]));
}

// Whether a fit is one the server would take.
export function usableTurn(t: Transform): boolean {
  return Number.isFinite(t.rotationDeg) && Math.abs(t.rotationDeg) <= MAX_ROTATION_DEG;
}

// A trace in the screenshot's pixels, onto the map.
export function traceOnMap(t: Transform, lines: Point[][], start: Point | null, end: Point | null): { lines: Lines; markers: Markers } {
  return {
    lines: roundCoords(lines.map((l) => l.map((p) => imageToLngLat(t, p)))),
    markers: {
      ...(start ? { start: imageToLngLat(t, start) } : {}),
      ...(end ? { end: imageToLngLat(t, end) } : {}),
    },
  };
}

// Which screenshot to work on next: the one still to do that is nearest (in
// the round's order) to one already lined up, so a chain of overlapping
// screenshots grows outwards from those done by hand. -1 when none is left.
export function pickNext(todo: number[], lined: number[]): number {
  let best = -1;
  let bestGap = Infinity;
  todo.forEach((position, i) => {
    const gap = lined.length ? Math.min(...lined.map((l) => Math.abs(l - position))) : position;
    if (gap < bestGap) {
      bestGap = gap;
      best = i;
    }
  });
  return best;
}

// The lined-up screenshots to try matching against: the nearest few in the round's order.
export function nearest<T extends { position: number }>(position: number, lined: T[], count = 3): T[] {
  return [...lined].sort((a, b) => Math.abs(a.position - position) - Math.abs(b.position - position)).slice(0, count);
}

// What the review shows beside a draft.
export type DraftFlag = "low" | "no-route" | "turned";

export function flagsOf(d: AutoDraft, lowConfidence: number): DraftFlag[] {
  const flags: DraftFlag[] = [];
  if (d.confidence < lowConfidence) flags.push("low");
  if (d.lines.length === 0) flags.push("no-route");
  if (Math.abs(d.turnDeg) > 5) flags.push("turned");
  return flags;
}
