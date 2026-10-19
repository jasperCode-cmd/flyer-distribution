import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { deleteArea, loadProject, plannerDistributors, updateArea } from "@/lib/area-planner/service";
import { validateAreaChanges } from "@/lib/area-planner/validate";
import { plannerFailure, readJson } from "@/lib/area-planner/api";

// Edits or deletes one area. Its Profit cost line follows in the same
// transaction. Both return the whole project, as the map redraws from it.

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const checked = validateAreaChanges(await readJson(req));
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });
  try {
    const projectId = await updateArea(prisma, id, checked.changes);
    return NextResponse.json({ project: await loadProject(prisma, projectId), distributors: await plannerDistributors(prisma) });
  } catch (err) {
    return plannerFailure(err, "update an area");
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  try {
    const projectId = await deleteArea(prisma, id);
    return NextResponse.json({ project: await loadProject(prisma, projectId) });
  } catch (err) {
    return plannerFailure(err, "delete an area");
  }
}
