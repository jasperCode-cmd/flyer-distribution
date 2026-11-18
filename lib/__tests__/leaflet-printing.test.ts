// The Leaflet Printing page (/leaflet-printing): its metadata and schema, its
// sections and copy in order, the photo and review it reuses, the copy rules,
// and the links to it from the Services menu, the footer and /services, and its own links to /leaflet-delivery.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import sitemap from "@/app/sitemap";
import { AREA_PAGES } from "@/lib/area-pages";

const SITE = "https://www.flyerdistributionhampshire.co.uk";
const OWN = `${SITE}/leaflet-printing`;
const FULL_TITLE = "Leaflet Printing Hampshire and Dorset | Flyer Distribution Hampshire";
const DESCRIPTION =
  "Leaflet, flyer and business card printing for Hampshire and Dorset businesses. We recommend 250gsm silk, and can deliver to you or door to door.";
const QUOTE = "/quote?service=printing";

type Rendered = { html: string; metadata: Record<string, any> };
let rendered: Rendered | undefined;
function render(): Rendered {
  if (!rendered) {
    const run = spawnSync(process.execPath, ["--import", "tsx", "lib/__tests__/render-leaflet-printing.ts"], { encoding: "utf8" });
    assert.equal(run.status, 0, run.stderr);
    rendered = JSON.parse(run.stdout) as Rendered;
  }
  return rendered;
}

const read = (p: string) => readFileSync(p, "utf8");
const SOURCE = read("app/leaflet-printing/page.tsx");
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
  assert.equal(metadata.title, "Leaflet Printing Hampshire and Dorset");
  assert.match(read("app/layout.tsx"), /template: "%s \| Flyer Distribution Hampshire"/);
  assert.equal(metadata.description, DESCRIPTION);
  assert.ok(DESCRIPTION.length < 160, `${DESCRIPTION.length} characters`);
  assert.equal(metadata.alternates.canonical, OWN);
  assert.equal(metadata.openGraph.url, OWN);
  assert.equal(metadata.openGraph.title, FULL_TITLE);
  assert.equal(metadata.openGraph.description, DESCRIPTION);
  assert.equal(metadata.openGraph.siteName, "Flyer Distribution Hampshire");
  assert.equal(metadata.twitter.title, FULL_TITLE);
  // No other page has this description, and nothing is added to the head by hand.
  const pages = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const p = join(dir, name);
      return statSync(p).isDirectory() ? pages(p) : name === "page.tsx" ? [p] : [];
    });
  for (const p of pages("app").filter((p) => p !== join("app", "leaflet-printing", "page.tsx"))) assert.ok(!read(p).includes(DESCRIPTION), p);
  assert.doesNotMatch(SOURCE, /<head|<title|<meta|<link rel/);
});

test("the H1 and every H2, in order, without the word distribution", () => {
  assert.deepEqual(headings(1), ["Leaflet and Flyer Printing"]);
  assert.deepEqual(headings(2), [
    "What we print",
    "Paper and finish",
    "Three ways to order",
    "Where we deliver your leaflets",
    "Printing questions",
    "Ready to get your leaflets printed?",
  ]);
  for (const h of [...headings(1), ...headings(2)]) assert.doesNotMatch(h, /distribution/i, h);
});

test("the schema: BreadcrumbList Home / Services / Leaflet Printing, and a Service by the site-wide LocalBusiness", () => {
  const [breadcrumb, service] = schemas();
  assert.deepEqual(breadcrumb.itemListElement, [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE },
    { "@type": "ListItem", position: 2, name: "Services", item: `${SITE}/services` },
    { "@type": "ListItem", position: 3, name: "Leaflet Printing", item: OWN },
  ]);
  assert.equal(service["@type"], "Service");
  assert.equal(service.name, "Leaflet Printing");
  assert.deepEqual(service.provider, { "@id": `${SITE}/#business` });
  assert.match(read("components/SiteSchema.tsx"), new RegExp(`"@type": "LocalBusiness",\\n\\s+"@id": "${SITE}/#business"`));
  assert.deepEqual(service.areaServed, [
    { "@type": "AdministrativeArea", name: "Hampshire" },
    { "@type": "AdministrativeArea", name: "Dorset" },
  ]);
  // The visible breadcrumb matches.
  assert.match(html(), /<nav aria-label="Breadcrumb"[^>]*>[\s\S]*?>Home<\/a>[\s\S]*?>Services<\/a>[\s\S]*?aria-current="page">Leaflet Printing<\/span>/);
});

