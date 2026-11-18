// The About page: its sections in order, the photo shown whole, the copy it
// carries and the copy it no longer does, and its metadata as it was.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import sharp from "sharp";
import { AREA_PAGES } from "@/lib/area-pages";

type Rendered = { html: string; metadata: Record<string, unknown> };

let rendered: Rendered | undefined;
function render(): Rendered {
  if (!rendered) {
    const run = spawnSync(process.execPath, ["--import", "tsx", "lib/__tests__/render-about-page.ts"], { encoding: "utf8" });
    assert.equal(run.status, 0, run.stderr);
    rendered = JSON.parse(run.stdout) as Rendered;
  }
  return rendered;
}

const SOURCE = readFileSync("app/about/page.tsx", "utf8");
const decode = (s: string) => s.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
// What a visitor reads: the page's text, without its markup.
const text = (html: string) => decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ");

test("the metadata is as it was: title, description, canonical, Open Graph and Twitter", () => {
  const description =
    "Flyer Distribution Hampshire is an independent marketing and leaflet distribution company based in Hampshire, co-founded by Jasper and Daniel.";
  const image = "https://images.pexels.com/photos/35110918/pexels-photo-35110918.jpeg?auto=compress&cs=tinysrgb&w=1200";
  assert.deepEqual(render().metadata, {
    title: "About Us",
    description,
    alternates: { canonical: "https://www.flyerdistributionhampshire.co.uk/about" },
    openGraph: {
      title: "About Us",
      description,
      url: "https://www.flyerdistributionhampshire.co.uk/about",
      siteName: "Flyer Distribution Hampshire",
      images: [{ url: image, width: 1200, height: 630, alt: "Flyer Distribution Hampshire" }],
      locale: "en_GB",
      type: "website",
    },
    twitter: { card: "summary_large_image", title: "About Us", description, images: [image] },
  });
});

test("the sections come in order: hero, photo and panel, founders, promises, then where next and our services", () => {
  const html = render().html;
  const at = (s: string) => {
    const i = html.indexOf(s);
    assert.ok(i >= 0, `missing: ${s}`);
    return i;
  };
  const order = [
    at(">About us</p>"),
    at("<h1"),
    at("<img"),
    at(">Out on a round</p>"),
    at(">Jasper</h3>"),
    at(">Dan</h3>"),
    at(">What we promise every client</h2>"),
    at(">Where next?</p>"),
    at(">Planning a campaign?</h2>"),
    at(">Our services</p>"),
  ];
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
  // One h1, the page's own.
  assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1);
});

test("the hero: eyebrow, greeting and the line about dealing with us directly", () => {
  const html = render().html;
  assert.match(html, /<p class="[^"]*uppercase[^"]*text-\[#1d4ed8\][^"]*">About us<\/p>/);
  assert.match(html, /<h1[^>]*>Hi, we are Jasper and Dan\.<\/h1>/);
  assert.ok(
    text(html).includes(
      "We run Flyer Distribution Hampshire, a local leaflet distribution company covering Hampshire and Dorset. When you work with us, you deal with us directly."
    )
  );
});

test("the photo is the existing one, shown whole at its own 3:4, never cropped", async () => {
  const html = render().html;
  const imgs = html.match(/<img[^>]*>/g) ?? [];
  assert.equal(imgs.length, 1, "the page's only photo");
  const img = imgs[0];
  assert.match(img, /alt="Flyer Distribution Hampshire leaflets in hand on a delivery round in a Hampshire village"/);
  assert.match(img, / width="1200" height="1600"/);
  assert.match(img, /sizes="\(min-width: 1024px\) 450px, \(min-width: 768px\) 340px, calc\(100vw - 32px\)"/);
  assert.match(img, /url=%2FFlyer%2520Distribution%2520Hampshire\.webp/);
  // Its height follows its width, so nothing is cut off: no cover, no fill, no fixed box.
  assert.match(img, /class="block h-auto w-full"/);
  assert.doesNotMatch(img, /object-|data-nimg="fill"|aspect-/);
  // Loaded straight away, as it is near the top of the page.
  assert.doesNotMatch(img, /loading="lazy"/);
  // Its column: about 450px wide on desktop, full width when stacked on phones.
  const banner = /<div class="([^"]*)"><div class="([^"]*)"><img/.exec(html)!;
  assert.match(banner[1], /(^| )overflow-hidden( |$)/);
  assert.match(banner[1], /(^| )rounded-\[22px\]( |$)/);
  assert.match(banner[1], /(^| )md:flex( |$)/);
  assert.equal(banner[2], "md:w-[340px] lg:w-[450px] md:shrink-0");
  // The file is the 1200x1600 one in public, so 1200 by 1600 is its own shape.
  const meta = await sharp("public/Flyer Distribution Hampshire.webp").metadata();
  assert.deepEqual([meta.format, meta.width, meta.height], ["webp", 1200, 1600]);
});

