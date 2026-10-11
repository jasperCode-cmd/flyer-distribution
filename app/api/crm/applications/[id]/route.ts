import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { APPLICATION_LIMITS, isApplicationStatus, type ApplicationStatus } from "@/lib/distributor-applications";

// Status and notes are the only things staff change on an application; what
// the applicant gave is kept exactly as they gave it.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const data: { status?: ApplicationStatus; notes?: string | null } = {};
  if ("status" in body) {
    if (!isApplicationStatus(body.status)) {
      return NextResponse.json({ error: "Unknown status" }, { status: 400 });
    }
    data.status = body.status;
  }
  if ("notes" in body) {
    if (body.notes !== null && typeof body.notes !== "string") {
      return NextResponse.json({ error: "Invalid notes" }, { status: 400 });
    }
    const notes = typeof body.notes === "string" ? body.notes.trim() : "";
    if (notes.length > APPLICATION_LIMITS.notes) {
      return NextResponse.json({ error: `Notes can be up to ${APPLICATION_LIMITS.notes} characters` }, { status: 400 });
    }
    data.notes = notes || null;
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to change" }, { status: 400 });
  }

  const updated = await prisma.distributorApplication.updateMany({ where: { id }, data });
  if (updated.count === 0) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }
  const application = await prisma.distributorApplication.findUnique({
    where: { id },
    select: { id: true, status: true, notes: true },
  });
  return NextResponse.json({ application });
}
