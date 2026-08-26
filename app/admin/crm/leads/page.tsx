import { getLeadsWithLastActivity } from "@/lib/crm-data";
import LeadsView from "@/components/crm/LeadsView";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const leads = await getLeadsWithLastActivity();

  const serializable = leads.map((l) => ({
    ...l,
    dealValue: l.dealValue ? l.dealValue.toString() : null,
  }));

  return <LeadsView leads={serializable} />;
}
