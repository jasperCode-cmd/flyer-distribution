import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { findCompass } from "@/lib/rounds/compass";
import { detectCrop } from "@/lib/rounds/extract/crop";
import type { RgbaImage } from "@/lib/rounds/extract/image";
import { ACCEPT, apply, confidenceOf, invert, matchScreenshots, prepareForMatch, scaleOf, turnOf, type Sim } from "@/lib/rounds/match";
import { fromScaleTurn } from "@/lib/rounds/match/similarity";
import { imageToMercator, toMercator, type Transform } from "@/lib/rounds/alignment";
import { composeTransform } from "@/lib/rounds/auto";
import { lineUp, relativeSim, type LinedUp } from "@/lib/rounds/auto-lineup";

// Lining screenshots up automatically, on the real MapMyRun screenshots:
// screenshot 3 overlaps screenshot 1 (about half of it, at 0.61 times the
// zoom and turned 8 degrees, with Apple's compass showing); screenshot 2
// barely overlaps either, so it must be refused. Then known moves of a real
// screenshot (scrolled on; zoomed and turned), where the answer is exact.

const dirIn = (dir: string, name: string) => readdirSync(dir).find((f) => f.toLowerCase() === name && statSync(join(dir, f)).isDirectory());
const fixtures = join("lib", "__tests__", dirIn(join("lib", "__tests__"), "fixtures")!);
const ROUNDS = join(fixtures, dirIn(fixtures, "rounds")!);
const file = (n: string) => join(ROUNDS, readdirSync(ROUNDS).find((f) => (n === "3" ? !/\(\d\)/.test(f) : f.includes(`(${n})`)) && /\.jpe?g$/i.test(f))!);

async function working(n: string): Promise<RgbaImage> {
  const { data, info } = await sharp(file(n)).resize(738, 1600, { kernel: "lanczos3" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength) };
}
const real = Promise.all(["1", "2", "3"].map(working));

// A screenshot made from another by a known move: what lies at its pixel p
// is what lies at the other's m(p). Outside the other, plain grey.
function moved(img: RgbaImage, m: Sim, width: number, height: number): RgbaImage {
  const data = new Uint8Array(width * height * 4).fill(128);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [sx, sy] = apply(m, x, y);
      const X = Math.round(sx);
      const Y = Math.round(sy);
      const o = (y * width + x) * 4;
      data[o + 3] = 255;
      if (X < 0 || Y < 0 || X >= img.width || Y >= img.height) continue;
      const i = (Y * img.width + X) * 4;
      data[o] = img.data[i];
      data[o + 1] = img.data[i + 1];
      data[o + 2] = img.data[i + 2];
    }
  }
  return { width, height, data };
}

test("Apple's compass: read where it shows (screenshot 3, turned about 8 degrees), not found where it doesn't", async () => {
  const [one, two, three] = await real;
  const c = findCompass(three, detectCrop(three));
  assert.ok(c, "screenshot 3's compass");
  assert.ok(c!.turnDeg < -7 && c!.turnDeg > -10.5, `turn ${c!.turnDeg}`);
  assert.equal(findCompass(one, detectCrop(one)), null);
  assert.equal(findCompass(two, detectCrop(two)), null);
});

test("the real pair: screenshot 3 is lined up on screenshot 1 (and 1 on 3); screenshot 2 is refused against both", async () => {
  const [one, two, three] = (await real).map((img) => prepareForMatch(img));
  const a = matchScreenshots(three, one);
  assert.ok(a.ok, `3 onto 1: ${a.blocks} blocks`);
  assert.ok(Math.abs(scaleOf(a.m!) - 0.6067) < 0.004, `scale ${scaleOf(a.m!)}`);
  assert.ok(Math.abs(turnOf(a.m!) + 7.91) < 0.3, `turn ${turnOf(a.m!)}`);
  // Where screenshot 3's middle lands on screenshot 1, against the prototype's full-size answer.
  const [x, y] = apply(a.m!, 369, 940);
  const [ex, ey] = apply(fromScaleTurn(0.6066, -7.91, -34.3, -270.4), 369, 940);
  assert.ok(Math.hypot(x - ex, y - ey) < 3, `${x},${y} against ${ex},${ey}`);
  assert.ok(a.blocks >= ACCEPT.blocks && a.confidence > 0);
  const b = matchScreenshots(one, three);
  assert.ok(b.ok, `1 onto 3: ${b.blocks} blocks`);
  assert.ok(Math.abs(scaleOf(b.m!) * scaleOf(a.m!) - 1) < 0.01);
  for (const other of [one, three]) {
    const r = matchScreenshots(two, other);
    assert.equal(r.ok, false, `screenshot 2 refused (${r.blocks} blocks)`);
    assert.ok(r.blocks < 10);
  }
});

