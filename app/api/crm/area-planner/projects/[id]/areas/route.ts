import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createArea, createPostcodeAreas, loadProject, plannerDistributors } from "@/lib/area-planner/service";
import { validateNewArea } from "@/lib/area-planner/validate";
import { plannerFailure, readJson } from "@/lib/area-planner/api";

// Adds areas to a project: one drawn shape (or a circle dropped with a
// distributor), or a typed list of postcode districts and sectors, each its
// own shape, with any that can't be mapped listed back.

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = (await readJson(req)) as Record<string, unknown> | null;
  try {
    if (body && typeof body.postcodes === "string") {
      if (body.postcodes.length > 2000) return NextResponse.json({ error: "That list is too long." }, { status: 400 });
      const { created, problems } = await createPostcodeAreas(prisma, id, body.postcodes);
      return NextResponse.json(
        { project: await loadProject(prisma, id), distributors: await plannerDistributors(prisma), createdIds: created.map((a) => a.id), problems },
        { status: created.length > 0 ? 201 : 200 }
      );
    }
    const checked = validateNewArea(body);
    if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });
    const area = await createArea(prisma, id, checked.area);
    return NextResponse.json(
      { project: await loadProject(prisma, id), distributors: await plannerDistributors(prisma), createdIds: [area.id], problems: [] },
      { status: 201 }
    );
  } catch (err) {
    return plannerFailure(err, "add an area");
  }
}
