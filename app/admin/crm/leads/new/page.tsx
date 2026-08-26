import { prisma } from "@/lib/prisma";
import AddLeadForm from "@/components/crm/AddLeadForm";

export const dynamic = "force-dynamic";

export default async function NewLeadPage() {
  const users = await prisma.user.findMany({ select: { id: true, name: true } });
  return <AddLeadForm users={users} />;
}
