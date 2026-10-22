import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  APPLICANT_PREHEADER,
  CARDS,
  SERVICES_URL,
  THE_WORK,
  UNDER_18,
  applicantSummary,
  buildApplicantThankYouEmail,
  isUnder18,
  type ApplicantDetails,
} from "@/lib/applicant-thank-you-email";
import { SITE_URL } from "@/lib/email-layout";
import { buildThankYouEmail } from "@/lib/thank-you-email";

// The automatic thank-you email to a distributor applicant, built from the
// details they gave: its wording, what the summary shows (never their age),
// the under-18 note, the shared layout, and the plain-text version. Made-up
// details throughout; nothing is sent.

const FULL: ApplicantDetails = {
  fullName: "jamie carter",
  area: "Ferndown, BH22",
  age: "37",
  hasCar: true,
  hasLicence: false,
  availability: "Weekday afternoons,\nSaturdays\n\n",
};

// What a reader sees: the HTML without its head, hidden preview text and tags.
function visible(html: string): string {
  return html
    .replace(/<head>[\s\S]*?<\/head>/, "")
    .replace(/<div style="display:none[\s\S]*?<\/div>/, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");
}

test("subject, preview text and greeting use their first name", () => {
  const email = buildApplicantThankYouEmail(FULL);
  assert.equal(email.subject, "Thanks for applying, Jamie");
  assert.equal(email.preheader, "We'll be in touch soon, most likely on WhatsApp.");
  assert.equal(APPLICANT_PREHEADER, email.preheader);
  assert.ok(email.html.includes("We&#39;ll be in touch soon, most likely on WhatsApp."), "the preview text is in the HTML");
  assert.ok(email.text.startsWith("Hi Jamie,\n"));
  assert.ok(visible(email.html).includes("Hi Jamie,"));
  // A name typed with capitals stays as typed; no name, no name.
  assert.equal(buildApplicantThankYouEmail({ fullName: "McKenzie O'Neil" }).subject, "Thanks for applying, McKenzie");
  const none = buildApplicantThankYouEmail({ fullName: "  " });
  assert.equal(none.subject, "Thanks for applying");
  assert.ok(none.text.startsWith("Hi there,\n"));
});

test("the wording, word for word, in the HTML and the plain text", () => {
  const email = buildApplicantThankYouEmail({ ...FULL, age: "16" });
  const seen = visible(email.html);
  const sentences = [
    "Thanks for applying to deliver leaflets with Flyer Distribution Hampshire. Your application has come straight through to us, and we're glad you're interested in joining our local team.",
    "Your application at a glance",
    "If anything's changed, just reply to this email.",
    "What happens next",
    "We'll look through your application and be in touch soon, most likely by WhatsApp on the number you gave us. If we have rounds near you, we'll talk you through how it all works and agree your pay before your first job.",
    "What the work involves",
    "Delivering leaflets door to door around your local area, on days that suit you. On every round you're representing Flyer Distribution Hampshire and the local businesses we work for, so we look for people who are reliable, friendly and take pride in doing a good job. Each round is GPS recorded on your phone, so our clients know their leaflets were delivered.",
    "Quick payment",
    "Often same day, always agreed with you before each job.",
    "Flexible",
    "Fit rounds around your week.",
    "No experience needed",
    "We'll talk you through everything.",
    "Local work",
    "Rounds across Hampshire and Dorset.",
    "If you're under 18, please ask a parent or guardian to read this email with you. We may need to speak to them before you start.",
    "In the meantime, have a look at our services to see the kind of work you could be doing with us.",
    "Explore our services",
    "Speak soon,",
    "The Flyer Distribution Hampshire team",
    "Flyer Distribution Hampshire",
    "11 Forest Reach, St Leonards, Ringwood, BH24 2NR",
    "flyerdistributionhampshire@gmail.com",
    "www.flyerdistributionhampshire.co.uk",
    "You're receiving this because you applied to deliver leaflets with us.",
  ];
  for (const s of sentences) {
    assert.ok(seen.includes(s), `HTML: ${s}`);
    assert.ok(email.text.includes(s), `text: ${s}`);
  }
  // In this order.
  const at = (s: string) => seen.indexOf(s);
  const order = ["Hi Jamie,", "Thanks for applying to deliver", "Your application at a glance", "If anything's changed", "What happens next", "What the work involves", "Quick payment", "Local work", "If you're under 18", "In the meantime", "Explore our services", "Speak soon,", "You're receiving this"];
  assert.deepEqual([...order].sort((a, b) => at(a) - at(b)), order);
});

