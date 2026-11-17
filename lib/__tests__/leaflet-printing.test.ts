// The Leaflet Printing page (/leaflet-printing): its metadata and schema, its
// sections and copy in order, the photo and review it reuses, the copy rules,
// and the links to it from the Services menu, the footer and /services.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
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
const textOf = (html: string) => decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
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

test("the hero: yellow label, H1, intro, the two buttons and the existing leaflets photo", () => {
  const hero = html().slice(0, html().indexOf("</section>"));
  assert.match(hero, /<p class="text-\[#facc15\][^"]*">Printing for Hampshire and Dorset businesses<\/p>/);
  assert.ok(
    textOf(hero).includes(
      "We print leaflets, flyers and business cards for local businesses across Hampshire and Dorset, then deliver them to you or straight through letterboxes in your chosen areas."
    )
  );
  assert.deepEqual(linksIn(hero).slice(-2), [
    [QUOTE, "Get a Free Quote"],
    ["/services", "See our leaflet delivery"],
  ]);
  // The one photo: the existing leaflets-in-hand one, never the doorway leaflet with its printed slogan.
  const imgs = html().match(/<img[^>]*>/g) ?? [];
  assert.equal(imgs.length, 1);
  assert.match(imgs[0], /url=%2FFlyer%2520Distribution%2520Hampshire\.webp/);
  assert.doesNotMatch(SOURCE, /Leaflet going through door/);
});

test("the four tick points, the products, paper and sizes, as given", () => {
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
    "Other paper weights and finishes are available. We will talk you through the options on the call and recommend what suits your campaign.",
    "We recommend 250gsm silk, double-sided",
  ]) {
    assert.ok(paper.includes(line), line);
  }
  const sizes = [...sectionOf("Paper and finish").matchAll(/<li class="([^"]*)">([^<]*)<\/li>/g)].map((m) => [m[2], m[1].includes("bg-[#1e3a8a]")]);
  assert.deepEqual(sizes, [["A6", false], ["A5", true], ["A4", false], ["DL", false]]);
  assert.match(paper, /^Paper and finish .* Popular sizes A6 A5 A4 DL$/);
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
    ["/services#print-and-deliver", "About Print and Deliver"],
    ["/services#design-print-deliver", "About Design, Print and Deliver"],
  ]);
  assert.match(ways, /<li class="relative flex flex-col rounded-2xl bg-\[#1e3a8a\][^"]*"><span class="[^"]*bg-\[#facc15\][^"]*">Most popular<\/span><h3[^>]*>Design, Print and Deliver<\/h3>/);
  // Those anchors are cards on /services.
  const services = read("app/services/page.tsx");
  for (const id of ["print-and-deliver", "design-print-deliver"]) assert.match(services, new RegExp(`id: "${id}"`));
  assert.match(services, /id=\{pkg\.id\}/);
});

test("where we deliver: the two counties, then anywhere else, with no town names or postcodes", () => {
  const where = sectionOf("Where we deliver your leaflets");
  assert.ok(
    textOf(where).includes(
      "We print and deliver leaflets for businesses right across Hampshire and Dorset. Outside those counties? We can still print your leaflets and send them to you."
    )
  );
  assert.match(where, /<div class="flex flex-col rounded-2xl bg-\[#1e3a8a\][^"]*"><h3[^>]*>Hampshire and Dorset<\/h3>/);
  assert.match(where, /<div class="flex flex-col rounded-2xl border border-gray-200 bg-white[^"]*"><h3[^>]*>Other areas<\/h3>/);
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
  assert.ok(textOf(figure).includes(`\u201c${quote}\u201d`));
  assert.ok(textOf(figure).endsWith("Kola Construction Google Review"));
  // Stars as the homepage shows them, and no rating number.
  assert.match(figure, /aria-label="5 out of 5 stars"/);
  assert.doesNotMatch(textOf(figure), /\d\.\d/);
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
      "Yes. We deliver the printed boxes to you anywhere in Hampshire and Dorset, and we can send them to other areas too. If you later want them delivered to homes, see our leaflet delivery .",
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
  assert.deepEqual(questions[0].links, [["/services", "leaflet delivery"]]);
  assert.deepEqual(questions[2].links, [["/services#design-print-deliver", "Design, Print and Deliver"]]);
  // No FAQ schema.
  assert.ok(schemas().every((s) => s["@type"] !== "FAQPage"));
});

test("the closing band, and every quote link choosing Leaflet Printing", () => {
  const closing = sectionOf("Ready to get your leaflets printed?");
  assert.ok(textOf(closing).includes("Tell us what you need and where, and we will come back to you with a quote."));
  assert.deepEqual(linksIn(closing), [[QUOTE, "Get a Free Quote"]]);
  const quoteLinks = linksIn(html()).filter(([href]) => href.startsWith("/quote"));
  assert.equal(quoteLinks.length, 4);
  assert.ok(quoteLinks.every(([href]) => href === QUOTE));
});

test("the copy rules: no prices, turnaround times, supplier, banned words or dashes, and every link on the site", () => {
  const text = visible();
  assert.doesNotMatch(text, /£|\bprices?\b|\bpricing\b|\bsolus\b|live tracked|see where every flyer goes|street/i);
  assert.doesNotMatch(text, /turnaround|next.day|same.day|\b\d+\s*(working\s+)?(days?|weeks?|hours?)\b/i);
  assert.doesNotMatch(text, /supplier|print partner/i);
  assert.doesNotMatch(SOURCE, /[\u2013\u2014]/);
  for (const [href] of linksIn(html())) assert.match(href, /^\//, href);
});

test("it is in the sitemap, dated 17 November 2026, with the same settings as the other pages", () => {
  const entries = sitemap();
  const entry = entries.filter((e) => e.url === OWN);
  assert.equal(entry.length, 1);
  assert.equal(new Date(entry[0].lastModified!).toISOString(), "2026-11-17T00:00:00.000Z");
  const other = entries.find((e) => e.url === `${SITE}/services`)!;
  assert.equal(entry[0].changeFrequency, other.changeFrequency);
  assert.equal(entry[0].priority, other.priority);
});
