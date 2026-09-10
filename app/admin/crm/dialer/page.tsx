import { prisma } from "@/lib/prisma";
import DialerScreen from "@/components/crm/DialerScreen";

export const dynamic = "force-dynamic";

export default async function DialerPage() {
  const tags = await prisma.tag.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
  return <DialerScreen tags={tags} />;
}
