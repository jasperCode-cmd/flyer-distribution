import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { findPostcode } from "@/lib/area-planner/data";
import { AREA_PAGES, coverageMapAlt, coverageMapSrc, type AreaPageData, type AreaSlug } from "@/lib/area-pages";
import { formatPostcodeRanges } from "@/lib/postcode-ranges";

// The 15 area pages' shared template data: the confirmed postcode lists and
// neighbourhood names, homes from the Area Planner's Census 2021 figures,
// nearby pages, the shared rating snapshot in place of a review of its own,
// four answers written for that page, and the wording rules (no banned
// words; New Forest and Dorset never say "every" or "all of"), its coverage
// map as the hero, and a photo only where it shows the place itself.

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
    dorset: [...range("BH", 1, 18), "BH21", "BH22", "BH23", "BH31"],
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
  assert.equal(AREA_PAGES.dorset.postcodes.length, 22);
  // Our real Dorset coverage: no DT postcode anywhere, and BH24 only on Ringwood and New Forest.
  for (const page of pages) assert.ok(!page.postcodes.some((p) => p.code.startsWith("DT")), page.slug);
  assert.deepEqual(pages.filter((p) => p.postcodes.some((c) => c.code === "BH24")).map((p) => p.slug).sort(), ["new-forest", "ringwood"]);
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
  assert.equal(names.get("BH31"), "Verwood");
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

