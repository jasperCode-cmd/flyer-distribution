import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { validateExpenseInput } from "@/lib/expenses";
import { toExpenseRecord } from "@/lib/profit-data";

// Adds a business expense: one-off on a date, or every month from a start
// month (to an optional end month).
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const checked = validateExpenseInput(await req.json().catch(() => null));
  if (!checked.ok) {
    return NextResponse.json({ error: checked.error }, { status: 400 });
  }

  try {
    const expense = await prisma.expense.create({
      data: { ...checked.data, createdById: session.user.id ?? null },
    });
    return NextResponse.json({ expense: toExpenseRecord(expense) }, { status: 201 });
  } catch (err) {
    console.error("Failed to add an expense:", err);
    return NextResponse.json({ error: "Failed to save the expense." }, { status: 500 });
  }
}
