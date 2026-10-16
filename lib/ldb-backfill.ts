import type { gmail_v1 } from "@googleapis/gmail";
import { convert as htmlToText } from "html-to-text";
import {
  extractTextVariants,
  mapWithConcurrency,
  parseMailbox,
  shouldExcludeThread,
  singleReplyTo,
  type GmailMessageReader,
} from "./gmail";
import { enquiryNote, ldbLeadData, validateLdbEnquiry, type LdbEnquiry } from "./ldb-intake";
import { normalizePhone } from "./distributor-applications";
import { ukDay } from "./dashboard";

// Backfilling past Leaflet Distribution Bournemouth website enquiries from the
// shared Gmail (scripts/backfill-ldb-enquiries.ts). Gmail is only searched and
// read.
//
// The LDB website's notifications are sent by Brevo straight to the shared
// Gmail, from team@leafletdistributionbournemouth.co.uk, Reply-To the
// enquirer, with the subject "<Service> enquiry from <name>" ("Quote enquiry
// from <name>" briefly on 2026-07-29). The body is an h2 heading and a
// two-column table of label and value rows. Each notification is read into
// the fields the intake endpoint accepts and checked by the same validation,
// so an imported lead is built and noted exactly like a new one
// (lib/ldb-intake.ts), with two more note lines: "Imported from Gmail" and the
// Gmail message ID, which is how a second run knows what it has already
// imported.

export const DEFAULT_FROM = "team@leafletdistributionbournemouth.co.uk";
// Every subject a notification has had, each followed by the enquirer's name.
export const SUBJECT_PREFIXES = [
  "Leaflet Distribution enquiry from ",
  "Public Notice Leafleting enquiry from ",
  "Quote enquiry from ",
] as const;
export const IMPORTED_LINE = "Imported from Gmail";
export const MESSAGE_ID_PREFIX = "Gmail message ID: ";
export const OLD_ENQUIRY_DAYS = 30;
export const LOST_NOTE = "Imported old enquiry, no reply on record";
export const SCAN_MAX = 2000;
const THREAD_CONCURRENCY = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

// The stages an imported lead can start in. Never Won or Completed, which
// need a won date and stage history (lib/lead-stage.ts).
export const BACKFILL_STAGES = ["UNCONTACTED", "AWAITING_RESPONSE", "LOST"] as const;
export type BackfillStage = (typeof BACKFILL_STAGES)[number];

export type BackfillOptions = {
  // Who sends the notifications.
  from: string;
  since: string | null;
  stage: BackfillStage | null;
  includeDuplicates: boolean;
  apply: boolean;
};

// --- Options --------------------------------------------------------------------

const EMAIL_RE = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/;

