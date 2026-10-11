import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { loadPriorityList } from "@/lib/priorities-data";
import { urgentHighCount } from "@/lib/priorities";

export const runtime = "nodejs";

// The number beside Priorities in the navigation: Urgent and High rows,
// unanswered emails included (from the same two-minute cache).
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const list = await loadPriorityList({ withEmail: true });
  return NextResponse.json({ count: urgentHighCount(list.rows) });
}
