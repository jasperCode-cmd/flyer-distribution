import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

// Enquiries from the Leaflet Distribution Bournemouth website, posted to
// POST /api/crm/intake/ldb by the LDB site's server. Not a user session: the
// caller proves itself with the X-Intake-Secret header, compared in constant
// time with LDB_INTAKE_SECRET (401 otherwise, and always 401 when the secret
// isn't set). Every field is checked and length-limited, the rate is capped
// with database counts (all LDB intake in the last hour, and a smaller cap
// per email or phone), and a possible duplicate is noted on the new lead the
// way the FDH form does it. A good enquiry becomes an LDB lead, source Website
// Quote Form, stage Uncontacted, with a note of what was asked, and the reply
// is only {"ok":true}. Nothing about the enquiry is ever logged.

export const LDB_INTAKE_PER_HOUR = 30;
export const LDB_INTAKE_PER_CONTACT_PER_HOUR = 3;
export const MAX_INTAKE_BYTES = 20_000;

const HOUR_MS = 60 * 60 * 1000;
const OK = { ok: true } as const;

// The field limits, so the LDB form can enforce the same.
export const INTAKE_LIMITS = {
  name: 100,
  email: 254,
  phone: 30,
  businessName: 120,
  postcode: 10,
  areas: 300,
  quantity: 50,
  service: 100,
  budget: 50,
  startDate: 50,
  message: 2000,
  projectLocation: 200,
  deadline: 50,
  scale: 100,
} as const;

type FieldName = keyof typeof INTAKE_LIMITS;

// Each field and the names the LDB site may send it under (the FDH quote
// form's names are accepted too, so the same form markup works). Areas may
// also come as a list of strings.
const FIELD_KEYS: Record<Exclude<FieldName, "name">, string[]> = {
  email: ["email"],
  phone: ["phone"],
  businessName: ["businessName", "company"],
  postcode: ["postcode"],
  areas: ["areas", "areas-required", "targetAreas"],
  quantity: ["quantity"],
  service: ["service"],
  budget: ["budget"],
  startDate: ["startDate", "campaign-start-date"],
  message: ["message"],
  projectLocation: ["projectLocation"],
  deadline: ["deadline"],
  scale: ["scale"],
};

// Yes/no fields, under every name they may come as.
const PRINTING_KEYS = ["printingIncluded", "printing-included", "includePrinting"];
const DESIGN_KEYS = ["designIncluded", "include-design", "includeDesign"];

const EMAIL_RE = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/;
const PHONE_RE = /^\+?[0-9 ()-]{7,30}$/;

export type LdbEnquiry = {
  name: string;
  email: string | null;
  phone: string | null;
  businessName: string | null;
  postcode: string | null;
  areas: string | null;
  quantity: string | null;
  service: string | null;
  budget: string | null;
  startDate: string | null;
  message: string | null;
  projectLocation: string | null;
  deadline: string | null;
  scale: string | null;
  printingIncluded: boolean;
  designIncluded: boolean;
};

// Control characters out (line breaks kept only in the message), spacing
// tidied.
function clean(value: string, multiline: boolean): string {
  // eslint-disable-next-line no-control-regex
  const stripped = value.replace(multiline ? /[\u0000-\u0009\u000B-\u001F\u007F]/g : /[\u0000-\u001F\u007F]/g, " ");
  return multiline ? stripped.replace(/[ \t]+\n/g, "\n").trim() : stripped.replace(/\s+/g, " ").trim();
}

function yes(value: unknown): boolean {
  return value === true || value === "yes" || value === "true" || value === "on";
}

