import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { validateCostInput } from "@/lib/job-costs";
import { loadProfitJob } from "@/lib/profit-data";
import type { CostCategory } from "@/lib/profit";

// Edits or deletes one cost line. What the line is for (its category) is
// fixed once it is added. Both return the job as the Profit page shows it,
// or null if the lead has since left Won or Completed.

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.jobCost.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "That cost has already been deleted." }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const checked = validateCostInput(body, {
    fixedCategory: existing.category as CostCategory,
    keepDeletedDistributor: existing.distributorId === null,
  });
  if (!checked.ok) {
    return NextResponse.json({ error: checked.error }, { status: 400 });
  }
  if (checked.data.distributorId && checked.data.distributorId !== existing.distributorId) {
    const distributor = await prisma.distributor.findUnique({
      where: { id: checked.data.distributorId },
      select: { id: true },
    });
    if (!distributor) {
      return NextResponse.json({ error: "That distributor no longer exists." }, { status: 400 });
    }
  }

  try {
    await prisma.jobCost.update({ where: { id }, data: checked.data });
    return NextResponse.json({ job: await loadProfitJob(prisma, existing.leadId) });
  } catch (err) {
    console.error(`Failed to update cost line ${id}:`, err);
    return NextResponse.json({ error: "Failed to save the cost." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.jobCost.findUnique({ where: { id }, select: { leadId: true } });
  if (!existing) {
    return NextResponse.json({ error: "That cost has already been deleted." }, { status: 404 });
  }

  try {
    await prisma.jobCost.delete({ where: { id } });
    return NextResponse.json({ job: await loadProfitJob(prisma, existing.leadId) });
  } catch (err) {
    console.error(`Failed to delete cost line ${id}:`, err);
    return NextResponse.json({ error: "Failed to delete the cost." }, { status: 500 });
  }
}
