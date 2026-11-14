import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { imageToMercator } from "../alignment";
import type { Point } from "../extract/image";
import { RoundsError } from "../service";
import { areaBoxes, areaLatitude, insideAreas } from "./area";
import type { LocateReply } from "./draft";
import { locate } from "./fit";
import { readLabels, type ReadResult } from "./read-labels";
import { LOCATE_MODEL } from "./pricing";
import { roadsIn } from "./roads";

// Locate for one screenshot of a round: the job's area (the round's Area
// Planner project, or else its lead's), the street names read by Claude, the
// streets in that area, and the fit. Nothing is saved here: the browser keeps
// the result as a draft for review, and its cost and time go into the
// line-up when it is saved.

export type LocateInputs = { image: Buffer; compassTurn: number | null; route: Point[] };

// What it cost and how long it took go in the batch's running total; when
// the API was busy, retryAfterS says how long to wait before the next one.
export type LocateOutcome = LocateReply;

type Reader = (image: Buffer, width: number, height: number) => Promise<ReadResult>;

export async function locateScreenshot(db: PrismaClient, shotId: string, inputs: LocateInputs, read: Reader = readLabels): Promise<LocateOutcome> {
  const started = Date.now();
  const shot = await db.roundScreenshot.findUnique({
    where: { id: shotId },
    select: { width: true, height: true, round: { select: { leadId: true, project: { select: { areas: { select: { geometry: true } } } } } } },
  });
  if (!shot) throw new RoundsError("That screenshot no longer exists.", 404);
  let areas = shot.round.project?.areas ?? [];
  if (!areas.length && shot.round.leadId) {
    const project = await db.areaProject.findUnique({ where: { leadId: shot.round.leadId }, select: { areas: { select: { geometry: true } } } });
    areas = project?.areas ?? [];
  }
  const outcome = (o: Partial<LocateOutcome> & { reason: string }): LocateOutcome => ({
    ok: false,
    transform: null,
    confidence: 0,
    names: [],
    namesRead: 0,
    rmsM: null,
    routeShare: null,
    metresPerPixel: null,
    costUsd: 0,
    model: null,
    retryAfterS: null,
    ...o,
    seconds: Math.round((Date.now() - started) / 100) / 10,
  });
  const boxes = areaBoxes(areas.map((a) => a.geometry));
  if (!boxes.length) return outcome({ reason: "This job has no Area Planner areas to look in; add them, or line it up by hand" });

  const reading = await read(inputs.image, shot.width, shot.height);
  if (!reading.ok) return outcome({ reason: reading.reason, costUsd: reading.costUsd, model: reading.model, retryAfterS: reading.retryAfterS });
  const roads = await roadsIn(boxes);
  const middle: Point = [shot.width / 2, shot.height * 0.56];
  const fit = locate({ labels: reading.labels, roads, latitude: areaLatitude(boxes), compassTurn: inputs.compassTurn, route: inputs.route, middle });
  const base = { costUsd: reading.costUsd, model: reading.model ?? LOCATE_MODEL, names: fit.names, namesRead: fit.namesRead, rmsM: fit.rmsM, routeShare: fit.routeShare, metresPerPixel: fit.metresPerPixel };
  if (!fit.ok || !fit.transform) return outcome({ ...base, reason: fit.reason });
  // The screenshot's middle has to land inside the job's area.
  if (!insideAreas(boxes, imageToMercator(fit.transform, middle))) return outcome({ ...base, reason: "It would land outside this job's area" });
  return outcome({ ...base, ok: true, reason: "Placed", transform: fit.transform, confidence: fit.confidence });
}