export function validateLdbEnquiry(raw: unknown): { ok: true; enquiry: LdbEnquiry } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, error: "Invalid enquiry" };
  const data = raw as Record<string, unknown>;

  const text = (key: string, multiline = false): string | null | undefined => {
    const value = data[key];
    if (value === undefined || value === null) return null;
    if (typeof value !== "string") return undefined;
    return clean(value, multiline) || null;
  };
  // A list of areas is joined with ", ", each one tidied and empty ones
  // dropped; the length limit is on the joined text.
  const areas = (key: string): string | null | undefined => {
    const value = data[key];
    if (!Array.isArray(value)) return text(key);
    if (!value.every((item) => typeof item === "string")) return undefined;
    return value.map((item) => clean(item, false)).filter(Boolean).join(", ") || null;
  };

  const out: Partial<Record<FieldName, string | null>> = {};
  for (const [field, keys] of Object.entries(FIELD_KEYS) as [Exclude<FieldName, "name">, string[]][]) {
    let found: string | null = null;
    for (const key of keys) {
      const value = field === "areas" ? areas(key) : text(key, field === "message");
      if (value === undefined) return { ok: false, error: `Invalid ${field}` };
      if (value) {
        found = value;
        break;
      }
    }
    if (found && found.length > INTAKE_LIMITS[field]) return { ok: false, error: `${field} is too long` };
    out[field] = found;
  }

  const first = text("first-name") ?? text("firstName");
  const last = text("last-name") ?? text("lastName");
  const whole = text("name");
  if (whole === undefined || first === undefined || last === undefined) return { ok: false, error: "Invalid name" };
  const name = whole ?? [first, last].filter(Boolean).join(" ");
  if (!name) return { ok: false, error: "Name is required" };
  if (name.length > INTAKE_LIMITS.name) return { ok: false, error: "name is too long" };

  if (!out.email && !out.phone) return { ok: false, error: "An email address or phone number is required" };
  if (out.email && !EMAIL_RE.test(out.email)) return { ok: false, error: "Invalid email" };
  if (out.phone && (!PHONE_RE.test(out.phone) || out.phone.replace(/\D/g, "").length < 7)) {
    return { ok: false, error: "Invalid phone" };
  }

  return {
    ok: true,
    enquiry: {
      name,
      email: out.email ?? null,
      phone: out.phone ?? null,
      businessName: out.businessName ?? null,
      postcode: out.postcode ? out.postcode.toUpperCase() : null,
      areas: out.areas ?? null,
      quantity: out.quantity ?? null,
      service: out.service ?? null,
      budget: out.budget ?? null,
      startDate: out.startDate ?? null,
      message: out.message ?? null,
      projectLocation: out.projectLocation ?? null,
      deadline: out.deadline ?? null,
      scale: out.scale ?? null,
      printingIncluded: PRINTING_KEYS.some((key) => yes(data[key])),
      designIncluded: DESIGN_KEYS.some((key) => yes(data[key])),
    },
  };
}

