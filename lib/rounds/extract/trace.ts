import type { Point } from "./image";

// Turning the one-pixel centre line into polylines: walk it as a graph
// (pixels where it ends or branches are the nodes), cut off short side
// spurs that thinning leaves at corners and blobs, join pieces through
// points that no longer branch, then bridge short gaps where a street label
// or a dot hid the line, as long as both ends point at each other. Pieces
// still too short to be route are dropped, and each line is simplified
// (Douglas-Peucker). Pure, no imports beyond the types.

export type TraceOptions = {
  // Side branches shorter than this are spurs.
  spurPx: number;
  // The widest gap bridged, and how far off line a bridge may point; and a
  // longer gap, bridged only when both ends point almost straight at each
  // other (a street label lies along its street, hiding a straight stretch).
  gapPx: number;
  maxBridgeAngleDeg: number;
  longGapPx: number;
  longGapAngleDeg: number;
  // Or when one end points straight along the gap and the other, just past
  // a corner, sits on that line to within this much.
  alignPx: number;
  // Gaps up to this long are bridged on their angles alone. A longer one
  // also needs the image to show the line goes on there (evidence says
  // whether it does: the route's blue along it, or a street label over it).
  // Without evidence, angles alone decide.
  freeGapPx?: number;
  evidence?: (p: Point, q: Point) => boolean;
  // Lines shorter than this, once joined, are dropped.
  minLengthPx: number;
  // Douglas-Peucker tolerance.
  simplifyPx: number;
};

type Path = { pixels: number[]; a: number; b: number; gone: boolean };

const OFFSETS: [number, number][] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
  [1, -1],
  [1, 1],
  [-1, 1],
  [-1, -1],
];

// A pixel's neighbours on the line. A diagonal neighbour is skipped when a
// side neighbour already touches it, so staircases read as one line rather
// than little triangles.
function neighbours(skel: Uint8Array, width: number, height: number, i: number): number[] {
  const x = i % width;
  const y = (i - x) / width;
  const on = (dx: number, dy: number) => {
    const nx = x + dx;
    const ny = y + dy;
    return nx >= 0 && ny >= 0 && nx < width && ny < height && skel[ny * width + nx] === 1;
  };
  const out: number[] = [];
  for (const [dx, dy] of OFFSETS) {
    if (!on(dx, dy)) continue;
    if (dx !== 0 && dy !== 0 && (on(dx, 0) || on(0, dy))) continue;
    out.push((y + dy) * width + (x + dx));
  }
  return out;
}

function lengthOf(points: Point[]): number {
  let total = 0;
  for (let k = 1; k < points.length; k++) total += Math.hypot(points[k][0] - points[k - 1][0], points[k][1] - points[k - 1][1]);
  return total;
}

function toPoints(pixels: number[], width: number): Point[] {
  return pixels.map((i) => {
    const x = i % width;
    return [x, (i - x) / width];
  });
}

// The skeleton as paths between nodes (ends and branch points), plus loops.
function walk(skel: Uint8Array, width: number, height: number): Path[] {
  const deg = new Map<number, number[]>();
  for (let i = 0; i < skel.length; i++) if (skel[i]) deg.set(i, neighbours(skel, width, height, i));
  const isNode = (i: number) => deg.get(i)!.length !== 2;
  const visited = new Set<number>();
  const usedLinks = new Set<string>();
  const paths: Path[] = [];
  const linkKey = (p: number, q: number) => (p < q ? `${p}:${q}` : `${q}:${p}`);

  for (const [start, next] of deg) {
    if (!isNode(start)) continue;
    for (const first of next) {
      if (usedLinks.has(linkKey(start, first))) continue;
      const pixels = [start, first];
      usedLinks.add(linkKey(start, first));
      let prev = start;
      let cur = first;
      while (!isNode(cur)) {
        visited.add(cur);
        const onward = deg.get(cur)!.find((n) => n !== prev && !usedLinks.has(linkKey(cur, n)));
        if (onward === undefined) break;
        usedLinks.add(linkKey(cur, onward));
        pixels.push(onward);
        prev = cur;
        cur = onward;
      }
      paths.push({ pixels, a: start, b: cur, gone: false });
    }
    visited.add(start);
  }
  // Loops: lines with no ends and no branches.
  for (const [start] of deg) {
    if (visited.has(start)) continue;
    const pixels = [start];
    visited.add(start);
    let prev = -1;
    let cur = start;
    for (;;) {
      const onward = deg.get(cur)!.find((n) => n !== prev && !visited.has(n));
      if (onward === undefined) break;
      visited.add(onward);
      pixels.push(onward);
      prev = cur;
      cur = onward;
    }
    pixels.push(start);
    paths.push({ pixels, a: start, b: start, gone: false });
  }
  return paths;
}

