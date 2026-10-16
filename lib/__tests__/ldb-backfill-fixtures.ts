import type { gmail_v1 } from "@googleapis/gmail";
import type { GmailMessageReader } from "@/lib/gmail";
import type { BackfillOptions } from "@/lib/ldb-backfill";

// Made-up Bournemouth quote notifications for the backfill tests, shaped as
// Gmail returns them. The real sender, subject and layout come from the
// options when the script is run.

export const SENDER = "no-reply@bournemouth-leaflets.example";
export const LDB = "hello@bournemouth-leaflets.example";
export const FDH = "flyerdistributionhampshire@gmail.com";
export const SUBJECT = "New quote request - Leaflet Distribution Bournemouth";
export const NOW = new Date("2026-10-16T10:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
export const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY);

export const OPTIONS: BackfillOptions = {
  from: SENDER,
  subject: SUBJECT,
  ldbAddress: LDB,
  since: null,
  stage: null,
  includeDuplicates: false,
  apply: false,
};

const b64 = (s: string) => Buffer.from(s, "utf-8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export function msg(
  id: string,
  o: { from: string; to?: string; subject?: string; at: Date; labels?: string[]; text?: string; html?: string; replyTo?: string }
): gmail_v1.Schema$Message {
  const headers = [
    { name: "From", value: o.from },
    { name: "To", value: o.to ?? LDB },
    { name: "Subject", value: o.subject ?? SUBJECT },
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

export function notification(id: string, at: Date, text: string, extra: { replyTo?: string; html?: string } = {}) {
  return msg(id, { from: `Leaflet Distribution Bournemouth <${SENDER}>`, at, text, ...extra });
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

export const SARAH_TEXT = `New quote request from the Leaflet Distribution Bournemouth website

First name: Sarah
Last name: Mitchell
Email: sarah@example.com
Phone: 07700900123
Company: Mitchell Interiors
Service: leaflet-distribution
Budget: 500-1000
Areas: Bournemouth, Poole, Westbourne
Quantity: 5000
Start date: 2026-11-01
Include printing: Yes
Include design: No
Message: Looking to target residential areas only.
Thank you.

--
Sent by Brevo`;

export const JAMES_HTML = `<h2>New quote request</h2>
<table>
<tr><td>First name</td><td>James</td></tr>
<tr><td>Email</td><td>james@example.com</td></tr>
<tr><td>Phone</td><td>01202 555000</td></tr>
<tr><td>Service</td><td>public-notice-leafleting</td></tr>
<tr><td>Budget</td><td>1000-2000</td></tr>
<tr><td>Project location</td><td>Lansdowne Road, Bournemouth</td></tr>
<tr><td>Deadline</td><td>2026-12-15</td></tr>
<tr><td>Scale</td><td>2000 households</td></tr>
<tr><td>Message</td><td>Planning consultation for proposed development.</td></tr>
</table>`;

// Name and email only: every other field is missing.
export const SPARSE_TEXT = `Name: Priya Shah
Email: priya.shah@example.net`;

// No email or phone anywhere in the body.
export const NO_CONTACT_TEXT = `Name: Owen Hale
Service: leaflet-distribution
Message: Please call me back.`;
