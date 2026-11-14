import { MAX_ROTATION_DEG, type Transform } from "../alignment";
import type { Point } from "../extract/image";
import type { Road } from "./roads-format";

// Locate: placing a screenshot on the map from its street-name labels alone,
// with no lined-up neighbour. Every coordinate here is Web Mercator metres
// (y south), as in lib/rounds/alignment; distances are judged on the ground.
// 1. Voting over scale, turn and position: each label votes for every
//    placement that puts it on a street of its name running the same way
//    (the compass, where it shows, pins the turn); the placement most names
//    agree on wins, one per place.
// 2. Least squares: each label onto its street (only how far it is across
//    the street counts), outliers dropped.
// 3. Least squares again with the traced route onto the streets around it,
//    the labels holding it in place.
// 4. Placed only when enough names agree, closely, nowhere else in the area
//    fits nearly as well, the turn is allowed (and agrees with the compass),
//    and the route sits on streets; anything else is a reason to line it up
//    by hand. Pure.

export type LabelKind = "street" | "ref";
// A label as read from the screenshot: its centre in image pixels, and the
// way its text runs in degrees clockwise from left-to-right.
export type Label = { kind: LabelKind; name: string; x: number; y: number; angle: number };

export const LOCATE = {
  // Placed only when all of these hold. Five names can fit more than one
  // place in an area, so it takes six (eight with no route to check).
  minNames: 6,
  minNamesWithoutRoute: 8,
  maxLabelRmsM: 15,
  runnerUpShare: 0.6,
  compassToleranceDeg: 4,
  minRouteShare: 0.6,
  // The search.
  minMetresPerPixel: 0.6,
  maxMetresPerPixel: 6,
  scaleStep: 1.04,
  turnStepDeg: 2,
  angleToleranceDeg: 25,
  voteCellPx: 12,
  sampleM: 8,
  distinctPlaceM: 250,
  agreeM: 15,
  routeNearM: 10,
  maxLabels: 31,
} as const;

export type LocateFit = {
  ok: boolean;
  // "Placed" or why not, in words for the review grid and the queue.
  reason: string;
  transform: Transform | null;
  confidence: number;
  // The street names (and road numbers) that agree with the placement.
  names: string[];
  namesRead: number;
  rmsM: number | null;
  routeShare: number | null;
  runnerUp: number;
  metresPerPixel: number | null;
};

type P = [number, number];
type M = { a: number; b: number; tx: number; ty: number };
type Row = { c: [number, number, number, number]; r: number; w: number };

export function normaliseName(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’.]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\bsaint\b/g, "st")
    .replace(/\s+/g, " ")
    .trim();
}

const apply = (m: M, [x, y]: P): P => [m.a * x - m.b * y + m.tx, m.b * x + m.a * y + m.ty];
const turnOf = (m: M) => (Math.atan2(m.b, m.a) * 180) / Math.PI;
const angDiff = (x: number, y: number) => {
  const d = Math.abs((((x - y) % 180) + 180) % 180);
  return Math.min(d, 180 - d);
};

function nearestOnSeg(w: P, a: P, b: P) {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const L = vx * vx + vy * vy || 1;
  const u = Math.max(0, Math.min(1, ((w[0] - a[0]) * vx + (w[1] - a[1]) * vy) / L));
  const q: P = [a[0] + u * vx, a[1] + u * vy];
  const len = Math.sqrt(L);
  return { q, n: [-vy / len, vx / len] as P, d: Math.hypot(w[0] - q[0], w[1] - q[1]) };
}

// A row of the linear least squares for (a, b, tx, ty): the fitted point's
// distance across the street at q (normal n).
const rowFor = (p: P, q: P, n: P, w: number): Row => ({ c: [n[0] * p[0] + n[1] * p[1], n[1] * p[0] - n[0] * p[1], n[0], n[1]], r: n[0] * q[0] + n[1] * q[1], w });

