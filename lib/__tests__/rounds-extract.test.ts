import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { extractRoute, gapEvidence } from "@/lib/rounds/extract";
import { USUAL_TOP_BAND, detectCrop, rowChange } from "@/lib/rounds/extract/crop";
import { DEFAULT_TOLERANCE, ROUTE_CORE, ROUTE_EDGE, boxGrow, colourDistance, dropBlobs, dropThick, findDots, lineWidthOf, routeMask } from "@/lib/rounds/extract/mask";
import { close, thin } from "@/lib/rounds/extract/skeleton";
import { simplifyLine, traceLines } from "@/lib/rounds/extract/trace";
import { WORKING_HEIGHT, fullCrop, type Point, type RgbaImage } from "@/lib/rounds/extract/image";
import { SPECS, distanceToLines, makeFixture, samplePoints } from "./rounds-fixtures";

// Tracing the route off a screenshot: the colour mask, the start and end
// dots, dropping icons, the crop, thinning and tracing, and the whole
// pipeline on made-up screenshots drawn like the real MapMyRun ones (see
// rounds-fixtures.ts), scored against the true route. The real screenshots
// in lib/__tests__/fixtures/rounds/ (any letter case) are checked too, and
// scored the same way when given a <name>.json of their own true route.

const fixtures = Promise.all(SPECS.map(makeFixture));

function blank(width: number, height: number, rgb: [number, number, number] = [90, 100, 80]): RgbaImage {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) data.set([...rgb, 255], i * 4);
  return { width, height, data };
}
function paint(img: RgbaImage, x0: number, y0: number, x1: number, y1: number, rgb: [number, number, number]) {
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) img.data.set([...rgb, 255], (y * img.width + x) * 4);
}
const count = (m: Uint8Array) => m.reduce((s, v) => s + v, 0);

test("colour mask: the route's blue and its anti-aliased edge colours are in, map colours and other blues out", () => {
  assert.equal(colourDistance(ROUTE_CORE), 0);
  assert.equal(colourDistance(ROUTE_EDGE), 0);
  assert.ok(colourDistance([40, 155, 228]) < 1, "between the two");
  for (const near of [[12, 150, 222], [66, 160, 232], [30, 140, 210]] as [number, number, number][]) {
    assert.ok(colourDistance(near) <= DEFAULT_TOLERANCE, `${near}`);
  }
  const notRoute: [number, number, number][] = [
    [52, 74, 42], // grass
    [176, 172, 160], // a road
    [72, 88, 112], // a slate roof
    [36, 62, 92], // a lake
    [255, 255, 255],
    [0, 0, 0],
    [228, 38, 38], // the start dot
    [42, 186, 72], // the end dot
  ];
  for (const c of notRoute) assert.ok(colourDistance(c) > DEFAULT_TOLERANCE, `${c}`);

  const img = blank(60, 40);
  paint(img, 10, 18, 50, 24, ROUTE_CORE);
  paint(img, 10, 16, 50, 18, ROUTE_EDGE);
  paint(img, 0, 0, 5, 5, [228, 38, 38]);
  const mask = routeMask(img, fullCrop(img));
  assert.equal(count(mask), 40 * 8);
  // Nothing outside the crop.
  assert.equal(count(routeMask(img, { top: 0, bottom: 17, left: 0, right: 60 })), 40);
  // A tighter tolerance still takes the core.
  assert.equal(count(routeMask(img, fullCrop(img), 5)), 40 * 8);
});

test("dots: the round red one is the start and the round green one the end; a red stripe is neither", () => {
  // Half the working size, as the fixtures are, so the dots are their usual size for it.
  const img = blank(400, 800);
  for (let y = 0; y < 800; y++) for (let x = 0; x < 400; x++) {
    if (Math.hypot(x - 50, y - 60) <= 8) img.data.set([228, 38, 38, 255], (y * 400 + x) * 4);
    if (Math.hypot(x - 150, y - 140) <= 8) img.data.set([42, 186, 72, 255], (y * 400 + x) * 4);
  }
  paint(img, 0, 790, 400, 794, [228, 38, 38]);
  const dots = findDots(img, fullCrop(img));
  assert.ok(dots.start && Math.hypot(dots.start[0] - 50, dots.start[1] - 60) < 0.5);
  assert.ok(dots.end && Math.hypot(dots.end[0] - 150, dots.end[1] - 140) < 0.5);
  assert.deepEqual(findDots(blank(50, 50), fullCrop(blank(50, 50))), { start: null, end: null });
});

