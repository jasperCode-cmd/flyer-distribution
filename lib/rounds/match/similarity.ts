// Scale, turn and offset between two screenshots' pixels (both with y
// running down): q = [c -d; d c] p + t. The turn is clockwise in degrees,
// as alignment.ts's Transform has it, so a screenshot's turn relative to
// another is the difference of their turns on the map. Pure.

export type Sim = { c: number; d: number; tx: number; ty: number };

export const apply = (m: Sim, x: number, y: number): [number, number] => [m.c * x - m.d * y + m.tx, m.d * x + m.c * y + m.ty];

export function invert(m: Sim): Sim {
  const k = m.c * m.c + m.d * m.d;
  const c = m.c / k;
  const d = -m.d / k;
  return { c, d, tx: -(c * m.tx - d * m.ty), ty: -(d * m.tx + c * m.ty) };
}

// outer after inner.
export function compose(outer: Sim, inner: Sim): Sim {
  return {
    c: outer.c * inner.c - outer.d * inner.d,
    d: outer.d * inner.c + outer.c * inner.d,
    tx: outer.c * inner.tx - outer.d * inner.ty + outer.tx,
    ty: outer.d * inner.tx + outer.c * inner.ty + outer.ty,
  };
}

export const scaleOf = (m: Sim) => Math.hypot(m.c, m.d);
export const turnOf = (m: Sim) => (Math.atan2(m.d, m.c) * 180) / Math.PI;

export function fromScaleTurn(s: number, turnDeg: number, tx = 0, ty = 0): Sim {
  const r = (turnDeg * Math.PI) / 180;
  return { c: s * Math.cos(r), d: s * Math.sin(r), tx, ty };
}

// The same mapping for pixels k times the size on both sides (offset scales, the rest doesn't).
export const rescale = (m: Sim, k: number): Sim => ({ ...m, tx: m.tx * k, ty: m.ty * k });

// Least squares fit of q = m p over point pairs.
export function fitSim(pairs: { p: [number, number]; q: [number, number] }[]): Sim {
  const n = pairs.length;
  let px = 0;
  let py = 0;
  let qx = 0;
  let qy = 0;
  for (const { p, q } of pairs) {
    px += p[0];
    py += p[1];
    qx += q[0];
    qy += q[1];
  }
  px /= n;
  py /= n;
  qx /= n;
  qy /= n;
  let sc = 0;
  let sd = 0;
  let den = 0;
  for (const { p, q } of pairs) {
    const a = p[0] - px;
    const b = p[1] - py;
    const X = q[0] - qx;
    const Y = q[1] - qy;
    sc += a * X + b * Y;
    sd += a * Y - b * X;
    den += a * a + b * b;
  }
  const c = sc / den;
  const d = sd / den;
  return { c, d, tx: qx - (c * px - d * py), ty: qy - (d * px + c * py) };
}