test("each page shows the shared rating snapshot where its review was, and no full review", () => {
  const template = readFileSync("components/AreaPage.tsx", "utf8");
  const howItWorks = template.indexOf("{/* 6. How a campaign works */}");
  const snapshot = template.indexOf("<ReviewBand />");
  const questions = template.indexOf("{/* 8. Questions");
  assert.ok(howItWorks > 0 && howItWorks < snapshot && snapshot < questions, `${howItWorks} ${snapshot} ${questions}`);
  assert.equal(template.split("<ReviewBand />").length - 1, 1);
  assert.match(template, /import ReviewBand from "@\/components\/ReviewBand";/);
  assert.doesNotMatch(template, /<blockquote|REVIEWS|What our clients say|#eef4fc/);
  // No page keeps a review of its own.
  for (const page of pages) assert.ok(!("review" in page), page.slug);
  assert.doesNotMatch(readFileSync("lib/area-pages.ts", "utf8"), /REVIEWS|ReviewId|review:/);
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
  const groups = (page.groups ?? []).flatMap((g) => [g.name, ...g.places]);
  return [squash(textOf(page.copy)), ...page.faqs, page.question3 ?? "", page.eyebrow, ...page.postcodes.flatMap((p) => p.places), ...groups].join("\n");
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
  assert.match(dorset, /ranging from the busy urban centres of Bournemouth and Poole through to the smaller towns around them\./);
  assert.match(dorset, /a campaign across Bournemouth, Poole and the surrounding towns is the most effective way to do it/);
  assert.match(dorset, /We cover the main postcode areas around Bournemouth, Poole and Christchurch, including BH1 through BH18, BH21 through BH23 and BH31/);
  assert.match(dorset, /Multi-town campaigns are priced and planned as a single campaign/);
  assert.match(AREA_PAGES.dorset.faqs[1], /There's no need to cover the whole area at once/);
  assert.match(squash(textOf(AREA_PAGES.poole.copy)), /We also run Dorset campaigns for businesses wanting broader reach\./);
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
  assert.equal(formatPostcodeRanges(AREA_PAGES.dorset.postcodes.map((p) => p.code)), "BH1 to BH18, BH21 to BH23 and BH31");
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

// A lossy WebP's size, from its VP8 frame header.
function webpSize(file: string): { width: number; height: number } {
  const b = readFileSync(file);
  assert.equal(b.toString("ascii", 0, 4), "RIFF", file);
  assert.equal(b.toString("ascii", 8, 16), "WEBPVP8 ", file);
  return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
}

test("each page's hero is its own coverage map, 1320 by 990, described in full and never a link", () => {
  // One map per page, and nothing else in the folder.
  assert.deepEqual(readdirSync("public/area-maps").sort(), slugs.map((slug) => `area-map-${slug}.webp`).sort());
  for (const slug of slugs) {
    assert.equal(coverageMapSrc(slug), `/area-maps/area-map-${slug}.webp`);
    assert.deepEqual(webpSize(join("public", coverageMapSrc(slug))), { width: 1320, height: 990 }, slug);
  }
  assert.equal(
    coverageMapAlt(AREA_PAGES.southampton),
    "Map of the Southampton postcodes we deliver to: SO14 to SO19, with neighbouring postcodes shown around them"
  );
  assert.equal(
    coverageMapAlt(AREA_PAGES.winchester),
    "Map of the Winchester postcodes we deliver to: SO21 to SO24 and SO32, with neighbouring postcodes shown around them"
  );
  assert.equal(
    coverageMapAlt(AREA_PAGES["new-forest"]),
    "Map of the New Forest postcodes we deliver to: SO40 to SO43, SO45, BH24, BH25 and SP6, with neighbouring postcodes shown around them"
  );
  assert.equal(
    coverageMapAlt(AREA_PAGES.dorset),
    "Map of the Dorset postcodes we deliver to: BH1 to BH18, BH21 to BH23 and BH31, with neighbouring postcodes shown around them"
  );
  assert.equal(
    coverageMapAlt(AREA_PAGES["chandlers-ford"]),
    "Map of the Chandler's Ford postcodes we deliver to: SO53, with neighbouring postcodes shown around them"
  );
  // The template shows it at its own size, loaded first, with its caption, and not inside a link.
  const template = readFileSync("components/AreaPage.tsx", "utf8");
  const hero = template.slice(template.indexOf("{/* 1. Hero */}"), template.indexOf("{/* 2. Quick facts */}"));
  const figure = hero.slice(hero.indexOf("<figure>"), hero.indexOf("</figure>"));
  for (const prop of ["src={coverageMapSrc(area.slug)}", "alt={coverageMapAlt(area)}", "width={1320}", "height={990}", "priority", 'fetchPriority="high"']) {
    assert.ok(figure.includes(prop), prop);
  }
  assert.match(figure, /<figcaption[^>]*>The \{area\.name\} postcodes we deliver to<\/figcaption>/);
  assert.doesNotMatch(figure, /<a\b|<Link\b/);
  assert.equal((hero.match(/<Image\b/g) ?? []).length, 1);
});

test("only photos of the place itself sit beside the About copy, and nothing uses the aerial image", () => {
  const withPhoto = pages.filter((p) => p.photo).map((p) => p.slug).sort();
  assert.deepEqual(withPhoto, ["bournemouth", "eastleigh", "winchester"]);
  assert.equal(AREA_PAGES.eastleigh.photo!.src, "/Street%20Image%20when%20distributing%20flyers.webp");
  assert.equal(AREA_PAGES.winchester.photo!.alt, "Winchester Cathedral");
  assert.equal(AREA_PAGES.bournemouth.photo!.alt, "Bournemouth pier and ferris wheel");
  const template = readFileSync("components/AreaPage.tsx", "utf8");
  assert.match(template, /\{area\.photo && \(/);
  const aerial = /Overhead-shot-residential-areas/;
  assert.doesNotMatch(readFileSync("lib/area-pages.ts", "utf8"), aerial);
  assert.doesNotMatch(template, aerial);
  for (const slug of slugs) {
    assert.doesNotMatch(readFileSync(join("app/areas", `leaflet-distribution-${slug}`, "page.tsx"), "utf8"), aerial, slug);
  }
  // Nor does the homepage any more, so the file is gone.
  for (const file of ["app/page.tsx", "components/HomeAreas.tsx"]) assert.doesNotMatch(readFileSync(file, "utf8"), aerial, file);
  assert.ok(!existsSync("public/Overhead-shot-residential-areas.webp"));
});

test("nowhere claims Dorset coverage beyond our 22 districts", () => {
  const dropped = /Dorchester|Weymouth|Sherborne|Blandford|Swanage|Wareham|county-wide|Dorset-wide|further west|all major Dorset/i;
  for (const page of pages) assert.doesNotMatch(visibleText(page), dropped, page.slug);
  const file = readFileSync("app/areas/leaflet-distribution-dorset/page.tsx", "utf8");
  const description = "Leaflet and flyer distribution across Dorset. Covering Bournemouth, Poole, Christchurch, Wimborne, Ferndown and surrounding towns.";
  assert.equal(file.split(`"${description}"`).length - 1, 3, "meta, Open Graph and Twitter");
  assert.doesNotMatch(file, dropped);
  assert.equal(AREA_PAGES.dorset.faqs[0], "Our Dorset coverage is built around Bournemouth and Poole (BH1 to BH18), Wimborne Minster and Ferndown (BH21 and BH22), Christchurch (BH23) and Verwood (BH31).");
  assert.match(AREA_PAGES.dorset.faqs[1], /such as BH31 for Verwood or BH21 for Wimborne Minster/);
  assert.match(AREA_PAGES.dorset.faqs[2], /or pair Wimborne Minster with Ferndown/);
});

test("New Forest and Dorset group their postcodes by town; every other page keeps a card per postcode", () => {
  assert.deepEqual(pages.filter((p) => p.groups).map((p) => p.slug).sort(), ["dorset", "new-forest"]);
  const expected: Record<string, [string, string[], string[], AreaSlug[]][]> = {
    dorset: [
      ["Bournemouth", range("BH", 1, 11), ["Boscombe", "Southbourne", "Winton", "Kinson", "Westbourne"], ["bournemouth"]],
      ["Poole", range("BH", 12, 18), ["Parkstone", "Canford Cliffs", "Hamworthy", "Broadstone", "Upton"], ["poole"]],
      ["Christchurch", ["BH23"], ["Highcliffe", "Mudeford", "Bransgore"], ["christchurch"]],
      ["Wimborne and Ferndown", ["BH21", "BH22"], ["Wimborne Minster", "Colehill", "Corfe Mullen", "Ferndown", "West Moors", "West Parley"], []],
      ["Verwood", ["BH31"], ["Verwood"], []],
    ],
    "new-forest": [
      ["Totton and Waterside", ["SO40", "SO45"], ["Totton", "Marchwood", "Hythe", "Dibden Purlieu", "Fawley"], ["totton", "hythe"]],
      ["Lyndhurst and Brockenhurst", ["SO42", "SO43"], ["Lyndhurst", "Brockenhurst", "Beaulieu"], ["brockenhurst"]],
      ["Lymington and New Milton", ["SO41", "BH25"], ["Lymington", "Milford on Sea", "New Milton", "Barton on Sea"], []],
      ["Ringwood and Fordingbridge", ["BH24", "SP6"], ["Ringwood", "Burley", "Fordingbridge"], ["ringwood"]],
    ],
  };
  for (const slug of ["dorset", "new-forest"] as const) {
    const page = AREA_PAGES[slug];
    assert.deepEqual(page.groups!.map((g) => [g.name, g.codes, g.places, g.pages]), expected[slug], slug);
    // Every postcode in exactly one group, and each group's places from its own postcodes.
    assert.deepEqual(page.groups!.flatMap((g) => g.codes).sort(), page.postcodes.map((p) => p.code).sort(), slug);
    for (const g of page.groups!) {
      const own = new Set(page.postcodes.filter((p) => g.codes.includes(p.code)).flatMap((p) => p.places));
      for (const place of g.places) assert.ok(own.has(place), `${slug} ${g.name}: ${place}`);
      // Each linked page is named in the group, so it has something to link.
      for (const linked of g.pages) assert.ok([g.name, ...g.places].some((t) => t.includes(AREA_PAGES[linked].name)), `${g.name} names ${linked}`);
    }
  }
  // The template draws groups where a page has them, and the old card grid otherwise.
  const template = readFileSync("components/AreaPage.tsx", "utf8");
  assert.match(template, /\{area\.groups \? \(/);
  assert.match(template, /area\.postcodes\.map\(\(p\) => \(\n\s+<li key=\{p\.code\} className="rounded-xl border border-gray-200 bg-slate-50 p-5">/);
  assert.match(template, /area\.wide \? `\$\{area\.name\} postcodes we deliver to`/);
});
