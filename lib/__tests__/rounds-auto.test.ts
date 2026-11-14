import { test } from "node:test";
import assert from "node:assert/strict";
import { imageToLngLat, imageToMercator, lngLatToImage, MAX_ROTATION_DEG, solveAlignment, toMercator, type Transform } from "@/lib/rounds/alignment";
import { composeTransform, flagsOf, nearest, pairsFor, pickNext, spreadPoints, traceOnMap, type AutoDraft } from "@/lib/rounds/auto";
import { fromScaleTurn, apply } from "@/lib/rounds/match/similarity";
import { validateScreenshotWork, validateWorkBatch } from "@/lib/rounds/validate";

// An automatic line-up becomes a saved one: the match (new screenshot's
// pixels to a lined-up one's) after that one's fit gives the new fit; four
// points spread over the map, sent with the measured turn, give the server
// exactly that fit back. The fit itself now takes turns up to 30 degrees,
// starting from the compass's turn where it shows. And the order work goes
// in, and what the review flags.

const RINGWOOD: [number, number] = [-1.7917, 50.8461];
function fitAt(rotationDeg: number, metresPerPixel = 1.5): Transform {
  const [x, y] = toMercator(RINGWOOD);
  const scale = metresPerPixel / Math.cos((RINGWOOD[1] * Math.PI) / 180);
  return { scale, rotationDeg, offsetX: x - 370 * scale, offsetY: y - 800 * scale };
}
const crop = { top: 275, bottom: 1600, left: 0, right: 738 };
const near = (a: [number, number], b: [number, number], tol: number) => Math.hypot(a[0] - b[0], a[1] - b[1]) < tol;

test("the new screenshot's fit is the lined-up one's fit after the match", () => {
  const ref = fitAt(-2);
  const m = fromScaleTurn(0.6, -8, -34, -270);
  const t = composeTransform(ref, m);
  for (const p of [[0, 0], [738, 1600], [200, 900]] as [number, number][]) {
    const direct = imageToMercator(ref, apply(m, p[0], p[1]));
    const composed = imageToMercator(t, p);
    assert.ok(near(direct, composed, 1e-6), `${p}`);
  }
  assert.ok(Math.abs(t.rotationDeg - -10) < 1e-9);
});

test("four spread points with the measured turn: the server's fit gives the same line-up back, exactly", () => {
  const t = composeTransform(fitAt(3), fromScaleTurn(1.2, 9, 15, -40));
  const pairs = pairsFor(t, 738, crop);
  assert.equal(pairs.length, 4);
  for (const [x, y] of spreadPoints(738, crop)) assert.ok(x > 0 && x < 738 && y > crop.top && y < 1600);
  const solved = solveAlignment(pairs, { turnDeg: t.rotationDeg });
  assert.ok(solved.ok);
  if (!solved.ok) return;
  assert.ok(solved.alignment.errorsPx.every((e) => e < 0.05), `${solved.alignment.errorsPx}`);
  assert.ok(Math.abs(solved.alignment.transform.rotationDeg - t.rotationDeg) < 1e-9);
  for (const p of [[0, 300], [738, 1600]] as [number, number][]) {
    assert.ok(near(lngLatToImage(solved.alignment.transform, imageToLngLat(t, p)), p, 0.05));
  }
  // The trace goes onto the map with the same fit.
  const onMap = traceOnMap(t, [[[100, 400], [300, 500]]], [100, 400], null);
  assert.ok(near(onMap.lines[0][0], imageToLngLat(t, [100, 400]), 1e-5));
  assert.ok(onMap.markers.start && !onMap.markers.end);
});

