import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { completed } = await req.json();

  const task = await prisma.task.update({
    where: { id },
    data: { completed: Boolean(completed) },
  });

  return NextResponse.json({ task });
}
