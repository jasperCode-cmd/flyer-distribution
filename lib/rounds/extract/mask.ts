import { scaleFor, type Crop, type Point, type RgbaImage } from "./image";

// Which pixels are the route: MapMyRun draws it bright blue, a median of
// rgb(7, 155, 229) on the real screenshots, lighter at its anti-aliased
// edges (up to about rgb(70, 155, 228)). A pixel is route when its colour is
// within a tolerance of that range (its distance from the line between the
// two colours). The red start dot and green end dot are found on their own,
// as the route's ends, and are never route. Blue too thick to be the line
// (a blue button floating over the map, a badge, the location dot's halo)
// is taken out next, keeping the route around it; then small or compact
// blue blobs (map icons, the location dot, the letters of blue text) are
// dropped, as the route is long and thin.

export type Rgb = [number, number, number];

export const ROUTE_CORE: Rgb = [7, 155, 229];
export const ROUTE_EDGE: Rgb = [70, 155, 228];
export const DEFAULT_TOLERANCE = 45;
export const MIN_TOLERANCE = 10;
export const MAX_TOLERANCE = 120;

export function colourDistance(p: Rgb, a: Rgb = ROUTE_CORE, b: Rgb = ROUTE_EDGE): number {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ap = [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
  const len2 = ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2];
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / len2));
  const d = [ap[0] - t * ab[0], ap[1] - t * ab[1], ap[2] - t * ab[2]];
  return Math.hypot(d[0], d[1], d[2]);
}

// 1 for route-coloured pixels inside the crop, 0 elsewhere.
export function routeMask(img: RgbaImage, crop: Crop, tolerance = DEFAULT_TOLERANCE): Uint8Array {
  const { width, data } = img;
  const mask = new Uint8Array(width * img.height);
  const tol2 = tolerance * tolerance;
  const [ar, ag, ab] = ROUTE_CORE;
  const dr = ROUTE_EDGE[0] - ar;
  const dg = ROUTE_EDGE[1] - ag;
  const db = ROUTE_EDGE[2] - ab;
  const len2 = dr * dr + dg * dg + db * db;
  for (let y = crop.top; y < crop.bottom; y++) {
    for (let x = crop.left; x < crop.right; x++) {
      const i = (y * width + x) * 4;
      // Mostly see-through pixels (rare in a screenshot) are never route.
      if (data[i + 3] < 128) continue;
      const pr = data[i] - ar;
      const pg = data[i + 1] - ag;
      const pb = data[i + 2] - ab;
      let t = (pr * dr + pg * dg + pb * db) / len2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const er = pr - t * dr;
      const eg = pg - t * dg;
      const eb = pb - t * db;
      if (er * er + eg * eg + eb * eb <= tol2) mask[y * width + x] = 1;
    }
  }
  return mask;
}

// Running totals over the mask, so any rectangle's count is four lookups.
function summedArea(mask: Uint8Array, width: number, height: number): Int32Array {
  const sat = new Int32Array((width + 1) * (height + 1));
  for (let y = 0; y < height; y++) {
    let row = 0;
    for (let x = 0; x < width; x++) {
      row += mask[y * width + x];
      sat[(y + 1) * (width + 1) + x + 1] = sat[y * (width + 1) + x + 1] + row;
    }
  }
  return sat;
}

function boxSum(sat: Int32Array, width: number, height: number, x0: number, y0: number, x1: number, y1: number): number {
  const a = Math.max(0, x0);
  const b = Math.max(0, y0);
  const c = Math.min(width - 1, x1) + 1;
  const d = Math.min(height - 1, y1) + 1;
  if (c <= a || d <= b) return 0;
  const w = width + 1;
  return sat[d * w + c] - sat[b * w + c] - sat[d * w + a] + sat[b * w + a];
}

// At full working size: the route line is never this thick (even at a sharp
// corner), and a few pixels round anything thicker go with it, for its
// anti-aliased rim. Holes up to about TEXT_HOLE_PX across (the letters on a
// blue button) are filled first, only for finding what is thick.
export const MAX_LINE_PX = 24;
export const THICK_MARGIN_PX = 4;
export const TEXT_HOLE_PX = 8;

// Every pixel with any (grow) or only (shrink) set pixels within r of it.
export function boxGrow(mask: Uint8Array, width: number, height: number, r: number): Uint8Array {
  const sat = summedArea(mask, width, height);
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) out[y * width + x] = boxSum(sat, width, height, x - r, y - r, x + r, y + r) > 0 ? 1 : 0;
  return out;
}

function boxShrink(mask: Uint8Array, width: number, height: number, r: number): Uint8Array {
  const sat = summedArea(mask, width, height);
  const out = new Uint8Array(mask.length);
  const full = (2 * r + 1) * (2 * r + 1);
  for (let y = r; y < height - r; y++) for (let x = r; x < width - r; x++) out[y * width + x] = mask[y * width + x] && boxSum(sat, width, height, x - r, y - r, x + r, y + r) === full ? 1 : 0;
  return out;
}

