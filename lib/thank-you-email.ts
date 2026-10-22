// The automatic thank-you email to a website quote enquiry (FDH only): its
// subject, preview text, HTML and plain-text versions, from the details the
// form sent and this month's campaign slots. No server imports, so the CRM
// preview and the tests build it the same way as the send does.
//
// The HTML is a 600px table layout with inline styles, which Gmail, Outlook
// and Apple Mail all render, and which stacks on phones. Every value from
// the form is escaped. Its images are PNG copies hosted on the site
// (public/email, made by scripts/build-email-images.ts).

import { slotNoun } from "./campaign-constants";

export const SITE_URL = "https://www.flyerdistributionhampshire.co.uk";
const BUSINESS_NAME = "Flyer Distribution Hampshire";
const BUSINESS_ADDRESS = "11 Forest Reach, St Leonards, Ringwood, BH24 2NR";
const BUSINESS_EMAIL = "flyerdistributionhampshire@gmail.com";
const WEBSITE_LABEL = "www.flyerdistributionhampshire.co.uk";

// The brands bar's logos, in its order (a test keeps this in step with
// components/BrandsBar.tsx): one image of them all, and the names for its
// alt text.
export const EMAIL_BRANDS: readonly { name: string; file: string }[] = [
  { name: "New Arts", file: "logo-new-arts.webp" },
  { name: "Body by Victoria", file: "logo-body-by-victoria.webp" },
  { name: "Associated Asphalt", file: "logo-associated-asphalt.webp" },
  { name: "Hera Health", file: "logo-hera-health.webp" },
  { name: "Heritage Will Writing", file: "logo-heritage-will-writing.webp" },
  { name: "The Relocation Specialists", file: "logo-the-relocation-specialists.webp" },
  { name: "Full Shield Security", file: "logo-full-shield-security.webp" },
  { name: "Elisha's Pampered Paws", file: "logo-elishas-pampered-paws.webp" },
  { name: "The Healing Hub", file: "logo-the-healing-hub.webp" },
  { name: "Kola Construction", file: "logo-kola-construction.webp" },
];

// The email's images, in public/email, and the size each is shown at.
export const EMAIL_IMAGES = {
  logo: { path: "/email/fdh-logo-white.png", width: 190 },
  brands: { path: "/email/brands-we-have-worked-with.png", width: 520 },
} as const;

// What the quote form sent that the email uses. Missing or blank means not given.
export type QuoteEnquiry = {
  firstName?: string | null;
  service?: string | null;
  targetAreas?: string | null;
  quantity?: string | null;
  startDate?: string | null;
  // The form's checkboxes: "yes" when ticked, missing when not.
  printingIncluded?: string | null;
  designIncluded?: string | null;
};

// The quote form's fields, as /api/quote-lead receives them.
export function enquiryFromQuoteForm(data: Record<string, unknown>): QuoteEnquiry {
  const field = (key: string) => (typeof data[key] === "string" ? (data[key] as string) : null);
  return {
    firstName: field("first-name"),
    service: field("service"),
    targetAreas: field("areas-required"),
    quantity: field("quantity"),
    startDate: field("campaign-start-date"),
    printingIncluded: field("printing-included"),
    designIncluded: field("include-design"),
  };
}

export type CampaignSlots = { slotsRemaining: number; monthLabel: string };

export type ThankYouEmail = { subject: string; preheader: string; html: string; text: string };

export const THANK_YOU_PREHEADER = "Dan will be in touch shortly to talk through your campaign.";

const LEAFLET_SERVICE = "Leaflet Distribution";