test("icons and specks are dropped; long thin pieces of route are kept, short straight ones too", () => {
  const img = { width: 400, height: 800 };
  const mask = new Uint8Array(400 * 800);
  const fill = (x0: number, y0: number, x1: number, y1: number) => {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) mask[y * 400 + x] = 1;
  };
  fill(20, 20, 35, 35); // an icon-sized square
  fill(100, 100, 103, 103); // a speck
  fill(50, 300, 350, 305); // a long stretch of route
  fill(200, 600, 235, 605); // a short straight piece
  const { kept, keptCount, removed } = dropBlobs(mask, img);
  assert.equal(keptCount, 2);
  assert.equal(removed, 2);
  assert.equal(kept[22 * 400 + 22], 0);
  assert.equal(kept[302 * 400 + 200], 1);
  assert.equal(kept[602 * 400 + 210], 1);
});

test("crop: the plain dark band at the top is left out (it holds the HYBRID underline and the location arrow); the bottom never is", async () => {
  for (const f of await fixtures) {
    const crop = detectCrop(f.image);
    assert.ok(Math.abs(crop.top - f.truth.mapTop) <= 2, `${f.name} top ${crop.top}, truly ${f.truth.mapTop}`);
    assert.equal(crop.bottom, f.image.height, `${f.name}: nothing cropped off the bottom`);
    assert.deepEqual([crop.left, crop.right], [0, f.image.width]);
    assert.ok(rowChange(f.image, 5) <= 3 && rowChange(f.image, Math.round((crop.top + crop.bottom) / 2)) > 3);
  }
  // A screenshot that starts straight into map keeps everything.
  const noisy = blank(100, 200);
  for (let i = 0; i < 100 * 200; i++) noisy.data.set([(i * 37) % 255, (i * 91) % 255, (i * 53) % 255, 255], i * 4);
  assert.deepEqual(detectCrop(noisy), fullCrop(noisy));
  // A plain top with no map found under it in the top third (a smooth field
  // or the sea): cropped where the band usually ends, 357 of 2048.
  const plain = blank(473, 1024, [30, 30, 32]);
  assert.deepEqual(detectCrop(plain), { top: Math.round(1024 * USUAL_TOP_BAND), bottom: 1024, left: 0, right: 473 });
  assert.equal(Math.round(2048 * USUAL_TOP_BAND), 357);
});

test("blue too thick to be the route (a button floating over the map) is taken out, and the route past and under it kept", () => {
  // Half the working size: the line about 5 pixels wide, a button 110 by 32.
  const img = { width: 370, height: 800 };
  const mask = new Uint8Array(370 * 800);
  const fill = (x0: number, y0: number, x1: number, y1: number) => {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) mask[y * 370 + x] = 1;
  };
  fill(130, 744, 240, 776); // the button
  fill(208, 600, 213, 800); // a route running under it to the bottom edge
  fill(260, 600, 265, 800); // a route running past it
  fill(40, 300, 300, 305); // a route elsewhere
  const { mask: out, removed } = dropThick(mask, img);
  const at = (x: number, y: number) => out[y * 370 + x];
  assert.equal(at(180, 760), 0, "the button");
  assert.equal(at(210, 700), 1, "the route above the button");
  assert.equal(at(210, 795), 1, "the route below it, to the bottom edge");
  assert.equal(at(262, 760), 1, "the route beside it");
  assert.equal(at(150, 302), 1, "the route elsewhere");
  assert.ok(removed > 110 * 32 * 0.9);
  // Nothing thick: nothing taken.
  const thin = new Uint8Array(370 * 800);
  for (let x = 20; x < 350; x++) for (let y = 400; y < 405; y++) thin[y * 370 + x] = 1;
  assert.equal(dropThick(thin, img).removed, 0);
});

test("thinning leaves a one-pixel line down the middle, and tracing gives it back as a simple line", () => {
  const width = 120;
  const height = 60;
  const mask = new Uint8Array(width * height);
  for (let y = 26; y < 34; y++) for (let x = 10; x < 110; x++) mask[y * width + x] = 1;
  const skel = thin(close(mask, width, height), width, height);
  for (let x = 20; x < 100; x++) {
    let col = 0;
    for (let y = 0; y < height; y++) col += skel[y * width + x];
    assert.equal(col, 1, `one pixel at column ${x}`);
  }
  const lines = traceLines(skel, width, height, {
    spurPx: 7,
    gapPx: 35,
    maxBridgeAngleDeg: 55,
    longGapPx: 120,
    longGapAngleDeg: 15,
    alignPx: 3,
    minLengthPx: 15,
    simplifyPx: 1.2,
  });
  assert.equal(lines.length, 1);
  assert.equal(lines[0].length, 2, "straight, so two points");
  assert.ok(Math.abs(lines[0][0][1] - 29.5) <= 1);
  assert.deepEqual(simplifyLine([[0, 0], [5, 0.3], [10, 0], [10, 10]], 1), [[0, 0], [10, 0], [10, 10]]);
});

