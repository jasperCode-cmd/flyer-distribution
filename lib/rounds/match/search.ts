import { fft2, pow2 } from "./fft";
import { boxBlur, resize, type Gray } from "./gray";
import { apply, fitSim, fromScaleTurn, invert, scaleOf, type Sim } from "./similarity";

// Finding where one screenshot's map lies in another's: a coarse search over
// scale and turn by phase correlation (which offset stands out for each), at
// low resolution; then a refinement that matches blocks of the one, warped
// into the other's pixels, near where the coarse answer puts them, and fits
// scale, turn and offset to the blocks that agree. Pure.

function bilinear(d: Float32Array, w: number, x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const ax = x - x0;
  const ay = y - y0;
  const i = y0 * w + x0;
  return d[i] * (1 - ax) * (1 - ay) + d[i + 1] * ax * (1 - ay) + d[i + w] * (1 - ax) * ay + d[i + w + 1] * ax * ay;
}

// a seen through m, in a frame w by h.
export function warp(a: Gray, m: Sim, w: number, h: number, values: Float32Array = a.d): Gray {
  const inv = invert(m);
  const d = new Float32Array(w * h);
  const valid = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [px, py] = apply(inv, x, y);
      if (px < 0 || py < 0 || px >= a.w - 1 || py >= a.h - 1) continue;
      if (!a.valid[Math.round(py) * a.w + Math.round(px)]) continue;
      d[y * w + x] = bilinear(values, a.w, px, py);
      valid[y * w + x] = 1;
    }
  }
  return { w, h, d, valid };
}

// a smoothed to the detail it keeps when shrunk by s (the more zoomed in of
// two screenshots has finer detail than the other can show).
export function matchDetail(a: Gray, s: number): Float32Array {
  if (s >= 0.9) return a.d;
  const r = Math.max(1, Math.round(0.5 / s - 0.5));
  return boxBlur(boxBlur(a.d, a.w, a.h, r), a.w, a.h, r);
}

type Spectrum = { re: Float64Array; im: Float64Array };

// The map's texture (detail, less its local average), zero where not map, by FFT.
function spectrum(g: Gray, W: number, H: number): Spectrum {
  const lo = boxBlur(g.d, g.w, g.h, 2);
  let sum = 0;
  let n = 0;
  for (let i = 0; i < g.w * g.h; i++) {
    if (g.valid[i]) {
      sum += g.d[i] - lo[i];
      n++;
    }
  }
  const mean = n ? sum / n : 0;
  const re = new Float64Array(W * H);
  const im = new Float64Array(W * H);
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      const i = y * g.w + x;
      if (g.valid[i]) re[y * W + x] = g.d[i] - lo[i] - mean;
    }
  }
  fft2(re, im, W, H);
  return { re, im };
}

export type Candidate = { m: Sim; score: number; s: number; turnDeg: number };

// Every scale and turn given: a (scaled, turned, smoothed to match) against
// b at `level` of their size; the offset that stands out most for each, and
// how far it stands out (peak against the rest of the surface). The best
// few distinct ones, most likely first. m maps a's pixels to b's.
export function coarse(a: Gray, b: Gray, level: number, scales: number[], turns: number[], keep = 3): Candidate[] {
  const B = resize(b, level);
  const out: Candidate[] = [];
  let W = 0;
  let H = 0;
  let FB: Spectrum | null = null;
  for (const s of scales) {
    const values = matchDetail(a, s);
    for (const turnDeg of turns) {
      const m0 = fromScaleTurn(s * level, turnDeg);
      const corners = [
        apply(m0, 0, 0),
        apply(m0, a.w, 0),
        apply(m0, 0, a.h),
        apply(m0, a.w, a.h),
      ];
      const minX = Math.min(...corners.map((c) => c[0]));
      const minY = Math.min(...corners.map((c) => c[1]));
      const w = Math.ceil(Math.max(...corners.map((c) => c[0])) - minX) + 1;
      const h = Math.ceil(Math.max(...corners.map((c) => c[1])) - minY) + 1;
      const m1: Sim = { ...m0, tx: -minX, ty: -minY };
      const A = warp(a, m1, w, h, values);
      const needW = pow2(Math.max(B.w, w) * 2);
      const needH = pow2(Math.max(B.h, h) * 2);
      if (!FB || needW !== W || needH !== H) {
        W = needW;
        H = needH;
        FB = spectrum(B, W, H);
      }
      const FA = spectrum(A, W, H);
      const re = new Float64Array(W * H);
      const im = new Float64Array(W * H);
      for (let i = 0; i < W * H; i++) {
        // B times A's conjugate, normalised: the offset that moves A onto B.
        const r = FB.re[i] * FA.re[i] + FB.im[i] * FA.im[i];
        const q = FB.im[i] * FA.re[i] - FB.re[i] * FA.im[i];
        const mag = Math.hypot(r, q) + 1e-9;
        re[i] = r / mag;
        im[i] = q / mag;
      }
      fft2(re, im, W, H, true);
      let peak = -Infinity;
      let at = 0;
      let sum = 0;
      let sum2 = 0;
      for (let i = 0; i < W * H; i++) {
        const v = re[i];
        sum += v;
        sum2 += v * v;
        if (v > peak) {
          peak = v;
          at = i;
        }
      }
      const mean = sum / (W * H);
      const sd = Math.sqrt(Math.max(1e-12, sum2 / (W * H) - mean * mean));
      const X = at % W;
      const Y = (at - X) / W;
      const dx = X > W / 2 ? X - W : X;
      const dy = Y > H / 2 ? Y - H : Y;
      out.push({ m: { c: m1.c / level, d: m1.d / level, tx: (m1.tx + dx) / level, ty: (m1.ty + dy) / level }, score: (peak - mean) / sd, s, turnDeg });
    }
  }
  out.sort((x, y) => y.score - x.score);
  const picked: Candidate[] = [];
  for (const c of out) {
    if (picked.some((p) => Math.abs(Math.log(p.s / c.s)) < 0.09 && Math.abs(p.turnDeg - c.turnDeg) < 2.5)) continue;
    picked.push(c);
    if (picked.length === keep) break;
  }
  return picked;
}

