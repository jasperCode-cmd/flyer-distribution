import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { areaPlannerDataStatus } from "@/lib/area-planner/data";
import { createProject, linkableLeads, listProjects, loadProjectAreas, plannerDistributors } from "@/lib/area-planner/service";
import { validateNewProject } from "@/lib/area-planner/validate";
import { DATABASE_LIMIT_MS, plannerFailure, readJson, timeLeft, timedJson, within } from "@/lib/area-planner/api";
import { ServerTiming } from "@/lib/area-planner/timing";

// The Area Planner's projects: every one (open and closed) with the leads
// that could still get one, the distributors and whether the postcode data
// is installed, which the page loads once it has drawn; and making a new one.

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const timing = new ServerTiming();
  try {
    const [projects, leads, distributors, data] = await timing.step("db-lists", () =>
      within(
        timeLeft(timing, DATABASE_LIMIT_MS),
        "list the projects",
        Promise.all([listProjects(prisma), linkableLeads(prisma), plannerDistributors(prisma), areaPlannerDataStatus()])
      )
    );
    return timedJson(timing, "list projects", {
      projects,
      leads,
      distributors,
      data: { installed: data.installed, sample: data.sample, credits: data.credits },
    });
  } catch (err) {
    return plannerFailure(err, "list projects");
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const timing = new ServerTiming();
  const checked = validateNewProject(await readJson(req));
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });
  try {
    const id = await timing.step("save", () => within(timeLeft(timing, DATABASE_LIMIT_MS), "add a project", createProject(prisma, checked.project)));
    const [projects, project] = await timing.step("db-lists", () =>
      within(timeLeft(timing, DATABASE_LIMIT_MS), "load the new project", Promise.all([listProjects(prisma), loadProjectAreas(prisma, id)]))
    );
    // A new project has no areas yet, so nothing to work out.
    return timedJson(timing, "create a project", { projects, project, totals: { overlaps: [], totalHouseholds: 0 } }, { status: 201 });
  } catch (err) {
    return plannerFailure(err, "create a project");
  }
}
