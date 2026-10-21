import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { loadCrmStatus } from "@/lib/crm-status";
import { requestChangeId } from "@/lib/crm-change-server";

export const runtime = "nodejs";

// The bell and the navigation's counts in one answer, which every CRM tab
// asks for every two minutes while it is visible and in use (status-poll.ts).
// Worked out at most once a minute for everyone (crm-status.ts).
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const status = await loadCrmStatus(await requestChangeId());
  return NextResponse.json(status, { headers: { "Cache-Control": "no-store" } });
}