test("the hero: yellow label, H1, intro, the two buttons and the printer photo", () => {
  const hero = html().slice(0, html().indexOf("</section>"));
  assert.match(hero, /<p class="text-\[#facc15\][^"]*">Printing for Hampshire and Dorset businesses<\/p>/);
  assert.ok(
    textOf(hero).includes(
      "We print leaflets, flyers and business cards for local businesses across Hampshire and Dorset, then deliver them to you or straight through letterboxes in your chosen areas."
    )
  );
  assert.deepEqual(linksIn(hero).slice(-2), [
    [QUOTE, "Get a Free Quote"],
    ["/leaflet-delivery", "See our leaflet delivery"],
  ]);
  // The photos, each from public/images with its own alt: the hero first (loaded straight away), then
  // the three product cards, then the paper. Never the doorway leaflet with its printed slogan.
  const imgs = [...html().matchAll(/<img[^>]*>/g)].map((m) => ({
    src: /url=%2Fimages%2F([a-z-]+\.webp)/.exec(m[0])?.[1],
    alt: decode(/alt="([^"]*)"/.exec(m[0])![1]),
    lazy: / loading="lazy"/.test(m[0]),
    size: /width="(\d+)" height="(\d+)"/.exec(m[0])!.slice(1).join("x"),
  }));
  assert.deepEqual(imgs, [
    { src: "leaflet-printing-hero.webp", alt: "A large printer mid-print", lazy: false, size: "1500x1000" },
    { src: "printing-flyers-leaflets.webp", alt: "Colourful printed leaflets laid out on a desk", lazy: true, size: "1200x700" },
    { src: "printing-folded-leaflets.webp", alt: "A printed folded leaflet standing on a stack of leaflets", lazy: true, size: "1200x700" },
    { src: "printing-business-cards.webp", alt: "A stack of printed business cards", lazy: true, size: "1200x700" },
    { src: "printing-paper.webp", alt: "A fan of coloured paper sheets", lazy: true, size: "2400x1350" },
  ]);
  for (const img of imgs) assert.ok(existsSync(join("public", "images", img.src!)), img.src);
  assert.doesNotMatch(SOURCE, /Leaflet going through door/);
  // The photo box: 380px tall (280px on phones), 20px corners, the photo covering it.
  assert.match(hero, /<div class="h-\[280px\] overflow-hidden rounded-\[20px\][^"]*sm:h-\[380px\]"><img[^>]*class="h-full w-full object-cover"/);
});

test("the four tick points, the products, and the paper, as given", () => {
  const ticks = html().slice(html().indexOf("</section>"), html().indexOf(">What we print</h2>"));
  assert.deepEqual([...ticks.matchAll(/<li[^>]*>[\s\S]*?<\/span>([^<]+)<\/li>/g)].map((m) => m[1]), [
    "250gsm silk, double-sided, recommended",
    "Delivered to you or through letterboxes",
    "Every round GPS tracked",
    "Based in Hampshire and Dorset",
  ]);
  const print = sectionOf("What we print");
  assert.ok(
    textOf(print).includes(
      "Leaflets and flyers are what most of our customers order, but we print a lot more than that. Tell us what you need on the call and we will recommend the right format."
    )
  );
  const cards = [...print.matchAll(/<h3[^>]*>([^<]*)<\/h3><p[^>]*>([^<]*)<\/p>/g)].map((m) => [m[1], decode(m[2])]);
  assert.deepEqual(cards, [
    ["Flyers and leaflets", "Our main product. A6, A5, A4 and DL, printed single or double-sided."],
    ["Folded leaflets", "Folded leaflets, available creased or perforated."],
    ["Business cards", "Standard, folded and uncoated cards to match your leaflets."],
    ["Custom-shaped flyers", "Cut to a shape that suits your brand, so your leaflet stands out on the doormat."],
    ["Perforated flyers", "A tear-off voucher or reply slip that customers can keep and bring in."],
  ]);
  // Three larger cards in one list, then the two smaller ones in another.
  assert.equal((print.match(/<ul /g) ?? []).length, 2);
  const paper = textOf(sectionOf("Paper and finish"));
  for (const line of [
    "For most leaflet campaigns we recommend 250gsm silk, printed double-sided. It feels sturdy in the hand, the colours stay sharp, and it holds up going through a letterbox.",
    "Pick your options, or leave it to us and we will recommend what suits your campaign on the call.",
    "We recommend 250gsm silk, double-sided",
  ]) {
    assert.ok(paper.includes(line), line);
  }
  assert.doesNotMatch(paper, /Other paper weights and finishes|Popular sizes/);
  // Then the print builder, as the server renders it (before its script loads): the default choice.
  assert.equal(
    paper.slice(paper.indexOf("Build your print")),
    "Build your print Product Flyers and leaflets Folded leaflets Business cards Custom-shaped flyers Size A6 A5 A4 DL Sides Double-sided Single-sided " +
      "Paper type Silk Uncoated Gloss Paper weight 115gsm 150gsm 170gsm 250gsm (recommended) 350gsm 450gsm " +
      "Lamination, spot UV, foil and perforation are also available. Ask us on the call. Your choice: A5 flyers, double-sided, 250gsm silk Get this printed"
  );
});