function validDay(day: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const d = new Date(`${day}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === day;
}

export function parseBackfillArgs(argv: string[]): { ok: true; options: BackfillOptions } | { ok: false; error: string } {
  const values: Record<string, string> = {};
  const flags = new Set<string>();
  for (const arg of argv) {
    const m = arg.match(/^--([a-z-]+)(?:=([\s\S]*))?$/);
    if (!m) return { ok: false, error: `Unknown argument: ${arg}` };
    const [, key, value] = m;
    if (key === "subject") return { ok: false, error: "--subject is no longer needed: the notification subjects are built in" };
    if (["apply", "include-duplicates"].includes(key) && value === undefined) flags.add(key);
    else if (["from", "since", "stage"].includes(key) && value !== undefined) values[key] = value;
    else return { ok: false, error: `Unknown or incomplete option: --${key}` };
  }
  const from = (values.from ?? DEFAULT_FROM).trim().toLowerCase();
  if (!EMAIL_RE.test(from)) return { ok: false, error: "--from must be an email address" };
  const since = values.since ?? null;
  if (since !== null && !validDay(since)) return { ok: false, error: "--since must be a date like 2026-01-31" };
  const chosen = values.stage ?? null;
  if (chosen !== null && !(BACKFILL_STAGES as readonly string[]).includes(chosen)) {
    return { ok: false, error: `--stage must be one of ${BACKFILL_STAGES.join(", ")}` };
  }
  return {
    ok: true,
    options: {
      from,
      since,
      stage: chosen as BackfillStage | null,
      includeDuplicates: flags.has("include-duplicates"),
      apply: flags.has("apply"),
    },
  };
}

// --- Reading a notification ---------------------------------------------------------

// The intake field each row of the notification's table is, by its label.
// Labels are compared after lower-casing and dropping everything that isn't a
// letter or digit, so "Company / Organisation" is "companyorganisation".
type RawKey =
  | "name"
  | "email"
  | "phone"
  | "businessName"
  | "service"
  | "areas"
  | "quantity"
  | "startDate"
  | "includePrinting"
  | "includeDesign"
  | "projectLocation"
  | "deadline"
  | "scale"
  | "budget"
  | "message";

const LABELS: Record<string, RawKey | "ignore"> = {
  name: "name",
  email: "email",
  phone: "phone",
  companyorganisation: "businessName",
  service: "service",
  areas: "areas",
  approximatequantity: "quantity",
  campaignstartdate: "startDate",
  includeprinting: "includePrinting",
  includedesign: "includeDesign",
  projectsitelocation: "projectLocation",
  consultationpublicitydeadline: "deadline",
  approximatescaleofdistribution: "scale",
  approximatebudget: "budget",
  additionaldetails: "message",
  // The h2 above the table, "New Quote Enquiry: <service>".
  newquoteenquiry: "ignore",
};

function labelKey(text: string): RawKey | "ignore" | null {
  const key = text.toLowerCase().replace(/[^a-z0-9]/g, "");
  return key && key.length <= 40 ? LABELS[key] ?? null : null;
}

function isFooter(line: string): boolean {
  return /unsubscribe|^--\s*$|^sent from |brevo|sendinblue|^-{3,} ?forwarded message/i.test(line);
}

export type NotificationFields = Partial<Record<RawKey, string>>;

// The innermost table rows (so a layout table around the data table is
// never read as a row), each with exactly a label cell and a value cell.
const ROW_RE = /<tr\b[^>]*>((?:(?!<\/?(?:tr|table)\b)[\s\S])*?)<\/tr>/gi;
const CELL_RE = /<t([dh])\b[^>]*>([\s\S]*?)<\/t\1>/gi;
const CELL_TEXT = {
  wordwrap: false as const,
  selectors: [
    { selector: "a", options: { ignoreHref: true } },
    { selector: "img", format: "skip" },
  ],
};

// Reads the notification's table, a label and its value per row, straight
// from the HTML, so a value can never run into the next row. The heading and
// anything outside the table are ignored.
export function parseNotificationTable(html: string): NotificationFields {
  const found: NotificationFields = {};
  for (const row of html.matchAll(ROW_RE)) {
    const cells = [...row[1].matchAll(CELL_RE)].map((c) => htmlToText(c[2], CELL_TEXT).trim());
    if (cells.length !== 2) continue;
    const key = labelKey(cells[0]);
    if (!key || key === "ignore" || found[key] !== undefined || !cells[1]) continue;
    found[key] = cells[1];
  }
  return found;
}

// For a notification without its HTML part: "Label: value" lines, or a label
// line then its value (how a table comes out as text). A value runs over
// following lines until a blank line, the next label or the footer.
export function parseNotificationText(text: string): NotificationFields {
  const found: NotificationFields = {};
  let current: RawKey | "ignore" | null = null;
  let buffer: string[] = [];

  function close() {
    if (current && current !== "ignore" && buffer.length > 0 && found[current] === undefined) {
      found[current] = buffer.join(current === "areas" ? ", " : "\n");
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

const YES_RE = /^(yes|y|true|on|1|ticked|checked)$/i;

// The website posts the service to the intake endpoint as a code, and the
// notification shows its name; imported leads get the code, so their note
// reads the same as a new lead's. Any other service is kept as shown.
const SERVICE_CODES: Record<string, string> = {
  "leaflet distribution": "leaflet-distribution",
  "public notice leafleting": "public-notice-leafleting",
};

export function serviceCode(service: string): string {
  return SERVICE_CODES[service.replace(/\s+/g, " ").trim().toLowerCase()] ?? service;
}

// What the email said, in the shape the intake endpoint accepts. "None
// selected" in Areas means no areas.
export function intakeShape(fields: NotificationFields, replyTo: string | null): Record<string, unknown> {
  const { includePrinting, includeDesign, areas, service, ...text } = fields;
  return {
    ...text,
    ...(service ? { service: serviceCode(service) } : {}),
    ...(areas && !/^none selected$/i.test(areas.trim()) ? { areas } : {}),
    ...(text.email ? {} : replyTo ? { email: replyTo } : {}),
    includePrinting: includePrinting !== undefined && YES_RE.test(includePrinting.trim()),
    includeDesign: includeDesign !== undefined && YES_RE.test(includeDesign.trim()),
  };
}

function header(message: gmail_v1.Schema$Message, name: string): string | null {
  return message.payload?.headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? null;
}

function tidySubject(s: string | null): string {
  return (s ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

// "Leaflet Distribution enquiry from Sarah" and the other two forms, with a
// name after them. A reply ("Re: ...") or forward ("Fwd: ...") never starts so.
export function isNotificationSubject(subject: string | null): boolean {
  const tidy = tidySubject(subject);
  return SUBJECT_PREFIXES.some((p) => {
    const prefix = p.toLowerCase();
    return tidy.startsWith(prefix) && tidy.length > prefix.length;
  });
}

export function receivedAt(message: gmail_v1.Schema$Message): Date {
  if (message.internalDate) return new Date(Number(message.internalDate));
  const parsed = new Date(header(message, "Date") ?? "");
  return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
}

function addressesIn(message: gmail_v1.Schema$Message, headers: string[]): string[] {
  return headers
    .flatMap((h) => (header(message, h) ?? "").split(","))
    .map((part) => parseMailbox(part).address.toLowerCase())
    .filter(Boolean);
}

// A notification itself: from the notification sender with one of the
// notification subjects, sent to us with the enquirer as Reply-To, and not
// something we sent or drafted. The CRM's own emails to a Bournemouth lead
// come from the same address and can arrive here (their BCC to the LDB
// address), but they go to the lead with Reply-To the LDB address, so they
// are never notifications. ours is every address of ours.
export function isNotification(message: gmail_v1.Schema$Message, from: string, ours: string[]): boolean {
  const labels = message.labelIds ?? [];
  if (labels.includes("SENT") || labels.includes("DRAFT")) return false;
  if (parseMailbox(header(message, "From")).address.toLowerCase() !== from) return false;
  if (!isNotificationSubject(header(message, "Subject"))) return false;
  const to = addressesIn(message, ["To", "Cc"]);
  if (to.length === 0 || to.some((a) => !ours.includes(a))) return false;
  const replyTo = addressesIn(message, ["Reply-To"]);
  return !replyTo.some((a) => ours.includes(a));
}

export type ReadNotification =
  | { ok: true; enquiry: LdbEnquiry }
  | { ok: false; reason: string; name: string | null; email: string | null; phone: string | null };

function htmlPart(part: gmail_v1.Schema$MessagePart | undefined): string | null {
  if (!part) return null;
  if (part.mimeType === "text/html" && part.body?.data && !part.filename) {
    return Buffer.from(part.body.data, "base64url").toString("utf-8");
  }
  for (const child of part.parts ?? []) {
    const found = htmlPart(child);
    if (found) return found;
  }
  return null;
}

// The table is read from the HTML; a plain text version, if there is one, is
// read too, and whichever gives more fields is used (the table on a tie). The
// email's single Reply-To (the enquirer) stands in for the email address when
// the body has none.
export function readNotification(message: gmail_v1.Schema$Message, ours: string[]): ReadNotification {
  const replyTo = singleReplyTo(header(message, "Reply-To"), ours)?.address ?? null;
  const html = htmlPart(message.payload);
  const { plain } = extractTextVariants(message.payload);
  const versions = [
    ...(html ? [parseNotificationTable(html)] : []),
    ...(plain && plain.trim() ? [parseNotificationText(plain)] : []),
  ];
  const fields = versions.reduce<NotificationFields>(
    (best, v) => (Object.keys(v).length > Object.keys(best).length ? v : best),
    {}
  );
  const raw = intakeShape(fields, replyTo);
  const checked = validateLdbEnquiry(raw);
  if (checked.ok) return { ok: true, enquiry: checked.enquiry };
  return { ok: false, reason: checked.error, name: fields.name ?? null, email: (raw.email as string | undefined) ?? null, phone: fields.phone ?? null };
}

// --- Stage -------------------------------------------------------------------------

// We replied: a later message in the thread from one of our addresses (the
// Bournemouth address or the Hampshire Gmail) that isn't itself a
// notification. When the enquiry has an email address, the reply has to be
// to it, because Gmail can put several notifications in one thread.
export function hasLaterReply(
  thread: gmail_v1.Schema$Thread,
  notification: gmail_v1.Schema$Message,
  enquiryEmail: string | null,
  from: string,
  ours: string[]
): boolean {
  const after = receivedAt(notification).getTime();
  return (thread.messages ?? []).some((m) => {
    if (m.id === notification.id || (m.labelIds ?? []).includes("DRAFT")) return false;
    if (receivedAt(m).getTime() <= after) return false;
    if (!ours.includes(parseMailbox(header(m, "From")).address.toLowerCase())) return false;
    if (isNotification(m, from, ours)) return false;
    return !enquiryEmail || addressesIn(m, ["To", "Cc"]).includes(enquiryEmail.toLowerCase());
  });
}

export function suggestStage(params: { replied: boolean; receivedAt: Date; now: Date }): BackfillStage {
  if (params.replied) return "AWAITING_RESPONSE";
  return params.now.getTime() - params.receivedAt.getTime() > OLD_ENQUIRY_DAYS * DAY_MS ? "LOST" : "UNCONTACTED";
}

// --- Duplicates and what was imported before ---------------------------------

export type Contact = { id: string | null; name: string; email: string | null; phone: string | null; when?: Date };

// Same email (any capitalisation) or the same phone in any format.
export function matchingContacts(enquiry: Pick<LdbEnquiry, "email" | "phone">, contacts: Contact[]): Contact[] {
  const email = enquiry.email?.toLowerCase() ?? null;
  const phone = normalizePhone(enquiry.phone);
  return contacts.filter(
    (c) =>
      (email !== null && c.email?.trim().toLowerCase() === email) ||
      (phone.length >= 7 && normalizePhone(c.phone) === phone)
  );
}

const MESSAGE_ID_RE = new RegExp(`^${MESSAGE_ID_PREFIX}(\\S+)$`, "gm");

export function importedMessageIds(notes: { detail: string }[]): Set<string> {
  const ids = new Set<string>();
  for (const n of notes) for (const m of n.detail.matchAll(MESSAGE_ID_RE)) ids.add(m[1]);
  return ids;
}

export function importNote(enquiry: LdbEnquiry, duplicates: { id: string; name: string }[], messageId: string): string {
  return [enquiryNote(enquiry, duplicates), IMPORTED_LINE, `${MESSAGE_ID_PREFIX}${messageId}`].join("\n");
}

// --- The plan ----------------------------------------------------------------------

export type SkipKind = "imported" | "unreadable" | "duplicate" | "excluded";

export type PlanRow = {
  messageId: string;
  threadId: string;
  receivedAt: Date;
  name: string | null;
  email: string | null;
  phone: string | null;
  areas: string | null;
  enquiry: LdbEnquiry | null;
  replied: boolean;
  suggestedStage: BackfillStage;
  stage: BackfillStage;
  skip: { kind: SkipKind; reason: string } | null;
  // Matching leads, imported anyway with --include-duplicates.
  duplicates: Contact[];
};

export type BackfillDb = {
  lead: {
    findMany(args: { where?: any; select: { id: true; name: true; email: true; phone: true } }): Promise<
      { id: string; name: string; email: string | null; phone: string | null }[]
    >;
  };
  activity: {
    findMany(args: { where: any; select: { detail: true } }): Promise<{ detail: string }[]>;
  };
};

function describeContact(c: Contact): string {
  if (c.id) return `${c.name} (${c.id})`;
  return `${c.name}, an earlier enquiry in this import${c.when ? ` (${ukDay(c.when)})` : ""}`;
}

export async function loadImportedIds(db: BackfillDb): Promise<Set<string>> {
  return importedMessageIds(
    await db.activity.findMany({ where: { detail: { contains: MESSAGE_ID_PREFIX } }, select: { detail: true } })
  );
}

export async function loadContacts(db: BackfillDb): Promise<Contact[]> {
  return db.lead.findMany({
    where: { OR: [{ email: { not: null } }, { phone: { not: null } }] },
    select: { id: true, name: true, email: true, phone: true },
  });
}

// Gmail's subject search matches words, not the start of a subject, so this
// finds every "... enquiry from ..." from the sender (replies included), and
// each message is then checked by isNotification.
export function gmailQuery(options: Pick<BackfillOptions, "from" | "since">): string {
  const parts = [`from:${options.from}`, `subject:"enquiry from"`];
  if (options.since) {
    // A day early: Gmail's after: is by its own clock; the exact cut is below.
    const day = new Date(Date.parse(`${options.since}T00:00:00Z`) - DAY_MS).toISOString().slice(0, 10);
    parts.push(`after:${day.replace(/-/g, "/")}`);
  }
  return parts.join(" ");
}

// Every notification found, oldest first, each with what would happen to it.
// Nothing is written here. imported and contacts come from the database first
// (loadImportedIds, loadContacts), so Gmail is only read once they're known.
export async function planBackfill(params: {
  reader: GmailMessageReader;
  imported: Set<string>;
  contacts: Contact[];
  options: BackfillOptions;
  // Every address of ours: the Hampshire Gmail and the Bournemouth address.
  // The notification sender is added. Replies from any of them count, and
  // none is ever taken as the enquirer's Reply-To.
  ours: string[];
  // Threads touching any of these are left out, as in the inbox.
  excluded: string[];
  now: Date;
  max?: number;
}): Promise<{ rows: PlanRow[]; truncated: boolean }> {
  const { reader, imported, options, now } = params;
  const max = params.max ?? SCAN_MAX;
  const refs: { id: string; threadId: string }[] = [];
  let pageToken: string | undefined;
  let truncated = false;
  do {
    const page = await reader.listMessageIds(gmailQuery(options), pageToken);
    refs.push(...page.messages);
    pageToken = page.nextPageToken ?? undefined;
    if (refs.length >= max) {
      truncated = refs.length > max || !!pageToken;
      break;
    }
  } while (pageToken);
  const wanted = new Set(refs.slice(0, max).map((r) => r.id));

  const threadIds = [...new Set(refs.slice(0, max).map((r) => r.threadId))];
  const threads = (await mapWithConcurrency(threadIds, THREAD_CONCURRENCY, (id) => reader.getThread(id))).filter(
    (t): t is gmail_v1.Schema$Thread => !!t
  );
  const ours = [...new Set([...params.ours, options.from].map((a) => a.toLowerCase()))];
  const found = threads
    .flatMap((thread) =>
      (thread.messages ?? [])
        .filter((m) => m.id && wanted.has(m.id) && isNotification(m, options.from, ours))
        .map((message) => ({ thread, message }))
    )
    .filter(({ message }) => !options.since || ukDay(receivedAt(message)) >= options.since)
    .sort((a, b) => receivedAt(a.message).getTime() - receivedAt(b.message).getTime());

  const seen: Contact[] = [...params.contacts];
  const rows: PlanRow[] = [];

  for (const { thread, message } of found) {
    const messageId = message.id as string;
    const when = receivedAt(message);
    const read = readNotification(message, ours);
    const enquiry = read.ok ? read.enquiry : null;
    const replied = hasLaterReply(thread, message, enquiry?.email ?? (read.ok ? null : read.email), options.from, ours);
    const suggestedStage = suggestStage({ replied, receivedAt: when, now });
    const row: PlanRow = {
      messageId,
      threadId: message.threadId ?? thread.id ?? "",
      receivedAt: when,
      name: read.ok ? read.enquiry.name : read.name,
      email: read.ok ? read.enquiry.email : read.email,
      phone: read.ok ? read.enquiry.phone : read.phone,
      areas: enquiry ? enquiry.areas ?? enquiry.projectLocation : null,
      enquiry,
      replied,
      suggestedStage,
      stage: options.stage ?? suggestedStage,
      skip: null,
      duplicates: [],
    };
    if (imported.has(messageId)) {
      row.skip = { kind: "imported", reason: "Already imported" };
    } else if (shouldExcludeThread(thread.messages, params.excluded)) {
      row.skip = { kind: "excluded", reason: "Thread involves an excluded address" };
    } else if (!read.ok) {
      row.skip = { kind: "unreadable", reason: `Could not read: ${read.reason}` };
    } else {
      row.duplicates = matchingContacts(read.enquiry, seen);
      if (row.duplicates.length > 0 && !options.includeDuplicates) {
        row.skip = { kind: "duplicate", reason: `Matches ${row.duplicates.map(describeContact).join("; ")}` };
      }
    }
    if (!row.skip && enquiry) seen.push({ id: null, name: enquiry.name, email: enquiry.email, phone: enquiry.phone, when });
    rows.push(row);
  }
  return { rows, truncated };
}

// --- Writing -------------------------------------------------------------------

export type BackfillTx = {
  activity: { findMany(args: { where: any; select: { detail: true } }): Promise<{ detail: string }[]> };
  lead: { create(args: { data: any; select: { id: true } }): Promise<{ id: string }> };
};

export type ApplyDb = BackfillDb & {
  $transaction<T>(fn: (tx: BackfillTx) => Promise<T>): Promise<T>;
};

export function leadDataFor(row: PlanRow, duplicates: { id: string; name: string }[]) {
  if (!row.enquiry) throw new Error("Only a readable enquiry can be imported");
  const lost = row.stage === "LOST";
  return ldbLeadData(row.enquiry, importNote(row.enquiry, duplicates, row.messageId), {
    createdAt: row.receivedAt,
    stage: row.stage,
    ...(lost ? { lostReason: "OTHER" as const, lostReasonNote: row.replied ? "Imported old enquiry" : LOST_NOTE } : {}),
  });
}

// Each lead and its note in one transaction, oldest first. The message ID is
// checked again inside the transaction, so a row imported since the preview
// is skipped, not doubled. With --include-duplicates the note names every
// matching lead, including ones made earlier in this run.
export async function applyBackfill(
  db: ApplyDb,
  rows: PlanRow[]
): Promise<{ created: number; alreadyImported: number }> {
  const contacts = await loadContacts(db);
  let created = 0;
  let alreadyImported = 0;
  for (const row of rows) {
    if (row.skip || !row.enquiry) continue;
    const marker = `${MESSAGE_ID_PREFIX}${row.messageId}`;
    const duplicates = matchingContacts(row.enquiry, contacts).flatMap((c) => (c.id ? [{ id: c.id, name: c.name }] : []));
    const lead = await db.$transaction(async (tx) => {
      const notes = await tx.activity.findMany({ where: { detail: { contains: marker } }, select: { detail: true } });
      if (importedMessageIds(notes).has(row.messageId)) return null;
      return tx.lead.create({ data: leadDataFor(row, duplicates), select: { id: true } });
    });
    if (!lead) {
      alreadyImported++;
      continue;
    }
    created++;
    contacts.push({ id: lead.id, name: row.enquiry.name, email: row.enquiry.email, phone: row.enquiry.phone });
  }
  return { created, alreadyImported };
}

// --- The preview table -------------------------------------------------------------

const STAGE_NAMES: Record<BackfillStage, string> = {
  UNCONTACTED: "Uncontacted",
  AWAITING_RESPONSE: "Awaiting Response",
  LOST: "Lost",
};

function pad(text: string, width: number): string {
  const cut = text.length > width ? `${text.slice(0, width - 3)}...` : text;
  return cut.padEnd(width);
}

export function previewTable(rows: PlanRow[]): string[] {
  const head = `${pad("Date (UK)", 10)}  ${pad("Name", 22)}  ${pad("Email", 26)}  ${pad("Phone", 14)}  ${pad("Areas", 24)}  ${pad("Stage", 17)}  Skip reason`;
  return [
    head,
    "-".repeat(head.length + 12),
    ...rows.map(
      (r) =>
        `${pad(ukDay(r.receivedAt), 10)}  ${pad(r.name ?? "-", 22)}  ${pad(r.email ?? "-", 26)}  ${pad(r.phone ?? "-", 14)}  ` +
        `${pad(r.areas ?? "-", 24)}  ${pad(r.skip ? "-" : STAGE_NAMES[r.stage], 17)}  ${r.skip?.reason ?? ""}`.trimEnd()
    ),
  ];
}

export function summaryLine(rows: PlanRow[]): string {
  const toImport = rows.filter((r) => !r.skip);
  const count = (stage: BackfillStage) => toImport.filter((r) => r.stage === stage).length;
  const skipped = (kind: SkipKind) => rows.filter((r) => r.skip?.kind === kind).length;
  const n = (k: number, word: string) => `${k} ${word}${k === 1 ? "" : "s"}`;
  return (
    `Summary: ${n(rows.length, "notification")} found. ${toImport.length} to import ` +
    `(${count("UNCONTACTED")} Uncontacted, ${count("AWAITING_RESPONSE")} Awaiting Response, ${count("LOST")} Lost). ` +
    `${rows.length - toImport.length} skipped (${n(skipped("duplicate"), "duplicate")}, ${skipped("unreadable")} unreadable, ` +
    `${skipped("imported")} already imported, ${skipped("excluded")} excluded).`
  );
}
