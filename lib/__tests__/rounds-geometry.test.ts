import { test } from "node:test";
import assert from "node:assert/strict";
import {
  distanceM,
  eraseCircle,
  linesBbox,
  linesLengthM,
  localPlane,
  roundCoords,
  roundDistanceM,
  samplesAlong,
  trimForClient,
  type LngLat,
  type Lines,
} from "@/lib/rounds/geometry";

// Routes on the map: lengths, a round's distance when its screenshots
// overlap, the eraser, and the privacy trim around the start and end dots.

const ORIGIN: LngLat = [-1.79, 50.85];
const plane = localPlane(ORIGIN[1]);
const [ox, oy] = plane.to(ORIGIN);
// A point so many metres east and north of the origin.
const at = (east: number, north: number): LngLat => plane.from([ox + east, oy + north]);

test("distances: a kilometre north is a kilometre, and lines add up their pieces", () => {
  assert.ok(Math.abs(distanceM(at(0, 0), at(0, 1000)) - 1000) < 1);
  assert.ok(Math.abs(distanceM(at(0, 0), at(300, 400)) - 500) < 1);
  const lines: Lines = [[at(0, 0), at(0, 200), at(150, 200)], [at(500, 0), at(500, 100)]];
  assert.ok(Math.abs(linesLengthM(lines) - 450) < 1);
});

test("samples along a line every few metres, ends included", () => {
  const [samples] = samplesAlong([[at(0, 0), at(0, 23), at(10, 23)]], 5);
  assert.equal(samples.length, 8);
  // Five metres apart along each straight stretch (less across the corner, as the crow flies).
  for (let k = 1; k <= 4; k++) assert.ok(Math.abs(distanceM(samples[k - 1], samples[k]) - 5) < 0.05);
  assert.ok(Math.abs(distanceM(samples[5], samples[6]) - 5) < 0.05);
  assert.deepEqual(samples[samples.length - 1], at(10, 23));
});

test("a round's distance counts a street seen in two screenshots once", () => {
  const first: Lines = [[at(0, 0), at(0, 400)]];
  const overlapping: Lines = [[at(3, 200), at(3, 600)]];
  const separate: Lines = [[at(200, 0), at(200, 300)]];
  assert.ok(Math.abs(roundDistanceM([first]) - 400) < 2);
  // Where the second carries on, it is only counted once clear of the first (12 m).
  const both = roundDistanceM([first, overlapping]);
  assert.ok(both > 585 && both <= 601, `${both}`);
  assert.ok(Math.abs(roundDistanceM([first, separate]) - 700) < 3);
  // A street walked there and back in one screenshot shows as one line, so is one length.
  assert.equal(roundDistanceM([]), 0);
});

test("the eraser takes out exactly what is inside the circle, cutting lines where they cross it", () => {
  const line: Lines = [[at(-100, 0), at(100, 0)]];
  const out = eraseCircle(line, at(0, 0), 20);
  assert.equal(out.length, 2);
  assert.ok(Math.abs(linesLengthM(out) - 160) < 0.5);
  assert.ok(Math.abs(distanceM(out[0][out[0].length - 1], at(-20, 0))) < 0.05);
  assert.ok(Math.abs(distanceM(out[1][0], at(20, 0))) < 0.05);
  // A line that misses the circle is untouched; one wholly inside goes.
  assert.deepEqual(eraseCircle([[at(-100, 50), at(100, 50)]], at(0, 0), 20), [[at(-100, 50), at(100, 50)]]);
  assert.deepEqual(eraseCircle([[at(-5, 0), at(5, 0)]], at(0, 0), 20), []);
});

test("privacy trim: nothing within 150 m of the start or end dot is left, the rest is kept", () => {
  // Out from the start dot along a street, round a corner, and back to the end dot near it.
  const start = at(0, 0);
  const end = at(30, 0);
  const route: Lines = [[start, at(0, 600), at(400, 600), at(400, 0), end]];
  const trimmed = trimForClient(route, [start, end], 150);
  for (const line of trimmed) {
    for (const p of line) {
      assert.ok(distanceM(p, start) >= 149.9 && distanceM(p, end) >= 149.9, `a point ${distanceM(p, start).toFixed(1)} m from the start`);
    }
  }
  // At least the first and last 150 m along the line are gone.
  const full = linesLengthM(route);
  assert.ok(linesLengthM(trimmed) <= full - 300 + 0.5);
  assert.ok(linesLengthM(trimmed) > full - 600);
  // No dots shown: nothing to trim.
  assert.deepEqual(trimForClient(route, [], 150), route);
  // A zero trim keeps everything.
  assert.ok(Math.abs(linesLengthM(trimForClient(route, [start, end], 0)) - full) < 0.01);
});

test("bounding box, and coordinates rounded to about 10 cm", () => {
  assert.deepEqual(linesBbox([[[1, 2], [3, -1]], [[0, 5]]]), [0, -1, 3, 5]);
  assert.equal(linesBbox([]), null);
  assert.deepEqual(roundCoords([[[-1.123456789, 50.987654321]]]), [[[-1.123457, 50.987654]]]);
});