function clean(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

// "dan" as "Dan"; a name typed with capitals is left as it is. Kept short,
// and on one line (it goes in the subject).
export function displayFirstName(value: string | null | undefined): string {
  const name = clean(value).slice(0, 40).trim();
  return name && name === name.toLowerCase() ? name.charAt(0).toUpperCase() + name.slice(1) : name;
}

// The areas as typed, without a full stop or comma at the end.
function areasPhrase(value: string | null | undefined): string {
  return clean(value).replace(/[\s.,;:]+$/, "");
}

const LONG_DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

// "2026-11-03" from the date picker as "3 November 2026"; anything else as typed.
function startDateText(value: string | null | undefined): string {
  const v = clean(value);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return v;
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== v ? v : LONG_DATE.format(date);
}

// "Your enquiry at a glance": only what they gave. The two checkboxes are
// only on the leaflet form, where unticked means no.
export function enquirySummary(enquiry: QuoteEnquiry): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  const areas = areasPhrase(enquiry.targetAreas);
  if (areas) rows.push({ label: "Areas", value: areas });
  const quantity = clean(enquiry.quantity);
  if (quantity) rows.push({ label: "Leaflets", value: quantity });
  const start = startDateText(enquiry.startDate);
  if (start) rows.push({ label: "Start date", value: start });
  const leaflet = clean(enquiry.service) === LEAFLET_SERVICE;
  const ticked = (v: string | null | undefined) => clean(v).toLowerCase() === "yes";
  if (leaflet || ticked(enquiry.printingIncluded)) rows.push({ label: "Printing included", value: ticked(enquiry.printingIncluded) ? "Yes" : "No" });
  if (leaflet || ticked(enquiry.designIncluded)) rows.push({ label: "Design needed", value: ticked(enquiry.designIncluded) ? "Yes" : "No" });
  return rows;
}

// "We have 5 campaign slots available for November", or null when there are none.
export function slotsSentence(slots: CampaignSlots): { count: string; noun: string; month: string } | null {
  if (!(slots.slotsRemaining > 0)) return null;
  return { count: String(slots.slotsRemaining), noun: slotNoun(slots.slotsRemaining).toLowerCase(), month: slots.monthLabel };
}

export function thankYouSubject(enquiry: QuoteEnquiry): string {
  const name = displayFirstName(enquiry.firstName);
  return name ? `Congratulations ${name}, you've come to the right place` : "Congratulations, you've come to the right place";
}

const REVIEW_QUOTE =
  "Outstanding service! Great communication; reasonably priced; excellent job! I would highly recommend these guys.";
const REVIEW_BY = "John Lofthouse, New Arts";

const NEXT_STEPS = [
  "Dan will give you a call shortly to talk through your campaign. If he can't get hold of you, he'll drop you a text or an email so you can pick a time that suits.",
  "Before he calls, Dan will put together a quote from the details you've sent, so you're not left waiting. On the call, he'll take you through it, along with the best areas to target, timings and how our GPS tracking works.",
];
const WHY_US =
  "We're a local company based in Ringwood, working across Hampshire and Dorset. Every campaign is delivered by our own local team and GPS tracked, and you receive a route report once delivery is complete, so you know your leaflets went where they should.";
const REPLY_LINE = "If anything's changed, or you'd like to send your artwork before the call, just reply to this email.";
const LOOKING_FORWARD = "We're looking forward to helping you reach the right homes.";
const WHY_RECEIVING = "You're receiving this because you requested a quote on our website.";

function thanksSentence(enquiry: QuoteEnquiry): string {
  const areas = areasPhrase(enquiry.targetAreas);
  return `Thanks for getting in touch about your leaflet campaign${areas ? ` in ${areas}` : ""}. Your enquiry has come straight through to our team, and you've come to the right place.`;
}

export function escapeEmailHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// --- HTML -------------------------------------------------------------------------

const FONT = "Arial, Helvetica, sans-serif";
const DARK_BLUE = "#162456";
const HEADING_BLUE = "#1c398e";
const TEXT = "#364153";
const MUTED = "#6a7282";
const SHADE = "#f3f6fb";
const SHADE_BORDER = "#dbe3f0";
const SOFT_YELLOW = "#fff3c7";
const YELLOW = "#fdc700";
const STAR = "#f5b301";
const PAGE = "#eef1f6";

const p = (text: string, extra = "") =>
  `<p style="margin:0 0 16px 0;font-family:${FONT};font-size:16px;line-height:24px;color:${TEXT};${extra}">${text}</p>`;
const h2 = (text: string) =>
  `<h2 style="margin:8px 0 10px 0;font-family:${FONT};font-size:19px;line-height:26px;font-weight:bold;color:${HEADING_BLUE};">${text}</h2>`;
// One full-width row of the white card.
const row = (inner: string, padding = "0 40px") => `<tr><td class="px" style="padding:${padding};">${inner}</td></tr>`;

