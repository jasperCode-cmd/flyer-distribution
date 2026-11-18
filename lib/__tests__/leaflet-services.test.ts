import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

// The homepage's Leaflet Services section: the header row, two package cards,
// three core service cards and the "Also" line, with every description as it
// was, every old link target kept, and each card one focusable link.

type Service = { title: string; desc: string; href: string; tags?: string[]; phoneTitle?: string; phoneLine?: string };
type Rendered = { html: string; PACKAGES: Service[]; CORE_SERVICES: Service[]; MORE_SERVICES: { title: string; href: string }[] };

let rendered: Rendered | null = null;
function render(): Rendered {
  if (!rendered) {
    const run = spawnSync(process.execPath, ["--import", "tsx", "lib/__tests__/render-leaflet-services.ts"], { encoding: "utf8" });
    assert.equal(run.status, 0, run.stderr);
    rendered = JSON.parse(run.stdout) as Rendered;
  }
  return rendered;
}

const textOf = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

// The homepage's ten services, word for word, and where each goes: its own
// page if it has one, otherwise /leaflet-delivery or its part of it.
const BEFORE: Record<string, { desc: string; href: string }> = {
  "Design, Print and Deliver": {
    desc: "Our full end-to-end service. We handle everything from design and printing in A6, A5, A4 or DL through to full distribution across your chosen areas.",
    href: "/leaflet-delivery#design-print-deliver",
  },
  "Print and Deliver": {
    desc: "Already have your design ready? We handle the printing in A6, A5, A4 or DL and deliver your leaflets directly through letterboxes across Hampshire and Dorset.",
    href: "/leaflet-delivery#print-and-deliver",
  },
  "Leaflet Distribution": {
    desc: "Door-to-door delivery to households across your chosen areas. Your printed materials posted directly through letterboxes across Hampshire and Dorset.",
    href: "/leaflet-delivery",
  },
  "Targeted Postcode Campaigns": {
    desc: "We use postcode data to focus your distribution on the areas most likely to respond to your campaign. Rather than blanket coverage, we put your leaflets where your potential customers actually live.",
    href: "/leaflet-delivery",
  },
  "Vehicle Leaflet Distribution": { desc: "", href: "/leaflet-delivery#vehicle-leaflet-distribution" },
  "Campaign Planning": { desc: "", href: "/leaflet-delivery#how-it-works" },
  "Leaflet Printing": { desc: "", href: "/leaflet-printing" },
  "Public Notice Leafleting": { desc: "", href: "/services/public-notice-leafleting" },
  "Hand-to-Hand Leaflet Distribution": {
    desc: "Direct, face-to-face handouts at shopping centres, town centres and events across Hampshire and Dorset for immediate brand exposure.",
    href: "/services/hand-to-hand-distribution",
  },
  "B2B Leaflet Distribution": { desc: "", href: "/services/b2b-distribution" },
};

test("every service is still there, with its description word for word and its link", () => {
  const { PACKAGES, CORE_SERVICES, MORE_SERVICES } = render();
  const shown = [...PACKAGES, ...CORE_SERVICES, ...MORE_SERVICES];
  assert.deepEqual(shown.map((s) => s.title).sort(), Object.keys(BEFORE).sort());
  for (const s of shown) assert.equal(s.href, BEFORE[s.title].href, s.title);
  for (const s of [...PACKAGES, ...CORE_SERVICES]) assert.equal(s.desc, BEFORE[s.title].desc, s.title);
  assert.deepEqual(PACKAGES.map((p) => p.title), ["Design, Print and Deliver", "Print and Deliver"]);
  assert.deepEqual(PACKAGES.map((p) => p.tags), [["Design", "Print", "Deliver"], ["Print", "Deliver"]]);
  assert.deepEqual(CORE_SERVICES.map((s) => s.title), ["Leaflet Distribution", "Targeted Postcode Campaigns", "Hand-to-Hand Leaflet Distribution"]);
});

