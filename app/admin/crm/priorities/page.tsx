import PrioritiesView from "@/components/crm/PrioritiesView";
import { loadPriorityList } from "@/lib/priorities-data";
import { parseBusinessFilter } from "@/lib/business";

export const dynamic = "force-dynamic";

// The database items come with the page; the view then asks for the list
// again with unanswered emails from Gmail, which take longer.
export default async function PrioritiesPage({
  searchParams,
}: {
  searchParams: Promise<{ business?: string | string[] }>;
}) {
  const [initial, params] = await Promise.all([loadPriorityList({ withEmail: false }), searchParams]);
  return <PrioritiesView initial={initial} initialBusiness={parseBusinessFilter(params.business)} />;
}