// Weighted least squares, pulled slightly towards `prior` so a direction no
// row pins down stays where it was.
function solve4(rows: Row[], prior: M, lambda: number): M | null {
  const A = [0, 1, 2, 3].map(() => [0, 0, 0, 0]);
  const B = [0, 0, 0, 0];
  for (const { c, r, w } of rows)
    for (let i = 0; i < 4; i++) {
      B[i] += w * c[i] * r;
      for (let j = 0; j < 4; j++) A[i][j] += w * c[i] * c[j];
    }
  const pv = [prior.a, prior.b, prior.tx, prior.ty];
  const unit = [1e6, 1e6, 1, 1];
  for (let i = 0; i < 4; i++) {
    A[i][i] += lambda * unit[i];
    B[i] += lambda * unit[i] * pv[i];
  }
  for (let i = 0; i < 4; i++) {
    let p = i;
    for (let r = i + 1; r < 4; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
    [A[i], A[p]] = [A[p], A[i]];
    [B[i], B[p]] = [B[p], B[i]];
    if (Math.abs(A[i][i]) < 1e-12) return null;
    for (let r = i + 1; r < 4; r++) {
      const f = A[r][i] / A[i][i];
      for (let c = i; c < 4; c++) A[r][c] -= f * A[i][c];
      B[r] -= f * B[i];
    }
  }
  const x = [0, 0, 0, 0];
  for (let i = 3; i >= 0; i--) {
    let s = B[i];
    for (let c = i + 1; c < 4; c++) s -= A[i][c] * x[c];
    x[i] = s / A[i][i];
  }
  return x.every(Number.isFinite) ? { a: x[0], b: x[1], tx: x[2], ty: x[3] } : null;
}

// Every road segment on a grid, for the nearest street to a point.
function segmentGrid(roads: Road[], cell: number) {
  const grid = new Map<number, [P, P][]>();
  const key = (cx: number, cy: number) => (cx + 1e7) * 2e7 + (cy + 1e7);
  for (const r of roads)
    for (let i = 1; i < r.pts.length; i++) {
      const a = r.pts[i - 1];
      const b = r.pts[i];
      for (let cx = Math.floor(Math.min(a[0], b[0]) / cell); cx <= Math.floor(Math.max(a[0], b[0]) / cell); cx++)
        for (let cy = Math.floor(Math.min(a[1], b[1]) / cell); cy <= Math.floor(Math.max(a[1], b[1]) / cell); cy++) {
          const k = key(cx, cy);
          const list = grid.get(k);
          if (list) list.push([a, b]);
          else grid.set(k, [[a, b]]);
        }
    }
  return (w: P, maxD: number) => {
    let best: ReturnType<typeof nearestOnSeg> | null = null;
    const reach = Math.ceil(maxD / cell);
    const cx0 = Math.floor(w[0] / cell);
    const cy0 = Math.floor(w[1] / cell);
    for (let cx = cx0 - reach; cx <= cx0 + reach; cx++)
      for (let cy = cy0 - reach; cy <= cy0 + reach; cy++)
        for (const [a, b] of grid.get(key(cx, cy)) ?? []) {
          const h = nearestOnSeg(w, a, b);
          if (h.d < maxD && (!best || h.d < best.d)) best = h;
        }
    return best;
  };
}

// Points every `stepPx` along traced lines, at most `max` of them.
export function routeSamples(lines: Point[][], stepPx = 6, max = 4000): Point[] {
  const out: Point[] = [];
  for (const line of lines)
    for (let i = 1; i < line.length; i++) {
      const a = line[i - 1];
      const b = line[i];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let s = 0; s < len; s += stepPx) out.push([a[0] + ((b[0] - a[0]) * s) / len, a[1] + ((b[1] - a[1]) * s) / len]);
    }
  if (out.length <= max) return out;
  const every = out.length / max;
  return Array.from({ length: max }, (_, i) => out[Math.floor(i * every)]);
}

export function confidenceOf(names: number, rmsM: number, runnerUp: number, routeShare: number | null): number {
  const c = 0.4 * Math.min(1, Math.max(0, (names - 3) / 5)) + 0.2 * Math.max(0, 1 - rmsM / LOCATE.maxLabelRmsM) + 0.2 * Math.max(0, 1 - runnerUp / Math.max(1, names)) + 0.2 * (routeShare ?? 0.5);
  return Math.round(c * 1000) / 1000;
}