export function buildThankYouEmail(
  enquiry: QuoteEnquiry,
  slots: CampaignSlots,
  // Where the images are served from: the site, or "" for the CRM preview (same site).
  imageBase: string = SITE_URL
): ThankYouEmail {
  const subject = thankYouSubject(enquiry);
  const name = displayFirstName(enquiry.firstName);
  const greeting = name ? `Hi ${name},` : "Hi there,";
  const summary = enquirySummary(enquiry);
  const slot = slotsSentence(slots);
  const brandNames = EMAIL_BRANDS.map((b) => b.name);
  const brandsAlt = `Brands we've worked with: ${brandNames.join(", ")}`;
  const e = escapeEmailHtml;

  const summaryHtml = summary.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;background:${SHADE};border:1px solid ${SHADE_BORDER};border-radius:8px;margin:0 0 14px 0;">
<tr><td style="padding:18px 20px 6px 20px;font-family:${FONT};font-size:16px;line-height:22px;font-weight:bold;color:${HEADING_BLUE};">Your enquiry at a glance</td></tr>
<tr><td style="padding:4px 20px 14px 20px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${summary
  .map(
    (r) => `<tr>
<td valign="top" width="38%" style="padding:6px 12px 6px 0;font-family:${FONT};font-size:14px;line-height:20px;color:${MUTED};">${e(r.label)}</td>
<td valign="top" style="padding:6px 0;font-family:${FONT};font-size:15px;line-height:20px;font-weight:bold;color:#101828;word-break:break-word;">${e(r.value)}</td>
</tr>`
  )
  .join("\n")}
</table>
</td></tr>
</table>`
    : "";

  const slotsHtml = slot
    ? row(
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;background:${SOFT_YELLOW};border-left:4px solid ${YELLOW};border-radius:6px;">
<tr><td style="padding:16px 20px;font-family:${FONT};font-size:16px;line-height:24px;color:${HEADING_BLUE};">We have <strong>${e(slot.count)}</strong> campaign ${e(slot.noun)} available for <strong>${e(slot.month)}</strong>, so it's well worth having that chat.</td></tr>
</table>`,
        "8px 40px 24px 40px"
      )
    : "";

  const html = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no, address=no, email=no, date=no">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${e(subject)}</title>
