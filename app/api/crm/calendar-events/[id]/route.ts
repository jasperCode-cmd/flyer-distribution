import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CALENDAR_EVENT_TYPES } from "@/lib/calendar-constants";

function parseDate(v: unknown): Date | null {
  if (typeof v !== "string" || !v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

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

  const data: Record<string, unknown> = {};

  if ("type" in body) {
    if (!CALENDAR_EVENT_TYPES.includes(body.type)) {
      return NextResponse.json({ error: "Invalid event type" }, { status: 400 });
    }
    data.type = body.type;
  }
  if ("title" in body) {
    if (typeof body.title !== "string" || !body.title.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    data.title = body.title.trim();
  }
  if ("startDateTime" in body) {
    const start = parseDate(body.startDateTime);
    if (!start) {
      return NextResponse.json({ error: "A valid start date/time is required" }, { status: 400 });
    }
    data.startDateTime = start;
  }
  if ("endDateTime" in body) {
    data.endDateTime = parseDate(body.endDateTime);
  }
  if ("notes" in body) {
    data.notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null;
  }
  if ("linkedLeadId" in body) {
    data.linkedLeadId = typeof body.linkedLeadId === "string" && body.linkedLeadId ? body.linkedLeadId : null;
  }
  if ("linkedJobId" in body) {
    data.linkedJobId = typeof body.linkedJobId === "string" && body.linkedJobId ? body.linkedJobId : null;
  }
  if ("assignedToUserId" in body) {
    data.assignedToUserId =
      typeof body.assignedToUserId === "string" && body.assignedToUserId ? body.assignedToUserId : null;
  }
  if ("distributorId" in body) {
    data.distributorId =
      typeof body.distributorId === "string" && body.distributorId ? body.distributorId : null;
  }
  if (typeof body.completed === "boolean") {
    data.completed = body.completed;
  }

  // Changing away from a shift clears the distributor, so the field can't
  // linger on a type where it has no meaning.
  const nextType = (data.type as string | undefined) ?? undefined;
  if (nextType && nextType !== "DISTRIBUTOR_SHIFT") {
    data.distributorId = null;
  }

  const start = data.startDateTime as Date | undefined;
  const end = data.endDateTime as Date | null | undefined;
  if (start && end && end.getTime() < start.getTime()) {
    return NextResponse.json({ error: "End must be after start" }, { status: 400 });
  }

  const event = await prisma.calendarEvent.update({
    where: { id },
    data,
    include: {
      assignedToUser: { select: { id: true, name: true } },
      distributor: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ event });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await prisma.calendarEvent.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
