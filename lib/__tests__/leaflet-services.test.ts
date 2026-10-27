import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

// The homepage's Leaflet Services section: the header row, two package cards,
// three core service cards and the "Also" line, with every description as it
// was, every old link target kept, and each card one focusable link.

type Service = { title: string; desc: string; href: string; tags?: string[] };
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

// The homepage's nine services, word for word, and where each goes: its own
// page if it has one, otherwise its card on /services.
const BEFORE: Record<string, { desc: string; href: string }> = {
  "Design, Print and Deliver": {
    desc: "Our full end-to-end service. We handle everything from design and printing in A6, A5, A4 or DL through to full distribution across your chosen areas.",
    href: "/services#design-print-deliver",
  },
  "Print and Deliver": {
    desc: "Already have your design ready? We handle the printing in A6, A5, A4 or DL and deliver your leaflets directly through letterboxes across Hampshire and Dorset.",
    href: "/services#print-and-deliver",
  },
  "Leaflet Distribution": {
    desc: "Door-to-door delivery to households across your chosen areas. Your printed materials posted directly through letterboxes across Hampshire and Dorset.",
    href: "/services#leaflet-distribution",
  },
  "Targeted Postcode Campaigns": {
    desc: "We use postcode data to focus your distribution on the areas most likely to respond to your campaign. Rather than blanket coverage, we put your leaflets where your potential customers actually live.",
    href: "/services#targeted-postcode-campaigns",
  },
  "Vehicle Leaflet Distribution": { desc: "", href: "/services#vehicle-leaflet-distribution" },
  "Campaign Planning": { desc: "", href: "/services#campaign-planning" },
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
  assert.match(html, /<a class="[^"]*border-2 border-blue-700[^"]*" href="\/services">View all services<svg aria-hidden="true"/);
  // Every card is a single link to its page, with the hover lift and a focus ring.
  const cards = [...html.matchAll(/<a class="(group flex h-full[^"]*)" href="([^"]*)">([\s\S]*?)<\/a>/g)];
  assert.equal(cards.length, 5);
  for (const [, cls] of cards) {
    assert.match(cls, /hover:-translate-y-1/);
    assert.match(cls, /focus-visible:ring-2/);
  }
  const cardOf = (title: string) => cards.find((c) => c[3].includes(`>${title}</h3>`))!;
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
  assert.match(featured[3], /text-\[#facc15\]">Find out more<svg/);
  assert.deepEqual([...featured[3].matchAll(/<li[^>]*>([^<]*)<\/li>/g)].map((m) => m[1]), ["Design", "Print", "Deliver"]);
  // The second: white with a light border, no badge, blue "Find out more".
  const standard = cardOf("Print and Deliver");
  assert.match(standard[1], /border-gray-200 bg-white/);
  assert.doesNotMatch(standard[3], /Most popular/);
  assert.match(standard[3], /text-\[#1d4ed8\]">Find out more<svg/);
  assert.deepEqual([...standard[3].matchAll(/<li[^>]*>([^<]*)<\/li>/g)].map((m) => m[1]), ["Print", "Deliver"]);
  assert.equal((html.match(/Most popular/g) ?? []).length, 1);
  // The Also line, each name an in-text link, then View all services.
  const also = /<p class="mt-8[^"]*">([\s\S]*?)<\/p>/.exec(html)![1];
  assert.equal(textOf(also), "Also: Campaign Planning , Vehicle Leaflet Distribution , Public Notice Leafleting and B2B Leaflet Distribution . View all services");
  assert.deepEqual(
    [...also.matchAll(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => [m[1], textOf(m[2])]),
    [...MORE_SERVICES.map((s) => [s.href, s.title]), ["/services", "View all services"]]
  );
  // Every service keeps its page, View all services stays /services, and nothing leaves the site.
  const hrefs = new Set([...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]));
  assert.deepEqual([...hrefs].sort(), [
    "/services",
    "/services#campaign-planning",
    "/services#design-print-deliver",
    "/services#leaflet-distribution",
    "/services#print-and-deliver",
    "/services#targeted-postcode-campaigns",
    "/services#vehicle-leaflet-distribution",
    "/services/b2b-distribution",
    "/services/hand-to-hand-distribution",
    "/services/public-notice-leafleting",
  ]);
  assert.equal([...html.matchAll(/href="\/services">View all services/g)].length, 2);
  // House rules.
  assert.doesNotMatch(html, /[\u2013\u2014]/);
  for (const word of [/\bstreet/i, /£/, /\bprices?\b/i]) assert.doesNotMatch(text, word);
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

test("every /services card has a stable id and a scroll margin, and each homepage anchor lands on one", () => {
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
  // Each homepage anchor names a real card, for the service it is about.
  const { PACKAGES, CORE_SERVICES, MORE_SERVICES } = render();
  const byId = new Map(ids.map(([id, title]) => [id, title]));
  const anchored = [...PACKAGES, ...CORE_SERVICES, ...MORE_SERVICES].filter((s) => s.href.startsWith("/services#"));
  assert.equal(anchored.length, 6);
  for (const s of anchored) assert.equal(byId.get(s.href.slice("/services#".length)), s.title, s.href);
});
