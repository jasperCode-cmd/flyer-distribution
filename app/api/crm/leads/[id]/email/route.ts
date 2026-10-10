import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/gmail";
import { sendLeadEmailAndRecord } from "@/lib/send-lead-email";

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
  const body = await req.json();
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const text = typeof body.body === "string" ? body.body : "";
  const threadId = typeof body.threadId === "string" ? body.threadId : undefined;
  const lastMessageId = typeof body.lastMessageId === "string" ? body.lastMessageId : undefined;

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

  // The recipient always comes from the database, never from the request,
  // so a caller can't redirect a send to an address of their choosing.
  const lead = await prisma.lead.findUnique({
    where: { id },
    select: { id: true, email: true, scrapped: true, stage: true },
  });
  if (!lead) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (lead.scrapped) {
    return NextResponse.json({ error: "This lead is scrapped" }, { status: 400 });
  }
  if (!lead.email || !EMAIL_RE.test(lead.email)) {
    return NextResponse.json({ error: "This lead has no valid email address" }, { status: 400 });
  }

  const outcome = await sendLeadEmailAndRecord({
    lead: { id: lead.id, stage: lead.stage },
    to: lead.email,
    subject,
    body: text,
    userId: session.user.id,
    threadContext: threadId && lastMessageId ? { threadId, lastMessageId } : null,
    sendEmailFn: sendEmail,
    prismaClient: prisma,
  });

  if (!outcome.ok) {
    if (!outcome.sent) {
      const status = outcome.reason === "not_configured" ? 503 : outcome.reason === "reconnect" ? 409 : 502;
      return NextResponse.json({ error: outcome.message, reason: outcome.reason }, { status });
    }
    return NextResponse.json({ error: outcome.message, sent: true, recorded: false }, { status: 500 });
  }

  return NextResponse.json({
    sent: true,
    recorded: true,
    movedToAwaitingResponse: outcome.movedToAwaitingResponse,
    threadId: outcome.threadId,
  });
}
