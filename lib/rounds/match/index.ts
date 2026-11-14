import { findCompass, type Compass } from "../compass";
import { detectCrop } from "../extract/crop";
import type { Crop, RgbaImage } from "../extract/image";
import { grayFor, MATCH_SCALE, resize, type Gray } from "./gray";
import { coarse, refine, type Refined } from "./search";
import { invert, rescale, scaleOf, turnOf, type Sim } from "./similarity";

// Lining a screenshot up automatically from one already lined up: where
// does its map lie in the other's? Works on the map imagery, which is the
// same Apple imagery in both, at whatever zoom and turn. First the quick
// case (the same zoom, turned as the compasses say: consecutive screenshots
// usually are), then a search over zoom (either way) and turn (near what the
// compasses say). Accepted only when enough blocks of the imagery, spread
// out, agree closely on one fit; anything less is left to line up by hand.
// On the real screenshots, matches had 171 to 798 agreeing blocks and
// screenshots that don't overlap had 5 at most. Pure.

export { MATCH_SCALE, pack, unpack, type Gray, type Packed } from "./gray";
export { apply, compose, invert, scaleOf, turnOf, type Sim } from "./similarity";

// In working-size pixels.
export const ACCEPT = { blocks: 40, spreadPx: 150, rmsPx: 1.0 };
// Below this an accepted match is flagged for a closer look.
export const LOW_CONFIDENCE = 0.6;
// The coarse search runs at this share of the matching size (a tenth of
// the working size), over these zooms either way and turns.
const LEVEL = 0.2;
const ZOOMS = (() => {
  const out: number[] = [];
  for (let e = -1.3; e <= 0.0001; e += 0.07) out.push(2 ** e);
  return out;
})();
const TURN_STEP = 2;
const TURN_REACH_COMPASS = 4;

export type Prepared = { gray: Gray; compass: Compass | null; crop: Crop };

// From a screenshot at working size: what matching needs (at half size).
export function prepareForMatch(img: RgbaImage, crop: Crop = detectCrop(img)): Prepared {
  const compass = findCompass(img, crop);
  return { gray: resize(grayFor(img, crop, compass), MATCH_SCALE), compass, crop };
}

export type MatchResult = {
  ok: boolean;
  // a's working-size pixels to b's.
  m: Sim | null;
  blocks: number;
  spreadPx: number;
  rmsPx: number;
  confidence: number;
  how: "quick" | "search" | "none";
  ms: number;
};

// 0 to 1, from how many blocks agree, how spread out they are and how closely they fit.
export function confidenceOf(blocks: number, spreadPx: number, rmsPx: number): number {
  if (blocks < ACCEPT.blocks || spreadPx < ACCEPT.spreadPx || !(rmsPx <= ACCEPT.rmsPx)) return 0;
  const many = Math.min(1, blocks / 150);
  const wide = Math.min(1, spreadPx / 300);
  const close = Math.max(0, Math.min(1, (1.2 - rmsPx) / 0.9));
  return Math.round(Math.sqrt(many) * Math.sqrt(wide) * close * 1000) / 1000;
}

function result(r: Refined | null, how: MatchResult["how"], t0: number): MatchResult {
  const k = 1 / MATCH_SCALE;
  const blocks = r?.blocks ?? 0;
  const spreadPx = (r?.spread ?? 0) * k;
  const rmsPx = (r?.rms ?? Infinity) * k;
  const confidence = confidenceOf(blocks, spreadPx, rmsPx);
  return { ok: confidence > 0, m: r ? rescale(r.m, k) : null, blocks, spreadPx, rmsPx, confidence, how: confidence > 0 ? how : "none", ms: performance.now() - t0 };
}

// a (to line up) onto b (lined up), the quick way only: at the same zoom,
// turned as their compasses say (north up where none shows).
export function quickMatch(a: Prepared, b: Prepared): MatchResult {
  const t0 = performance.now();
  const expected = (a.compass?.turnDeg ?? 0) - (b.compass?.turnDeg ?? 0);
  const quick = coarse(a.gray, b.gray, LEVEL, [1], [expected], 1)[0];
  return result(quick ? refine(a.gray, b.gray, quick.m) : null, "quick", t0);
}

// The full search: any zoom, shrinking whichever is the more zoomed in (so
// both ways), and turns near what the compasses say.
export function searchMatch(a: Prepared, b: Prepared): MatchResult {
  const t0 = performance.now();
  const expected = (a.compass?.turnDeg ?? 0) - (b.compass?.turnDeg ?? 0);
  const reach = a.compass || b.compass ? TURN_REACH_COMPASS : TURN_STEP;
  const turns: number[] = [];
  for (let t = -reach; t <= reach + 1e-9; t += TURN_STEP) turns.push(expected + t);
  const ab = coarse(a.gray, b.gray, LEVEL, ZOOMS, turns, 3);
  const ba = coarse(
    b.gray,
    a.gray,
    LEVEL,
    ZOOMS.filter((s) => s < 0.97),
    turns.map((t) => -t),
    3
  ).map((c) => ({ ...c, m: invert(c.m) }));
  const candidates = [...ab, ...ba].sort((x, y) => y.score - x.score).slice(0, 4);
  let best: Refined | null = null;
  for (const c of candidates) {
    const r = refine(a.gray, b.gray, c.m);
    if (!best || r.blocks > best.blocks) best = r;
    // Plenty already: no need to refine the rest.
    if (r.blocks >= ACCEPT.blocks * 3) break;
  }
  return result(best, "search", t0);
}

// From a known guess (a's pixels to b's, at working size): refine only. For
// checking a line-up against other screenshots it overlaps, at any zoom.
export function refineFrom(a: Prepared, b: Prepared, guess: Sim): MatchResult {
  const t0 = performance.now();
  return result(refine(a.gray, b.gray, rescale(guess, MATCH_SCALE)), "quick", t0);
}

// The quick way, then the full search.
export function matchScreenshots(a: Prepared, b: Prepared): MatchResult {
  const t0 = performance.now();
  const quick = quickMatch(a, b);
  if (quick.ok) return quick;
  const searched = searchMatch(a, b);
  return { ...searched, ms: performance.now() - t0 };
}

export function describe(m: Sim): string {
  return `scale ${scaleOf(m).toFixed(4)}, turned ${turnOf(m).toFixed(2)} degrees, offset (${m.tx.toFixed(1)}, ${m.ty.toFixed(1)})`;
}
