import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { DISTRIBUTION_TYPES, QUOTE_SERVICES, distributionTypeFromParam, serviceFromParam } from "@/lib/quote-services";
import { THANK_YOU_NOTE, sendQuoteThankYou } from "@/lib/quote-thank-you";
import { enquiryFromQuoteForm } from "@/lib/thank-you-email";
import type { SendEmailParams } from "@/lib/gmail";

// The quote form's start: four service cards, then the contact details,
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
// The leaflet fields after Company: the areas and the quantity, then the
// rest of them once a quantity is chosen.
const LEAFLET_FIELDS = "{/* \u2500\u2500 Leaflet Distribution fields \u2500\u2500 */}\n                  {isLeaflet && (";
const LEAFLET_AFTER_QUANTITY = "{/* \u2500\u2500 Leaflet Distribution, after the quantity \u2500\u2500 */}\n                  {isLeaflet && (";
const PRINTING_FIELDS = "{/* \u2500\u2500 Leaflet Printing fields \u2500\u2500 */}";
const PRINTING_AFTER_QUANTITY = "{/* \u2500\u2500 Leaflet Printing, after the quantity \u2500\u2500 */}";
const WEB_FIELDS = "{/* \u2500\u2500 Web Design & SEO fields \u2500\u2500 */}";

test("the four services send the words the old dropdown sent (and Leaflet Printing its own), with the cards' copy", () => {
  assert.deepEqual(
    QUOTE_SERVICES.map((s) => [s.value, s.param, s.title, s.line, s.heading]),
    [
      ["Leaflet Distribution", "leaflet", "Leaflet Distribution", "Door to door, GPS tracked. We can design and print it too.", "About your campaign"],
      ["Leaflet Printing", "printing", "Leaflet Printing", "Printed and sent to you", "About your print job"],
      ["Web Design & SEO", "web", "Web Design & SEO", "A site that brings in enquiries", "About your business"],
      ["Screen Hire", "screen", "Screen Hire", "Mobile screen trailer for events", "About your event"],
    ]
  );
  // /api/quote-lead checks the leaflet and printing values word for word.
  const route = readFileSync("app/api/quote-lead/route.ts", "utf8");
  assert.match(route, /data\.service === "Leaflet Distribution"/);
  assert.match(route, /data\.service === "Leaflet Printing"/);
});

test("a link chooses a service with ?service=leaflet, printing, web or screen, or Leaflet Distribution and its kind, and nothing else does", () => {
  assert.equal(serviceFromParam("leaflet"), "Leaflet Distribution");
  assert.equal(serviceFromParam("printing"), "Leaflet Printing");
  assert.equal(serviceFromParam("web"), "Web Design & SEO");
  assert.equal(serviceFromParam("screen"), "Screen Hire");
  assert.equal(serviceFromParam(" Web "), "Web Design & SEO");
  // The kinds of leaflet distribution choose Leaflet Distribution, and their kind.
  for (const [param, kind] of [
    ["public-notice", "Public notice leafleting"],
    ["hand-to-hand", "Hand-to-hand"],
    ["b2b", "B2B"],
    [" B2B ", "B2B"],
  ]) {
    assert.equal(serviceFromParam(param), "Leaflet Distribution", param);
    assert.equal(distributionTypeFromParam(param), kind, param);
  }
  // Door to door is the default, with no word of its own.
  assert.deepEqual(DISTRIBUTION_TYPES.map((t) => [t.value, t.param]), [
    ["Door to door", null],
    ["Public notice leafleting", "public-notice"],
    ["Hand-to-hand", "hand-to-hand"],
    ["B2B", "b2b"],
  ]);
  for (const param of ["leaflet", "printing", "web", "screen"]) assert.equal(distributionTypeFromParam(param), "", param);
  for (const other of [null, undefined, "", "leaflets", "Leaflet Distribution", "flyers", "web-design", "print", "public notice", "door to door", "null"]) {
    assert.equal(serviceFromParam(other), "", String(other));
    assert.equal(distributionTypeFromParam(other), "", String(other));
  }
  // Read from the address when the form loads.
  assert.match(form, /const params = new URLSearchParams\(window\.location\.search\);\s+const param = params\.get\("service"\);\s+const chosen = serviceFromParam\(param\);\s+if \(chosen\) setServiceType\(chosen\);\s+const kind = distributionTypeFromParam\(param\);\s+if \(kind\) setDistributionType\(kind\);/);
});