test("the panel: yellow eyebrow, the line, the text, and three pills with the area count from the area data", () => {
  const html = render().html;
  const n = Object.keys(AREA_PAGES).length;
  assert.match(html, /<p class="[^"]*text-\[#facc15\][^"]*">Out on a round<\/p>/);
  assert.ok(text(html).includes("Our own team, our own rounds, and proof of every one."));
  assert.ok(
    text(html).includes(
      "Every campaign is delivered by our local, vetted team and GPS tracked, so you get a route report showing exactly which rounds we completed for you."
    )
  );
  const pills = [...html.matchAll(/<li class="([^"]*)">([^<]*)<\/li>/g)];
  assert.deepEqual(
    pills.map((m) => m[2]),
    ["Rated 5.0 on Google", `${n} areas covered`, "Quote within 24 hours"]
  );
  for (const m of pills) assert.match(m[1], /bg-\[#172554\]/);
  // Counted from the area pages, never typed in.
  assert.doesNotMatch(SOURCE, /\d+ areas covered/);
  assert.match(SOURCE, /Object\.keys\(AREA_PAGES\)\.length/);
});

test("the founder cards: J and D, both Co-Founder, each with their own line", () => {
  const html = render().html;
  for (const [initial, name, line] of [
    ["J", "Jasper", "University of Southampton graduate. Jasper looks after operations, campaign planning, route reports, websites and SEO."],
    ["D", "Dan", "Bournemouth University graduate. Dan is your first call: he talks through your campaign, builds your quote and helps choose the best areas."],
  ]) {
    const card = new RegExp(
      `<div class="[^"]*bg-\\[#f8fafc\\][^"]*">.*?<span aria-hidden="true" class="[^"]*bg-\\[#1e3a8a\\][^"]*text-\\[#facc15\\][^"]*">${initial}</span>` +
        `<div><h3[^>]*>${name}</h3><p[^>]*>Co-Founder</p></div></div><p[^>]*>([^<]*)</p></div>`
    ).exec(html);
    assert.ok(card, name);
    assert.equal(decode(card[1]), line);
  }
  assert.equal((html.match(/>Co-Founder</g) ?? []).length, 2);
});

test("the promises: on navy, three columns with a yellow rule, number, title and text", () => {
  const html = render().html;
  assert.match(html, /<section class="bg-\[#1e3a8a\][^"]*"><div[^>]*><h2[^>]*>What we promise every client<\/h2>/);
  const columns = [
    ...html.matchAll(/<div class="border-t-4 border-\[#facc15\] pt-5"><p[^>]*>(\d\d)<\/p><h3[^>]*>([^<]*)<\/h3><p[^>]*>([^<]*)<\/p><\/div>/g),
  ].map((m) => [m[1], m[2], decode(m[3])]);
  assert.deepEqual(columns, [
    ["01", "Reliability", "We are a small team and our reputation depends on every round being completed. When we take on a campaign, it gets delivered."],
    ["02", "Local knowledge", "We know the areas, postcodes and communities of Hampshire and Dorset, and that local knowledge makes a real difference."],
    ["03", "Transparency", "No hidden costs, no vague timelines. A clear quote, updates throughout, and a route report when your campaign is complete."],
  ]);
});

// The last section, on its own: from "Where next?" to the end.
const lastSection = () => {
  const html = render().html;
  const from = html.lastIndexOf("<section");
  assert.ok(html.indexOf(">Where next?</p>") > from, "Where next? is in the last section");
  return html.slice(from);
};
const linksIn = (part: string) => [...part.matchAll(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => [m[1], text(m[2]).trim()]);

test("one section after the promises: #f8fafc, 88px (64px on phones), two columns of 5fr and 7fr, 64px apart, stacking on phones", () => {
  const html = render().html;
  // Our Services and the next steps are one section now, the last on the page.
  assert.equal((html.match(/<section/g) ?? []).length, 5);
  assert.ok(html.lastIndexOf("<section") > html.indexOf(">What we promise every client</h2>"));
  assert.doesNotMatch(html, />Our Services<\/h2>|>Next steps<\/h2>/);
  assert.match(
    lastSection(),
    /^<section class="bg-\[#f8fafc\] py-16 sm:py-\[88px\]"><div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 items-start gap-10 lg:grid-cols-\[minmax\(0,5fr\)_minmax\(0,7fr\)\] lg:gap-16">/
  );
});

test("where next: the label, Planning a campaign?, the line, Get a Free Quote, then two link cards", () => {
  const last = lastSection();
  const left = last.slice(0, last.indexOf(">Our services</p>"));
  assert.match(left, /<p class="[^"]*uppercase[^"]*tracking-\[0\.14em\][^"]*text-\[#1d4ed8\]">Where next\?<\/p>/);
  assert.match(left, /<h2 class="mt-3 font-heading text-\[34px\] sm:text-\[44px\] font-extrabold[^"]*text-\[#172554\]">Planning a campaign\?<\/h2>/);
  assert.match(left, /<p class="[^"]*text-\[18px\][^"]*text-\[#374151\]">Tell us what you need and where, and get a free quote within 24 hours\.<\/p>/);
  // The yellow button, as on the area pages (with Leaflet Distribution chosen, as the old card did).
  assert.match(left, /<a class="mt-7 inline-block bg-yellow-400 hover:bg-yellow-300 text-blue-900 font-bold px-7 py-3\.5 rounded-md transition duration-200 ease-out hover:scale-105 shadow-lg[^"]*" href="\/quote\?service=leaflet">Get a Free Quote<\/a>/);
  // Two link cards: white, 1px #e2e8f0 border, 14px corners, a light blue icon square, an arrow, a lift on hover.
  const cards = [...left.matchAll(/<a class="([^"]*)" href="([^"]+)"><span class="([^"]*)"><svg[\s\S]*?<\/svg><\/span><span[^>]*><span[^>]*>([^<]*)<\/span><span[^>]*>([^<]*)<\/span><\/span><svg[^>]*>[\s\S]*?<\/svg><\/a>/g)];
  assert.deepEqual(
    cards.map((m) => [m[2], decode(m[4]), decode(m[5])]),
    [
      ["/case-studies", "Want to see our work?", "Real campaigns, with the areas we covered"],
      ["/leaflet-distribution-jobs", "Want to join the team?", "Flexible, local leaflet delivery work"],
    ]
  );
  for (const m of cards) {
    assert.match(m[1], /rounded-\[14px\] border border-\[#e2e8f0\] bg-white/);
    assert.match(m[1], /hover:-translate-y-1 hover:shadow-xl/);
    assert.match(m[3], /bg-\[#dbeafe\]/);
  }
});

test("our services: the leaflet block with its own links, the two other services, and View all services", () => {
  const last = lastSection();
  const panel = last.slice(last.indexOf(">Our services</p>") - 200);
  assert.match(last, /<div class="rounded-\[24px\] border border-\[#e2e8f0\] bg-white p-6 shadow-[^"]*sm:p-8"><p class="[^"]*uppercase[^"]*text-slate-500">Our services<\/p>/);
  // Leaflet services: navy, 16px corners, the yellow paper plane on dark navy, the title a link of its own (to /leaflet-delivery).
  const leaflet = panel.slice(panel.indexOf('<div class="mt-4 rounded-2xl bg-[#1e3a8a]'), panel.indexOf('<ul class="mt-2 divide-y'));
  assert.ok(leaflet.length > 0);
  assert.match(leaflet, /<span class="[^"]*bg-\[#172554\] text-\[#facc15\]"><svg[^>]*><path d="M21\.5 2\.5 2\.5 10l7 3 3 7 9-17\.5ZM9\.5 13 15 8\.5"/);
  assert.match(leaflet, /<h3 class="font-heading text-\[22px\] font-extrabold[^"]*"><a [^>]*href="\/leaflet-delivery">Leaflet services \u2192<\/a><\/h3>/);
  assert.ok(text(leaflet).includes("Door to door across Hampshire and Dorset, GPS tracked. Design and print too."));
  // Five white pills, each its own link; no link holds another.
  assert.deepEqual(
    [...leaflet.matchAll(/<li><a class="([^"]*)" href="([^"]+)">([^<]*)<\/a><\/li>/g)].map((m) => [m[3], m[2], /bg-white/.test(m[1]) && /text-\[13px\] font-bold text-\[#1e3a8a\]/.test(m[1])]),
    [
      ["Distribution", "/leaflet-delivery", true],
      ["Printing", "/leaflet-printing", true],
      ["Public Notice", "/services/public-notice-leafleting", true],
      ["Hand-to-Hand", "/services/hand-to-hand-distribution", true],
      ["B2B", "/services/b2b-distribution", true],
    ]
  );
  assert.doesNotMatch(render().html, /<a [^>]*>(?:(?!<\/a>)[\s\S])*<a /, "no link inside another");
  // Then Web Design & SEO and Screen Hire, each one link with its icon square, H3, line and arrow, divided by a line.
  const rows = panel.slice(panel.indexOf('<ul class="mt-2 divide-y divide-[#e2e8f0]">'));
  assert.deepEqual(
    [...rows.matchAll(/<a class="[^"]*" href="([^"]+)"><span class="[^"]*bg-\[#dbeafe\][^"]*"><svg[\s\S]*?<\/svg><\/span><div[^>]*><h3[^>]*>([^<]*)<\/h3><p[^>]*>([^<]*)<\/p><\/div><svg/g)].map((m) => [m[1], decode(m[2]), m[3]]),
    [
      ["/services/web-design-seo", "Web Design & SEO", "Bespoke websites and SEO for local businesses"],
      ["/services/screen-hire", "Screen Hire", "Mobile LED screen trailer for events and advertising"],
    ]
  );
  assert.match(rows, /href="\/services">View all services \u2192<\/a>/);
  // The services' names are H3s under the H2 on the left; "Our services" is a label, not a heading.
  assert.equal((last.match(/<h2[\s>]/g) ?? []).length, 1);
  assert.equal((last.match(/<h3[\s>]/g) ?? []).length, 3);
});

test("no link from the two old sections is lost, and the new ones are there", () => {
  const hrefs = linksIn(lastSection()).map(([h]) => h);
  // Our Services: /services (View all services), web design, screen hire. Next steps: the quote, case studies, the jobs page.
  for (const old of ["/services", "/services/web-design-seo", "/services/screen-hire", "/quote?service=leaflet", "/case-studies", "/leaflet-distribution-jobs"]) {
    assert.ok(hrefs.includes(old), old);
  }
  for (const added of ["/leaflet-delivery", "/leaflet-printing", "/services/public-notice-leafleting", "/services/hand-to-hand-distribution", "/services/b2b-distribution"]) {
    assert.ok(hrefs.includes(added), added);
  }
  assert.deepEqual(linksIn(lastSection()).map(([h, t]) => `${t} ${h}`), [
    "Get a Free Quote /quote?service=leaflet",
    "Want to see our work? Real campaigns, with the areas we covered /case-studies",
    "Want to join the team? Flexible, local leaflet delivery work /leaflet-distribution-jobs",
    "Leaflet services \u2192 /leaflet-delivery",
    "Distribution /leaflet-delivery",
    "Printing /leaflet-printing",
    "Public Notice /services/public-notice-leafleting",
    "Hand-to-Hand /services/hand-to-hand-distribution",
    "B2B /services/b2b-distribution",
    "Web Design & SEO Bespoke websites and SEO for local businesses /services/web-design-seo",
    "Screen Hire Mobile LED screen trailer for events and advertising /services/screen-hire",
    "View all services \u2192 /services",
  ]);
});

test("the old copy is gone and the copy rules hold", () => {
  const html = render().html;
  const visible = text(html);
  for (const old of ["Who We Are", "national brands", "Operations Director", "Sales Director", "Daniel", "Our Values"]) {
    assert.ok(!visible.includes(old), `still says: ${old}`);
  }
  assert.doesNotMatch(visible, /£|\bsolus\b|live tracked|see where every flyer goes|street/i);
  assert.doesNotMatch(SOURCE, /[\u2013\u2014]/);
  // Every link stays on the site.
  for (const m of html.matchAll(/href="([^"]+)"/g)) assert.match(m[1], /^\//, m[1]);
});
