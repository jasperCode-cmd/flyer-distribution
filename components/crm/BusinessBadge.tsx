import { BUSINESS_NAMES, LDB_BADGE, type Business } from "@/lib/business";

// The "Bournemouth" pill on an LDB lead, job, email or task. FDH is the
// default business and carries no badge, so nothing changes for FDH leads.
export default function BusinessBadge({
  business,
  className = "",
}: {
  business: Business | null | undefined;
  className?: string;
}) {
  if (business !== "LDB") return null;
  return (
    <span
      title={BUSINESS_NAMES.LDB}
      className={`inline-flex shrink-0 items-center rounded-full border border-teal-200 bg-teal-50 px-1.5 py-px text-[10px] font-semibold leading-4 text-teal-800 ${className}`}
    >
      {LDB_BADGE}
    </span>
  );
}