function endCounts(paths: Path[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const p of paths) {
    if (p.gone || p.a === p.b) continue;
    counts.set(p.a, (counts.get(p.a) ?? 0) + 1);
    counts.set(p.b, (counts.get(p.b) ?? 0) + 1);
  }
  return counts;
}

// A pruned spur's tip and the way it pointed: where a street label hid the
// line just past a junction, all that is left of the line there is a stub,
// and a bridge may still land on it.
export type Stub = { tip: Point; dir: Point };

function pruneSpurs(paths: Path[], width: number, spurPx: number, stubs: Stub[]) {
  for (let round = 0; round < 6; round++) {
    const counts = endCounts(paths);
    let changed = false;
    for (const p of paths) {
      if (p.gone || p.a === p.b) continue;
      const ca = counts.get(p.a)!;
      const cb = counts.get(p.b)!;
      const spur = (ca === 1 && cb >= 3) || (cb === 1 && ca >= 3);
      const points = toPoints(p.pixels, width);
      if (spur && lengthOf(points) < spurPx) {
        p.gone = true;
        changed = true;
        const fromJunction = ca === 1 ? [...points].reverse() : points;
        const base = fromJunction[0];
        const tip = fromJunction[fromJunction.length - 1];
        const len = Math.hypot(tip[0] - base[0], tip[1] - base[1]);
        if (len >= 2) stubs.push({ tip, dir: [(tip[0] - base[0]) / len, (tip[1] - base[1]) / len] });
      }
    }
    if (!changed) break;
    mergeThrough(paths);
  }
}

// Joins the two paths meeting at any node that now has exactly two.
function mergeThrough(paths: Path[]) {
  for (;;) {
    const counts = endCounts(paths);
    const node = [...counts].find(([, n]) => n === 2)?.[0];
    if (node === undefined) return;
    const pair = paths.filter((p) => !p.gone && p.a !== p.b && (p.a === node || p.b === node));
    if (pair.length !== 2 || pair[0] === pair[1]) return;
    const [p, q] = pair;
    const pTo = p.b === node ? p.pixels : [...p.pixels].reverse();
    const qFrom = q.a === node ? q.pixels : [...q.pixels].reverse();
    const pixels = [...pTo, ...qFrom.slice(1)];
    const a = pixels[0];
    const b = pixels[pixels.length - 1];
    q.gone = true;
    p.pixels = pixels;
    p.a = a;
    p.b = b;
    if (a === b) return;
  }
}

// Douglas-Peucker.
export function simplifyLine(points: Point[], tolerance: number): Point[] {
  if (points.length < 3) return points.slice();
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop()!;
    const [x1, y1] = points[s];
    const [x2, y2] = points[e];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    let worst = -1;
    let at = -1;
    for (let k = s + 1; k < e; k++) {
      const [x, y] = points[k];
      const d = len === 0 ? Math.hypot(x - x1, y - y1) : Math.abs(dy * x - dx * y + x2 * y1 - y2 * x1) / len;
      if (d > worst) {
        worst = d;
        at = k;
      }
    }
    if (worst > tolerance) {
      keep[at] = 1;
      stack.push([s, at], [at, e]);
    }
  }
  return points.filter((_, k) => keep[k]);
}

// Which way a line leaves at one end, as a unit vector pointing out of it.
export function outward(points: Point[], atStart: boolean, reach: number): Point {
  const end = atStart ? points[0] : points[points.length - 1];
  let back = end;
  let walked = 0;
  for (let k = 1; k < points.length && walked < reach; k++) {
    const p = atStart ? points[k] : points[points.length - 1 - k];
    walked += Math.hypot(p[0] - back[0], p[1] - back[1]);
    back = p;
  }
  const dx = end[0] - back[0];
  const dy = end[1] - back[1];
  const len = Math.hypot(dx, dy) || 1;
  return [dx / len, dy / len];
}

