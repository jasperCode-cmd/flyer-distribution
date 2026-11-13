// Routes on the map: lengths, a round's distance across screenshots that
// overlap, the eraser, and the privacy trim for anything a client sees.
// Lines are GeoJSON MultiLineString coordinates, [lng, lat]. Pure, no
// imports, shared by the browser and the server.

export type LngLat = [lng: number, lat: number];
export type Lines = LngLat[][];

const EARTH_RADIUS_M = 6371008.8;
const rad = (d: number) => (d * Math.PI) / 180;

export function distanceM(a: LngLat, b: LngLat): number {
  const dLat = rad(b[1] - a[1]);
  const dLng = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function lineLengthM(line: LngLat[]): number {
  let total = 0;
  for (let k = 1; k < line.length; k++) total += distanceM(line[k - 1], line[k]);
  return total;
}

export function linesLengthM(lines: Lines): number {
  return lines.reduce((s, l) => s + lineLengthM(l), 0);
}

// A flat plane in metres around a latitude, for the short distances a round
// covers (an error well under 1% over a few kilometres).
export function localPlane(lat: number) {
  const mPerDegLat = (Math.PI * EARTH_RADIUS_M) / 180;
  const mPerDegLng = mPerDegLat * Math.cos(rad(lat));
  return {
    to: ([lng, lat2]: LngLat): [number, number] => [lng * mPerDegLng, lat2 * mPerDegLat],
    from: ([x, y]: [number, number]): LngLat => [x / mPerDegLng, y / mPerDegLat],
  };
}

function midLat(lines: Lines): number {
  let sum = 0;
  let n = 0;
  for (const l of lines) for (const p of l) {
    sum += p[1];
    n++;
  }
  return n ? sum / n : 0;
}

// Points every `stepM` metres along each line (its ends included).
export function samplesAlong(lines: Lines, stepM: number): LngLat[][] {
  return lines.map((line) => {
    const out: LngLat[] = [];
    if (line.length === 0) return out;
    out.push(line[0]);
    let carried = 0;
    for (let k = 1; k < line.length; k++) {
      const a = line[k - 1];
      const b = line[k];
      const seg = distanceM(a, b);
      if (seg === 0) continue;
      let at = stepM - carried;
      while (at <= seg) {
        const t = at / seg;
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
        at += stepM;
      }
      carried = seg - (at - stepM);
    }
    const last = line[line.length - 1];
    if (out[out.length - 1] !== last) out.push(last);
    return out;
  });
}

// A round's distance from all its screenshots' lines: each in turn, with any
// stretch already counted from an earlier screenshot (within `sameM`) left
// out, as screenshots of one round often show some of the same streets.
export const DEDUPE_STEP_M = 5;
export const SAME_ROUTE_M = 12;

export function roundDistanceM(screenshots: Lines[], sameM = SAME_ROUTE_M, stepM = DEDUPE_STEP_M): number {
  const all = screenshots.flat();
  if (all.length === 0) return 0;
  const plane = localPlane(midLat(all));
  const cell = sameM;
  const grid = new Map<string, [number, number][]>();
  const keyOf = (x: number, y: number) => `${Math.floor(x / cell)}:${Math.floor(y / cell)}`;
  const near = (x: number, y: number) => {
    const cx = Math.floor(x / cell);
    const cy = Math.floor(y / cell);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const [px, py] of grid.get(`${cx + dx}:${cy + dy}`) ?? []) if (Math.hypot(px - x, py - y) <= sameM) return true;
      }
    }
    return false;
  };
  let total = 0;
  for (const lines of screenshots) {
    const samples = samplesAlong(lines, stepM).map((l) => l.map(plane.to));
    // Decided against what earlier screenshots added, then added in one go.
    for (const line of samples) {
      for (let k = 1; k < line.length; k++) {
        const [x1, y1] = line[k - 1];
        const [x2, y2] = line[k];
        if (!near((x1 + x2) / 2, (y1 + y2) / 2)) total += Math.hypot(x2 - x1, y2 - y1);
      }
    }
    for (const line of samples) {
      for (const [x, y] of line) {
        const key = keyOf(x, y);
        const list = grid.get(key);
        if (list) list.push([x, y]);
        else grid.set(key, [[x, y]]);
      }
    }
  }
  return total;
}

// Everything within `radiusM` of a point taken out of the lines: lines are
// cut exactly where they cross the circle, and pieces left with no length
// dropped. Used by the eraser and the privacy trim.
export function eraseCircle(lines: Lines, centre: LngLat, radiusM: number): Lines {
  if (radiusM <= 0) return lines.map((l) => l.slice());
  const plane = localPlane(centre[1]);
  const [cx, cy] = plane.to(centre);
  const out: Lines = [];
  for (const line of lines) {
    let current: LngLat[] = [];
    const flush = () => {
      if (current.length >= 2 && lineLengthM(current) > 0.01) out.push(current);
      current = [];
    };
    for (let k = 0; k < line.length; k++) {
      const p = plane.to(line[k]);
      const inside = Math.hypot(p[0] - cx, p[1] - cy) < radiusM;
      if (k === 0) {
        if (!inside) current.push(line[0]);
        continue;
      }
      const a = plane.to(line[k - 1]);
      const b = p;
      // Where the segment a->b is inside the circle, as t in [0, 1].
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const fx = a[0] - cx;
      const fy = a[1] - cy;
      const A = dx * dx + dy * dy;
      const B = 2 * (fx * dx + fy * dy);
      const C = fx * fx + fy * fy - radiusM * radiusM;
      const disc = B * B - 4 * A * C;
      if (A === 0 || disc <= 0) {
        if (!inside) current.push(line[k]);
        else flush();
        continue;
      }
      const sq = Math.sqrt(disc);
      const t1 = (-B - sq) / (2 * A);
      const t2 = (-B + sq) / (2 * A);
      const at = (t: number): LngLat => plane.from([a[0] + dx * t, a[1] + dy * t]);
      if (t2 <= 0 || t1 >= 1) {
        // The segment misses the circle.
        current.push(line[k]);
        continue;
      }
      if (t1 > 0) {
        current.push(at(t1));
        flush();
      } else flush();
      if (t2 < 1) {
        current.push(at(t2));
        current.push(line[k]);
      }
    }
    flush();
  }
  return out;
}

// The privacy trim: anything within `trimM` of where a round started or
// ended (its red and green dots) is left off what a client sees, so the
// first and last stretches (often a distributor's own street) are never
// shown. Measured in a straight line, which also takes off at least that
// much along the line. Rounds with no dot shown are not trimmed.
export function trimForClient(lines: Lines, markers: LngLat[], trimM: number): Lines {
  let out = lines.map((l) => l.slice());
  for (const m of markers) out = eraseCircle(out, m, trimM);
  return out;
}

export function linesBbox(lines: Lines): [number, number, number, number] | null {
  let w = Infinity;
  let s = Infinity;
  let e = -Infinity;
  let n = -Infinity;
  for (const l of lines) {
    for (const [lng, lat] of l) {
      if (lng < w) w = lng;
      if (lng > e) e = lng;
      if (lat < s) s = lat;
      if (lat > n) n = lat;
    }
  }
  return Number.isFinite(w) ? [w, s, e, n] : null;
}

// Coordinates rounded to about 10 cm, to keep stored lines small.
export function roundCoords(lines: Lines): Lines {
  return lines.map((l) => l.map(([lng, lat]) => [Math.round(lng * 1e6) / 1e6, Math.round(lat * 1e6) / 1e6] as LngLat));
}