test("turns: up to 30 degrees, either way; the compass's turn is kept when the points agree with it", () => {
  assert.equal(MAX_ROTATION_DEG, 30);
  const clicks = (t: Transform) => [[120, 400], [610, 1350]].map(([x, y]) => ({ image: [x, y] as [number, number], map: imageToLngLat(t, [x, y]) }));
  for (const deg of [-28, -12, 8, 25]) {
    const r = solveAlignment(clicks(fitAt(deg)));
    assert.ok(r.ok, `${deg}`);
    if (r.ok) assert.ok(Math.abs(r.alignment.transform.rotationDeg - deg) < 1e-6);
  }
  const far = solveAlignment(clicks(fitAt(35)));
  assert.ok(!far.ok && /turn too far/.test(far.error));
  assert.ok(!solveAlignment(clicks(fitAt(0)), { turnDeg: 31 }).ok);
  // Clicks a pixel or two out on a screenshot turned 8 degrees: with the
  // compass's 8, the fit keeps 8 (rather than whatever the clicks imply).
  const t = fitAt(8);
  const noisy = [
    { image: [121.5, 400] as [number, number], map: imageToLngLat(t, [120, 400]) },
    { image: [610, 1351.5] as [number, number], map: imageToLngLat(t, [610, 1350]) },
  ];
  const held = solveAlignment(noisy, { turnDeg: 8 });
  assert.ok(held.ok);
  if (held.ok) {
    assert.equal(held.alignment.transform.rotationDeg, 8);
    assert.equal(held.alignment.preferredTurnDeg, 8);
    assert.ok(held.alignment.errorsPx.every((e) => e < 4));
  }
  // North-up as before when no compass shows.
  const north = solveAlignment(clicks(fitAt(0)));
  assert.ok(north.ok && north.alignment.transform.rotationDeg === 0 && !north.alignment.rotated);
});

test("what the server takes with the points: a turn within 30 degrees, and how the line-up was made", () => {
  const size = { width: 738, height: 1600 };
  const pairs = [
    { image: [100, 400], map: [-1.79, 50.85] },
    { image: [600, 1300], map: [-1.78, 50.84] },
  ];
  assert.ok(validateScreenshotWork({ pairs, turnDeg: -8.5, source: { kind: "auto", confidence: 0.82, from: "cshot00000001" } }, size).ok);
  assert.ok(validateScreenshotWork({ pairs, turnDeg: null, source: { kind: "hand" } }, size).ok);
  assert.ok(!validateScreenshotWork({ pairs, turnDeg: 31 }, size).ok);
  assert.ok(!validateScreenshotWork({ pairs, turnDeg: "8" }, size).ok);
  assert.ok(!validateScreenshotWork({ pairs, source: { kind: "auto", confidence: 2 } }, size).ok);
  assert.ok(!validateScreenshotWork({ pairs, source: { kind: "magic" } }, size).ok);
  assert.ok(validateWorkBatch({ items: [{ id: "cshot00000001", work: {} }, { id: "cshot00000002", work: {} }] }).ok);
  assert.ok(!validateWorkBatch({ items: [] }).ok);
  assert.ok(!validateWorkBatch({ items: [{ id: "cshot00000001" }, { id: "cshot00000001" }] }).ok, "the same one twice");
  assert.ok(!validateWorkBatch({ items: Array.from({ length: 101 }, (_, i) => ({ id: `cshot${String(i).padStart(8, "0")}` })) }).ok);
});

test("work grows outwards from what is lined up: nearest first, tried against the nearest three", () => {
  assert.equal(pickNext([0, 1, 2, 9, 10], [5]), 2);
  assert.equal(pickNext([12, 20], [5, 18]), 1);
  assert.equal(pickNext([], [1]), -1);
  const lined = [{ id: "a", position: 0 }, { id: "b", position: 7 }, { id: "c", position: 11 }, { id: "d", position: 30 }];
  assert.deepEqual(nearest(9, lined).map((l) => l.id), ["b", "c", "a"]);
});

test("the review flags low confidence, no route found and a turned map", () => {
  const draft = (over: Partial<AutoDraft>): AutoDraft => ({
    crop,
    pairs: [],
    turnDeg: 0,
    source: { kind: "auto", confidence: 0.9, from: null },
    lines: [[[-1.79, 50.85], [-1.78, 50.85]]],
    markers: {},
    confidence: 0.9,
    depth: 1,
    blocks: 120,
    rmsPx: 0.3,
    metresPerPixel: 1.5,
    footprint: [],
    lengthM: 700,
    ...over,
  });
  assert.deepEqual(flagsOf(draft({}), 0.6), []);
  assert.deepEqual(flagsOf(draft({ confidence: 0.45, lines: [], turnDeg: -8 }), 0.6), ["low", "no-route", "turned"]);
});
