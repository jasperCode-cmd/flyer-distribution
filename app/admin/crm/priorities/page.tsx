import PrioritiesView from "@/components/crm/PrioritiesView";
import { loadPriorityList } from "@/lib/priorities-data";

export const dynamic = "force-dynamic";

// The database items come with the page; the view then asks for the list
// again with unanswered emails from Gmail, which take longer.
export default async function PrioritiesPage() {
  const initial = await loadPriorityList({ withEmail: false });
  return <PrioritiesView initial={initial} />;
}