type End = { line: number; atStart: boolean };

// The way an end points: over a short reach (an end just past a corner) and
// a longer one, whichever lines up better with where the bridge would go.
function bestCos(points: Point[], atStart: boolean, ux: number, uy: number, reaches: number[]): number {
  let best = -1;
  for (const reach of reaches) {
    const o = outward(points, atStart, reach);
    best = Math.max(best, o[0] * ux + o[1] * uy);
  }
  return best;
}

// How far point q is off the line through p in direction (dx, dy), and
// whether it is ahead of p.
function offLine(p: Point, dir: Point, q: Point): { off: number; ahead: number } {
  const vx = q[0] - p[0];
  const vy = q[1] - p[1];
  return { off: Math.abs(vx * dir[1] - vy * dir[0]), ahead: vx * dir[0] + vy * dir[1] };
}

// The end's direction that lines up best with the bridge.
function bestDir(points: Point[], atStart: boolean, ux: number, uy: number, reaches: number[]): Point {
  let best: Point = outward(points, atStart, reaches[0]);
  let bestCosine = best[0] * ux + best[1] * uy;
  for (const reach of reaches.slice(1)) {
    const o = outward(points, atStart, reach);
    const c = o[0] * ux + o[1] * uy;
    if (c > bestCosine) {
      best = o;
      bestCosine = c;
    }
  }
  return best;
}

// Whether a gap may be bridged on what the image shows: short ones always;
// longer ones only where the image shows the line goes on.
function hidden(p: Point, q: Point, d: number, options: TraceOptions): boolean {
  if (!options.evidence || options.freeGapPx === undefined || d <= options.freeGapPx) return true;
  return options.evidence(p, q);
}

