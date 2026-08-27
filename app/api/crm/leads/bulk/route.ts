import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { STAGE_LABELS, SOURCE_LABELS } from "@/lib/crm-constants";

const VALID_STAGES = ["UNCONTACTED", "AWAITING_RESPONSE", "WON", "LOST"];
// Derived from the label map rather than a second hand-written list, so a new
// LeadSource can never be offered in the UI but rejected here.
const VALID_SOURCES = Object.keys(SOURCE_LABELS);

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { ids, stage, assignedToId, source } = await req.json();

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "No leads selected" }, { status: 400 });
  }
  if (stage === undefined && assignedToId === undefined && source === undefined) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }
  if (stage !== undefined && !VALID_STAGES.includes(stage)) {
    return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
  }
  if (source !== undefined && !VALID_SOURCES.includes(source)) {
    return NextResponse.json({ error: "Invalid source" }, { status: 400 });
  }

  const leads = await prisma.lead.findMany({ where: { id: { in: ids } } });

  const ops = [];

  if (stage !== undefined) {
    for (const lead of leads) {
      if (lead.stage === stage) continue;
      ops.push(
        prisma.lead.update({ where: { id: lead.id }, data: { stage } }),
        prisma.activity.create({
          data: {
            leadId: lead.id,
            type: "STAGE_CHANGE",
            detail: `Stage changed from ${STAGE_LABELS[lead.stage]} to ${STAGE_LABELS[stage]} (bulk action)`,
            userId: session.user.id,
          },
        })
      );
    }
  }

  if (assignedToId !== undefined) {
    const assignee = assignedToId ? await prisma.user.findUnique({ where: { id: assignedToId } }) : null;
    for (const lead of leads) {
      if (lead.assignedToId === assignedToId) continue;
      ops.push(
        prisma.lead.update({ where: { id: lead.id }, data: { assignedToId: assignedToId || null } }),
        prisma.activity.create({
          data: {
            leadId: lead.id,
            type: "NOTE",
            detail: assignee ? `Reassigned to ${assignee.name} (bulk action)` : "Unassigned (bulk action)",
            userId: session.user.id,
          },
        })
      );
    }
  }

  if (source !== undefined) {
    for (const lead of leads) {
      if (lead.source === source) continue;
      ops.push(
        prisma.lead.update({ where: { id: lead.id }, data: { source } }),
        prisma.activity.create({
          data: {
            leadId: lead.id,
            type: "NOTE",
            detail: `Source changed from ${SOURCE_LABELS[lead.source] ?? lead.source} to ${
              SOURCE_LABELS[source] ?? source
            } (bulk action)`,
            userId: session.user.id,
          },
        })
      );
    }
  }

  if (ops.length > 0) {
    await prisma.$transaction(ops);
  }

  if (stage === "WON") {
    for (const lead of leads) {
      const job = await prisma.job.findUnique({ where: { leadId: lead.id } });
      if (!job) await prisma.job.create({ data: { leadId: lead.id } });
    }
  }

  return NextResponse.json({ updated: leads.length });
}
