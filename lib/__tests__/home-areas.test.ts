import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { AREA_REGIONS, START, areasSearchHref, queryFromSearch, searchFor, visibleAreas } from "@/lib/area-search";
import { overviewCards, regionColumns } from "@/lib/areas-overview";

// The homepage's Areas We Cover: the four regions and their towns from the
// same data as the /areas explorer, the "Check if we cover you" search that
// sends people to /areas?q=, and /areas running that search when it opens.

function render(): string {
  const run = spawnSync(process.execPath, ["--import", "tsx", "lib/__tests__/render-home-areas.ts"], { encoding: "utf8" });
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

const EXPECTED: [string, string[]][] = [
  ["Southampton & Eastleigh", ["Southampton", "Eastleigh", "Chandler's Ford", "Hedge End"]],
  ["Winchester & Test Valley", ["Winchester", "Romsey"]],
  ["New Forest & Waterside", ["New Forest", "Totton", "Hythe", "Brockenhurst", "Ringwood"]],
  ["Bournemouth, Poole & Dorset", ["Bournemouth", "Poole", "Christchurch", "Dorset"]],
];

test("the four columns are the explorer's own regions, names and links", () => {
  const columns = regionColumns();
  assert.deepEqual(columns.map((c) => [c.label, c.areas.map((a) => a.name)]), EXPECTED);
  const cards = overviewCards();
  for (const column of columns) {
    const region = AREA_REGIONS.find((r) => r.id === column.id)!;
    assert.equal(column.label, region.label);
    // The same towns as the region on /areas, only led by its namesake.
    assert.deepEqual(column.areas.map((a) => a.slug).sort(), [...region.slugs].sort());
    assert.ok(region.label.startsWith(column.areas[0].name), column.label);
    for (const area of column.areas) {
      const card = cards.find((c) => c.slug === area.slug)!;
      assert.equal(area.name, card.name);
      assert.equal(area.href, card.href);
    }
  }
});

test("the section: heading and intro, the search form, 15 town links in their columns, and See all coverage areas", () => {
  const html = render();
  const text = textOf(html);
  assert.match(html, /^<section class="bg-blue-900 text-white">/);
  assert.match(html, /<h2[^>]*>\s*Areas We Cover\s*<\/h2>/);
  assert.ok(text.includes("We cover the Hampshire and Dorset corridor, from Winchester in the north to Poole in the west, and everywhere in between."));
  assert.match(html, /<a class="text-white underline[^"]*" href="\/areas\/leaflet-distribution-winchester">Winchester<\/a>/);
  // A plain GET form to /areas with q, so it works without JavaScript.
  const form = /<form\b[^>]*>/.exec(html)![0];
  for (const attr of ['action="/areas"', 'method="get"', 'role="search"']) assert.ok(form.includes(attr), attr);
  assert.match(html, /<label for="area-check"[^>]*>Check if we cover you<\/label>/);
  const input = /<input\b[^>]*>/.exec(html)![0];
  for (const attr of ['id="area-check"', 'name="q"', 'type="search"', 'placeholder="Town or postcode, e.g. BH14"']) assert.ok(input.includes(attr), attr);
  assert.match(html, /<button type="submit" class="h-12[^"]*">Check<\/button>/);
  assert.equal((html.match(/<form\b/g) ?? []).length, 1);
  // Each column's heading and its towns, one link per row.
  const columns = [...html.matchAll(/<h3[^>]*>([^<]*)<\/h3><ul>([\s\S]*?)<\/ul>/g)].map((m) => [
    m[1].replace(/&amp;/g, "&"),
    [...m[2].matchAll(/<li class="border-b[^"]*"><a class="([^"]*)" href="([^"]*)">([\s\S]*?)<\/a><\/li>/g)].map((l) => ({ cls: l[1], href: l[2], name: textOf(l[3]) })),
  ]) as [string, { cls: string; href: string; name: string }[]][];
  assert.deepEqual(columns.map(([label, links]) => [label, links.map((l) => l.name)]), EXPECTED);
  const links = columns.flatMap(([, l]) => l);
  assert.equal(links.length, 15);
  const cards = overviewCards();
  for (const link of links) {
    assert.equal(link.href, cards.find((c) => c.name === link.name)!.href, link.name);
    assert.match(link.cls, /min-h-11/, link.name);
    assert.match(link.cls, /focus-visible:ring-2/, link.name);
  }
  assert.match(html, /<a class="mt-8 inline-flex min-h-11[^"]*focus-visible:ring-2[^"]*" href="\/areas">See all coverage areas<svg aria-hidden="true"/);
  // No image, no links off the site, and the house rules.
  assert.doesNotMatch(html, /<img\b|Overhead/);
  assert.ok([...html.matchAll(/href="([^"]*)"/g)].every((m) => m[1].startsWith("/")));
  assert.doesNotMatch(html, /[\u2013\u2014]/);
  assert.doesNotMatch(text, /\bstreet/i);
});

test("the search sends people to /areas?q=, and /areas runs it straight away", () => {
  assert.equal(areasSearchHref("BH14"), "/areas?q=BH14");
  assert.equal(areasSearchHref("romsey"), "/areas?q=romsey");
  assert.equal(areasSearchHref("  SO51 8AB "), "/areas?q=SO51+8AB");
  assert.equal(areasSearchHref(""), "/areas");
  assert.equal(areasSearchHref("   "), "/areas");
  // /areas reads it back, the same way a plain form sends it.
  assert.equal(queryFromSearch("?q=BH14"), "BH14");
  assert.equal(queryFromSearch("?q=SO51+8AB"), "SO51 8AB");
  assert.equal(queryFromSearch("?q=SO51%208AB"), "SO51 8AB");
  for (const none of ["", "?q=", "?q=+", "?other=1"]) assert.equal(queryFromSearch(none), "", none);
  for (const typed of ["BH14", "SO51 8AB", "Chandler's Ford"]) assert.equal(queryFromSearch(areasSearchHref(typed).slice("/areas".length)), typed);
  // What /areas then shows.
  const cards = overviewCards();
  const open = (search: string) => visibleAreas(cards, searchFor(START, queryFromSearch(search)));
  const bh14 = open("?q=BH14");
  assert.deepEqual(bh14.shown.map((c) => c.slug), ["poole", "dorset"]);
  assert.equal(bh14.line, '2 areas match "BH14"');
  const romsey = open("?q=romsey");
  assert.deepEqual(romsey.shown.map((c) => c.slug), ["romsey"]);
  assert.equal(romsey.line, '1 area matches "romsey"');
  // Without q it is exactly as before.
  assert.deepEqual(open(""), visibleAreas(cards, START));
  // The explorer runs it when it opens, with the query in its box; the form uses the same address.
  const explorer = readFileSync("components/AreasExplorer.tsx", "utf8");
  assert.match(explorer, /useEffect\(\(\) => \{\s+const q = queryFromSearch\(window\.location\.search\);\s+if \(q\) setState\(\(s\) => searchFor\(s, q\)\);\s+\}, \[\]\);/);
  assert.match(explorer, /value=\{state\.query\}/);
  assert.match(readFileSync("components/AreaCheckForm.tsx", "utf8"), /window\.location\.assign\(areasSearchHref\(/);
});

test("the homepage shows the section where it was, with the old image and grouping gone", () => {
  const page = readFileSync("app/page.tsx", "utf8");
  const services = page.indexOf("<LeafletServices />");
  const areas = page.indexOf("{/* Coverage areas */}\n      <HomeAreas />");
  const additional = page.indexOf("{/* Additional Services */}");
  assert.ok(services > 0 && services < areas && areas < additional, `${services} ${areas} ${additional}`);
  assert.doesNotMatch(page, /ScrollReveal|areas-data|Overhead-shot/);
  assert.doesNotMatch(readFileSync("lib/areas-data.ts", "utf8"), /\bregion: "|export type Region|export const regions/);
});
