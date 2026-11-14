import type { LocateRecord, Transform } from "../alignment";
import { footprintOf, pairsFor, traceOnMap, type AutoDraft } from "../auto";
import type { Crop, Point } from "../extract/image";
import { linesLengthM } from "../geometry";

// Turning Locate's answer for one screenshot into a draft for the review
// grid, like an automatic line-up's: four points spread over the map with
// where the placement puts them, the traced route on the map, and what the
// call cost. Pure.

// What the Locate route answers (lib/rounds/locate/service).
export type LocateReply = {
  ok: boolean;
  reason: string;
  transform: Transform | null;
  confidence: number;
  names: string[];
  namesRead: number;
  rmsM: number | null;
  routeShare: number | null;
  metresPerPixel: number | null;
  costUsd: number;
  seconds: number;
  model: string | null;
  retryAfterS: number | null;
};

// What the browser worked out from the screenshot before asking.
export type PreparedShot = { width: number; height: number; crop: Crop; lines: Point[][]; start: Point | null; end: Point | null };

// What a call cost, to keep with the line-up (null when nothing was spent).
export function recordOf(reply: LocateReply): LocateRecord | null {
  if (!reply.model && !(reply.costUsd > 0)) return null;
  return { costUsd: reply.costUsd, seconds: reply.seconds, model: reply.model ?? "unknown", placed: reply.ok, names: reply.names.length };
}

// Two records for the same screenshot (Locate run again) added together.
export function addRecords(a: LocateRecord | null | undefined, b: LocateRecord | null | undefined): LocateRecord | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return { costUsd: Math.round((a.costUsd + b.costUsd) * 1e6) / 1e6, seconds: Math.round((a.seconds + b.seconds) * 10) / 10, model: b.model, placed: b.placed, names: b.names };
}

export function locatedDraft(shot: PreparedShot, reply: LocateReply, record: LocateRecord | null): AutoDraft {
  if (!reply.ok || !reply.transform) throw new Error("Not placed.");
  const transform = reply.transform;
  const onMap = traceOnMap(transform, shot.lines, shot.start, shot.end);
  const footprint = footprintOf(transform, shot.width, shot.height);
  const midLat = (footprint[0][1] + footprint[2][1]) / 2;
  return {
    crop: shot.crop,
    pairs: pairsFor(transform, shot.width, shot.crop),
    turnDeg: Math.round(transform.rotationDeg * 10000) / 10000,
    source: { kind: "located", confidence: reply.confidence, names: reply.names.length },
    lines: onMap.lines,
    markers: onMap.markers,
    confidence: reply.confidence,
    // As near a line-up by hand as a match to one: fine to match others to.
    depth: 1,
    blocks: reply.names.length,
    rmsPx: 0,
    metresPerPixel: Math.round(transform.scale * Math.cos((midLat * Math.PI) / 180) * 1000) / 1000,
    footprint,
    lengthM: Math.round(linesLengthM(onMap.lines)),
    located: { names: reply.names, namesRead: reply.namesRead, rmsM: reply.rmsM, routeShare: reply.routeShare },
    locate: record ?? undefined,
  };
}
