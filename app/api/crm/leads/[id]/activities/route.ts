import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const VALID_TYPES = ["CALL", "EMAIL", "NOTE", "STAGE_CHANGE"];

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { type, detail } = await req.json();

  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: "Invalid activity type" }, { status: 400 });
  }
  if (!detail || typeof detail !== "string") {
    return NextResponse.json({ error: "Detail is required" }, { status: 400 });
  }

  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const activity = await prisma.activity.create({
    data: {
      leadId: id,
      type,
      detail,
      userId: session.user.id,
    },
  });

  return NextResponse.json({ activity }, { status: 201 });
}
