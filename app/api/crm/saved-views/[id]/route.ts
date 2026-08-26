import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  // Scoped to the owning user so one account can't delete another's saved view.
  await prisma.savedFilterView.deleteMany({ where: { id, userId: session.user.id } });
  return NextResponse.json({ ok: true });
}
