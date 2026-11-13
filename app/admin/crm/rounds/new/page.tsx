import type { Metadata } from "next";
import NewRound from "@/components/rounds/NewRound";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Add a round" };

// Adding a round. ?leadId= or ?projectId= picks its job, as linked from a
// lead's page.
export default async function NewRoundPage({ searchParams }: { searchParams: Promise<{ leadId?: string; projectId?: string }> }) {
  const params = await searchParams;
  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-xl font-bold text-blue-900">Add a round</h1>
        <p className="text-sm text-gray-500">Choose the screenshots and the job, then line each screenshot up with the map and trace the route.</p>
      </div>
      <NewRound leadId={params.leadId ?? null} projectId={params.projectId ?? null} />
    </div>
  );
}
