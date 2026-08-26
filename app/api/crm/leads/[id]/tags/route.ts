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
  const { tagId } = await req.json();
  if (!tagId || typeof tagId !== "string") {
    return NextResponse.json({ error: "tagId is required" }, { status: 400 });
  }

  await prisma.leadTag.upsert({
    where: { leadId_tagId: { leadId, tagId } },
    update: {},
    create: { leadId, tagId },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: leadId } = await params;
  const { tagId } = await req.json();
  if (!tagId || typeof tagId !== "string") {
    return NextResponse.json({ error: "tagId is required" }, { status: 400 });
  }

  await prisma.leadTag.deleteMany({ where: { leadId, tagId } });
  return NextResponse.json({ ok: true });
}
