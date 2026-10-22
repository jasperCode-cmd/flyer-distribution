import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import type { Business } from "./business";
import type { GmailResult, SendEmailParams } from "./gmail";
import { buildApplicantThankYouEmail, type ApplicantDetails } from "./applicant-thank-you-email";

// The automatic thank-you email to someone who applies through FDH's Work
// With Us form, sent from the business Gmail (without its signature) after
// the application is saved. Best effort, like the quote thank-you
// (lib/quote-thank-you.ts): nothing here can stop the application being
// recorded or change what the form is told, and a failure only logs a fixed
// reason, never the applicant's details.
//
// - FDH website applications only: never Bournemouth's, and never ones the
//   Gmail import brings in.
// - At most once per email address in 24 hours, worked out from that
//   address's own FDH website applications, in the order they came in: each
//   gets it if none went in the 24 hours before it. So two at once can't both
//   send, with nothing to record or lock.
// - At most APPLICANT_MAX_PER_HOUR across the site, so the public form can't
//   be used to send our email to a list of addresses.
// - It writes nothing at all: the application stays NEW with its notes as
//   they were, so its New application item stays on Priorities.

export const APPLICANT_WINDOW_MS = 24 * 60 * 60 * 1000;
export const APPLICANT_MAX_PER_HOUR = 20;
// How far back an address's applications are replayed for the 24-hour rule.
const HISTORY_MS = 30 * 24 * 60 * 60 * 1000;

const EMAIL_RE = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/;

// The application as it was just saved.
export type SavedApplication = ApplicantDetails & {
  id: string;
  email: string | null;
  business: Business;
  source: string;
  receivedAt: Date;
};

export type ApplicantThankYouOutcome = "sent" | "not_fdh_website" | "no_email" | "sent_recently" | "hourly_limit" | "failed";

type Db = Pick<PrismaClient, "distributorApplication">;
export type ApplicantThankYouSend = (params: SendEmailParams) => Promise<GmailResult<unknown>>;

export async function sendApplicantThankYou(params: {
  db: Db;
  application: SavedApplication;
  send: ApplicantThankYouSend;
}): Promise<ApplicantThankYouOutcome> {
  const { db, application: app } = params;
  if (app.business !== "FDH" || app.source !== "WEBSITE_FORM") return "not_fdh_website";
  const email = (app.email ?? "").trim();
  if (!EMAIL_RE.test(email) || email.length > 254) return "no_email";

  try {
    // This address's FDH website applications up to this one, oldest first
    // (two at the same moment in id order), replayed: each gets the email if
    // none went in the 24 hours before it.
    const history = await db.distributorApplication.findMany({
      where: {
        business: "FDH",
        source: "WEBSITE_FORM",
        email: { equals: email, mode: "insensitive" },
        receivedAt: { gte: new Date(app.receivedAt.getTime() - HISTORY_MS), lte: app.receivedAt },
      },
      select: { id: true, receivedAt: true },
      orderBy: [{ receivedAt: "asc" }, { id: "asc" }],
    });
    if (!history.some((h) => h.id === app.id)) history.push({ id: app.id, receivedAt: app.receivedAt });
    let lastSent = -Infinity;
    let thisOne = false;
    for (const h of history) {
      const gets = h.receivedAt.getTime() - lastSent >= APPLICANT_WINDOW_MS;
      if (gets) lastSent = h.receivedAt.getTime();
      if (h.id === app.id) {
        thisOne = gets;
        break;
      }
    }
    if (!thisOne) {
      console.info("Applicant thank-you email skipped: one went to this address in the last 24 hours");
      return "sent_recently";
    }
    // Every FDH website application with an email in the hour before this
    // one counts towards the limit, emailed or not.
    const lastHour = await db.distributorApplication.count({
      where: {
        business: "FDH",
        source: "WEBSITE_FORM",
        email: { not: null },
        id: { not: app.id },
        OR: [
          { receivedAt: { gte: new Date(app.receivedAt.getTime() - 60 * 60 * 1000), lt: app.receivedAt } },
          { receivedAt: app.receivedAt, id: { lt: app.id } },
        ],
      },
    });
    if (lastHour >= APPLICANT_MAX_PER_HOUR) {
      console.info("Applicant thank-you email skipped: the hourly limit was reached");
      return "hourly_limit";
    }
  } catch {
    console.error("Applicant thank-you email not sent: couldn't check for an earlier one");
    return "failed";
  }

  const message = buildApplicantThankYouEmail(app);
  let reason: string | null = null;
  try {
    const result = await params.send({ to: email, subject: message.subject, body: message.text, html: message.html });
    if (!result.ok) reason = result.reason;
  } catch {
    reason = "error";
  }
  if (reason === null) return "sent";
  console.error(`Applicant thank-you email not sent: ${reason}`);
  return "failed";
}
