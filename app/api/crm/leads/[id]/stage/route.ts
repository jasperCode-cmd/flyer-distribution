import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { STAGE_LABELS } from "@/lib/crm-constants";

const VALID_STAGES = ["UNCONTACTED", "AWAITING_RESPONSE", "WON", "LOST"];

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { stage } = await req.json();

  if (!VALID_STAGES.includes(stage)) {
    return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
  }

  const existing = await prisma.lead.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [lead] = await prisma.$transaction([
    prisma.lead.update({ where: { id }, data: { stage } }),
    prisma.activity.create({
      data: {
        leadId: id,
        type: "STAGE_CHANGE",
        detail: `Stage changed from ${STAGE_LABELS[existing.stage]} to ${STAGE_LABELS[stage]}`,
        userId: session.user.id,
      },
    }),
  ]);

  // A Won lead gets a Job record created automatically if it doesn't have one yet.
  if (stage === "WON") {
    const job = await prisma.job.findUnique({ where: { leadId: id } });
    if (!job) {
      await prisma.job.create({ data: { leadId: id } });
    }
  }

  return NextResponse.json({ lead });
}