test("the print builder: a white card of pill buttons, the default chosen, its summary and its link", () => {
  const paper = sectionOf("Paper and finish");
  const builder = paper.slice(paper.indexOf('<div class="rounded-[20px]'));
  // White, a 1px #e2e8f0 border, 20px corners, 26px padding and a soft shadow.
  assert.match(builder, /^<div class="rounded-\[20px\] border border-\[#e2e8f0\] bg-white p-\[26px\] shadow-\[[^\]]+\]"><h3 class="font-sans font-bold [^"]*">Build your print<\/h3>/);
  // Each option a fieldset with a small uppercase grey legend; the pills buttons, at least 44px tall with 12px corners.
  const groups = [...builder.matchAll(/<fieldset><legend class="([^"]*)">([^<]*)<\/legend><div class="flex flex-wrap gap-2">([\s\S]*?)<\/div><\/fieldset>/g)];
  assert.deepEqual(groups.map((g) => g[2]), ["Product", "Size", "Sides", "Paper type", "Paper weight"]);
  for (const g of groups) {
    assert.match(g[1], /\buppercase\b/);
    assert.match(g[1], /text-\[#4b5563\]/);
    const pills = [...g[3].matchAll(/<button type="button" aria-pressed="(true|false)" class="([^"]*)">([^<]*)<\/button>/g)];
    assert.ok(pills.length >= 2, g[2]);
    for (const [, pressed, cls] of pills) {
      assert.match(cls, /\bmin-h-11\b/);
      assert.match(cls, /rounded-\[12px\]/);
      // Chosen: navy with white text. Not chosen: white with a #cbd5e1 border.
      assert.match(cls, pressed === "true" ? /border-\[#1e3a8a\] bg-\[#1e3a8a\] text-white/ : /border-\[#cbd5e1\] bg-white/);
    }
    // One chosen in each.
    assert.equal(pills.filter((p) => p[1] === "true").length, 1, g[2]);
  }
  const chosen = groups.map((g) => /aria-pressed="true"[^>]*>([^<]*)</.exec(g[3])![1]);
  assert.deepEqual(chosen, ["Flyers and leaflets", "A5", "Double-sided", "Silk", "250gsm (recommended)"]);
  // No note for flyers; the extras line always; then the footer, divided off, with the summary and the yellow button.
  assert.doesNotMatch(builder, /bg-\[#eff6ff\]/);
  assert.match(builder, /<div class="mt-6 flex flex-col gap-4 border-t border-\[#e2e8f0\] pt-5[^"]*"><p [^>]*aria-live="polite">Your choice: <strong[^>]*>A5 flyers, double-sided, 250gsm silk<\/strong><\/p><a class="[^"]*bg-\[#facc15\][^"]*" href="\/quote\?service=printing&amp;item=flyers&amp;size=A5&amp;sides=double&amp;ptype=silk&amp;weight=250">Get this printed<svg/);
  // The section can be linked to, for the quote form's Change link.
  assert.match(html(), /<section id="paper-and-finish" class="bg-\[#f8fafc\] py-16 sm:py-\[88px\]"><div class="mx-auto w-full max-w-\[1200px\] px-6 grid grid-cols-1 items-start gap-12 lg:grid-cols-2 lg:items-stretch">/);
});

test("three ways to order, the navy one most popular, each with its link", () => {
  const ways = sectionOf("Three ways to order");
  assert.ok(
    textOf(ways).includes("Print on its own, or let us handle delivery too. Whichever you choose, you deal with the same local team from start to finish.")
  );
  assert.deepEqual([...ways.matchAll(/<h3[^>]*>([^<]*)<\/h3><p[^>]*>([^<]*)<\/p>/g)].map((m) => [decode(m[1]), decode(m[2])]), [
    ["Print only", "We print your leaflets and deliver the boxes to you anywhere in Hampshire and Dorset, or send them to you further afield."],
    ["Print and Deliver", "Send us your artwork. We print it and our own team delivers it door to door, with every round GPS tracked."],
    ["Design, Print and Deliver", "No artwork yet? We design your leaflet, print it and deliver it. One campaign, one team, start to finish."],
  ]);
  assert.deepEqual(linksIn(ways), [
    [QUOTE, "Get a printing quote"],
    ["/leaflet-delivery#print-and-deliver", "About Print and Deliver"],
    ["/leaflet-delivery#design-print-deliver", "About Design, Print and Deliver"],
  ]);
  // Three equal cards (18px corners); the third navy, with the yellow badge at its top right and a yellow link.
  // One card a row until lg, then three across; each link's arrow stays with its last word.
  assert.match(ways, /<ul class="grid grid-cols-1 gap-5 lg:grid-cols-3">/);
  for (const [text, last] of [["Get a printing", "quote"], ["About Print and", "Deliver"], ["About Design, Print and", "Deliver"]]) {
    assert.ok(ways.includes(`>${text} <span class="whitespace-nowrap">${last}<svg aria-hidden="true"`), text);
  }
  assert.equal((ways.match(/<li class="flex flex-col gap-3\.5 rounded-\[20px\] border border-\[#e2e8f0\] bg-white p-\[30px\]"><span class="text-\[#1d4ed8\]"><svg/g) ?? []).length, 2);
  assert.match(
    ways,
    /<li class="relative flex flex-col gap-3\.5 rounded-\[20px\] bg-\[#1e3a8a\] p-\[30px\] text-white"><span class="absolute right-5 top-5 [^"]*bg-\[#facc15\][^"]*">Most popular<\/span><span class="text-\[#facc15\]"><svg[\s\S]*?<\/svg><\/span><h3[^>]*>Design, Print and Deliver<\/h3>/
  );
  assert.match(ways, /<a class="[^"]*text-\[#facc15\][^"]*" href="\/leaflet-delivery#design-print-deliver">/);
  // Those anchors are cards on /leaflet-delivery.
  const delivery = read("app/leaflet-delivery/page.tsx");
  for (const id of ["print-and-deliver", "design-print-deliver"]) assert.match(delivery, new RegExp(`<li id="${id}"`));
});

test("where we deliver: the two counties, then anywhere else, with no town names or postcodes", () => {
  const where = sectionOf("Where we deliver your leaflets");
  assert.ok(
    textOf(where).includes(
      "We print and deliver leaflets for businesses right across Hampshire and Dorset. Outside those counties? We can still print your leaflets and send them to you."
    )
  );
  assert.match(where, /<div class="grid grid-cols-1 gap-6 md:grid-cols-2">/);
  assert.match(where, /<div class="flex flex-col gap-3\.5 rounded-\[20px\] bg-\[#1e3a8a\] p-8 text-white"><span class="text-\[#facc15\]"><svg[\s\S]*?<\/svg><\/span><h3[^>]*>Hampshire and Dorset<\/h3>/);
  assert.match(where, /<div class="flex flex-col gap-3\.5 rounded-\[20px\] border border-\[#e2e8f0\] bg-white p-8"><span class="text-\[#1d4ed8\]"><svg[\s\S]*?<\/svg><\/span><h3[^>]*>Other areas<\/h3>/);
  assert.deepEqual(linksIn(where), [
    ["/areas", "See the areas we cover"],
    [QUOTE, "Get a printing quote"],
  ]);
  const text = textOf(where);
  assert.doesNotMatch(text, /\b(SO|BH|SP|PO|GU|RG)\d/);
  for (const area of Object.values(AREA_PAGES).filter((a) => a.name !== "Dorset")) assert.ok(!text.includes(area.name), area.name);
});

test("printing questions: one real review, word for word, and five questions with the first open", () => {
  const faq = sectionOf("Printing questions");
  assert.deepEqual(linksIn(faq.slice(0, faq.indexOf("<figure"))), [["/faq", "FAQ page"]]);
  // Kola Construction's Google review, exactly as on the homepage.
  const testimonials = read("components/Testimonials.tsx");
  const quote = "Excellent flyer distribution service from start to finish. The team was professional, reliable, and kept us updated throughout the campaign.";
  assert.match(testimonials, new RegExp(`name: "Kola Construction",\\s+label: "Google Review",\\s+quote:\\s+"${quote.replace(/\./g, "\\.")}"`));
  const figure = faq.slice(faq.indexOf("<figure"), faq.indexOf("</figure>"));
  // The quote marks render as \u201c and \u201d.
  // The quote marks render as \u201c and \u201d.
  assert.equal(textOf(figure), `5.0 Google Review \u201c${quote}\u201d Kola Construction`);
  // The rating and stars, as the site already shows them (the rating snapshot).
  assert.match(figure, /aria-label="5 out of 5 stars"/);
  assert.match(read("components/ReviewBand.tsx"), />5\.0<\/p>/);
  const questions = [...faq.matchAll(/<details([^>]*)>[\s\S]*?<h3[^>]*>([^<]*)<\/h3>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p><\/details>/g)].map((m) => ({
    open: / open=""/.test(m[1]),
    q: decode(m[2]),
    a: textOf(m[3]),
    links: linksIn(m[3]),
  }));
  assert.deepEqual(questions.map((x) => x.open), [true, false, false, false, false]);
  assert.deepEqual(questions.map((x) => [x.q, x.a]), [
    [
      "Can you print leaflets without delivering them?",
      "Yes. We deliver the printed boxes to you anywhere in Hampshire and Dorset, and we can send them to other areas too. If you later want them delivered to homes, see our door to door leaflet delivery .",
    ],
    ["What paper do you recommend?", "For most campaigns, 250gsm silk printed double-sided. Other weights and finishes are available and we will advise on the call."],
    ["Can you design the leaflet for us?", "Yes. Our Design, Print and Deliver package covers the design too."],
    [
      "Can you print and deliver in one go?",
      "Yes. With Print and Deliver your leaflets go from the printer to our own team, who deliver them door to door with every round GPS tracked.",
    ],
    [
      "What else can you print?",
      "As well as flyers and leaflets, we print custom-shaped and perforated flyers, folded leaflets and business cards, including folded and uncoated cards.",
    ],
  ]);
  assert.deepEqual(questions[0].links, [["/leaflet-delivery", "door to door leaflet delivery"]]);
  assert.deepEqual(questions[2].links, [["/leaflet-delivery#design-print-deliver", "Design, Print and Deliver"]]);
  // No FAQ schema.
  assert.ok(schemas().every((s) => s["@type"] !== "FAQPage"));
});

test("the design's measures: the 1200px container, 88px sections alternating white and #f8fafc, 40px headings, its cards and boxes", () => {
  // Every section's content sits in the same centred 1200px container with 24px sides.
  const sections = [...html().matchAll(/<section(?: id="[^"]*")? class="([^"]*)">\s*<(?:div|ul) class="([^"]*)"/g)].map((m) => ({ section: m[1], inner: m[2] }));
  assert.equal(sections.length, 8);
  for (const s of sections) assert.match(s.inner, /^mx-auto w-full max-w-\[1200px\] px-6\b/, s.section);
  // Hero navy (28px above, 72px below); the tick strip grey (22px); then white and #f8fafc in turn, each
  // 88px top and bottom (64px on phones); the closing band #172554 (72px).
  const padding = (s: { section: string; inner: string }) => (`${s.section} ${s.inner}`.match(/(?:sm:)?p[tby]-\[?\d+(?:px)?\]?/g) ?? []).join(" ");
  assert.deepEqual(
    sections.map((s) => [s.section.match(/bg-\[#[0-9a-f]+\]|bg-white/)![0], padding(s)]),
    [
      ["bg-[#1e3a8a]", "pt-7 pb-16 sm:pb-[72px]"],
      ["bg-[#f8fafc]", "py-[22px]"],
      ["bg-white", "py-16 sm:py-[88px]"],
      ["bg-[#f8fafc]", "py-16 sm:py-[88px]"],
      ["bg-white", "py-16 sm:py-[88px]"],
      ["bg-[#f8fafc]", "py-16 sm:py-[88px]"],
      ["bg-white", "py-16 sm:py-[88px]"],
      ["bg-[#172554]", "py-16 sm:py-[72px]"],
    ]
  );
  // H2s: 40px (36px in the closing band; 32px and 30px on phones), weight 800, the heading font, tight line height, #172554.
  const h2s = [...html().matchAll(/<h2 class="([^"]*)"/g)].map((m) => m[1]);
  assert.equal(h2s.length, 6);
  for (const c of h2s.slice(0, 5)) assert.equal(c, "font-heading text-[32px] sm:text-[40px] font-extrabold leading-[1.1] text-[#172554]");
  assert.equal(h2s[5], "font-heading text-[30px] sm:text-[36px] font-extrabold leading-[1.15]");
  // The H1 56px, and on phones 36px, the same as /leaflet-delivery's.
  const h1 = /<h1 className="([^"]*)">Leaflet and Flyer Printing<\/h1>/.exec(SOURCE)![1];
  assert.equal(h1, "font-heading text-[36px] sm:text-[56px] font-extrabold leading-[1.05]");
  assert.ok(read("app/leaflet-delivery/page.tsx").includes(`<h1 className="${h1}">`));
  // Third-level headings in the body font, bold.
  for (const m of html().matchAll(/<h3 class="([^"]*)"/g)) assert.match(m[1], /^font-sans font-bold /);
  // The page wraps everything at a 1.6 line height (after the hero photo's preload link), body text #374151.
  assert.match(html(), /^(<link rel="preload"[^>]*\/>)?<div class="leading-\[1\.6\] text-\[#1f2937\]"><script type="application\/ld\+json">/);
  assert.equal((html().match(/<p class="text-\[18px\] text-\[#374151\]">/g) ?? []).length, 6);
  // The main product cards: 18px corners, 1px #e2e8f0 border, a 200px band filled by the photo, 24px padding below.
  const print = sectionOf("What we print");
  assert.equal(
    (print.match(/<li class="flex flex-col overflow-hidden rounded-\[18px\] border border-\[#e2e8f0\] bg-white"><div class="h-\[200px\] bg-\[#dbeafe\]"><img[^>]*class="h-full w-full object-cover"[^>]*><\/div><div class="flex flex-col gap-2 p-6">/g) ?? []).length,
    3
  );
  // Without a photo, the band shows the card's icon, large, centred on light blue.
  assert.match(SOURCE, /<div className="flex h-full items-center justify-center text-\[#1e3a8a\]">\s+<Icon className="h-12 w-12">\{icon\}<\/Icon>/);
  // The two smaller cards: #f8fafc, no border, the 34px blue icon on the left.
  assert.equal((print.match(/<li class="flex items-start gap-\[18px\] rounded-\[18px\] bg-\[#f8fafc\] p-6"><span class="shrink-0 text-\[#1d4ed8\]"><svg[^>]*class="block h-\[34px\] w-\[34px\]"/g) ?? []).length, 2);
  // Paper and finish: the recommendation box white with a 2px navy border; under it the paper photo (16px corners),
  // 180px tall below lg and from lg growing (from 180px) to fill the left column, which stretches to the builder's
  // height, the photo covering it from the centre; then the print builder (beside the text from lg, after it on
  // phones). No size chips: the builder has the sizes.
  const paper = sectionOf("Paper and finish");
  assert.match(paper, /<div class="flex items-center gap-4 rounded-\[16px\] border-2 border-\[#1e3a8a\] bg-white px-\[22px\] py-5"><span class="shrink-0 [^"]*bg-\[#facc15\][^"]*">We recommend<\/span><span class="[^"]*font-bold[^"]*">250gsm silk, double-sided<\/span><\/div><div class="relative h-\[180px\] overflow-hidden rounded-\[16px\] lg:h-auto lg:min-h-\[180px\] lg:flex-1"><img[^>]*alt="A fan of coloured paper sheets"[^>]*class="absolute inset-0 h-full w-full object-cover object-center"[^>]*\/><\/div><\/div><div class="rounded-\[20px\]/);
  assert.match(html(), /<section id="paper-and-finish" [^>]*><div class="[^"]* grid grid-cols-1 items-start gap-12 lg:grid-cols-2 lg:items-stretch"><div class="flex flex-col gap-\[18px\]"><h2 /);
  assert.match(paper, /we recommend <strong>250gsm silk, printed double-sided<\/strong>\./);
  assert.equal((paper.match(/<li /g) ?? []).length, 0);
  // Printing questions: the review a grey card with a 1px border; the questions 19px, bold, between 1px dividers.
  const faq = sectionOf("Printing questions");
  assert.match(faq, /<figure class="mt-3 flex flex-col gap-2\.5 rounded-\[18px\] border border-\[#e2e8f0\] bg-\[#f8fafc\] p-6">/);
  assert.equal((faq.match(/<details[^>]*class="group border-b border-\[#e2e8f0\] py-5"/g) ?? []).length, 5);
  assert.equal((faq.match(/<h3 class="font-sans font-bold text-\[19px\] text-\[#172554\]">/g) ?? []).length, 5);
  // Closing band: #172554, the heading on the left and the yellow button on the right, stacked on phones.
  const closing = html().slice(html().lastIndexOf("<section"));
  assert.match(
    closing,
    /<section class="bg-\[#172554\] text-white border-b border-white\/10"><div class="mx-auto w-full max-w-\[1200px\] px-6 flex flex-col items-start gap-7 py-16 sm:py-\[72px\] md:flex-row md:items-center md:justify-between">/
  );
});

test("the closing band, and every quote link choosing Leaflet Printing", () => {
  const closing = sectionOf("Ready to get your leaflets printed?");
  assert.ok(textOf(closing).includes("Tell us what you need and where, and we will come back to you with a quote."));
  assert.deepEqual(linksIn(closing), [[QUOTE, "Get a Free Quote"]]);
  const quoteLinks = linksIn(html()).filter(([href]) => href.startsWith("/quote"));
  assert.equal(quoteLinks.length, 5);
  // The builder's link carries its choice too.
  assert.deepEqual(
    quoteLinks.filter(([href]) => href !== QUOTE),
    [[`${QUOTE}&item=flyers&size=A5&sides=double&ptype=silk&weight=250`, "Get this printed"]]
  );
});

test("the copy rules: no prices, turnaround times, supplier, banned words or dashes, and every link on the site", () => {
  const text = visible();
  assert.doesNotMatch(text, /£|\bprices?\b|\bpricing\b|\bsolus\b|live tracked|see where every flyer goes|street/i);
  assert.doesNotMatch(text, /turnaround|next.day|same.day|\b\d+\s*(working\s+)?(days?|weeks?|hours?)\b/i);
  assert.doesNotMatch(text, /supplier|print partner/i);
  for (const source of [SOURCE, read("components/PrintBuilder.tsx"), read("lib/print-options.ts")]) assert.doesNotMatch(source, /[\u2013\u2014]/);
  for (const [href] of linksIn(html())) assert.match(href, /^\//, href);
});

test("it is in the sitemap, dated 17 November 2026, with the same settings as the other pages, and in llms.txt", () => {
  const entries = sitemap();
  const entry = entries.filter((e) => e.url === OWN);
  assert.equal(entry.length, 1);
  assert.equal(new Date(entry[0].lastModified!).toISOString(), "2026-11-17T00:00:00.000Z");
  const other = entries.find((e) => e.url === `${SITE}/services`)!;
  assert.equal(entry[0].changeFrequency, other.changeFrequency);
  assert.equal(entry[0].priority, other.priority);
  const llms = readFileSync("public/llms.txt", "utf8").split("\n");
  assert.ok(
    llms.includes(`- [Leaflet Printing](${OWN}): Leaflet, flyer and business card printing for Hampshire and Dorset businesses, delivered to you or door to door.`)
  );
  assert.ok(llms.indexOf("## Services") < llms.findIndex((l) => l.includes(OWN)));
});
