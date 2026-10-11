import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatWonDate, wonAtFromDateInput, wonDateInput } from "@/lib/profit";
import { loadProfitJob, PROFIT_LEAD_WHERE } from "@/lib/profit-data";

// Sets a job's won date by hand, which decides the month its profit counts
// towards. Takes a UK calendar day ("2026-08-01"), stored as midday UTC on
// that day, and notes the change on the lead's activity.
export async function PATCH(req: Request, { params }: { params: Promise<{ leadId: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { leadId } = await params;
  const body = await req.json().catch(() => null);
  const wonDate = typeof body?.wonDate === "string" ? body.wonDate : "";
  const wonAt = wonAtFromDateInput(wonDate);
  if (!wonAt) {
    return NextResponse.json({ error: "Choose a valid date." }, { status: 400 });
  }
  if (wonDate > wonDateInput(new Date().toISOString())) {
    return NextResponse.json({ error: "The won date can't be in the future." }, { status: 400 });
  }

  const lead = await prisma.lead.findFirst({
    where: { id: leadId, ...PROFIT_LEAD_WHERE },
    select: { id: true, wonAt: true },
  });
  if (!lead) {
    return NextResponse.json({ error: "This lead is no longer Won or Completed." }, { status: 409 });
  }

  const before = lead.wonAt ? lead.wonAt.toISOString() : null;
  if (before && wonDateInput(before) === wonDate) {
    return NextResponse.json({ job: await loadProfitJob(prisma, leadId) });
  }

  try {
    await prisma.$transaction([
      prisma.lead.update({ where: { id: leadId }, data: { wonAt } }),
      prisma.activity.create({
        data: {
          leadId,
          type: "NOTE",
          detail: `Won date set to ${formatWonDate(wonAt.toISOString())}${
            before ? ` (was ${formatWonDate(before)})` : ""
          } on the Profit page`,
          userId: session.user.id ?? null,
        },
      }),
    ]);
    return NextResponse.json({ job: await loadProfitJob(prisma, leadId) });
  } catch (err) {
    console.error(`Failed to set the won date on lead ${leadId}:`, err);
    return NextResponse.json({ error: "Failed to save the won date." }, { status: 500 });
  }
}