<style>
@media only screen and (max-width: 620px) {
  .card { width: 100% !important; border-radius: 0 !important; }
  .px { padding-left: 22px !important; padding-right: 22px !important; }
  .outer { padding: 0 !important; }
}
</style>
<!--[if mso]><style>table, td, p, h2, a { font-family: Arial, Helvetica, sans-serif !important; }</style><![endif]-->
</head>
<body style="margin:0;padding:0;background:${PAGE};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${PAGE};opacity:0;">${e(THANK_YOU_PREHEADER)}${"&#847;&zwnj;&nbsp;".repeat(40)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAGE};">
<tr><td align="center" class="outer" style="padding:24px 12px;">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td><![endif]-->
<table role="presentation" class="card" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:10px;overflow:hidden;border-collapse:separate;">
<tr><td align="center" bgcolor="${DARK_BLUE}" style="background:${DARK_BLUE};padding:30px 24px;">
<a href="${SITE_URL}" style="text-decoration:none;color:#ffffff;"><img src="${imageBase}${EMAIL_IMAGES.logo.path}" width="${EMAIL_IMAGES.logo.width}" alt="${BUSINESS_NAME}" style="display:block;width:${EMAIL_IMAGES.logo.width}px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;font-family:${FONT};font-size:20px;line-height:26px;font-weight:bold;color:#ffffff;"></a>
</td></tr>
${row(p(e(greeting), "font-weight:bold;color:#101828;") + p(e(thanksSentence(enquiry))), "34px 40px 2px 40px")}
${row(summaryHtml + p(e(REPLY_LINE)), "0 40px 8px 40px")}
${row(h2("What happens next") + NEXT_STEPS.map((t) => p(e(t))).join(""), "8px 40px 4px 40px")}
${row(h2("Why local businesses choose us") + p(e(WHY_US)), "8px 40px 8px 40px")}
${row(
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;border:1px solid ${SHADE_BORDER};border-radius:8px;">
<tr><td style="padding:18px 20px;">
<p style="margin:0 0 6px 0;font-family:${FONT};font-size:20px;line-height:22px;color:${STAR};letter-spacing:2px;">&#9733;&#9733;&#9733;&#9733;&#9733;</p>
<p style="margin:0 0 10px 0;font-family:${FONT};font-size:14px;line-height:20px;font-weight:bold;color:${HEADING_BLUE};">5.0 on Google</p>
<p style="margin:0 0 10px 0;font-family:${FONT};font-size:16px;line-height:24px;font-style:italic;color:${TEXT};">&quot;${e(REVIEW_QUOTE)}&quot;</p>
<p style="margin:0;font-family:${FONT};font-size:14px;line-height:20px;font-weight:bold;color:#101828;">${e(REVIEW_BY)}</p>
</td></tr>
</table>`,
  "8px 40px 24px 40px"
)}
${row(
  `<p style="margin:0 0 12px 0;font-family:${FONT};font-size:13px;line-height:18px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;text-align:center;color:${HEADING_BLUE};">Brands we've worked with</p>
<img src="${imageBase}${EMAIL_IMAGES.brands.path}" width="${EMAIL_IMAGES.brands.width}" alt="${e(brandsAlt)}" style="display:block;width:100%;max-width:${EMAIL_IMAGES.brands.width}px;height:auto;margin:0 auto;border:0;outline:none;font-family:${FONT};font-size:13px;line-height:19px;color:${MUTED};text-align:center;">`,
  "4px 40px 24px 40px"
)}
${slotsHtml}
${row(p(e(LOOKING_FORWARD)) + p(`Speak soon,<br><strong style="color:#101828;">Dan Whitby</strong><br>Co-Founder, ${BUSINESS_NAME}`, "margin-bottom:32px;"), "4px 40px 4px 40px")}
<tr><td class="px" bgcolor="#f6f7f9" style="background:#f6f7f9;padding:22px 40px;border-top:1px solid #e5e7eb;">
<p style="margin:0 0 4px 0;font-family:${FONT};font-size:13px;line-height:19px;font-weight:bold;color:${TEXT};">${BUSINESS_NAME}</p>
<p style="margin:0 0 4px 0;font-family:${FONT};font-size:13px;line-height:19px;color:${MUTED};">${BUSINESS_ADDRESS}</p>
<p style="margin:0 0 10px 0;font-family:${FONT};font-size:13px;line-height:19px;color:${MUTED};"><a href="mailto:${BUSINESS_EMAIL}" style="color:${HEADING_BLUE};text-decoration:underline;">${BUSINESS_EMAIL}</a> &nbsp;|&nbsp; <a href="${SITE_URL}" style="color:${HEADING_BLUE};text-decoration:underline;">${WEBSITE_LABEL}</a></p>
<p style="margin:0;font-family:${FONT};font-size:12px;line-height:18px;color:${MUTED};">${e(WHY_RECEIVING)}</p>
</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>
`;

  const text = [
    greeting,
    "",
    thanksSentence(enquiry),
    "",
    ...(summary.length ? ["Your enquiry at a glance", ...summary.map((r) => `${r.label}: ${r.value}`), ""] : []),
    REPLY_LINE,
    "",
    "What happens next",
    NEXT_STEPS[0],
    "",
    NEXT_STEPS[1],
    "",
    "Why local businesses choose us",
    WHY_US,
    "",
    "5 stars, 5.0 on Google",
    `"${REVIEW_QUOTE}"`,
    REVIEW_BY,
    "",
    "Brands we've worked with",
    brandNames.join(", "),
    "",
    ...(slot ? [`We have ${slot.count} campaign ${slot.noun} available for ${slot.month}, so it's well worth having that chat.`, ""] : []),
    LOOKING_FORWARD,
    "",
    "Speak soon,",
    "Dan Whitby",
    `Co-Founder, ${BUSINESS_NAME}`,
    "",
    "--",
    BUSINESS_NAME,
    BUSINESS_ADDRESS,
    BUSINESS_EMAIL,
    WEBSITE_LABEL,
    WHY_RECEIVING,
  ].join("\n");

  return { subject, preheader: THANK_YOU_PREHEADER, html, text };
}