test("the brand sentence is there, and none of the words we don't use", () => {
  const email = buildApplicantThankYouEmail(FULL);
  const brand = "On every round you're representing Flyer Distribution Hampshire and the local businesses we work for";
  assert.ok(THE_WORK.includes(brand));
  assert.ok(email.text.includes(brand));
  assert.ok(visible(email.html).includes(brand));
  for (const shown of [email.text, visible(email.html), email.subject, email.preheader]) {
    assert.doesNotMatch(shown, /live tracked|see where every flyer goes|\bstreets?\b|£|\bprices?\b|\bpricing\b/i);
  }
});

test("no em dashes anywhere: the email, both versions, and the files that make it", () => {
  for (const sample of [FULL, { ...FULL, age: "15" }, {}]) {
    const email = buildApplicantThankYouEmail(sample);
    for (const part of [email.subject, email.preheader, email.html, email.text]) assert.ok(!part.includes("\u2014"));
  }
  for (const file of ["lib/applicant-thank-you-email.ts", "lib/applicant-thank-you.ts", "lib/email-layout.ts", "app/admin/crm/thank-you-email/page.tsx"]) {
    assert.ok(!readFileSync(file, "utf8").includes("\u2014"), file);
  }
});

test("the summary shows only what they filled in, and never their age", () => {
  assert.deepEqual(applicantSummary(FULL), [
    { label: "Where you live", value: "Ferndown, BH22" },
    { label: "Car access", value: "Yes" },
    { label: "Full UK licence", value: "No" },
    { label: "Availability", value: "Weekday afternoons, Saturdays" },
  ]);
  assert.deepEqual(applicantSummary({ area: "Ringwood", age: "30", hasCar: null, hasLicence: null, availability: "  " }), [
    { label: "Where you live", value: "Ringwood" },
  ]);
  // Nothing given: no box, and no "if anything's changed" line under it.
  const empty = buildApplicantThankYouEmail({ fullName: "Sam", age: "40" });
  assert.ok(!visible(empty.html).includes("Your application at a glance"));
  assert.ok(!empty.text.includes("If anything's changed"));
  // The age never shows, however it was given.
  for (const age of ["37", "16", "seventeen"]) {
    const email = buildApplicantThankYouEmail({ ...FULL, age });
    assert.ok(!applicantSummary({ ...FULL, age }).some((r) => /age/i.test(r.label)));
    assert.ok(!visible(email.html).includes(age), age);
    assert.ok(!email.text.includes(age), age);
    assert.doesNotMatch(visible(email.html) + email.text, /\bage\b|\baged\b/i);
  }
});

test("the under-18 note only when the age is a number under 18", () => {
  for (const age of ["16", "17", " 15 ", "17.5", "1"]) {
    assert.equal(isUnder18(age), true, age);
    const email = buildApplicantThankYouEmail({ ...FULL, age });
    assert.ok(email.text.includes(UNDER_18), age);
    assert.ok(visible(email.html).includes(UNDER_18), age);
    assert.ok(email.html.includes("background:#fff3c7"), "a soft yellow box");
  }
  for (const age of ["18", "18.0", "19", "45", "", "   ", null, undefined, "sixteen", "16 years", "0x10", "1e1", "-5", "16,5"]) {
    assert.equal(isUnder18(age), false, String(age));
    const email = buildApplicantThankYouEmail({ ...FULL, age });
    assert.ok(!email.text.includes(UNDER_18), String(age));
    assert.ok(!visible(email.html).includes("under 18"), String(age));
    assert.ok(!email.html.includes("background:#fff3c7"), String(age));
  }
});

