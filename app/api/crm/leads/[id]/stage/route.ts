import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { STAGE_LABELS } from "@/lib/crm-constants";

const VALID_STAGES = ["UNCONTACTED", "AWAITING_RESPONSE", "WON", "COMPLETED", "LOST"];

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { stage, lostReason, lostReasonNote } = await req.json();

  if (!VALID_STAGES.includes(stage)) {
    return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
  }

  const existing = await prisma.lead.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // The board and this route both validate `stage` against their own
  // in-code VALID_STAGES list — that's an application-level check, not a
  // guarantee the database's PipelineStage enum actually has this value
  // yet (e.g. a migration adding a new stage reviewed but not yet applied
  // to this database). Without a try/catch that mismatch previously failed
  // silently from the caller's point of view: the client's optimistic
  // Kanban update just reverted with no visible reason. Logging and
  // returning a real error here makes that failure mode diagnosable
  // instead of looking like a mysterious drag-and-drop bug.
  try {
    const [lead] = await prisma.$transaction([
      prisma.lead.update({
        where: { id },
        data: {
          stage,
          ...(stage === "LOST"
            ? { lostReason: lostReason || null, lostReasonNote: lostReasonNote || null }
            : {}),
        },
      }),
      prisma.activity.create({
        data: {
          leadId: id,
          type: "STAGE_CHANGE",
          detail: `Stage changed from ${STAGE_LABELS[existing.stage]} to ${STAGE_LABELS[stage]}`,
          userId: session.user.id,
        },
      }),
    ]);

    // A Won or Completed lead gets a Job record created automatically if it
    // doesn't have one yet (normally already true by the time a lead reaches
    // Completed, but this covers a lead moved there directly).
    if (stage === "WON" || stage === "COMPLETED") {
      const job = await prisma.job.findUnique({ where: { leadId: id } });
      if (!job) {
        await prisma.job.create({ data: { leadId: id } });
      }
    }

    return NextResponse.json({ lead });
  } catch (err) {
    console.error(`Failed to update lead ${id} to stage ${stage}:`, err);
    return NextResponse.json({ error: "Failed to update stage" }, { status: 500 });
  }
}
