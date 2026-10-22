// The layout the automatic emails share (the quote thank-you and the
// distributor applicant thank-you), so both look the same: a 600px table
// layout with inline styles, which Gmail, Outlook and Apple Mail all render
// and which stacks on phones, under the dark blue header with the white logo
// and over the business footer. No server imports, so the CRM preview and
// the tests build an email the same way as the send does. Every value from a
// form is escaped by the email that uses it.

export const SITE_URL = "https://www.flyerdistributionhampshire.co.uk";
export const BUSINESS_NAME = "Flyer Distribution Hampshire";
export const BUSINESS_ADDRESS = "11 Forest Reach, St Leonards, Ringwood, BH24 2NR";
export const BUSINESS_EMAIL = "flyerdistributionhampshire@gmail.com";
export const WEBSITE_LABEL = "www.flyerdistributionhampshire.co.uk";

// The header logo: a PNG copy hosted on the site (public/email, made by
// scripts/build-email-images.ts), and the width it is shown at.
export const EMAIL_LOGO = { path: "/email/fdh-logo-white.png", width: 190 } as const;

export const FONT = "Arial, Helvetica, sans-serif";
export const DARK_BLUE = "#162456";
export const HEADING_BLUE = "#1c398e";
export const TEXT = "#364153";
export const MUTED = "#6a7282";
export const SHADE = "#f3f6fb";
export const SHADE_BORDER = "#dbe3f0";
export const SOFT_YELLOW = "#fff3c7";
export const YELLOW = "#fdc700";
const PAGE = "#eef1f6";

export function clean(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

// "dan" as "Dan"; a name typed with capitals is left as it is. Kept short,
// and on one line (it goes in the subject).
export function displayFirstName(value: string | null | undefined): string {
  const name = clean(value).slice(0, 40).trim();
  return name && name === name.toLowerCase() ? name.charAt(0).toUpperCase() + name.slice(1) : name;
}

export function escapeEmailHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export const p = (text: string, extra = "") =>
  `<p style="margin:0 0 16px 0;font-family:${FONT};font-size:16px;line-height:24px;color:${TEXT};${extra}">${text}</p>`;
export const h2 = (text: string) =>
  `<h2 style="margin:8px 0 10px 0;font-family:${FONT};font-size:19px;line-height:26px;font-weight:bold;color:${HEADING_BLUE};">${text}</h2>`;
// One full-width row of the white card.
export const row = (inner: string, padding = "0 40px") => `<tr><td class="px" style="padding:${padding};">${inner}</td></tr>`;

// The shaded "at a glance" box: a title over short label and value rows.
export function glanceBox(title: string, rows: { label: string; value: string }[]): string {
  const e = escapeEmailHtml;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;background:${SHADE};border:1px solid ${SHADE_BORDER};border-radius:8px;margin:0 0 14px 0;">
<tr><td style="padding:18px 20px 6px 20px;font-family:${FONT};font-size:16px;line-height:22px;font-weight:bold;color:${HEADING_BLUE};">${e(title)}</td></tr>
<tr><td style="padding:4px 20px 14px 20px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${rows
  .map(
    (r) => `<tr>
<td valign="top" width="38%" style="padding:6px 12px 6px 0;font-family:${FONT};font-size:14px;line-height:20px;color:${MUTED};">${e(r.label)}</td>
<td valign="top" style="padding:6px 0;font-family:${FONT};font-size:15px;line-height:20px;font-weight:bold;color:#101828;word-break:break-word;">${e(r.value)}</td>
</tr>`
  )
  .join("\n")}
</table>
</td></tr>
</table>`;
}

// A soft yellow box with a yellow edge, for the one thing worth noticing.
export function noticeBox(innerHtml: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;background:${SOFT_YELLOW};border-left:4px solid ${YELLOW};border-radius:6px;">
<tr><td style="padding:16px 20px;font-family:${FONT};font-size:16px;line-height:24px;color:${HEADING_BLUE};">${innerHtml}</td></tr>
</table>`;
}

// The whole email: the header, the given rows of the white card, and the
// footer with the business details and why they're receiving it.
export function emailDocument(params: {
  subject: string;
  preheader: string;
  // The card's rows (see row()), one after another.
  body: string;
  whyReceiving: string;
  // Where the images are served from: the site, or "" for the CRM preview (same site).
  imageBase: string;
  // More rules for phones, one per line, inside the 620px media query.
  phoneCss?: string[];
}): string {
  const e = escapeEmailHtml;
  const phoneCss = (params.phoneCss ?? []).map((rule) => `  ${rule}\n`).join("");
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no, address=no, email=no, date=no">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${e(params.subject)}</title>
<style>
@media only screen and (max-width: 620px) {
  .card { width: 100% !important; border-radius: 0 !important; }
  .px { padding-left: 22px !important; padding-right: 22px !important; }
  .outer { padding: 0 !important; }
${phoneCss}}
</style>
<!--[if mso]><style>table, td, p, h2, a { font-family: Arial, Helvetica, sans-serif !important; }</style><![endif]-->
</head>
<body style="margin:0;padding:0;background:${PAGE};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${PAGE};opacity:0;">${e(params.preheader)}${"&#847;&zwnj;&nbsp;".repeat(40)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAGE};">
<tr><td align="center" class="outer" style="padding:24px 12px;">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td><![endif]-->
<table role="presentation" class="card" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:10px;overflow:hidden;border-collapse:separate;">
<tr><td align="center" bgcolor="${DARK_BLUE}" style="background:${DARK_BLUE};padding:30px 24px;">
<a href="${SITE_URL}" style="text-decoration:none;color:#ffffff;"><img src="${params.imageBase}${EMAIL_LOGO.path}" width="${EMAIL_LOGO.width}" alt="${BUSINESS_NAME}" style="display:block;width:${EMAIL_LOGO.width}px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;font-family:${FONT};font-size:20px;line-height:26px;font-weight:bold;color:#ffffff;"></a>
</td></tr>
${params.body}
<tr><td class="px" bgcolor="#f6f7f9" style="background:#f6f7f9;padding:22px 40px;border-top:1px solid #e5e7eb;">
<p style="margin:0 0 4px 0;font-family:${FONT};font-size:13px;line-height:19px;font-weight:bold;color:${TEXT};">${BUSINESS_NAME}</p>
<p style="margin:0 0 4px 0;font-family:${FONT};font-size:13px;line-height:19px;color:${MUTED};">${BUSINESS_ADDRESS}</p>
<p style="margin:0 0 10px 0;font-family:${FONT};font-size:13px;line-height:19px;color:${MUTED};"><a href="mailto:${BUSINESS_EMAIL}" style="color:${HEADING_BLUE};text-decoration:underline;">${BUSINESS_EMAIL}</a> &nbsp;|&nbsp; <a href="${SITE_URL}" style="color:${HEADING_BLUE};text-decoration:underline;">${WEBSITE_LABEL}</a></p>
<p style="margin:0;font-family:${FONT};font-size:12px;line-height:18px;color:${MUTED};">${e(params.whyReceiving)}</p>
</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>
`;
}

// The footer in the plain-text version.
export function footerText(whyReceiving: string): string[] {
  return ["--", BUSINESS_NAME, BUSINESS_ADDRESS, BUSINESS_EMAIL, WEBSITE_LABEL, whyReceiving];
}
