import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDialerQueueList } from "@/lib/crm-data";
import { SOURCE_LABELS } from "@/lib/crm-constants";

// Read-only, for the dialer's "reveal full queue" list view — same
// eligibility/order as /state's single next lead, just the whole thing.
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const source = url.searchParams.get("source") || "COLD_OUTREACH";
  const tagId = url.searchParams.get("tagId") || undefined;

  if (!(source in SOURCE_LABELS)) {
    return NextResponse.json({ error: "Invalid source" }, { status: 400 });
  }

  const leads = await getDialerQueueList({ source, tagId, userId: session.user.id });

  return NextResponse.json({ leads });
}
