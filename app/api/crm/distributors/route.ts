import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Distributor name is required" }, { status: 400 });
  }

  const distributor = await prisma.distributor.create({
    data: {
      name: name.trim(),
      phone: typeof phone === "string" && phone.trim() ? phone.trim() : null,
      email: typeof email === "string" && email.trim() ? email.trim() : null,
      notes: typeof notes === "string" && notes.trim() ? notes.trim() : null,
    },
  });
  return NextResponse.json({ distributor }, { status: 201 });
}
