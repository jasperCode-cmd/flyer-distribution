import { prisma } from "@/lib/prisma";
import AddLeadForm from "@/components/crm/AddLeadForm";
import { SOURCE_LABELS } from "@/lib/crm-constants";

export const dynamic = "force-dynamic";

function prefill(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  const trimmed = v?.trim().slice(0, 200);
  return trimmed || undefined;
}

export default async function NewLeadPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [users, query] = await Promise.all([
    prisma.user.findMany({ select: { id: true, name: true } }),
    searchParams,
  ]);
  // Only a real lead source is accepted (the inbox sends OTHER); anything
  // else leaves the form's usual default.
  const source = prefill(query.source);
  return (
    <AddLeadForm
      users={users}
      initial={{
        name: prefill(query.name),
        email: prefill(query.email),
        source: source && source in SOURCE_LABELS ? source : undefined,
      }}
    />
  );
}
