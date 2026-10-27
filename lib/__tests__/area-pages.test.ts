import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { findPostcode } from "@/lib/area-planner/data";
import { AREA_PAGES, REVIEWS, type AreaPageData, type AreaSlug } from "@/lib/area-pages";
import { formatPostcodeRanges } from "@/lib/postcode-ranges";

// The 15 area pages' shared template data: the confirmed postcode lists and
// neighbourhood names, homes from the Area Planner's Census 2021 figures,
// nearby pages, one real review each (never the same as a neighbour's),
// four answers written for that page, and the wording rules (no banned
// words; New Forest and Dorset never say "every" or "all of").

const pages = Object.values(AREA_PAGES);
const slugs = Object.keys(AREA_PAGES) as AreaSlug[];
const range = (p: string, a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => `${p}${a + i}`);

// A page's copy as plain text, and the links in it.
const textOf = (copy: AreaPageData["copy"]) =>
  copy.map((para) => para.map((x) => (typeof x === "string" ? x : x.text)).join("")).join("\n");
const hrefsOf = (copy: AreaPageData["copy"]) => copy.flatMap((para) => para.flatMap((x) => (typeof x === "string" ? [] : [x.href])));
const squash = (s: string) => s.replace(/\s+/g, " ").trim();

test("every area page folder has a data entry, and nothing else does", () => {
  const folders = readdirSync("app/areas").filter((n) => n.startsWith("leaflet-distribution-")).map((n) => n.slice(21)).sort();
  assert.deepEqual([...slugs].sort(), folders);
  assert.equal(pages.length, 15);
  for (const [slug, page] of Object.entries(AREA_PAGES)) assert.equal(page.slug, slug);
});

test("the postcode lists are the confirmed ones, each with its neighbourhood names", () => {
  const expected: Record<AreaSlug, string[]> = {
    southampton: range("SO", 14, 19),
    bournemouth: range("BH", 1, 11),
    poole: range("BH", 12, 18),
    winchester: ["SO21", "SO22", "SO23", "SO24", "SO32"],
    "new-forest": ["SO40", "SO41", "SO42", "SO43", "SO45", "BH24", "BH25", "SP6"],
    ringwood: ["BH24"],
    christchurch: ["BH23"],
    dorset: [...range("BH", 1, 18), ...range("BH", 21, 24), ...range("DT", 1, 4), "DT9", "DT11"],
    eastleigh: ["SO50"],
    romsey: ["SO51"],
    hythe: ["SO45"],
    totton: ["SO40"],
    "hedge-end": ["SO30"],
    "chandlers-ford": ["SO53"],
    brockenhurst: ["SO42"],
  };
  for (const page of pages) {
    assert.deepEqual(page.postcodes.map((p) => p.code), expected[page.slug], page.slug);
    for (const p of page.postcodes) assert.ok(p.places.length > 0 && p.places.every((x) => x.trim()), `${page.slug} ${p.code}`);
  }
  assert.equal(AREA_PAGES.dorset.postcodes.length, 28);
  // A postcode shared between pages has the same names on each.
  const names = new Map<string, string>();
  for (const page of pages)
    for (const p of page.postcodes) {
      const seen = names.get(p.code);
      if (seen) assert.equal(p.places.join(", "), seen, p.code);
      else names.set(p.code, p.places.join(", "));
    }
  assert.equal(names.get("SO14"), "City centre, Bevois");
  assert.equal(names.get("BH25"), "New Milton, Barton on Sea, Ashley");
  assert.equal(names.get("DT11"), "Blandford Forum and surrounding villages");
  assert.equal(names.get("SP6"), "Fordingbridge");
  // SO31 is nowhere.
  assert.doesNotMatch(readFileSync("lib/area-pages.ts", "utf8"), /SO31/);
});

test("each page's homes figure is its districts' Census 2021 households, rounded to the nearest 500", async () => {
  for (const page of pages) {
    let total = 0;
    for (const { code } of page.postcodes) {
      const info = await findPostcode(code);
      assert.ok(info && info.kind === "district", code);
      total += info.households;
    }
    assert.equal(page.homes, Math.round(total / 500) * 500, page.slug);
  }
  assert.equal(AREA_PAGES.southampton.homes, 107_500);
  assert.equal(AREA_PAGES.brockenhurst.homes, 2_000);
  assert.equal(AREA_PAGES["new-forest"].homes, 80_000);
});

