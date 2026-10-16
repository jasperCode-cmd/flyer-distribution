import { prisma } from "@/lib/prisma";
import AddLeadForm from "@/components/crm/AddLeadForm";
import { SOURCE_LABELS } from "@/lib/crm-constants";
import { isBusiness } from "@/lib/business";

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
  // A Bournemouth conversation in the inbox makes a Bournemouth lead.
  const business = prefill(query.business);
  return (
    <AddLeadForm
      users={users}
      initial={{
        name: prefill(query.name),
        email: prefill(query.email),
        source: source && source in SOURCE_LABELS ? source : undefined,
        business: isBusiness(business) ? business : undefined,
      }}
    />
  );
}
