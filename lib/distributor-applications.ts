import { buildDistributorData } from "./distributors";

// Distributor applications: checking what the public form sends, matching
// phone numbers, reading application emails, and the database steps behind
// saving and approving. Everything that touches the database takes the
// client as an argument, so the rules are unit tested without one.

export const APPLICATION_STATUSES = ["NEW", "CONTACTED", "APPROVED", "NOT_SUITABLE"] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  APPROVED: "Approved",
  NOT_SUITABLE: "Not suitable",
};

export const APPLICATION_SOURCE_LABELS: Record<string, string> = {
  WEBSITE_FORM: "Website form",
  GMAIL_IMPORT: "Gmail import",
};

// Fired in the browser when applications change, so the CRM navigation
// refreshes its New count straight away.
export const APPLICATIONS_CHANGED_EVENT = "fdh:applications-changed";

export function isApplicationStatus(value: unknown): value is ApplicationStatus {
  return typeof value === "string" && (APPLICATION_STATUSES as readonly string[]).includes(value);
}

// Generous next to anything a real applicant types, tight enough that the
// endpoint can't be used to store junk.
export const APPLICATION_LIMITS = {
  fullName: 120,
  phone: 40,
  email: 254,
  area: 200,
  age: 10,
  availability: 2000,
  notes: 5000,
} as const;

export const APPLICATION_BODY_MAX_BYTES = 16_000;
export const DUPLICATE_WINDOW_DAYS = 7;

export type ApplicationFields = {
  fullName: string;
  phone: string | null;
  email: string | null;
  area: string | null;
  age: string | null;
  hasCar: boolean | null;
  hasLicence: boolean | null;
  availability: string | null;
};

export type ApplicationFieldKey = keyof ApplicationFields;

// How each field is named to staff, for "missing" lists and notes.
export const APPLICATION_FIELD_LABELS: Record<ApplicationFieldKey, string> = {
  fullName: "Name",
  phone: "Phone",
  email: "Email",
  area: "Where they live",
  age: "Age",
  hasCar: "Car access",
  hasLicence: "Full UK licence",
  availability: "Availability",
};

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

