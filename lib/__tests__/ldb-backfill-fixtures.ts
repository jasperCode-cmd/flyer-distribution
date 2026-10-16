import type { gmail_v1 } from "@googleapis/gmail";
import type { GmailMessageReader } from "@/lib/gmail";
import type { BackfillOptions } from "@/lib/ldb-backfill";

// Bournemouth quote notifications for the backfill tests, in the LDB
// website's layout: sent by Brevo straight to the Hampshire Gmail, from the
// Bournemouth address, Reply-To the enquirer, an h2 then a two-column table
// of label and value rows. The enquirers are made up.

export const SENDER = "team@leafletdistributionbournemouth.co.uk";
export const FDH = "flyerdistributionhampshire@gmail.com";
export const OURS = [FDH, SENDER];
export const NOW = new Date("2026-10-16T10:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
export const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY);

export const OPTIONS: BackfillOptions = {
  from: SENDER,
  since: null,
  stage: null,
  includeDuplicates: false,
  apply: false,
};

const b64 = (s: string) => Buffer.from(s, "utf-8").toString("base64url");

export function msg(
  id: string,
  o: { from: string; to?: string; subject: string; at: Date; labels?: string[]; text?: string; html?: string; replyTo?: string }
): gmail_v1.Schema$Message {
  const headers = [
    { name: "From", value: o.from },
    { name: "To", value: o.to ?? FDH },
    { name: "Subject", value: o.subject },
    { name: "Date", value: o.at.toUTCString() },
    ...(o.replyTo ? [{ name: "Reply-To", value: o.replyTo }] : []),
  ];
  const parts = [
    ...(o.text !== undefined ? [{ mimeType: "text/plain", body: { data: b64(o.text) } }] : []),
    ...(o.html !== undefined ? [{ mimeType: "text/html", body: { data: b64(o.html) } }] : []),
  ];
  return {
    id,
    labelIds: o.labels ?? ["INBOX"],
    internalDate: String(o.at.getTime()),
    payload: { mimeType: "multipart/alternative", headers, parts },
  };
}

export type Row = [label: string, valueHtml: string];

// The notification body: "New Quote Enquiry: <service>", then the table.
export function notificationHtml(service: string, rows: Row[]): string {
  return [
    `<h2>New Quote Enquiry: ${service}</h2>`,
    "<table>",
    ...rows.map(([label, value]) => `  <tr><td>${label}</td><td>${value}</td></tr>`),
    "</table>",
  ].join("\n");
}

export const mailto = (address: string) => `<a href="mailto:${address}">${address}</a>`;

// A notification as Gmail holds it: from "Leaflet Distribution Bournemouth"
// <team@...>, to the Hampshire Gmail, Reply-To the enquirer.
export function notification(
  id: string,
  at: Date,
  o: { subject: string; html: string; replyTo?: string | null; text?: string }
): gmail_v1.Schema$Message {
  return msg(id, {
    from: `"Leaflet Distribution Bournemouth" <${SENDER}>`,
    subject: o.subject,
    at,
    html: o.html,
    text: o.text,
    ...(o.replyTo ? { replyTo: o.replyTo } : {}),
  });
}

export function thread(id: string, messages: gmail_v1.Schema$Message[]): gmail_v1.Schema$Thread {
  return { id, messages: messages.map((m) => ({ ...m, threadId: id })) };
}

// A Gmail reader over fixed threads. Like Gmail's subject search, it returns
// every message in them, replies included, so the exact checks are tested.
export function fakeReader(threads: gmail_v1.Schema$Thread[]): GmailMessageReader & { queries: string[] } {
  const queries: string[] = [];
  return {
    queries,
    async listMessageIds(q) {
      queries.push(q);
      return {
        messages: threads.flatMap((t) => (t.messages ?? []).map((m) => ({ id: m.id as string, threadId: t.id as string }))),
        nextPageToken: null,
      };
    },
    async getThread(id) {
      return threads.find((t) => t.id === id) ?? null;
    },
  };
}

