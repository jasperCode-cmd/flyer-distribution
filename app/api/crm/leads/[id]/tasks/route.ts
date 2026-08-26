import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: leadId } = await params;
  const { description, dueDate } = await req.json();

  if (!description || typeof description !== "string" || !description.trim()) {
    return NextResponse.json({ error: "Description is required" }, { status: 400 });
  }
  if (!dueDate || Number.isNaN(Date.parse(dueDate))) {
    return NextResponse.json({ error: "A valid due date is required" }, { status: 400 });
  }

  const task = await prisma.task.create({
    data: { leadId, description: description.trim(), dueDate: new Date(dueDate) },
  });

  return NextResponse.json({ task }, { status: 201 });
}