function collapse(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function tidyMultiline(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function yesNo(value: string): boolean | null {
  const v = value.trim().toLowerCase();
  if (v === "yes" || v === "y" || v === "true") return true;
  if (v === "no" || v === "n" || v === "false") return false;
  return null;
}

function digitsOf(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

function looksLikePhone(value: string): boolean {
  const digits = digitsOf(value).length;
  return digits >= 7 && digits <= 20 && !/[<>]|:\/\//.test(value);
}

// --- Phone numbers -----------------------------------------------------------

// One form of a UK number for matching: digits only, with +44 / 0044 turned
// back into a leading 0, so "+44 7700 900123" and "07700 900123" match.
export function normalizePhone(phone: string | null | undefined): string {
  let digits = digitsOf(phone);
  if (digits.startsWith("0044")) digits = digits.slice(2);
  if (digits.startsWith("44") && digits.length >= 12) {
    const rest = digits.slice(2);
    digits = rest.startsWith("0") ? rest : `0${rest}`;
  }
  return digits;
}

export function phonesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizePhone(a);
  return na.length >= 7 && na === normalizePhone(b);
}

export function telHref(phone: string | null | undefined): string | null {
  if (!phone || digitsOf(phone).length < 7) return null;
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

// wa.me needs the full international number with no + or leading zeros. A
// UK number written with a leading 0 is assumed to be +44.
export function whatsAppHref(phone: string | null | undefined): string | null {
  const raw = (phone ?? "").trim();
  let digits = digitsOf(raw);
  if (digits.length < 7) return null;
  if (!raw.startsWith("+")) {
    if (digits.startsWith("00")) digits = digits.slice(2);
    else if (digits.startsWith("0")) digits = `44${digits.slice(1)}`;
  }
  if (digits.startsWith("440")) digits = `44${digits.slice(3)}`;
  return `https://wa.me/${digits}`;
}

// --- The public form ---------------------------------------------------------

export type WebsiteApplicationResult =
  | { ok: true; honeypot: true }
  | { ok: true; honeypot: false; fields: ApplicationFields }
  | { ok: false; error: string };

const FORM_KEYS = ["name", "phone", "email", "area", "age", "has-car", "has-licence", "availability"] as const;

// Accepts anything the real Work With Us form can send and nothing else.
// Error messages are generic: the applicant never sees them (the form
// ignores this response) and they shouldn't help anyone probing the endpoint.
export function validateWebsiteApplication(raw: unknown, honeypotField: string): WebsiteApplicationResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, error: "Invalid application" };
  const body = raw as Record<string, unknown>;

  for (const key of [...FORM_KEYS, honeypotField]) {
    if (key in body && body[key] !== undefined && body[key] !== null && typeof body[key] !== "string") {
      return { ok: false, error: "Invalid application" };
    }
  }
  const text = (key: string) => (typeof body[key] === "string" ? (body[key] as string) : "");

  if (text(honeypotField).trim()) return { ok: true, honeypot: true };

  const fullName = collapse(text("name"));
  const phone = collapse(text("phone"));
  const email = text("email").trim();
  const area = collapse(text("area"));
  const age = text("age").trim();
  const hasCar = yesNo(text("has-car"));
  const hasLicence = yesNo(text("has-licence"));
  const availability = tidyMultiline(text("availability"));
  const ageNumber = Number(age);

  const valid =
    fullName.length > 0 &&
    fullName.length <= APPLICATION_LIMITS.fullName &&
    phone.length <= APPLICATION_LIMITS.phone &&
    looksLikePhone(phone) &&
    (email === "" || (email.length <= APPLICATION_LIMITS.email && EMAIL_RE.test(email))) &&
    area.length > 0 &&
    area.length <= APPLICATION_LIMITS.area &&
    age.length > 0 &&
    age.length <= APPLICATION_LIMITS.age &&
    Number.isFinite(ageNumber) &&
    ageNumber >= 1 &&
    ageNumber <= 120 &&
    hasCar !== null &&
    hasLicence !== null &&
    availability.length > 0 &&
    availability.length <= APPLICATION_LIMITS.availability;

  if (!valid) return { ok: false, error: "Invalid application" };

  return {
    ok: true,
    honeypot: false,
    fields: { fullName, phone, email: email || null, area, age, hasCar, hasLicence, availability },
  };
}

// --- Reading an application notification email ------------------------------

// Every way a field might be labelled in the email: the form's input names
// (as Web3Forms shows them, in any case or punctuation) and the labels on
// the form itself. Compared after lower-casing and dropping everything that
// isn't a letter or digit.
const LABELS: Record<string, ApplicationFieldKey | "ignore"> = {
  name: "fullName",
  fullname: "fullName",
  yourname: "fullName",
  phone: "phone",
  phonenumber: "phone",
  telephone: "phone",
  mobile: "phone",
  email: "email",
  emailaddress: "email",
  area: "area",
  wheredoyoulive: "area",
  location: "area",
  townorpostcode: "area",
  age: "age",
  hascar: "hasCar",
  car: "hasCar",
  caraccess: "hasCar",
  accesstoacar: "hasCar",
  haslicence: "hasLicence",
  haslicense: "hasLicence",
  licence: "hasLicence",
  license: "hasLicence",
  fulluklicence: "hasLicence",
  fulluklicense: "hasLicence",
  fullukdrivinglicence: "hasLicence",
  availability: "availability",
  available: "availability",
  whenareyouavailable: "availability",
  // Other things a form email can carry, so they never run into a field.
  subject: "ignore",
  accesskey: "ignore",
  botcheck: "ignore",
  fromname: "ignore",
  replyto: "ignore",
};

function labelKey(text: string): ApplicationFieldKey | "ignore" | null {
  const key = text.toLowerCase().replace(/[^a-z0-9]/g, "");
  return key && key.length <= 40 ? LABELS[key] ?? null : null;
}

// The end of the useful part of a form email.
function isFooter(line: string): boolean {
  return /web3forms|unsubscribe|^--\s*$|^sent from /i.test(line);
}

export type ParsedApplicationText = Partial<Record<ApplicationFieldKey, string>>;

// Reads "Label: value" lines and "Label" then value layouts (which is how an
// HTML table comes out as text). A value runs over following lines until a
// blank line, the next label or the email's footer.
export function parseApplicationText(text: string): ParsedApplicationText {
  const found: ParsedApplicationText = {};
  let current: ApplicationFieldKey | "ignore" | null = null;
  let buffer: string[] = [];

  function close() {
    if (current && current !== "ignore" && buffer.length > 0 && found[current] === undefined) {
      found[current] = buffer.join("\n");
    }
    current = null;
    buffer = [];
  }

  for (const rawLine of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      if (current && buffer.length > 0) close();
      continue;
    }
    if (isFooter(line)) {
      close();
      continue;
    }
    const colon = line.match(/^([^:]{1,60}?)\s*:\s*(.*)$/);
    const colonLabel = colon ? labelKey(colon[1]) : null;
    if (colon && colonLabel) {
      close();
      current = colonLabel;
      if (colon[2].trim()) buffer.push(colon[2].trim());
      continue;
    }
    const wholeLabel = labelKey(line.replace(/[?*]+$/, ""));
    if (wholeLabel) {
      close();
      current = wholeLabel;
      continue;
    }
    if (current) buffer.push(line);
  }
  close();
  return found;
}

