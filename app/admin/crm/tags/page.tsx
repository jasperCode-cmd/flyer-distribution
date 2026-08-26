import { prisma } from "@/lib/prisma";
import TagManager from "@/components/crm/TagManager";

export const dynamic = "force-dynamic";

export default async function TagsPage() {
  const tags = await prisma.tag.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { leads: true } } },
  });

  return (
    <div>
      <h1 className="text-xl font-bold text-blue-900 mb-4">Tags</h1>
      <TagManager tags={tags} />
    </div>
  );
}
