import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { formatPence } from "@/lib/money";
import { defaultComposeBody } from "@/lib/email-compose";
import { senderFor, type ChannelSenders } from "@/lib/email-channel";
import { sendLeadEmailAndRecord, type SendLeadEmailResult } from "@/lib/send-lead-email";
import { brandingFor } from "./branding";
import { renderStoredDocument } from "./output";
import { canEmail, dbDay, fillTemplate, firstName, formatLongDate, tidyDocumentText, type DocumentKind } from "./rules";
import { markSentOp, type InvoiceRecord, type QuoteRecord } from "./service";

// "Email to client": the document's PDF attached to a short email, sent
// through the usual routing for its business (FDH through Gmail, LDB only
// through Brevo, with its sign-off and BCC). Sending records the email on the
// lead and marks the document Sent, in one transaction after the send.

const EMAIL_RE = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/;
export const MAX_SUBJECT = 200;
export const MAX_BODY = 20000;

type AnyRecord = (QuoteRecord & { kind: "quote" }) | (InvoiceRecord & { kind: "invoice" });

// Who it goes to: the email on the document, else the lead's. Always from the
// database, never from the request.
export function documentRecipient(record: { clientEmail: string | null; lead: { email: string | null } }): string | null {
  const to = (record.clientEmail ?? record.lead.email ?? "").trim();
  return EMAIL_RE.test(to) ? to : null;
}

export function documentEmailDraft(record: AnyRecord, userFirstName: string): { subject: string; body: string } {
  const brand = brandingFor(record.business);
  const key = record.kind === "quote" ? "quote" : record.type === "DEPOSIT" ? "deposit" : record.type === "BALANCE" ? "balance" : "full";
  const template = brand.emails[key];
  const values: Record<string, string> = {
    number: record.number,
    firstName: firstName(record.clientName),
    amount: formatPence(record.kind === "quote" ? record.totalPence : record.amountDuePence),
    validUntil: record.kind === "quote" ? formatLongDate(dbDay(record.validUntil)) : "",
    dueText:
      record.kind === "invoice"
        ? record.dueOnReceipt
          ? "due on receipt"
          : record.dueDate
            ? `due by ${formatLongDate(dbDay(record.dueDate))}`
            : ""
        : "",
  };
  return {
    subject: fillTemplate(template.subject, values),
    body: fillTemplate(template.body, values) + defaultComposeBody(record.business, userFirstName),
  };
}

export type DocumentSendOutcome =
  | { ok: true; result: Extract<SendLeadEmailResult, { ok: true }> }
  | { ok: false; status: number; error: string; reason?: string; sent?: boolean };

export async function sendDocumentEmail(params: {
  db: PrismaClient;
  kind: DocumentKind;
  id: string;
  subject: unknown;
  body: unknown;
  userId: string;
  now?: Date;
  senders?: ChannelSenders;
  env?: Record<string, string | undefined>;
}): Promise<DocumentSendOutcome> {
  const subject = typeof params.subject === "string" ? tidyDocumentText(params.subject).trim() : "";
  const body = typeof params.body === "string" ? tidyDocumentText(params.body) : "";
  if (!subject) return { ok: false, status: 400, error: "Subject is required" };
  if (subject.length > MAX_SUBJECT) return { ok: false, status: 400, error: `Subject must be ${MAX_SUBJECT} characters or fewer` };
  if (!body.trim()) return { ok: false, status: 400, error: "Body is required" };
  if (body.length > MAX_BODY) return { ok: false, status: 400, error: `Body must be ${MAX_BODY} characters or fewer` };

  const rendered = await renderStoredDocument(params.db, params.kind, params.id, params.env);
  if (!rendered.ok) return { ok: false, status: rendered.status, error: rendered.error };
  const record = rendered.record;
  if (!canEmail(record.status)) return { ok: false, status: 409, error: `A ${record.status.toLowerCase()} document can't be emailed` };
  if (record.lead.scrapped) return { ok: false, status: 400, error: "This lead is scrapped" };
  const to = documentRecipient(record);
  if (!to) return { ok: false, status: 400, error: "There is no valid email address on this document or its lead" };

  const now = params.now ?? new Date();
  const outcome = await sendLeadEmailAndRecord({
    lead: { id: record.lead.id, stage: record.lead.stage },
    to,
    subject,
    body,
    userId: params.userId,
    // The document's business decides the channel: LDB never through Gmail.
    sendEmailFn: senderFor(record.business, params.senders),
    prismaClient: params.db,
    attachments: [{ filename: rendered.fileName, mimeType: "application/pdf", content: rendered.bytes }],
    extraOps: () => [markSentOp(params.db, params.kind, params.id, now)],
  });
  if (!outcome.ok) {
    if (!outcome.sent) {
      const status = outcome.reason === "not_configured" ? 503 : outcome.reason === "reconnect" ? 409 : 502;
      return { ok: false, status, error: outcome.message, reason: outcome.reason };
    }
    return { ok: false, status: 500, error: outcome.message, sent: true };
  }
  return { ok: true, result: outcome };
}
