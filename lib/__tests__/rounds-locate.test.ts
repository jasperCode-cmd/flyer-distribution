import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { join } from "node:path";
import sharp from "sharp";
import { postcodeGeometry } from "@/lib/area-planner/data";
import { imageToMercator, type Transform } from "@/lib/rounds/alignment";
import { composeTransform } from "@/lib/rounds/auto";
import { findCompass } from "@/lib/rounds/compass";
import { detectCrop, extractRoute } from "@/lib/rounds/extract";
import type { RgbaImage } from "@/lib/rounds/extract/image";
import { areaBoxes, areaLatitude, AREA_MARGIN_M } from "@/lib/rounds/locate/area";
import { confidenceOf, locate, normaliseName, routeSamples, type Label } from "@/lib/rounds/locate/fit";
import { labelPrompt, parseReading } from "@/lib/rounds/locate/labels";
import { costUsd, tokensOf } from "@/lib/rounds/locate/pricing";
import { roadsIn, roadsManifest } from "@/lib/rounds/locate/roads";
import { cellsMeeting, decodeCell } from "@/lib/rounds/locate/roads-format";
import { fromScaleTurn } from "@/lib/rounds/match/similarity";

// Locate on the three real screenshots: each placed from its street-name
// labels alone (as recorded from Claude's reading, in the fixtures) against
// the bundled OS Open Roads data, inside the job's area. Screenshots 1 and 3
// overlap, so where each is placed on its own can be checked against the
// imagery match between them. A job whose area is elsewhere, or a reading
// with too few labels, must be refused rather than placed.

const dirIn = (dir: string, name: string) => readdirSync(dir).find((f) => f.toLowerCase() === name && statSync(join(dir, f)).isDirectory());
const fixtures = join("lib", "__tests__", dirIn(join("lib", "__tests__"), "fixtures")!);
const ROUNDS = join(fixtures, dirIn(fixtures, "rounds")!);
const file = (n: string) => join(ROUNDS, readdirSync(ROUNDS).find((f) => (n === "3" ? !/\(\d\)/.test(f) : f.includes(`(${n})`)) && /\.jpe?g$/i.test(f))!);
const READINGS = JSON.parse(readFileSync(join(ROUNDS, "locate-readings.json"), "utf8")).readings as Record<string, unknown>;

async function working(n: string): Promise<RgbaImage> {
  const { data, info } = await sharp(file(n)).resize(738, 1600, { kernel: "lanczos3" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength) };
}

// What the browser sends with each screenshot: its compass turn and points along its traced route.
const shots = Promise.all(
  ["1", "2", "3"].map(async (n) => {
    const img = await working(n);
    const crop = detectCrop(img);
    const compass = findCompass(img, crop);
    return { n, labels: parseReading(READINGS[n], 738, 1600), compassTurn: compass ? compass.turnDeg : null, route: routeSamples(extractRoute(img, { crop }).lines) };
  })
);

async function areaOf(codes: string[]) {
  const geometries = await Promise.all(codes.map((c) => postcodeGeometry(c)));
  const boxes = areaBoxes(geometries.filter(Boolean));
  return { boxes, latitude: areaLatitude(boxes), roads: await roadsIn(boxes) };
}
const job = areaOf(["SO18", "SO19", "SO30", "SO31"]);

