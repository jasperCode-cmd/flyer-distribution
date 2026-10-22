// The automatic thank-you email to someone who applies through FDH's Work
// With Us form: its subject, preview text, HTML and plain-text versions,
// from the details they gave. It uses the layout the automatic emails share
// (lib/email-layout.ts), so it looks like the quote thank-you. No server
// imports, so the CRM preview and the tests build it the same way as the
// send does. Every value from the form is escaped, and their age is never
// shown: it only decides whether the under-18 note is included.

import {
  BUSINESS_NAME,
  DARK_BLUE,
  FONT,
  HEADING_BLUE,
  SHADE_BORDER,
  SITE_URL,
  TEXT,
  YELLOW,
  clean,
  displayFirstName,
  emailDocument,
  escapeEmailHtml,
  footerText,
  glanceBox,
  h2,
  noticeBox,
  p,
  row,
} from "./email-layout";

// What the application gave that the email uses. Missing or blank means not given.
export type ApplicantDetails = {
  fullName?: string | null;
  area?: string | null;
  age?: string | null;
  hasCar?: boolean | null;
  hasLicence?: boolean | null;
  availability?: string | null;
};

export type ApplicantThankYouEmail = { subject: string; preheader: string; html: string; text: string };

export const APPLICANT_PREHEADER = "We'll be in touch soon, most likely on WhatsApp.";
export const SERVICES_URL = `${SITE_URL}/services`;

const INTRO =
  "Thanks for applying to deliver leaflets with Flyer Distribution Hampshire. Your application has come straight through to us, and we're glad you're interested in joining our local team.";
const REPLY_LINE = "If anything's changed, just reply to this email.";
const NEXT_STEPS =
  "We'll look through your application and be in touch soon, most likely by WhatsApp on the number you gave us. If we have rounds near you, we'll talk you through how it all works and agree your pay before your first job.";
export const THE_WORK =
  "Delivering leaflets door to door around your local area, on days that suit you. On every round you're representing Flyer Distribution Hampshire and the local businesses we work for, so we look for people who are reliable, friendly and take pride in doing a good job. Each round is GPS recorded on your phone, so our clients know their leaflets were delivered.";
export const CARDS: readonly { title: string; text: string }[] = [
  { title: "Quick payment", text: "Often same day, always agreed with you before each job." },
  { title: "Flexible", text: "Fit rounds around your week." },
  { title: "No experience needed", text: "We'll talk you through everything." },
  { title: "Local work", text: "Rounds across Hampshire and Dorset." },
];
export const UNDER_18 =
  "If you're under 18, please ask a parent or guardian to read this email with you. We may need to speak to them before you start.";
const SERVICES_LINE = "In the meantime, have a look at our services to see the kind of work you could be doing with us.";
const BUTTON_LABEL = "Explore our services";
const SIGN_OFF_TEAM = `The ${BUSINESS_NAME} team`;
const WHY_RECEIVING = "You're receiving this because you applied to deliver leaflets with us.";

// The first word of their name, as the quote email shows a first name.
export function applicantFirstName(fullName: string | null | undefined): string {
  return displayFirstName(clean(fullName).split(" ")[0]);
}

export function applicantSubject(details: ApplicantDetails): string {
  const name = applicantFirstName(details.fullName);
  return name ? `Thanks for applying, ${name}` : "Thanks for applying";
}

// Only an age written as a plain number under 18 ("16", "17.5"). Anything
// else (18 or over, missing, or not a plain number) leaves the note out.
export function isUnder18(age: string | null | undefined): boolean {
  const value = clean(age);
  return /^\d{1,3}(\.\d+)?$/.test(value) && Number(value) < 18;
}

// Availability as one line: what they wrote on each line, in turn.
function availabilityText(value: string | null | undefined): string {
  return (value ?? "")
    .split(/\r?\n/)
    .map((line) => clean(line).replace(/[\s,;]+$/, ""))
    .filter(Boolean)
    .join(", ");
}

const yesNo = (value: boolean | null | undefined) => (value === true ? "Yes" : value === false ? "No" : "");

// "Your application at a glance": only what they gave, and never their age.
export function applicantSummary(details: ApplicantDetails): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  const area = clean(details.area);
  if (area) rows.push({ label: "Where you live", value: area });
  const car = yesNo(details.hasCar);
  if (car) rows.push({ label: "Car access", value: car });
  const licence = yesNo(details.hasLicence);
  if (licence) rows.push({ label: "Full UK licence", value: licence });
  const availability = availabilityText(details.availability);
  if (availability) rows.push({ label: "Availability", value: availability });
  return rows;
}

