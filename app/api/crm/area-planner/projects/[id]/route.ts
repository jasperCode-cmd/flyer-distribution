import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { listProjects, loadProjectAreas, totalsFor, updateProject } from "@/lib/area-planner/service";
import { validateProjectChanges } from "@/lib/area-planner/validate";
import { DATABASE_LIMIT_MS, TOTALS_WITH_AREAS_MS, plannerFailure, readJson, timeDatabaseWait, timeLeft, timedJson, within } from "@/lib/area-planner/api";
import { ServerTiming } from "@/lib/area-planner/timing";

// One project: its details, areas and links straight away, with the totals
// (homes and overlaps) if they're ready within a moment, else null and the
// page asks /totals; and its settings (name, notes, title for distributors,
// target, linking to a lead, closing and reopening, the LDB links switch).

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const timing = new ServerTiming();
  const { id } = await params;
  try {
    await timeDatabaseWait(timing);
    const project = await within(timeLeft(timing, DATABASE_LIMIT_MS), "load a project", loadProjectAreas(prisma, id, new Date(), timing));
    if (!project) return NextResponse.json({ error: "That project no longer exists." }, { status: 404 });
    const totals = await totalsFor(project.areas, timeLeft(timing, TOTALS_WITH_AREAS_MS), timing, "load project");
    return timedJson(timing, "load project", { project, totals });
  } catch (err) {
    return plannerFailure(err, "load a project");
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const timing = new ServerTiming();
  const { id } = await params;
  const checked = validateProjectChanges(await readJson(req));
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });
  try {
    await timing.step("save", () => within(timeLeft(timing, DATABASE_LIMIT_MS), "save project settings", updateProject(prisma, id, checked.changes)));
    const [projects, project] = await timing.step("db-lists", () =>
      within(timeLeft(timing, DATABASE_LIMIT_MS), "reload the project", Promise.all([listProjects(prisma), loadProjectAreas(prisma, id)]))
    );
    const totals = project ? await totalsFor(project.areas, timeLeft(timing, TOTALS_WITH_AREAS_MS), timing, "update project") : null;
    return timedJson(timing, "update project", { projects, project, totals });
  } catch (err) {
    return plannerFailure(err, "update a project");
  }
}
