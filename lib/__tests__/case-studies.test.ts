// The case studies page (/case-studies): the car dealership campaign leads it,
// with the given words, its two area links and its bottom link, and four route
// maps cropped to their slots in the same collage as the "Across Hampshire"
// card; the copy rules; the sitemap date. And (with a local production build
// and Playwright) in a real browser at 390, 1024 and 1440: nothing stretched,
// nothing overflowing, and the same spacing as the "Across Hampshire" card:
//   QUOTE_FORM_TEST_URL=http://127.0.0.1:3200 NODE_PATH=$(npm root -g) npm test
// The browser checks are skipped otherwise. Requests off the test server are blocked.
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import sitemap from "@/app/sitemap";

const SITE = "https://www.flyerdistributionhampshire.co.uk";
const DESCRIPTION =
  "Printed and delivered across October and November for a Hampshire car dealership launching its new showroom. We covered eleven areas, from Lymington, Brockenhurst and Ringwood through to Chandler's Ford, Eastleigh, Bitterne, Midanbury, Harefield, Hedge End, Bursledon and Whiteley, and the dealership had showroom visits booked off the back of the campaign.";
// The four maps, big one first, then the three stacked from the top: each file's
// size, and the shape of its slot in the collage at lg (width per height).
const MAPS = [
  { town: "Bursledon", file: "car-dealership-route-bursledon.webp", size: [1154, 1448], slot: 0.797, original: "bursledon-route.webp" },
  { town: "Bitterne Park", file: "car-dealership-route-bitterne-park.webp", size: [1200, 745], slot: 1.611, original: "bitterne-park-route.webp" },
  { town: "Brockenhurst", file: "car-dealership-route-brockenhurst.webp", size: [1184, 735], slot: 1.611, original: "brockenhurst-route.webp" },
  { town: "Lymington", file: "car-dealership-route-lymington.webp", size: [1200, 745], slot: 1.611, original: "lymington-route.webp" },
];

