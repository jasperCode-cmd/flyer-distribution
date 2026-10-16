import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getInboxReplyContext, isGmailConfigured } from "@/lib/gmail";
import { findLeadsForAddresses, pickThreadLead } from "@/lib/inbox-leads";
import { sendInboxReply } from "@/lib/inbox-reply";
import { replyBusiness, senderFor } from "@/lib/email-channel";
import { gmailFailureResponse, isValidThreadId } from "@/lib/inbox-api";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_SUBJECT = 200;
const MAX_BODY = 20000;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!isValidThreadId(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: { subject?: unknown; body?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const text = typeof body.body === "string" ? body.body : "";

  if (!subject) {
    return NextResponse.json({ error: "Subject is required" }, { status: 400 });
  }
  if (subject.length > MAX_SUBJECT) {
    return NextResponse.json({ error: `Subject must be ${MAX_SUBJECT} characters or fewer` }, { status: 400 });
  }
  if (!text.trim()) {
    return NextResponse.json({ error: "Body is required" }, { status: 400 });
  }
  if (text.length > MAX_BODY) {
    return NextResponse.json({ error: `Body must be ${MAX_BODY} characters or fewer` }, { status: 400 });
  }
  if (!isGmailConfigured()) {
    return gmailFailureResponse("not_configured", "Gmail is not connected.");
  }

  // Thread, recipient and Message-ID all come from Gmail, never the request.
  const context = await getInboxReplyContext(id);
  if (!context.ok) return gmailFailureResponse(context.reason, context.message);
  if (!context.data) {
    return NextResponse.json({ error: "This conversation is no longer in the inbox." }, { status: 404 });
  }
  // Reply-To when there is a single valid one, otherwise the sender.
  const recipient = context.data.recipient?.address ?? "";
  if (!EMAIL_RE.test(recipient)) {
    return NextResponse.json({ error: "This conversation has no address to reply to." }, { status: 400 });
  }

  const addresses = { replyTo: context.data.replyTo?.address, from: context.data.counterparty?.address };
  // A Bournemouth conversation only ever matches an LDB lead.
  const ldbThread = context.data.ldbThread;
  const leads = await findLeadsForAddresses(
    prisma,
    [addresses.replyTo ?? "", addresses.from ?? ""],
    ldbThread ? { only: "LDB" } : { prefer: "FDH" }
  );
  const match = pickThreadLead(leads, addresses);
  const lead = match && EMAIL_RE.test(match.email) ? match : null;
  // A reply in a Bournemouth conversation, or to an LDB lead, always goes
  // through Brevo.
  const business = replyBusiness(ldbThread, lead);

  const outcome = await sendInboxReply({
    threadId: context.data.threadId,
    lastMessageId: context.data.lastMessageId,
    recipientAddress: recipient,
    lead,
    subject,
    body: text,
    userId: session.user.id,
    sendEmailFn: senderFor(business),
    prismaClient: prisma,
  });

  if (!outcome.ok) {
    if (!outcome.sent) return gmailFailureResponse(outcome.reason, outcome.message);
    return NextResponse.json({ error: outcome.message, sent: true, recorded: false }, { status: 500 });
  }

  return NextResponse.json({
    sent: true,
    recordedOnLead: !!(lead && !lead.scrapped),
    movedToAwaitingResponse: outcome.movedToAwaitingResponse,
    threadId: outcome.threadId,
    signature: outcome.signature ?? "none",
    business,
  });
}
