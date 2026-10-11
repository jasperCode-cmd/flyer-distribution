import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { validateCostInput } from "@/lib/job-costs";
import { loadProfitJob, PROFIT_LEAD_WHERE } from "@/lib/profit-data";

// Adds a cost line to a job on the Profit page. Returns the job as the page
// shows it, so the card and panel redraw from the saved figures.
export async function POST(req: Request, { params }: { params: Promise<{ leadId: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { leadId } = await params;
  const body = await req.json().catch(() => null);
  const checked = validateCostInput(body);
  if (!checked.ok) {
    return NextResponse.json({ error: checked.error }, { status: 400 });
  }

  const lead = await prisma.lead.findFirst({ where: { id: leadId, ...PROFIT_LEAD_WHERE }, select: { id: true } });
  if (!lead) {
    return NextResponse.json({ error: "This lead is no longer Won or Completed." }, { status: 409 });
  }
  if (checked.data.distributorId) {
    const distributor = await prisma.distributor.findUnique({
      where: { id: checked.data.distributorId },
      select: { id: true },
    });
    if (!distributor) {
      return NextResponse.json({ error: "That distributor no longer exists." }, { status: 400 });
    }
  }

  try {
    await prisma.jobCost.create({ data: { ...checked.data, leadId } });
    return NextResponse.json({ job: await loadProfitJob(prisma, leadId) }, { status: 201 });
  } catch (err) {
    console.error(`Failed to add a cost line to lead ${leadId}:`, err);
    return NextResponse.json({ error: "Failed to save the cost." }, { status: 500 });
  }
}