// How well a traced route matches the true one: the share of the true route
// with a traced line within `px`, and the share of what was traced that is
// on the true route.
function score(lines: Point[][], truth: Point[][], px: number) {
  const truthPts = samplePoints(truth, 1);
  const gotPts = samplePoints(lines, 1);
  return {
    coverage: truthPts.filter((p) => distanceToLines(p, lines) <= px).length / truthPts.length,
    precision: gotPts.length ? gotPts.filter((p) => distanceToLines(p, truth) <= px).length / gotPts.length : 0,
  };
}

test("line width: measured square across the line, whichever way it runs", () => {
  for (const angle of [0, 30, 45, 60, 90]) {
    const img = blank(240, 240);
    const t = (angle * Math.PI) / 180;
    // A line 9 pixels wide through the middle.
    for (let y = 0; y < 240; y++) {
      for (let x = 0; x < 240; x++) {
        const across = Math.abs((x - 120) * Math.sin(t) - (y - 120) * Math.cos(t));
        if (across < 4.5 && Math.hypot(x - 120, y - 120) < 100) paint(img, x, y, x + 1, y + 1, ROUTE_CORE);
      }
    }
    const mask = routeMask(img, fullCrop(img));
    const width = lineWidthOf(mask, img.width, img.height)!;
    assert.ok(Math.abs(width - 9) <= 1, `at ${angle} degrees: ${width}`);
  }
});

test("a long gap is bridged only where the image shows the line goes on: its blue along the gap, or a label over it, never other streets across it", () => {
  const lineWidth = 8;
  // A street's line from x 20 to 70 and on from 150 to 200, at y 100: an
  // 80 pixel gap between.
  const scene = (fill: (img: RgbaImage) => void) => {
    const img = blank(220, 200);
    paint(img, 20, 96, 70, 104, ROUTE_CORE);
    paint(img, 150, 96, 200, 104, ROUTE_CORE);
    fill(img);
    const mask = routeMask(img, fullCrop(img));
    return gapEvidence(img, mask, lineWidth)([70, 100], [150, 100]);
  };
  assert.equal(scene(() => {}), false, "nothing there");
  // Other streets cross where the gap would go, and nothing hides the line.
  assert.equal(
    scene((img) => {
      paint(img, 92, 10, 100, 190, ROUTE_CORE);
      paint(img, 120, 10, 128, 190, ROUTE_CORE);
    }),
    false,
    "other streets across it"
  );
  // The line is there, only left out of the centre line (too thick to keep).
  assert.equal(scene((img) => paint(img, 70, 96, 150, 104, ROUTE_CORE)), true, "its own blue");
  // A label over it: white letters in a dark halo along the street.
  assert.equal(
    scene((img) => {
      paint(img, 72, 93, 148, 107, [40, 40, 40]);
      for (let x = 74; x < 146; x += 6) paint(img, x, 96, x + 3, 104, [245, 245, 245]);
    }),
    true,
    "a label over it"
  );
  // The route's own white edge is not lettering.
  assert.equal(
    scene((img) => {
      paint(img, 70, 106, 150, 108, [250, 252, 252]);
      paint(img, 70, 104, 150, 106, ROUTE_CORE);
    }),
    false,
    "white edge of a line alongside"
  );
});

test("made-up screenshots: the route traced under the labels and between the dots, nothing traced from icons, the pool or the bars", async () => {
  for (const f of await fixtures) {
    const result = extractRoute(f.image);
    const { coverage, precision } = score(result.lines, f.truth.lines, 4);
    assert.ok(coverage >= 0.95, `${f.name}: ${(coverage * 100).toFixed(1)}% of the route traced`);
    assert.ok(precision >= 0.98, `${f.name}: ${(precision * 100).toFixed(1)}% of what was traced is route`);
    for (const decoy of f.truth.decoys) {
      const near = result.lines.some((l) => l.some((p) => Math.hypot(p[0] - decoy[0], p[1] - decoy[1]) < 8));
      assert.ok(!near, `${f.name}: traced something at the blue decoy ${decoy}`);
    }
    for (const line of result.lines) for (const [, y] of line) assert.ok(y >= result.crop.top && y <= result.crop.bottom, `${f.name}: traced into the top band`);
    // The route is traced to the bottom edge, not stopped short of it.
    const lowest = Math.max(...result.lines.flatMap((l) => l.map(([, y]) => y)));
    assert.ok(lowest >= f.image.height - 8, `${f.name}: traced down to ${lowest} of ${f.image.height}`);
    // Inside the Route Flyover button, only the route that runs under it.
    const [x0, y0, x1, y1] = f.truth.pill;
    for (const p of samplePoints(result.lines, 1)) {
      if (p[0] >= x0 && p[0] <= x1 && p[1] >= y0 && p[1] <= y1) assert.ok(distanceToLines(p, f.truth.lines) <= 4, `${f.name}: traced the button at ${p}`);
    }
    for (const which of ["start", "end"] as const) {
      const truth = f.truth[which];
      const found = result[which];
      if (!truth) assert.equal(found, null, `${f.name}: no ${which} dot`);
      else assert.ok(found && Math.hypot(found[0] - truth[0], found[1] - truth[1]) < 2, `${f.name}: ${which} dot`);
    }
  }
});

