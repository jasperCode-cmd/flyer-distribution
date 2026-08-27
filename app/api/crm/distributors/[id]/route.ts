import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Edit, and deactivate/reactivate via the active flag. There is deliberately
// no DELETE — past Jobs and CalendarEvents reference distributors, so they
// are retired rather than removed.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  const data: {
    name?: string;
    phone?: string | null;
    email?: string | null;
    notes?: string | null;
    active?: boolean;
  } = {};

  if (typeof body.name === "string") {
    if (!body.name.trim()) {
      return NextResponse.json({ error: "Distributor name is required" }, { status: 400 });
    }
    data.name = body.name.trim();
  }
  if ("phone" in body) {
    data.phone = typeof body.phone === "string" && body.phone.trim() ? body.phone.trim() : null;
  }
  if ("email" in body) {
    data.email = typeof body.email === "string" && body.email.trim() ? body.email.trim() : null;
  }
  if ("notes" in body) {
    data.notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null;
  }
  if (typeof body.active === "boolean") {
    data.active = body.active;
  }

  const distributor = await prisma.distributor.update({ where: { id }, data });
  return NextResponse.json({ distributor });
}
