import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import {
  EMAIL_BRANDS,
  EMAIL_IMAGES,
  SITE_URL,
  THANK_YOU_PREHEADER,
  buildThankYouEmail,
  enquiryFromQuoteForm,
  enquirySummary,
  type QuoteEnquiry,
} from "@/lib/thank-you-email";
import { buildRawMessage, sendEmailVia } from "@/lib/gmail";
import { isPersonLoggedContact, isSystemNote } from "@/lib/activity-origin";

// The automatic thank-you email's content, without a database or a send:
// the exact wording, only the details given, the slots line, the images,
// the plain-text version, and the Gmail send taking its own HTML without
// the signature. Made-up details throughout.

const FULL: QuoteEnquiry = {
  firstName: "sarah",
  service: "Leaflet Distribution",
  targetAreas: "Ringwood, Ferndown and BH24.",
  quantity: "5,000 - 10,000",
  startDate: "2026-11-16",
  printingIncluded: "yes",
  designIncluded: null,
};
const SLOTS = { slotsRemaining: 5, monthLabel: "November" };

// The HTML as a reader sees it: tags gone, entities read, spaces collapsed.
function visible(html: string): string {
  return html
    .replace(/<head>[\s\S]*?<\/head>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;|&#847;|&zwnj;/g, " ")
    .replace(/&#9733;/g, "*")
    .replace(/\s+/g, " ")
    .trim();
}

const EXACT = [
  "Thanks for getting in touch about your leaflet campaign in Ringwood, Ferndown and BH24. Your enquiry has come straight through to our team, and you've come to the right place.",
  "If anything's changed, or you'd like to send your artwork before the call, just reply to this email.",
  "What happens next",
  "Dan will give you a call shortly to talk through your campaign. If he can't get hold of you, he'll drop you a text or an email so you can pick a time that suits.",
  "Before he calls, Dan will put together a quote from the details you've sent, so you're not left waiting. On the call, he'll take you through it, along with the best areas to target, timings and how our GPS tracking works.",
  "Why local businesses choose us",
  "We're a local company based in Ringwood, working across Hampshire and Dorset. Every campaign is delivered by our own local team and GPS tracked, and you receive a route report once delivery is complete, so you know your leaflets went where they should.",
  "5.0 on Google",
  '"Outstanding service! Great communication; reasonably priced; excellent job! I would highly recommend these guys."',
  "John Lofthouse, New Arts",
  "We're looking forward to helping you reach the right homes.",
  "Speak soon,",
  "Dan Whitby",
  "Co-Founder, Flyer Distribution Hampshire",
  "Flyer Distribution Hampshire",
  "11 Forest Reach, St Leonards, Ringwood, BH24 2NR",
  "flyerdistributionhampshire@gmail.com",
  "www.flyerdistributionhampshire.co.uk",
  "You're receiving this because you requested a quote on our website.",
];

test("subject, preview text and every line of the wording, in the HTML and the plain text", () => {
  const email = buildThankYouEmail(FULL, SLOTS);
  assert.equal(email.subject, "Congratulations Sarah, you've come to the right place");
  assert.equal(email.preheader, "Dan will be in touch shortly to talk through your campaign.");
  assert.equal(THANK_YOU_PREHEADER, email.preheader);
  const shown = visible(email.html);
  assert.ok(shown.startsWith(`${email.preheader}`), "the preview text comes first, hidden");
  assert.match(email.html, /<div style="display:none;max-height:0;[^"]*">Dan will be in touch shortly/);
  assert.ok(shown.includes("Hi Sarah,"));
  for (const line of EXACT) {
    assert.ok(shown.includes(line), `HTML: ${line}`);
    assert.ok(email.text.includes(line.replace(/^"|"$/g, "")), `text: ${line}`);
  }
  // Five stars and no review count.
  assert.match(email.html, /(&#9733;){5}/);
  assert.doesNotMatch(shown, /\breviews?\b/i);
  assert.ok(shown.indexOf("What happens next") < shown.indexOf("Why local businesses choose us"));
  assert.ok(shown.indexOf("John Lofthouse") < shown.indexOf("Brands we've worked with"));
  assert.ok(shown.indexOf("Brands we've worked with") < shown.indexOf("We have 5 campaign slots"));
  assert.ok(shown.indexOf("We have 5 campaign slots") < shown.indexOf("We're looking forward"));
});

test("no em or en dashes, no Sales Director, no prices and none of the barred phrases, whatever is sent", () => {
  const variants: QuoteEnquiry[] = [
    FULL,
    {},
    { firstName: "Jo", targetAreas: "BH1 \u2014 BH5", quantity: "Under 1,000" },
    { firstName: "Ann", service: "Screen Hire" },
  ];
  for (const enquiry of variants) {
    for (const slots of [SLOTS, { slotsRemaining: 1, monthLabel: "December" }, { slotsRemaining: 0, monthLabel: "January" }]) {
      const email = buildThankYouEmail(enquiry, slots);
      for (const [part, content] of Object.entries({ subject: email.subject, preheader: email.preheader, html: email.html, text: email.text })) {
        // A dash typed into the form is theirs; the email adds none of its own.
        const own = content.replace(/BH1 \u2014 BH5/g, "");
        assert.doesNotMatch(own, /[\u2013\u2014]/, `${part} has no em or en dash`);
        assert.doesNotMatch(content, /sales director/i, part);
        // No prices (the review's "reasonably priced" is its own words).
        assert.doesNotMatch(content, /£|\bGBP\b|\d\s?pounds|\bper (leaflet|1,?000)\b/i, part);
        assert.doesNotMatch(content, /live tracked|see where every flyer goes|\bstreets?\b/i, part);
      }
    }
  }
});

test("Your enquiry at a glance lists only what was given, and goes when nothing was", () => {
  assert.deepEqual(enquirySummary(FULL), [
    { label: "Areas", value: "Ringwood, Ferndown and BH24" },
    { label: "Leaflets", value: "5,000 - 10,000" },
    { label: "Start date", value: "16 November 2026" },
    { label: "Printing included", value: "Yes" },
    { label: "Design needed", value: "No" },
  ]);
  // Blank and missing fields are left out; the checkboxes only belong to the leaflet form.
  assert.deepEqual(enquirySummary({ service: "Screen Hire", targetAreas: "  ", quantity: "", startDate: null }), []);
  assert.deepEqual(enquirySummary({ quantity: "25,000+", startDate: "next spring" }), [
    { label: "Leaflets", value: "25,000+" },
    { label: "Start date", value: "next spring" },
  ]);
  // The form now sends the plain number; the email shows it with commas.
  for (const [sent, shown] of [["2000", "2,000"], ["150", "150"], ["1000000", "1,000,000"], ["12500", "12,500"]]) {
    assert.deepEqual(enquirySummary({ quantity: sent }), [{ label: "Leaflets", value: shown }], sent);
  }

  const some = buildThankYouEmail({ firstName: "Sam", quantity: "25,000+" }, SLOTS);
  const shown = visible(some.html);
  assert.ok(shown.includes("Your enquiry at a glance Leaflets 25,000+"));
  assert.doesNotMatch(shown, /Areas|Start date|Printing included|Design needed/);
  assert.ok(some.text.includes("Your enquiry at a glance\nLeaflets: 25,000+\n"));
  assert.match(some.html, /background:#f3f6fb/, "a shaded box");

  const none = buildThankYouEmail({ firstName: "Sam", service: "Web Design & SEO" }, SLOTS);
  assert.doesNotMatch(none.html, /Your enquiry at a glance/);
  assert.doesNotMatch(none.text, /at a glance/);
  assert.ok(visible(none.html).includes("If anything's changed"), "the reply line stays");
});

test("the target areas sentence with and without areas", () => {
  assert.ok(visible(buildThankYouEmail(FULL, SLOTS).html).includes("about your leaflet campaign in Ringwood, Ferndown and BH24. Your enquiry"));
  for (const areas of [null, "", "   "]) {
    const shown = visible(buildThankYouEmail({ ...FULL, targetAreas: areas }, SLOTS).html);
    assert.ok(shown.includes("Thanks for getting in touch about your leaflet campaign. Your enquiry has come straight through"), String(areas));
  }
});

test("the slots box: plural, singular at 1, and gone at 0", () => {
  const five = buildThankYouEmail(FULL, SLOTS);
  assert.match(five.html, /We have <strong>5<\/strong> campaign slots available for <strong>November<\/strong>, so it's well worth having that chat\./);
  assert.match(five.html, /background:#fff3c7;border-left:4px solid #fdc700;[^"]*"[\s\S]{0,120}color:#1c398e;/, "soft yellow, dark blue text");
  assert.ok(five.text.includes("We have 5 campaign slots available for November, so it's well worth having that chat."));

  const one = buildThankYouEmail(FULL, { slotsRemaining: 1, monthLabel: "December" });
  assert.match(one.html, /We have <strong>1<\/strong> campaign slot available for <strong>December<\/strong>/);
  assert.ok(one.text.includes("We have 1 campaign slot available for December,"));

  const none = buildThankYouEmail(FULL, { slotsRemaining: 0, monthLabel: "January" });
  assert.doesNotMatch(none.html, /campaign slot|#fff3c7/);
  assert.doesNotMatch(none.text, /campaign slot/);

  // The live figures come from lib/campaign-constants.ts through the existing wording helper.
  const source = readFileSync("lib/thank-you-email.ts", "utf8");
  assert.match(source, /import \{ slotNoun \} from "\.\/campaign-constants";/);
  assert.match(readFileSync("lib/quote-thank-you.ts", "utf8"), /params\.slots \?\? campaignSlots/);
});

test("the plain-text version reads on its own, with no HTML", () => {
  const { text } = buildThankYouEmail(FULL, SLOTS);
  assert.doesNotMatch(text, /<[a-z/][^>]*>|&[a-z]+;|&#\d+;/i);
  assert.ok(text.startsWith("Hi Sarah,\n\nThanks for getting in touch"));
  for (const heading of ["Your enquiry at a glance", "What happens next", "Why local businesses choose us", "Brands we've worked with"]) {
    assert.ok(text.includes(`\n${heading}\n`), heading);
  }
  assert.ok(text.includes(EMAIL_BRANDS.map((b) => b.name).join(", ")));
  assert.ok(text.endsWith("You're receiving this because you requested a quote on our website."));
});

test("anything typed is escaped, and a name can't add lines to the subject", () => {
  const email = buildThankYouEmail(
    { firstName: "Eve\r\nBcc: someone@example.com", targetAreas: '<script>alert("x")</script> & co', quantity: "<b>9</b>" },
    SLOTS
  );
  assert.doesNotMatch(email.subject, /[\r\n]/);
  assert.equal(email.subject, "Congratulations Eve Bcc: someone@example.com, you've come to the right place");
  assert.doesNotMatch(email.html, /<script>|<b>9<\/b>/);
  assert.ok(email.html.includes("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; co"));
  // A missing first name still reads properly.
  const anon = buildThankYouEmail({}, SLOTS);
  assert.equal(anon.subject, "Congratulations, you've come to the right place");
  assert.ok(anon.text.startsWith("Hi there,"));
});

test("the images: PNG copies hosted on the site, the white logo with white alt text, the brands with their names", async () => {
  const { html } = buildThankYouEmail(FULL, SLOTS);
  const images = [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
  assert.equal(images.length, 2);
  for (const img of images) assert.match(img, new RegExp(`src="${SITE_URL.replace(/\./g, "\\.")}/email/[a-z-]+\\.png"`));
  assert.match(images[0], /alt="Flyer Distribution Hampshire"/);
  assert.match(images[0], /width="190"/);
  assert.match(images[0], /color:#ffffff;/, "readable when images are blocked");
  assert.match(html, /bgcolor="#162456" style="background:#162456;/, "the site's dark blue");
  const names = EMAIL_BRANDS.map((b) => b.name);
  assert.ok(names.includes("Kola Construction"));
  assert.ok(images[1].includes(`alt="Brands we&#39;ve worked with: ${names.join(", ").replace(/'/g, "&#39;")}"`));

  // The files exist, as PNG, at twice the size they're shown.
  for (const image of Object.values(EMAIL_IMAGES)) {
    const meta = await sharp(`public${image.path}`).metadata();
    assert.equal(meta.format, "png", image.path);
    assert.equal(meta.width, image.width * 2, image.path);
  }
  // The CRM preview uses this site's copies.
  assert.match(buildThankYouEmail(FULL, SLOTS, "").html, /src="\/email\/fdh-logo-white\.png"/);
});

test("the email's brands are the brands bar's, in the same order", () => {
  const bar = readFileSync("components/BrandsBar.tsx", "utf8");
  const listed = [...bar.matchAll(/\{ name: "([^"]+)", file: "([^"]+)"/g)].map((m) => ({ name: m[1], file: m[2] }));
  assert.deepEqual(EMAIL_BRANDS, listed);
});

test("600px, table-based, inline styles, and it stacks on phones", () => {
  const { html } = buildThankYouEmail(FULL, SLOTS);
  assert.match(html, /<table role="presentation" class="card" width="600"[^>]*style="width:600px;max-width:600px;/);
  assert.match(html, /<!--\[if mso\]><table role="presentation" width="600"/);
  assert.match(html, /@media only screen and \(max-width: 620px\)/);
  assert.doesNotMatch(html, /<(div|p|td)\b[^>]*class="(?!px|card|outer)/, "styles are inline, not classes");
});

test("the form's fields as the email reads them", () => {
  assert.deepEqual(
    enquiryFromQuoteForm({
      "first-name": "Sarah",
      "last-name": "Example",
      service: "Leaflet Distribution",
      "areas-required": "BH24",
      quantity: "1,000 - 5,000",
      "campaign-start-date": "2026-12-01",
      "printing-included": "yes",
      message: "Hi",
    }),
    { firstName: "Sarah", service: "Leaflet Distribution", targetAreas: "BH24", quantity: "1,000 - 5,000", startDate: "2026-12-01", printingIncluded: "yes", designIncluded: null }
  );
});

test("Gmail: a designed email goes with its own HTML and its text version, and without the signature", async () => {
  const email = buildThankYouEmail(FULL, SLOTS);
  const raw = Buffer.from(
    buildRawMessage({ from: "a@example.com", to: "b@example.com", subject: email.subject, body: email.text, html: email.html, signatureHtml: "<b>Sig</b>", boundary: "B" }),
    "base64url"
  ).toString("utf8");
  const [, plainPart, htmlPart] = raw.split("--B");
  const decode = (part: string) => part.split("\r\n\r\n").slice(1).join("\r\n\r\n").replace(/=\r\n/g, "").replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  assert.match(plainPart, /Content-Type: text\/plain/);
  assert.ok(Buffer.from(decode(plainPart), "latin1").toString("utf8").startsWith("Hi Sarah,"));
  assert.match(htmlPart, /Content-Type: text\/html/);
  assert.ok(Buffer.from(decode(htmlPart), "latin1").toString("utf8").includes('<table role="presentation" class="card" width="600"'));
  assert.doesNotMatch(raw, /gmail_signature|Sig/);

  // The send never even looks up the signature.
  let looked = 0;
  const sent: string[] = [];
  const result = await sendEmailVia(
    {
      async send(body) {
        sent.push(body.raw);
        return { id: "m1", threadId: "t1" };
      },
      async listSendAs() {
        looked++;
        return [{ sendAsEmail: "a@example.com", signature: "<b>Sig</b>" }];
      },
    },
    "a@example.com",
    { to: "b@example.com", subject: email.subject, body: email.text, html: email.html }
  );
  assert.ok(result.ok);
  assert.equal(looked, 0);
  assert.equal(sent.length, 1);
});

test("the note it leaves is the CRM's own and never counts as contact", () => {
  assert.equal(isSystemNote("Automatic thank-you email sent"), true);
  assert.equal(isPersonLoggedContact({ type: "NOTE", detail: "Automatic thank-you email sent", userId: null }), false);
  // Even if a user were ever attached, its wording marks it as the CRM's.
  assert.equal(isPersonLoggedContact({ type: "NOTE", detail: "Automatic thank-you email sent", userId: "u1" }), false);
});
