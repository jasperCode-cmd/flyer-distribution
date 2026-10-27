import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { QUOTE_SERVICES, serviceFromParam } from "@/lib/quote-services";
import { THANK_YOU_NOTE, sendQuoteThankYou } from "@/lib/quote-thank-you";
import { enquiryFromQuoteForm } from "@/lib/thank-you-email";
import type { SendEmailParams } from "@/lib/gmail";

// The quote form's start: three service cards, then the contact details,
// then the chosen service's questions once the contact number has 10 digits.
// The service values it sends, the ?service= words links use, the start
// state as it renders (no fields until a card is chosen), and the
// form keeping what it sends as it was: the service sent where the dropdown
// was, Company first after the service heading, each service's fields in
// their old order, and the print and design Yes/No sending what the ticked
// boxes did. What it sends, field by field, is also compared against the old
// form in a browser.

const form = readFileSync("components/QuoteForm.tsx", "utf8");
const between = (from: string, to: string) => {
  const start = form.indexOf(from);
  assert.ok(start >= 0, from);
  const end = form.indexOf(to, start);
  assert.ok(end > start, to);
  return form.slice(start, end);
};
const namesIn = (source: string) => [...source.matchAll(/\bname="([^"]+)"/g)].map((m) => m[1]);

test("the three services send the words the old dropdown sent, with the cards' copy", () => {
  assert.deepEqual(
    QUOTE_SERVICES.map((s) => [s.value, s.param, s.title, s.line, s.heading]),
    [
      ["Leaflet Distribution", "leaflet", "Leaflet Distribution", "Door to door, GPS tracked", "About your campaign"],
      ["Web Design & SEO", "web", "Web Design & SEO", "A site that brings in enquiries", "About your business"],
      ["Screen Hire", "screen", "Screen Hire", "Mobile screen trailer for events", "About your event"],
    ]
  );
  // /api/quote-lead checks the leaflet value word for word.
  assert.match(readFileSync("app/api/quote-lead/route.ts", "utf8"), /data\.service === "Leaflet Distribution"/);
});

test("a link chooses a service with ?service=leaflet, web or screen, and nothing else does", () => {
  assert.equal(serviceFromParam("leaflet"), "Leaflet Distribution");
  assert.equal(serviceFromParam("web"), "Web Design & SEO");
  assert.equal(serviceFromParam("screen"), "Screen Hire");
  assert.equal(serviceFromParam(" Web "), "Web Design & SEO");
  for (const other of [null, undefined, "", "leaflets", "Leaflet Distribution", "flyers", "web-design"]) {
    assert.equal(serviceFromParam(other), "", String(other));
  }
  // Read from the address when the form loads.
  assert.match(form, /serviceFromParam\(new URLSearchParams\(window\.location\.search\)\.get\("service"\)\)/);
});

