import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SCRAP_REASON_LABELS } from "@/lib/crm-constants";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// Notes/Deal value/Quantity/Target area/Printing/Design all map directly to
// existing Lead columns. "Campaign start date" has no home on Lead (that
// field only exists on Job, created once a lead reaches Won) — rather than
// add a column for a lead that isn't Won yet, it's folded into the logged
// note text below so it's still on record, just not structured.
function buildQuickEntryData(body: Record<string, unknown>) {
  const data: Record<string, unknown> = {};
  if (typeof body.dealValue === "string" || typeof body.dealValue === "number") {
    const n = Number(body.dealValue);
    if (body.dealValue === "" ) data.dealValue = null;
    else if (!Number.isNaN(n)) data.dealValue = n;
  }
  if (typeof body.leafletQuantity === "string") data.leafletQuantity = body.leafletQuantity || null;
  if (typeof body.targetAreas === "string") data.targetAreas = body.targetAreas || null;
  if (typeof body.printingIncluded === "boolean") data.printingIncluded = body.printingIncluded;
  if (typeof body.designIncluded === "boolean") data.designIncluded = body.designIncluded;
  return data;
}

function buildNoteDetail(body: Record<string, unknown>): string | null {
  const parts: string[] = [];
  if (typeof body.notes === "string" && body.notes.trim()) parts.push(body.notes.trim());
  if (typeof body.campaignStartDate === "string" && body.campaignStartDate) {
    parts.push(
      `Preferred campaign start: ${new Date(body.campaignStartDate).toLocaleDateString("en-GB")}`
    );
  }
  return parts.length > 0 ? parts.join("\n") : null;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const outcome = body.outcome;

  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const noteDetail = buildNoteDetail(body);
  const activityOps = [];

  if (outcome === "NO_ANSWER") {
    const streak = lead.noAnswerStreak + 1;
    let nextCallableAt: Date;
    if (streak === 1) nextCallableAt = new Date(Date.now() + DAY);
    else if (streak === 2) nextCallableAt = new Date(Date.now() + 2 * DAY);
    else nextCallableAt = new Date(Date.now() + 7 * DAY);
    const promptScrap = streak >= 3 && streak % 3 === 0;

    await prisma.$transaction([
      prisma.lead.update({
        where: { id },
        data: { noAnswerStreak: streak, nextCallableAt },
      }),
      prisma.activity.create({
        data: { leadId: id, type: "CALL", detail: "Dialer: No Answer", userId: session.user.id },
      }),
    ]);

    return NextResponse.json({ streak, promptScrap });
  }

  if (outcome === "WARM") {
    const quickData = buildQuickEntryData(body);
    activityOps.push(
      prisma.activity.create({
        data: { leadId: id, type: "CALL", detail: "Dialer: Marked Warm", userId: session.user.id },
      })
    );
    if (noteDetail) {
      activityOps.push(
        prisma.activity.create({
          data: { leadId: id, type: "NOTE", detail: noteDetail, userId: session.user.id },
        })
      );
    }
    const [updated] = await prisma.$transaction([
      prisma.lead.update({
        where: { id },
        data: {
          ...quickData,
          stage: "AWAITING_RESPONSE",
          noAnswerStreak: 0,
          nextCallableAt: null,
        },
      }),
      ...activityOps,
    ]);
    return NextResponse.json({ lead: updated });
  }

  if (outcome === "CALL_BACK") {
    const callbackAt = typeof body.callbackAt === "string" ? new Date(body.callbackAt) : null;
    if (!callbackAt || Number.isNaN(callbackAt.getTime())) {
      return NextResponse.json({ error: "A callback date/time is required" }, { status: 400 });
    }
    const quickData = buildQuickEntryData(body);
    const dateLabel = callbackAt.toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
    activityOps.push(
      prisma.activity.create({
        data: {
          leadId: id,
          type: "CALL",
          detail: `Dialer: Call Back requested for ${dateLabel}`,
          userId: session.user.id,
        },
      })
    );
    if (noteDetail) {
      activityOps.push(
        prisma.activity.create({
          data: { leadId: id, type: "NOTE", detail: noteDetail, userId: session.user.id },
        })
      );
    }
    const [updated] = await prisma.$transaction([
      prisma.lead.update({
        where: { id },
        data: {
          ...quickData,
          nextCallableAt: callbackAt,
          assignedToId: session.user.id,
          noAnswerStreak: 0,
        },
      }),
      ...activityOps,
    ]);
    return NextResponse.json({ lead: updated });
  }

  if (outcome === "SCRAP") {
    const reason = body.reason;
    const validReasons = Object.keys(SCRAP_REASON_LABELS);
    if (!validReasons.includes(reason)) {
      return NextResponse.json({ error: "Invalid scrap reason" }, { status: 400 });
    }
    const note = typeof body.note === "string" ? body.note.trim() : "";
    if (reason === "OTHER" && !note) {
      return NextResponse.json({ error: "A note is required for Other" }, { status: 400 });
    }
    const detail =
      reason === "OTHER"
        ? `Dialer: Scrapped — Other: ${note}`
        : `Dialer: Scrapped — ${SCRAP_REASON_LABELS[reason]}`;

    const [updated] = await prisma.$transaction([
      prisma.lead.update({
        where: { id },
        data: {
          scrapped: true,
          scrapReason: reason,
          scrapNote: reason === "OTHER" ? note : null,
          scrappedAt: new Date(),
        },
      }),
      prisma.activity.create({
        data: { leadId: id, type: "CALL", detail, userId: session.user.id },
      }),
    ]);
    return NextResponse.json({ lead: updated });
  }

  return NextResponse.json({ error: "Invalid outcome" }, { status: 400 });
}
