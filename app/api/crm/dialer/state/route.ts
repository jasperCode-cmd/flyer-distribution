import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getNextDialerLead, getCallsMadeToday, getInboundLeadCount } from "@/lib/crm-data";
import { SOURCE_LABELS } from "@/lib/crm-constants";

// Single round-trip for everything the dialer screen needs to render its
// current lead: the next eligible lead itself, plus the two small bits of
// context shown alongside it (today's call count, the inbound-lead banner).
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const source = url.searchParams.get("source") || "COLD_OUTREACH";
  const tagId = url.searchParams.get("tagId") || undefined;
  const excludeIds = url.searchParams.get("excludeIds")?.split(",").filter(Boolean) || undefined;

  if (!(source in SOURCE_LABELS)) {
    return NextResponse.json({ error: "Invalid source" }, { status: 400 });
  }

  const [lead, callsToday, inboundCount] = await Promise.all([
    getNextDialerLead({ source, tagId, userId: session.user.id, excludeIds }),
    getCallsMadeToday(session.user.id),
    getInboundLeadCount(),
  ]);

  return NextResponse.json({ lead, callsToday, inboundCount });
}
