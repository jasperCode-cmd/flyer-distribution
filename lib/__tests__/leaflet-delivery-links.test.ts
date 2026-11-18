// The site's links to /leaflet-delivery: leaflet distribution and door to door
// content goes there (or to its packages, How it works or the vehicle card),
// while links that mean all services (the menu's All services bar, the
// footer's Services, breadcrumbs, View all services on /about) stay on
// /services. No link points at a /services card for a leaflet service any more.
// Checked on the source; the crawl in the browser run checks every page.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { AREA_PAGES } from "@/lib/area-pages";

const read = (p: string) => readFileSync(p, "utf8");
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === "__tests__" ? [] : files(p);
    return /\.tsx?$/.test(name) ? [p] : [];
  });
const SOURCES = ["app", "components", "lib"].flatMap(files);
const DELIVERY = read("app/leaflet-delivery/page.tsx");

test("no link anywhere points at a /services card any more", () => {
  for (const file of SOURCES) {
    const source = read(file);
    assert.doesNotMatch(source, /href(?:=|: )["'`{]+\/services#/, file);
    assert.doesNotMatch(source, /["'`]\/services#[a-z-]+["'`]/, file);
  }
});

test("every /leaflet-delivery anchor used on the site is a part of the page that clears the sticky header", () => {
  const anchors = new Set<string>();
  for (const file of SOURCES) for (const m of read(file).matchAll(/\/leaflet-delivery#([a-z-]+)/g)) anchors.add(m[1]);
  assert.deepEqual([...anchors].sort(), ["design-print-deliver", "how-it-works", "print-and-deliver", "vehicle-leaflet-distribution"]);
  assert.match(DELIVERY, /<li id="design-print-deliver" className="[^"]*scroll-mt-24/);
  assert.match(DELIVERY, /<li id="print-and-deliver" className="[^"]*scroll-mt-24/);
  assert.match(DELIVERY, /<section id="how-it-works" className=\{`scroll-mt-16 /);
  // The vehicle card: its id, and a scroll margin, on its list item.
  assert.match(DELIVERY, /cta: "Ask about it",\s+whole: false,\s+id: "vehicle-leaflet-distribution",/);
  assert.match(DELIVERY, /<li key=\{m\.title\} id=\{m\.id\} className=\{m\.id \? "flex scroll-mt-24" : "flex"\}>/);
});

test("the footer leads its Services list with Leaflet Delivery; the all-services links stay on /services", () => {
  const footer = read("components/Footer.tsx");
  assert.match(footer, /const serviceLinks = \[\n  \{ href: "\/leaflet-delivery", label: "Leaflet Delivery" \},\n  \{ href: "\/services", label: "Services" \},/);
  // The menu's All services bar, /about's View all services, and the breadcrumbs of the pages under /services.
  assert.match(read("components/Header.tsx"), /<Link\s+href="\/services"\s+onClick=\{onClick\}/);
  assert.match(read("app/about/page.tsx"), /<Link href="\/services" className="[^"]*">\s+View all services &rarr;/);
  for (const page of ["b2b-distribution", "hand-to-hand-distribution", "public-notice-leafleting", "screen-hire", "web-design-seo"]) {
    assert.match(read(`app/services/${page}/page.tsx`), /\{ label: "Services", href: "\/services" \}/, page);
  }
});

test("the three leaflet service pages each link back to /leaflet-delivery in their copy", () => {
  const backLink = (page: string) => {
    const m = /<Link href="\/leaflet-delivery" className="text-blue-700 hover:underline font-medium">\s+([^<]+?)\s+<\/Link>/.exec(read(`app/services/${page}/page.tsx`));
    return m?.[1];
  };
  assert.equal(backLink("hand-to-hand-distribution"), "door-to-door rounds");
  assert.equal(backLink("public-notice-leafleting"), "door to door leaflet delivery");
  assert.equal(backLink("b2b-distribution"), "leaflet delivery options");
  assert.match(read("app/services/b2b-distribution/page.tsx"), /To reach homes as well\s+as businesses, see all our\{" "\}\s+<Link href="\/leaflet-delivery"/);
});

test("the area pages: leaflet distribution to the page, vehicle campaigns to the vehicle card, design and printing to the package", () => {
  const links = Object.values(AREA_PAGES).flatMap((area) =>
    area.copy.flatMap((p) => p.flatMap((piece) => (typeof piece === "string" ? [] : [[area.name, piece.href, piece.text]])))
  );
  assert.ok(links.every(([, href]) => href !== "/services" && !href.startsWith("/services#")));
  const toDelivery = links.filter(([, href]) => href.startsWith("/leaflet-delivery"));
  assert.deepEqual(toDelivery, [
    ["Southampton", "/leaflet-delivery", "leaflet distribution services"],
    ["Bournemouth", "/leaflet-delivery", "distribution services"],
    ["Poole", "/leaflet-delivery", "our door to door leaflet delivery"],
    ["Winchester", "/leaflet-delivery", "our full leaflet distribution service"],
    ["New Forest", "/leaflet-delivery#vehicle-leaflet-distribution", "leaflet distribution"],
    ["Ringwood", "/leaflet-delivery#vehicle-leaflet-distribution", "leaflet distribution"],
    ["Christchurch", "/leaflet-delivery#vehicle-leaflet-distribution", "vehicle leaflet distribution"],
    ["Romsey", "/leaflet-delivery#vehicle-leaflet-distribution", "our leaflet distribution options"],
    ["Hythe", "/leaflet-delivery#vehicle-leaflet-distribution", "our distribution options"],
    ["Totton", "/leaflet-delivery#vehicle-leaflet-distribution", "the full range of services"],
    ["Hedge End", "/leaflet-delivery#vehicle-leaflet-distribution", "what we offer"],
    ["Chandler's Ford", "/leaflet-delivery#vehicle-leaflet-distribution", "the leaflet delivery we offer"],
    ["Brockenhurst", "/leaflet-delivery#vehicle-leaflet-distribution", "the services we provide"],
    ["Lymington", "/leaflet-delivery#vehicle-leaflet-distribution", "our leaflet distribution services"],
  ]);
  // Each vehicle link sits in a sentence about vehicle campaigns.
  for (const area of Object.values(AREA_PAGES)) {
    for (const p of area.copy) {
      const sentence = p.map((piece) => (typeof piece === "string" ? piece : piece.text)).join("");
      if (p.some((piece) => typeof piece !== "string" && piece.href.endsWith("#vehicle-leaflet-distribution"))) assert.match(sentence, /vehicle/i, area.name);
    }
  }
  // The shared template's How it works step.
  assert.match(read("components/AreaPage.tsx"), /<Link href="\/leaflet-delivery#design-print-deliver" className="[^"]*">\s+design and printing\s+<\/Link>/);
});

test("the other pages: /areas, /about, /before-you-book, /case-studies, /faq and Web Design & SEO", () => {
  const areas = read("app/areas/page.tsx");
  assert.match(areas, /\{ title: "Design, Print and Deliver", href: "\/leaflet-delivery#design-print-deliver" \},\s+\{ title: "Print and Deliver", href: "\/leaflet-delivery#print-and-deliver" \},\s+\{ title: "Leaflet Distribution", href: "\/leaflet-delivery" \},/);
  assert.match(areas, /href="\/leaflet-delivery"[^>]*>\s+See all leaflet services →/);
  assert.match(read("components/AreasExplorer.tsx"), /<Link href="\/leaflet-delivery"[^>]*>\s+leaflet distribution service\s+<\/Link>/);
  const about = read("app/about/page.tsx");
  assert.match(about, /\{ label: "Distribution", href: "\/leaflet-delivery" \},/);
  assert.match(about, /<Link href="\/leaflet-delivery" [^>]*>\s+Leaflet services &rarr;/);
  const book = read("app/before-you-book/page.tsx");
  assert.match(book, /link: \{ href: "\/leaflet-delivery", label: "Our leaflet delivery" \},/);
  assert.match(book, /<Link href="\/leaflet-delivery" className=\{link\}>\s+delivered properly, to a high standard/);
  const cases = read("app/case-studies/page.tsx");
  const caseLinks = [...cases.matchAll(/<Link href="([^"]+)" className="text-blue-700 hover:underline font-medium">\s+([^<]+?)\s+<\/Link>/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(
    caseLinks.filter(([href]) => href.startsWith("/leaflet-delivery")),
    [
      ["/leaflet-delivery", "leaflet drop"],
      ["/leaflet-delivery", "our leaflet services"],
      ["/leaflet-delivery", "Leaflet distribution"],
      ["/leaflet-delivery", "our leaflet delivery service"],
    ]
  );
  // The FAQ's links (its answers' words, and so its FAQPage schema, are as before).
  const faq = read("app/faq/page.tsx");
  const faqLinks = [...faq.matchAll(/<Link href="(\/leaflet-delivery[^"]*)" className=\{a\}>([^<]+)<\/Link>/g)].map((m) => [m[2], m[1]]);
  assert.deepEqual(faqLinks, [
    ["door-to-door leaflet distribution service", "/leaflet-delivery"],
    ["Design, Print and Deliver package", "/leaflet-delivery#design-print-deliver"],
    ["Campaign Planning service", "/leaflet-delivery#how-it-works"],
    ["Print and Deliver service", "/leaflet-delivery#print-and-deliver"],
    ["Campaign Planning service", "/leaflet-delivery#how-it-works"],
    ["leaflet distribution services", "/leaflet-delivery"],
    ["door-to-door leaflet distribution campaign", "/leaflet-delivery"],
  ]);
  const web = read("app/services/web-design-seo/page.tsx");
  const cards = [...web.matchAll(/href="([^"]+)"\s+className="bg-white rounded-lg[\s\S]*?<h3[^>]*>\s+([^<]+?)\s+<\/h3>/g)].map((m) => [m[2], m[1]]);
  assert.deepEqual(cards, [
    ["Design, Print and Deliver", "/leaflet-delivery#design-print-deliver"],
    ["Print and Deliver", "/leaflet-delivery#print-and-deliver"],
    ["Leaflet Distribution", "/leaflet-delivery"],
  ]);
});