// Takes out blue too thick to be the route: whatever a square wider than
// the line fits inside entirely (an opening), and a margin round it. A
// route running past or under such a shape keeps the rest of its line; the
// short gap is bridged when the line is traced.
// How wide the route line is, in pixels: for each route pixel the shortest
// of its runs across, horizontally, vertically and along both diagonals (a
// diagonal run counted at its true length), at the median (a crossing reads
// a little long; the median sees past it). Whichever way the line runs, one
// of the four crosses it nearly square.
export function lineWidthOf(mask: Uint8Array, width: number, height: number): number | null {
  const shortest = new Float32Array(mask.length).fill(Infinity);
  const directions: [number, number, number][] = [
    [1, 0, 1],
    [0, 1, 1],
    [1, 1, Math.SQRT2],
    [1, -1, Math.SQRT2],
  ];
  const on = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height && mask[y * width + x] === 1;
  for (const [dx, dy, step] of directions) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // From the first pixel of each run only.
        if (!on(x, y) || on(x - dx, y - dy)) continue;
        let n = 0;
        while (on(x + dx * n, y + dy * n)) n++;
        const run = n * step;
        for (let k = 0; k < n; k++) {
          const i = (y + dy * k) * width + x + dx * k;
          if (run < shortest[i]) shortest[i] = run;
        }
      }
    }
  }
  const runs: number[] = [];
  let seen = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i] && seen++ % 3 === 0) runs.push(shortest[i]);
  if (runs.length < 50) return null;
  runs.sort((a, b) => a - b);
  return Math.round(runs[Math.floor(runs.length / 2)]);
}

// Blue this many times the line's width across is not route, even where
// a round walked back and forth thickens it.
export const THICK_LINE_WIDTHS = 4;

export function dropThick(mask: Uint8Array, img: Pick<RgbaImage, "width" | "height">, lineWidth: number | null = null): { mask: Uint8Array; removed: number } {
  const { width, height } = img;
  const k = scaleFor(img);
  const size = Math.max(5, Math.round(Math.max(MAX_LINE_PX * k, (lineWidth ?? 0) * THICK_LINE_WIDTHS))) | 1;
  const r = (size - 1) / 2;
  const hole = Math.max(1, Math.round((TEXT_HOLE_PX * k) / 2));
  const solid = boxShrink(boxGrow(mask, width, height, hole), width, height, hole);
  const sat = summedArea(solid, width, height);
  const core = new Uint8Array(mask.length);
  let any = false;
  for (let y = r; y < height - r; y++) {
    for (let x = r; x < width - r; x++) {
      if (solid[y * width + x] && boxSum(sat, width, height, x - r, y - r, x + r, y + r) === size * size) {
        core[y * width + x] = 1;
        any = true;
      }
    }
  }
  if (!any) return { mask, removed: 0 };
  const grow = r + Math.max(1, Math.round(THICK_MARGIN_PX * k));
  const coreSat = summedArea(core, width, height);
  const out = mask.slice();
  const gone = new Uint8Array(mask.length);
  let removed = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (out[i] && boxSum(coreSat, width, height, x - grow, y - grow, x + grow, y + grow) > 0) {
        out[i] = 0;
        gone[i] = 1;
        removed++;
      }
    }
  }
  // What is left of the shape's rim (the rounded ends of a button) is thin
  // and lies within a line's width of what was taken out; route leaving the
  // shape runs on away from it.
  const rim = boxGrow(gone, width, height, Math.max(2, Math.round(lineWidth ?? MAX_LINE_PX * k * 0.4)));
  for (const c of components(out, width, height)) {
    if (!c.pixels.every((i) => rim[i])) continue;
    for (const i of c.pixels) out[i] = 0;
    removed += c.count;
  }
  return { mask: out, removed };
}

export type Component = { count: number; minX: number; minY: number; maxX: number; maxY: number; pixels: number[] };

// The 8-connected groups of set pixels.
export function components(mask: Uint8Array, width: number, height: number): Component[] {
  const seen = new Uint8Array(mask.length);
  const out: Component[] = [];
  const stack: number[] = [];
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue;
    const c: Component = { count: 0, minX: width, minY: height, maxX: -1, maxY: -1, pixels: [] };
    seen[start] = 1;
    stack.push(start);
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % width;
      const y = (i - x) / width;
      c.count++;
      c.pixels.push(i);
      if (x < c.minX) c.minX = x;
      if (x > c.maxX) c.maxX = x;
      if (y < c.minY) c.minY = y;
      if (y > c.maxY) c.maxY = y;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if ((dx === 0 && dy === 0) || nx < 0 || nx >= width) continue;
          const j = ny * width + nx;
          if (mask[j] && !seen[j]) {
            seen[j] = 1;
            stack.push(j);
          }
        }
      }
    }
    out.push(c);
  }
  return out;
}

