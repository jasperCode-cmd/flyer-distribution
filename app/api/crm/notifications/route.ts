import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getFollowUpTasks } from "@/lib/crm-data";

// Backs the shared notification badge (identical for both users, not
// scoped to assignment) and the live inbound-lead popup, both driven by
// simple polling from CrmShell — no websocket/real-time infra for a
// two-person internal tool.
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [websiteLeads, dueCallbacks, { overdue, today }] = await Promise.all([
    prisma.lead.findMany({
      where: { scrapped: false, stage: "UNCONTACTED", source: "WEBSITE_QUOTE_FORM" },
      select: { id: true, name: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.lead.findMany({
      where: { scrapped: false, stage: "UNCONTACTED", nextCallableAt: { lte: new Date() } },
      select: { id: true, name: true, nextCallableAt: true },
      orderBy: { nextCallableAt: "asc" },
    }),
    getFollowUpTasks(),
  ]);

  const followUps = [...overdue, ...today].map((t) => ({
    id: t.id,
    description: t.description,
    dueDate: t.dueDate,
    leadId: t.lead.id,
    leadName: t.lead.name,
    overdue: t.dueDate < (() => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d;
    })(),
  }));

  const count = websiteLeads.length + dueCallbacks.length + followUps.length;

  return NextResponse.json({ count, websiteLeads, dueCallbacks, followUps });
}