test("before a card is chosen: the heading, the three cards and the hint, and no fields", () => {
  const run = spawnSync(process.execPath, ["--import", "tsx", "lib/__tests__/render-quote-form.ts"], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  const html = run.stdout;
  assert.match(html, /<h2[^>]*>Get Your Free Quote<\/h2>/);
  assert.ok(html.includes("Free, with no obligation. We&#x27;ll be in touch within 24 hours."));
  assert.match(html, /<legend[^>]*>What do you need\?<\/legend>/);
  const radios = [...html.matchAll(/<input type="radio"[^>]*\bname="quote-service" value="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(radios, ["Leaflet Distribution", "Web Design &amp; SEO", "Screen Hire"]);
  assert.doesNotMatch(html, /checked=""/, "none chosen yet");
  for (const s of QUOTE_SERVICES) assert.ok(html.includes(s.line), s.line);
  assert.ok(html.includes("Choose a service to see the right questions for you."));
  // No form, and no other control of any kind.
  assert.doesNotMatch(html, /<form/);
  assert.equal((html.match(/<(input|select|textarea|button)\b/g) ?? []).length, 3);
});

test("the cards are one keyboard-reachable choice outside the form, and the dropdown is gone", () => {
  const cards = between("<fieldset", "</fieldset>");
  assert.match(cards, /type="radio"\s+name="quote-service"/);
  assert.match(cards, /className="sr-only"/);
  assert.match(cards, /has-\[:focus-visible\]:ring-2/, "a visible focus ring on the card");
  assert.match(cards, /border-blue-700 bg-blue-50 shadow-/, "chosen: blue border, light blue, a glow");
  assert.match(cards, /border-gray-200 bg-white/, "not chosen: a light grey border");
  // The form only exists once a card is chosen, and starts after the cards.
  assert.ok(form.indexOf("</fieldset>") < form.indexOf("<form "));
  assert.match(form, /\{serviceType && \(\s*<form ref=\{formRef\} className="quote-fold-in /);
  assert.doesNotMatch(form, /<select\s+id="service"/);
  assert.ok(!form.includes("Select a service..."));
});

test("the details come first, then the service heading, Company, and the service where the dropdown was", () => {
  const order = [
    ">Your details</h3>",
    'name="first-name"',
    'name="last-name"',
    'name="email"',
    'name="phone"',
    "?.heading}",
    'name="company"',
    '<input type="hidden" name="service" value={serviceType} />',
    "{isLeaflet && (",
    'name="newsletter"',
    "Send Quote Request",
  ];
  const at = order.map((piece) => form.indexOf(piece));
  for (const [i, piece] of order.entries()) assert.ok(at[i] > 0, piece);
  assert.deepEqual([...at].sort((a, b) => a - b), at, "in this order");
  // Nothing else named between Company and the service.
  assert.deepEqual(namesIn(between('name="company"', "{isLeaflet && (")), ["company", "service"]);
  // First name, email and phone are required; last name and company are optional.
  for (const name of ["first-name", "email", "phone"]) {
    assert.match(form, new RegExp(`name="${name}"\\s+required`), name);
  }
  for (const name of ["last-name", "company"]) assert.doesNotMatch(form, new RegExp(`name="${name}"\\s+required`), name);
  // Only the required ones carry an asterisk.
  assert.match(form, /First name <span className="text-red-500">\*<\/span>/);
  assert.match(form, /htmlFor="last-name"[^>]*>\s*Last name\s*<\/label>/);
});

test("each service shows its own fields after Company, in their old order", () => {
  assert.deepEqual(namesIn(between("{isLeaflet && (", "{isWebDesign && (")), [
    "areas-required",
    "quantity",
    "campaign-start-date",
    "printing-included",
    "item-size",
    "print-sides",
    "print-sides",
    "include-design",
    "budget",
    "message",
  ]);
  assert.deepEqual(namesIn(between("{isWebDesign && (", "{isScreenHire && (")), ["business-type", "budget", "message"]);
  assert.deepEqual(namesIn(between("{isScreenHire && (", "{/* Newsletter opt-in */}")), [
    "event-date",
    "event-location",
    "event-duration",
    "message",
  ]);
});

test("print and design: Yes sends \"yes\" as the ticked boxes did, No sends nothing, and both start on No", () => {
  // Print starts on No, so the size and sides stay hidden until Yes is chosen.
  assert.match(form, /const \[includePrinting, setIncludePrinting\] = useState\(false\);/);
  assert.match(form, /const \[includeDesign, setIncludeDesign\] = useState\(false\);/);
  // And back to No after a quote is sent.
  assert.match(form, /formRef\.current\?\.reset\(\);\s*changeService\(""\);\s*setIncludePrinting\(false\);\s*setIncludeDesign\(false\);/);
  assert.doesNotMatch(form, /type="checkbox"\s+id="(printing-included|include-design)"/, "the tick boxes are gone");
  // Print Yes folds out the size and sides, with the field it used to send first.
  assert.match(
    form,
    /\{includePrinting && \(\s*<div className="mt-3 space-y-3">\s*<input type="hidden" name="printing-included" value="yes" \/>\s*<div>\s*<label\s+htmlFor="item-size"/
  );
  assert.match(form, /\{includeDesign && <input type="hidden" name="include-design" value="yes" \/>\}/);
  assert.match(form, /question="Would you like us to print\?"\s+value=\{includePrinting\}/);
  assert.match(form, /question="Would you like us to design it\?"\s+value=\{includeDesign\}/);
  // The pills are buttons that say which is pressed, and are never sent themselves.
  const pills = between("function YesNo(", "\n}\n");
  assert.match(pills, /role="group" aria-labelledby=\{id\}/);
  assert.match(pills, /type="button"\s+aria-pressed=\{value === answer\}/);
  assert.doesNotMatch(pills, /\bname=/);
  assert.match(pills, /focus-visible:ring-2/);
});

test("the service's questions stay hidden until the contact number has 10 digits, with a hint until then", () => {
  assert.match(form, /const PHONE_DIGITS_TO_CONTINUE = 10;/);
  // Checked as they type: the number's digits, whatever spaces or + are typed with them.
  const phone = between('name="phone"', "</div>");
  assert.match(phone, /onChange=\{\(e\) => \{[\s\S]*?e\.target\.value\.replace\(\/\\D\/g, ""\)\.length >= PHONE_DIGITS_TO_CONTINUE[\s\S]*?setShowQuestions\(true\);/);
  assert.doesNotMatch(phone, /onBlur/);
  // The hint, in the grey helper style, tied to the field until the questions show.
  assert.match(
    phone,
    /\{!showQuestions && \(\s*<p id="phone-hint" className="mt-1\.5 text-xs text-gray-500">\s*Enter your number to continue\s*<\/p>\s*\)\}/
  );
  assert.match(phone, /aria-describedby=\{showQuestions \? undefined : "phone-hint"\}/);
  // Everything after the number folds in together: the service's heading,
  // Company, its fields, the newsletter box and the send button.
  const questions = between('{showQuestions && (\n            <div className="quote-fold-in space-y-5">', "        </form>");
  for (const piece of ["?.heading}", 'name="company"', 'name="service"', "{isLeaflet && (", "{isWebDesign && (", "{isScreenHire && (", 'name="newsletter"', 'type="submit"', "Send Quote Request"]) {
    assert.ok(questions.includes(piece), piece);
  }
  // The details come before it and are always there once a card is chosen.
  const details = between('<form ref={formRef}', '{showQuestions && (\n            <div className="quote-fold-in');
  assert.deepEqual(namesIn(details), ["access_key", "subject", "first-name", "last-name", "email", "phone"]);
});

test("once shown, the service's questions stay for the visit, through number edits and service changes", () => {
  // Only ever switched on, so editing or clearing the number, or choosing
  // another card, never hides what was typed.
  assert.deepEqual(form.match(/setShowQuestions\([^)]*\)/g), ["setShowQuestions(true)"]);
  assert.match(form, /const \[showQuestions, setShowQuestions\] = useState\(false\);/);
  const change = between("function changeService(", "\n  }\n");
  assert.ok(!change.includes("showQuestions"), "choosing another card leaves it as it is");
});

test("switching service keeps the details and sends only the shown service's fields", () => {
  // Each service's fields are only rendered while it is chosen, so nothing
  // of another service is in the form when it is sent.
  assert.match(form, /const isLeaflet = serviceType === "Leaflet Distribution";/);
  assert.match(form, /const isWebDesign = serviceType === "Web Design & SEO";/);
  assert.match(form, /const isScreenHire = serviceType === "Screen Hire";/);
  // The details and Company sit outside those parts, so they stay as typed.
  const leafletAndAfter = form.slice(form.indexOf("{isLeaflet && ("));
  for (const name of ["first-name", "last-name", "email", "phone", "company"]) {
    assert.ok(!leafletAndAfter.includes(`name="${name}"`), name);
  }
  // What is sent is still the form as it stands, to both places.
  assert.match(form, /const data = Object\.fromEntries\(formData\);/);
  assert.match(form, /fetch\("https:\/\/api\.web3forms\.com\/submit", \{[\s\S]*?body: JSON\.stringify\(data\),/);
  assert.match(form, /fetch\("\/api\/quote-lead", \{[\s\S]*?body: JSON\.stringify\(data\),/);
});

test("the services pages' quote links choose their service; every other quote link is unchanged", () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.tsx?$/.test(entry)) files.push(path);
    }
  };
  walk("app");
  walk("components");
  const chosen: Record<string, string[]> = {};
  for (const file of files) {
    const links = [...readFileSync(file, "utf8").matchAll(/href="(\/quote\?[^"]*)"/g)].map((m) => m[1]);
    if (links.length) chosen[file] = links;
  }
  assert.deepEqual(chosen, {
    // The areas overview's closing band asks about leaflets too.
    [join("app", "areas", "page.tsx")]: ["/quote?service=leaflet"],
    [join("app", "services", "page.tsx")]: ["/quote?service=leaflet", "/quote?service=leaflet"],
    [join("app", "services", "screen-hire", "page.tsx")]: ["/quote?service=screen"],
    [join("app", "services", "web-design-seo", "page.tsx")]: ["/quote?service=web", "/quote?service=web", "/quote?service=web"],
  });
  // Including both "Book a Free Call" buttons.
  const web = readFileSync("app/services/web-design-seo/page.tsx", "utf8");
  assert.equal((web.match(/href="\/quote\?service=web"[^>]*>\s*Book a Free Call/g) ?? []).length, 2);
});

test("the questions fold out over 0.35s, and appear at once with reduced motion", () => {
  const css = readFileSync("app/globals.css", "utf8");
  assert.match(css, /@keyframes quote-fold-in \{\s*from \{ opacity: 0; transform: translateY\(10px\); \}\s*to\s+\{ opacity: 1; transform: none; \}\s*\}/);
  assert.match(css, /\.quote-fold-in \{\s*animation: quote-fold-in 0\.35s ease-out;\s*\}/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.quote-fold-in \{\s*animation: none;\s*\}\s*\}/);
});

// --- A blank last name, against a throwaway local database -----------------------------
// /api/quote-lead and the thank-you email with Last name left empty. These
// need a throwaway local database (CRM_TEST_DATABASE_URL on localhost) and
// are skipped otherwise. No Gmail is set up, so the route's own thank-you
// attempt can't send; the email is then sent to a fake. Made-up details.

const url = process.env.CRM_TEST_DATABASE_URL ?? "";
let host = "";
try {
  host = url ? new URL(url).hostname : "";
} catch {
  host = "";
}
const skip = !["localhost", "127.0.0.1", "::1", "[::1]"].includes(host)
  ? "set CRM_TEST_DATABASE_URL to a local throwaway database to run"
  : false;

const DOMAIN = "@quote-form-test.example";
let prisma: PrismaClient;
let POST: (req: Request) => Promise<Response>;

before(async () => {
  if (skip) return;
  prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  await prisma.lead.deleteMany({ where: { email: { endsWith: DOMAIN } } });
  // The route's own client on the throwaway database, and no Gmail at all.
  process.env.DATABASE_URL = url;
  for (const name of ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GMAIL_REFRESH_TOKEN", "GMAIL_SENDER_ADDRESS"]) delete process.env[name];
  ({ POST } = await import("@/app/api/quote-lead/route"));
});

after(async () => {
  if (skip) return;
  await prisma.lead.deleteMany({ where: { email: { endsWith: DOMAIN } } });
  await prisma.$disconnect();
});

test("real database: a blank last name is saved under the first name, and the thank-you still greets them", { skip }, async () => {
  for (const [i, lastName] of ["", "   "].entries()) {
    const email = `blank${i}${DOMAIN}`;
    // What the form sends for a leaflet enquiry with Last name left empty.
    const fields = {
      "first-name": "Bea",
      "last-name": lastName,
      email,
      phone: "07700 900123",
      company: "",
      service: "Leaflet Distribution",
      "areas-required": "SO15",
      quantity: "2000",
      "campaign-start-date": "",
      "printing-included": "yes",
      "item-size": "A5",
      "print-sides": "Single sided",
      budget: "Under £300",
      message: "",
    };
    const original = console.error;
    console.error = () => {};
    let res: Response;
    try {
      res = await POST(new Request("http://localhost/api/quote-lead", { method: "POST", body: JSON.stringify(fields) }));
      // Let the route's own thank-you attempt finish: with no Gmail it fails and takes its note off.
      for (let wait = 0; wait < 30 && (await prisma.activity.count({ where: { detail: THANK_YOU_NOTE, lead: { email } } })); wait++) {
        await new Promise((r) => setTimeout(r, 100));
      }
      await new Promise((r) => setTimeout(r, 200));
    } finally {
      console.error = original;
    }
    assert.equal(res.status, 201, JSON.stringify(lastName));
    const lead = await prisma.lead.findFirst({
      where: { email },
      select: { id: true, name: true, email: true, business: true, leafletQuantity: true, printingIncluded: true, source: true },
    });
    assert.ok(lead, "the lead is saved");
    assert.equal(lead.name, "Bea", "the first name alone, with no trailing space");
    assert.equal(lead.business, "FDH");
    assert.equal(lead.source, "WEBSITE_QUOTE_FORM");
    assert.equal(lead.leafletQuantity, "2000");
    assert.equal(lead.printingIncluded, true);

    // The thank-you email goes by the first name only.
    const sent: SendEmailParams[] = [];
    const outcome = await sendQuoteThankYou({
      db: prisma,
      lead,
      enquiry: enquiryFromQuoteForm(fields),
      send: async (params) => {
        sent.push(params);
        return { ok: true, data: { messageId: "m", threadId: "t", signature: "none" } };
      },
    });
    assert.equal(outcome, "sent");
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to, email);
    assert.ok(sent[0].body.includes("Hi Bea,"), "plain text greets them by first name");
    assert.ok(sent[0].html?.includes("Hi Bea,"), "HTML greets them by first name");
    assert.doesNotMatch(`${sent[0].subject} ${sent[0].body} ${sent[0].html}`, /undefined|null|Bea {2}|Bea ,/);
  }
});

test("real database: a blank first name is still refused, as before", { skip }, async () => {
  const res = await POST(
    new Request("http://localhost/api/quote-lead", {
      method: "POST",
      body: JSON.stringify({ "first-name": "", "last-name": "", email: `nobody${DOMAIN}`, service: "Web Design & SEO", budget: "Under £500" }),
    })
  );
  assert.equal(res.status, 400);
  assert.equal(await prisma.lead.count({ where: { email: `nobody${DOMAIN}` } }), 0);
});
