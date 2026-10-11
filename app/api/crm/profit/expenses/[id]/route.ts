import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { validateExpenseInput } from "@/lib/expenses";
import { toExpenseRecord } from "@/lib/profit-data";

// Edits or deletes one expense. Ending a monthly expense is an edit that sets
// its end month, which keeps every month before it counted; deleting removes
// it from every month, and is only for one added by mistake.

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const checked = validateExpenseInput(await req.json().catch(() => null));
  if (!checked.ok) {
    return NextResponse.json({ error: checked.error }, { status: 400 });
  }

  const updated = await prisma.expense.updateMany({ where: { id }, data: checked.data });
  if (updated.count === 0) {
    return NextResponse.json({ error: "That expense has been deleted." }, { status: 404 });
  }
  const expense = await prisma.expense.findUnique({ where: { id } });
  return NextResponse.json({ expense: expense ? toExpenseRecord(expense) : null });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const deleted = await prisma.expense.deleteMany({ where: { id } });
  if (deleted.count === 0) {
    return NextResponse.json({ error: "That expense has already been deleted." }, { status: 404 });
  }
  return NextResponse.json({ deleted: true });
}
