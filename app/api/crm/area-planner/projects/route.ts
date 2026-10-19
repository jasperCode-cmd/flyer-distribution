import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { linkableLeads, listProjects, createProject, loadProject } from "@/lib/area-planner/service";
import { validateNewProject } from "@/lib/area-planner/validate";
import { plannerFailure, readJson } from "@/lib/area-planner/api";

// The Area Planner's projects: every one (open and closed) with the leads
// that could still get one, and making a new one.

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const [projects, leads] = await Promise.all([listProjects(prisma), linkableLeads(prisma)]);
    return NextResponse.json({ projects, leads });
  } catch (err) {
    return plannerFailure(err, "list projects");
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const checked = validateNewProject(await readJson(req));
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });
  try {
    const id = await createProject(prisma, checked.project);
    const [projects, project] = await Promise.all([listProjects(prisma), loadProject(prisma, id)]);
    return NextResponse.json({ projects, project }, { status: 201 });
  } catch (err) {
    return plannerFailure(err, "create a project");
  }
}
