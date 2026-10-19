import type { gmail_v1 } from "@googleapis/gmail";
import { extractTextVariants, singleReplyTo } from "./gmail";
import {
  htmlPart,
  isNotificationFrom,
  notificationTableRows,
  readLabelledText,
  type NotificationRules,
} from "./ldb-backfill";
import { LDB_APPLICATION_LIMITS, validateLdbApplication } from "./ldb-application-intake";
import type { ApplicationFieldKey, ParsedApplication } from "./distributor-applications";

// Past distributor applications from the Leaflet Distribution Bournemouth
// website, read from the shared Gmail by "Import past applications from
// Gmail" (lib/application-import.ts). Read-only, like the rest of the import.
//
// The LDB website's notifications are sent by Brevo straight to the shared
// Gmail, from the LDB address, Reply-To the applicant, with the subject
// "Distributor application from <full name>". The body is an h2 "New
// Distributor Application" and a two-column table: Name, Email, Phone,
// Postcode, Access to a car (Yes or No), Areas they could cover (or "None
// selected") and About themselves (only when filled in). They are told apart
// exactly like the enquiry notifications (lib/ldb-backfill.ts), and each one
// is read into the fields the LDB application intake accepts and checked by
// the same validation, so an imported application is built exactly like a
// new one (lib/ldb-application-intake.ts).

export const LDB_APPLICATION_SUBJECT_PREFIX = "Distributor application from ";

// "Distributor application from Sarah Jones", with a name after it. A reply
// ("Re: ...") or forward ("Fwd: ...") never starts so.
export function isLdbApplicationSubject(subject: string | null): boolean {
  const tidy = (subject ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  const prefix = LDB_APPLICATION_SUBJECT_PREFIX.toLowerCase();
  return tidy.startsWith(prefix) && tidy.length > prefix.length;
}

// Gmail's subject search matches words, so this finds every "... application
// from ..." from the LDB address, and each message is then checked by
// isLdbApplicationNotification.
export function ldbApplicationSearchQuery(ldbAddress: string): string {
  return `from:${ldbAddress.replace(/[\s"]/g, "")} subject:"Distributor application from"`;
}

// A notification itself, by the enquiry notifications' rules: from the LDB
// address, to the Hampshire Gmail (and no one else), the applicant as
// Reply-To, not a draft. The SENT label means nothing here (the LDB address
// is a send-as address of this Gmail), and the CRM's own emails from the LDB
// address go to the applicant, so they are never taken for one.
export function isLdbApplicationNotification(message: gmail_v1.Schema$Message, rules: NotificationRules): boolean {
  return isNotificationFrom(message, rules, isLdbApplicationSubject);
}

type RawKey = "fullName" | "email" | "phone" | "postcode" | "hasCar" | "areas" | "about";

// Labels are compared after lower-casing and dropping everything that isn't
// a letter or digit, so "Access to a car" is "accesstoacar".
const LABELS: Record<string, RawKey | "ignore"> = {
  name: "fullName",
  email: "email",
  phone: "phone",
  postcode: "postcode",
  accesstoacar: "hasCar",
  areastheycouldcover: "areas",
  aboutthemselves: "about",
  // The h2 above the table.
  newdistributorapplication: "ignore",
};

function labelKey(text: string): RawKey | "ignore" | null {
  const key = text.toLowerCase().replace(/[^a-z0-9]/g, "");
  return key && key.length <= 40 ? LABELS[key] ?? null : null;
}

export type LdbApplicationFields = Partial<Record<RawKey, string>>;

export function parseLdbApplicationTable(html: string): LdbApplicationFields {
  const found: LdbApplicationFields = {};
  for (const [label, value] of notificationTableRows(html)) {
    const key = labelKey(label);
    if (!key || key === "ignore" || found[key] !== undefined || !value) continue;
    found[key] = value;
  }
  return found;
}

export function parseLdbApplicationText(text: string): LdbApplicationFields {
  return readLabelledText(text, labelKey);
}

// What the email said, in the shape the LDB application intake accepts.
// "None selected" in the areas means no areas; Access to a car is Yes or No
// (anything else is left unread). The email's single Reply-To (the
// applicant) stands in for the email address when the body has none.
export function ldbApplicationIntakeShape(fields: LdbApplicationFields, replyTo: string | null): Record<string, unknown> {
  const { hasCar, areas, email, ...text } = fields;
  const car = hasCar?.trim().toLowerCase();
  return {
    ...text,
    ...(email ? { email } : replyTo ? { email: replyTo } : {}),
    ...(areas && !/^none selected$/i.test(areas.trim()) ? { areas } : {}),
    ...(car === "yes" || car === "no" ? { hasCar: car } : {}),
  };
}

// The LDB form asks for these, so the preview says when one couldn't be read.
// It never asks for an age, a licence or availability.
const ASKED_ON_FORM: ApplicationFieldKey[] = ["area", "hasCar"];

const FIELD_NAMES: Record<string, string> = {
  fullName: "name",
  phone: "phone number",
  email: "email address",
  postcode: "postcode",
  areas: "list of areas",
  about: "About themselves answer",
};

// The intake's reason, for staff. Its own errors name the JSON field.
function problemText(error: string): string {
  const m = error.match(/^(\w+) is (required|too long)$/) ?? error.match(/^Invalid (\w+)$/);
  const name = m ? FIELD_NAMES[m[1]] : undefined;
  if (!m || !name) return "This email couldn't be read";
  if (m[2] === "required") return `No ${name} could be read from this email`;
  if (m[2] === "too long") return `The ${name} in this email is too long`;
  return `The ${name} in this email isn't valid`;
}

// The table is read from the HTML; a plain text version, if there is one, is
// read too, and whichever gives more fields is used (the table on a tie).
export function readLdbApplication(message: gmail_v1.Schema$Message, ours: string[]): ParsedApplication {
  const replyHeader = message.payload?.headers?.find((h) => h.name?.toLowerCase() === "reply-to")?.value ?? null;
  const replyTo = singleReplyTo(replyHeader, ours)?.address ?? null;
  const html = htmlPart(message.payload);
  const { plain } = extractTextVariants(message.payload);
  const versions = [
    ...(html ? [parseLdbApplicationTable(html)] : []),
    ...(plain && plain.trim() ? [parseLdbApplicationText(plain)] : []),
  ];
  const fields = versions.reduce<LdbApplicationFields>(
    (best, v) => (Object.keys(v).length > Object.keys(best).length ? v : best),
    {}
  );
  const checked = validateLdbApplication(ldbApplicationIntakeShape(fields, replyTo));
  if (!checked.ok) {
    return {
      fields: {
        fullName: (fields.fullName?.trim() ?? "").slice(0, LDB_APPLICATION_LIMITS.fullName),
        phone: fields.phone?.trim().slice(0, LDB_APPLICATION_LIMITS.phone) || null,
        email: null,
        area: null,
        age: null,
        hasCar: null,
        hasLicence: null,
        availability: null,
      },
      missing: [],
      readable: false,
      problem: problemText(checked.error),
    };
  }
  const missing = ASKED_ON_FORM.filter((key) => checked.fields[key] === null || checked.fields[key] === "");
  return { fields: checked.fields, missing, readable: true };
}
