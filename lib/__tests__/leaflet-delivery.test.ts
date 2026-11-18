// The Leaflet Delivery page (/leaflet-delivery): its metadata and schema, its
// sections and copy in order, the figures and review it copies from the
// homepage, every link on it (each to a page that exists), the copy rules, the
// design's measures, and its place in the sitemap, llms.txt and the menu.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import sitemap from "@/app/sitemap";
import { AREA_PAGES, type AreaSlug } from "@/lib/area-pages";
import { AREA_REGIONS } from "@/lib/area-search";

const SITE = "https://www.flyerdistributionhampshire.co.uk";
const OWN = `${SITE}/leaflet-delivery`;
const FULL_TITLE = "Leaflet Delivery Hampshire & Dorset | Flyer Distribution Hampshire";
const DESCRIPTION =
  "Door to door leaflet delivery across Hampshire and Dorset by our own local team. GPS tracked rounds, a route report at the end, and printing if you need it.";
const QUOTE = "/quote?service=leaflet";

type Rendered = { html: string; metadata: Record<string, any> };
let rendered: Rendered | undefined;
function render(): Rendered {
  if (!rendered) {
    const run = spawnSync(process.execPath, ["--import", "tsx", "lib/__tests__/render-leaflet-delivery.ts"], { encoding: "utf8" });
    assert.equal(run.status, 0, run.stderr);
    rendered = JSON.parse(run.stdout) as Rendered;
  }
  return rendered;
}

const read = (p: string) => readFileSync(p, "utf8");
const SOURCE = read("app/leaflet-delivery/page.tsx");
const decode = (s: string) => s.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
const textOf = (html: string) => decode(html.replace(/<\/?(strong|em)>/g, "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const html = () => render().html;
const visible = () => textOf(html().replace(/<script[\s\S]*?<\/script>/g, ""));
const headings = (level: number) => [...html().matchAll(new RegExp(`<h${level}[^>]*>([\\s\\S]*?)</h${level}>`, "g"))].map((m) => textOf(m[1]));
const schemas = () => [...html().matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
// A section's markup, from its H2 to the next H2.
const sectionOf = (h2: string) => {
  const from = html().indexOf(`>${h2}</h2>`);
  assert.ok(from > 0, h2);
  const next = html().indexOf("<h2", from);
  return html().slice(from + 1, next < 0 ? undefined : next);
};
const linksIn = (part: string) => [...part.matchAll(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => [decode(m[1]), textOf(m[2])]);

test("the metadata: the given title (with the site's suffix), the given description, a self-referencing canonical", () => {
  const { metadata } = render();
  // The layout's template ("%s | Flyer Distribution Hampshire") completes it.
  assert.equal(metadata.title, "Leaflet Delivery Hampshire & Dorset");
  assert.match(read("app/layout.tsx"), /template: "%s \| Flyer Distribution Hampshire"/);
  assert.equal(metadata.description, DESCRIPTION);
  assert.ok(DESCRIPTION.length <= 160, `${DESCRIPTION.length} characters`);
  assert.equal(metadata.alternates.canonical, OWN);
  // Open Graph and Twitter as on the other pages: the full title, the description, the site's image.
  const printing = read("app/leaflet-printing/page.tsx");
  const ogImage = /const OG_IMAGE = "([^"]+)";/.exec(printing)![1];
  assert.deepEqual(metadata.openGraph, {
    title: FULL_TITLE,
    description: DESCRIPTION,
    url: OWN,
    siteName: "Flyer Distribution Hampshire",
    images: [{ url: ogImage, width: 1200, height: 630, alt: "Flyer Distribution Hampshire" }],
    locale: "en_GB",
    type: "website",
  });
  assert.deepEqual(metadata.twitter, { card: "summary_large_image", title: FULL_TITLE, description: DESCRIPTION, images: [ogImage] });
  // No other page has this description, and nothing is added to the head by hand.
  const pages = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const p = join(dir, name);
      return statSync(p).isDirectory() ? pages(p) : name === "page.tsx" ? [p] : [];
    });
  for (const p of pages("app").filter((p) => p !== join("app", "leaflet-delivery", "page.tsx"))) assert.ok(!read(p).includes(DESCRIPTION), p);
  assert.doesNotMatch(SOURCE, /<head|<title|<meta|<link rel/);
});

