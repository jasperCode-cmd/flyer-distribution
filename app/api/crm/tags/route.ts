import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tags = await prisma.tag.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({ tags });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, color } = await req.json();
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Tag name is required" }, { status: 400 });
  }

  try {
    const tag = await prisma.tag.create({
      data: { name: name.trim(), color: typeof color === "string" && color ? color : "#2563eb" },
    });
    return NextResponse.json({ tag }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "A tag with that name already exists" }, { status: 409 });
  }
}