export type ParsedApplication = {
  fields: ApplicationFields;
  // Fields the form requires that couldn't be read. Email is optional on the
  // form, so it is never listed.
  missing: ApplicationFieldKey[];
  // False when there's no name, which is the one thing a record needs.
  readable: boolean;
};

const REQUIRED_ON_FORM: ApplicationFieldKey[] = [
  "phone",
  "area",
  "age",
  "hasCar",
  "hasLicence",
  "availability",
];

function clip(value: string | undefined, max: number): string | null {
  if (!value) return null;
  const v = value.trim();
  return v ? v.slice(0, max) : null;
}

function toApplicationFields(parsed: ParsedApplicationText, replyTo: string | null): ApplicationFields {
  const email = parsed.email ? collapse(parsed.email) : "";
  const fallbackEmail = replyTo && EMAIL_RE.test(replyTo) ? replyTo : null;
  const phone = parsed.phone ? collapse(parsed.phone) : "";
  return {
    fullName: clip(parsed.fullName && collapse(parsed.fullName), APPLICATION_LIMITS.fullName) ?? "",
    phone: phone && looksLikePhone(phone) ? phone.slice(0, APPLICATION_LIMITS.phone) : null,
    email: email && EMAIL_RE.test(email) ? email.slice(0, APPLICATION_LIMITS.email) : fallbackEmail,
    area: clip(parsed.area && collapse(parsed.area), APPLICATION_LIMITS.area),
    age: clip(parsed.age && collapse(parsed.age), APPLICATION_LIMITS.age),
    hasCar: parsed.hasCar ? yesNo(parsed.hasCar) : null,
    hasLicence: parsed.hasLicence ? yesNo(parsed.hasLicence) : null,
    availability: clip(parsed.availability && tidyMultiline(parsed.availability), APPLICATION_LIMITS.availability),
  };
}

function countFound(fields: ApplicationFields): number {
  return Object.values(fields).filter((v) => v !== null && v !== "").length;
}

// The email may have a plain text part, an HTML part, or both. Each version
// is read and the one that yields more fields wins (plain text on a tie).
// replyTo is the email's single Reply-To address, used for the applicant's
// email when the body doesn't give one.
export function parseApplicationEmail(params: {
  plain: string | null;
  fromHtml: string | null;
  replyTo: string | null;
}): ParsedApplication {
  const candidates = [params.plain, params.fromHtml]
    .filter((t): t is string => !!t && t.trim().length > 0)
    .map((t) => toApplicationFields(parseApplicationText(t), params.replyTo));
  const fields =
    candidates.reduce<ApplicationFields | null>(
      (best, c) => (!best || countFound(c) > countFound(best) ? c : best),
      null
    ) ?? toApplicationFields({}, params.replyTo);

  const missing = REQUIRED_ON_FORM.filter((key) => fields[key] === null || fields[key] === "");
  return { fields, missing, readable: fields.fullName.length > 0 };
}

