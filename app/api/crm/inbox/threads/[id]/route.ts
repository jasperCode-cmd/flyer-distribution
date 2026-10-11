import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getInboxThread, isGmailConfigured } from "@/lib/gmail";
import { crmMatchesFor, lookupCrm } from "@/lib/inbox-crm";
import { gmailFailureResponse, isValidThreadId } from "@/lib/inbox-api";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!isValidThreadId(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!isGmailConfigured()) {
    return NextResponse.json({ configured: false, thread: null });
  }

  const result = await getInboxThread(id);
  if (!result.ok) return gmailFailureResponse(result.reason, result.message);
  if (!result.data) {
    return NextResponse.json({ configured: true, error: "This conversation is no longer in the inbox." }, { status: 404 });
  }

  const addresses = { replyTo: result.data.replyTo?.address, from: result.data.counterparty?.address };
  const lookups = await lookupCrm(prisma, [addresses.replyTo ?? "", addresses.from ?? ""]);
  const { lead, distributor, applicant } = crmMatchesFor(lookups, addresses);

  return NextResponse.json({
    configured: true,
    thread: result.data,
    lead,
    distributor,
    applicant,
    // Who a reply goes to, worked out from the thread exactly as the reply
    // route does, so the compose modal shows the real recipient.
    recipient: result.data.recipient?.address ?? "",
  });
}
