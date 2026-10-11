import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { validateRetainerInput } from "@/lib/expenses";
import { formatPence } from "@/lib/money";
import { monthLabel } from "@/lib/profit";
import { loadProfitJob, PROFIT_LEAD_WHERE } from "@/lib/profit-data";

// Makes a job a retainer (a monthly amount from a start month to an optional
// end month) or turns that off, and notes the change on the lead's activity.
// Only for leads in Won or Completed, like everything on the Profit page.
export async function PATCH(req: Request, { params }: { params: Promise<{ leadId: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { leadId } = await params;
  const checked = validateRetainerInput(await req.json().catch(() => null));
  if (!checked.ok) {
    return NextResponse.json({ error: checked.error }, { status: 400 });
  }

  const lead = await prisma.lead.findFirst({ where: { id: leadId, ...PROFIT_LEAD_WHERE }, select: { id: true } });
  if (!lead) {
    return NextResponse.json({ error: "This lead is no longer Won or Completed." }, { status: 409 });
  }

  const data = checked.data;
  const detail = data.isRetainer
    ? `Retainer set: ${formatPence(data.retainerMonthlyPence)} a month from ${monthLabel(
        data.retainerStart.toISOString().slice(0, 7)
      )}${data.retainerEnd ? ` to ${monthLabel(data.retainerEnd.toISOString().slice(0, 7))}` : ", ongoing"}`
    : "Retainer turned off";

  try {
    await prisma.$transaction([
      prisma.lead.update({ where: { id: leadId }, data }),
      prisma.activity.create({
        data: { leadId, type: "NOTE", detail: `${detail} on the Profit page`, userId: session.user.id ?? null },
      }),
    ]);
    return NextResponse.json({ job: await loadProfitJob(prisma, leadId) });
  } catch (err) {
    console.error(`Failed to save the retainer on lead ${leadId}:`, err);
    return NextResponse.json({ error: "Failed to save the retainer." }, { status: 500 });
  }
}