test("before a card is chosen: the heading, the four cards and the hint, and no fields", () => {
  const run = spawnSync(process.execPath, ["--import", "tsx", "lib/__tests__/render-quote-form.ts"], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  const html = run.stdout;
  assert.match(html, /<h2[^>]*>Get Your Free Quote<\/h2>/);
  assert.ok(html.includes("Free, with no obligation. We&#x27;ll be in touch within 24 hours."));
  assert.match(html, /<legend[^>]*>What do you need\?<\/legend>/);
  const radios = [...html.matchAll(/<input type="radio"[^>]*\bname="quote-service" value="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(radios, ["Leaflet Distribution", "Leaflet Printing", "Web Design &amp; SEO", "Screen Hire"]);
  assert.doesNotMatch(html, /checked=""/, "none chosen yet");
  for (const s of QUOTE_SERVICES) assert.ok(html.includes(s.line), s.line);
  assert.ok(html.includes("Choose a service to see the right questions for you."));
  // No form, and no other control of any kind.
  assert.doesNotMatch(html, /<form/);
  assert.equal((html.match(/<(input|select|textarea|button)\b/g) ?? []).length, 4);
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

test("Leaflet Distribution leads: full width and larger, light blue until chosen, then navy; the other three in a row, as before", () => {
  const cards = between("<fieldset", "</fieldset>");
  // Leaflet Distribution full width on top; the other three in an equal row under it, one column on phones.
  assert.match(cards, /<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">/);
  assert.deepEqual(QUOTE_SERVICES.map((s) => s.param), ["leaflet", "printing", "web", "screen"]);
  assert.match(cards, /const featured = s\.param === "leaflet";/);
  assert.match(cards, /\? `sm:col-span-3 grid grid-cols-\[auto_minmax\(0,1fr\)\] sm:grid-cols-\[auto_minmax\(0,1fr\)_auto\] [^`]*p-5 sm:px-7 sm:py-7 border-\[#1e3a8a\] /);
  // Not chosen: light blue with the 2px navy border. Chosen: navy, a 3px yellow ring and a soft shadow.
  assert.match(cards, /: "bg-\[#eff6ff\] hover:bg-\[#dbeafe\]"/);
  assert.match(cards, /\? "bg-\[#1e3a8a\] ring-\[3px\] ring-\[#facc15\] shadow-\[0_12px_28px_-10px_rgba\(30,58,138,0\.65\)\]"/);
  assert.match(cards, /rounded-xl border-2 cursor-pointer/);
  // Focus shows yellow, set off from the card.
  assert.match(cards, /has-\[:focus-visible\]:ring-\[3px\] has-\[:focus-visible\]:ring-\[#facc15\] has-\[:focus-visible\]:ring-offset-2 has-\[:focus-visible\]:ring-offset-white/);
  // Navy title and icon until chosen, then white and yellow; the larger paper plane on the left.
  assert.match(cards, /const dark = featured && chosen;/);
  assert.match(cards, /featured \? `text-xl sm:text-2xl \$\{dark \? "text-white" : "text-\[#1e3a8a\]"\}` : "text-gray-900"/);
  assert.match(cards, /featured \? `text-sm sm:text-base \$\{dark \? "text-\[#dbeafe\]" : "text-gray-700"\}` : "text-sm text-gray-600"/);
  assert.match(cards, /featured \? `h-10 w-10 \$\{dark \? "text-\[#facc15\]" : "text-\[#1e3a8a\]"\}` : `h-7 w-7 \$\{chosen \? "text-blue-700" : "text-gray-500"\}`/);
  // "Start here" becomes "Selected", seen but not read out: the radio already says it.
  assert.match(cards, /<span\s+aria-hidden="true"\s+className=\{`[^`]*\$\{dark \? "text-\[#facc15\]" : "text-\[#1e3a8a\]"\}`\}\s+>\s+\{chosen \? \(\s+<>\s+Selected/);
  assert.match(cards, /\) : \(\s+<>\s+Start here/);
  // The other three keep the old look: white, a light border, blue and light blue when chosen.
  assert.match(cards, /"border-blue-700 bg-blue-50 shadow-\[0_0_0_4px_rgba\(29,78,216,0\.12\),0_8px_20px_-6px_rgba\(29,78,216,0\.35\)\]"/);
  assert.match(cards, /"border-gray-200 bg-white hover:border-gray-300"/);
  assert.match(cards, /has-\[:focus-visible\]:ring-2 has-\[:focus-visible\]:ring-blue-500 has-\[:focus-visible\]:ring-offset-2/);

  // As first shown: the badge and "Start here" on the leaflet card only, and
  // the badge read as part of its description.
  const run = spawnSync(process.execPath, ["--import", "tsx", "lib/__tests__/render-quote-form.ts"], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  const labels = [...run.stdout.matchAll(/<label class="([^"]*)">([\s\S]*?)<\/label>/g)];
  assert.equal(labels.length, 4);
  const [leaflet, printing, web, screen] = labels;
  assert.match(leaflet[1], /sm:col-span-3 /);
  assert.match(leaflet[1], /border-\[#1e3a8a\] .*bg-\[#eff6ff\]/);
  assert.doesNotMatch(leaflet[1], /bg-\[#1e3a8a\]/);
  assert.match(leaflet[2], /aria-describedby="quote-service-leaflet-line quote-service-leaflet-badge"/);
  assert.match(leaflet[2], /<span id="quote-service-leaflet-badge"[^>]*>Most popular<\/span>/);
  assert.match(leaflet[2], /<span aria-hidden="true"[^>]*>Start here<svg/);
  for (const card of [printing, web, screen]) {
    assert.match(card[1], /border-gray-200 bg-white/);
    assert.doesNotMatch(card[2], /Most popular|Start here|Selected/);
    assert.match(card[2], /aria-describedby="quote-service-(printing|web|screen)-line"/);
  }
  assert.ok(printing[2].includes("Printed and sent to you"));
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
    LEAFLET_FIELDS,
    'name="areas-required"',
    'name="quantity"',
    LEAFLET_AFTER_QUANTITY,
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
  // The leaflet fields: the kind (new), the areas and quantity first, and the rest after, in their old order.
  assert.deepEqual(namesIn(between(LEAFLET_FIELDS, PRINTING_FIELDS)), ["distribution-type", "areas-required", "quantity"]);
  assert.deepEqual(namesIn(between(LEAFLET_AFTER_QUANTITY, PRINTING_AFTER_QUANTITY)), [
    "printing-included",
    "item-size",
    "print-sides",
    "print-sides",
    "include-design",
    "budget",
    "message",
  ]);
  // Leaflet Printing: what to print and the quantity first, the rest after.
  // (print-spec only when the print builder's link carried one.)
  assert.deepEqual(namesIn(between(PRINTING_FIELDS, "{/* The rest of the section.")), ["print-spec", "print-items", "print-quantity"]);
  assert.deepEqual(namesIn(between(PRINTING_AFTER_QUANTITY, WEB_FIELDS)), [
    "print-size",
    "print-sides",
    "print-sides",
    "print-design",
    "print-send-to",
    "also-deliver",
    "print-delivery-areas",
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
  assert.match(form, /formRef\.current\?\.reset\(\);\s*setServiceType\(""\);\s*setIncludePrinting\(false\);\s*setIncludeDesign\(false\);/);
  assert.doesNotMatch(form, /type="checkbox"\s+id="(printing-included|include-design)"/, "the tick boxes are gone");
  // Print Yes folds out the size and sides, full width under both questions,
  // with the field it used to send first; the design field comes after them,
  // so the fields are sent in the same order as before.
  assert.match(
    form,
    /\{includePrinting && \(\s*<div className="mt-2 space-y-3 border border-gray-200 rounded-md px-4 py-3 bg-gray-50">\s*<input type="hidden" name="printing-included" value="yes" \/>\s*<div>\s*<label\s+htmlFor="item-size"/
  );
  assert.match(form, /<\/div>\s*\)\}\s*\{includeDesign && <input type="hidden" name="include-design" value="yes" \/>\}\s*<\/div>/);
  assert.match(form, /question="Would you like us to print\?"\s+value=\{includePrinting\}/);
  assert.match(form, /question="Would you like us to design it\?"\s+value=\{includeDesign\}/);
  // The pills are buttons that say which is pressed, and are never sent themselves.
  const pills = between("function YesNo(", "\n}\n");
  assert.match(pills, /role="group" aria-labelledby=\{id\}/);
  assert.match(pills, /type="button"\s+aria-pressed=\{value === answer\}/);
  assert.doesNotMatch(pills, /\bname=/);
  assert.match(pills, /focus-visible:ring-2/);
});

test("print and design side by side in two equal columns, from a form 240px wide, with short helper lines", () => {
  const block = between('<div className="@container">', "{/* Budget (leaflet) */}");
  // The columns follow the form's own width (the wrapper spans the form), not
  // the screen's, so the Get a Quote panel behaves the same; narrower, they stack.
  assert.match(block, /^<div className="@container">\s*<div className="grid grid-cols-1 @min-\[240px\]:grid-cols-2 gap-2">/);
  // Two matching boxes (a grid row stretches both to the taller one).
  const boxes = [...block.matchAll(/<div className="border border-gray-200 rounded-md px-3 py-3 bg-gray-50">\s*<YesNo\s+id="(printing|design)-question"/g)].map((m) => m[1]);
  assert.deepEqual(boxes, ["printing", "design"]);
  assert.ok(block.includes('<p className="mt-2 text-xs text-gray-500">Choose No if they&apos;re already printed.</p>'));
  assert.ok(block.includes('<p className="mt-2 text-xs text-gray-500">Choose No if your artwork is ready.</p>'));
  assert.doesNotMatch(form, /materials printed and just need|already have your artwork/);
  // The size and sides come after both boxes, not inside the print one.
  assert.ok(block.indexOf('id="design-question"') < block.indexOf('htmlFor="item-size"'));
  // The pills keep their look, are at least 44px tall, and narrow only to fit a tight column.
  const pills = between("function YesNo(", "\n}\n");
  assert.match(pills, /<div className="flex gap-2">/);
  assert.match(pills, /className=\{`flex-1 max-w-16 min-h-11 rounded-full border px-2 text-sm font-semibold transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 \$\{/);
  assert.match(pills, /"border-blue-700 bg-blue-700 text-white"/);
  assert.match(pills, /"border-gray-300 bg-white text-gray-700 hover:border-gray-400"/);
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
  assert.match(form, /onChange=\{\(\) => setServiceType\(s\.value\)\}/, "choosing another card only changes the service");
});

test("choosing a card, by click, tap or keyboard, the chosen one included, brings Your details into view when it is off screen", () => {
  // On a phone the form opens below all three cards. Every choice is counted
  // (a click on the card already chosen fires no change, but is counted).
  const cards = between("<fieldset", "</fieldset>");
  assert.match(cards, /onChange=\{\(\) => setServiceType\(s\.value\)\}\s+onClick=\{\(\) => setCardChoices\(\(n\) => n \+ 1\)\}/);
  assert.match(form, /const \[cardChoices, setCardChoices\] = useState\(0\);/);
  // Once the form is there, its start and first field are checked.
  assert.match(form, /useEffect\(\(\) => \{\s+if \(cardChoices\) showDetails\(detailsRef\.current, firstNameRef\.current\);\s+\}, \[cardChoices\]\);/);
  assert.match(form, /<div ref=\{detailsRef\} className="border-t border-gray-200 pt-6 scroll-mt-20">\s+<h3 className="text-lg font-bold text-blue-900">Your details<\/h3>/);
  assert.match(form, /ref=\{firstNameRef\}\s+type="text"\s+id="first-name"/);
  // Only when the first field is not fully on screen, on the page or in the
  // panel's own scrolling area; smoothly, or at once with reduced motion.
  const helper = between("function showDetails(", "\n}\n");
  assert.match(helper, /if \(!start \|\| !field\) return;/);
  assert.match(helper, /overflowY === "auto" \|\| overflowY === "scroll"/);
  assert.match(helper, /if \(field\.getBoundingClientRect\(\)\.bottom <= bottom\) return;/);
  assert.match(helper, /window\.matchMedia\("\(prefers-reduced-motion: reduce\)"\)\.matches/);
  assert.match(helper, /start\.scrollIntoView\(\{ behavior: reduce \? "instant" : "smooth", block: "start" \}\);/);
  // A link choosing the service opens the form without moving the page.
  assert.doesNotMatch(between("// A link can choose the service", "}, []);"), /setCardChoices|showDetails/);
  // The browser test checks it on screen for every service, by click,
  // keyboard and link, on /quote and in the panel, on desktop and phone.
  assert.ok(readFileSync("lib/__tests__/quote-form-browser.test.ts", "utf8").includes("QUOTE_FORM_TEST_URL"));
});

test("switching service keeps the details and sends only the shown service's fields", () => {
  // Each service's fields are only rendered while it is chosen, so nothing
  // of another service is in the form when it is sent.
  assert.match(form, /const isLeaflet = serviceType === "Leaflet Distribution";/);
  assert.match(form, /const isPrinting = serviceType === "Leaflet Printing";/);
  assert.match(form, /const isWebDesign = serviceType === "Web Design & SEO";/);
  assert.match(form, /const isScreenHire = serviceType === "Screen Hire";/);
  // The details and Company sit outside those parts, so they stay as typed.
  const leafletAndAfter = form.slice(form.indexOf(LEAFLET_FIELDS));
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
    // The About page's "Planning a campaign?" asks about leaflets, as its next-step card did.
    [join("app", "about", "page.tsx")]: ["/quote?service=leaflet"],
    // The areas overview's closing band asks about leaflets too.
    [join("app", "areas", "page.tsx")]: ["/quote?service=leaflet"],
    [join("app", "services", "page.tsx")]: ["/quote?service=leaflet", "/quote?service=leaflet"],
    // The kinds of leaflet distribution choose Leaflet Distribution and their kind.
    [join("app", "services", "b2b-distribution", "page.tsx")]: ["/quote?service=b2b"],
    [join("app", "services", "hand-to-hand-distribution", "page.tsx")]: ["/quote?service=hand-to-hand"],
    [join("app", "services", "public-notice-leafleting", "page.tsx")]: ["/quote?service=public-notice"],
    [join("app", "services", "screen-hire", "page.tsx")]: ["/quote?service=screen"],
    [join("app", "services", "web-design-seo", "page.tsx")]: ["/quote?service=web", "/quote?service=web", "/quote?service=web"],
  });
  // Every link on the three kinds' pages and the printing page names a word the form knows.
  for (const word of ["b2b", "hand-to-hand", "public-notice"]) assert.ok(distributionTypeFromParam(word), word);
  // The Leaflet Printing page's links all choose Leaflet Printing.
  const printing = readFileSync("app/leaflet-printing/page.tsx", "utf8");
  assert.match(printing, /const QUOTE_HREF = "\/quote\?service=printing";/);
  assert.equal(serviceFromParam("printing"), "Leaflet Printing");
  assert.doesNotMatch(printing, /href="\/quote/);
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
      quantity: "1,000 to 2,500",
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
    assert.equal(lead.leafletQuantity, "1,000 to 2,500");
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

// The route's reply, with its best-effort thank-you attempt (Leaflet
// Distribution only; no Gmail here, so it fails and takes its note off) let finish.
async function postQuietly(fields: Record<string, string>): Promise<Response> {
  const original = console.error;
  console.error = () => {};
  try {
    const res = await POST(new Request("http://localhost/api/quote-lead", { method: "POST", body: JSON.stringify(fields) }));
    for (let wait = 0; wait < 30 && (await prisma.activity.count({ where: { detail: THANK_YOU_NOTE, lead: { email: fields.email } } })); wait++) {
      await new Promise((r) => setTimeout(r, 100));
    }
    await new Promise((r) => setTimeout(r, 200));
    return res;
  } finally {
    console.error = original;
  }
}
const noteOf = async (email: string) =>
  (await prisma.activity.findMany({ where: { type: "NOTE", lead: { email } }, select: { detail: true } })).map((a) => a.detail).join("\n");

test("real database: a Leaflet Printing enquiry is saved as a lead, with its answers in the lead's note", { skip }, async () => {
  const email = `printing${DOMAIN}`;
  // What the form sends for printing, with design and letterbox delivery both Yes.
  const res = await postQuietly({
    "first-name": "Pia",
    "last-name": "Test",
    email,
    phone: "07700 900123",
    company: "Pia Ltd",
    service: "Leaflet Printing",
    "print-spec": "A5 flyers, double-sided, 250gsm silk",
    "print-items": "Flyers and leaflets, Business cards",
    "print-quantity": "2,500 to 5,000",
    "print-size": "A5",
    "print-sides": "Double sided",
    "print-design": "Yes",
    "print-send-to": "SO15 2AB",
    "also-deliver": "Yes (Print and Deliver)",
    "print-delivery-areas": "Southampton SO15, SO16",
    message: "Silk please",
  });
  assert.equal(res.status, 201);
  const lead = await prisma.lead.findFirst({
    where: { email },
    select: { name: true, businessName: true, leafletQuantity: true, printingIncluded: true, designIncluded: true, targetAreas: true, source: true },
  });
  assert.deepEqual(lead, {
    name: "Pia Test",
    businessName: "Pia Ltd",
    leafletQuantity: "2,500 to 5,000",
    printingIncluded: true,
    designIncluded: true,
    targetAreas: "Southampton SO15, SO16",
    source: "WEBSITE_QUOTE_FORM",
  });
  const note = await noteOf(email);
  for (const line of [
    "Service type: Leaflet Printing",
    "Print spec: A5 flyers, double-sided, 250gsm silk",
    "Print items: Flyers and leaflets, Business cards",
    "Item size: A5",
    "Print sides: Double sided",
    "Design wanted: Yes",
    "Send printed leaflets to: SO15 2AB",
    "Also deliver: Yes (Print and Deliver)",
    "Message: Silk please",
  ]) {
    assert.ok(note.split("\n").includes(line), line);
  }

  // With design and delivery left on No, neither is sent, and neither is recorded.
  const plain = `printing-plain${DOMAIN}`;
  assert.equal(
    (await postQuietly({ "first-name": "Pip", email: plain, phone: "07700 900123", service: "Leaflet Printing", "print-items": "Flyers and leaflets", "print-quantity": "Not sure yet", "print-size": "A6", "print-sides": "Single sided", "print-send-to": "BH24 2NR" })).status,
    201
  );
  const plainLead = await prisma.lead.findFirst({ where: { email: plain }, select: { printingIncluded: true, designIncluded: true, targetAreas: true, leafletQuantity: true } });
  assert.deepEqual(plainLead, { printingIncluded: true, designIncluded: false, targetAreas: null, leafletQuantity: "Not sure yet" });
  const plainNote = await noteOf(plain);
  assert.doesNotMatch(plainNote, /Design wanted|Also deliver|Print spec/);
});

test("real database: a Leaflet Printing enquiry without one of the quantities is refused", { skip }, async () => {
  for (const [i, quantity] of [undefined, "", "lots"].entries()) {
    const email = `printing-noqty${i}${DOMAIN}`;
    const fields: Record<string, string> = { "first-name": "Noa", email, phone: "07700 900123", service: "Leaflet Printing", "print-send-to": "SO15 2AB" };
    if (quantity !== undefined) fields["print-quantity"] = quantity;
    const res = await POST(new Request("http://localhost/api/quote-lead", { method: "POST", body: JSON.stringify(fields) }));
    assert.equal(res.status, 400, String(quantity));
    assert.equal(await prisma.lead.count({ where: { email } }), 0);
  }
});

test("real database: a Leaflet Distribution enquiry's kind goes in the lead's note", { skip }, async () => {
  const email = `kind${DOMAIN}`;
  const res = await postQuietly({
    "first-name": "Kit",
    email,
    phone: "07700 900123",
    service: "Leaflet Distribution",
    "distribution-type": "B2B",
    "areas-required": "Offices in Southampton",
    quantity: "1,000 to 2,500",
    budget: "Under £300",
  });
  assert.equal(res.status, 201);
  const lead = await prisma.lead.findFirst({ where: { email }, select: { targetAreas: true, leafletQuantity: true, printingIncluded: true } });
  assert.deepEqual(lead, { targetAreas: "Offices in Southampton", leafletQuantity: "1,000 to 2,500", printingIncluded: false });
  assert.ok((await noteOf(email)).split("\n").includes("Distribution type: B2B"));
});
