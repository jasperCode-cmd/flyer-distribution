import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getConversation, isGmailConfigured } from "@/lib/gmail";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  if (!isGmailConfigured()) {
    return NextResponse.json({ configured: false, messages: [] });
  }

  const lead = await prisma.lead.findUnique({ where: { id }, select: { email: true } });
  if (!lead) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!lead.email) {
    return NextResponse.json({ configured: true, messages: [] });
  }

  const result = await getConversation(lead.email);
  if (!result.ok) {
    const status = result.reason === "reconnect" ? 409 : 502;
    return NextResponse.json({ error: result.message, reason: result.reason, configured: true }, { status });
  }

  return NextResponse.json({ configured: true, messages: result.data });
}
