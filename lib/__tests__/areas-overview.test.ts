import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { AREA_PAGES, type AreaSlug } from "@/lib/area-pages";
import { AREA_REGIONS, START, chooseRegion, matchAreas, postcodeDistrict, searchFor, visibleAreas } from "@/lib/area-search";
import { areas } from "@/lib/areas-data";
import { overviewCards } from "@/lib/areas-overview";
import { formatPostcodeRanges } from "@/lib/postcode-ranges";

// The /areas overview: cards built from each area page's own data and its
// old blurb, search by town or postcode (one postcode list, the area pages'
// own), region chips, the results line, the empty state, and every card in
// the server-rendered HTML with the page's metadata left as it was.

const cards = overviewCards();
const slugs = Object.keys(AREA_PAGES) as AreaSlug[];
const find = (q: string) => matchAreas(cards, q).map((c) => c.slug);
const shownFor = (query: string, region: (typeof START)["region"] = "all") => visibleAreas(cards, { query, region });

function render(mode: "page" | "empty"): string {
  const run = spawnSync(process.execPath, ["--import", "tsx", "lib/__tests__/render-areas-page.ts", mode], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  return run.stdout;
}

// Visible text: no tags, scripts or attributes.
const textOf = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");

test("one card per area page, in region order, with its old blurb, postcodes and homes", () => {
  assert.deepEqual(cards.map((c) => c.slug), AREA_REGIONS.flatMap((r) => [...r.slugs]));
  assert.deepEqual([...cards.map((c) => c.slug)].sort(), [...slugs].sort());
  for (const card of cards) {
    const page = AREA_PAGES[card.slug];
    assert.equal(card.href, `/areas/leaflet-distribution-${card.slug}`);
    assert.equal(card.name, page.name);
    assert.equal(card.blurb, areas.find((a) => a.href === card.href)!.desc, card.slug);
    assert.deepEqual(card.codes, page.postcodes.map((p) => p.code));
    assert.equal(card.range, formatPostcodeRanges(card.codes));
    assert.equal(card.wide, page.wide);
    assert.equal(card.regionLabel, AREA_REGIONS.find((r) => r.id === card.regionId)!.label);
  }
  const bySlug = Object.fromEntries(cards.map((c) => [c.slug, c]));
  assert.equal(bySlug.southampton.homes, "About 107,500 homes");
  assert.equal(bySlug.brockenhurst.homes, "About 2,000 homes");
  assert.equal(bySlug.dorset.homes, "About 293,500 homes");
  assert.equal(bySlug.winchester.range, "SO21 to SO24 and SO32");
  assert.equal(bySlug.dorset.range, "BH1 to BH18, BH21 to BH24, DT1 to DT4, DT9 and DT11");
  assert.equal(bySlug.poole.blurb, "Affluent harbour town with excellent residential distribution routes.");
  // Dorset's card claims only what its page covers; the page itself is unchanged.
  assert.equal(bySlug.dorset.blurb, "Coverage across Dorset, including Bournemouth, Poole, Christchurch and surrounding towns.");
  assert.doesNotMatch(bySlug.dorset.blurb, /county-wide|Weymouth/i);
});

test("postcodes find the pages that list their district, in any case and with or without the space", () => {
  assert.deepEqual(find("BH14"), ["poole", "dorset"]);
  for (const q of ["SO51 8AB", "so518ab", "SO518AB", "so51 8ab", "  SO51   8AB "]) assert.deepEqual(find(q), ["romsey"], q);
  assert.deepEqual(find("SO31"), []);
  assert.deepEqual(find("SO31 4AB"), []);
  assert.deepEqual(find("so314ab"), []);
  assert.deepEqual(find("bh23"), ["christchurch", "dorset"]);
  assert.deepEqual(find("SP6"), ["new-forest"]);
  // Town pages first, then New Forest and Dorset.
  assert.deepEqual(find("BH24"), ["ringwood", "new-forest", "dorset"]);
  assert.deepEqual(find("SO42 7AA"), ["brockenhurst", "new-forest"]);
  // The district a search names.
  assert.equal(postcodeDistrict("BH14"), "BH14");
  assert.equal(postcodeDistrict("so51 8ab"), "SO51");
  assert.equal(postcodeDistrict("SO518AB"), "SO51");
  assert.equal(postcodeDistrict("BH148AB"), "BH14");
  assert.equal(postcodeDistrict("SO51 8"), "SO51");
  assert.equal(postcodeDistrict("Romsey"), null);
  assert.equal(postcodeDistrict(""), null);
});

test("a postcode still being typed finds the districts it starts", () => {
  assert.deepEqual(find("SO1"), ["southampton"]);
  assert.deepEqual(find("SO5"), ["eastleigh", "chandlers-ford", "romsey"]);
  assert.deepEqual(find("SO51 8"), ["romsey"]);
  assert.deepEqual(find("BH"), ["ringwood", "bournemouth", "poole", "christchurch", "new-forest", "dorset"]);
  // A real district that matches exactly is not widened: BH1 is not BH10 to BH18.
  assert.deepEqual(find("BH1"), ["bournemouth", "dorset"]);
});

test("town names find their page, from the start of any word, in any case", () => {
  for (const q of ["Romsey", "romsey", "ROMSEY", "rom"]) assert.deepEqual(find(q), ["romsey"], q);
  for (const q of ["Chandler's Ford", "chandlers ford", "Chandler’s", "ford"]) assert.ok(find(q).includes("chandlers-ford"), q);
  assert.deepEqual(find("hedge"), ["hedge-end"]);
  assert.deepEqual(find("Forest"), ["new-forest"]);
  assert.deepEqual(find("Eastleigh"), ["eastleigh"]);
  // The places each page lists under its postcodes count too.
  assert.deepEqual(find("Lymington"), ["new-forest"]);
  assert.deepEqual(find("Weymouth"), ["dorset"]);
  assert.deepEqual(find("Totton"), ["totton", "new-forest"]);
  assert.deepEqual(find("Poole"), ["poole", "dorset"]);
  // Bare "Town centre" and "City centre" are not towns.
  assert.ok(cards.every((c) => !c.places.some((p) => /^(town|city) centre$/i.test(p))));
  assert.deepEqual(find("Hampshire"), []);
  assert.deepEqual(find("Basingstoke"), []);
  // Town pages always come before New Forest and Dorset.
  for (const q of ["BH24", "SO42", "Totton", "Poole", "BH", "B", "town"]) {
    const found = matchAreas(cards, q);
    const firstWide = found.findIndex((c) => c.wide);
    assert.ok(firstWide === -1 || found.slice(firstWide).every((c) => c.wide), q);
  }
});

test("region chips show their own areas, and the results line says what is showing", () => {
  assert.deepEqual(shownFor("").shown.map((c) => c.slug), cards.map((c) => c.slug));
  assert.equal(shownFor("").line, "Showing all 15 areas");
  const expected: Record<string, AreaSlug[]> = {
    "southampton-eastleigh": ["southampton", "eastleigh", "chandlers-ford", "hedge-end"],
    "winchester-test-valley": ["winchester", "romsey"],
    "new-forest-waterside": ["totton", "hythe", "brockenhurst", "ringwood", "new-forest"],
    "bournemouth-poole-dorset": ["bournemouth", "poole", "christchurch", "dorset"],
  };
  for (const region of AREA_REGIONS) {
    const { shown, line, empty } = shownFor("", region.id);
    assert.deepEqual(shown.map((c) => c.slug), expected[region.id], region.id);
    assert.equal(line, `Showing ${expected[region.id].length} areas in ${region.label}`);
    assert.equal(empty, false);
  }
  assert.equal(shownFor("", "southampton-eastleigh").line, "Showing 4 areas in Southampton & Eastleigh");
  assert.equal(shownFor("", "bournemouth-poole-dorset").line, "Showing 4 areas in Bournemouth, Poole & Dorset");
  // Each area is in exactly one region.
  assert.deepEqual(AREA_REGIONS.flatMap((r) => [...r.slugs]).sort(), [...slugs].sort());
  // A search looks across every region, whichever chip was chosen.
  const across = shownFor("BH14", "southampton-eastleigh");
  assert.deepEqual(across.shown.map((c) => c.slug), ["poole", "dorset"]);
  assert.equal(across.line, '2 areas match "BH14"');
  assert.equal(shownFor("Romsey").line, '1 area matches "Romsey"');
  assert.equal(shownFor("  so518ab ").line, '1 area matches "so518ab"');
  // Typing moves the chips back to All areas; choosing a region clears the search.
  assert.deepEqual(searchFor({ query: "", region: "winchester-test-valley" }, "BH14"), { query: "BH14", region: "all" });
  assert.deepEqual(searchFor({ query: "", region: "winchester-test-valley" }, " "), { query: " ", region: "winchester-test-valley" });
  assert.deepEqual(chooseRegion("new-forest-waterside"), { query: "", region: "new-forest-waterside" });
  assert.deepEqual(chooseRegion("all"), START);
});

test("a search that finds nothing shows the empty state, with a way to ask", () => {
  const none = shownFor("SO31");
  assert.deepEqual(none.shown, []);
  assert.equal(none.empty, true);
  assert.equal(none.line, 'No areas match "SO31"');
  const html = render("empty");
  assert.match(html, /role="status"[^>]*>No areas match &quot;SO31&quot;<\/p>/);
  assert.match(html, /<h3[^>]*>We don&#x27;t have a page for that one yet<\/h3>/);
  assert.match(textOf(html), /We may still deliver there\. Tell us where you'd like to reach and we'll let you know\./);
  assert.match(html, /<a[^>]*href="\/quote\?service=leaflet"[^>]*>Ask about your area<\/a>/);
  // The cards are all still there, just hidden.
  assert.equal((html.match(/<li hidden="">/g) ?? []).length, 15);
});

test("every card and its link is in the server-rendered HTML, all showing, with no outside links", () => {
  const html = render("page");
  for (const slug of slugs) {
    const links = html.match(new RegExp(`<a[^>]*href="/areas/leaflet-distribution-${slug}"`, "g")) ?? [];
    assert.equal(links.length, 1, slug);
  }
  assert.doesNotMatch(html, /<li hidden/);
  assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
  assert.match(html, /<h1[^>]*>Areas We Cover<\/h1>/);
  assert.match(html, /role="status"[^>]*>Showing all 15 areas<\/p>/);
  // Breadcrumb, the hero line and its link, the search and the panel.
  assert.match(html, /<nav aria-label="Breadcrumb"[\s\S]*?>Home<\/a>[\s\S]*?aria-current="page">Areas<\/span>/);
  const text = textOf(html);
  assert.match(text, /We distribute flyers and leaflets across Hampshire and Dorset, covering hundreds of postcodes as part of our full leaflet distribution service \. Every round is GPS tracked\./);
  assert.match(html, /<a[^>]*href="\/services"[^>]*>leaflet distribution service<\/a>/);
  assert.match(html, /<label for="area-search"[^>]*>Find your area<\/label>/);
  assert.match(html, /<input id="area-search" type="search"[^>]*placeholder="Type a town or postcode, e\.g\. BH14 or Romsey" aria-describedby="area-search-hint"/);
  assert.match(html, /id="area-search-hint"[^>]*>Works with full postcodes too, like SO51 8AB\.<\/p>/);
  assert.match(text, /Don't see your town\? These are our main areas, but we deliver to many more towns and villages across Hampshire and Dorset\. Tell us where you'd like to reach and we'll confirm within 24 hours\./);
  for (const tick of ["Hundreds of postcodes covered", "Several towns in one campaign", "Every round GPS tracked"]) assert.ok(text.includes(tick), tick);
  // The chips are buttons, All areas pressed.
  assert.match(html, /<button type="button" aria-pressed="true"[^>]*>All areas<\/button>/);
  for (const region of AREA_REGIONS) {
    assert.match(html, new RegExp(`<button type="button" aria-pressed="false"[^>]*>${region.label.replace(/&/g, "&amp;")}</button>`));
  }
  // The services block, after the cards and before the closing band, then the closing band.
  const cardsAt = html.indexOf('href="/areas/leaflet-distribution-dorset"');
  const servicesAt = html.indexOf(">Our Leaflet Distribution Services<");
  const closingAt = html.indexOf(">Planning a campaign across several areas?<");
  assert.ok(cardsAt > 0 && cardsAt < servicesAt && servicesAt < closingAt, `${cardsAt} ${servicesAt} ${closingAt}`);
  const services = [...html.slice(servicesAt, closingAt).matchAll(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/g)].map((m) => [m[1], textOf(m[2]).trim()]);
  assert.deepEqual(services, [
    ["/services", "Design, Print and Deliver View service \u2192"],
    ["/services", "Print and Deliver View service \u2192"],
    ["/services", "Leaflet Distribution View service \u2192"],
    ["/services/public-notice-leafleting", "Public Notice Leafleting View service \u2192"],
    ["/services", "See all services \u2192"],
  ]);
  assert.match(text, /From design and print through to targeted postcode campaigns, we have a service to suit every budget\./);
  assert.doesNotMatch(text, /Ready to Get Started/);
  assert.match(text, /Planning a campaign across several areas\? We can combine towns in one campaign, with one quote, one plan and one route report\. Get a Free Quote/);
  // Every link stays on the site; the quote links preselect leaflets.
  const hrefs = [...html.matchAll(/<a[^>]*href="([^"]*)"/g)].map((m) => m[1].replace(/&amp;/g, "&"));
  assert.ok(hrefs.every((h) => h.startsWith("/")), hrefs.filter((h) => !h.startsWith("/")).join(", "));
  assert.equal(hrefs.filter((h) => h === "/quote?service=leaflet").length, 2);
  assert.doesNotMatch(html, /<img\b/, "no map or images");
  // House rules: no dashes, banned words or prices in what people read.
  assert.doesNotMatch(html, /[\u2013\u2014]/);
  for (const word of [/\bstreet/i, /live tracked/i, /see where every flyer goes/i, /£/, /\bprice/i]) assert.doesNotMatch(text, word);
});

test("the page keeps its address, title, description, canonical and breadcrumb", () => {
  const source = readFileSync("app/areas/page.tsx", "utf8");
  const description =
    "Flyer and leaflet distribution across Hampshire and Dorset. View coverage areas including Southampton, Bournemouth, Poole and Winchester.";
  assert.equal(source.split(`"${description}"`).length - 1, 3);
  assert.equal(source.split('title: "Hampshire & Dorset Coverage Areas"').length - 1, 3);
  assert.match(source, /canonical: "https:\/\/www\.flyerdistributionhampshire\.co\.uk\/areas",/);
  assert.match(source, /url: "https:\/\/www\.flyerdistributionhampshire\.co\.uk\/areas",/);
  assert.match(
    source,
    /position: 1,\s+name: "Home",\s+item: "https:\/\/www\.flyerdistributionhampshire\.co\.uk",[\s\S]*?position: 2,\s+name: "Areas",\s+item: "https:\/\/www\.flyerdistributionhampshire\.co\.uk\/areas",/
  );
  assert.match(source, /dangerouslySetInnerHTML=\{\{ __html: JSON\.stringify\(breadcrumbSchema\) \}\}/);
});