test("the four cards sit two by two and stack on phones", () => {
  const { html } = buildApplicantThankYouEmail(FULL);
  assert.deepEqual(CARDS.map((c) => c.title), ["Quick payment", "Flexible", "No experience needed", "Local work"]);
  // Each card is a bordered cell, two to a row with a gap cell between, so a
  // row's two cards are always the same height.
  const rows = html.match(/<tr>\n<td class="stack" valign="top" width="48%"[\s\S]*?<\/tr>/g) ?? [];
  assert.equal(rows.length, 2);
  for (const r of rows) {
    assert.equal((r.match(/<td class="stack" valign="top" width="48%" style="width:48%;border:1px solid/g) ?? []).length, 2);
    assert.equal((r.match(/<td class="gap" width="4%"/g) ?? []).length, 1);
  }
  const phones = html.slice(html.indexOf("@media only screen and (max-width: 620px) {"), html.indexOf("</style>"));
  assert.ok(phones.includes("  .stack { display: block !important; width: auto !important; }\n"), "each pair stacks on a phone");
  assert.ok(phones.includes("  .gap { display: block !important; width: auto !important; height: 12px !important; }\n"), "with a gap between");
});

test("the button is a real link to the services page, with no image in it", () => {
  const { html, text } = buildApplicantThankYouEmail(FULL);
  assert.equal(SERVICES_URL, "https://www.flyerdistributionhampshire.co.uk/services");
  assert.ok(existsSync("app/services/page.tsx"), "the services page exists");
  const link = /<a href="https:\/\/www\.flyerdistributionhampshire\.co\.uk\/services"[^>]*>([^<]*)<\/a>/.exec(html);
  assert.ok(link, "a plain link");
  assert.equal(link[1], "Explore our services");
  assert.ok(text.includes("Explore our services: https://www.flyerdistributionhampshire.co.uk/services"));
});

test("the same layout as the quote email: header logo, footer, 600px tables with inline styles", () => {
  const applicant = buildApplicantThankYouEmail(FULL).html;
  const quote = buildThankYouEmail({ firstName: "Sarah", service: "Leaflet Distribution" }, { slotsRemaining: 2, monthLabel: "November" }).html;
  const header = (html: string) => html.slice(html.indexOf('<table role="presentation" class="card"'), html.indexOf("</td></tr>", html.indexOf("fdh-logo-white.png")));
  const footer = (html: string) => html.slice(html.indexOf('<tr><td class="px" bgcolor="#f6f7f9"'), html.lastIndexOf("You&#39;re receiving this"));
  assert.equal(header(applicant), header(quote), "the same header");
  assert.equal(footer(applicant), footer(quote), "the same footer, up to why they're receiving it");
  // The real white logo, on the site, with white alt text for when images are blocked.
  assert.match(applicant, new RegExp(`<img src="${SITE_URL}/email/fdh-logo-white\\.png" width="190" alt="Flyer Distribution Hampshire" style="[^"]*color:#ffffff;`));
  assert.equal((applicant.match(/<img /g) ?? []).length, 1, "the logo is its only image");
  assert.match(buildApplicantThankYouEmail(FULL, "").html, /<img src="\/email\/fdh-logo-white\.png"/, "the CRM preview uses this site's copy");
  assert.match(applicant, /<table role="presentation" class="card" width="600"[^>]*style="width:600px;max-width:600px;/);
  assert.match(applicant, /<!--\[if mso\]><table role="presentation" width="600"/);
  assert.doesNotMatch(applicant, /<(div|p|td|a)\b[^>]*class="(?!px|card|outer|stack|gap)/, "styles are inline, not classes");
});

test("everything they typed is escaped", () => {
  const { html, subject } = buildApplicantThankYouEmail({
    fullName: "<script>alert(1)</script> Smith",
    area: 'Poole "&" <b>Bournemouth</b>',
    availability: "<img src=x onerror=alert(1)>",
    hasCar: true,
    hasLicence: true,
  });
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("<b>Bournemouth</b>"));
  assert.ok(!html.includes("<img src=x"));
  assert.ok(html.includes("Poole &quot;&amp;&quot; &lt;b&gt;Bournemouth&lt;/b&gt;"));
  assert.equal(subject, "Thanks for applying, <script>alert(1)</script>");
  assert.ok(html.includes("<title>Thanks for applying, &lt;script&gt;alert(1)&lt;/script&gt;</title>"));
});

test("the plain-text version reads on its own", () => {
  const { text } = buildApplicantThankYouEmail({ ...FULL, age: "17" });
  assert.equal(
    text,
    [
      "Hi Jamie,",
      "",
      "Thanks for applying to deliver leaflets with Flyer Distribution Hampshire. Your application has come straight through to us, and we're glad you're interested in joining our local team.",
      "",
      "Your application at a glance",
      "Where you live: Ferndown, BH22",
      "Car access: Yes",
      "Full UK licence: No",
      "Availability: Weekday afternoons, Saturdays",
      "",
      "If anything's changed, just reply to this email.",
      "",
      "What happens next",
      "We'll look through your application and be in touch soon, most likely by WhatsApp on the number you gave us. If we have rounds near you, we'll talk you through how it all works and agree your pay before your first job.",
      "",
      "What the work involves",
      THE_WORK,
      "",
      "Quick payment: Often same day, always agreed with you before each job.",
      "Flexible: Fit rounds around your week.",
      "No experience needed: We'll talk you through everything.",
      "Local work: Rounds across Hampshire and Dorset.",
      "",
      UNDER_18,
      "",
      "In the meantime, have a look at our services to see the kind of work you could be doing with us.",
      "Explore our services: https://www.flyerdistributionhampshire.co.uk/services",
      "",
      "Speak soon,",
      "The Flyer Distribution Hampshire team",
      "",
      "--",
      "Flyer Distribution Hampshire",
      "11 Forest Reach, St Leonards, Ringwood, BH24 2NR",
      "flyerdistributionhampshire@gmail.com",
      "www.flyerdistributionhampshire.co.uk",
      "You're receiving this because you applied to deliver leaflets with us.",
    ].join("\n")
  );
  assert.doesNotMatch(text, /<[a-z]/i, "no HTML in it");
});