test("known moves of a real screenshot: scrolled on at the same zoom (the quick case), and zoomed and turned", async () => {
  const [one] = await real;
  const base = prepareForMatch(one);
  // Scrolled on by 300 px: exact, and found the quick way.
  const scrolled = prepareForMatch(moved(one, { c: 1, d: 0, tx: 0, ty: 300 }, 738, 1600));
  const r1 = matchScreenshots(scrolled, base);
  assert.ok(r1.ok, `scrolled: ${r1.blocks} blocks`);
  assert.equal(r1.how, "quick");
  assert.ok(Math.abs(scaleOf(r1.m!) - 1) < 0.002 && Math.abs(turnOf(r1.m!)) < 0.15 && Math.abs(r1.m!.ty - 300) < 1, JSON.stringify(r1.m));
  // Zoomed in (each new pixel is 0.8 of the old) and turned 5 degrees.
  const truth = fromScaleTurn(0.8, 5, 120, 380);
  const zoomed = prepareForMatch(moved(one, truth, 738, 1600));
  const r2 = matchScreenshots(zoomed, base);
  assert.ok(r2.ok, `zoomed and turned: ${r2.blocks} blocks`);
  for (const [px, py] of [[100, 400], [600, 1300]]) {
    const [x, y] = apply(r2.m!, px, py);
    const [ex, ey] = apply(truth, px, py);
    assert.ok(Math.hypot(x - ex, y - ey) < 2, `${px},${py}: ${x.toFixed(1)},${y.toFixed(1)} against ${ex},${ey}`);
  }
  // And the other way round.
  const back = matchScreenshots(base, zoomed);
  assert.ok(back.ok);
  const [bx, by] = apply(back.m!, ...apply(truth, 300, 900));
  assert.ok(Math.hypot(bx - 300, by - 900) < 2.5, `${bx},${by}`);
  assert.ok(Math.abs(scaleOf(invert(back.m!)) - 0.8) < 0.01);
});

test("lining one up from several: the first match, then the others it overlaps, fitted together", async () => {
  const [one] = await real;
  // A screenshot's fit on the map near Ringwood, and two more made from it by known moves.
  const [x, y] = toMercator([-1.7917, 50.8461]);
  const base: Transform = { scale: 1.6, rotationDeg: 0, offsetX: x, offsetY: y };
  const moveB = fromScaleTurn(1, 0, 0, 250);
  const moveC = fromScaleTurn(1, 0, 180, 120);
  const B = moved(one, moveB, 738, 1600);
  const C = moved(one, moveC, 738, 1600);
  const prepA = prepareForMatch(one);
  const prepB = prepareForMatch(B);
  const truthB = composeTransform(base, moveB);
  const truthC = composeTransform(base, moveC);
  const refs = new Map<string, LinedUp>([
    ["a", { prepared: () => prepA, transform: base, confidence: 1, depth: 0, width: 738, height: 1600 }],
    ["b", { prepared: () => prepB, transform: truthB, confidence: 0.9, depth: 1, width: 738, height: 1600 }],
  ]);
  const r = lineUp(prepareForMatch(C), 738, 1600, refs, ["b", "a"]);
  assert.ok(r, "lined up");
  assert.ok(r!.used >= 2, `${r!.used} screenshots used in the fit`);
  assert.equal(r!.depth, 1, "the shortest chain back to a line-up by hand");
  for (const p of [[0, 300], [738, 1600], [369, 900]] as [number, number][]) {
    const got = imageToMercator(r!.transform, p);
    const want = imageToMercator(truthC, p);
    assert.ok(Math.hypot(got[0] - want[0], got[1] - want[1]) < 1.6 * 1.5, `${p}: ${Math.hypot(got[0] - want[0], got[1] - want[1]).toFixed(2)} m`);
  }
  // The relation between two fits, back out: C's (100, 500) is B's (100 + 180, 500 + 120 - 250).
  const [px, py] = apply(relativeSim(truthC, truthB), 100, 500);
  assert.ok(Math.hypot(px - 280, py - 370) < 1e-6, `${px},${py}`);
});

test("confidence: none below the acceptance bar; more for more, wider, closer agreeing blocks", () => {
  assert.equal(confidenceOf(ACCEPT.blocks - 1, 400, 0.2), 0);
  assert.equal(confidenceOf(200, ACCEPT.spreadPx - 1, 0.2), 0);
  assert.equal(confidenceOf(200, 400, ACCEPT.rmsPx + 0.01), 0);
  assert.equal(confidenceOf(200, 400, 0.2), 1);
  const some = confidenceOf(60, 200, 0.5);
  assert.ok(some > 0 && some < confidenceOf(150, 300, 0.3));
});
