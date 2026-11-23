// The homepage hero. From 1024px up, the van photo fills the right-hand
// panel (the same diagonal frame, yellow edge, shadow and place as before),
// cropped so the whole van stays in view. Below 1024px there is no photo at
// all: nothing rendered and nothing downloaded. There the overlay on the
// roofs photo stays dark over the sky and lighter over the roofs, and every
// line of text keeps AA contrast against the brightest part of the photo
// behind it. Checked on the source, and (with a local production build and
// Playwright) in a real browser:
//   QUOTE_FORM_TEST_URL=http://127.0.0.1:3200 NODE_PATH=$(npm root -g) npm test
// The browser checks are skipped otherwise. Requests off the test server are blocked.
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const PAGE = readFileSync("app/page.tsx", "utf8");
const HERO = PAGE.slice(PAGE.indexOf('<section id="hero"'), PAGE.indexOf("</section>", PAGE.indexOf('<section id="hero"')));
const ALT = "Flyer Distribution Hampshire branded van parked outside an office building";
// Where the van is in its photo, as shares of the width and height: bumper to
// rear, aerial to the shadow under the wheels. Its left-hand outline, from the
// roof's front corner down the windscreen and bonnet to the bumper, each point
// a little to the left of the real edge, is what must clear the diagonal.
const VAN = { left: 0.17, right: 0.84, top: 0.365, bottom: 0.69 };
const VAN_LEFT_EDGE = [
  [0.39, 0.398],
  [0.31, 0.442],
  [0.198, 0.525],
  [0.173, 0.587],
  [0.177, 0.632],
  [0.2, 0.672],
];
const PHOTO = { width: 1200, height: 1789 };

test("the van photo: next/image's props, the alt text, sizes for the square panel, not preloaded", async () => {
  const meta = await sharp("public/images/hero-van.webp").metadata();
  assert.deepEqual([meta.width, meta.height], [PHOTO.width, PHOTO.height]);
  assert.match(PAGE, /^import Image, \{ getImageProps \} from "next\/image";$/m);
  const props = /const HERO_VAN = getImageProps\(\{([\s\S]*?)\}\)\.props;/.exec(PAGE)![1];
  assert.deepEqual(
    props.trim().split(/,\s*\n\s*/).map((l) => l.replace(/,$/, "")),
    ['src: "/images/hero-van.webp"', `alt: "${ALT}"`, "fill: true", 'sizes: "min(48vw, 800px)"', 'loading: "eager"']
  );
  // As before: eager, but not priority or preloaded (it isn't the phone's main image).
  assert.doesNotMatch(props, /priority|preload|fetchPriority/);
});

test("from 1024px only: one <picture> source, an empty fallback, cropped 60% of the way down", () => {
  assert.match(
    HERO,
    /<picture>\s*<source media="\(min-width: 1024px\)" srcSet=\{HERO_VAN\.srcSet\} sizes=\{HERO_VAN\.sizes\} \/>[\s\S]*?<img\s+\{\.\.\.HERO_VAN\}\s+srcSet=\{undefined\}\s+sizes=\{undefined\}\s+src=\{EMPTY_GIF\}\s+className="object-cover"\s+style=\{\{ \.\.\.HERO_VAN\.style, objectPosition: "50% 60%" \}\}\s+\/>\s*<\/picture>/
  );
  assert.match(PAGE, /const EMPTY_GIF = "data:image\/gif;base64,[A-Za-z0-9+/=]+";/);
  // The frame as it was: the panel, its shadow, the yellow edge and the diagonal.
  for (const kept of [
    'className="hidden lg:block absolute inset-y-0 right-0 aspect-square max-w-[48%] [container-type:size]"',
    'style={{ filter: "drop-shadow(-18px 0 30px rgba(0,0,0,0.35))" }}',
    'className="absolute inset-y-0 right-0 -left-[6px] bg-yellow-400"',
    'style={{ clipPath: "polygon(calc(100cqh * 0.2166) 0%, calc(100cqh * 0.2166 + 6px) 0%, 6px 100%, 0% 100%)" }}',
    'style={{ clipPath: "polygon(calc(100cqh * 0.2166) 0%, 100% 0%, 100% 100%, 0% 100%)" }}',
  ]) assert.ok(HERO.includes(kept), kept);
  // The letterbox photo, with its banned wording, is gone from the homepage.
  assert.doesNotMatch(PAGE, /Leaflet going through door/);
  // One <img> in the hero apart from the roofs: the van's.
  assert.equal((HERO.match(/<Image\b/g) ?? []).length, 1, "only the roofs photo");
  assert.equal((HERO.match(/<img\b/g) ?? []).length, 1);
});

