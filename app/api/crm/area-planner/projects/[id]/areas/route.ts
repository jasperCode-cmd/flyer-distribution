import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createArea, createPostcodeAreas, plannerDistributor, storedShapes, totalsFor } from "@/lib/area-planner/service";
import { validateNewArea } from "@/lib/area-planner/validate";
import { DATABASE_LIMIT_MS, TOTALS_WITH_AREAS_MS, plannerFailure, readJson, timeLeft, timedJson, within } from "@/lib/area-planner/api";
import { ServerTiming } from "@/lib/area-planner/timing";

// Adds areas to a project: one drawn shape (or a circle dropped with a
// distributor), or a typed list of postcode districts and sectors, each its
// own shape, with any that can't be mapped listed back. Replies with just
// the new areas, and the project's totals if they're ready within a moment
// (else null, and the page asks /totals).

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const timing = new ServerTiming();
  const { id } = await params;
  const body = (await readJson(req)) as Record<string, unknown> | null;
  try {
    if (body && typeof body.postcodes === "string") {
      if (body.postcodes.length > 2000) return NextResponse.json({ error: "That list is too long." }, { status: 400 });
      const text = body.postcodes;
      const { created, problems } = await timing.step("save", () =>
        within(timeLeft(timing, DATABASE_LIMIT_MS), "add postcode areas", createPostcodeAreas(prisma, id, text))
      );
      const shapes = await timing.step("db-areas", () => within(timeLeft(timing, DATABASE_LIMIT_MS), "read the project's shapes", storedShapes(prisma, id)));
      const totals = await totalsFor(shapes, timeLeft(timing, TOTALS_WITH_AREAS_MS), timing, "add postcodes");
      return timedJson(timing, "add postcodes", { areas: created, problems, totals }, { status: created.length > 0 ? 201 : 200 });
    }
    const checked = validateNewArea(body);
    if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });
    const area = await timing.step("save", () => within(timeLeft(timing, DATABASE_LIMIT_MS), "add an area", createArea(prisma, id, checked.area)));
    const [distributor, shapes] = await timing.step("db-areas", () =>
      within(timeLeft(timing, DATABASE_LIMIT_MS), "read the project's shapes", Promise.all([plannerDistributor(prisma, area.distributorId), storedShapes(prisma, id)]))
    );
    const totals = await totalsFor(shapes, timeLeft(timing, TOTALS_WITH_AREAS_MS), timing, "add an area");
    return timedJson(timing, "add an area", { area, distributor, totals }, { status: 201 });
  } catch (err) {
    return plannerFailure(err, "add an area");
  }
}
