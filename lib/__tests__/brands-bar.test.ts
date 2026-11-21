// The homepage's Brands we've worked with bar: Angler Digital and My Invoice
// join it, sized by how large they look, and the loop keeps its pace and its
// seamless join. Checked on the source, and (with a local production build
// and Playwright) in a real browser at 390 and 1440:
//   QUOTE_FORM_TEST_URL=http://127.0.0.1:3200 NODE_PATH=$(npm root -g) npm test
// The browser checks are skipped otherwise. Requests off the test server are blocked.
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const BAR = readFileSync("components/BrandsBar.tsx", "utf8");
const entries = [...BAR.matchAll(/\{ name: "([^"]+)", file: "([^"]+)", width: (\d+), height: (\d+)(.*) \},/g)].map((m) => ({
  name: m[1],
  file: m[2],
  width: Number(m[3]),
  height: Number(m[4]),
  rest: m[5],
}));

test("the bar lists thirteen brands, ending with Angler Digital and My Invoice from public/images", () => {
  assert.equal(entries.length, 13);
  assert.deepEqual(
    entries.slice(-3).map((e) => [e.name, e.file]),
    [
      ["Kola Construction", "logo-kola-construction.webp"],
      ["Angler Digital", "images/logo-angler-digital.webp"],
      ["My Invoice", "images/logo-my-invoice.webp"],
    ]
  );
  // No alt of their own: they take "<name> logo", like the others.
  for (const e of entries.slice(-2)) assert.doesNotMatch(e.rest, /alt:/, e.name);
  assert.match(BAR, /const altOf = \(b: Brand\) => b\.alt \?\? `\$\{b\.name\} logo`;/);
});

test("every logo's width and height are its file's own, so none is stretched", async () => {
  for (const e of entries) {
    const path = join("public", e.file);
    assert.ok(existsSync(path), path);
    const meta = await sharp(path).metadata();
    assert.deepEqual([meta.width, meta.height], [e.width, e.height], e.file);
  }
});

test("the two new logos are 40px tall (30px on phones), the others as they were", () => {
  const sized = entries.filter((e) => /size: /.test(e.rest)).map((e) => [e.name, /size: "([^"]+)"/.exec(e.rest)![1]]);
  assert.deepEqual(sized, [
    ["Angler Digital", "h-[30px] sm:h-10"],
    ["My Invoice", "h-[30px] sm:h-10"],
  ]);
  assert.match(BAR, /const sizeOf = \(b: Brand\) => b\.size \?\? \(b\.featured \? "h-\[54px\] sm:h-\[72px\]" : "h-9 sm:h-12"\);/);
  // The loop is a little longer, so it takes a little longer: the same pace as before.
  assert.match(readFileSync("app/globals.css", "utf8"), /\.marquee-track \{[^}]*animation: marquee 110s linear infinite;/);
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

async function open(width: number, options: object = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, ...options });
  const page = await ctx.newPage();
  await page.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (r: any) => r.abort());
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.locator("section", { has: page.getByText("Brands we've worked with", { exact: true }) }).scrollIntoViewIfNeeded();
  // Load every logo now rather than as it scrolls in (the moving bar's, or with reduced motion the still row's).
  const shown = ".marquee-outer img, .brands-static-row img";
  await page.evaluate((shown: string) => document.querySelectorAll(shown).forEach((i) => ((i as HTMLImageElement).loading = "eager")), shown);
  await page.waitForFunction(
    (shown: string) => [...document.querySelectorAll(shown)].filter((i) => (i as HTMLElement).offsetParent).every((i) => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth > 0),
    shown
  );
  return { ctx, page };
}

