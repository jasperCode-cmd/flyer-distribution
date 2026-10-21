import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseRecordedDeposit, ukToday } from "@/lib/documents/rules";
import { recordOutsideDeposit } from "@/lib/documents/service";
import { documentErrorResponse } from "@/lib/documents/views";

export const runtime = "nodejs";

// Recording a deposit invoice that was issued and paid outside the CRM, on
// its lead, so balance invoices deduct it. Nothing is made or sent.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid deposit" }, { status: 400 });
  }
  if (typeof body?.leadId !== "string" || !body.leadId) {
    return NextResponse.json({ error: "Choose a lead" }, { status: 400 });
  }
  const parsed = parseRecordedDeposit(body, ukToday(new Date()));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  try {
    const invoice = await recordOutsideDeposit(prisma, body.leadId, parsed.data, { userId: session.user.id ?? null });
    return NextResponse.json({ kind: "invoice", ...invoice }, { status: 201 });
  } catch (err) {
    return documentErrorResponse(err, "record the deposit");
  }
}
