import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isPriorityLevel } from "@/lib/priorities";

// Changes a task's priority from the Priorities list.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!isPriorityLevel(body?.priority)) {
    return NextResponse.json({ error: "Choose a priority." }, { status: 400 });
  }
  const updated = await prisma.task.updateMany({ where: { id }, data: { priority: body.priority } });
  if (updated.count === 0) {
    return NextResponse.json({ error: "That task no longer exists." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