test("in the browser: the new logos' sizes and alt text, nothing squashed, even gaps, and the same pace", { skip }, async () => {
  for (const [width, regular, featured, small, pace] of [[390, 36, 54, 30, 51.2], [1440, 48, 72, 40, 63.6]]) {
    const { ctx, page } = await open(width);
    try {
      const m = await page.evaluate(() => {
        const track = document.querySelector(".marquee-track")!;
        const groups = [...track.children] as HTMLElement[];
        const imgs = [...track.querySelectorAll("img")];
        const first = [...groups[0].querySelectorAll("img")];
        const boxes = imgs.map((i) => i.getBoundingClientRect());
        return {
          alts: first.map((i) => i.alt),
          hidden: groups.slice(1).every((g) => g.getAttribute("aria-hidden") === "true" && [...g.querySelectorAll("img")].every((i) => i.alt === "")),
          heights: first.map((i) => +i.getBoundingClientRect().height.toFixed(2)),
          // Drawn shape against the file's own shape.
          squash: Math.max(...imgs.map((i, n) => Math.abs(boxes[n].width / boxes[n].height / (i.naturalWidth / i.naturalHeight) - 1))),
          gaps: [...new Set(boxes.slice(1).map((b, n) => Math.round(b.left - boxes[n].right)))],
          perGroup: groups.map((g) => g.querySelectorAll("img").length),
          groupWidths: [...new Set(groups.map((g) => g.getBoundingClientRect().width.toFixed(2)))],
          // Exact, not rounded: logos at a fixed height are fractions of a pixel wide.
          half: track.getBoundingClientRect().width / 2,
          dupeAt: groups[3].getBoundingClientRect().left - track.getBoundingClientRect().left,
          duration: parseFloat(getComputedStyle(track).animationDuration),
        };
      });
      assert.deepEqual(m.alts.slice(-3), ["Kola Construction logo", "Angler Digital logo", "My Invoice logo"], `@${width}`);
      assert.ok(m.hidden, `@${width}: the repeats are hidden from screen readers`);
      assert.deepEqual(m.heights, [featured, ...Array(10).fill(regular), small, small], `@${width}`);
      assert.ok(m.squash < 0.01, `@${width}: a logo is drawn ${(m.squash * 100).toFixed(1)}% off its own shape`);
      // The same 40px between every pair of logos, across each repeat's join too.
      assert.deepEqual(m.gaps, [40], `@${width}`);
      assert.deepEqual(m.perGroup, [13, 13, 13, 13, 13, 13]);
      assert.equal(m.groupWidths.length, 1, `@${width}: every repeat the same width`);
      assert.ok(Math.abs(m.half - m.dupeAt) < 0.01, `@${width}: the second half starts exactly halfway (${m.dupeAt} of ${m.half})`);
      assert.equal(m.duration, 110);
      assert.ok(Math.abs(m.half / m.duration - pace) / pace < 0.02, `@${width}: ${(m.half / m.duration).toFixed(1)}px a second, was ${pace}`);
    } finally {
      await ctx.close();
    }
  }
});

// The loop moves by exactly half its length, where the second half starts (above). Its length is a fraction of a
// pixel over a whole number (each logo is drawn at its own shape), so at the join some edges can round to the next
// pixel: the frame there must differ from the start by less than one frame's normal movement (its pace / 60).
test("in the browser: the frame at the loop's join differs from its start by less than one frame's movement, so it never jumps", { skip }, async () => {
  for (const [width, pace] of [[390, 51.2], [1440, 63.6]]) {
    const { ctx, page } = await open(width);
    try {
      const shot = async (x: string) => {
        await page.evaluate((x: string) => {
          const track = document.querySelector(".marquee-track") as HTMLElement;
          track.style.animation = "none";
          track.style.transform = `translateX(${x})`;
        }, x);
        await page.waitForFunction(() => [...document.querySelectorAll(".marquee-outer img")].every((i) => (i as HTMLImageElement).complete));
        await page.waitForTimeout(100);
        return page.locator(".marquee-outer").screenshot();
      };
      const raw = (png: Buffer) => sharp(png).raw().toBuffer({ resolveWithObject: true });
      const diff = (a: { data: Buffer; info: { width: number; height: number } }, b: { data: Buffer; info: { width: number; height: number } }) => {
        assert.deepEqual([a.info.width, a.info.height], [b.info.width, b.info.height]);
        let total = 0;
        for (let i = 0; i < a.data.length; i++) total += Math.abs(a.data[i] - b.data[i]);
        return total / a.data.length;
      };
      const start = await raw(await shot("0px"));
      const join = diff(start, await raw(await shot("-50%")));
      const step = diff(start, await raw(await shot(`-${(pace / 60).toFixed(2)}px`)));
      assert.ok(join < step, `@${width}: the join differs from the start by ${join.toFixed(3)} a channel, one frame's movement by ${step.toFixed(3)}`);
    } finally {
      await ctx.close();
    }
  }
});

test("in the browser: with reduced motion the still row shows all thirteen, the new two at their sizes", { skip }, async () => {
  for (const [width, small] of [[390, 30], [1440, 40]]) {
    const { ctx, page } = await open(width, { reducedMotion: "reduce" });
    try {
      const row = await page.evaluate(() => {
        const imgs = [...document.querySelectorAll(".brands-static-row img")] as HTMLImageElement[];
        return { visible: getComputedStyle(document.querySelector(".brands-static-row")!).display, alts: imgs.map((i) => i.alt), heights: imgs.slice(-2).map((i) => i.getBoundingClientRect().height) };
      });
      assert.equal(row.visible, "flex");
      assert.equal(row.alts.length, 13);
      assert.deepEqual(row.alts.slice(-2), ["Angler Digital logo", "My Invoice logo"]);
      assert.deepEqual(row.heights, [small, small], `@${width}`);
    } finally {
      await ctx.close();
    }
  }
});
