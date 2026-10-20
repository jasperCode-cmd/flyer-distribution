import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { deleteArea, plannerDistributor, storedShapes, totalsFor, updateArea } from "@/lib/area-planner/service";
import { validateAreaChanges } from "@/lib/area-planner/validate";
import { DATABASE_LIMIT_MS, TOTALS_WITH_AREAS_MS, plannerFailure, readJson, timeLeft, timedJson, within } from "@/lib/area-planner/api";
import { ServerTiming } from "@/lib/area-planner/timing";

// Edits or deletes one area. Its Profit cost line follows in the same
// transaction. Replies with just that area as saved (or its id, once
// deleted), the distributor it's with, and the project's totals if they're
// ready within a moment (else null, and the page asks /totals).

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const timing = new ServerTiming();
  const { id } = await params;
  const checked = validateAreaChanges(await readJson(req));
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });
  try {
    const { projectId, area } = await timing.step("save", () => within(timeLeft(timing, DATABASE_LIMIT_MS), "save an area", updateArea(prisma, id, checked.changes)));
    const [distributor, shapes] = await timing.step("db-areas", () =>
      within(timeLeft(timing, DATABASE_LIMIT_MS), "read the project's shapes", Promise.all([plannerDistributor(prisma, area.distributorId), storedShapes(prisma, projectId)]))
    );
    const totals = await totalsFor(shapes, timeLeft(timing, TOTALS_WITH_AREAS_MS), timing, "update an area");
    return timedJson(timing, "update an area", { area, distributor, totals });
  } catch (err) {
    return plannerFailure(err, "update an area");
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const timing = new ServerTiming();
  const { id } = await params;
  try {
    const projectId = await timing.step("save", () => within(timeLeft(timing, DATABASE_LIMIT_MS), "delete an area", deleteArea(prisma, id)));
    const shapes = await timing.step("db-areas", () => within(timeLeft(timing, DATABASE_LIMIT_MS), "read the project's shapes", storedShapes(prisma, projectId)));
    const totals = await totalsFor(shapes, timeLeft(timing, TOTALS_WITH_AREAS_MS), timing, "delete an area");
    return timedJson(timing, "delete an area", { id, totals });
  } catch (err) {
    return plannerFailure(err, "delete an area");
  }
}