function bridge(lines: Point[][], options: TraceOptions, stubs: Stub[] = []): Point[][] {
  const { gapPx, longGapPx } = options;
  const cosMax = Math.cos((options.maxBridgeAngleDeg * Math.PI) / 180);
  const cosLong = Math.cos((options.longGapAngleDeg * Math.PI) / 180);
  const reach = Math.max(gapPx, longGapPx);
  const ends: End[] = [];
  lines.forEach((l, line) => {
    const closed = l.length > 2 && l[0][0] === l[l.length - 1][0] && l[0][1] === l[l.length - 1][1];
    if (!closed) ends.push({ line, atStart: true }, { line, atStart: false });
  });
  const pointOf = (e: End) => (e.atStart ? lines[e.line][0] : lines[e.line][lines[e.line].length - 1]);
  const candidates: { e: End; f: End; score: number }[] = [];
  for (let i = 0; i < ends.length; i++) {
    for (let j = i + 1; j < ends.length; j++) {
      const e = ends[i];
      const f = ends[j];
      if (e.line === f.line && lengthOf(lines[e.line]) < reach * 2) continue;
      const p = pointOf(e);
      const q = pointOf(f);
      const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (d > reach || d === 0) continue;
      const ux = (q[0] - p[0]) / d;
      const uy = (q[1] - p[1]) / d;
      const reaches = [Math.max(3, options.spurPx), gapPx / 2];
      const ce = bestCos(lines[e.line], e.atStart, ux, uy, reaches);
      const cf = bestCos(lines[f.line], f.atStart, -ux, -uy, reaches);
      const near = d <= gapPx && ce >= cosMax && cf >= cosMax;
      const straight = d <= longGapPx && ce >= cosLong && cf >= cosLong;
      let alongOne = false;
      if (!near && !straight && d <= longGapPx) {
        const de = bestDir(lines[e.line], e.atStart, ux, uy, reaches);
        const df = bestDir(lines[f.line], f.atStart, -ux, -uy, reaches);
        const fromE = offLine(p, de, q);
        const fromF = offLine(q, df, p);
        alongOne =
          (ce >= cosLong && fromE.off <= options.alignPx && fromE.ahead > 0 && cf >= 0) ||
          (cf >= cosLong && fromF.off <= options.alignPx && fromF.ahead > 0 && ce >= 0);
      }
      if (!near && !straight && !alongOne) continue;
      if (!hidden(p, q, d, options)) continue;
      candidates.push({ e, f, score: d * (3 - ce - cf) });
    }
  }
  candidates.sort((x, y) => x.score - y.score);
  const key = (e: End) => `${e.line}:${e.atStart ? "s" : "e"}`;
  const joinedTo = new Map<string, End>();
  for (const c of candidates) {
    if (joinedTo.has(key(c.e)) || joinedTo.has(key(c.f))) continue;
    joinedTo.set(key(c.e), c.f);
    joinedTo.set(key(c.f), c.e);
  }

  // Ends still free may reach a spur's stub, lined up straight both ways:
  // the line is extended to the stub's tip, by the junction it came from.
  const reaches = [Math.max(3, options.spurPx), gapPx / 2];
  const extended = lines.map((l) => l.slice());
  const usedStub = new Set<number>();
  for (const e of ends) {
    if (joinedTo.has(key(e))) continue;
    const p = pointOf(e);
    let best: { stub: number; d: number } | null = null;
    stubs.forEach((s, n) => {
      if (usedStub.has(n)) return;
      const d = Math.hypot(s.tip[0] - p[0], s.tip[1] - p[1]);
      if (d === 0 || d > longGapPx) return;
      const ux = (s.tip[0] - p[0]) / d;
      const uy = (s.tip[1] - p[1]) / d;
      const ce = bestCos(lines[e.line], e.atStart, ux, uy, reaches);
      const cs = -(s.dir[0] * ux + s.dir[1] * uy);
      const fromStub = offLine(s.tip, s.dir, p);
      const lined = (ce >= cosLong && cs >= cosLong) || (cs >= cosLong && fromStub.off <= options.alignPx && fromStub.ahead > 0 && ce >= 0);
      if (!lined) return;
      if (!hidden(p, s.tip, d, options)) return;
      if (!best || d < best.d) best = { stub: n, d };
    });
    if (!best) continue;
    const found: { stub: number; d: number } = best;
    usedStub.add(found.stub);
    const line = extended[e.line];
    if (e.atStart) line.unshift(stubs[found.stub].tip);
    else line.push(stubs[found.stub].tip);
  }
  lines = extended;
  if (joinedTo.size === 0) return lines;

  // Follow the joins into chains, starting from free ends, then any loops.
  const used = new Uint8Array(lines.length);
  const out: Point[][] = [];
  const follow = (line: number, fromStart: boolean) => {
    const chain: Point[] = [];
    let cur: End | undefined = { line, atStart: fromStart };
    while (cur && !used[cur.line]) {
      used[cur.line] = 1;
      const pts = cur.atStart ? lines[cur.line] : [...lines[cur.line]].reverse();
      chain.push(...pts);
      const exit: End = { line: cur.line, atStart: !cur.atStart };
      cur = joinedTo.get(key(exit));
    }
    out.push(chain);
  };
  for (const e of ends) if (!used[e.line] && !joinedTo.has(key(e))) follow(e.line, e.atStart);
  for (let line = 0; line < lines.length; line++) if (!used[line]) follow(line, true);
  return out;
}

export function traceLines(skel: Uint8Array, width: number, height: number, options: TraceOptions): Point[][] {
  const paths = walk(skel, width, height);
  mergeThrough(paths);
  const stubs: Stub[] = [];
  pruneSpurs(paths, width, options.spurPx, stubs);
  // Where lines meet: a short line (longer than a spur) from one of these is
  // a short street off the rest, a cul-de-sac, not a speck, and is kept.
  const counts = endCounts(paths);
  const junctions = new Set<string>();
  for (const [pixel, n] of counts) if (n >= 2) junctions.add(toPoints([pixel], width)[0].join(","));
  const joined = (l: Point[]) => junctions.has(l[0].join(",")) || junctions.has(l[l.length - 1].join(","));
  const shortest = Math.min(options.minLengthPx, options.spurPx);
  let lines = paths.filter((p) => !p.gone).map((p) => toPoints(p.pixels, width));
  // Specks first, so they can't be bridged to.
  lines = lines.filter((l) => lengthOf(l) >= shortest);
  lines = bridge(lines, options, stubs);
  return lines
    .filter((l) => lengthOf(l) >= (joined(l) ? shortest : options.minLengthPx))
    .map((l) => simplifyLine(l, options.simplifyPx));
}

export function totalLength(lines: Point[][]): number {
  return lines.reduce((s, l) => s + lengthOf(l), 0);
}
