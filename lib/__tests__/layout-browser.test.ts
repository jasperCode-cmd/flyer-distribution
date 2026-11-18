import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { join } from "node:path";

// Fixes from the site audit, in a real browser:
// - the floating Get a Quote button is hidden while the phone menu is open (390 and 768) and back when it closes;
// - the sets of four on /leaflet-delivery and /services never leave one item alone on a row (390 to 1440);
// - /leaflet-printing's three ways to order stack below lg, three across from lg, each arrow on its last word's line;
// - each photo that covers a box taller than its own shape gets a file big enough for the area it fills (no more
//   than 1.1 times its file at 1x and 2x), unless the file is already the largest there is.
//
// Needs a production build of the site running locally and Playwright:
//   QUOTE_FORM_TEST_URL=http://127.0.0.1:3200 NODE_PATH=$(npm root -g) npm test
// Skipped otherwise, like the database tests. Requests off the test server are blocked.

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

async function open(path: string, width: number, height = 900, deviceScaleFactor = 1) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor });
  const page = await ctx.newPage();
  await page.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (r: any) => r.abort());
  await page.goto(BASE + path, { waitUntil: "networkidle" });
  return { ctx, page };
}

test("the floating quote button steps aside while the phone menu is open, at 390 and 768, and comes back after", { skip }, async () => {
  for (const [width, height] of [[390, 844], [768, 1024]]) {
    for (const path of ["/services", "/leaflet-delivery"]) {
      const { ctx, page } = await open(path, width, height);
      try {
        const button = page.locator("div.floating-quote-button");
        await button.waitFor({ state: "visible" });
        await page.getByRole("button", { name: "Toggle menu" }).click();
        await page.getByRole("button", { name: "Services" }).click();
        await page.locator("header a", { hasText: "All services" }).waitFor();
        assert.equal(await button.isVisible(), false, `${path} @${width}: hidden with the menu open`);
        // Nothing fixed sits over the menu's links.
        const covered = await page.evaluate(() =>
          [...document.querySelectorAll("header nav a")].filter((a) => {
            const r = a.getBoundingClientRect();
            if (r.width === 0 || r.bottom < 0 || r.top > innerHeight) return false;
            const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            return top && !a.contains(top) && !top.contains(a);
          }).map((a) => (a as HTMLElement).innerText.trim())
        );
        assert.deepEqual(covered, [], `${path} @${width}`);
        await page.getByRole("button", { name: "Toggle menu" }).click();
        await button.waitFor({ state: "visible" });
      } finally {
        await ctx.close();
      }
    }
  }
});

test("the sets of four on /leaflet-delivery and /services never leave one item alone on a row", { skip }, async () => {
  const sets: [string, string][] = [
    ["/leaflet-delivery", "How we deliver your leaflets"],
    ["/leaflet-delivery", "How it works"],
    ["/leaflet-delivery", "Where we deliver"],
    ["/services", "Our Services"],
    ["/services", "reasons"],
  ];
  for (const width of [390, 768, 1024, 1280, 1440]) {
    for (const path of ["/leaflet-delivery", "/services"]) {
      const { ctx, page } = await open(path, width);
      try {
        for (const [, heading] of sets.filter(([p]) => p === path)) {
          const rows = await page.evaluate((heading: string) => {
            const grid =
              heading === "reasons"
                ? document.querySelector("section.border-t > div")!
                : heading === "Our Services"
                  ? document.querySelector("h1")!.parentElement!.querySelector("ul")!
                  : [...document.querySelectorAll("section")]
                      .find((s) => s.querySelector("h2")?.textContent === heading)!
                      .querySelector(heading === "How it works" ? "ol" : "ul.grid")!;
            const tops = [...grid.children].map((c) => Math.round(c.getBoundingClientRect().top));
            const counts = new Map<number, number>();
            for (const t of tops) counts.set(t, (counts.get(t) ?? 0) + 1);
            return [...counts.values()];
          }, heading);
          assert.equal(rows.reduce((a: number, b: number) => a + b, 0), 4, `${path} ${heading} @${width}`);
          // One across (phones), or every row full.
          assert.ok(rows.every((n: number) => n === 1) || rows.every((n: number) => n === rows[0]), `${path} ${heading} @${width}: rows ${rows.join("+")}`);
          const expected = path === "/services" ? (width >= 1024 ? 4 : width >= 640 ? 2 : 1) : width >= 1280 ? 4 : width >= 768 ? 2 : 1;
          assert.equal(rows[0], expected, `${path} ${heading} @${width}`);
        }
      } finally {
        await ctx.close();
      }
    }
  }
});