test("the H1 and every H2, in order, as in the design", () => {
  assert.deepEqual(headings(1), ["Leaflet Delivery in Hampshire and Dorset"]);
  assert.deepEqual(headings(2), [
    "How we deliver your leaflets",
    "Need them printed too?",
    "How it works",
    "Proof your leaflets went out",
    "Where we deliver",
    "Leaflet delivery questions",
    "Ready to get your leaflets out?",
  ]);
});

test("the schema: BreadcrumbList Home / Leaflet Delivery, and a Service by the site-wide LocalBusiness", () => {
  const [breadcrumb, service, ...rest] = schemas();
  assert.equal(rest.length, 0);
  assert.deepEqual(breadcrumb, {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE },
      { "@type": "ListItem", position: 2, name: "Leaflet Delivery", item: OWN },
    ],
  });
  assert.equal(service["@type"], "Service");
  assert.equal(service.name, "Leaflet Delivery");
  assert.equal(service.url, OWN);
  assert.deepEqual(service.provider, { "@id": `${SITE}/#business` });
  assert.match(read("components/SiteSchema.tsx"), new RegExp(`"@type": "LocalBusiness",\\n\\s+"@id": "${SITE}/#business"`));
  assert.deepEqual(service.areaServed, [
    { "@type": "AdministrativeArea", name: "Hampshire" },
    { "@type": "AdministrativeArea", name: "Dorset" },
  ]);
  // Output like the other pages: one script each, in the page.
  assert.equal((SOURCE.match(/<script type="application\/ld\+json" dangerouslySetInnerHTML=\{\{ __html: JSON\.stringify\(\w+\) \}\} \/>/g) ?? []).length, 2);
  // The visible breadcrumb matches.
  assert.match(html(), /<nav aria-label="Breadcrumb"[^>]*>[\s\S]*?href="\/">Home<\/a>[\s\S]*?aria-current="page">Leaflet Delivery<\/span>/);
});

test("the hero: the label, H1 and intro, the two buttons, the 5.0 rating as on the homepage, and the letterbox photo", () => {
  const hero = html().slice(0, html().indexOf("</section>"));
  assert.match(hero, /<p class="[^"]*text-\[#facc15\]">Door to door across Hampshire and Dorset<\/p>/);
  assert.ok(
    textOf(hero).includes(
      "Our own local team delivers your leaflets through letterboxes in the postcodes you choose. Every round is GPS tracked, and you get a route report when your campaign is complete."
    )
  );
  const links = linksIn(hero);
  assert.deepEqual(links.slice(1, 3), [
    [QUOTE, "Get a Free Quote"],
    ["#how-it-works", "See how it works"],
  ]);
  // The rating: the homepage's line (stars, words, the same Google profile, opening in a new tab).
  const home = read("app/page.tsx");
  const profile = /const GOOGLE_PROFILE = "([^"]+)";/.exec(home)![1];
  assert.deepEqual(links[3], [profile, "Rated 5.0 on Google by local businesses (opens in a new tab)"]);
  assert.match(home, /<span>Rated 5\.0 on Google by local businesses<\/span>/);
  assert.match(hero, new RegExp(`<a href="${profile.replace(/\./g, "\\.")}" target="_blank" rel="noopener" class="[^"]*min-h-11[^"]*text-sm text-\\[#dbeafe\\][^"]*"><svg role="img" aria-label="5 out of 5 stars" viewBox="0 0 120 24" class="h-3\\.5 w-auto shrink-0 fill-\\[#facc15\\]">`));
  // The two photos, from public/images, with the given alts: the hero loaded straight away, the round later.
  const imgs = [...html().matchAll(/<img[^>]*>/g)].map((m) => ({
    src: /url=%2Fimages%2F([a-z-]+\.webp)/.exec(m[0])?.[1],
    alt: decode(/alt="([^"]*)"/.exec(m[0])![1]),
    lazy: / loading="lazy"/.test(m[0]),
    size: /width="(\d+)" height="(\d+)"/.exec(m[0])!.slice(1).join("x"),
  }));
  assert.deepEqual(imgs, [
    { src: "leaflet-delivery-hero.webp", alt: "Leaflets posted through a letterbox", lazy: false, size: "1600x1200" },
    { src: "bitterne-park-route.webp", alt: "GPS tracked leaflet delivery route in Bitterne Park, Southampton", lazy: true, size: "1200x1449" },
  ]);
  for (const img of imgs) assert.ok(existsSync(join("public", "images", img.src!)), img.src);
  assert.match(SOURCE, /src="\/images\/leaflet-delivery-hero\.webp"[\s\S]{0,200}priority/);
  // The other three rounds are kept for the area pages.
  for (const unused of ["bursledon-route", "brockenhurst-route", "lymington-route"]) {
    assert.ok(existsSync(join("public", "images", `${unused}.webp`)), unused);
    assert.ok(!SOURCE.includes(unused), unused);
  }
});