export function extentOf(c: Component): number {
  return Math.max(c.maxX - c.minX + 1, c.maxY - c.minY + 1);
}

export function fillOf(c: Component): number {
  return c.count / ((c.maxX - c.minX + 1) * (c.maxY - c.minY + 1));
}

// At full working size: a route piece is at least this long; anything this
// short is a speck (a small pool, a blue car). Roundish blobs that fill most
// of their box and are not much bigger than an icon are dropped too (a
// short straight piece of route between two labels fills its box as well,
// but is long and thin, so it is kept).
export const MIN_ROUTE_EXTENT = 24;
export const ICON_EXTENT = 90;
export const ICON_FILL = 0.45;
export const ICON_MAX_ASPECT = 2;

export function aspectOf(c: Component): number {
  const w = c.maxX - c.minX + 1;
  const h = c.maxY - c.minY + 1;
  return Math.max(w, h) / Math.min(w, h);
}

export type BlobFilter = { kept: Uint8Array; keptCount: number; removed: number };

export function dropBlobs(mask: Uint8Array, img: Pick<RgbaImage, "width" | "height">): BlobFilter {
  const k = scaleFor(img);
  const minExtent = MIN_ROUTE_EXTENT * k;
  const iconExtent = ICON_EXTENT * k;
  const kept = new Uint8Array(mask.length);
  let keptCount = 0;
  let removed = 0;
  for (const c of components(mask, img.width, img.height)) {
    const extent = extentOf(c);
    const iconLike = extent < minExtent || (fillOf(c) > ICON_FILL && extent < iconExtent && aspectOf(c) < ICON_MAX_ASPECT);
    if (iconLike) {
      removed++;
      continue;
    }
    keptCount++;
    for (const i of c.pixels) kept[i] = 1;
  }
  return { kept, keptCount, removed };
}

// The start and end dots: the biggest roundish red blob, and the biggest
// roundish green one, inside the crop.
export type Dots = { start: Point | null; end: Point | null };

function isRed(r: number, g: number, b: number) {
  return r > 170 && g < 120 && b < 120 && r - g > 90 && r - b > 80;
}

function isGreen(r: number, g: number, b: number) {
  return g > 130 && g - r > 50 && g - b > 30 && r < 150;
}

export const MIN_DOT_EXTENT = 8;
export const MAX_DOT_EXTENT = 110;

// Route pixels round a blob: a start or end dot sits on the end of the
// route, a map icon of the same colour usually doesn't.
function routeContact(c: Component, route: Uint8Array | null, width: number, height: number): number {
  if (!route) return 0;
  const pad = Math.max(3, Math.round(extentOf(c) * 0.6));
  let n = 0;
  for (let y = Math.max(0, c.minY - pad); y <= Math.min(height - 1, c.maxY + pad); y++) {
    for (let x = Math.max(0, c.minX - pad); x <= Math.min(width - 1, c.maxX + pad); x++) n += route[y * width + x];
  }
  return n;
}

function findDot(img: RgbaImage, crop: Crop, test: (r: number, g: number, b: number) => boolean, route: Uint8Array | null): Point | null {
  const { width, height, data } = img;
  const mask = new Uint8Array(width * height);
  for (let y = crop.top; y < crop.bottom; y++) {
    for (let x = crop.left; x < crop.right; x++) {
      const i = (y * width + x) * 4;
      if (test(data[i], data[i + 1], data[i + 2])) mask[y * width + x] = 1;
    }
  }
  const k = scaleFor(img);
  let best: Component | null = null;
  let bestContact = -1;
  for (const c of components(mask, width, height)) {
    const extent = extentOf(c);
    const w = c.maxX - c.minX + 1;
    const h = c.maxY - c.minY + 1;
    const round = Math.min(w, h) / Math.max(w, h) > 0.6 && fillOf(c) > 0.5;
    if (!round || extent < MIN_DOT_EXTENT * k || extent > MAX_DOT_EXTENT * k) continue;
    // The one touching the route most; among equals, the biggest.
    const contact = routeContact(c, route, width, height);
    if (!best || contact > bestContact || (contact === bestContact && c.count > best.count)) {
      best = c;
      bestContact = contact;
    }
  }
  if (!best) return null;
  let sx = 0;
  let sy = 0;
  for (const i of best.pixels) {
    const x = i % width;
    sx += x;
    sy += (i - x) / width;
  }
  return [sx / best.count, sy / best.count];
}

export function findDots(img: RgbaImage, crop: Crop, route: Uint8Array | null = null): Dots {
  return { start: findDot(img, crop, isRed, route), end: findDot(img, crop, isGreen, route) };
}