// --- Filters and search on the Applications page ------------------------------

export type ApplicationListItem = ApplicationFields & {
  id: string;
  status: ApplicationStatus;
};

export type ApplicationFilters = {
  status?: ApplicationStatus | "";
  car?: "yes" | "no" | "";
  licence?: "yes" | "no" | "";
  area?: string;
  q?: string;
};

function compact(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/\s+/g, "");
}

// Search covers name, phone (in any format) and where they live, which is
// where a postcode is given. Spaces are ignored, so "so15 2ab" finds
// "SO152AB".
export function matchesApplicationSearch(app: ApplicationListItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (app.fullName.toLowerCase().includes(q)) return true;
  const qDigits = digitsOf(q);
  if (qDigits.length >= 3 && qDigits.length === q.replace(/[\s()+\-.]/g, "").length) {
    const normalizedQuery = normalizePhone(q);
    if (normalizePhone(app.phone).includes(normalizedQuery) || digitsOf(app.phone).includes(qDigits)) return true;
  }
  return compact(app.area).includes(compact(q));
}

export function filterApplications<T extends ApplicationListItem>(apps: T[], filters: ApplicationFilters): T[] {
  const area = compact(filters.area);
  return apps.filter((a) => {
    if (filters.status && a.status !== filters.status) return false;
    if (filters.car && a.hasCar !== (filters.car === "yes")) return false;
    if (filters.licence && a.hasLicence !== (filters.licence === "yes")) return false;
    if (area && !compact(a.area).includes(area)) return false;
    return matchesApplicationSearch(a, filters.q ?? "");
  });
}

// --- Database steps -----------------------------------------------------------

export function formatNoteDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/London",
  }).format(date);
}

export type StoredApplication = ApplicationFields & {
  id: string;
  notes: string | null;
  receivedAt: Date;
};

// Narrow structural types: a route passes the real Prisma client, a test a
// plain object.
export type SaveApplicationDb = {
  distributorApplication: {
    findMany(args: {
      where: { receivedAt: { gte: Date }; phone: { not: null } };
      orderBy: { receivedAt: "desc" };
      take: number;
    }): Promise<StoredApplication[]>;
    create(args: {
      data: ApplicationFields & { source: "WEBSITE_FORM"; receivedAt: Date };
      select: { id: true };
    }): Promise<{ id: string }>;
    update(args: { where: { id: string }; data: { notes: string } }): Promise<unknown>;
  };
};

function describeChanges(existing: ApplicationFields, incoming: ApplicationFields): string[] {
  const lines: string[] = [];
  for (const key of Object.keys(APPLICATION_FIELD_LABELS) as ApplicationFieldKey[]) {
    const before = existing[key];
    const after = incoming[key];
    if (after === null || after === "" || after === before) continue;
    if (key === "phone" && phonesMatch(existing.phone, incoming.phone)) continue;
    const shown = typeof after === "boolean" ? (after ? "Yes" : "No") : after;
    lines.push(`${APPLICATION_FIELD_LABELS[key]}: ${shown}`);
  }
  return lines;
}

export type SaveApplicationResult = { created: true } | { created: false; duplicate: true };