test("the Royal Mail figures: the homepage's numbers and words, and its source line", () => {
  const strip = html().slice(html().indexOf("</section>"), html().indexOf(">How we deliver your leaflets</h2>"));
  const figures = [...strip.matchAll(/<span class="font-heading[^"]*">([^<]+)<\/span><span class="[^"]*">([^<]+)<\/span>/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(figures, [
    ["92%", "of people who receive a door drop read it"],
    ["74%", "of door drops are opened, read, filed or set aside for later"],
    ["4 in 5", "door drop items are engaged with"],
  ]);
  const stats = read("components/StatsBar.tsx");
  for (const [figure, label] of figures) {
    assert.ok(stats.includes(`value="${figure}"`), figure);
    assert.ok(stats.includes(label), label);
  }
  assert.match(strip, />Source: Royal Mail<\/p>/);
  assert.match(stats, />Source: Royal Mail<\/p>/);
});

test("how we deliver: door to door first, then the four other methods, each with its link", () => {
  const how = sectionOf("How we deliver your leaflets");
  assert.ok(
    textOf(how).startsWith(
      "How we deliver your leaflets Most campaigns go door to door. For events, car parks, local businesses and public notices, we have a delivery method built for the job. Most campaigns start here Door to door leaflet delivery We deliver your leaflets through letterboxes across the areas you choose, planned round by round to cover the homes in your chosen areas. Targeted postcodes. Choose your postcodes, or we'll suggest the ones most likely to respond. GPS tracked rounds. Every round is recorded as it's walked. Route report. You see the areas we covered when your campaign is complete."
    ),
    textOf(how)
  );
  const cards = [...how.matchAll(/<h3 class="font-sans font-bold text-\[19px\][^"]*">([^<]*)<\/h3><p[^>]*>([^<]*)<\/p>/g)].map((m) => [decode(m[1]), decode(m[2])]);
  assert.deepEqual(cards, [
    ["Hand-to-Hand Distribution", "Face to face at shopping centres, town centres and events."],
    ["B2B Leaflet Distribution", "Straight to offices, business parks and commercial areas."],
    ["Public Notice Leafleting", "Road closures, works and statutory consultations."],
    ["Vehicle Leaflet Distribution", "On parked cars in car parks, retail areas and busy spots."],
  ]);
  // The first three cards are links to their pages; vehicle distribution asks on the quote form.
  assert.deepEqual(
    linksIn(how).map(([href, text]) => [href, text.split(" ").slice(-2).join(" ")]),
    [
      ["/services/hand-to-hand-distribution", "Learn more"],
      ["/services/b2b-distribution", "Learn more"],
      ["/services/public-notice-leafleting", "Learn more"],
      [QUOTE, "about it"],
    ]
  );
  assert.equal(linksIn(how)[3][1], "Ask about it");
});

test("need them printed too: the two packages, linkable by id, and printing on its own", () => {
  const printed = sectionOf("Need them printed too?");
  assert.ok(textOf(printed).includes("Bring your own leaflets, or let us print them and deliver them in one go."));
  assert.deepEqual([...printed.matchAll(/<h3[^>]*>([^<]*)<\/h3><p[^>]*>([^<]*)<\/p>/g)].map((m) => [decode(m[1]), decode(m[2])]), [
    ["Design, Print and Deliver", "We design your leaflet, print it and deliver it across your chosen areas. One campaign, one team, start to finish."],
    ["Print and Deliver", "Artwork ready? We print it in A6, A5, A4 or DL and deliver it through letterboxes."],
    ["Just the printing", "Flyers, folded leaflets and business cards, delivered to your door. Build your spec online."],
  ]);
  assert.match(printed, /<li id="design-print-deliver" class="relative [^"]*bg-\[#1e3a8a\][^"]*"><span class="absolute right-5 top-5 [^"]*">Most popular<\/span><h3 class="pr-\[84px\]/);
  assert.match(printed, /<li id="print-and-deliver" class="[^"]*border border-\[#e2e8f0\] bg-white[^"]*">/);
  assert.deepEqual(linksIn(printed), [
    [QUOTE, "Get a quote"],
    [QUOTE, "Get a quote"],
    ["/leaflet-printing", "See leaflet printing"],
  ]);
});

test("how it works: four numbered steps, the section the hero's button goes to", () => {
  assert.match(html(), /<section id="how-it-works" class="[^"]*"><div class="[^"]*"><h2 [^>]*>How it works<\/h2>/);
  const steps = [...sectionOf("How it works").matchAll(/<li[^>]*><span[^>]*>(\d\d)<\/span><h3[^>]*>([^<]*)<\/h3><p[^>]*>([^<]*)<\/p><\/li>/g)].map((m) => [m[1], m[2], decode(m[3])]);
  assert.deepEqual(steps, [
    ["01", "Plan it with us", "A free call to agree your areas, quantity and timing. Not sure where to start? We'll plan the campaign around your goals."],
    ["02", "Get them printed", "Send us your leaflets, or we'll design and print them for you."],
    ["03", "We deliver", "Our own team walks the rounds, every one GPS tracked."],
    ["04", "You get the proof", "A route report showing the areas covered once your campaign is complete."],
  ]);
  // Each one numbered in an ordered list, under a 3px yellow rule.
  assert.equal((sectionOf("How it works").match(/<li class="flex flex-col gap-2 border-t-\[3px\] border-\[#facc15\] pt-\[18px\]">/g) ?? []).length, 4);
});

test("proof: the Bitterne Park round with its caption, and two whole sentences of Auriel Cochrane's Google review, word for word", () => {
  const start = html().lastIndexOf("<section", html().indexOf(">Proof your leaflets went out</h2>"));
  const proof = html().slice(start, html().indexOf("</section>", start));
  assert.match(proof, /<figcaption class="[^"]*">A GPS tracked round in Bitterne Park, Southampton<\/figcaption>/);
  assert.ok(textOf(proof).includes("Every round is GPS tracked, so at the end of your campaign you can see exactly which areas we covered."));
  // Her review on the homepage, split into sentences: the quote is two of them, one after the other, exactly.
  const testimonials = read("components/Testimonials.tsx");
  const review = /name: "Auriel Cochrane",[\s\S]*?quote:\s+"([^"]+)"/.exec(testimonials)![1];
  const sentences = review.match(/[^.!?]+[.!?]/g)!.map((s) => s.trim());
  const quote = /quote:\s+"([^"]+)",\s+name: "Auriel Cochrane"/.exec(SOURCE)![1];
  const at = sentences.findIndex((s) => quote.startsWith(s));
  assert.ok(at >= 0, quote);
  assert.equal(quote, `${sentences[at]} ${sentences[at + 1]}`);
  assert.equal(quote, "Really pleased with the service! Everything was handled efficiently, and the flyers were distributed exactly within the area I wanted to target.");
  const figure = proof.slice(proof.indexOf('<figure class="rounded-[16px]'), proof.lastIndexOf("</figure>"));
  assert.equal(textOf(figure), `\u201c${quote}\u201d Auriel Cochrane, Google Review`);
  assert.match(figure, /<svg role="img" aria-label="5 out of 5 stars"[^>]*class="h-\[18px\] w-auto fill-\[#b45309\]">/);
  assert.deepEqual(linksIn(proof), [["/case-studies", "See our case studies"]]);
});

test("where we deliver: all 16 area pages in the homepage's four groups, each linking to its page", () => {
  const where = sectionOf("Where we deliver");
  assert.ok(textOf(where).includes("From Winchester in the north to Poole in the west. Pick your area to see its postcodes and homes."));
  const groups = [...where.matchAll(/<h3[^>]*>([^<]*)<\/h3><ul[^>]*>([\s\S]*?)<\/ul>/g)].map((m) => ({ label: decode(m[1]), links: linksIn(m[2]) }));
  assert.deepEqual(
    groups.map((g) => [g.label, g.links.map(([, name]) => name)]),
    [
      ["Southampton & Eastleigh", ["Southampton", "Eastleigh", "Chandler's Ford", "Hedge End"]],
      ["Winchester & Test Valley", ["Winchester", "Romsey"]],
      ["New Forest & Waterside", ["New Forest", "Totton", "Hythe", "Lymington", "Brockenhurst", "Ringwood"]],
      ["Bournemouth, Poole & Dorset", ["Bournemouth", "Poole", "Christchurch", "Dorset"]],
    ]
  );
  // The same groups and areas as the homepage and /areas, and every area page once.
  assert.deepEqual(groups.map((g) => g.label), AREA_REGIONS.map((r) => r.label));
  const slugs: AreaSlug[] = [];
  for (const [i, g] of groups.entries()) {
    const groupSlugs = g.links.map(([href]) => href.replace("/areas/leaflet-distribution-", "") as AreaSlug);
    assert.deepEqual([...groupSlugs].sort(), [...AREA_REGIONS[i].slugs].sort(), g.label);
    for (const [j, slug] of groupSlugs.entries()) {
      assert.equal(g.links[j][0], `/areas/leaflet-distribution-${slug}`);
      assert.equal(g.links[j][1], AREA_PAGES[slug].name, slug);
      assert.ok(existsSync(join("app", "areas", `leaflet-distribution-${slug}`, "page.tsx")), slug);
    }
    slugs.push(...groupSlugs);
  }
  assert.equal(slugs.length, 16);
  assert.deepEqual([...slugs].sort(), (Object.keys(AREA_PAGES) as AreaSlug[]).sort());
  assert.deepEqual(linksIn(where.slice(0, where.indexOf("<ul"))), [["/areas", "See all areas"]]);
});

test("leaflet delivery questions: five, the first open, with the FAQ page and leaflet printing links", () => {
  const faq = sectionOf("Leaflet delivery questions");
  assert.deepEqual(linksIn(faq.slice(0, faq.indexOf("<details"))), [["/faq", "FAQ page"]]);
  const questions = [...faq.matchAll(/<details([^>]*)><summary[^>]*><h3[^>]*>([^<]*)<\/h3><\/summary><p[^>]*>([\s\S]*?)<\/p><\/details>/g)].map((m) => ({
    open: / open=""/.test(m[1]),
    q: decode(m[2]),
    a: textOf(m[3]),
    links: linksIn(m[3]),
  }));
  assert.deepEqual(questions.map((x) => x.open), [true, false, false, false, false]);
  assert.deepEqual(questions.map((x) => [x.q, x.a]), [
    ["How do I know my leaflets were delivered?", "Every round is GPS tracked, and when your campaign is complete we send you a route report showing the areas we covered."],
    [
      "Can I choose exactly where my leaflets go?",
      "Yes. Tell us the postcodes or areas you want and we'll plan the rounds around them. Not sure? We'll suggest the areas most likely to respond.",
    ],
    ["Who delivers my leaflets?", "Our own local team across Hampshire and Dorset."],
    ["Can you print them as well?", "Yes. Choose Print and Deliver, or Design, Print and Deliver if you need the artwork too. See leaflet printing ."],
    ["Do you deliver outside Hampshire and Dorset?", "We deliver from Winchester to Poole and everywhere in between. If you're just outside, ask us and we'll let you know."],
  ]);
  assert.deepEqual(questions[3].links, [["/leaflet-printing", "leaflet printing"]]);
  // No FAQ schema.
  assert.ok(schemas().every((s) => s["@type"] !== "FAQPage"));
});

test("the closing band, and every quote link choosing Leaflet Distribution", () => {
  const closing = sectionOf("Ready to get your leaflets out?");
  assert.ok(textOf(closing).includes("Tell us your areas and quantity, and we'll come back to you with a quote."));
  assert.deepEqual(linksIn(closing), [[QUOTE, "Get a Free Quote"]]);
  const quoteLinks = linksIn(html()).filter(([href]) => href.startsWith("/quote"));
  assert.equal(quoteLinks.length, 5);
  for (const [href] of quoteLinks) assert.equal(href, QUOTE);
  assert.match(read("lib/quote-services.ts"), /param: "leaflet",/);
});

test("every link on it resolves: each to a page in the app, or to a section of this page", () => {
  const links = linksIn(html());
  assert.equal(links.length, 32);
  for (const [href] of links) {
    if (href.startsWith("#")) {
      assert.match(html(), new RegExp(`id="${href.slice(1)}"`), href);
      continue;
    }
    if (href.startsWith("https://")) {
      // Only the Google profile, the one the homepage links to.
      assert.equal(href, /const GOOGLE_PROFILE = "([^"]+)";/.exec(read("app/page.tsx"))![1]);
      continue;
    }
    const path = href.split(/[?#]/)[0];
    assert.match(path, /^\//, href);
    assert.ok(existsSync(join("app", ...path.split("/").filter(Boolean), "page.tsx")), href);
  }
});

test("the copy rules: no prices, turnaround times, supplier, banned words or dashes", () => {
  const text = visible();
  assert.doesNotMatch(text, /£|\bprices?\b|\bpricing\b|\bcheap|\bsolus\b|live tracked|see where every flyer goes|street/i);
  assert.doesNotMatch(text, /turnaround|next.day|same.day|\b\d+\s*(working\s+)?(days?|weeks?|hours?)\b/i);
  assert.doesNotMatch(text, /supplier|print partner/i);
  for (const source of [SOURCE, read("components/Header.tsx"), read("lib/__tests__/leaflet-delivery.test.ts")]) assert.doesNotMatch(source, /[\u2013\u2014]/);
  // The design file was a reference only, never shipped.
  assert.ok(!existsSync("leaflet-delivery-design.html"));
});

test("the design's measures: the 1200px container, 88px sections, 40px headings, its cards and boxes", () => {
  // Every section's content sits in the same centred 1200px container with 24px sides.
  const sections = [...html().matchAll(/<section(?: id="[^"]*")? class="([^"]*)"><div class="([^"]*)"/g)].map((m) => ({ section: m[1], inner: m[2] }));
  assert.equal(sections.length, 9);
  for (const s of sections) assert.match(s.inner, /^mx-auto w-full max-w-\[1200px\] px-6\b/, s.section);
  // Navy hero (28px above, 72px below, 64px on phones); the figures strip grey (40px); then white and #f8fafc in
  // turn, 88px top and bottom (64px on phones); the closing band white (72px above, 88px below, 64px each on
  // phones) holding the navy card.
  const padding = (s: { section: string; inner: string }) => (`${s.section} ${s.inner}`.match(/(?:sm:)?\bp[tby]-(?:\[\d+px\]|\d+)/g) ?? []).join(" ");
  assert.deepEqual(
    sections.map((s) => [s.section.match(/bg-\[#[0-9a-f]+\]|bg-white/)![0], padding(s)]),
    [
      ["bg-[#1e3a8a]", "pt-7 pb-16 sm:pb-[72px]"],
      ["bg-[#f8fafc]", "py-10"],
      ["bg-white", "py-16 sm:py-[88px]"],
      ["bg-[#f8fafc]", "py-16 sm:py-[88px]"],
      ["bg-white", "py-16 sm:py-[88px]"],
      ["bg-[#f8fafc]", "py-16 sm:py-[88px]"],
      ["bg-white", "py-16 sm:py-[88px]"],
      ["bg-[#f8fafc]", "py-16 sm:py-[88px]"],
      ["bg-white", "py-16 sm:pt-[72px] sm:pb-[88px]"],
    ]
  );
  // H2s: 40px (32px on phones), weight 800, the heading font, #172554; the proof and closing ones 36px (30px on
  // phones). The H1 56px (36px on phones). As on /leaflet-printing, from 640px up the design's sizes.
  const h2s = [...html().matchAll(/<h2 class="([^"]*)"/g)].map((m) => m[1]);
  const H2 = "font-heading text-[32px] sm:text-[40px] font-extrabold leading-[1.1] text-[#172554]";
  assert.deepEqual(h2s, [
    H2,
    H2,
    H2,
    "font-heading text-[30px] sm:text-[36px] font-extrabold leading-[1.1] text-[#172554]",
    H2,
    H2,
    "font-heading text-[30px] sm:text-[36px] font-extrabold leading-[1.15]",
  ]);
  assert.match(html(), /<h1 class="font-heading text-\[36px\] sm:text-\[56px\] font-extrabold leading-\[1\.05\]">/);
  assert.match(read("app/leaflet-printing/page.tsx"), /const SECTION = "py-16 sm:py-\[88px\]";/);
  // The page is white with a 1.6 line height (after the hero photo's preload link).
  assert.match(html(), /^(<link rel="preload"[^>]*\/>)?<div class="bg-white leading-\[1\.6\] text-\[#1f2937\]"><script type="application\/ld\+json">/);
  // The hero copy and photo side by side while they fit (480px and 420px at least, 48px apart), the photo 400px
  // tall with 20px corners and a shadow.
  assert.match(html(), /<div class="flex flex-wrap items-center gap-12"><div class="flex min-w-0 flex-\[1_1_480px\] flex-col gap-\[22px\]">/);
  assert.match(html(), /<img alt="Leaflets posted through a letterbox"[^>]*class="h-\[400px\] min-w-0 flex-\[1_1_420px\] rounded-\[20px\] object-cover shadow-\[0_24px_48px_rgba\(15,23,42,0\.35\)\]"/);
  // The door to door card: navy, 24px corners, 40px padding, its three points in #172554 boxes with 14px corners.
  const how = sectionOf("How we deliver your leaflets");
  assert.match(how, /<div class="flex flex-wrap items-center gap-10 rounded-\[24px\] bg-\[#1e3a8a\] p-10 text-white">/);
  assert.equal((how.match(/<li class="flex items-start gap-3\.5 rounded-\[14px\] bg-\[#172554\] px-\[18px\] py-4">/g) ?? []).length, 3);
  // The four method cards: as many columns as fit at 260px, 18px corners, a 1px #e2e8f0 border, 24px padding, the
  // 48px light blue icon box.
  assert.match(how, /<ul class="grid grid-cols-\[repeat\(auto-fit,minmax\(260px,1fr\)\)\] gap-4">/);
  assert.equal((how.match(/class="[^"]*flex flex-1 flex-col gap-2\.5 rounded-\[18px\] border border-\[#e2e8f0\] bg-white p-6[^"]*"[^>]*><span class="flex h-12 w-12 items-center justify-center rounded-\[12px\] bg-\[#eff6ff\] text-\[#1d4ed8\]">/g) ?? []).length, 4);
  // The packages: 300px columns, 20px corners, 30px padding.
  assert.match(sectionOf("Need them printed too?"), /<ul class="grid grid-cols-\[repeat\(auto-fit,minmax\(300px,1fr\)\)\] gap-5">/);
  assert.equal((sectionOf("Need them printed too?").match(/rounded-\[20px\][^"]*p-\[30px\]/g) ?? []).length, 3);
  // The round: 462px tall (the design's 460px and its 1px border), 20px corners.
  assert.match(html(), /<img alt="GPS tracked leaflet delivery route in Bitterne Park, Southampton"[^>]*class="h-\[462px\] w-full rounded-\[20px\] border border-\[#e2e8f0\] object-cover"/);
  // The area groups: 250px columns, 16px corners; the questions 19px bold between 1px dividers; the closing card navy, 24px corners, 48px padding.
  assert.match(sectionOf("Where we deliver"), /<ul class="grid grid-cols-\[repeat\(auto-fit,minmax\(250px,1fr\)\)\] gap-4"><li class="flex flex-col gap-2\.5 rounded-\[16px\] border border-\[#e2e8f0\] p-5">/);
  assert.equal((sectionOf("Leaflet delivery questions").match(/<details[^>]*class="border-b border-\[#e2e8f0\] py-5"><summary class="[^"]*text-\[19px\] font-bold text-\[#172554\][^"]*">/g) ?? []).length, 5);
  assert.match(html(), /<div class="flex flex-wrap items-center justify-between gap-6 rounded-\[24px\] bg-\[#1e3a8a\] p-12 text-white">/);
});

test("it is in the sitemap (www, dated 18 November 2026, the same settings as the other pages) and in llms.txt", () => {
  const entries = sitemap();
  const entry = entries.filter((e) => e.url === OWN);
  assert.equal(entry.length, 1);
  assert.equal(new Date(entry[0].lastModified!).toISOString(), "2026-11-18T00:00:00.000Z");
  const other = entries.find((e) => e.url === `${SITE}/leaflet-printing`)!;
  assert.equal(entry[0].changeFrequency, other.changeFrequency);
  assert.equal(entry[0].priority, other.priority);
  // The dates of the other pages are unchanged.
  assert.equal(new Date(other.lastModified!).toISOString(), "2026-11-17T00:00:00.000Z");
  assert.equal(new Date(entries.find((e) => e.url === `${SITE}/services`)!.lastModified!).toISOString(), "2026-06-24T00:00:00.000Z");
  const llms = read("public/llms.txt").split("\n");
  assert.ok(llms.includes(`- [Leaflet Delivery](${OWN}): Door to door leaflet delivery across Hampshire and Dorset by our own local team, with every round GPS tracked and a route report at the end.`));
  assert.ok(llms.indexOf("## Services") < llms.findIndex((l) => l.includes(OWN)));
});

test("the Services menu's Leaflet Distribution opens it", () => {
  const header = read("components/Header.tsx");
  assert.match(header, /\{ href: "\/leaflet-delivery", label: "Leaflet Distribution", description: "Door to door, GPS tracked\. We can design and print it too\.", look: "featured" \}/);
});
