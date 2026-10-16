import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getExcludedAddresses, isGmailConfigured } from "@/lib/gmail";
import { getLdbSenderAddress } from "@/lib/ldb-address";
import { newEmailBusiness, senderFor } from "@/lib/email-channel";
import { findLeadsForAddresses, normalizeEmail } from "@/lib/inbox-leads";
import { checkNewEmailAddress, sendNewEmail } from "@/lib/new-email";
import { gmailFailureResponse } from "@/lib/inbox-api";
import { STAGE_LABELS } from "@/lib/crm-constants";

export const runtime = "nodejs";

const MAX_SUBJECT = 200;
const MAX_BODY = 20000;

async function leadFor(address: string) {
  const matches = await findLeadsForAddresses(prisma, [address], { prefer: "FDH" });
  return matches.get(normalizeEmail(address)) ?? null;
}

// Never to an excluded address, or to our own Bournemouth address.
function refusedAddresses(): string[] {
  const ldb = getLdbSenderAddress();
  return [...getExcludedAddresses(), ...(ldb ? [ldb] : [])];
}

// While the address is typed: is it usable, and whose is it? Shown in the
// compose modal before anything is sent.
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const checked = checkNewEmailAddress(new URL(req.url).searchParams.get("to"), refusedAddresses());
  if (!checked.ok) return NextResponse.json({ status: checked.reason, error: checked.error });
  const lead = await leadFor(checked.address);
  const route = newEmailBusiness(lead);
  if (!route.ok) return NextResponse.json({ status: "both_businesses", error: route.error });
  return NextResponse.json({
    status: "ok",
    business: route.business,
    lead: lead
      ? {
          id: lead.id,
          name: lead.name,
          stage: lead.stage,
          stageLabel: STAGE_LABELS[lead.stage] ?? lead.stage,
          scrapped: lead.scrapped,
          business: lead.business,
        }
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
  const checked = checkNewEmailAddress(body?.to, refusedAddresses());
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
  // An LDB lead's address sends through Brevo; an address on leads of both
  // businesses is refused.
  const route = newEmailBusiness(lead);
  if (!route.ok) {
    return NextResponse.json({ error: route.error, reason: "both_businesses" }, { status: 409 });
  }
  const outcome = await sendNewEmail({
    to: checked.address,
    lead,
    subject,
    body: text,
    userId: session.user.id,
    sendEmailFn: senderFor(route.business),
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
    business: route.business,
  });
}
