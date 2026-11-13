import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { roundsFailure, signedIn, unauthorised } from "@/lib/rounds/api";
import { revokeReportLink } from "@/lib/rounds/service";
import { isId } from "@/lib/rounds/validate";

// Revoking a client's report link: it stops working at once.

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await signedIn())) return unauthorised();
  const { id } = await params;
  if (!isId(id)) return NextResponse.json({ error: "That link no longer exists." }, { status: 404 });
  try {
    await revokeReportLink(prisma, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return roundsFailure(err, "revoke a report link");
  }
}
