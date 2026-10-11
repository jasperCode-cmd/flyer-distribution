import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { loadPriorityList } from "@/lib/priorities-data";

export const runtime = "nodejs";

// The Priorities list. Without gmail=1 it is the database items only, which
// are quick; with it, unanswered emails from leads are merged in (cached for
// about two minutes; fresh=1 asks for a new scan after a send).
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const params = new URL(req.url).searchParams;
  const list = await loadPriorityList({ withEmail: params.get("gmail") === "1", fresh: params.get("fresh") === "1" });
  return NextResponse.json(list);
}
