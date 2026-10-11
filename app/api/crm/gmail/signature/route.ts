import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSignaturePreview } from "@/lib/gmail";

export const runtime = "nodejs";

// For the compose window's preview: our own Gmail signature as plain text
// only. Read through the 10-minute server cache; never stored or logged.
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await getSignaturePreview();
  if (!result.ok) {
    if (result.reason === "not_configured") return NextResponse.json({ configured: false });
    return NextResponse.json({ configured: true, status: "unavailable" });
  }
  return NextResponse.json({ configured: true, ...result.data });
}
