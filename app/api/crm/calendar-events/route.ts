import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CALENDAR_EVENT_TYPES } from "@/lib/calendar-constants";

function parseDate(v: unknown): Date | null {
  if (typeof v !== "string" || !v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { type, title } = body;

  if (!CALENDAR_EVENT_TYPES.includes(type)) {
    return NextResponse.json({ error: "Invalid event type" }, { status: 400 });
  }
  if (!title || typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const startDateTime = parseDate(body.startDateTime);
  if (!startDateTime) {
    return NextResponse.json({ error: "A valid start date/time is required" }, { status: 400 });
  }

  const endDateTime = parseDate(body.endDateTime);
  if (endDateTime && endDateTime.getTime() < startDateTime.getTime()) {
    return NextResponse.json({ error: "End must be after start" }, { status: 400 });
  }

  // A distributor only means anything on a shift; anything else would show
  // up under the distributor filter misleadingly.
  const distributorId =
    type === "DISTRIBUTOR_SHIFT" && typeof body.distributorId === "string" && body.distributorId
      ? body.distributorId
      : null;

  const event = await prisma.calendarEvent.create({
    data: {
      type,
      title: title.trim(),
      startDateTime,
      endDateTime,
      notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null,
      linkedLeadId: typeof body.linkedLeadId === "string" && body.linkedLeadId ? body.linkedLeadId : null,
      linkedJobId: typeof body.linkedJobId === "string" && body.linkedJobId ? body.linkedJobId : null,
      assignedToUserId:
        typeof body.assignedToUserId === "string" && body.assignedToUserId
          ? body.assignedToUserId
          : null,
      distributorId,
    },
    include: {
      assignedToUser: { select: { id: true, name: true } },
      distributor: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ event }, { status: 201 });
}