test("the three real screenshots are placed from their street names, in the job's area, and screenshots 1 and 3 agree", async () => {
  const area = await job;
  const fits = new Map<string, ReturnType<typeof locate>>();
  for (const s of await shots) {
    const started = Date.now();
    const fit = locate({ labels: s.labels, roads: area.roads, latitude: area.latitude, compassTurn: s.compassTurn, route: s.route });
    fits.set(s.n, fit);
    assert.ok(fit.ok, `screenshot ${s.n}: ${fit.reason}`);
    assert.ok(fit.names.length >= 10, `screenshot ${s.n}: ${fit.names.length} names agree`);
    assert.ok(fit.rmsM! < 10, `screenshot ${s.n}: labels ${fit.rmsM} m off`);
    assert.ok(fit.routeShare! > 0.7, `screenshot ${s.n}: ${fit.routeShare} of the route on streets`);
    assert.ok(fit.confidence >= 0.6, `screenshot ${s.n}: confidence ${fit.confidence}`);
    assert.ok(Date.now() - started < 20000);
  }
  const mpp = (n: string) => fits.get(n)!.metresPerPixel!;
  assert.ok(Math.abs(mpp("1") - 2.49) < 0.06, `1: ${mpp("1")} m a pixel`);
  assert.ok(Math.abs(mpp("2") - 1.63) < 0.05, `2: ${mpp("2")} m a pixel`);
  assert.ok(Math.abs(mpp("3") - 1.51) < 0.05, `3: ${mpp("3")} m a pixel`);
  assert.ok(Math.abs(fits.get("1")!.transform!.rotationDeg) < 1.5);
  assert.ok(Math.abs(fits.get("3")!.transform!.rotationDeg + 7.9) < 1.5, `3 turned ${fits.get("3")!.transform!.rotationDeg}`);
  // Screenshot 3 placed on its own, against screenshot 1 placed on its own and the imagery match (3 onto 1).
  const t1 = fits.get("1")!.transform!;
  const t3 = fits.get("3")!.transform!;
  const rel = fromScaleTurn(0.6067, -7.91, -34.4, -270.7);
  const via1: Transform = composeTransform(t1, rel);
  const k = Math.cos((area.latitude * Math.PI) / 180);
  const gaps: number[] = [];
  for (let y = 300; y <= 1450; y += 50)
    for (let x = 20; x <= 720; x += 50) {
      const q = [rel.c * x - rel.d * y + rel.tx, rel.d * x + rel.c * y + rel.ty];
      if (q[0] < 0 || q[0] > 738 || q[1] < 280 || q[1] > 1460) continue;
      const a = imageToMercator(t3, [x, y]);
      const b = imageToMercator(via1, [x, y]);
      gaps.push(Math.hypot(a[0] - b[0], a[1] - b[1]) * k);
    }
  const mean = gaps.reduce((s, g) => s + g, 0) / gaps.length;
  assert.ok(gaps.length > 100 && mean < 6 && Math.max(...gaps) < 12, `screenshots 1 and 3 disagree by ${mean.toFixed(1)} m on average, ${Math.max(...gaps).toFixed(1)} m at most`);
});

test("a job whose area is elsewhere (Bournemouth) refuses all three; never placed in the wrong area", async () => {
  const bh = await areaOf(["BH1", "BH2", "BH3", "BH4", "BH5", "BH6", "BH7", "BH8", "BH9", "BH10", "BH11", "BH12"]);
  for (const s of await shots) {
    const fit = locate({ labels: s.labels, roads: bh.roads, latitude: bh.latitude, compassTurn: s.compassTurn, route: s.route });
    assert.equal(fit.ok, false, `screenshot ${s.n} placed in Bournemouth`);
    assert.ok(fit.reason.length > 0);
  }
});

test("with only five street labels, all three are refused: five names can fit more than one place, so it takes six", async () => {
  const area = await job;
  for (const s of await shots) {
    const few = s.labels.filter((l) => l.kind === "street").slice(0, 5);
    const fit = locate({ labels: few, roads: area.roads, latitude: area.latitude, compassTurn: s.compassTurn, route: s.route });
    assert.equal(fit.ok, false, `screenshot ${s.n} placed from five labels`);
  }
});