test("a hand-set crop is used as given, and nothing outside it is traced", async () => {
  const f = (await fixtures).find((x) => x.name === "middle")!;
  const result = extractRoute(f.image, { crop: { top: 300, bottom: 600, left: 0, right: 370 } });
  assert.deepEqual(result.crop, { top: 300, bottom: 600, left: 0, right: 370 });
  assert.ok(result.lines.length > 0);
  for (const line of result.lines) for (const [, y] of line) assert.ok(y >= 300 && y < 600);
});

// The real screenshots, traced at the size the browser works at. Each is
// checked against what was measured on the real ones: the plain band cropped
// off the top at about row 357 of 2048, nothing cropped off the bottom,
// nothing traced in the band, and a route found that keeps to the route's
// blue (at least ON_BLUE of it within a line's width of blue; the rest is
// where labels hide the line). Bridging gaps on their angles alone, which
// drew straight lines across the streets between, kept only 0.91 to 0.96
// of it there. With a <name>.json beside a screenshot holding its true route
// ({ "lines": [[[x, y], ...], ...] } in pixels at the working size, and
// optionally "coverage"), the tracing is also scored against it.
const ON_BLUE = 0.97;
const inFolder = (dir: string, name: string) =>
  existsSync(dir) ? readdirSync(dir).find((f) => f.toLowerCase() === name && statSync(join(dir, f)).isDirectory()) : undefined;
const fixturesDir = inFolder(join("lib", "__tests__"), "fixtures");
const roundsDir = fixturesDir && inFolder(join("lib", "__tests__", fixturesDir), "rounds");
const REAL_DIR = roundsDir ? join("lib", "__tests__", fixturesDir, roundsDir) : null;
const real = REAL_DIR ? readdirSync(REAL_DIR).filter((f) => /\.(png|jpe?g|webp)$/i.test(f)) : [];

test("the real screenshots are there to check", () => {
  assert.ok(real.length >= 3, `found ${real.length} real screenshots in lib/__tests__/fixtures/rounds`);
});

for (const file of real) {
  test(`real screenshot ${file}: the top band cropped, the bottom kept, and the route traced along its blue`, async () => {
    const path = join(REAL_DIR!, file);
    const meta = await sharp(path).metadata();
    const height = Math.min(WORKING_HEIGHT, meta.height!);
    const width = Math.round((meta.width! * height) / meta.height!);
    const { data, info } = await sharp(path).resize(width, height, { kernel: "lanczos3" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const img: RgbaImage = { width: info.width, height: info.height, data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength) };
    const result = extractRoute(img);
    const usual = info.height * USUAL_TOP_BAND;
    assert.ok(Math.abs(result.crop.top - usual) <= info.height * 0.03, `${file}: top band cropped at ${result.crop.top}, usually about ${Math.round(usual)}`);
    assert.equal(result.crop.bottom, info.height, `${file}: nothing cropped off the bottom`);
    assert.ok(result.lines.length > 0, `${file}: a route traced`);
    for (const line of result.lines) for (const [, y] of line) assert.ok(y >= result.crop.top, `${file}: traced in the top band`);
    const blue = routeMask(img, result.crop);
    const lineWidth = lineWidthOf(blue, img.width, img.height)!;
    const nearBlue = boxGrow(blue, img.width, img.height, lineWidth);
    const traced = samplePoints(result.lines, 1);
    const onBlue = traced.filter(([x, y]) => nearBlue[Math.round(y) * img.width + Math.round(x)]).length / traced.length;
    assert.ok(onBlue >= ON_BLUE, `${file}: ${(onBlue * 100).toFixed(1)}% of the trace on the route's blue`);
    const truthFile = join(REAL_DIR!, file.replace(/\.[^.]+$/, ".json"));
    if (!existsSync(truthFile)) return;
    const truth = JSON.parse(readFileSync(truthFile, "utf8")) as { lines: Point[][]; coverage?: number };
    const { coverage, precision } = score(result.lines, truth.lines, 4);
    assert.ok(coverage >= (truth.coverage ?? 0.9), `${file}: ${(coverage * 100).toFixed(1)}% traced`);
    assert.ok(precision >= 0.95, `${file}: ${(precision * 100).toFixed(1)}% on the route`);
  });
}

