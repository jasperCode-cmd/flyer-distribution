import { imageToMercator, mercatorToImage, type Transform } from "./alignment";
import { composeTransform, usableTurn } from "./auto";
import { quickMatch, refineFrom, searchMatch, type MatchResult, type Prepared, type Sim } from "./match";

// Lining up one screenshot from those already lined up. The first match
// (the quick way against the nearest few, then the full search against the
// nearest two) gives a line-up; then every other lined-up screenshot it
// overlaps is checked from that line-up (refining only, so any zoom), and
// one line-up is fitted to all that agree, the shortest chains back to a
// line-up by hand counting most. That keeps small errors from adding up
// along a long run of screenshots. Pure; used by the background worker.

export type LinedUp = { prepared: () => Prepared; transform: Transform; confidence: number; depth: number; width: number; height: number };

export type LineUpResult = {
  transform: Transform;
  confidence: number;
  // Links back to a line-up by hand (1 when matched straight to one).
  depth: number;
  from: string;
  blocks: number;
  rmsPx: number;
  how: MatchResult["how"];
  // How many lined-up screenshots the fit used.
  used: number;
};

// Overlapping screenshots checked besides the first match.
export const MAX_EXTRA = 4;

// b's pixels from a's, given both fits on the map.
export function relativeSim(a: Transform, b: Transform): Sim {
  const o = mercatorToImage(b, imageToMercator(a, [0, 0]));
  const x = mercatorToImage(b, imageToMercator(a, [1, 0]));
  return { c: x[0] - o[0], d: x[1] - o[1], tx: o[0], ty: o[1] };
}

const centreOf = (t: Transform, w: number, h: number) => imageToMercator(t, [w / 2, h / 2]);

// One fit to points from several matches, weighted: least squares for a scale,
// turn and offset from image pixels to Web Mercator metres.
export function fitWeighted(samples: { p: [number, number]; q: [number, number]; w: number }[]): Transform | null {
  let sw = 0;
  let px = 0;
  let py = 0;
  let qx = 0;
  let qy = 0;
  for (const s of samples) {
    sw += s.w;
    px += s.w * s.p[0];
    py += s.w * s.p[1];
    qx += s.w * s.q[0];
    qy += s.w * s.q[1];
  }
  if (sw <= 0) return null;
  px /= sw;
  py /= sw;
  qx /= sw;
  qy /= sw;
  let dot = 0;
  let cross = 0;
  let norm = 0;
  for (const s of samples) {
    const a = s.p[0] - px;
    const b = s.p[1] - py;
    const X = s.q[0] - qx;
    const Y = s.q[1] - qy;
    dot += s.w * (a * X + b * Y);
    cross += s.w * (a * Y - b * X);
    norm += s.w * (a * a + b * b);
  }
  if (norm === 0) return null;
  const c = dot / norm;
  const d = cross / norm;
  return { scale: Math.hypot(c, d), rotationDeg: (Math.atan2(d, c) * 180) / Math.PI, offsetX: qx - (c * px - d * py), offsetY: qy - (d * px + c * py) };
}

export function lineUp(a: Prepared, width: number, height: number, refs: Map<string, LinedUp>, nearestIds: string[]): LineUpResult | null {
  // 1. A first match.
  const tries: { id: string; how: (x: Prepared, y: Prepared) => MatchResult }[] = [
    ...nearestIds.map((id) => ({ id, how: quickMatch })),
    ...nearestIds.slice(0, 2).map((id) => ({ id, how: searchMatch })),
  ];
  let first: { id: string; match: MatchResult; transform: Transform } | null = null;
  for (const { id, how } of tries) {
    const ref = refs.get(id);
    if (!ref) continue;
    const match = how(a, ref.prepared());
    if (!match.ok || !match.m) continue;
    const transform = composeTransform(ref.transform, match.m);
    if (!usableTurn(transform)) continue;
    first = { id, match, transform };
    break;
  }
  if (!first) return null;
  // 2. Other lined-up screenshots it overlaps, checked from this line-up.
  const here = centreOf(first.transform, width, height);
  // Close enough to overlap well: within about half a screen.
  const reach = first.transform.scale * Math.max(width, height) * 0.55;
  const extras = [...refs.entries()]
    .filter(([id]) => id !== first!.id)
    .map(([id, ref]) => {
      const c = centreOf(ref.transform, ref.width, ref.height);
      return { id, ref, gap: Math.hypot(c[0] - here[0], c[1] - here[1]) };
    })
    .filter((x) => x.gap < reach)
    .sort((x, y) => x.gap - y.gap)
    .slice(0, MAX_EXTRA);
  const agreeing: { ref: LinedUp; m: Sim; confidence: number }[] = [{ ref: refs.get(first.id)!, m: first.match.m!, confidence: first.match.confidence }];
  for (const { ref } of extras) {
    const r = refineFrom(a, ref.prepared(), relativeSim(first.transform, ref.transform));
    if (r.ok && r.m) agreeing.push({ ref, m: r.m, confidence: r.confidence });
  }
  // 3. One fit to them all: points over the map, each where every agreeing
  //    screenshot puts it (if it shows that point), shorter chains weighing more.
  let transform = first.transform;
  if (agreeing.length > 1) {
    const samples: { p: [number, number]; q: [number, number]; w: number }[] = [];
    for (const { ref, m } of agreeing) {
      const w = 1 / (1 + ref.depth) ** 2;
      for (let gy = 0.25; gy < 1; gy += 0.1) {
        for (let gx = 0.08; gx < 1; gx += 0.12) {
          const p: [number, number] = [gx * width, gy * height];
          const q: [number, number] = [m.c * p[0] - m.d * p[1] + m.tx, m.d * p[0] + m.c * p[1] + m.ty];
          if (q[0] < 0 || q[1] < 0 || q[0] > ref.width || q[1] > ref.height) continue;
          samples.push({ p, q: imageToMercator(ref.transform, q), w });
        }
      }
    }
    const joint = fitWeighted(samples);
    if (joint && usableTurn(joint)) transform = joint;
  }
  const depth = 1 + Math.min(...agreeing.map((x) => x.ref.depth));
  const confidence = Math.max(...agreeing.map((x) => Math.min(x.confidence, x.ref.confidence)));
  return { transform, confidence, depth, from: first.id, blocks: first.match.blocks, rmsPx: first.match.rmsPx, how: first.match.how, used: agreeing.length };
}
