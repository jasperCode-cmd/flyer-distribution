import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { campaignSlots } from "./campaign-constants";
import type { GmailResult, SendEmailParams } from "./gmail";
import { buildThankYouEmail, type CampaignSlots, type QuoteEnquiry } from "./thank-you-email";

// The automatic thank-you email to a website quote enquiry, sent from the
// business Gmail (without its signature) after the lead is saved. Best
// effort: nothing here can stop the enquiry being recorded, and a failure
// only logs a fixed reason.
//
// - FDH leads only; Bournemouth will have its own version.
// - Leaflet Distribution enquiries only, as the email is about a leaflet
//   campaign (not Web Design & SEO or Screen Hire).
// - At most once per email address in 24 hours (a double submission gets
//   one email), and at most MAX_PER_HOUR across the site, so the public
//   form can't be used to send our email to a list of addresses.
// - The lead gets a note, "Automatic thank-you email sent", written with no
//   user and in the CRM's own wording (activity-origin.ts), so it never
//   counts as contact: the lead stays Uncontacted and its New enquiry item
//   on Priorities stays.
//
// The note is written first, under a lock on the address, and taken away
// again if the send fails, so two submissions at once can't both send and
// a failed send doesn't block the next try.

export const THANK_YOU_NOTE = "Automatic thank-you email sent";
export const THANK_YOU_WINDOW_MS = 24 * 60 * 60 * 1000;
export const MAX_PER_HOUR = 20;

const EMAIL_RE = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/;

export type ThankYouOutcome = "sent" | "not_fdh" | "not_leaflet" | "no_email" | "sent_recently" | "hourly_limit" | "failed";

// The service the quote form's enquiry must be for.
export const THANK_YOU_SERVICE = "Leaflet Distribution";

type Db = Pick<PrismaClient, "$transaction" | "activity">;
export type ThankYouSend = (params: SendEmailParams) => Promise<GmailResult<unknown>>;

export async function sendQuoteThankYou(params: {
  db: Db;
  lead: { id: string; email: string | null; business: string };
  enquiry: QuoteEnquiry;
  send: ThankYouSend;
  now?: Date;
  slots?: CampaignSlots;
}): Promise<ThankYouOutcome> {
  const { db, lead } = params;
  if (lead.business !== "FDH") return "not_fdh";
  if ((params.enquiry.service ?? "").trim() !== THANK_YOU_SERVICE) return "not_leaflet";
  const email = (lead.email ?? "").trim();
  if (!EMAIL_RE.test(email) || email.length > 254) return "no_email";
  const now = params.now ?? new Date();

  let noteId: string;
  try {
    noteId = await db.$transaction(async (tx) => {
      // One at a time per address, so a double submission sees the first one's note.
      await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(hashtext(${`fdh-thank-you:${email.toLowerCase()}`}))) AS l`;
      const recent = await tx.activity.findFirst({
        where: {
          type: "NOTE",
          detail: THANK_YOU_NOTE,
          createdAt: { gte: new Date(now.getTime() - THANK_YOU_WINDOW_MS), lte: now },
          lead: { email: { equals: email, mode: "insensitive" } },
        },
        select: { id: true },
      });
      if (recent) return "sent_recently";
      const lastHour = await tx.activity.count({
        where: { type: "NOTE", detail: THANK_YOU_NOTE, createdAt: { gte: new Date(now.getTime() - 60 * 60 * 1000), lte: now } },
      });
      if (lastHour >= MAX_PER_HOUR) return "hourly_limit";
      const note = await tx.activity.create({
        data: { leadId: lead.id, type: "NOTE", detail: THANK_YOU_NOTE, createdAt: now },
        select: { id: true },
      });
      return note.id;
    });
  } catch {
    console.error("Quote thank-you email not sent: couldn't check for an earlier one");
    return "failed";
  }
  if (noteId === "sent_recently" || noteId === "hourly_limit") {
    console.info(
      noteId === "sent_recently"
        ? "Quote thank-you email skipped: one went to this address in the last 24 hours"
        : "Quote thank-you email skipped: the hourly limit was reached"
    );
    return noteId;
  }

  const message = buildThankYouEmail(params.enquiry, params.slots ?? campaignSlots);
  let reason: string | null = null;
  try {
    const result = await params.send({ to: email, subject: message.subject, body: message.text, html: message.html });
    if (!result.ok) reason = result.reason;
  } catch {
    reason = "error";
  }
  if (reason === null) return "sent";

  // Not sent: the note comes off, so a later enquiry can try again.
  await db.activity.deleteMany({ where: { id: noteId } }).catch(() => {});
  console.error(`Quote thank-you email not sent: ${reason}`);
  return "failed";
}