export type LocateInput = {
  labels: Label[];
  // Every road link in the job's area (named or not).
  roads: Road[];
  // Where the area is, for ground metres.
  latitude: number;
  // The compass's turn where it shows (degrees, as the line-up's rotation).
  compassTurn: number | null;
  // Points along the traced route, in image pixels.
  route: Point[];
  // Where the screenshot's middle is, in image pixels (default: of a 738 by 1600 screenshot).
  middle?: Point;
};

export function locate(input: LocateInput): LocateFit {
  const k = Math.cos((input.latitude * Math.PI) / 180);
  const G = (m: number) => m / k; // ground metres to Mercator metres
  const mid: P = input.middle ?? [369, 900];
  const byName = new Map<string, Road[]>();
  const byRef = new Map<string, Road[]>();
  for (const r of input.roads) {
    if (r.name) {
      const key = normaliseName(r.name);
      const list = byName.get(key);
      if (list) list.push(r);
      else byName.set(key, [r]);
    }
    if (r.ref) {
      const key = r.ref.toUpperCase();
      const list = byRef.get(key);
      if (list) list.push(r);
      else byRef.set(key, [r]);
    }
  }
  const candidatesOf = (l: Label) => (l.kind === "ref" ? byRef.get(l.name.toUpperCase().replace(/\s+/g, "")) : byName.get(normaliseName(l.name))) ?? [];
  // Streets first, then road numbers, at most one per bit of a 32-bit mask.
  const ordered = [...input.labels].filter((l) => l.name.trim()).sort((x, y) => (x.kind === y.kind ? 0 : x.kind === "street" ? -1 : 1));
  const namesRead = new Set(ordered.map((l) => `${l.kind}:${normaliseName(l.name)}`)).size;
  const use = ordered
    .slice(0, LOCATE.maxLabels)
    .map((l, i) => ({ ...l, p: [l.x, l.y] as P, bit: 1 << i, cands: candidatesOf(l) }))
    .filter((l) => l.cands.length > 0);
  const nameIds = new Map<string, number>();
  for (const l of use) if (!nameIds.has(l.name)) nameIds.set(l.name, nameIds.size);
  const fail = (reason: string, extra: Partial<LocateFit> = {}): LocateFit => ({ ok: false, reason, transform: null, confidence: 0, names: [], namesRead, rmsM: null, routeShare: null, runnerUp: 0, metresPerPixel: null, ...extra });
  if (namesRead === 0) return fail("No street names could be read on it");
  if (nameIds.size < 3) return fail(`Only ${nameIds.size} of the ${namesRead} names read are streets in this job's area`);

  // 1. Voting.
  const samples = use.map((l) => {
    const out: { q: P; dir: number }[] = [];
    for (const c of l.cands)
      for (let i = 1; i < c.pts.length; i++) {
        const a = c.pts[i - 1];
        const b = c.pts[i];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const dir = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
        for (let s = 0; s < len; s += G(LOCATE.sampleM)) out.push({ q: [a[0] + ((b[0] - a[0]) * s) / len, a[1] + ((b[1] - a[1]) * s) / len], dir });
      }
    return out;
  });
  const scoreOf = (mask: number) => {
    const seen = new Set<number>();
    let n = 0;
    let w = 0;
    for (const l of use) {
      if (!(mask & l.bit)) continue;
      n++;
      const id = nameIds.get(l.name)!;
      if (!seen.has(id)) {
        seen.add(id);
        w += l.kind === "ref" ? 0.5 : 1;
      }
    }
    return w + 0.25 * (n - seen.size);
  };
  const turns =
    input.compassTurn !== null ? [-3, -2, -1, 0, 1, 2, 3].map((d) => input.compassTurn! + d) : Array.from({ length: (2 * MAX_ROTATION_DEG) / LOCATE.turnStepDeg + 1 }, (_, j) => -MAX_ROTATION_DEG + LOCATE.turnStepDeg * j);
  const buckets = new Map<number, { score: number; m: M }>();
  for (let g = LOCATE.minMetresPerPixel; g <= LOCATE.maxMetresPerPixel; g *= LOCATE.scaleStep) {
    const s = G(g);
    const cell = LOCATE.voteCellPx * s;
    for (const r of turns) {
      const a = s * Math.cos((r * Math.PI) / 180);
      const b = s * Math.sin((r * Math.PI) / 180);
      const acc = new Map<number, number>();
      use.forEach((l, u) => {
        const mx = a * l.p[0] - b * l.p[1];
        const my = b * l.p[0] + a * l.p[1];
        const want = l.angle + r;
        for (const smp of samples[u]) {
          if (l.kind === "street" && angDiff(smp.dir, want) > LOCATE.angleToleranceDeg) continue;
          const key = (Math.floor((smp.q[0] - mx) / cell) + 1e7) * 2e7 + (Math.floor((smp.q[1] - my) / cell) + 1e7);
          acc.set(key, (acc.get(key) ?? 0) | l.bit);
        }
      });
      for (const [key, own] of acc) {
        if ((own & (own - 1)) === 0) continue; // one label on its own
        let mask = 0;
        for (let dx = -2e7; dx <= 2e7; dx += 2e7) for (let dy = -1; dy <= 1; dy++) mask |= acc.get(key + dx + dy) ?? 0;
        const score = scoreOf(mask);
        if (score < 2) continue;
        const cx = Math.floor(key / 2e7) - 1e7;
        const cy = (key % 2e7) - 1e7;
        const m = { a, b, tx: (cx + 0.5) * cell, ty: (cy + 0.5) * cell };
        const w = apply(m, mid);
        const bk = (Math.floor((w[0] * k) / LOCATE.distinctPlaceM) + 1e6) * 2e6 + (Math.floor((w[1] * k) / LOCATE.distinctPlaceM) + 1e6);
        const was = buckets.get(bk);
        if (!was || score > was.score) buckets.set(bk, { score, m });
      }
    }
  }
  const far = (x: M, y: M) => {
    const v = apply(x, mid);
    const w = apply(y, mid);
    return Math.hypot(v[0] - w[0], v[1] - w[1]) * k > LOCATE.distinctPlaceM;
  };
  const places: { score: number; m: M }[] = [];
  for (const c of [...buckets.values()].sort((x, y) => y.score - x.score)) {
    if (places.every((p) => far(p.m, c.m))) places.push(c);
    if (places.length >= 6) break;
  }

  // 2. Each place refined on its labels; the one most names agree with wins.
  const nearestOnStreet = (l: (typeof use)[number], w: P, maxD: number) => {
    let best: ReturnType<typeof nearestOnSeg> | null = null;
    for (const c of l.cands)
      for (let i = 1; i < c.pts.length; i++) {
        const h = nearestOnSeg(w, c.pts[i - 1], c.pts[i]);
        if (h.d < maxD && (!best || h.d < best.d)) best = h;
      }
    return best;
  };
  const refine = (m0: M, final = false) => {
    let m = m0;
    let hits: { l: (typeof use)[number]; q: P; n: P; d: number }[] = [];
    for (let it = 0; it < 10; it++) {
      const maxD = G(it < 3 && !final ? 80 : 30);
      hits = [];
      for (const l of use) {
        const h = nearestOnStreet(l, apply(m, l.p), maxD);
        if (h) hits.push({ l, q: h.q, n: h.n, d: h.d * k });
      }
      if (hits.length < 3) return null;
      if (final) break;
      const ds = hits.map((h) => h.d).sort((x, y) => x - y);
      const med = ds[Math.floor(ds.length / 2)];
      const keep = hits.filter((h) => h.d <= Math.max(20, 2.5 * med));
      const next = solve4(
        keep.map((h) => rowFor(h.l.p, h.q, h.n, h.l.kind === "ref" ? 0.5 : 1)),
        m,
        1e-7
      );
      if (!next) return null;
      m = next;
    }
    const agreeing = hits.filter((h) => h.d <= LOCATE.agreeM);
    const names = [...new Set(agreeing.map((h) => h.l.name))];
    const rms = Math.sqrt(agreeing.reduce((s, h) => s + h.d * h.d, 0) / Math.max(1, agreeing.length));
    return { m, names, rms, agreeing };
  };
  const refined = places.map((p) => refine(p.m)).filter((x): x is NonNullable<typeof x> => x !== null);
  refined.sort((x, y) => y.names.length - x.names.length || x.rms - y.rms);
  const best = refined[0];
  if (!best) return fail("No placement in this job's area fits its street names");
  const runnerUp = refined.slice(1).find((x) => far(x.m, best.m))?.names.length ?? 0;

  // 3. The route onto the streets around it, the labels holding it in place.
  let m = best.m;
  let routeShare: number | null = null;
  const route = input.route as P[];
  if (route.length > 20) {
    const nearestAny = segmentGrid(input.roads, G(150));
    for (let it = 0; it < 12; it++) {
      const maxD = G(it < 4 ? 25 : 14);
      const routeRows: Row[] = [];
      for (const p of route) {
        const h = nearestAny(apply(m, p), maxD);
        if (h) routeRows.push(rowFor(p, h.q, h.n, 0));
      }
      const labelRows: Row[] = [];
      for (const h of best.agreeing) {
        const hit = nearestOnStreet(h.l, apply(m, h.l.p), G(30));
        if (hit) labelRows.push(rowFor(h.l.p, hit.q, hit.n, h.l.kind === "ref" ? 0.5 : 1));
      }
      const wr = (3 * labelRows.length) / Math.max(1, routeRows.length);
      for (const r of routeRows) r.w = wr;
      const next = solve4([...labelRows, ...routeRows], m, 1e-9);
      if (!next || Math.abs(turnOf(next)) > MAX_ROTATION_DEG) break;
      m = next;
    }
    let close = 0;
    for (const p of route) if (nearestAny(apply(m, p), G(LOCATE.routeNearM))) close++;
    routeShare = close / route.length;
  }

  // 4. The labels again under the final placement, and the checks.
  const final = refine(m, true);
  if (!final) return fail("No placement in this job's area fits its street names");
  const turn = turnOf(m);
  const why: string[] = [];
  const needNames = route.length > 20 ? LOCATE.minNames : LOCATE.minNamesWithoutRoute;
  if (final.names.length < needNames) why.push(`only ${final.names.length} street names agree`);
  if (final.rms > LOCATE.maxLabelRmsM) why.push(`labels are ${Math.round(final.rms)} m off their streets`);
  if (runnerUp >= LOCATE.runnerUpShare * final.names.length) why.push(`another place in the area fits nearly as well`);
  if (Math.abs(turn) > MAX_ROTATION_DEG) why.push(`turned more than ${MAX_ROTATION_DEG} degrees`);
  if (input.compassTurn !== null && Math.abs(turn - input.compassTurn) > LOCATE.compassToleranceDeg) why.push("it disagrees with the compass");
  if (routeShare !== null && routeShare < LOCATE.minRouteShare) why.push(`only ${Math.round(routeShare * 100)}% of the route is on streets`);
  const transform: Transform = { scale: Math.hypot(m.a, m.b), rotationDeg: turn, offsetX: m.tx, offsetY: m.ty };
  const rmsM = Math.round(final.rms * 10) / 10;
  return {
    ok: why.length === 0,
    reason: why.length ? why.join("; ").replace(/^./, (c) => c.toUpperCase()) : "Placed",
    transform,
    confidence: why.length ? 0 : confidenceOf(final.names.length, final.rms, runnerUp, routeShare),
    names: final.names,
    namesRead,
    rmsM,
    routeShare: routeShare === null ? null : Math.round(routeShare * 1000) / 1000,
    runnerUp,
    metresPerPixel: Math.round(transform.scale * k * 1000) / 1000,
  };
}
