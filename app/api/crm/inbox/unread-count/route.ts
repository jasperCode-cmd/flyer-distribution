import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getInboxUnreadCount, isGmailConfigured } from "@/lib/gmail";

export const runtime = "nodejs";

// Fetched once when the CRM navigation mounts. No polling.
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isGmailConfigured()) {
    return NextResponse.json({ configured: false, count: 0, more: false });
  }

  const result = await getInboxUnreadCount();
  if (!result.ok) {
    // The badge is optional; a failure just hides it.
    return NextResponse.json({ configured: true, count: 0, more: false, reason: result.reason });
  }
  return NextResponse.json({ configured: true, ...result.data });
}
