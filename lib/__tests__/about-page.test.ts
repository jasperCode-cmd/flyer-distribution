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

test("the sections come in order: hero, photo and panel, founders, promises, services, next steps", () => {
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
    at(">Our Services</h2>"),
    at(">Planning a campaign?</h3>"),
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

test("Our Services is kept, under the promises", () => {
  const html = render().html;
  const services = html.slice(html.indexOf(">Our Services</h2>"), html.indexOf(">Planning a campaign?</h3>"));
  assert.deepEqual(
    [...services.matchAll(/<a[^>]*href="([^"]+)"[^>]*><h3[^>]*>([^<]*)<\/h3>/g)].map((m) => [decode(m[2]), m[1]]),
    [
      ["Leaflet Services", "/services"],
      ["Web Design & SEO", "/services/web-design-seo"],
      ["Screen Hire", "/services/screen-hire"],
    ]
  );
});

test("the page ends with three next-step cards", () => {
  const html = render().html;
  const end = html.slice(html.indexOf(">Next steps</h2>"));
  assert.deepEqual(
    [...end.matchAll(/<a[^>]*href="([^"]+)"[^>]*><h3[^>]*>([^<]*)<\/h3><p[^>]*>([^<]*)<\/p>/g)].map((m) => [decode(m[2]), decode(m[3]), decode(m[1])]),
    [
      ["Planning a campaign?", "Get a free quote within 24 hours", "/quote?service=leaflet"],
      ["Want to see our work?", "Real campaigns, with the areas we covered", "/case-studies"],
      ["Want to join the team?", "Flexible, local leaflet delivery work", "/leaflet-distribution-jobs"],
    ]
  );
  // Nothing after them.
  assert.equal(html.indexOf("<section", html.indexOf(">Next steps</h2>")), -1);
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