test("/leaflet-delivery: the three printing cards stack below lg and sit three across from lg, never one on its own", { skip }, async () => {
  for (const width of [390, 768, 1024, 1280, 1440]) {
    const { ctx, page } = await open("/leaflet-delivery", width);
    try {
      const rows = await page.evaluate(() => {
        const section = [...document.querySelectorAll("section")].find((s) => s.querySelector("h2")?.textContent === "Need them printed too?")!;
        const counts = new Map<number, number>();
        for (const c of section.querySelectorAll("ul > li")) {
          const t = Math.round(c.getBoundingClientRect().top);
          counts.set(t, (counts.get(t) ?? 0) + 1);
        }
        return [...counts.values()];
      });
      assert.deepEqual(rows, width >= 1024 ? [3] : [1, 1, 1], `@${width}`);
    } finally {
      await ctx.close();
    }
  }
});

test("/leaflet-printing: the three ways to order stack below lg, sit three across from lg, and each arrow stays on its last word's line", { skip }, async () => {
  for (const width of [390, 768, 1024, 1440]) {
    const { ctx, page } = await open("/leaflet-printing", width);
    try {
      const m = await page.evaluate(() => {
        const section = [...document.querySelectorAll("section")].find((s) => s.querySelector("h2")?.textContent === "Three ways to order")!;
        const cards = [...section.querySelectorAll("ul > li")];
        const tops = new Set(cards.map((c) => Math.round(c.getBoundingClientRect().top)));
        const links = [...section.querySelectorAll("ul > li a")].map((a) => {
          const arrow = a.querySelector("svg")!.getBoundingClientRect();
          const word = a.querySelector("span.whitespace-nowrap")!;
          const range = document.createRange();
          range.selectNodeContents(word.firstChild!);
          const last = [...range.getClientRects()].at(-1)!;
          return { text: (a as HTMLElement).innerText.trim(), sameLine: Math.abs(arrow.top + arrow.height / 2 - (last.top + last.height / 2)) < 6, gap: Math.round(arrow.left - last.right) };
        });
        return { rows: tops.size, links };
      });
      assert.equal(m.rows, width >= 1024 ? 1 : 3, `@${width}`);
      for (const l of m.links) {
        assert.ok(l.sameLine, `${l.text} @${width}: arrow on its last word's line`);
        assert.ok(l.gap >= 0 && l.gap <= 10, `${l.text} @${width}: arrow ${l.gap}px after the word`);
      }
    } finally {
      await ctx.close();
    }
  }
});

test("photos covering boxes taller than their own shape get a file big enough for the area they fill", { skip }, async () => {
  // The largest file each photo has (what the optimiser serves for any bigger request).
  const PHOTOS: [string, string, number][] = [
    ["/services", "Leaflets posted through a letterbox", 1600],
    ["/services", "Colourful printed leaflets laid out on a desk", 2312],
    ["/services", "A laptop showing website code on a desk", 1800],
    ["/leaflet-delivery", "Leaflets posted through a letterbox", 1600],
    ["/leaflet-printing", "A large printer mid-print", 1500],
    ["/leaflet-printing", "Colourful printed leaflets laid out on a desk", 2312],
    ["/leaflet-printing", "A printed folded leaflet standing on a stack of leaflets", 1200],
    ["/leaflet-printing", "A stack of printed business cards", 1200],
  ];
  for (const dpr of [1, 2]) {
    for (const width of [390, 768, 1024, 1440]) {
      for (const path of ["/services", "/leaflet-delivery", "/leaflet-printing"]) {
        const { ctx, page } = await open(path, width, 900, dpr);
        try {
          for (const [, alt, largest] of PHOTOS.filter(([p]) => p === path)) {
            const m = await page.evaluate(async (alt: string) => {
              const img = [...document.images].find((i) => i.alt === alt)!;
              img.scrollIntoView();
              if (!img.complete) await new Promise((r) => img.addEventListener("load", r, { once: true }));
              const r = img.getBoundingClientRect();
              const shape = img.naturalWidth / img.naturalHeight;
              // naturalWidth is divided by the density the file was picked for, so read the file's own width.
              const probe = new Image();
              probe.src = img.currentSrc;
              await probe.decode();
              return { drawn: Math.max(r.width, r.height * shape), file: probe.naturalWidth };
            }, alt);
            const scale = (m.drawn * dpr) / m.file;
            assert.ok(scale <= 1.1 || m.file >= largest, `${path} "${alt}" @${width} ${dpr}x: drawn ${scale.toFixed(2)} times its ${m.file}px file`);
          }
        } finally {
          await ctx.close();
        }
      }
    }
  }
});
