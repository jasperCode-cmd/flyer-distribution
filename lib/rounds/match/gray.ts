import type { Compass } from "../compass";
import { scaleFor, type Crop, type RgbaImage } from "../extract/image";
import { routeMask } from "../extract/mask";

// A screenshot as matching sees it: brightness, and which pixels are map
// imagery. Left out: the band at the top, the buttons that float at the same
// place on every screenshot (the strip along the bottom, and the compass),
// the route's blue and the start and end dots. Light roofs and roads stay
// in: they are most of the detail. Pure.

export type Gray = { w: number; h: number; d: Float32Array; valid: Uint8Array };

// Matching works at half the working size: plenty of detail, a quarter of the work.
export const MATCH_SCALE = 0.5;
// The strip along the bottom where the Route Flyover button and the Apple
// Maps label float, as a share of the height (measured: they start at 88.5%).
export const BOTTOM_STRIP = 0.885;
const ROUTE_TOLERANCE = 45;

const isRed = (r: number, g: number, b: number) => r > 170 && g < 90 && b < 90;
const isGreen = (r: number, g: number, b: number) => g > 150 && r < 120 && b < 130 && g - r > 50;

// Every pixel with a set pixel within r of it (a square), rows then columns.
function grow(mask: Uint8Array, w: number, h: number, r: number): Uint8Array {
  if (r <= 0) return mask;
  const line = (get: (i: number) => number, set: (i: number) => void, n: number) => {
    const after = new Int32Array(n);
    let next = 1 << 30;
    for (let i = n - 1; i >= 0; i--) {
      if (get(i)) next = i;
      after[i] = next;
    }
    let last = -(1 << 30);
    for (let i = 0; i < n; i++) {
      if (get(i)) last = i;
      if (i - last <= r || after[i] - i <= r) set(i);
    }
  };
  const tmp = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) line((x) => mask[y * w + x], (x) => (tmp[y * w + x] = 1), w);
  const out = new Uint8Array(w * h);
  for (let x = 0; x < w; x++) line((y) => tmp[y * w + x], (y) => (out[y * w + x] = 1), h);
  return out;
}

export function grayFor(img: RgbaImage, crop: Crop, compass: Compass | null): Gray {
  const { width: w, height: h, data } = img;
  const k = scaleFor(img);
  const route = routeMask(img, crop, ROUTE_TOLERANCE);
  const bad = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    if (route[i] || isRed(r, g, b) || isGreen(r, g, b)) bad[i] = 1;
  }
  const grown = grow(bad, w, h, Math.round(3 * k));
  const d = new Float32Array(w * h);
  const valid = new Uint8Array(w * h);
  const top = crop.top + Math.round(4 * k);
  const bottom = Math.floor(h * BOTTOM_STRIP);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      d[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
      const dial = compass ? Math.hypot(x - compass.centre[0], y - compass.centre[1]) <= compass.radius * 1.15 : x > w * 0.82 && y < crop.top + h * 0.09;
      valid[i] = y >= top && y < bottom && !dial && !grown[i] ? 1 : 0;
    }
  }
  return { w, h, d, valid };
}

export function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  if (r <= 0) return src;
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  const n = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    let s = 0;
    for (let x = -r; x <= r; x++) s += src[y * w + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = s / n;
      s += src[y * w + Math.min(w - 1, x + r + 1)] - src[y * w + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let s = 0;
    for (let y = -r; y <= r; y++) s += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = s / n;
      s += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
  return out;
}

// Resampled by s (smoothed first when shrinking, so nothing aliases).
export function resize(g: Gray, s: number): Gray {
  const w = Math.max(8, Math.round(g.w * s));
  const h = Math.max(8, Math.round(g.h * s));
  const src = s < 1 ? boxBlur(boxBlur(g.d, g.w, g.h, Math.max(0, Math.round(0.5 / s - 0.5))), g.w, g.h, Math.max(0, Math.round(0.5 / s - 0.5))) : g.d;
  const d = new Float32Array(w * h);
  const valid = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const fx = Math.min(g.w - 1.001, Math.max(0, (x + 0.5) / s - 0.5));
      const fy = Math.min(g.h - 1.001, Math.max(0, (y + 0.5) / s - 0.5));
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const ax = fx - x0;
      const ay = fy - y0;
      const i = y0 * g.w + x0;
      d[y * w + x] = src[i] * (1 - ax) * (1 - ay) + src[i + 1] * ax * (1 - ay) + src[i + g.w] * (1 - ax) * ay + src[i + g.w + 1] * ax * ay;
      valid[y * w + x] = g.valid[Math.round(fy) * g.w + Math.round(fx)];
    }
  }
  return { w, h, d, valid };
}

// Kept compactly to match later screenshots against: one byte a pixel, 0
// where it isn't map (about 0.3 MB at half size).
export type Packed = { w: number; h: number; px: Uint8Array };

export function pack(g: Gray): Packed {
  const px = new Uint8Array(g.w * g.h);
  for (let i = 0; i < px.length; i++) px[i] = g.valid[i] ? Math.max(1, Math.min(255, Math.round(g.d[i]))) : 0;
  return { w: g.w, h: g.h, px };
}

export function unpack(p: Packed): Gray {
  const d = new Float32Array(p.w * p.h);
  const valid = new Uint8Array(p.w * p.h);
  for (let i = 0; i < d.length; i++) {
    d[i] = p.px[i];
    valid[i] = p.px[i] ? 1 : 0;
  }
  return { w: p.w, h: p.h, d, valid };
}
