import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ldbSenderPreview } from "@/lib/ldb-email";

export const runtime = "nodejs";

// For the compose window on an LDB lead: who the email comes from and the
// signature it gets, or that Bournemouth email isn't connected. Never the key.
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(ldbSenderPreview());
}