// Equal-length digests, so the comparison takes the same time whatever was
// sent and how long it is.
export function intakeSecretMatches(provided: string | null, expected: string | undefined): boolean {
  if (!expected || !provided) return false;
  const a = createHash("sha256").update(provided, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

// The note on the new lead: what was asked, in the FDH form's wording, with
// no user (the CRM wrote it, so it doesn't count as contact).
export function enquiryNote(enquiry: LdbEnquiry, duplicates: { id: string; name: string }[]): string {
  const lines = [`Service type: ${enquiry.service || "Unspecified"}`, "From the Leaflet Distribution Bournemouth website"];
  if (enquiry.budget) lines.push(`Budget range: ${enquiry.budget}`);
  if (enquiry.startDate) lines.push(`Requested start date: ${enquiry.startDate}`);
  if (enquiry.deadline) lines.push(`Deadline: ${enquiry.deadline}`);
  if (enquiry.projectLocation) lines.push(`Project location: ${enquiry.projectLocation}`);
  if (enquiry.scale) lines.push(`Scale: ${enquiry.scale}`);
  if (enquiry.postcode) lines.push(`Postcode: ${enquiry.postcode}`);
  if (enquiry.message) lines.push(`Message: ${enquiry.message}`);
  if (duplicates.length > 0) {
    lines.push(`Possible duplicate of existing lead(s): ${duplicates.map((d) => `${d.name} (${d.id})`).join(", ")}`);
  }
  return lines.join("\n");
}

// Narrow shapes of the Prisma calls used, so a test can pass a plain object.
// `any` for the arguments is deliberate, as in send-lead-email.ts.
export type LdbIntakeDb = {
  lead: {
    count(args: { where: any }): Promise<number>;
    create(args: { data: any; select: { id: true } }): Promise<{ id: string }>;
  };
};

export type LdbIntakeDeps = {
  db: LdbIntakeDb;
  secret: string | undefined;
  findDuplicates: (email: string | null, phone: string | null) => Promise<{ id: string; name: string }[]>;
  now?: () => Date;
};

const LDB_INTAKE_WHERE = { business: "LDB", source: "WEBSITE_QUOTE_FORM" } as const;

export async function handleLdbIntake(req: Request, deps: LdbIntakeDeps): Promise<Response> {
  if (!intakeSecretMatches(req.headers.get("x-intake-secret"), deps.secret)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > MAX_INTAKE_BYTES) return Response.json({ error: "Enquiry too large" }, { status: 413 });
  let raw: unknown;
  try {
    const text = await req.text();
    if (text.length > MAX_INTAKE_BYTES) return Response.json({ error: "Enquiry too large" }, { status: 413 });
    raw = JSON.parse(text);
  } catch {
    return Response.json({ error: "Invalid enquiry" }, { status: 400 });
  }
  const result = validateLdbEnquiry(raw);
  if (!result.ok) return Response.json({ error: result.error }, { status: 400 });
  const enquiry = result.enquiry;

  const now = deps.now?.() ?? new Date();
  const since = new Date(now.getTime() - HOUR_MS);
  try {
    const lastHour = await deps.db.lead.count({ where: { ...LDB_INTAKE_WHERE, createdAt: { gte: since } } });
    if (lastHour >= LDB_INTAKE_PER_HOUR) return Response.json({ error: "Too many requests" }, { status: 429 });
    const contact = [
      ...(enquiry.email ? [{ email: { equals: enquiry.email, mode: "insensitive" } }] : []),
      ...(enquiry.phone ? [{ phone: enquiry.phone }] : []),
    ];
    const fromContact = await deps.db.lead.count({ where: { ...LDB_INTAKE_WHERE, createdAt: { gte: since }, OR: contact } });
    if (fromContact >= LDB_INTAKE_PER_CONTACT_PER_HOUR) {
      return Response.json({ error: "Too many requests" }, { status: 429 });
    }

    const duplicates = await deps.findDuplicates(enquiry.email, enquiry.phone);
    await deps.db.lead.create({
      data: {
        name: enquiry.name,
        email: enquiry.email,
        phone: enquiry.phone,
        businessName: enquiry.businessName,
        postcode: enquiry.postcode,
        // With no areas given, where the project is stands in for them.
        targetAreas: enquiry.areas ?? enquiry.projectLocation,
        leafletQuantity: enquiry.quantity,
        printingIncluded: enquiry.printingIncluded,
        designIncluded: enquiry.designIncluded,
        business: "LDB",
        source: "WEBSITE_QUOTE_FORM",
        stage: "UNCONTACTED",
        activities: { create: { type: "NOTE", detail: enquiryNote(enquiry, duplicates) } },
      },
      select: { id: true },
    });
    return Response.json(OK);
  } catch (err) {
    // Only the error's type: a database error's message can echo the values
    // it was given, and enquiry details must never reach the logs.
    const code = (err as { code?: unknown } | null)?.code;
    console.error(
      "Failed to save Bournemouth enquiry:",
      err instanceof Error ? err.name : "unknown error",
      typeof code === "string" ? code : ""
    );
    return Response.json({ error: "Could not save enquiry" }, { status: 500 });
  }
}
