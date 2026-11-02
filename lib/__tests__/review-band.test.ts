import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { HIGHLIGHTS } from "@/components/ReviewBand";

// The rating snapshot shared by the homepage and the area pages, its four
// highlights (each the exact start of a real review), and the homepage's
// blue selling-points bar, in order between the brands bar and the stats.

const GOOGLE_PROFILE = "https://share.google/RVxyPi4TzXAzkt1Am";

function render(): string {
  const run = spawnSync(process.execPath, ["--import", "tsx", "lib/__tests__/render-review-band.ts"], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  return run.stdout;
}

const textOf = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

test("each highlight is the exact start of that client's real review", () => {
  const source = readFileSync("components/Testimonials.tsx", "utf8");
  const reviewOf = (id: string, name: string) => {
    const m = new RegExp(`id: "${id}",\\s+name: "${name}",[\\s\\S]*?quote:\\s+"([^"]*)"`).exec(source);
    assert.ok(m, `${id} ${name}`);
    return m[1];
  };
  const real: Record<string, string> = {
    "John Lofthouse, New Arts": reviewOf("new-arts", "John Lofthouse"),
    "Hendonis Salon": reviewOf("hendonis-salon", "Hendonis Salon"),
    "Auriel Cochrane": reviewOf("relocation-healing-elishas", "Auriel Cochrane"),
    "Homebites Bakery": reviewOf("homebites-bakery", "Homebites Bakery"),
  };
  assert.deepEqual(HIGHLIGHTS, [
    { quote: "Outstanding service!", name: "John Lofthouse, New Arts" },
    { quote: "Incredible service from start to finish", name: "Hendonis Salon" },
    { quote: "Really pleased with the service!", name: "Auriel Cochrane" },
    { quote: "10/10 service for my cake business!", name: "Homebites Bakery" },
  ]);
  for (const h of HIGHLIGHTS) {
    assert.ok(real[h.name].startsWith(h.quote), h.name);
    // Cut at the end of a word, never part way through one.
    assert.doesNotMatch(real[h.name].slice(h.quote.length, h.quote.length + 1), /[A-Za-z0-9]/, h.name);
  }
});

test("the snapshot: the rating, the stars, the line, the Google link and four highlights, and no full review", () => {
  const html = render();
  assert.match(html, /^<section class="bg-white /);
  assert.match(html, /<h2[^>]*>Rated by local businesses<\/h2>/);
  assert.match(html, /<p class="[^"]*text-\[56px\] sm:text-\[72px\][^"]*text-\[#1e3a8a\][^"]*">5\.0<\/p>/);
  // One star graphic, read out once.
  assert.equal((html.match(/role="img"/g) ?? []).length, 1);
  assert.match(html, /<svg role="img" aria-label="5 out of 5 stars" viewBox="0 0 120 24" class="[^"]*fill-\[#b45309\]">/);
  assert.equal((html.match(/<path d="M12 2\.5/g) ?? []).length, 5);
  assert.match(html, />on Google<\/p>/);
  assert.match(html, />Rated five stars on Google by local businesses across Hampshire and Dorset\.<\/p>/);
  const link = /<a href="([^"]*)" target="_blank" rel="noopener"[^>]*>([\s\S]*?)<\/a>/.exec(html);
  assert.ok(link);
  assert.equal(link[1], GOOGLE_PROFILE);
  assert.equal(textOf(link[2]), "Read our Google reviews (opens in a new tab)");
  assert.match(link[2], /<svg aria-hidden="true"[^>]*><path d="M5 12h14M13 6l6 6-6 6"><\/path><\/svg>/);
  // Four figures, each a blockquote and its name, and nothing else quoted.
  const figures = [...html.matchAll(/<figure class="([^"]*)"><blockquote class="([^"]*)">([\s\S]*?)<\/blockquote><figcaption class="([^"]*)">([\s\S]*?)<\/figcaption><\/figure>/g)];
  assert.deepEqual(
    figures.map((f) => [textOf(f[3]), textOf(f[5])]),
    HIGHLIGHTS.map((h) => [`“${h.quote}”`, h.name])
  );
  for (const f of figures) {
    assert.match(f[1], /bg-white/);
    assert.match(f[1], /border-\[#e2e8f0\]/);
    assert.match(f[1], /rounded-xl sm:rounded-2xl/);
    assert.match(f[1], /p-3\.5 sm:p-6/);
    assert.match(f[2], /font-heading/);
    assert.match(f[2], /text-\[15px\] sm:text-xl/);
    assert.match(f[2], /text-\[#1e3a8a\]/);
    assert.match(f[4], /mt-1\.5 sm:mt-3 text-xs sm:text-sm text-\[#475569\]/);
  }
  assert.equal((html.match(/<blockquote/g) ?? []).length, 4);
  assert.doesNotMatch(html, /Great communication|these guys deal with you|Everything was handled|Very professional/);
  // 2 by 2 at every width.
  assert.match(html, /class="grid grid-cols-2 gap-2\.5 sm:gap-5"/);
  // The selling points have moved to the homepage's blue bar.
  assert.doesNotMatch(html, /Postcode targeting|GPS tracked delivery/);
  // Its only link off the site is the Google reviews.
  const source = readFileSync("components/ReviewBand.tsx", "utf8");
  assert.deepEqual([...new Set(source.match(/https?:\/\/[^"]+/g))], [GOOGLE_PROFILE]);
  assert.doesNotMatch(html, /[\u2013\u2014]/);
});

test("compact on phones, and from 640px every size and space exactly as before", () => {
  const html = render();
  // Each phone class, then the desktop one it hands over to at sm (640px).
  for (const pair of [
    "py-8 sm:py-14",
    "gap-5 sm:gap-10 lg:gap-12",
    "mb-2 sm:mb-4",
    "gap-3 sm:gap-4 mb-2 sm:mb-4",
    "text-[56px] sm:text-[72px]",
    "h-6 sm:h-7",
    "mt-1 sm:mt-1.5",
    "leading-snug sm:leading-relaxed max-w-sm mb-2.5 sm:mb-5",
    "gap-2.5 sm:gap-5",
    "rounded-xl sm:rounded-2xl",
    "p-3.5 sm:p-6",
    "text-[15px] sm:text-xl",
    "mt-1.5 sm:mt-3 text-xs sm:text-sm",
  ]) {
    assert.ok(html.includes(pair), pair);
  }
  // The colours are the ones checked for contrast before: unchanged.
  for (const colour of ["text-[#1d4ed8]", "text-[#1e3a8a]", "fill-[#b45309]", "text-[#334155]", "text-[#475569]"]) assert.ok(html.includes(colour), colour);
});

test("the homepage: brands bar, the blue bar, the snapshot, the stats, then the carousel as it was", () => {
  const page = readFileSync("app/page.tsx", "utf8");
  const order = ["<BrandsBar />", '<section aria-label="Why local businesses choose us"', "<ReviewBand />", "<StatsBar />", '<Testimonials exclude={["new-arts", "hendonis-salon"]} />'];
  const at = order.map((s) => page.indexOf(s));
  assert.ok(at.every((i, n) => i > 0 && (n === 0 || i > at[n - 1])), at.join(" "));
  for (const s of order) assert.equal(page.split(s).length - 1, 1, s);
  assert.match(page, /const sellingPoints = \["Local Hampshire and Dorset team", "Postcode targeting", "GPS tracked delivery", "Quote within 24 hours"\];/);
  const bar = page.slice(at[1], at[2]);
  assert.match(bar, /className="bg-\[#1e3a8a\] text-white"/);
  assert.match(bar, /py-\[18px\] flex flex-wrap justify-center/);
  assert.match(bar, /text-base font-bold/);
  assert.match(bar, /aria-hidden="true"[\s\S]*?text-\[#facc15\]/);
});