test("the section renders the header, two packages, three cards and the Also line, each card one link", () => {
  const { html, PACKAGES, CORE_SERVICES, MORE_SERVICES } = render();
  const text = textOf(html);
  // Header row.
  assert.match(html, /<p class="[^"]*uppercase[^"]*">What we do<\/p><h2[^>]*>Leaflet Services<\/h2>/);
  assert.ok(text.includes("From door-to-door delivery to targeted postcode campaigns, we have a service to suit every budget and campaign goal."));
  assert.match(html, /<a class="[^"]*border-2 border-blue-700[^"]*" href="\/leaflet-delivery">View all leaflet services<svg aria-hidden="true"/);
  // Every card is a single link to its page, with the hover lift and a focus ring.
  const cards = [...html.matchAll(/<a class="(group flex h-full[^"]*)" href="([^"]*)">([\s\S]*?)<\/a>/g)];
  assert.equal(cards.length, 5);
  for (const [, cls] of cards) {
    assert.match(cls, /hover:-translate-y-1/);
    assert.match(cls, /focus-visible:ring-2/);
  }
  // A card's title as desktop shows it (phones may show a shorter one).
  const desktopTitle = (h: string) => textOf(/<h3[^>]*>([\s\S]*?)<\/h3>/.exec(h)![1].replace(/<span class="md:hidden">[^<]*<\/span>/g, ""));
  const cardOf = (title: string) => cards.find((c) => desktopTitle(c[3]) === title)!;
  for (const s of [...PACKAGES, ...CORE_SERVICES]) {
    const card = cardOf(s.title);
    assert.ok(card, s.title);
    assert.equal(card[2], s.href, s.title);
    assert.ok(textOf(card[3]).includes(s.desc), s.title);
    assert.match(card[3], /<svg aria-hidden="true" viewBox="0 0 24 24"[^>]*stroke-width="1.75"/, s.title);
  }
  // The featured package: dark blue, the badge, its tags and a yellow "Find out more".
  const featured = cardOf("Design, Print and Deliver");
  assert.match(featured[1], /bg-\[#1e3a8a\]/);
  assert.match(featured[3], /bg-\[#facc15\][^"]*">Most popular<\/span>/);
  assert.match(featured[3], /text-\[#facc15\][^"]*">Find out more<svg/);
  assert.deepEqual([...featured[3].matchAll(/<li[^>]*>([^<]*)<\/li>/g)].map((m) => m[1]), ["Design", "Print", "Deliver"]);
  // The second: white with a light border, no badge, blue "Find out more".
  const standard = cardOf("Print and Deliver");
  assert.match(standard[1], /\bbg-white\b/);
  assert.match(standard[1], /md:border-gray-200/);
  assert.doesNotMatch(standard[3], /Most popular/);
  assert.match(standard[3], /text-\[#1d4ed8\][^"]*">Find out more<svg/);
  assert.deepEqual([...standard[3].matchAll(/<li[^>]*>([^<]*)<\/li>/g)].map((m) => m[1]), ["Print", "Deliver"]);
  assert.equal((html.match(/Most popular/g) ?? []).length, 1);
  // The Also line (as desktop shows it), each name an in-text link, then View all leaflet services.
  const also = /<p class="[^"]*md:mt-8[^"]*">(Also:[\s\S]*?)<\/p>/.exec(html)![1];
  assert.equal(textOf(also).replace(/ ,/g, ","), "Also: Leaflet Printing, Campaign Planning, Vehicle Leaflet Distribution, Public Notice Leafleting and B2B Leaflet Distribution . View all leaflet services");
  assert.deepEqual(
    [...also.matchAll(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => [m[1], textOf(m[2])]),
    [...MORE_SERVICES.map((s) => [s.href, s.title]), ["/leaflet-delivery", "View all leaflet services"]]
  );
  // Every service keeps its page, the rest and View all leaflet services go to /leaflet-delivery (no link to
  // /services or its cards is left), and nothing leaves the site.
  const hrefs = new Set([...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]));
  assert.deepEqual([...hrefs].sort(), [
    "/leaflet-delivery",
    "/leaflet-delivery#design-print-deliver",
    "/leaflet-delivery#how-it-works",
    "/leaflet-delivery#print-and-deliver",
    "/leaflet-delivery#vehicle-leaflet-distribution",
    "/leaflet-printing",
    "/services/b2b-distribution",
    "/services/hand-to-hand-distribution",
    "/services/public-notice-leafleting",
  ]);
  assert.equal([...html.matchAll(/href="\/leaflet-delivery">View all leaflet services/g)].length, 2);
  // House rules.
  assert.doesNotMatch(html, /[\u2013\u2014]/);
  for (const word of [/\bstreet/i, /£/, /\bprices?\b/i]) assert.doesNotMatch(text, word);
});

test("on phones: one compact navy card, one white panel of four rows, the same names in Also, View all leaflet services last", () => {
  const { html, PACKAGES, CORE_SERVICES, MORE_SERVICES } = render();
  // What a phone hides is display: none below md, so it is neither shown nor read out there.
  const phoneText = (h: string) =>
    textOf(h.replace(/<(\w+) class="[^"]*(?<![:\w-])hidden(?![\w-])[^"]*"[^>]*>[\s\S]*?<\/\1>/g, ""));
  // Design, Print and Deliver: the title and badge on one row, one line, Find out more; no icon, chips or long description.
  const featured = /<a class="group flex h-full[^"]*" href="\/leaflet-delivery#design-print-deliver">([\s\S]*?)<\/a>/.exec(html)![1];
  assert.match(featured, /<div class="flex items-start justify-between gap-3 md:block"><h3 class="font-heading text-\[20px\] font-extrabold[^"]*">Design, Print and Deliver<\/h3><span class="[^"]*bg-\[#facc15\][^"]*">Most popular<\/span><\/div>/);
  assert.match(featured, /<span class="hidden md:flex h-14 w-14/);
  assert.match(featured, /<ul class="mt-5 hidden flex-wrap gap-2 md:flex">/);
  assert.equal(phoneText(featured), "Design, Print and Deliver Most popular We design it, print it and deliver it for you. Find out more");
  assert.equal(PACKAGES[0].phoneLine, "We design it, print it and deliver it for you.");
  // The four rows: each a whole link with a 36px light blue icon square, a bold navy title, a short grey line and a chevron.
  const rows = [...html.matchAll(/<a class="(group flex h-full min-h-14[^"]*)" href="([^"]*)">([\s\S]*?)<\/a>/g)];
  assert.deepEqual(
    rows.map((r) => [r[2], phoneText(r[3])]),
    [
      ["/leaflet-delivery#print-and-deliver", "Print and Deliver Your artwork, printed and delivered"],
      ["/leaflet-delivery", "Leaflet Distribution Through letterboxes in your areas"],
      ["/leaflet-delivery", "Targeted Postcode Campaigns Focus on the areas most likely to respond"],
      ["/services/hand-to-hand-distribution", "Hand-to-Hand Distribution Handed out at events and busy spots"],
    ]
  );
  assert.deepEqual([PACKAGES[1], ...CORE_SERVICES].map((s) => s.phoneLine), [
    "Your artwork, printed and delivered",
    "Through letterboxes in your areas",
    "Focus on the areas most likely to respond",
    "Handed out at events and busy spots",
  ]);
  for (const [, cls, , inner] of rows) {
    assert.match(cls, /\bitems-center\b/);
    assert.match(cls, /border-x border-x-\[#e2e8f0\]/);
    assert.match(inner, /<span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-\[#dbeafe\]/);
    assert.match(inner, /<h3 class="text-\[15px\] font-bold text-blue-900/);
    assert.match(inner, /<p class="text-\[13px\] text-gray-500 md:hidden">/);
    assert.match(inner, /<svg aria-hidden="true" viewBox="0 0 24 24" class="ml-auto h-4 w-4 shrink-0 text-slate-400 md:hidden"[^>]*><path d="M9 6l6 6-6 6"/);
  }
  // One panel: the first row's top corners, #f1f5f9 lines between rows, the last row's bottom corners.
  assert.match(rows[0][1], /rounded-t-2xl border-t border-t-\[#e2e8f0\]/);
  for (const r of rows.slice(1)) assert.match(r[1], /border-t border-t-\[#f1f5f9\]/);
  assert.match(rows[3][1], /rounded-b-2xl border-b border-b-\[#e2e8f0\]/);
  // 12px between the navy card and the panel; no gap between the panel's rows.
  assert.match(html, /<div class="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-6">/);
  assert.match(html, /<div class="grid grid-cols-1 md:mt-6 md:grid-cols-3 md:gap-6">/);
  // Also: the same five names as desktop, Leaflet Printing first; only its View all leaflet services link waits for md (phones have the button).
  const also = /<p class="[^"]*md:mt-8[^"]*">(Also:[\s\S]*?)<\/p>/.exec(html)![1];
  assert.equal(
    phoneText(also).replace(/ ([,.])/g, "$1"),
    "Also: Leaflet Printing, Campaign Planning, Vehicle Leaflet Distribution, Public Notice Leafleting and B2B Leaflet Distribution."
  );
  assert.deepEqual(MORE_SERVICES.map((s) => s.title), ["Leaflet Printing", "Campaign Planning", "Vehicle Leaflet Distribution", "Public Notice Leafleting", "B2B Leaflet Distribution"]);
  assert.match(also, /<a class="hidden [^"]*md:inline-flex" href="\/leaflet-delivery">View all leaflet services<svg/);
  // View all leaflet services: one link, last in the section (at the bottom on phones), full width and 48px tall there; top right from md.
  const viewAll = [...html.matchAll(/<a class="([^"]*border-2 border-blue-700[^"]*)" href="\/leaflet-delivery">View all leaflet services<svg/g)];
  assert.equal(viewAll.length, 1);
  assert.match(viewAll[0][1], /\bmt-6 flex min-h-12 w-full\b/);
  assert.match(viewAll[0][1], /md:col-start-2 md:row-start-1 md:mt-0 md:inline-flex md:min-h-0 md:w-auto/);
  assert.match(html.slice(html.lastIndexOf("<a ")), /^<a class="[^"]*border-2 border-blue-700[^"]*" href="\/leaflet-delivery">View all leaflet services<svg/);
  // Every service's link is in the HTML once; /leaflet-delivery four times (Leaflet Distribution, Targeted Postcode
  // Campaigns, and View all leaflet services twice, as before: the button and the Also line's link).
  for (const href of ["/leaflet-delivery#design-print-deliver", "/leaflet-delivery#print-and-deliver", "/services/hand-to-hand-distribution", "/leaflet-printing", "/leaflet-delivery#how-it-works", "/leaflet-delivery#vehicle-leaflet-distribution", "/services/public-notice-leafleting", "/services/b2b-distribution"]) {
    assert.equal(html.split(`href="${href}"`).length - 1, 1, href);
  }
  assert.equal(html.split('href="/leaflet-delivery"').length - 1, 4);
});

test("the homepage shows the section in the same place, and nothing else of it is left behind", () => {
  const page = readFileSync("app/page.tsx", "utf8");
  const caseStudies = page.indexOf('href="/case-studies"');
  const section = page.indexOf("{/* Services overview */}\n      <LeafletServices />");
  const coverage = page.indexOf("{/* Coverage areas */}");
  assert.ok(caseStudies > 0 && caseStudies < section && section < coverage, `${caseStudies} ${section} ${coverage}`);
  assert.equal(page.split("<LeafletServices />").length - 1, 1);
  assert.doesNotMatch(page, /const services = \[|services\.map/);
});

test("every /services card keeps its stable id and scroll margin, and each homepage anchor lands on its part of /leaflet-delivery", () => {
  const source = readFileSync("app/services/page.tsx", "utf8");
  const ids = [...source.matchAll(/^    id: "([a-z0-9-]+)",\n    title: "([^"]+)",$/gm)].map((m) => [m[1], m[2]]);
  assert.deepEqual(ids, [
    ["design-print-deliver", "Design, Print and Deliver"],
    ["print-and-deliver", "Print and Deliver"],
    ["leaflet-distribution", "Leaflet Distribution"],
    ["targeted-postcode-campaigns", "Targeted Postcode Campaigns"],
    ["campaign-planning", "Campaign Planning"],
    ["vehicle-leaflet-distribution", "Vehicle Leaflet Distribution"],
    ["public-notice-leafleting", "Public Notice Leafleting"],
    ["hand-to-hand-leaflet-distribution", "Hand-to-Hand Leaflet Distribution"],
    ["b2b-leaflet-distribution", "B2B Leaflet Distribution"],
  ]);
  // Every card carries its id and clears the 65px sticky header with room to spare.
  assert.match(source, /id=\{pkg\.id\}\n\s+className="scroll-mt-24 /);
  assert.match(source, /"scroll-mt-24 group bg-white rounded-lg/);
  assert.equal(source.split("id={svc.id}").length - 1, 2);
  // Each homepage anchor names a real part of /leaflet-delivery, for the service it is about (Campaign Planning
  // is How it works), and none points at a /services card any more.
  const { PACKAGES, CORE_SERVICES, MORE_SERVICES } = render();
  const all = [...PACKAGES, ...CORE_SERVICES, ...MORE_SERVICES];
  assert.ok(all.every((s) => !s.href.startsWith("/services#")));
  const anchored = all.filter((s) => s.href.startsWith("/leaflet-delivery#")).map((s) => [s.href.slice("/leaflet-delivery#".length), s.title]);
  assert.deepEqual(anchored, [
    ["design-print-deliver", "Design, Print and Deliver"],
    ["print-and-deliver", "Print and Deliver"],
    ["how-it-works", "Campaign Planning"],
    ["vehicle-leaflet-distribution", "Vehicle Leaflet Distribution"],
  ]);
  const delivery = readFileSync("app/leaflet-delivery/page.tsx", "utf8");
  for (const [id] of anchored) assert.match(delivery, new RegExp(`id="${id}"|id: "${id}"`), id);
});
