import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isGmailConfigured } from "@/lib/gmail";
import { ldbSenderPreview } from "@/lib/ldb-email";
import { paymentDetailsStatus } from "@/lib/documents/bank";
import { documentFileName } from "@/lib/documents/branding";
import { documentEmailDraft, documentRecipient, sendDocumentEmail } from "@/lib/documents/email";
import { canEmail, isDocumentKind } from "@/lib/documents/rules";
import { getInvoice, getQuote } from "@/lib/documents/service";

export const runtime = "nodejs";

type Params = { params: Promise<{ kind: string; id: string }> };

// The email "Email to client" starts with, who it goes to and from, and
// anything stopping it from being sent.
export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { kind, id } = await params;
  if (!isDocumentKind(kind)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const quote = kind === "quote" ? await getQuote(prisma, id) : null;
  const invoice = kind === "invoice" ? await getInvoice(prisma, id) : null;
  const record = quote ? { ...quote, kind: "quote" as const } : invoice ? { ...invoice, kind: "invoice" as const } : null;
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const userFirstName = (session.user.name ?? "").trim().split(/\s+/)[0] ?? "";
  const draft = documentEmailDraft(record, userFirstName);
  const ldb = record.business === "LDB" ? ldbSenderPreview() : null;
  const sender =
    record.business === "LDB"
      ? ldb && ldb.configured
        ? { configured: true, label: `${ldb.fromName} <${ldb.fromAddress}>` }
        : { configured: false, label: "Bournemouth email not connected." }
      : isGmailConfigured()
        ? { configured: true, label: "The CRM's Gmail" }
        : { configured: false, label: "Gmail is not connected." };
  const bank = kind === "invoice" ? paymentDetailsStatus() : { ready: true as const };
  const blockers = [
    ...(!canEmail(record.status) ? [`A ${record.status.toLowerCase()} document can't be emailed.`] : []),
    ...(!documentRecipient(record) ? ["There is no valid email address on this document or its lead."] : []),
    ...(!sender.configured ? [sender.label] : []),
    ...(!bank.ready ? [bank.message] : []),
  ];
  return NextResponse.json({
    to: documentRecipient(record),
    subject: draft.subject,
    body: draft.body,
    sender,
    attachment: documentFileName(record.business, record.number),
    blockers,
  });
}

export async function POST(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { kind, id } = await params;
  if (!isDocumentKind(kind)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  let outcome;
  try {
    outcome = await sendDocumentEmail({ db: prisma, kind, id, subject: body?.subject, body: body?.body, userId: session.user.id });
  } catch (err) {
    console.error("Document email failed:", err instanceof Error ? err.name : "unknown error");
    return NextResponse.json({ error: "Could not send the email. Please try again." }, { status: 500 });
  }
  if (!outcome.ok) {
    return NextResponse.json(
      { error: outcome.error, ...(outcome.reason ? { reason: outcome.reason } : {}), ...(outcome.sent ? { sent: true, recorded: false } : {}) },
      { status: outcome.status }
    );
  }
  return NextResponse.json({
    sent: true,
    recorded: true,
    movedToAwaitingResponse: outcome.result.movedToAwaitingResponse,
    signature: outcome.result.signature ?? "none",
  });
}
