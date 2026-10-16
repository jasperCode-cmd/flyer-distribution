"use client";

import { useRouter } from "next/navigation";
import BusinessFilter from "./BusinessFilter";
import { periodSearch, type DashboardPeriod } from "@/lib/dashboard";
import type { BusinessFilter as BusinessView } from "@/lib/business";

// All / FDH / LDB for every figure on the Dashboard, kept in the address
// with the period so Refresh and Back keep both.
export default function DashboardBusinessControl({ period, business }: { period: DashboardPeriod; business: BusinessView }) {
  const router = useRouter();
  return (
    <BusinessFilter
      value={business}
      onChange={(next) => next !== business && router.push(`/admin/crm${periodSearch(period, next)}`, { scroll: false })}
    />
  );
}
