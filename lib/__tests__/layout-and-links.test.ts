// Fixes from the site audit, checked on the source: the floating quote button
// steps aside while the phone menu is open, and the extra links to the
// printing page (from the FAQ and two leaflet services) and to the all
// services hub (from Web Design & SEO, Screen Hire and the homepage). The
// browser run (layout-browser.test.ts) checks the button, the rows, the
// arrows and the photos on the page.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(p, "utf8");

test("the floating quote button steps aside while the phone menu is open, and comes back when it closes", () => {
  const header = read("components/Header.tsx");
  assert.match(
    header,
    /useEffect\(\(\) => \{\s+document\.documentElement\.toggleAttribute\("data-phone-menu-open", menuOpen\);\s+return \(\) => document\.documentElement\.removeAttribute\("data-phone-menu-open"\);\s+\}, \[menuOpen\]\);/
  );
  // The effect runs before the header can return early, so it is the same on every page.
  assert.ok(header.indexOf('toggleAttribute("data-phone-menu-open"') < header.indexOf("if (hidesSiteChrome(pathname)) return null;"));
  assert.match(read("components/FloatingQuoteButton.tsx"), /<div ref=\{containerRef\} className="floating-quote-button fixed bottom-6 right-6 z-50">/);
  // Only where the phone menu exists (below lg); on desktop the dropdown never hides it.
  assert.match(read("app/globals.css"), /@media \(max-width: 1023\.98px\) \{\s+html\[data-phone-menu-open\] \.floating-quote-button \{\s+display: none;\s+\}\s+\}/);
});

test("more links to the printing page: the FAQ's printing answer, hand-to-hand and B2B", () => {
  const faq = read("app/faq/page.tsx");
  assert.match(faq, /include printing in your package\.\{" "\}\s+<Link href="\/leaflet-printing" className=\{a\}>See our leaflet printing<\/Link>\./);
  assert.match(faq, /we'll include printing in your package\. See our leaflet printing\.",/);
  const toPrinting = (page: string) =>
    [...read(`app/services/${page}/page.tsx`).matchAll(/<Link href="\/leaflet-printing" className="text-blue-700 hover:underline font-medium">\s+([^<]+?)\s+<\/Link>/g)].map((m) => m[1]);
  assert.deepEqual(toPrinting("hand-to-hand-distribution"), ["leaflet printing"]);
  assert.match(read("app/services/hand-to-hand-distribution/page.tsx"), /If you need the leaflets printed\s+first, we handle the\{" "\}/);
  assert.deepEqual(toPrinting("b2b-distribution"), ["leaflet printing"]);
  assert.match(read("app/services/b2b-distribution/page.tsx"), /If your leaflets\s+aren&apos;t printed yet, our\{" "\}/);
});

test("more links to the all services hub: Web Design & SEO, Screen Hire and the homepage's Additional Services", () => {
  const seeAll = /<Link href="\/services" className="text-blue-700 hover:text-blue-900 font-semibold underline underline-offset-2">\s+See all our services &rarr;\s+<\/Link>/;
  const web = read("app/services/web-design-seo/page.tsx");
  assert.match(web, seeAll);
  // Near the end: under the last section's cards.
  assert.ok(web.indexOf("See all our services") > web.lastIndexOf("<section"));
  const screen = read("app/services/screen-hire/page.tsx");
  assert.match(screen, seeAll);
  assert.ok(screen.indexOf("See all our services") > screen.lastIndexOf("<section"));
  // The homepage: under the Additional Services cards (Leaflet Services keeps its own View all leaflet services).
  const home = read("app/page.tsx");
  const additional = home.slice(home.indexOf("{/* Additional Services */}"), home.indexOf("{/* Final CTA */}"));
  assert.match(additional, /<\/StaggerGroup>\s+<p className="mt-8">\s+<Link\s+href="\/services"\s+className="[^"]*"\s*>\s+See all our services →\s+<\/Link>\s+<\/p>/);
  assert.equal((home.match(/See all our services/g) ?? []).length, 1);
});