test("nearby pages are real pages, and Southampton and Eastleigh link to the ones asked for", () => {
  for (const page of pages) {
    assert.ok(page.nearby.length >= 2, page.slug);
    for (const n of page.nearby) {
      assert.ok(n in AREA_PAGES, `${page.slug} -> ${n}`);
      assert.notEqual(n, page.slug);
    }
    assert.equal(new Set(page.nearby).size, page.nearby.length, page.slug);
  }
  assert.deepEqual(AREA_PAGES.southampton.nearby, ["hedge-end", "totton", "hythe", "eastleigh", "romsey", "winchester", "new-forest"]);
  assert.deepEqual(AREA_PAGES.eastleigh.nearby, ["chandlers-ford", "hedge-end"]);
});

test("reviews are real, word for word, spread so no two neighbouring pages share one", () => {
  const source = readFileSync("components/Testimonials.tsx", "utf8");
  for (const [id, review] of Object.entries(REVIEWS)) {
    // Hendonis Salon's appears without its emoji; everything else is exact.
    assert.ok(source.includes(JSON.stringify(review.quote).slice(1, -1)), id);
    assert.ok(source.includes(`name: "${review.name}"`), id);
    assert.ok(source.includes(`label: "${review.label}"`), id);
  }
  assert.ok(!REVIEWS.hendonis.quote.includes("🙌"));
  assert.equal(REVIEWS.cozy.label, "Client review");
  assert.ok(!Object.values(REVIEWS).some((r) => r.name === "Coastline Print"));
  // All seven used, and never the same as a neighbour (either way round).
  assert.deepEqual(new Set(pages.map((p) => p.review)), new Set(Object.keys(REVIEWS)));
  for (const page of pages) {
    for (const other of pages) {
      const neighbours = page.nearby.includes(other.slug) || other.nearby.includes(page.slug);
      if (neighbours) assert.notEqual(page.review, other.review, `${page.slug} and ${other.slug}`);
    }
  }
});

test("four answers per page, all different, each about that page", () => {
  const all = pages.flatMap((p) => p.faqs);
  assert.equal(all.length, 60);
  assert.equal(new Set(all).size, 60, "no two answers alike");
  for (const page of pages) {
    const [where, target, together, proof] = page.faqs;
    // Which parts: names the page's postcodes, one by one or as a range.
    const named = new Set<string>();
    for (const m of where.matchAll(/\b([A-Z]{2})(\d{1,2}) to [A-Z]{2}(\d{1,2})\b/g)) for (const c of range(m[1], +m[2], +m[3])) named.add(c);
    for (const m of where.matchAll(/\b[A-Z]{2}\d{1,2}\b/g)) named.add(m[0]);
    for (const { code } of page.postcodes) assert.ok(named.has(code), `${page.slug}: ${code} in the first answer`);
    // One or two postcodes: talks about this page's own postcodes or places.
    assert.ok(page.postcodes.some((p) => target.includes(p.code)) || target.includes(page.name), page.slug);
    // Other towns: names at least two real neighbours, and no area page that isn't one.
    const mentioned = slugs.filter((s) => s !== page.slug && together.includes(AREA_PAGES[s].name));
    assert.ok(mentioned.filter((s) => page.nearby.includes(s)).length >= 2, `${page.slug}: ${mentioned}`);
    for (const s of mentioned) assert.ok(page.nearby.includes(s), `${page.slug} names ${s}`);
    // How they know: GPS tracked rounds and a route report, for this area.
    assert.match(proof, /GPS/);
    assert.match(proof, /route report|route maps/);
    assert.ok(proof.includes(page.name), page.slug);
  }
});

const BANNED = [/\bstreet/i, /live tracked/i, /see where every flyer goes/i, /£/, /\bprices? from\b/i];

function visibleText(page: AreaPageData): string {
  const review = REVIEWS[page.review];
  return [squash(textOf(page.copy)), ...page.faqs, page.question3 ?? "", page.eyebrow, ...page.postcodes.flatMap((p) => p.places), review.quote].join("\n");
}

