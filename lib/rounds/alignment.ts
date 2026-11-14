// Lining a route screenshot up with the map, from points clicked on both:
// pure maths, shared by the browser and the server (which works the fit out
// again from the points, never trusting a fit it is sent). No imports.
//
// Both the screenshot and the map are Web Mercator, so a fit is a scale, a
// turn and an offset. The turn is known first where it can be: north-up (0)
// normally, or what Apple's compass shows when the map was turned. With the
// turn held, a fit misses both pairs by the same amount (it splits the
// difference), so "every pair needs a different turn" means that miss is
// more than a few pixels: the turn is then fitted too, up to
// MAX_ROTATION_DEG either way. Anything more means a point was clicked in the
// wrong place and is reported instead. A line-up found automatically sends
// its own measured turn, so its fit is kept exactly.

export type ImagePoint = [x: number, y: number];
export type LngLat = [lng: number, lat: number];
export type PointPair = { image: ImagePoint; map: LngLat };

export type Transform = {
  // Web Mercator metres (y pointing south) per image pixel, before rotation.
  scale: number;
  // Clockwise, in degrees; 0 for a north-up fit.
  rotationDeg: number;
  // Where the image's top left corner (0, 0) lands, in Web Mercator metres.
  offsetX: number;
  offsetY: number;
};

// How a line-up was made, kept with it: by hand, or found automatically by
// matching the screenshot to one already lined up (and how sure that was).
export type AlignmentSource = { kind: "hand" } | { kind: "auto"; confidence: number; from: string | null };

export type Alignment = {
  pairs: PointPair[];
  transform: Transform;
  // How far each pair's map point is from where the fit puts its image
  // point, in image pixels.
  errorsPx: number[];
  // Ground distance per image pixel where the screenshot is, in metres.
  metresPerPixel: number;
  rotated: boolean;
  // The turn the fit started from (the compass's, or 0), when not 0.
  preferredTurnDeg?: number;
  source?: AlignmentSource;
};

export type AlignmentResult = { ok: true; alignment: Alignment } | { ok: false; error: string; errorsPx?: number[] };

// A click can be a few pixels out; more than this, every pair, and the fit
// may turn.
export const NORTH_UP_TOLERANCE_PX = 4;
export const MAX_ROTATION_DEG = 30;
// Points closer than this on the screenshot can't give a reliable fit.
export const MIN_PAIR_SEPARATION_PX = 60;
// What a phone map of a delivery round can show, in metres per pixel.
export const MIN_METRES_PER_PIXEL = 0.02;
export const MAX_METRES_PER_PIXEL = 50;

const EARTH_RADIUS_M = 6378137;
const MAX_LAT = 85.05112878;

// Longitude and latitude to Web Mercator metres, with y pointing south so it
// runs the same way as image rows.
export function toMercator([lng, lat]: LngLat): [number, number] {
  const clamped = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));
  const x = (EARTH_RADIUS_M * lng * Math.PI) / 180;
  const y = -EARTH_RADIUS_M * Math.log(Math.tan(Math.PI / 4 + (clamped * Math.PI) / 360));
  return [x, y];
}

export function fromMercator([x, y]: [number, number]): LngLat {
  const lng = (x / EARTH_RADIUS_M) * (180 / Math.PI);
  const lat = (2 * Math.atan(Math.exp(-y / EARTH_RADIUS_M)) - Math.PI / 2) * (180 / Math.PI);
  return [lng, lat];
}

// The complex number a = scale * e^(i * rotation), as [re, im].
function factor(t: Transform): [number, number] {
  const r = (t.rotationDeg * Math.PI) / 180;
  return [t.scale * Math.cos(r), t.scale * Math.sin(r)];
}

export function imageToMercator(t: Transform, [x, y]: ImagePoint): [number, number] {
  const [a, b] = factor(t);
  return [a * x - b * y + t.offsetX, b * x + a * y + t.offsetY];
}

export function mercatorToImage(t: Transform, [mx, my]: [number, number]): ImagePoint {
  const [a, b] = factor(t);
  const dx = mx - t.offsetX;
  const dy = my - t.offsetY;
  const d = a * a + b * b;
  return [(a * dx + b * dy) / d, (a * dy - b * dx) / d];
}

export function imageToLngLat(t: Transform, point: ImagePoint): LngLat {
  return fromMercator(imageToMercator(t, point));
}

export function lngLatToImage(t: Transform, point: LngLat): ImagePoint {
  return mercatorToImage(t, toMercator(point));
}

function centroid(points: [number, number][]): [number, number] {
  const n = points.length;
  return [points.reduce((s, p) => s + p[0], 0) / n, points.reduce((s, p) => s + p[1], 0) / n];
}

