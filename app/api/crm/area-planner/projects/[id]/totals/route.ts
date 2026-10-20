import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { storedShapes, totalsFor } from "@/lib/area-planner/service";
import { DATABASE_LIMIT_MS, TOTALS_ON_THEIR_OWN_MS, plannerFailure, timeDatabaseWait, timeLeft, timedJson, within } from "@/lib/area-planner/api";
import { ServerTiming } from "@/lib/area-planner/timing";

// A project's totals (homes counted once, and its overlaps with the homes in
// each) for its areas as they're stored now. 200 with them, or 202 with
// null when they're still being worked out: the work carries on and the
// page asks again.

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const timing = new ServerTiming();
  const { id } = await params;
  try {
    await timeDatabaseWait(timing);
    const shapes = await timing.step("db-areas", () => within(timeLeft(timing, DATABASE_LIMIT_MS), "read a project's shapes", storedShapes(prisma, id)));
    const totals = await totalsFor(shapes, timeLeft(timing, TOTALS_ON_THEIR_OWN_MS), timing, "project totals");
    return timedJson(timing, "project totals", { totals }, { status: totals ? 200 : 202 });
  } catch (err) {
    return plannerFailure(err, "work out a project's totals");
  }
}
