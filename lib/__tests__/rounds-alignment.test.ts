import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_ROTATION_DEG,
  imageToLngLat,
  lngLatToImage,
  overlayCorners,
  solveAlignment,
  toMercator,
  fromMercator,
  type PointPair,
  type Transform,
} from "@/lib/rounds/alignment";

// Lining a north-up screenshot up with the map from two pairs of clicked
// points: scale and offset only, unless both pairs need a small rotation.

// About 1 metre a pixel in Ringwood (Web Mercator stretches by 1/cos(lat)).
const RINGWOOD: [number, number] = [-1.7917, 50.8461];
function screenshotAt(rotationDeg = 0, metresPerPixel = 1.05): Transform {
  const [x, y] = toMercator(RINGWOOD);
  const scale = metresPerPixel / Math.cos((RINGWOOD[1] * Math.PI) / 180);
  return { scale, rotationDeg, offsetX: x - 370 * scale, offsetY: y - 800 * scale };
}
const pairsFor = (t: Transform, points: [number, number][], nudge: [number, number][] = []): PointPair[] =>
  points.map((p, k) => ({ image: [p[0] + (nudge[k]?.[0] ?? 0), p[1] + (nudge[k]?.[1] ?? 0)], map: imageToLngLat(t, p) }));

test("Web Mercator there and back", () => {
  for (const p of [RINGWOOD, [0, 0], [-2.95, 51.3]] as [number, number][]) {
    const [lng, lat] = fromMercator(toMercator(p));
    assert.ok(Math.abs(lng - p[0]) < 1e-9 && Math.abs(lat - p[1]) < 1e-9);
  }
});

test("two exact pairs on a north-up screenshot give its scale and offset, with no rotation", () => {
  const truth = screenshotAt(0);
  const result = solveAlignment(pairsFor(truth, [[120, 300], [600, 1350]]));
  assert.ok(result.ok);
  if (!result.ok) return;
  const a = result.alignment;
  assert.equal(a.rotated, false);
  assert.equal(a.transform.rotationDeg, 0);
  assert.ok(Math.abs(a.transform.scale - truth.scale) / truth.scale < 1e-6);
  assert.ok(Math.abs(a.transform.offsetX - truth.offsetX) < 0.01 && Math.abs(a.transform.offsetY - truth.offsetY) < 0.01);
  assert.ok(a.errorsPx.every((e) => e < 0.01));
  assert.ok(Math.abs(a.metresPerPixel - 1.05) < 0.01, `metres per pixel ${a.metresPerPixel}`);
  // Any point on the screenshot then lands where it should.
  const [lng, lat] = imageToLngLat(a.transform, [370, 800]);
  assert.ok(Math.abs(lng - RINGWOOD[0]) < 1e-7 && Math.abs(lat - RINGWOOD[1]) < 1e-7);
});

test("clicks a few pixels out stay north-up, splitting the difference", () => {
  const truth = screenshotAt(0);
  const result = solveAlignment(pairsFor(truth, [[150, 260], [610, 1300]], [[2, -1], [-1, 2]]));
  assert.ok(result.ok);
  if (!result.ok) return;
  assert.equal(result.alignment.rotated, false);
  assert.ok(result.alignment.errorsPx.every((e) => e <= 4), JSON.stringify(result.alignment.errorsPx));
  // Within a few metres of the truth anywhere on the screen.
  for (const p of [[0, 0], [740, 1600], [370, 800]] as [number, number][]) {
    const [x, y] = lngLatToImage(truth, imageToLngLat(result.alignment.transform, p));
    assert.ok(Math.hypot(x - p[0], y - p[1]) < 6, `${p}: ${x},${y}`);
  }
});

test("a screenshot turned a little is fitted with that rotation, as both pairs miss a north-up fit", () => {
  const truth = screenshotAt(3);
  const result = solveAlignment(pairsFor(truth, [[100, 200], [640, 1400]]));
  assert.ok(result.ok);
  if (!result.ok) return;
  assert.equal(result.alignment.rotated, true);
  assert.ok(Math.abs(result.alignment.transform.rotationDeg - 3) < 1e-6);
  assert.ok(result.alignment.errorsPx.every((e) => e < 0.01));
});

test("pairs that would turn the map too far are refused, with how far out they were", () => {
  const result = solveAlignment(pairsFor(screenshotAt(MAX_ROTATION_DEG + 7), [[100, 200], [640, 1400]]));
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /don't agree/);
  assert.equal(result.errorsPx?.length, 2);
  assert.ok(result.errorsPx!.every((e) => e > 4));
});

test("refused: one pair, points too close together, A and B the wrong way round, an impossible scale", () => {
  const truth = screenshotAt(0);
  const one = solveAlignment(pairsFor(truth, [[100, 200]]));
  assert.ok(!one.ok && /two points/.test(one.error));
  const close = solveAlignment(pairsFor(truth, [[100, 200], [130, 230]]));
  assert.ok(!close.ok && /too close/.test(close.error));
  const [a, b] = pairsFor(truth, [[100, 200], [640, 1400]]);
  const swapped = solveAlignment([{ image: a.image, map: b.map }, { image: b.image, map: a.map }]);
  assert.ok(!swapped.ok && /wrong way round/.test(swapped.error));
  const huge = solveAlignment(pairsFor(screenshotAt(0, 400), [[100, 200], [640, 1400]]));
  assert.ok(!huge.ok && /bigger or smaller/.test(huge.error));
  const nowhere = solveAlignment([{ image: [0, 0], map: [0, 95] }, { image: [400, 400], map: [1, 1] }]);
  assert.ok(!nowhere.ok);
});

test("the overlay's corners are where the fit puts the image's corners", () => {
  const t = screenshotAt(2);
  const [tl, tr, bl] = overlayCorners(t, 740, 1600);
  const near = (p: [number, number], q: [number, number]) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-6;
  assert.ok(near(lngLatToImage(t, tl), [0, 0]));
  assert.ok(near(lngLatToImage(t, tr), [740, 0]));
  assert.ok(near(lngLatToImage(t, bl), [0, 1600]));
});
