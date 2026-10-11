import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { loadDatabaseFacts, scanUnansweredEmails } from "@/lib/priorities-data";
import { allItems, planPriorityAction, type PriorityAction } from "@/lib/priorities";
import { writePlannedAction } from "@/lib/priority-actions";

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

  try {
    await writePlannedAction(prisma, plan, session.user.id ?? null);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`Failed to apply ${action} to priority ${key}:`, err);
    return NextResponse.json({ error: "Failed to save. Please try again." }, { status: 500 });
  }
}
