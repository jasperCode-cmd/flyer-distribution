import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// The homepage hero's Google rating: the pill above the eyebrow from 640px,
// and on phones a plain line under the two buttons instead. Only one of the
// two is ever displayed, so a screen reader meets it once. Checked on the
// source; the browser run checks both widths.

const GOOGLE_PROFILE = "https://share.google/RVxyPi4TzXAzkt1Am";
const page = readFileSync("app/page.tsx", "utf8");
const hero = page.slice(page.indexOf('<section id="hero"'), page.indexOf("</section>", page.indexOf('<section id="hero"')));

// Each link to the Google reviews in the hero: its classes and contents.
const links = [...hero.matchAll(/<a\s+href=\{GOOGLE_PROFILE\}\s+target="_blank"\s+rel="noopener"\s+className="([^"]*)"\s*>([\s\S]*?)<\/a>/g)].map((m) => ({
  classes: m[1].split(/\s+/),
  body: m[2],
  at: m.index!,
}));

test("two links to the Google reviews, both opening a new tab and saying so", () => {
  assert.match(page, new RegExp(`const GOOGLE_PROFILE = "${GOOGLE_PROFILE.replace(/[./]/g, "\\$&")}";`));
  assert.equal(links.length, 2);
  for (const l of links) assert.match(l.body, /<span className="sr-only"> \(opens in a new tab\)<\/span>/);
});

test("from 640px: the pill above the eyebrow, exactly as before", () => {
  const pill = links[0];
  assert.ok(pill.at < hero.indexOf("Hampshire &amp; Dorset"), "above the eyebrow");
  assert.deepEqual(pill.classes, [
    "hidden", "sm:inline-flex", "flex-wrap", "items-center", "gap-x-2", "gap-y-0.5", "max-w-full", "rounded-2xl", "sm:rounded-full",
    "bg-white/10", "border", "border-white/20", "px-3.5", "py-1.5", "mb-5", "text-xs", "sm:text-sm", "hover:bg-white/15", "transition-colors",
  ]);
  assert.match(pill.body, /<svg role="img" aria-label="5 out of 5 stars" viewBox="0 0 120 24" className="h-3\.5 w-auto fill-yellow-400 shrink-0">/);
  assert.match(pill.body, /<span className="font-bold text-white whitespace-nowrap">5\.0 on Google<\/span>/);
  assert.match(pill.body, /<span className="text-\[#bfdbfe\] whitespace-nowrap">from local businesses<\/span>/);
});

test("on phones: a plain line straight under the two buttons, with no box, a 44px tap area and a focus outline", () => {
  const line = links[1];
  const buttonsEnd = hero.indexOf("See Our Case Studies</span>\n                </Link>\n              </div>");
  assert.ok(buttonsEnd > 0 && line.at > buttonsEnd, "after the buttons");
  assert.ok(line.at < hero.indexOf("<HeroCaseStudyTeaser />"), "before the case study teaser");
  for (const c of ["sm:hidden", "min-h-11", "items-center", "text-sm", "text-[#dbeafe]", "focus-visible:outline-2", "focus-visible:outline-offset-2", "focus-visible:outline-[#facc15]"]) {
    assert.ok(line.classes.includes(c), c);
  }
  // No background, border or rounded box.
  assert.ok(!line.classes.some((c) => /^(?:sm:)?(?:bg-|border|rounded-(?!sm$)|px-|py-|shadow)/.test(c)), line.classes.join(" "));
  // One star graphic, read out once, then the words.
  assert.match(line.body, /<svg role="img" aria-label="5 out of 5 stars" viewBox="0 0 120 24" className="[^"]*fill-\[#facc15\][^"]*">/);
  assert.equal((line.body.match(/<svg/g) ?? []).length, 1);
  assert.equal((line.body.match(/role="img"/g) ?? []).length, 1);
  assert.match(line.body, /<\/svg>\s+<span>Rated 5\.0 on Google by local businesses<\/span>/);
});

test("only one of the two is displayed at any width", () => {
  // The pill is display:none below 640px and the line from 640px.
  assert.equal(links[0].classes[0], "hidden");
  assert.ok(links[0].classes.includes("sm:inline-flex"));
  assert.ok(links[1].classes.includes("sm:hidden"));
  assert.ok(!links[1].classes.some((c) => c.startsWith("sm:") && c !== "sm:hidden"));
  assert.doesNotMatch(hero, /[\u2013\u2014]/);
});
