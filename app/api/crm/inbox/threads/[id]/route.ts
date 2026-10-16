import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getInboxThread, isGmailConfigured } from "@/lib/gmail";
import { crmMatchesFor, lookupCrm } from "@/lib/inbox-crm";
import { gmailFailureResponse, isValidThreadId } from "@/lib/inbox-api";
import { parseBusinessFilter } from "@/lib/business";
import { replyBusiness } from "@/lib/email-channel";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
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

  // The Inbox's business filter: an FDH view never opens Bournemouth mail.
  const view = parseBusinessFilter(new URL(req.url).searchParams.get("business"));
  const gone = () =>
    NextResponse.json({ configured: true, error: "This conversation is no longer in the inbox." }, { status: 404 });

  const result = await getInboxThread(id, view);
  if (!result.ok) return gmailFailureResponse(result.reason, result.message);
  if (!result.data) return gone();

  const addresses = { replyTo: result.data.replyTo?.address, from: result.data.counterparty?.address };
  const lookups = await lookupCrm(prisma, [addresses.replyTo ?? "", addresses.from ?? ""]);
  const { lead, distributor, applicant } = crmMatchesFor(lookups, addresses, { ldbThread: result.data.ldbThread });
  // Bournemouth mail: through the LDB address, or with an LDB lead.
  const business = replyBusiness(result.data.ldbThread, lead);
  if ((view === "FDH" && business === "LDB") || (view === "LDB" && business !== "LDB")) return gone();

  return NextResponse.json({
    configured: true,
    thread: result.data,
    business,
    lead,
    distributor,
    applicant,
    // Who a reply goes to, worked out from the thread exactly as the reply
    // route does, so the compose modal shows the real recipient.
    recipient: result.data.recipient?.address ?? "",
  });
}
