import { detectCrop } from "./crop";
import { clampCrop, scaleFor, type Crop, type Point, type RgbaImage } from "./image";
import { boxGrow, DEFAULT_TOLERANCE, dropBlobs, dropThick, findDots, lineWidthOf, routeMask } from "./mask";
import { close, thin } from "./skeleton";
import { totalLength, traceLines } from "./trace";

// Tracing a round's route from a MapMyRun screenshot, all in the browser
// (in a worker) and in the tests: crop off the top band, mask the route's
// blue, take out blue too thick to be the line (buttons floating over the
// map) and then icons and specks, thin it to a centre line, trace that into
// polylines and find the red start and green end dots. Image pixels in,
// image pixels out; the alignment turns them into map positions afterwards.

export type ExtractOptions = {
  // Where the map is; worked out from the image when not given.
  crop?: Crop;
  // How far from the route's blue a pixel may be and still count.
  tolerance?: number;
};

export type ExtractResult = {
  crop: Crop;
  lines: Point[][];
  start: Point | null;
  end: Point | null;
  stats: { routePixels: number; pieces: number; droppedBlobs: number; lengthPx: number };
};

// At full working size (about 1600px tall).
export const SPUR_PX = 14;
export const GAP_PX = 70;
export const MIN_LINE_PX = 30;
export const MAX_BRIDGE_ANGLE_DEG = 55;
export const LONG_GAP_PX = 240;
export const LONG_GAP_ANGLE_DEG = 15;
export const ALIGN_PX = 6;
// Gaps up to this many line widths are bridged on their angles alone. A
// longer one is bridged only where the image shows the line goes on: most
// of the gap is the route's blue (left out of the centre line only because
// it was too thick to keep there), or a street label lies along it (little
// blue showing, only between the letters, and lettering over at least
// LABEL_SHARE of it). A straight jump across other streets fails both: it
// crosses their blue, and lettering only here and there. Measured on the
// real MapMyRun screenshots: gaps under labels show at most 0.17 blue and
// at least 0.53 lettering; a jump on past a label's end, at most 0.40.
export const FREE_GAP_WIDTHS = 2.5;
export const BLUE_SHARE = 0.8;
export const HIDDEN_BLUE_SHARE = 0.2;
export const LABEL_SHARE = 0.5;
// The route's own white edge is not lettering: white this close to its
// blue doesn't count (at full working size).
const EDGE_PX = 3;
// The route's line width when it can't be measured (at full working size).
const USUAL_LINE_PX = 10;

// A label's lettering: white or nearly (thin strokes come out a little
// grey once scaled down), and not tinted.
function isWhite(r: number, g: number, b: number): boolean {
  const lo = Math.min(r, g, b);
  return lo >= 190 && Math.max(r, g, b) - lo <= 40;
}

// Whether the image shows the route going on across the straight gap from p
// to q. The ends themselves (a line width at each) are left out: that is
// where the traced line stops, and its blue carries on a little.
export function gapEvidence(img: RgbaImage, mask: Uint8Array, lineWidth: number) {
  const { width, height, data } = img;
  const nearBlue = boxGrow(mask, width, height, Math.max(1, Math.round(EDGE_PX * scaleFor(img))));
  const half = Math.ceil(lineWidth / 2) + 1;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= width || y >= height ? -1 : y * width + x);
  return (p: Point, q: Point): boolean => {
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const ux = (q[0] - p[0]) / len;
    const uy = (q[1] - p[1]) / len;
    let steps = 0;
    let blue = 0;
    let letters = 0;
    for (let s = lineWidth; s <= len - lineWidth; s++) {
      const cx = p[0] + ux * s;
      const cy = p[1] + uy * s;
      steps++;
      let isBlue = false;
      for (let o = -1; o <= 1 && !isBlue; o++) {
        const i = at(Math.round(cx - uy * o), Math.round(cy + ux * o));
        if (i >= 0 && mask[i]) isBlue = true;
      }
      if (isBlue) blue++;
      for (let o = -half; o <= half; o++) {
        const i = at(Math.round(cx - uy * o), Math.round(cy + ux * o));
        if (i >= 0 && !nearBlue[i] && isWhite(data[i * 4], data[i * 4 + 1], data[i * 4 + 2])) {
          letters++;
          break;
        }
      }
    }
    if (steps === 0) return true;
    const blueShare = blue / steps;
    return blueShare >= BLUE_SHARE || (blueShare <= HIDDEN_BLUE_SHARE && letters / steps >= LABEL_SHARE);
  };
}
export const SIMPLIFY_PX = 1.2;

export function extractRoute(img: RgbaImage, options: ExtractOptions = {}): ExtractResult {
  const crop = clampCrop(img, options.crop ?? detectCrop(img));
  const k = scaleFor(img);
  const mask = routeMask(img, crop, options.tolerance ?? DEFAULT_TOLERANCE);
  const dots = findDots(img, crop, mask);
  let routePixels = 0;
  for (let i = 0; i < mask.length; i++) routePixels += mask[i];
  const lineWidth = lineWidthOf(mask, img.width, img.height) ?? USUAL_LINE_PX * k;
  const slim = dropThick(mask, img, lineWidth);
  const blobs = dropBlobs(slim.mask, img);
  const skeleton = thin(close(blobs.kept, img.width, img.height), img.width, img.height);
  const lines = traceLines(skeleton, img.width, img.height, {
    spurPx: SPUR_PX * k,
    gapPx: GAP_PX * k,
    maxBridgeAngleDeg: MAX_BRIDGE_ANGLE_DEG,
    longGapPx: LONG_GAP_PX * k,
    longGapAngleDeg: LONG_GAP_ANGLE_DEG,
    alignPx: ALIGN_PX * k,
    freeGapPx: FREE_GAP_WIDTHS * lineWidth,
    evidence: gapEvidence(img, mask, lineWidth),
    minLengthPx: MIN_LINE_PX * k,
    simplifyPx: SIMPLIFY_PX,
  });
  return {
    crop,
    lines,
    start: dots.start,
    end: dots.end,
    stats: { routePixels, pieces: lines.length, droppedBlobs: blobs.removed, lengthPx: Math.round(totalLength(lines)) },
  };
}

export { detectCrop } from "./crop";
export type { Crop, Point, RgbaImage } from "./image";
