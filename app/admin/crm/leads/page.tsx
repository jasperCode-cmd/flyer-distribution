import { getLeadsWithLastActivity, flattenTags } from "@/lib/crm-data";
import { prisma } from "@/lib/prisma";
import LeadsView from "@/components/crm/LeadsView";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const [leads, users] = await Promise.all([
    getLeadsWithLastActivity(),
    prisma.user.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const serializable = leads.map((l) => ({
    ...flattenTags(l),
    // Decimal columns can't cross into a Client Component as-is; both go over
    // as strings and are parsed back where they're displayed.
    dealValue: l.dealValue ? l.dealValue.toString() : null,
    amountPaid: l.amountPaid ? l.amountPaid.toString() : null,
  }));

  return <LeadsView leads={serializable} users={users} />;
}