test("the overlay: dark over the sky, lighter over the roofs below 1024px, 80% from 1024px as before", () => {
  assert.match(
    HERO,
    /<div className="absolute inset-0 bg-linear-to-b from-blue-950\/82 from-15% to-blue-950\/70 to-40% lg:bg-none lg:bg-blue-950\/80" \/>/
  );
  assert.doesNotMatch(HERO, /[\u2013\u2014]/);
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

async function open(width: number) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await ctx.newPage();
  const requested: string[] = [];
  page.on("request", (r: any) => requested.push(decodeURIComponent(r.url())));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (r: any) => r.abort());
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.querySelectorAll("#hero img")].filter((i) => (i as HTMLElement).offsetParent).every((i) => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth > 0));
  return { ctx, page, requested };
}

test("in the browser, 1024 to 1920: the van photo fills the square panel, the whole van in view and clear of the diagonal", { skip }, async () => {
  for (const width of [1024, 1280, 1440, 1920]) {
    const { ctx, page, requested } = await open(width);
    try {
      const m = await page.evaluate(() => {
        const hero = document.querySelector("#hero")!.getBoundingClientRect();
        const panel = document.querySelector("#hero picture")!.closest(".lg\\:block")!.getBoundingClientRect();
        const img = document.querySelector("#hero picture img") as HTMLImageElement;
        const overlay = getComputedStyle(document.querySelector("#hero > div.absolute.inset-0")!);
        return {
          hero: { w: hero.width, h: hero.height },
          panel: { x: panel.left - hero.left, w: panel.width, h: panel.height, top: panel.top - hero.top },
          img: { w: img.getBoundingClientRect().width, h: img.getBoundingClientRect().height, fit: getComputedStyle(img).objectFit, pos: getComputedStyle(img).objectPosition },
          current: img.currentSrc,
          natural: [img.naturalWidth, img.naturalHeight],
          alt: img.alt,
          loading: img.loading,
          overlay: { image: overlay.backgroundImage, colour: overlay.backgroundColor },
          preloads: [...document.querySelectorAll('link[rel="preload"]')].map((l) => l.getAttribute("imagesrcset") ?? l.getAttribute("href") ?? ""),
        };
      });
      // The panel as before: square, 48% of the width at most, as tall as the hero at most, against the right edge.
      const side = Math.min(width * 0.48, m.hero.h);
      assert.ok(Math.abs(m.panel.w - side) < 0.5 && Math.abs(m.panel.h - side) < 0.5, `@${width}: panel ${m.panel.w}x${m.panel.h}`);
      assert.ok(Math.abs(m.panel.x + m.panel.w - m.hero.w) < 0.5 && Math.abs(m.panel.top) < 0.5, `@${width}`);
      assert.ok(/\/_next\/image\?url=\/images\/hero-van\.webp&w=\d+&q=75$/.test(decodeURIComponent(m.current).replace(/^https?:\/\/[^/]+/, "")), `@${width}: ${m.current}`);
      assert.ok(m.natural[0] > 0 && Math.abs(m.natural[0] / m.natural[1] - PHOTO.width / PHOTO.height) < 0.01, `@${width}: ${m.natural}`);
      assert.equal(m.alt, ALT);
      assert.equal(m.loading, "eager");
      assert.ok(!m.preloads.some((p: string) => p.includes("hero-van")), `@${width}: not preloaded`);
      assert.ok(requested.some((u) => u.includes("/images/hero-van.webp")) && !requested.some((u) => u.includes("Leaflet going through door")), `@${width}`);
      assert.equal(m.img.fit, "cover");
      assert.equal(m.img.pos, "50% 60%");
      assert.ok(Math.abs(m.img.w - m.panel.w) < 0.5 && Math.abs(m.img.h - m.panel.h) < 0.5, `@${width}: the photo fills the panel`);
      // Where object-fit: cover at 50% 60% puts the van in the panel.
      const scale = Math.max(m.panel.w / PHOTO.width, m.panel.h / PHOTO.height);
      const drawn = { w: PHOTO.width * scale, h: PHOTO.height * scale };
      const off = { x: (drawn.w - m.panel.w) * 0.5, y: (drawn.h - m.panel.h) * 0.6 };
      const van = { left: VAN.left * drawn.w - off.x, right: VAN.right * drawn.w - off.x, top: VAN.top * drawn.h - off.y, bottom: VAN.bottom * drawn.h - off.y };
      assert.ok(van.left >= 0 && van.right <= m.panel.w && van.top >= 0 && van.bottom <= m.panel.h, `@${width}: van ${JSON.stringify(van)} in ${m.panel.w}x${m.panel.h}`);
      // The diagonal: hidden left of 0.2166 x (height - y). The van's left side clears it with room to spare.
      const clearance = Math.min(...VAN_LEFT_EDGE.map(([x, y]) => x * drawn.w - off.x - 0.2166 * (m.panel.h - (y * drawn.h - off.y))));
      assert.ok(clearance > 0.04 * m.panel.w, `@${width}: ${clearance.toFixed(1)}px clear of the diagonal`);
      assert.ok(van.top > 0.15 * m.panel.h && m.panel.h - van.bottom > 0.15 * m.panel.h, `@${width}: room above and below`);
      // The overlay from 1024px: an even 80% blue-950, as before.
      assert.equal(m.overlay.image, "none", `@${width}`);
      assert.match(m.overlay.colour, /^oklab\(0\.28\d* -0\.00\d* -0\.09\d* \/ 0\.8\)$/, `@${width}`);
    } finally {
      await ctx.close();
    }
  }
});

