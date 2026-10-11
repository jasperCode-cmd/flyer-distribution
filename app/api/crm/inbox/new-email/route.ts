import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getExcludedAddresses, isGmailConfigured, sendEmail } from "@/lib/gmail";
import { findLeadsForAddresses, normalizeEmail } from "@/lib/inbox-leads";
import { checkNewEmailAddress, sendNewEmail } from "@/lib/new-email";
import { gmailFailureResponse } from "@/lib/inbox-api";
import { STAGE_LABELS } from "@/lib/crm-constants";

export const runtime = "nodejs";

const MAX_SUBJECT = 200;
const MAX_BODY = 20000;

async function leadFor(address: string) {
  const matches = await findLeadsForAddresses(prisma, [address]);
  return matches.get(normalizeEmail(address)) ?? null;
}

// While the address is typed: is it usable, and whose is it? Shown in the
// compose modal before anything is sent.
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const checked = checkNewEmailAddress(new URL(req.url).searchParams.get("to"), getExcludedAddresses());
  if (!checked.ok) return NextResponse.json({ status: checked.reason, error: checked.error });
  const lead = await leadFor(checked.address);
  return NextResponse.json({
    status: "ok",
    lead: lead
      ? { id: lead.id, name: lead.name, stage: lead.stage, stageLabel: STAGE_LABELS[lead.stage] ?? lead.stage, scrapped: lead.scrapped }
      : null,
  });
}

// Sends it. Only the address, subject and body come from the browser; the
// address is checked again here, whether it belongs to a lead is decided
// here, and there is never a thread to continue.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { to?: unknown; subject?: unknown; body?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const checked = checkNewEmailAddress(body?.to, getExcludedAddresses());
  if (!checked.ok) {
    return NextResponse.json({ error: checked.error, reason: checked.reason }, { status: 400 });
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

  const lead = await leadFor(checked.address);
  const outcome = await sendNewEmail({
    to: checked.address,
    lead,
    subject,
    body: text,
    userId: session.user.id,
    sendEmailFn: sendEmail,
    prismaClient: prisma,
  });

  if (!outcome.ok) {
    if (!outcome.sent) return gmailFailureResponse(outcome.reason, outcome.message);
    return NextResponse.json({ error: outcome.message, sent: true, recorded: false }, { status: 500 });
  }
  return NextResponse.json({
    sent: true,
    recordedOnLead: outcome.recordedOnLead,
    lead: outcome.recordedOnLead && lead ? { id: lead.id, name: lead.name } : null,
    movedToAwaitingResponse: outcome.movedToAwaitingResponse,
    signature: outcome.signature ?? "none",
  });
}