type Rendered = { html: string; metadata: Record<string, any> };
let rendered: Rendered | undefined;
function render(): Rendered {
  if (!rendered) {
    const run = spawnSync(process.execPath, ["--import", "tsx", "lib/__tests__/render-case-studies.ts"], { encoding: "utf8" });
    assert.equal(run.status, 0, run.stderr);
    rendered = JSON.parse(run.stdout) as Rendered;
  }
  return rendered;
}
const decode = (s: string) => s.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
const textOf = (html: string) => decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").replace(/ ([,.])/g, "$1").trim();
const CARD = '<div class="group bg-white rounded-lg border';
// Each card's markup, in order.
function cards() {
  const html = render().html;
  const starts: number[] = [];
  for (let i = html.indexOf(CARD); i >= 0; i = html.indexOf(CARD, i + 1)) starts.push(i);
  const end = html.indexOf("</section>", starts.at(-1));
  return starts.map((start, i) => html.slice(start, starts[i + 1] ?? end));
}
const linksIn = (part: string) => [...part.matchAll(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => [decode(m[1]), textOf(m[2])]);
// A WebP file's width and height, from its header.
function webpSize(path: string) {
  const b = readFileSync(path);
  assert.equal(b.toString("ascii", 0, 4) + b.toString("ascii", 8, 12), "RIFFWEBP", path);
  const kind = b.toString("ascii", 12, 16);
  if (kind === "VP8 ") return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  if (kind === "VP8L") {
    const bits = b.readUInt32LE(21);
    return [(bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1];
  }
  assert.equal(kind, "VP8X", path);
  return [b.readUIntLE(24, 3) + 1, b.readUIntLE(27, 3) + 1];
}

test("the car dealership campaign is the first of seven cards, in the given words", () => {
  const all = cards();
  assert.deepEqual(
    all.map((card) => textOf(/<h2[^>]*>([\s\S]*?)<\/h2>/.exec(card)![1])),
    ["Southampton, Eastleigh and the New Forest", "West Wellow", "Across Hampshire", "Oakley", "Micheldever & Winchester Area", "West End", "Petersfield"]
  );
  const card = all[0];
  // The label (shown in capitals, as on the "Across Hampshire" card), the title, the pill, the description.
  assert.match(card, /<p class="text-xs font-semibold uppercase tracking-widest text-blue-500 mb-1">Print and Deliver<\/p>/);
  const words = card.slice(card.indexOf('<div class="p-6">'));
  assert.equal(textOf(/<span[^>]*>([\s\S]*?)<\/span>/.exec(words)![1]), "10,000 Leaflets (Car Dealership Launch)");
  const description = /<p class="text-gray-600[^"]*">([\s\S]*?)<\/p>/.exec(words)![1];
  assert.equal(textOf(description), DESCRIPTION);
  // Lymington and Brockenhurst link to their area pages, which exist; the link at the bottom to /leaflet-delivery.
  assert.deepEqual(linksIn(description), [
    ["/areas/leaflet-distribution-lymington", "Lymington"],
    ["/areas/leaflet-distribution-brockenhurst", "Brockenhurst"],
  ]);
  for (const [href] of linksIn(description)) assert.ok(existsSync(join("app", `${href}/page.tsx`)), href);
  assert.deepEqual(linksIn(card).at(-1), ["/leaflet-delivery", "Learn about Leaflet Distribution →"]);
  assert.equal(linksIn(card).length, 3);
});

test("its card is built like the \"Across Hampshire\" card: the same elements and classes, but for its two area links", () => {
  const [ours, , across] = cards();
  // Every class attribute in order, but for the description's inline links (ours has two, Across Hampshire one).
  const classes = (card: string) =>
    [...card.matchAll(/class="([^"]*)"/g)].map((m) => m[1]).filter((c) => c !== "text-blue-700 hover:underline font-medium");
  assert.deepEqual(classes(ours), classes(across));
  // The same collage: one big map on the left, three stacked on the right (and a two by two grid on narrower cards).
  const tiles = (card: string) => [...card.matchAll(/<div class="relative"( style="[^"]*")?><img [^>]*sizes="([^"]+)"/g)].map((m) => [m[1] ?? "", m[2]]);
  assert.deepEqual(tiles(ours), tiles(across));
  assert.match(ours, /<div class="hidden lg:grid grid-cols-\[3fr_2fr\] gap-0\.5 h-full" style="grid-template-rows:repeat\(3, 1fr\)"><div class="relative" style="grid-row:span 3">/);
});

test("the four maps: cropped copies of the route screenshots, each the shape of its slot, with the given alt text", () => {
  const card = cards()[0];
  const imgs = [...card.matchAll(/<img [^>]*>/g)].map((m) => [/url=%2Fimages%2F([a-z-]+\.webp)/.exec(m[0])![1], decode(/alt="([^"]*)"/.exec(m[0])![1])]);
  // Each map twice: once in the narrow grid, once in the wide collage.
  const expected = MAPS.map((map) => [map.file, `Tracked leaflet distribution route in ${map.town}`]);
  assert.deepEqual(imgs, [...expected, ...expected]);
  for (const map of MAPS) {
    const [width, height] = webpSize(join("public", "images", map.file));
    assert.deepEqual([width, height], map.size, map.file);
    assert.ok(Math.abs(width / height / map.slot - 1) < 0.005, `${map.file}: ${(width / height).toFixed(3)} for a ${map.slot} slot`);
    // The originals stay as they were: full screenshots, taller than they are wide.
    const [ow, oh] = webpSize(join("public", "images", map.original));
    assert.equal(ow, width, map.original);
    assert.ok(oh > height, map.original);
  }
});

test("the copy rules: no dashes, prices, turnaround times, \"street\", solus or live tracking, in its words, alt text or file names", () => {
  const card = cards()[0];
  const words = [textOf(card), ...[...card.matchAll(/alt="([^"]*)"/g)].map((m) => m[1]), ...MAPS.map((m) => m.file)].join(" ");
  assert.doesNotMatch(words, /[\u2013\u2014]/);
  assert.doesNotMatch(words, /£|\bpric|per leaflet/i);
  assert.doesNotMatch(words, /turnaround|working days?|within \d|\d+\s*(hours?|days?|weeks?)\b|same day|next day/i);
  assert.doesNotMatch(words, /street|solus|live tracked|see where every flyer goes/i);
  assert.doesNotMatch(readFileSync("app/case-studies/page.tsx", "utf8"), /[\u2013\u2014]/);
});

test("the sitemap dates /case-studies 23 November 2026; the page's metadata is unchanged", () => {
  const entry = sitemap().filter((e) => e.url === `${SITE}/case-studies`);
  assert.equal(entry.length, 1);
  assert.equal(new Date(entry[0].lastModified!).toISOString(), "2026-11-23T00:00:00.000Z");
  const { metadata } = render();
  assert.equal(metadata.title, "Case Studies");
  assert.equal(
    metadata.description,
    "Real completed leaflet distribution campaigns across Hampshire, from residential rounds to statutory public notice leafleting."
  );
  assert.equal(metadata.alternates.canonical, `${SITE}/case-studies`);
});

const BASE = process.env.QUOTE_FORM_TEST_URL ?? "";
/* eslint-disable @typescript-eslint/no-explicit-any */
type Browser = { newContext(options: object): Promise<any>; close(): Promise<void> };
type Playwright = { chromium: { launch(): Promise<Browser> } };
let playwright: Playwright | null = null;
try {
  if (BASE) playwright = createRequire(join(process.cwd(), "package.json"))("playwright") as Playwright;
} catch {
  playwright = null;
}
const local = (() => {
  try {
    return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(new URL(BASE).hostname);
  } catch {
    return false;
  }
})();
const skip = !BASE || !local ? "set QUOTE_FORM_TEST_URL to a local production build to run" : !playwright ? "Playwright is not available" : false;

let browser: Browser;
before(async () => {
  if (skip) return;
  browser = await playwright!.chromium.launch();
});
after(async () => {
  if (skip) return;
  await browser.close();
});

// Boxes are measured from each card's top left corner, so the two cards can be compared.
type Box = { x: number; y: number; w: number; h: number };
type Measured = {
  card: Box;
  collage: Box;
  tiles: { box: Box; src: string; fit: string; natural: [number, number]; complete: boolean }[];
  text: { box: Box; scroll: number; client: number }[];
};

test("in the browser at 390, 1024 and 1440: the maps load uncropped beyond their slots and unstretched, the words fit, the spacing matches", { skip }, async () => {
  for (const width of [390, 1024, 1440]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await ctx.newPage();
    try {
      await page.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (r: any) => r.abort());
      await page.goto(BASE + "/case-studies", { waitUntil: "networkidle" });
      // The maps load lazily: bring both cards into view, then wait for them.
      for (const title of ["Across Hampshire", "Southampton, Eastleigh and the New Forest"]) {
        await page.locator("h2", { hasText: title }).scrollIntoViewIfNeeded();
        await page.waitForFunction(
          (t: string) => [...document.querySelectorAll("h2")].find((h) => h.textContent === t)!.closest(".group")!.querySelectorAll("img").length > 0 &&
            [...[...document.querySelectorAll("h2")].find((h) => h.textContent === t)!.closest(".group")!.querySelectorAll("img")].every((i) => i.offsetParent === null || (i.complete && i.naturalWidth > 0)),
          title
        );
      }
      const measured = (await page.evaluate(`(() => {
        const out = {};
        for (const h2 of document.querySelectorAll("section.bg-slate-50 h2")) {
          const card = h2.closest(".group");
          const c = card.getBoundingClientRect();
          const rel = (el) => { const r = el.getBoundingClientRect(); return { x: r.left - c.left, y: r.top - c.top, w: r.width, h: r.height }; };
          const collage = card.querySelector(".aspect-\\\\[4\\\\/3\\\\]");
          const tiles = [...card.querySelectorAll("img")].filter((i) => i.offsetParent !== null).map((i) => ({
            box: rel(i), src: i.currentSrc, fit: getComputedStyle(i).objectFit, natural: [i.naturalWidth, i.naturalHeight], complete: i.complete,
          }));
          const body = card.querySelector(".p-6");
          const text = [...body.children].map((el) => ({ box: rel(el), scroll: el.scrollWidth, client: el.clientWidth }));
          out[h2.textContent] = { card: { x: 0, y: 0, w: c.width, h: c.height }, collage: rel(collage), tiles, text };
        }
        out.page = { scroll: document.documentElement.scrollWidth, inner: window.innerWidth };
        return out;
      })()`)) as Record<string, any>;
      const ours = measured["Southampton, Eastleigh and the New Forest"] as Measured;
      const across = measured["Across Hampshire"] as Measured;
      assert.ok(measured.page.scroll <= measured.page.inner, `@${width}: the page scrolls sideways`);

      // The four cropped maps, in order, loaded and drawn with object-fit: cover (one scale both ways, so never stretched).
      assert.deepEqual(
        ours.tiles.map((t) => /url=%2Fimages%2F([a-z-]+\.webp)/.exec(t.src)![1]),
        MAPS.map((m) => m.file),
        `@${width}`
      );
      for (const tile of ours.tiles) {
        assert.ok(tile.complete && tile.natural[0] > 0, `@${width}: ${tile.src} loaded`);
        assert.equal(tile.fit, "cover", `@${width}`);
      }
      if (width >= 1024) {
        // Big map on the left, three stacked on the right, each slot the shape its map was cropped to (within 1%).
        ours.tiles.forEach((tile, i) => {
          const slot = tile.box.w / tile.box.h;
          assert.ok(Math.abs(slot / MAPS[i].slot - 1) < 0.01, `@${width}: ${MAPS[i].file} slot ${slot.toFixed(3)}`);
          assert.ok(Math.abs(tile.natural[0] / tile.natural[1] / slot - 1) < 0.01, `@${width}: ${MAPS[i].file} matches its slot`);
        });
        assert.ok(ours.tiles[0].box.h > ours.tiles[1].box.h * 2.9 && ours.tiles[1].box.x > ours.tiles[0].box.x + ours.tiles[0].box.w, `@${width}`);
      }

      // The same layout as "Across Hampshire": card width, collage and tile boxes, and each text element's left edge and
      // the gap above it (the description is longer, so the link sits lower; the gap above it is the same).
      const round = (b: Box) => [b.x, b.w, b.h].map((n) => Math.round(n * 2) / 2);
      assert.equal(ours.card.w, across.card.w, `@${width}: card width`);
      assert.deepEqual(round(ours.collage), round(across.collage), `@${width}: collage`);
      assert.equal(Math.round(ours.collage.y), Math.round(across.collage.y), `@${width}: collage top`);
      assert.deepEqual(ours.tiles.map((t) => round(t.box)), across.tiles.map((t) => round(t.box)), `@${width}: tiles`);
      assert.equal(ours.text.length, across.text.length, `@${width}`);
      const gaps = (m: Measured) => m.text.map((t, i) => [t.box.x, Math.round(t.box.y - (i ? m.text[i - 1].box.y + m.text[i - 1].box.h : m.collage.y + m.collage.h))]);
      assert.deepEqual(gaps(ours), gaps(across), `@${width}: spacing`);

      // Nothing overflows: every text element inside the card's padding, none wider than its box.
      for (const t of ours.text) {
        assert.ok(t.box.x >= 23.5 && t.box.x + t.box.w <= ours.card.w - 23.5, `@${width}: ${JSON.stringify(t)}`);
        assert.ok(t.scroll <= t.client, `@${width}: ${JSON.stringify(t)}`);
      }
      // The pill stays on one line, as Across Hampshire's does.
      assert.equal(Math.round(ours.text[2].box.h), Math.round(across.text[2].box.h), `@${width}: pill height`);

      // The three links lead to pages that are there.
      for (const href of ["/areas/leaflet-distribution-lymington", "/areas/leaflet-distribution-brockenhurst", "/leaflet-delivery"]) {
        assert.equal((await ctx.request.get(BASE + href)).status(), 200, href);
      }
    } finally {
      await ctx.close();
    }
  }
});
