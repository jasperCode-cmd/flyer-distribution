import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { listProjects, loadProject, updateProject } from "@/lib/area-planner/service";
import { validateProjectChanges } from "@/lib/area-planner/validate";
import { plannerFailure, readJson } from "@/lib/area-planner/api";

// One project: its map, areas, overlaps, summary figures and links; and its
// settings (name, notes, title for distributors, target, linking to a lead,
// closing and reopening, the LDB links switch).

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  try {
    const project = await loadProject(prisma, id);
    if (!project) return NextResponse.json({ error: "That project no longer exists." }, { status: 404 });
    return NextResponse.json({ project });
  } catch (err) {
    return plannerFailure(err, "load a project");
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const checked = validateProjectChanges(await readJson(req));
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });
  try {
    await updateProject(prisma, id, checked.changes);
    const [projects, project] = await Promise.all([listProjects(prisma), loadProject(prisma, id)]);
    return NextResponse.json({ projects, project });
  } catch (err) {
    return plannerFailure(err, "update a project");
  }
}
