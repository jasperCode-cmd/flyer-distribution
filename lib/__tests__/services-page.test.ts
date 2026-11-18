// The all services hub (/services): its metadata and schema, the hero's jump
// buttons and the rows they land on, each service's copy, pills, photo and
// button, the two packages, the reasons strip with the Google rating, the
// closing band, the copy rules, the design's measures (smaller on phones, as on
// /leaflet-delivery), and its sitemap and llms.txt entries. The old page (its
// leaflet cards, areas section and Additional Services) is gone.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import sitemap from "@/app/sitemap";

const SITE = "https://www.flyerdistributionhampshire.co.uk";
const OWN = `${SITE}/services`;
const DESCRIPTION =
  "Leaflet delivery, leaflet printing, web design and mobile screen hire for local businesses across Hampshire and Dorset, all from one local team.";

type Rendered = { html: string; metadata: Record<string, any> };
let rendered: Rendered | undefined;
function render(): Rendered {
  if (!rendered) {
    const run = spawnSync(process.execPath, ["--import", "tsx", "lib/__tests__/render-services.ts"], { encoding: "utf8" });
    assert.equal(run.status, 0, run.stderr);
    rendered = JSON.parse(run.stdout) as Rendered;
  }
  return rendered;
}
const read = (p: string) => readFileSync(p, "utf8");
const SOURCE = read("app/services/page.tsx");
const decode = (s: string) => s.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
const textOf = (h: string) => decode(h.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const html = () => render().html;
const linksIn = (part: string) => [...part.matchAll(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => [decode(m[1]), textOf(m[2])]);
const sectionWithId = (id: string) => {
  const from = html().indexOf(`<section id="${id}"`);
  assert.ok(from > 0, id);
  return html().slice(from, html().indexOf("</section>", from));
};

test("the metadata: Our Services with the site's suffix, the given description, its own canonical and Open Graph", () => {
  const { metadata } = render();
  assert.equal(metadata.title, "Our Services");
  assert.match(read("app/layout.tsx"), /template: "%s \| Flyer Distribution Hampshire"/);
  assert.equal(metadata.description, DESCRIPTION);
  assert.ok(DESCRIPTION.length <= 160, `${DESCRIPTION.length}`);
  assert.equal(metadata.alternates.canonical, OWN);
  assert.equal(metadata.openGraph.url, OWN);
  assert.equal(metadata.openGraph.title, "Our Services | Flyer Distribution Hampshire");
  assert.equal(metadata.openGraph.description, DESCRIPTION);
  assert.equal(metadata.openGraph.siteName, "Flyer Distribution Hampshire");
  assert.equal(metadata.openGraph.locale, "en_GB");
  assert.equal(metadata.twitter.title, "Our Services | Flyer Distribution Hampshire");
  assert.doesNotMatch(SOURCE, /<head|<title|<meta|<link rel/);
});

test("the schema: BreadcrumbList Home / Services, and four Services by the site-wide LocalBusiness", () => {
  const schemas = [...html().matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
  assert.equal(schemas.length, 2);
  const [breadcrumb, services] = schemas;
  assert.deepEqual(breadcrumb.itemListElement, [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE },
    { "@type": "ListItem", position: 2, name: "Services", item: OWN },
  ]);
  const areaServed = [
    { "@type": "AdministrativeArea", name: "Hampshire" },
    { "@type": "AdministrativeArea", name: "Dorset" },
  ];
  assert.deepEqual(services["@graph"], [
    { "@type": "Service", name: "Leaflet Delivery", url: `${SITE}/leaflet-delivery`, provider: { "@id": `${SITE}/#business` }, areaServed },
    { "@type": "Service", name: "Leaflet Printing", url: `${SITE}/leaflet-printing`, provider: { "@id": `${SITE}/#business` }, areaServed },
    { "@type": "Service", name: "Web Design & SEO", url: `${SITE}/services/web-design-seo`, provider: { "@id": `${SITE}/#business` }, areaServed },
    { "@type": "Service", name: "Mobile Screen Trailer Hire", url: `${SITE}/services/screen-hire`, provider: { "@id": `${SITE}/#business` }, areaServed },
  ]);
  for (const s of services["@graph"]) assert.ok(existsSync(join("app", ...s.url.replace(SITE, "").split("/").filter(Boolean), "page.tsx")), s.url);
  assert.match(html(), /<nav aria-label="Breadcrumb"[^>]*>[\s\S]*?href="\/">Home<\/a>[\s\S]*?aria-current="page">Services<\/span>/);
});

test("the hero: the label, H1 and line, and a button to each service's row, each row clearing the sticky header", () => {
  const hero = html().slice(0, html().indexOf("</section>"));
  assert.match(hero, /<p class="[^"]*text-\[#facc15\]">For local businesses across Hampshire and Dorset<\/p>/);
  assert.match(hero, /<h1 class="[^"]*">Our Services<\/h1>/);
  assert.ok(textOf(hero).includes("Leaflet delivery, printing, web design and mobile screen hire. Pick one, or put them together and deal with one local team from start to finish."));
  assert.deepEqual(linksIn(hero).slice(1), [
    ["#leaflet-delivery", "Leaflet Delivery"],
    ["#leaflet-printing", "Leaflet Printing"],
    ["#web-design-seo", "Web Design & SEO"],
    ["#screen-hire", "Screen Hire"],
  ]);
  for (const id of ["leaflet-delivery", "leaflet-printing", "web-design-seo", "screen-hire"]) {
    assert.match(html(), new RegExp(`<section id="${id}" class="scroll-mt-16">`), id);
  }
  // In the order the buttons give, with the packages between printing and web design.
  const at = ["leaflet-delivery", "leaflet-printing", "web-design-seo", "screen-hire"].map((id) => html().indexOf(`<section id="${id}"`));
  assert.ok(at.every((v, i) => v > 0 && (i === 0 || v > at[i - 1])));
  const packagesAt = html().indexOf(">Put printing and delivery together<");
  assert.ok(at[1] < packagesAt && packagesAt < at[2]);
});

test("each service's row: its copy, its pills (links for leaflet delivery only), its photo and its button", () => {
  const pills = (part: string) => [...part.matchAll(/<li>(?:<a [^>]*href="([^"]+)"[^>]*>|<span class="[^"]*">)([^<]*)<\/(?:a|span)><\/li>/g)].map((m) => [m[2], m[1] ?? null]);
  const img = (part: string) => {
    const tag = /<img[^>]*>/.exec(part)![0];
    return { alt: decode(/alt="([^"]*)"/.exec(tag)![1]), src: decode(/src="([^"]*)"/.exec(tag)![1]), size: /width="(\d+)" height="(\d+)"/.exec(tag)!.slice(1).join("x"), cls: /class="([^"]*)"/.exec(tag)![1] };
  };
  const button = (part: string) => linksIn(part).at(-1);

  const delivery = sectionWithId("leaflet-delivery");
  assert.match(delivery, />What we(?:'|&#x27;)re known for<\/span><h2 /);
  assert.ok(textOf(delivery).includes("Door to door delivery across the postcodes you choose, by our own local team. Every round is GPS tracked, and you get a route report at the end."));
  assert.deepEqual(pills(delivery), [
    ["Door to door", "/leaflet-delivery"],
    ["Hand-to-Hand", "/services/hand-to-hand-distribution"],
    ["B2B", "/services/b2b-distribution"],
    ["Public Notice", "/services/public-notice-leafleting"],
    ["Vehicle", "/leaflet-delivery#vehicle-leaflet-distribution"],
  ]);
  assert.deepEqual(button(delivery), ["/leaflet-delivery", "Explore leaflet delivery"]);
  assert.deepEqual({ ...img(delivery), cls: undefined }, { alt: "Leaflets posted through a letterbox", src: img(delivery).src, size: "1600x1200", cls: undefined });
  assert.match(img(delivery).src, /url=%2Fimages%2Fleaflet-delivery-hero\.webp/);
  assert.match(img(delivery).cls, /h-\[400px\] min-w-0 flex-\[1_1_440px\] rounded-\[20px\] object-cover/);

  const printing = sectionWithId("leaflet-printing");
  assert.ok(textOf(printing).includes("Flyers, folded leaflets and business cards, printed and delivered to you or straight through letterboxes. Build your spec online and send it straight to a quote."));
  assert.deepEqual(pills(printing), [["Flyers and leaflets", null], ["Folded leaflets", null], ["Business cards", null], ["Custom shapes", null]]);
  assert.deepEqual(button(printing), ["/leaflet-printing#paper-and-finish", "Build your print"]);
  assert.equal(img(printing).alt, "Colourful printed leaflets laid out on a desk");
  assert.match(img(printing).src, /url=%2Fimages%2Fprinting-flyers-leaflets\.webp/);
  assert.match(img(printing).cls, /h-\[360px\]/);
  assert.match(read("app/leaflet-printing/page.tsx"), /<section id="paper-and-finish"/);

  const web = sectionWithId("web-design-seo");
  assert.ok(textOf(web).includes("Get found online and turn visitors into enquiries with a fast, professional website. We handle SEO, design and delivery, managed for you from start to finish."));
  assert.deepEqual(pills(web), [["Mobile-first", null], ["SEO built in", null], ["Managed for you", null]]);
  assert.deepEqual(button(web), ["/services/web-design-seo", "Explore web design"]);
  assert.equal(img(web).alt, "A laptop showing website code on a desk");
  assert.match(img(web).src, /photo-1498050108023-c5249f4df085/);
  // The same photo the Web Design page uses.
  assert.match(read("app/services/web-design-seo/page.tsx"), /photo-1498050108023-c5249f4df085/);

  const screen = sectionWithId("screen-hire");
  assert.ok(textOf(screen).includes("Hire our mobile LED screen trailer for events, advertising, movies or gaming. A bright 7m² screen on a trailer, easy to set up and hard to miss."));
  assert.deepEqual(pills(screen), [["7m² LED screen", null], ["Events and advertising", null], ["Easy setup", null]]);
  assert.deepEqual(button(screen), ["/services/screen-hire", "Explore screen hire"]);
  assert.equal(img(screen).alt, "Our mobile LED screen trailer set up outdoors");
  assert.match(img(screen).src, /url=%2Fimages%2Fscreen-trailer\.webp/);
  assert.equal(img(screen).size, "736x941");
  assert.match(img(screen).cls, /h-\[400px\][^"]*object-cover object-\[center_45%\]/);
  for (const f of ["leaflet-delivery-hero", "printing-flyers-leaflets", "screen-trailer"]) assert.ok(existsSync(join("public", "images", `${f}.webp`)), f);
  // Printing and screen hire put their copy first, so their photo comes first on phones (wrap-reverse) and sits on the right from 984px.
  assert.match(printing, /class="mx-auto w-full max-w-\[1200px\] px-6 flex flex-wrap-reverse items-center gap-14 py-14"/);
  assert.match(screen, /flex flex-wrap-reverse items-center gap-14/);
  assert.match(delivery, /flex flex-wrap items-center gap-14/);
  assert.match(web, /flex flex-wrap items-center gap-14/);
});

test("the two packages, each a card linking to its part of /leaflet-delivery", () => {
  const from = html().indexOf(">Put printing and delivery together<") + 1;
  const packages = html().slice(from, html().indexOf("</section>", from));
  assert.ok(textOf(packages).startsWith("Put printing and delivery together One campaign, one team, one quote."));
  assert.deepEqual(linksIn(packages), [
    ["/leaflet-delivery#design-print-deliver", "Most popular Design, Print and Deliver We design your leaflet, print it and deliver it across your chosen areas. See the package"],
    ["/leaflet-delivery#print-and-deliver", "Print and Deliver Artwork ready? We print it and deliver it through letterboxes. See the package"],
  ]);
  const delivery = read("app/leaflet-delivery/page.tsx");
  assert.match(delivery, /<li id="design-print-deliver"/);
  assert.match(delivery, /<li id="print-and-deliver"/);
  // Navy and white, 20px corners, 28px padding, side by side while they fit at 300px each.
  assert.match(packages, /<ul class="grid grid-cols-\[repeat\(auto-fit,minmax\(300px,1fr\)\)\] gap-5">/);
  assert.match(packages, /class="group flex flex-1 flex-col gap-2\.5 rounded-\[20px\] bg-\[#1e3a8a\] p-7 text-white/);
  assert.match(packages, /class="group flex flex-1 flex-col gap-2\.5 rounded-\[20px\] border border-\[#e2e8f0\] bg-white p-7/);
});

test("the reasons strip: the 5.0 Google rating as the homepage shows it, linking to the same profile, and three lines", () => {
  const from = html().indexOf('<section class="border-t border-[#e2e8f0] bg-[#f8fafc]">');
  const strip = html().slice(from, html().indexOf("</section>", from));
  const profile = /const GOOGLE_PROFILE = "([^"]+)";/.exec(read("app/page.tsx"))![1];
  assert.deepEqual(linksIn(strip), [[profile, "5.0 Rated on Google by local businesses (opens in a new tab)"]]);
  assert.match(strip, new RegExp(`<a href="${profile.replace(/\./g, "\\.")}" target="_blank" rel="noopener"`));
  assert.match(strip, /<svg role="img" aria-label="5 out of 5 stars" viewBox="0 0 120 24" class="[^"]*fill-\[#b45309\]">/);
  assert.match(read("components/ReviewBand.tsx"), /aria-label="5 out of 5 stars"[^>]*fill-\[#b45309\]/);
  assert.deepEqual([...strip.matchAll(/<p class="flex flex-col"><span[^>]*>([^<]*)<\/span><span[^>]*>([^<]*)<\/span><\/p>/g)].map((m) => [m[1], m[2]]), [
    ["Our own local team", "Based in Hampshire and Dorset"],
    ["GPS tracked rounds", "With a route report at the end"],
    ["One point of contact", "From the first call to the last round"],
  ]);
});

test("the closing band: the free quote, case studies, FAQs and before you book", () => {
  const from = html().lastIndexOf("<section");
  const closing = html().slice(from);
  assert.ok(textOf(closing).includes("Not sure which you need? Tell us what you're trying to achieve and we'll recommend the right mix. Or see our case studies , FAQs and what to know before you book ."));
  assert.deepEqual(linksIn(closing), [
    ["/case-studies", "our case studies"],
    ["/faq", "FAQs"],
    ["/before-you-book", "what to know before you book"],
    ["/quote", "Get a Free Quote"],
  ]);
});

test("every link resolves to a page, a part of one, or this page's rows; the old page is gone", () => {
  const links = linksIn(html());
  for (const [href] of links) {
    if (href.startsWith("https://")) continue;
    if (href.startsWith("#")) {
      assert.match(html(), new RegExp(`id="${href.slice(1)}"`), href);
      continue;
    }
    const [path, hash] = href.split("#");
    const file = join("app", ...path.split("?")[0].split("/").filter(Boolean), "page.tsx");
    assert.ok(existsSync(file), href);
    if (hash) assert.match(read(file), new RegExp(`id="${hash}"|id: "${hash}"`), href);
  }
  // None of the old content: its leaflet cards, the areas section, Additional Services.
  for (const old of ["Additional Services", "Targeted Postcode Campaigns", "Campaign Planning", "Areas We Cover", "AdditionalServiceCard", "StaggerGroup", "BrowserMockup"]) {
    assert.ok(!SOURCE.includes(old), old);
  }
  assert.doesNotMatch(SOURCE, /\/services#/);
});

test("the copy rules: no prices, turnaround times, supplier, banned words or dashes", () => {
  const text = textOf(html().replace(/<script[\s\S]*?<\/script>/g, ""));
  assert.doesNotMatch(text, /£|\bprices?\b|\bpricing\b|\bcheap|\baffordab|\bcompetitive|\bdiscount|\bsolus\b|live tracked|see where every flyer goes|street/i);
  assert.doesNotMatch(text, /turnaround|next.day|same.day|\bwithin\b|\b\d+\s*(working\s+)?(days?|weeks?|hours?)\b/i);
  assert.doesNotMatch(text, /supplier|print partner/i);
  for (const source of [SOURCE, read("lib/__tests__/services-page.test.ts")]) assert.doesNotMatch(source, /[\u2013\u2014]/);
  assert.ok(!existsSync("services-design.html"), "the design file was a reference only");
});

test("the design's measures, and smaller headings and padding on phones as on /leaflet-delivery", () => {
  const sections = [...html().matchAll(/<section(?: id="[^"]*")? class="([^"]*)"><div class="([^"]*)"/g)].map((m) => ({ section: m[1], inner: m[2] }));
  assert.equal(sections.length, 8);
  for (const s of sections) assert.match(s.inner, /^mx-auto w-full max-w-\[1200px\] px-6\b/, s.section);
  const padding = (s: { section: string; inner: string }) => (`${s.inner}`.match(/(?:sm:)?\bp[tby]-(?:\[\d+px\]|\d+)/g) ?? []).join(" ");
  assert.deepEqual(
    sections.map(padding),
    ["pt-7 pb-16", "pt-16 pb-14 sm:pt-[88px]", "py-14", "py-16 sm:py-[72px]", "pt-16 pb-14 sm:pt-[88px]", "pt-14 pb-16 sm:pb-[88px]", "py-10", "py-16 sm:pt-[72px] sm:pb-[88px]"]
  );
  const h2s = [...html().matchAll(/<h2 class="([^"]*)"/g)].map((m) => m[1]);
  const H2 = "font-heading text-[32px] sm:text-[40px] font-extrabold leading-[1.1] text-[#172554]";
  assert.deepEqual(h2s, [
    H2,
    H2,
    "font-heading text-[28px] sm:text-[32px] font-extrabold leading-[1.15] text-[#172554]",
    H2,
    H2,
    "font-heading text-[30px] sm:text-[36px] font-extrabold leading-[1.15]",
  ]);
  // The H1 the same as /leaflet-delivery's and /leaflet-printing's: 56px, 36px on phones.
  assert.match(html(), /<h1 class="max-w-\[820px\] font-heading text-\[36px\] sm:text-\[56px\] font-extrabold leading-\[1\.05\]">/);
  assert.match(read("app/leaflet-delivery/page.tsx"), /const SECTION = "py-16 sm:py-\[88px\]";/);
  // The jump buttons, the row buttons and the pills.
  // The four jump buttons and the four reasons: 1 across on small phones, 2 from sm, 4 from lg (no row left with one).
  assert.match(html(), /<ul class="mt-\[18px\] grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">/);
  assert.match(html(), /<section class="border-t border-\[#e2e8f0\] bg-\[#f8fafc\]"><div class="mx-auto w-full max-w-\[1200px\] px-6 grid grid-cols-1 gap-5 py-10 sm:grid-cols-2 lg:grid-cols-4">/);
  // Each row photo's sizes asks for the width it is drawn at when it covers its box (its height times its shape).
  const sizesOf = (alt: string) => decode(new RegExp(`<img alt="${alt}"[^>]*sizes="([^"]*)"`).exec(html())![1]);
  assert.equal(sizesOf("Leaflets posted through a letterbox"), "(min-width: 984px) 548px, (min-width: 582px) calc(100vw - 48px), 534px");
  assert.equal(sizesOf("Colourful printed leaflets laid out on a desk"), "(min-width: 984px) 618px, (min-width: 666px) calc(100vw - 48px), 618px");
  assert.equal(sizesOf("A laptop showing website code on a desk"), "(min-width: 984px) 548px, (min-width: 588px) calc(100vw - 48px), 540px");
  assert.equal(sizesOf("Our mobile LED screen trailer set up outdoors"), "(min-width: 1200px) 548px, (min-width: 984px) calc(50vw - 52px), calc(100vw - 48px)");
  assert.match(SOURCE, /src="https:\/\/images\.unsplash\.com\/photo-1498050108023-c5249f4df085\?w=1800&q=80"\s+alt="A laptop showing website code on a desk"\s+width=\{1800\}\s+height=\{1202\}/);
  assert.equal((html().match(/class="flex items-center justify-between gap-2\.5 rounded-\[14px\] border border-\[#3b5bb5\] bg-\[#172554\] px-\[18px\] py-4 font-bold text-white/g) ?? []).length, 4);
  assert.equal((html().match(/class="mt-1\.5 inline-flex min-h-\[52px\] items-center gap-1\.5 self-start rounded-\[12px\] bg-\[#1e3a8a\] px-6 font-bold text-white/g) ?? []).length, 4);
  assert.equal((html().match(/rounded-full bg-\[#eff6ff\] px-\[13px\] py-\[7px\] text-\[14px\] font-bold text-\[#1e3a8a\]/g) ?? []).length, 15);
  // The closing card: navy, 24px corners, 48px padding.
  assert.match(html(), /<div class="flex flex-wrap items-center justify-between gap-7 rounded-\[24px\] bg-\[#1e3a8a\] p-12 text-white">/);
});

test("its sitemap entry is dated 18 November 2026, and llms.txt describes the hub", () => {
  const entry = sitemap().filter((e) => e.url === OWN);
  assert.equal(entry.length, 1);
  assert.equal(new Date(entry[0].lastModified!).toISOString(), "2026-11-18T00:00:00.000Z");
  assert.equal(entry[0].priority, 0.8);
  const llms = read("public/llms.txt").split("\n");
  assert.ok(llms.includes(`- [Our Services](${OWN}): ${DESCRIPTION}`));
  assert.ok(!llms.some((l) => l.includes("[Leaflet Services]")));
});
