import "server-only";
import {
  APPLICATION_BODY_MAX_BYTES,
  APPLICATION_EMAIL_RE,
  collapse,
  looksLikePhone,
  saveWebsiteApplication,
  tidyMultiline,
  type ApplicationFields,
} from "./distributor-applications";
import { APPLICATIONS_PER_HOUR_CAP, websiteApplicationsLastHour, type ApplicationEndpointDb } from "./application-endpoint";
import { intakeSecretMatches } from "./ldb-intake";

// Distributor applications from the Leaflet Distribution Bournemouth website,
// posted to POST /api/crm/intake/ldb-application by the LDB site's server.
// The same protection as the LDB enquiry intake: the X-Intake-Secret header
// compared in constant time with LDB_INTAKE_SECRET (401 otherwise, and always
// 401 when it isn't set), every field checked and length-limited, an hourly
// cap counted in the database (LDB website applications only), and a reply
// of only {"ok":true}. A good application is saved like one from the FDH
// form, as business LDB, source Website form, status New, including the
// shared duplicate rule. Nothing about the applicant is ever logged.
//
// The LDB form's own fields are accepted alongside the original ones: its
// postcode and the areas they would cover go into the application's "where
// they live" field ("BH8 9AB, areas: Bournemouth, Poole"), and what they say
// about themselves into its availability, the applicant's own free text
// (notes are the CRM's and staff's).

export const LDB_APPLICATION_LIMITS = {
  fullName: 100,
  phone: 30,
  email: 254,
  area: 100,
  postcode: 10,
  areas: 300,
  age: 20,
  availability: 1000,
  about: 1000,
} as const;

type TextField = Exclude<keyof typeof LDB_APPLICATION_LIMITS, "areas">;
const TEXT_FIELDS: TextField[] = ["fullName", "phone", "email", "area", "postcode", "age", "availability", "about"];
const MULTILINE: ReadonlySet<TextField> = new Set(["availability", "about"]);

function tidy(value: string, multiline: boolean): string {
  return (multiline ? tidyMultiline(value) : collapse(value)).replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, "");
}

const OK = { ok: true } as const;

export type LdbApplicationResult = { ok: true; fields: ApplicationFields } | { ok: false; error: string };

// true / false, or "yes" / "no" in any case; missing or empty means not given.
function yesNo(value: unknown): boolean | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return undefined;
  const v = value.trim().toLowerCase();
  if (v === "") return null;
  if (v === "yes") return true;
  if (v === "no") return false;
  return undefined;
}

// Accepts exactly the agreed JSON; fields it doesn't know are ignored. The
// errors name the field, so the LDB site's developer can see what to fix.
export function validateLdbApplication(raw: unknown): LdbApplicationResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, error: "Invalid application" };
  const body = raw as Record<string, unknown>;

  const out: Partial<Record<TextField, string | null>> = {};
  for (const key of TEXT_FIELDS) {
    const value = body[key];
    if (value === undefined || value === null) {
      out[key] = null;
      continue;
    }
    if (typeof value !== "string") return { ok: false, error: `Invalid ${key}` };
    const text = tidy(value, MULTILINE.has(key));
    if (text.length > LDB_APPLICATION_LIMITS[key]) return { ok: false, error: `${key} is too long` };
    out[key] = text === "" ? null : text;
  }

  // Areas: a list of strings or one string, joined with ", "; the limit is on
  // the joined text.
  let areas: string | null = null;
  const rawAreas = body.areas;
  if (rawAreas !== undefined && rawAreas !== null) {
    const list = Array.isArray(rawAreas) ? rawAreas : [rawAreas];
    if (!list.every((item) => typeof item === "string")) return { ok: false, error: "Invalid areas" };
    const joined = (list as string[]).map((item) => tidy(item, false)).filter(Boolean).join(", ");
    if (joined.length > LDB_APPLICATION_LIMITS.areas) return { ok: false, error: "areas is too long" };
    areas = joined || null;
  }
  if (!out.fullName) return { ok: false, error: "fullName is required" };
  if (!out.phone) return { ok: false, error: "phone is required" };
  if (!looksLikePhone(out.phone)) return { ok: false, error: "Invalid phone" };
  if (out.email && !APPLICATION_EMAIL_RE.test(out.email)) return { ok: false, error: "Invalid email" };

  const hasCar = yesNo(body.hasCar);
  if (hasCar === undefined) return { ok: false, error: "Invalid hasCar" };
  const hasLicence = yesNo(body.hasLicence);
  if (hasLicence === undefined) return { ok: false, error: "Invalid hasLicence" };

  const postcode = out.postcode ? out.postcode.toUpperCase() : null;
  const area = [out.area, postcode, areas ? `areas: ${areas}` : null].filter(Boolean).join(", ") || null;
  const availability =
    out.availability && out.about ? `${out.availability}\n\nAbout: ${out.about}` : out.availability ?? out.about ?? null;

  return {
    ok: true,
    fields: {
      fullName: out.fullName,
      phone: out.phone,
      email: out.email ?? null,
      area,
      age: out.age ?? null,
      hasCar,
      hasLicence,
      availability,
    },
  };
}

export type LdbApplicationDeps = {
  db: ApplicationEndpointDb;
  secret: string | undefined;
  now?: () => Date;
};

export async function handleLdbApplicationIntake(req: Request, deps: LdbApplicationDeps): Promise<Response> {
  if (!intakeSecretMatches(req.headers.get("x-intake-secret"), deps.secret)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > APPLICATION_BODY_MAX_BYTES) return Response.json({ error: "Application too large" }, { status: 413 });
  let raw: unknown;
  try {
    const text = await req.text();
    if (Buffer.byteLength(text, "utf8") > APPLICATION_BODY_MAX_BYTES) {
      return Response.json({ error: "Application too large" }, { status: 413 });
    }
    raw = JSON.parse(text);
  } catch {
    return Response.json({ error: "Invalid application" }, { status: 400 });
  }
  const result = validateLdbApplication(raw);
  if (!result.ok) return Response.json({ error: result.error }, { status: 400 });

  const now = deps.now?.() ?? new Date();
  try {
    if ((await websiteApplicationsLastHour(deps.db, "LDB", now)) >= APPLICATIONS_PER_HOUR_CAP) {
      return Response.json({ error: "Too many requests" }, { status: 429 });
    }
    // A repeat from the same phone within 7 days is noted on the first
    // application rather than saved again; the reply is the same either way.
    await saveWebsiteApplication(deps.db, result.fields, now, "LDB");
    return Response.json(OK);
  } catch (err) {
    // Only the error's type: a database error's message can echo the values
    // it was given, and applicant details must never reach the logs.
    const code = (err as { code?: unknown } | null)?.code;
    console.error(
      "Failed to save Bournemouth distributor application:",
      err instanceof Error ? err.name : "unknown error",
      typeof code === "string" ? code : ""
    );
    return Response.json({ error: "Could not save application" }, { status: 500 });
  }
}
