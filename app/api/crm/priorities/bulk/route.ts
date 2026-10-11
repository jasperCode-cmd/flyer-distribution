import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { loadDatabaseFacts, scanUnansweredEmails } from "@/lib/priorities-data";
import { allItems, type PriorityAction } from "@/lib/priorities";
import { applyBulkPriorityAction, isLostReason, markLeadsLost } from "@/lib/priority-actions";

export const runtime = "nodejs";

const MAX_ITEMS = 200;

function strings(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_ITEMS) return null;
  return value.every((v) => typeof v === "string" && v.length > 0 && v.length <= 200) ? (value as string[]) : null;
}

// The Priorities page's bulk bar: Done, Snooze or Still in talks on several
// items (by key, worked out again here), or Mark as Lost on several leads
// with one lost reason. Each one is saved on its own and the result of each
// comes back, so the page can say which failed.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const action = body?.action;
  const userId = session.user.id ?? null;
  const now = new Date();

  if (action === "lost") {
    const leadIds = strings(body?.leadIds);
    if (!leadIds) return NextResponse.json({ error: "Choose up to 200 leads." }, { status: 400 });
    if (!isLostReason(body?.lostReason)) return NextResponse.json({ error: "Choose why they were lost." }, { status: 400 });
    const note = typeof body?.lostReasonNote === "string" ? body.lostReasonNote.slice(0, 500) : "";
    const results = await markLeadsLost(prisma, leadIds, body.lostReason, note, userId, now, (id, err) =>
      console.error(`Bulk Mark as Lost failed for lead ${id}:`, err)
    );
    return NextResponse.json({ results });
  }

  if (!["done", "snooze", "still_in_talks"].includes(action)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const keys = strings(body?.keys);
  if (!keys) return NextResponse.json({ error: "Choose up to 200 items." }, { status: 400 });
  const days = typeof body?.days === "number" ? body.days : undefined;

  const facts = await loadDatabaseFacts(now);
  const scan = keys.some((k) => k.startsWith("email:")) ? await scanUnansweredEmails() : null;
  const items = allItems({ ...facts, emails: scan?.emails ?? [] });
  const results = await applyBulkPriorityAction(prisma, items, keys, action as PriorityAction, days, userId, now, (key, err) =>
    console.error(`Bulk ${action} failed for priority ${key}:`, err)
  );
  return NextResponse.json({ results });
}