// --- The samples --------------------------------------------------------------------

export const SARAH = {
  subject: "Leaflet Distribution enquiry from Sarah Mitchell",
  replyTo: '"Sarah Mitchell" <sarah@example.com>',
  html: notificationHtml("Leaflet Distribution", [
    ["Name", "Sarah Mitchell"],
    ["Email", mailto("sarah@example.com")],
    ["Phone", "07700900123"],
    ["Company / Organisation", "Mitchell Interiors"],
    ["Service", "Leaflet Distribution"],
    ["Areas", "Bournemouth, Poole, Westbourne"],
    ["Approximate quantity", "5000"],
    ["Campaign start date", "2026-11-01"],
    ["Include printing", "Yes"],
    ["Include design", "No"],
    ["Approximate budget", "&pound;500 - &pound;1,000"],
    ["Additional details", "Looking to target residential areas only.<br>Ideally before half term."],
  ]),
};

export const JAMES = {
  subject: "Public Notice Leafleting enquiry from James Hart",
  replyTo: '"James Hart" <james@example.com>',
  html: notificationHtml("Public Notice Leafleting", [
    ["Name", "James Hart"],
    ["Email", mailto("james@example.com")],
    ["Phone", "01202 555000"],
    ["Service", "Public Notice Leafleting"],
    ["Project / site location", "Lansdowne Road, Bournemouth"],
    ["Consultation / publicity deadline", "2026-12-15"],
    ["Approximate scale of distribution", "2000 households"],
    ["Approximate budget", "&pound;1,000 - &pound;2,000"],
    ["Additional details", "Planning consultation for proposed development."],
  ]),
};

// Areas "None selected", and the optional rows (Phone, Company) left out.
export const PRIYA = {
  subject: "Leaflet Distribution enquiry from Priya Shah",
  replyTo: '"Priya Shah" <priya.shah@example.net>',
  html: notificationHtml("Leaflet Distribution", [
    ["Name", "Priya Shah"],
    ["Email", mailto("priya.shah@example.net")],
    ["Service", "Leaflet Distribution"],
    ["Areas", "None selected"],
    ["Approximate quantity", "2000"],
    ["Include printing", "No"],
    ["Include design", "Yes"],
  ]),
};

// The original subject, used briefly on 2026-07-29.
export const KIM = {
  subject: "Quote enquiry from Kim Ward",
  replyTo: '"Kim Ward" <kim.ward@example.org>',
  html: notificationHtml("Leaflet Distribution", [
    ["Name", "Kim Ward"],
    ["Email", mailto("kim.ward@example.org")],
    ["Phone", "07700 900777"],
    ["Service", "Leaflet Distribution"],
    ["Areas", "Christchurch"],
  ]),
};
export const KIM_AT = new Date("2026-07-29T14:05:00.000Z");

// Name only: no email, no phone and no Reply-To.
export const OWEN = {
  subject: "Leaflet Distribution enquiry from Owen Hale",
  replyTo: null,
  html: notificationHtml("Leaflet Distribution", [
    ["Name", "Owen Hale"],
    ["Service", "Leaflet Distribution"],
  ]),
};

// The CRM's own email to a Bournemouth lead, as its BCC to the Bournemouth
// address arrives here: from the same sender, to the lead, Reply-To the
// Bournemouth address.
export function crmCopy(id: string, at: Date, to: string, subject: string): gmail_v1.Schema$Message {
  return msg(id, {
    from: `"Leaflet Distribution Bournemouth" <${SENDER}>`,
    to,
    replyTo: SENDER,
    subject,
    at,
    text: "Hi, thanks for your enquiry.\n\nKind regards,\nDan\n\n-- \nLeaflet Distribution Bournemouth",
    html: "<p>Hi, thanks for your enquiry.</p><p>Kind regards,<br>Dan</p>",
  });
}