// A second application from the same phone number within 7 days isn't saved
// again: the existing one gets a note saying they applied again, with any
// details that differ this time.
export async function saveWebsiteApplication(
  db: SaveApplicationDb,
  fields: ApplicationFields,
  now: Date = new Date()
): Promise<SaveApplicationResult> {
  const since = new Date(now.getTime() - DUPLICATE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const recent = await db.distributorApplication.findMany({
    where: { receivedAt: { gte: since }, phone: { not: null } },
    orderBy: { receivedAt: "desc" },
    take: 500,
  });
  const existing = recent.find((a) => phonesMatch(a.phone, fields.phone));

  if (existing) {
    const changes = describeChanges(existing, fields);
    const entry = [
      `Applied again through the website form on ${formatNoteDate(now)}.`,
      ...(changes.length ? ["Details that differ this time:", ...changes] : []),
    ].join("\n");
    const notes = existing.notes ? `${existing.notes}\n\n${entry}` : entry;
    if (notes.length <= APPLICATION_LIMITS.notes) {
      await db.distributorApplication.update({ where: { id: existing.id }, data: { notes } });
    }
    return { created: false, duplicate: true };
  }

  await db.distributorApplication.create({
    data: { ...fields, source: "WEBSITE_FORM", receivedAt: now },
    select: { id: true },
  });
  return { created: true };
}

function yesNoText(value: boolean | null): string {
  return value === null ? "not given" : value ? "Yes" : "No";
}

// What the new Distributor's notes say about where they came from.
export function distributorNotesFromApplication(app: StoredApplication): string {
  const lines = [`From their application received ${formatNoteDate(app.receivedAt)}.`];
  if (app.area) lines.push(`Lives in: ${app.area}`);
  if (app.age) lines.push(`Age: ${app.age}`);
  lines.push(`Car access: ${yesNoText(app.hasCar)}. Full UK licence: ${yesNoText(app.hasLicence)}.`);
  if (app.availability) lines.push(`Availability: ${app.availability}`);
  if (app.notes) lines.push("", app.notes);
  return lines.join("\n");
}

// The Distributor an approved application becomes: the same shared rules as
// adding one by hand, with the application's details in the notes. Used by
// the single Approve button and by the bulk move, so both create alike.
export function distributorDataFromApplication(app: StoredApplication) {
  return buildDistributorData({
    name: app.fullName,
    phone: app.phone,
    email: app.email,
    notes: distributorNotesFromApplication(app),
  });
}

type ApproveTx = {
  distributorApplication: {
    findUnique(args: { where: { id: string } }): Promise<(StoredApplication & { distributorId: string | null }) | null>;
    updateMany(args: {
      where: { id: string; distributorId: null };
      data: { distributorId: string; status: "APPROVED" };
    }): Promise<{ count: number }>;
  };
  distributor: {
    create(args: {
      data: { name: string; phone: string | null; email: string | null; notes: string | null };
      select: { id: true; name: true };
    }): Promise<{ id: string; name: string }>;
  };
};

export type ApproveDb = {
  $transaction<T>(fn: (tx: ApproveTx) => Promise<T>): Promise<T>;
};

class AlreadyLinkedError extends Error {}

export type ApproveResult =
  | { ok: true; distributor: { id: string; name: string } }
  | { ok: false; reason: "not_found" | "already_linked" | "invalid" };

// Only ever run from the "Approve and add as distributor" button. Creating
// the Distributor and linking it happen together: if the application was
// linked in the meantime (a double click, say), nothing is created.
export async function approveApplicationAsDistributor(db: ApproveDb, id: string): Promise<ApproveResult> {
  try {
    return await db.$transaction(async (tx) => {
      const app = await tx.distributorApplication.findUnique({ where: { id } });
      if (!app) return { ok: false, reason: "not_found" } as const;
      if (app.distributorId) return { ok: false, reason: "already_linked" } as const;

      const built = distributorDataFromApplication(app);
      if (!built.ok) return { ok: false, reason: "invalid" } as const;

      const distributor = await tx.distributor.create({ data: built.data, select: { id: true, name: true } });
      const linked = await tx.distributorApplication.updateMany({
        where: { id, distributorId: null },
        data: { distributorId: distributor.id, status: "APPROVED" },
      });
      if (linked.count !== 1) throw new AlreadyLinkedError();
      return { ok: true, distributor } as const;
    });
  } catch (err) {
    if (err instanceof AlreadyLinkedError) return { ok: false, reason: "already_linked" };
    throw err;
  }
}
