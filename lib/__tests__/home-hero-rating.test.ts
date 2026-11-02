import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// The Google rating in the homepage and area page heroes: one plain line
// under the two buttons at every width, with no frosted pill anywhere. Five
// yellow stars read out once, "Rated 5.0 on Google by local businesses" in
// light blue, a link to our Google reviews in a new tab that says so, and a
// tap area at least 44px tall with a visible focus outline. Checked on the
// source; the browser run checks the pages at 1440, 1024 and 390.

const GOOGLE_PROFILE = "https://share.google/RVxyPi4TzXAzkt1Am";
const LINE_CLASSES = [
  "mt-2", "flex", "w-fit", "max-w-full", "min-h-11", "items-center", "gap-2", "rounded-sm", "text-sm", "text-[#dbeafe]",
  "focus-visible:outline-2", "focus-visible:outline-offset-2", "focus-visible:outline-[#facc15]",
];

const HEROES = [
  { file: "app/page.tsx", start: '<section id="hero"', star: "HERO_STAR", after: "See Our Case Studies</span>\n                </Link>\n              </div>", before: "<HeroCaseStudyTeaser />" },
  { file: "components/AreaPage.tsx", start: "{/* 1. Hero */}", star: "STAR", after: "See Our Case Studies\n              </Link>\n            </div>", before: "{/* The page's coverage map" },
];

for (const h of HEROES) {
  const source = readFileSync(h.file, "utf8");
  const hero = source.slice(source.indexOf(h.start), source.indexOf("</section>", source.indexOf(h.start)));
  const links = [...hero.matchAll(/<a\s+href=\{GOOGLE_PROFILE\}\s+target="_blank"\s+rel="noopener"\s+className="([^"]*)"\s*>([\s\S]*?)<\/a>/g)];

  test(`${h.file}: one rating link in the hero, the plain line under the buttons at every width`, () => {
    assert.match(source, new RegExp(`const GOOGLE_PROFILE = "${GOOGLE_PROFILE.replace(/[./]/g, "\\$&")}";`));
    assert.equal(links.length, 1, "only one rating link");
    const [m] = links;
    const at = m.index!;
    assert.ok(hero.indexOf(h.after) > 0 && at > hero.indexOf(h.after), "straight after the buttons");
    assert.ok(at < hero.indexOf(h.before), "before what follows the buttons");
    assert.deepEqual(m[1].split(/\s+/), LINE_CLASSES);
    // Shown at every width: no breakpoint hides it.
    assert.ok(!m[1].split(/\s+/).some((c) => /^(?:sm|md|lg|xl):/.test(c) || c === "hidden"));
    // One star graphic, read out once, then the words, then the new tab note.
    const body = m[2];
    assert.match(body, new RegExp(`^\\s*<svg role="img" aria-label="5 out of 5 stars" viewBox="0 0 120 24" className="h-3\\.5 w-auto fill-\\[#facc15\\] shrink-0">\\s*\\{\\[0, 1, 2, 3, 4\\]\\.map\\(\\(i\\) => \\(\\s*<path key=\\{i\\} d=\\{${h.star}\\}`));
    assert.equal((body.match(/<svg/g) ?? []).length, 1);
    assert.equal((body.match(/role="img"/g) ?? []).length, 1);
    assert.match(body, /<\/svg>\s+<span>Rated 5\.0 on Google by local businesses<\/span>\s+<span className="sr-only"> \(opens in a new tab\)<\/span>\s*$/);
  });

  test(`${h.file}: the frosted pill is gone`, () => {
    for (const gone of ["5.0 on Google</span>", "from local businesses</span>", "bg-white/10 border border-white/20", "hover:bg-white/15", "fill-yellow-400"]) {
      assert.ok(!source.includes(gone), gone);
    }
    assert.doesNotMatch(source, /[\u2013\u2014]/);
  });
}