test("no names, or names not in the area, are refused with a reason", async () => {
  const area = await job;
  const [one] = await shots;
  assert.match(locate({ labels: [], roads: area.roads, latitude: area.latitude, compassTurn: null, route: one.route }).reason, /No street names/);
  const elsewhere: Label[] = ["Old Christchurch Road", "Holdenhurst Road", "Wimborne Road", "Lansdowne Road"].map((name, i) => ({ kind: "street", name, x: 100 + i * 100, y: 500, angle: 0 }));
  assert.match(locate({ labels: elsewhere, roads: area.roads, latitude: area.latitude, compassTurn: null, route: one.route }).reason, /streets in this job's area/);
});

test("the bundled OS Open Roads data: manifest, attribution, and a known road where it should be", async () => {
  const m = (await roadsManifest())!;
  assert.ok(m && m.links > 200000 && Object.keys(m.cells).length > 100);
  assert.equal(m.attribution, "Contains OS data © Crown copyright and database right 2026");
  // Hamble Lane (the B3397) in screenshot 2's area.
  const area = await job;
  const hamble = area.roads.filter((r) => r.name === "Hamble Lane");
  assert.ok(hamble.some((r) => r.ref === "B3397"));
  // A cell file decodes to the same roads.
  const [key] = cellsMeeting([hamble[0].pts[0][0], hamble[0].pts[0][1], hamble[0].pts[0][0], hamble[0].pts[0][1]], m.cellM, 0);
  const roads = decodeCell(gunzipSync(readFileSync(join("data", "os-roads", "cells", `${key}.bin.gz`))), key, m.cellM);
  assert.ok(roads.length === m.cells[key].links && roads.some((r) => r.name === "Hamble Lane"));
});

test("areas, names, readings and costs", () => {
  // A small area widened by the margin on the ground, and overlapping boxes merged.
  const square = (lng: number, lat: number) => ({ type: "Polygon", coordinates: [[[lng, lat], [lng + 0.01, lat], [lng + 0.01, lat + 0.01], [lng, lat + 0.01], [lng, lat]]] });
  const boxes = areaBoxes([square(-1.4, 50.9), square(-1.395, 50.905), square(-1.0, 50.9)]);
  assert.equal(boxes.length, 2);
  const k = Math.cos((50.905 * Math.PI) / 180);
  const widthM = (boxes[1][2] - boxes[1][0]) * k;
  assert.ok(Math.abs(widthM - (0.01 * 111320 * Math.cos((50.905 * Math.PI) / 180) + 2 * AREA_MARGIN_M)) < 30, `${widthM}`);
  assert.equal(normaliseName("St. Mary's  Road"), normaliseName("Saint Marys Road"));
  assert.equal(normaliseName("Bitterne Road East"), "bitterne road east");
  // Readings: kinds mapped, angles folded, anything outside the image dropped.
  const labels = parseReading({ labels: [{ kind: "road_number", name: "A27", x: 10, y: 10, angle: 0 }, { kind: "street", name: " Pine  Drive ", x: 5, y: 5, angle: 120 }, { kind: "street", name: "Off Map", x: 900, y: 5, angle: 0 }, { kind: "place", name: "Sholing", x: 5, y: 5, angle: 0 }] }, 738, 1600);
  assert.deepEqual(labels, [{ kind: "ref", name: "A27", x: 10, y: 10, angle: 0 }, { kind: "street", name: "Pine Drive", x: 5, y: 5, angle: -60 }]);
  assert.throws(() => parseReading({ nope: 1 }, 738, 1600));
  assert.match(labelPrompt(738, 1600), /738 by 1600/);
  // Costs: at Opus 5.5's price, and a fallback attempt at its own model's price.
  assert.equal(costUsd({ input_tokens: 2000, output_tokens: 1000 }), 0.028);
  const withFallback = costUsd({ input_tokens: 0, output_tokens: 0, iterations: [{ type: "message", input_tokens: 2000, output_tokens: 0 }, { type: "fallback_message", model: "claude-opus-4-8", input_tokens: 2000, output_tokens: 1000 }] });
  assert.ok(Math.abs(withFallback - (0.008 + 0.035)) < 1e-9, `${withFallback}`);
  assert.deepEqual(tokensOf({ input_tokens: 5, output_tokens: 6 }), { input: 5, output: 6 });
  assert.ok(confidenceOf(18, 5, 2, 0.85) > 0.8 && confidenceOf(4, 14, 3, 0.6) < 0.6);
  assert.deepEqual(routeSamples([[[0, 0], [12, 0]]], 6), [[0, 0], [6, 0]]);
});
