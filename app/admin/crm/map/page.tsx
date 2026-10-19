import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { areaPlannerDataStatus } from "@/lib/area-planner/data";
import { linkableLeads, listProjects, loadProject, plannerDistributors } from "@/lib/area-planner/service";
import AreaPlanner from "@/components/area-planner/AreaPlanner";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Area Planner" };

// The Area Planner, on the Jobs "Map" page it replaced (same address, so no
// redirect is needed). ?project= opens a project; ?lead= opens a job's
// project, as linked from its map-made cost lines on the Profit page.
export default async function AreaPlannerPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string; lead?: string }>;
}) {
  const params = await searchParams;
  const [projects, leads, distributors, data] = await Promise.all([
    listProjects(prisma),
    linkableLeads(prisma),
    plannerDistributors(prisma),
    areaPlannerDataStatus(),
  ]);
  const wanted =
    projects.find((p) => p.id === params.project) ??
    projects.find((p) => params.lead && p.leadId === params.lead) ??
    projects.find((p) => !p.closedAt) ??
    null;
  const project = wanted ? await loadProject(prisma, wanted.id) : null;

  return (
    <AreaPlanner
      initialProjects={projects}
      initialLeads={leads}
      initialDistributors={distributors}
      initialProject={project}
      data={{ installed: data.installed, sample: data.sample, credits: data.credits }}
    />
  );
}