export type Refined = {
  m: Sim;
  // Blocks that agree on the fit, how far they spread (the shorter side of
  // their extent) and how closely they fit, in b's pixels.
  blocks: number;
  spread: number;
  rms: number;
};

export type RefineOptions = { search: number; half: number; step: number; minNcc: number };
export const REFINE: RefineOptions = { search: 10, half: 10, step: 12, minNcc: 0.6 };

// Blocks of a, warped into b's pixels by m, found near where they land.
export function refine(a: Gray, b: Gray, start: Sim, options: RefineOptions = REFINE): Refined {
  const R = options.half;
  const n = (2 * R + 1) ** 2;
  let search = options.search;
  let m = start;
  let used: { p: [number, number]; q: [number, number] }[] = [];
  for (let round = 0; round < 4; round++) {
    const wa = warp(a, m, b.w, b.h, matchDetail(a, scaleOf(m)));
    const inv = invert(m);
    const blocks: { p: [number, number]; q: [number, number] }[] = [];
    for (let y = R + search; y < b.h - R - search; y += options.step) {
      for (let x = R + search; x < b.w - R - search; x += options.step) {
        let ok = true;
        let mean = 0;
        for (let j = -R; j <= R && ok; j++) {
          for (let i = -R; i <= R; i++) {
            const k = (y + j) * b.w + x + i;
            if (!wa.valid[k]) {
              ok = false;
              break;
            }
            mean += wa.d[k];
          }
        }
        if (!ok) continue;
        mean /= n;
        let va = 0;
        for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) va += (wa.d[(y + j) * b.w + x + i] - mean) ** 2;
        // Flat blocks (water, a field) say nothing.
        if (va / n < 25) continue;
        let best = -2;
        let bx = 0;
        let by = 0;
        const scores = new Map<number, number>();
        for (let dy = -search; dy <= search; dy++) {
          for (let dx = -search; dx <= search; dx++) {
            let okb = true;
            for (let j = -R; j <= R && okb; j += 2) {
              for (let i = -R; i <= R; i += 2) {
                if (!b.valid[(y + dy + j) * b.w + x + dx + i]) {
                  okb = false;
                  break;
                }
              }
            }
            if (!okb) continue;
            let mb = 0;
            for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) mb += b.d[(y + dy + j) * b.w + x + dx + i];
            mb /= n;
            let cov = 0;
            let vb = 0;
            for (let j = -R; j <= R; j++) {
              for (let i = -R; i <= R; i++) {
                const da = wa.d[(y + j) * b.w + x + i] - mean;
                const db = b.d[(y + dy + j) * b.w + x + dx + i] - mb;
                cov += da * db;
                vb += db * db;
              }
            }
            const ncc = cov / Math.sqrt(va * vb + 1e-9);
            scores.set(dy * 1000 + dx, ncc);
            if (ncc > best) {
              best = ncc;
              bx = dx;
              by = dy;
            }
          }
        }
        if (best < options.minNcc || Math.abs(bx) === search || Math.abs(by) === search) continue;
        // To a fraction of a pixel, by a parabola each way.
        const at = (dx: number, dy: number) => scores.get(dy * 1000 + dx) ?? best;
        const sub = (l: number, c: number, r: number) => {
          const dd = l - 2 * c + r;
          return dd < 0 ? (0.5 * (l - r)) / dd : 0;
        };
        const fx = bx + sub(at(bx - 1, by), best, at(bx + 1, by));
        const fy = by + sub(at(bx, by - 1), best, at(bx, by + 1));
        blocks.push({ p: apply(inv, x, y), q: [x + fx, y + fy] });
      }
    }
    if (blocks.length < 6) return { m, blocks: blocks.length, spread: 0, rms: Infinity };
    let keep = blocks;
    for (let it = 0; it < 5; it++) {
      m = fitSim(keep);
      const res = keep.map((k) => {
        const [qx, qy] = apply(m, k.p[0], k.p[1]);
        return Math.hypot(qx - k.q[0], qy - k.q[1]);
      });
      const median = [...res].sort((x, y) => x - y)[Math.floor(res.length / 2)];
      const next = keep.filter((_, i) => res[i] <= Math.max(0.6, 2.5 * median));
      if (next.length < 6) break;
      keep = next;
    }
    m = fitSim(keep);
    used = keep;
    search = Math.max(3, Math.round(search / 2));
  }
  const res = used.map((k) => {
    const [qx, qy] = apply(m, k.p[0], k.p[1]);
    return Math.hypot(qx - k.q[0], qy - k.q[1]);
  });
  const xs = used.map((u) => u.q[0]);
  const ys = used.map((u) => u.q[1]);
  return {
    m,
    blocks: used.length,
    spread: Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)),
    rms: Math.sqrt(res.reduce((s, r) => s + r * r, 0) / res.length),
  };
}
