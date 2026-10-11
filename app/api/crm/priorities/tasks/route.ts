import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isPriorityLevel } from "@/lib/priorities";

const MAX_TITLE = 200;

// "Add task" on the Priorities page: a title, a due date, a priority, and
// optionally the lead it is about.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const dueDay = typeof body?.dueDate === "string" ? body.dueDate : "";
  const priority = body?.priority ?? "NORMAL";
  const leadId = typeof body?.leadId === "string" && body.leadId ? body.leadId : null;

  if (!title) return NextResponse.json({ error: "Give the task a title." }, { status: 400 });
  if (title.length > MAX_TITLE) return NextResponse.json({ error: `The title can be up to ${MAX_TITLE} characters.` }, { status: 400 });
  const due = /^\d{4}-\d{2}-\d{2}$/.test(dueDay) ? new Date(`${dueDay}T12:00:00Z`) : null;
  if (!due || Number.isNaN(due.getTime()) || due.toISOString().slice(0, 10) !== dueDay) {
    return NextResponse.json({ error: "Choose a due date." }, { status: 400 });
  }
  if (!isPriorityLevel(priority)) return NextResponse.json({ error: "Choose a priority." }, { status: 400 });
  if (leadId) {
    const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true } });
    if (!lead) return NextResponse.json({ error: "That lead no longer exists." }, { status: 400 });
  }

  const task = await prisma.task.create({
    data: { description: title, dueDate: due, priority, leadId },
    select: { id: true },
  });
  return NextResponse.json({ task }, { status: 201 });
}