test("no banned words, and no links off the site, in any page's own text", () => {
  for (const page of pages) {
    for (const word of BANNED) assert.doesNotMatch(visibleText(page), word, page.slug);
    for (const href of hrefsOf(page.copy)) assert.ok(href.startsWith("/"), `${page.slug}: ${href}`);
  }
  // The template's own words, and its only outside link is the Google reviews.
  const template = readFileSync("components/AreaPage.tsx", "utf8");
  const words = template.replace(/className=(\{[^}]*\}|"[^"]*")/g, "").replace(/\/\/.*|\{\/\*[\s\S]*?\*\/\}/g, "");
  for (const word of BANNED) assert.doesNotMatch(words, word);
  assert.deepEqual([...new Set(template.match(/https?:\/\/[^"]+/g))], ["https://share.google/RVxyPi4TzXAzkt1Am"]);
  assert.equal((template.match(/<h1\b/g) ?? []).length, 1, "one H1");
  assert.doesNotMatch(template, /FAQPage/, "no FAQ schema");
});

test("New Forest and Dorset never say \"every\" or \"all of\"", () => {
  for (const slug of ["new-forest", "dorset"] as const) {
    const page = AREA_PAGES[slug];
    assert.equal(page.wide, true);
    assert.doesNotMatch(visibleText(page), /\bevery|\ball of\b/i, slug);
  }
  assert.deepEqual(pages.filter((p) => p.wide).map((p) => p.slug).sort(), ["dorset", "new-forest"]);
  // The template switches its own wording for them.
  const template = readFileSync("components/AreaPage.tsx", "utf8");
  assert.match(template, /const each = area\.wide \? "each" : "every";/);
  assert.match(template, /area\.wide \? `\$\{codes\.length\} postcodes covered` : `Every \$\{area\.name\} postcode`/);
  assert.match(template, /area\.wide \? `\$\{area\.name\} postcodes we deliver to` : `Every \$\{area\.name\} postcode we deliver to`/);
  assert.match(template, /\{area\.wide \? "" : `We cover all of \$\{area\.inName\}\. `\}/);
});

test("the copy is the old copy, with only the corrections asked for", () => {
  assert.match(squash(textOf(AREA_PAGES.poole.copy)), /Our distributors cover BH12 through BH18 and surrounding postcodes/);
  const dorset = squash(textOf(AREA_PAGES.dorset.copy));
  assert.match(dorset, /including BH1 through BH18, BH21 through BH24, DT1 and surrounding Dorchester postcodes/);
  assert.match(dorset, /ranging from the busy urban centres/);
  assert.match(dorset, /are priced and planned as a single campaign/);
  assert.match(squash(textOf(AREA_PAGES.bournemouth.copy)), /We cover BH1 through BH11 and surrounding postcodes/);
  assert.match(squash(textOf(AREA_PAGES.southampton.copy)), /home to around 250,000 residents/);
  const forest = squash(textOf(AREA_PAGES["new-forest"].copy));
  assert.match(forest, /Key towns include Lyndhurst, Brockenhurst, and Hythe, alongside a network of smaller villages/);
  assert.doesNotMatch(forest, /Fordingbridge/);
});

test("postcode ranges read naturally", () => {
  assert.equal(formatPostcodeRanges(range("SO", 14, 19)), "SO14 to SO19");
  assert.equal(formatPostcodeRanges(["SO21", "SO22", "SO23", "SO24", "SO32"]), "SO21 to SO24 and SO32");
  assert.equal(formatPostcodeRanges(["SO40", "SO41", "SO42", "SO43", "SO45", "BH24", "BH25"]), "SO40 to SO43, SO45, BH24 and BH25");
  assert.equal(formatPostcodeRanges(AREA_PAGES.dorset.postcodes.map((p) => p.code)), "BH1 to BH18, BH21 to BH24, DT1 to DT4, DT9 and DT11");
  assert.equal(formatPostcodeRanges(["SO51"]), "SO51");
  assert.equal(formatPostcodeRanges(AREA_PAGES["new-forest"].postcodes.map((p) => p.code)), "SO40 to SO43, SO45, BH24, BH25 and SP6");
});

test("each page file renders the template and keeps its own metadata and schema", () => {
  for (const slug of slugs) {
    const page = readFileSync(join("app/areas", `leaflet-distribution-${slug}`, "page.tsx"), "utf8");
    assert.match(page, /export const metadata: Metadata = \{/);
    assert.match(page, /const breadcrumbSchema = \{/);
    assert.match(page, /dangerouslySetInnerHTML=\{\{ __html: JSON\.stringify\(breadcrumbSchema\) \}\}/);
    assert.ok(page.includes(`<AreaPage area={AREA_PAGES["${slug}"]} />`), slug);
    assert.doesNotMatch(page, /Other Areas Nearby|PopulationCounter|<h1/, slug);
  }
});
