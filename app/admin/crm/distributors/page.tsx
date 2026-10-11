import { prisma } from "@/lib/prisma";
import DistributorsView from "@/components/crm/DistributorsView";
import { loadDistributorDirectory } from "@/lib/distributor-directory-data";

export const dynamic = "force-dynamic";

export default async function DistributorsPage() {
  const distributors = await loadDistributorDirectory(prisma, new Date());
  return <DistributorsView initial={distributors} />;
}
