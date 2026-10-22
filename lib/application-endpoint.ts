import {
  APPLICATION_BODY_MAX_BYTES,
  saveWebsiteApplication,
  validateWebsiteApplication,
  type ApplicationFields,
  type SaveApplicationDb,
} from "./distributor-applications";
import { APPLICATION_HONEYPOT_FIELD } from "./distributor-application-form";
import { clientKey } from "./rate-limit";
import type { Business } from "./business";

// Across every server instance, at most this many applications are saved per
// hour from each business's website, counting only that website's own. Far
// above real use; it only matters if someone floods an endpoint, and then the
// other website's applications still get through.
export const APPLICATIONS_PER_HOUR_CAP = 60;

export type ApplicationEndpointDb = SaveApplicationDb & {
  distributorApplication: SaveApplicationDb["distributorApplication"] & {
    count(args: { where: { source: "WEBSITE_FORM"; business: Business; createdAt: { gte: Date } } }): Promise<number>;
  };
};

// How many applications came through one business's website in the hour
// before `now`, for its cap.
export function websiteApplicationsLastHour(db: ApplicationEndpointDb, business: Business, now: Date): Promise<number> {
  return db.distributorApplication.count({
    where: { source: "WEBSITE_FORM", business, createdAt: { gte: new Date(now.getTime() - 60 * 60 * 1000) } },
  });
}

// Every outcome a genuine applicant can reach answers with the same body, so
// the response never says whether a phone number has applied before, and
// nothing that was stored is ever sent back.
const OK = { ok: true };

// A new FDH website application, just saved (not a repeat from the same
// phone, which is only noted on the earlier one).
export type SavedWebsiteApplication = ApplicationFields & {
  id: string;
  business: "FDH";
  source: "WEBSITE_FORM";
  receivedAt: Date;
};

export async function handleApplicationRequest(
  req: Request,
  deps: {
    db: ApplicationEndpointDb;
    allow: (key: string) => boolean;
    now?: () => Date;
    // Told about each new application once it's saved, such as to send the
    // thank-you email. Never awaited, and nothing it does or throws can
    // change the reply.
    onSaved?: (application: SavedWebsiteApplication) => void;
  }
): Promise<Response> {
  if (!deps.allow(clientKey(req.headers))) {
    return Response.json({ error: "Too many requests" }, { status: 429 });
  }

  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > APPLICATION_BODY_MAX_BYTES) {
    return Response.json({ error: "Too large" }, { status: 413 });
  }
  let text: string;
  try {
    text = await req.text();
  } catch {
    return Response.json({ error: "Invalid application" }, { status: 400 });
  }
  if (Buffer.byteLength(text, "utf8") > APPLICATION_BODY_MAX_BYTES) {
    return Response.json({ error: "Too large" }, { status: 413 });
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return Response.json({ error: "Invalid application" }, { status: 400 });
  }

  const result = validateWebsiteApplication(raw, APPLICATION_HONEYPOT_FIELD);
  if (!result.ok) return Response.json({ error: result.error }, { status: 400 });
  if (result.honeypot) return Response.json(OK);

  const now = deps.now?.() ?? new Date();
  try {
    const lastHour = await websiteApplicationsLastHour(deps.db, "FDH", now);
    if (lastHour >= APPLICATIONS_PER_HOUR_CAP) {
      return Response.json({ error: "Too many requests" }, { status: 429 });
    }
    const saved = await saveWebsiteApplication(deps.db, result.fields, now);
    if (saved.created && deps.onSaved) {
      try {
        deps.onSaved({ ...result.fields, id: saved.id, business: "FDH", source: "WEBSITE_FORM", receivedAt: now });
      } catch {
        // The application is saved either way.
      }
    }
    return Response.json(OK);
  } catch (err) {
    // Only the error's type: a database error's message can echo the values
    // it was given, and applicant details must never reach the logs.
    const code = (err as { code?: unknown } | null)?.code;
    console.error(
      "Failed to save distributor application:",
      err instanceof Error ? err.name : "unknown error",
      typeof code === "string" ? code : ""
    );
    return Response.json({ error: "Could not save application" }, { status: 500 });
  }
}