test("in the browser, below 1024px: no van or letterbox photo rendered or downloaded, and no gap where it was", { skip }, async () => {
  for (const width of [320, 390, 768, 1023]) {
    const { ctx, page, requested } = await open(width);
    try {
      const m = await page.evaluate(() => {
        const hero = document.querySelector("#hero")!;
        const img = hero.querySelector("picture img") as HTMLImageElement;
        const teaser = hero.querySelector("button")!.getBoundingClientRect();
        return {
          shown: [...hero.querySelectorAll("img")].filter((i) => (i as HTMLElement).offsetParent).map((i) => (i as HTMLImageElement).currentSrc),
          van: { rendered: img.offsetParent !== null, current: img.currentSrc.slice(0, 22) },
          gap: Math.round(hero.getBoundingClientRect().bottom - teaser.bottom),
          overlay: getComputedStyle(hero.querySelector(":scope > div.absolute.inset-0")!).backgroundImage,
        };
      });
      assert.ok(!requested.some((u) => /hero-van|Leaflet going through door/.test(u)), `@${width}: ${requested.filter((u) => /hero-van|Leaflet going/.test(u))}`);
      assert.deepEqual(m.van, { rendered: false, current: "data:image/gif;base64," }, `@${width}`);
      assert.equal(m.shown.length, 1, `@${width}: only the roofs photo`);
      assert.match(m.shown[0], /images\.unsplash\.com/);
      // The hero's own bottom padding (64px) after its last line, as at the top.
      assert.equal(m.gap, 64, `@${width}`);
      assert.match(m.overlay, /^linear-gradient\(/, `@${width}`);
    } finally {
      await ctx.close();
    }
  }
});

const lin = (c: number) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = ([r, g, b]: number[]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a: number[], b: number[]) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

test("in the browser, below 1024px: every line of hero text at AA against the brightest part of the photo at its height", { skip }, async () => {
  for (const width of [320, 390, 430, 640, 768, 1023]) {
    const { ctx, page } = await open(width);
    try {
      // [selector, name, large text, fixed colour]: 4.5:1 for normal text, 3:1 for large text (24px, or
      // 18.66px bold) and the stars. The case study button's words sit on its own see-through blue.
      const specs: [string, string, boolean, string | null][] = [
        ["p.text-blue-300", "eyebrow", false, null],
        ["h1", "heading", true, null],
        ["h1 span", "#1", true, null],
        ["h1 + p", "intro", width >= 640, null],
        ["a.cta-shimmer span", "See Our Case Studies", false, null],
        ["a[target=_blank] span", "rating line", false, null],
        ["a[target=_blank] svg", "stars", true, "#facc15"],
        ["button p", "case study button", false, null],
        ["button", "case study button background", false, null],
      ];
      // No named functions inside: the test runner would wrap them in a helper the page doesn't have.
      const found = await page.evaluate((specs: [string, string, boolean, string | null][]) => {
        const hero = document.querySelector("#hero")!;
        const top = hero.getBoundingClientRect().top;
        const content = hero.querySelector(":scope > div.relative")!;
        // Each colour as sRGB, read back from a canvas.
        const canvas = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
        return specs.map(([sel, name, large, fixed]) => {
          const el = content.querySelector(sel)!;
          const r = el.getBoundingClientRect();
          const css = fixed ?? (sel === "button" ? getComputedStyle(el).backgroundColor : getComputedStyle(el).color);
          canvas.fillStyle = css.replace(/\s*\/\s*[\d.]+\)$/, ")");
          canvas.fillRect(0, 0, 1, 1);
          const alpha = Number(/\/\s*([\d.]+)\)$/.exec(css)?.[1] ?? 1);
          return { name, large, colour: [...canvas.getImageData(0, 0, 1, 1).data].slice(0, 3), alpha, top: r.top - top, bottom: r.bottom - top };
        });
      }, specs);
      const byName = (name: string) => found.find((f: { name: string }) => f.name === name)!;
      const info = {
        items: found.filter((f: { name: string }) => !f.name.startsWith("case study button")),
        teaser: { ...byName("case study button"), bg: byName("case study button background").colour, alpha: byName("case study button background").alpha },
      };
      // The photo and its overlay only.
      await page.addStyleTag({ content: "#hero > div.relative, header, .floating-quote-button { visibility: hidden !important; }" });
      await page.waitForTimeout(200);
      const { data, info: img } = await sharp(await page.locator("#hero").screenshot()).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      const brightest = (top: number, bottom: number) => {
        let best = [0, 0, 0], bestL = -1;
        // Whole rows (wherever the words wrap to), less the 2px edge that picks up the page around the hero.
        for (let y = Math.max(2, Math.floor(top) - 2); y <= Math.min(img.height - 3, Math.ceil(bottom) + 2); y++)
          for (let x = 2; x < img.width - 2; x++) {
            const i = (y * img.width + x) * 3;
            const p = [data[i], data[i + 1], data[i + 2]];
            const L = lum(p);
            if (L > bestL) [best, bestL] = [p, L];
          }
        return best;
      };
      for (const it of info.items) {
        const r = ratio(it.colour, brightest(it.top, it.bottom));
        assert.ok(r >= (it.large ? 3 : 4.5), `@${width}: ${it.name} ${r.toFixed(2)}:1`);
      }
      const t = info.teaser;
      const under = brightest(t.top, t.bottom);
      const bg = t.bg.map((c: number, i: number) => t.alpha * c + (1 - t.alpha) * under[i]);
      assert.ok(ratio(t.colour, bg) >= 4.5, `@${width}: case study button ${ratio(t.colour, bg).toFixed(2)}:1`);
    } finally {
      await ctx.close();
    }
  }
});