// The best fit by least squares: with the turn held at `turnDeg` (scale and
// offset only), or with the turn fitted too (a similarity transform).
function fit(pairs: PointPair[], rotate: boolean, turnDeg = 0): Transform | null {
  const img = pairs.map((p) => p.image as [number, number]);
  const map = pairs.map((p) => toMercator(p.map));
  const [cx, cy] = centroid(img);
  const [mx, my] = centroid(map);
  let dot = 0;
  let cross = 0;
  let norm = 0;
  for (let i = 0; i < pairs.length; i++) {
    const px = img[i][0] - cx;
    const py = img[i][1] - cy;
    const qx = map[i][0] - mx;
    const qy = map[i][1] - my;
    dot += px * qx + py * qy;
    cross += px * qy - py * qx;
    norm += px * px + py * py;
  }
  if (norm === 0) return null;
  let a: number;
  let b: number;
  if (rotate) {
    a = dot / norm;
    b = cross / norm;
  } else {
    // The scale along the held turn; a mirror image or a map upside down
    // compared with it isn't a phone screenshot.
    const r = (turnDeg * Math.PI) / 180;
    const along = (dot * Math.cos(r) + cross * Math.sin(r)) / norm;
    if (along <= 0) return null;
    a = along * Math.cos(r);
    b = along * Math.sin(r);
  }
  const scale = Math.hypot(a, b);
  if (!(scale > 0)) return null;
  const rotationDeg = rotate ? (Math.atan2(b, a) * 180) / Math.PI : turnDeg;
  return { scale, rotationDeg, offsetX: mx - (a * cx - b * cy), offsetY: my - (b * cx + a * cy) };
}

function errorsOf(t: Transform, pairs: PointPair[]): number[] {
  return pairs.map((p) => {
    const [x, y] = lngLatToImage(t, p.map);
    return Math.hypot(x - p.image[0], y - p.image[1]);
  });
}

const round = (n: number, places: number) => Math.round(n * 10 ** places) / 10 ** places;

export type SolveOptions = {
  // The turn to start from (clockwise, degrees, as in Transform): what the
  // compass shows, or a turn measured automatically. North-up when absent.
  turnDeg?: number | null;
};

export function solveAlignment(pairs: PointPair[], options: SolveOptions = {}): AlignmentResult {
  if (pairs.length < 2) return { ok: false, error: "Click two points on the screenshot and the same two on the map." };
  const preferred = options.turnDeg ?? 0;
  if (!Number.isFinite(preferred) || Math.abs(preferred) > MAX_ROTATION_DEG) return { ok: false, error: `The map can be turned at most ${MAX_ROTATION_DEG} degrees.` };
  for (const p of pairs) {
    const ok =
      p.image.every((v) => Number.isFinite(v)) &&
      Number.isFinite(p.map[0]) &&
      Number.isFinite(p.map[1]) &&
      Math.abs(p.map[1]) <= MAX_LAT &&
      Math.abs(p.map[0]) <= 180;
    if (!ok) return { ok: false, error: "A point is not a real position." };
  }
  for (let i = 0; i < pairs.length; i++) {
    for (let j = i + 1; j < pairs.length; j++) {
      const sep = Math.hypot(pairs[i].image[0] - pairs[j].image[0], pairs[i].image[1] - pairs[j].image[1]);
      if (sep < MIN_PAIR_SEPARATION_PX) {
        return { ok: false, error: "The points are too close together on the screenshot. Pick two that are further apart." };
      }
    }
  }
  const held = fit(pairs, false, preferred);
  if (!held) return { ok: false, error: "The map points are the wrong way round compared with the screenshot. Check which is A and which is B." };
  const northUpErrors = errorsOf(held, pairs);
  let transform = held;
  let errorsPx = northUpErrors;
  if (northUpErrors.every((e) => e > NORTH_UP_TOLERANCE_PX)) {
    const turned = fit(pairs, true);
    if (!turned || Math.abs(turned.rotationDeg) > MAX_ROTATION_DEG) {
      return {
        ok: false,
        error: "The two pairs of points don't agree: the map would have to turn too far. Redo one of them.",
        errorsPx: northUpErrors.map((e) => round(e, 1)),
      };
    }
    transform = turned;
    errorsPx = errorsOf(turned, pairs);
  }
  const rotated = transform.rotationDeg !== 0;
  const midLat = pairs.reduce((s, p) => s + p.map[1], 0) / pairs.length;
  const metresPerPixel = transform.scale * Math.cos((midLat * Math.PI) / 180);
  if (metresPerPixel < MIN_METRES_PER_PIXEL || metresPerPixel > MAX_METRES_PER_PIXEL) {
    return { ok: false, error: "That would make the screenshot far bigger or smaller than a phone map can show. Check the points." };
  }
  return {
    ok: true,
    alignment: {
      pairs: pairs.map((p) => ({ image: [round(p.image[0], 2), round(p.image[1], 2)], map: [round(p.map[0], 7), round(p.map[1], 7)] })),
      transform,
      errorsPx: errorsPx.map((e) => round(e, 2)),
      metresPerPixel: round(metresPerPixel, 4),
      rotated,
      ...(preferred ? { preferredTurnDeg: round(preferred, 3) } : {}),
    },
  };
}

// Where the image's corners land on the map, for drawing it as an overlay:
// top left, top right, bottom left.
export function overlayCorners(t: Transform, width: number, height: number): [LngLat, LngLat, LngLat] {
  return [imageToLngLat(t, [0, 0]), imageToLngLat(t, [width, 0]), imageToLngLat(t, [0, height])];
}
