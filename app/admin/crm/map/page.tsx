import type { Metadata } from "next";
import AreaPlanner from "@/components/area-planner/AreaPlanner";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Area Planner" };

// The Area Planner, on the Jobs "Map" page it replaced (same address, so no
// redirect is needed). ?project= opens a project; ?lead= opens a job's
// project, as linked from its map-made cost lines on the Profit page. The
// page itself reads nothing: it draws straight away, and the planner loads
// the projects, then the open project's areas, then its totals, through the
// API, so a slow step can never hold up the page.
export default async function AreaPlannerPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string; lead?: string }>;
}) {
  const params = await searchParams;
  return <AreaPlanner wantedProjectId={params.project ?? null} wantedLeadId={params.lead ?? null} />;
}
