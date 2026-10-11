import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buildDistributorData } from "@/lib/distributors";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const distributors = await prisma.distributor.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
  return NextResponse.json({ distributors });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, phone, email, notes } = await req.json();
  const built = buildDistributorData({ name, phone, email, notes });
  if (!built.ok) {
    return NextResponse.json({ error: built.error }, { status: 400 });
  }

  const distributor = await prisma.distributor.create({ data: built.data });
  return NextResponse.json({ distributor }, { status: 201 });
}