// The four cards, two by two, each pair stacking on a phone. Each card is a
// bordered cell, so the two in a row are always the same height; the gaps
// are cells of their own.
function cardsHtml(): string {
  const e = escapeEmailHtml;
  const card = (c: { title: string; text: string }) =>
    `<td class="stack" valign="top" width="48%" style="width:48%;border:1px solid ${SHADE_BORDER};border-radius:8px;padding:14px 16px;">
<p style="margin:0 0 4px 0;font-family:${FONT};font-size:15px;line-height:21px;font-weight:bold;color:${HEADING_BLUE};">${e(c.title)}</p>
<p style="margin:0;font-family:${FONT};font-size:14px;line-height:20px;color:${TEXT};">${e(c.text)}</p>
</td>`;
  const gap = `<td class="gap" width="4%" style="width:4%;font-size:0;line-height:0;">&nbsp;</td>`;
  const gapRow = `<tr><td class="gap" colspan="3" height="20" style="height:20px;font-size:0;line-height:0;">&nbsp;</td></tr>`;
  const pairs = [CARDS.slice(0, 2), CARDS.slice(2, 4)];
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;margin:0 0 12px 0;">
${pairs.map(([left, right]) => `<tr>\n${card(left)}\n${gap}\n${card(right)}\n</tr>`).join(`\n${gapRow}\n`)}
</table>`;
}

// A real link styled as a button, so it works with images blocked.
function buttonHtml(): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;">
<tr><td align="center" bgcolor="${YELLOW}" style="background:${YELLOW};border-radius:6px;">
<a href="${SERVICES_URL}" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:16px;line-height:20px;font-weight:bold;color:${DARK_BLUE};text-decoration:none;border-radius:6px;">${escapeEmailHtml(BUTTON_LABEL)}</a>
</td></tr>
</table>`;
}

export function buildApplicantThankYouEmail(
  details: ApplicantDetails,
  // Where the images are served from: the site, or "" for the CRM preview (same site).
  imageBase: string = SITE_URL
): ApplicantThankYouEmail {
  const subject = applicantSubject(details);
  const name = applicantFirstName(details.fullName);
  const greeting = name ? `Hi ${name},` : "Hi there,";
  const summary = applicantSummary(details);
  const under18 = isUnder18(details.age);
  const e = escapeEmailHtml;

  const body = [
    row(p(e(greeting), "font-weight:bold;color:#101828;") + p(e(INTRO)), "34px 40px 2px 40px"),
    summary.length ? row(glanceBox("Your application at a glance", summary) + p(e(REPLY_LINE)), "0 40px 8px 40px") : "",
    row(h2("What happens next") + p(e(NEXT_STEPS)), "8px 40px 4px 40px"),
    row(h2("What the work involves") + p(e(THE_WORK)), "8px 40px 4px 40px"),
    row(cardsHtml(), "4px 40px 12px 40px"),
    under18 ? row(noticeBox(e(UNDER_18)), "4px 40px 24px 40px") : "",
    row(p(e(SERVICES_LINE)) + buttonHtml(), "4px 40px 28px 40px"),
    row(p(`Speak soon,<br><strong style="color:#101828;">${e(SIGN_OFF_TEAM)}</strong>`, "margin-bottom:32px;"), "4px 40px 4px 40px"),
  ]
    .filter(Boolean)
    .join("\n");

  const html = emailDocument({
    subject,
    preheader: APPLICANT_PREHEADER,
    body,
    whyReceiving: WHY_RECEIVING,
    imageBase,
    phoneCss: [
      ".stack { display: block !important; width: auto !important; }",
      ".gap { display: block !important; width: auto !important; height: 12px !important; }",
    ],
  });

  const text = [
    greeting,
    "",
    INTRO,
    "",
    ...(summary.length ? ["Your application at a glance", ...summary.map((r) => `${r.label}: ${r.value}`), "", REPLY_LINE, ""] : []),
    "What happens next",
    NEXT_STEPS,
    "",
    "What the work involves",
    THE_WORK,
    "",
    ...CARDS.map((c) => `${c.title}: ${c.text}`),
    "",
    ...(under18 ? [UNDER_18, ""] : []),
    SERVICES_LINE,
    `${BUTTON_LABEL}: ${SERVICES_URL}`,
    "",
    "Speak soon,",
    SIGN_OFF_TEAM,
    "",
    ...footerText(WHY_RECEIVING),
  ].join("\n");

  return { subject, preheader: APPLICANT_PREHEADER, html, text };
}
