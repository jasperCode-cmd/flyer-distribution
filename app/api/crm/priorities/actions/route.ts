import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { loadDatabaseFacts, scanUnansweredEmails } from "@/lib/priorities-data";
import { allItems, planPriorityAction, type PriorityAction } from "@/lib/priorities";

export const runtime = "nodejs";

// Done, Snooze or Still in talks on one item. The item and its fingerprint
// are worked out here from the current state; only its key, the action and
// the number of days come from the browser.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const key = typeof body?.key === "string" ? body.key : "";
  const action = body?.action as PriorityAction;
  const days = typeof body?.days === "number" ? body.days : undefined;
  if (!key || !["done", "snooze", "still_in_talks"].includes(action)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const now = new Date();
  const facts = await loadDatabaseFacts(now);
  const scan = key.startsWith("email:") ? await scanUnansweredEmails() : null;
  const entry = allItems({ ...facts, emails: scan?.emails ?? [] }).find((i) => i.key === key);
  if (!entry) {
    return NextResponse.json({ error: "That item has already cleared." }, { status: 404 });
  }

  const plan = planPriorityAction(entry, action, days, now);
  if ("error" in plan) {
    return NextResponse.json({ error: plan.error }, { status: 400 });
  }

  const userId = session.user.id ?? null;
  try {
    if (plan.kind === "complete_task") {
      await prisma.task.updateMany({ where: { id: plan.taskId, completed: false }, data: { completed: true } });
    } else {
      const data = {
        fingerprint: plan.fingerprint,
        dismissed: plan.dismissed,
        snoozedUntil: plan.snoozedUntil,
        note: plan.note,
        userId,
      };
      await prisma.$transaction([
        prisma.priorityDismissal.upsert({ where: { itemKey: plan.itemKey }, create: { itemKey: plan.itemKey, ...data }, update: data }),
        ...(plan.activity
          ? [prisma.activity.create({ data: { leadId: plan.activity.leadId, type: "NOTE" as const, detail: plan.activity.detail, userId } })]
          : []),
      ]);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`Failed to apply ${action} to priority ${key}:`, err);
    return NextResponse.json({ error: "Failed to save. Please try again." }, { status: 500 });
  }
}
