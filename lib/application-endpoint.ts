import {
  APPLICATION_BODY_MAX_BYTES,
  saveWebsiteApplication,
  validateWebsiteApplication,
  type SaveApplicationDb,
} from "./distributor-applications";
import { APPLICATION_HONEYPOT_FIELD } from "./distributor-application-form";
import { clientKey } from "./rate-limit";

// Across every server instance, at most this many website applications are
// saved per hour. Far above real use; it only matters if someone floods the
// endpoint, and even then each applicant's email still arrives.
export const APPLICATIONS_PER_HOUR_CAP = 60;

export type ApplicationEndpointDb = SaveApplicationDb & {
  distributorApplication: SaveApplicationDb["distributorApplication"] & {
    count(args: { where: { source: "WEBSITE_FORM"; createdAt: { gte: Date } } }): Promise<number>;
  };
};

// Every outcome a genuine applicant can reach answers with the same body, so
// the response never says whether a phone number has applied before, and
// nothing that was stored is ever sent back.
const OK = { ok: true };

export async function handleApplicationRequest(
  req: Request,
  deps: { db: ApplicationEndpointDb; allow: (key: string) => boolean; now?: () => Date }
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
    const lastHour = await deps.db.distributorApplication.count({
      where: { source: "WEBSITE_FORM", createdAt: { gte: new Date(now.getTime() - 60 * 60 * 1000) } },
    });
    if (lastHour >= APPLICATIONS_PER_HOUR_CAP) {
      return Response.json({ error: "Too many requests" }, { status: 429 });
    }
    await saveWebsiteApplication(deps.db, result.fields, now);
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
