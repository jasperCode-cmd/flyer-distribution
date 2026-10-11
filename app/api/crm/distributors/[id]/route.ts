import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buildDistributorUpdate } from "@/lib/distributors";

// Edit, and deactivate/reactivate via the active flag. There is deliberately
// no DELETE: past Jobs, cost lines and CalendarEvents reference
// distributors, so they are retired rather than removed.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const built = buildDistributorUpdate(body);
  if (!built.ok) {
    return NextResponse.json({ error: built.error }, { status: 400 });
  }

  const updated = await prisma.distributor.updateMany({ where: { id }, data: built.data });
  if (updated.count === 0) {
    return NextResponse.json({ error: "That distributor no longer exists." }, { status: 404 });
  }
  const distributor = await prisma.distributor.findUnique({ where: { id } });
  return NextResponse.json({ distributor });
}
