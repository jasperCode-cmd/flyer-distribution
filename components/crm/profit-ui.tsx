"use client";

import { useEffect, useState } from "react";
import { formatPence } from "@/lib/money";
import { STAGE_LABELS } from "@/lib/crm-constants";
import type { CostGroupId, CostLine } from "@/lib/profit";

// Shared bits for the Profit page's cards, overview panel and cost form.

// Checked with the dataviz palette validator against white. Three of these
// are too light to read as text, so every chart carries a legend with the
// amounts written out, and text always stays in the grey ink colours.
export const GROUP_COLORS: Record<CostGroupId | "profit", string> = {
  distributors: "#2a78d6",
  printing: "#eb6834",
  design: "#1baf7a",
  additional: "#eda100",
  profit: "#e87ba4",
};

export type DistributorOption = { id: string; name: string; active: boolean };

export function StageBadge({ stage }: { stage: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        stage === "COMPLETED" ? "bg-blue-100 text-blue-800" : "bg-green-100 text-green-800"
      }`}
    >
      {STAGE_LABELS[stage] ?? stage}
    </span>
  );
}

export function IncludedBadges({ printing, design }: { printing: boolean; design: boolean }) {
  if (!printing && !design) return null;
  return (
    <>
      {printing && (
        <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-800">
          Printing included
        </span>
      )}
      {design && (
        <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
          Design included
        </span>
      )}
    </>
  );
}

export function RetainerBadge() {
  return (
    <span className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-800">
      Retainer
    </span>
  );
}

export function costLineTitle(line: CostLine): string {
  switch (line.category) {
    case "DISTRIBUTOR":
      return line.distributorName ?? "Deleted distributor";
    case "FUEL":
      return line.distributorId ? `Fuel, ${line.distributorName ?? "Deleted distributor"}` : "Fuel";
    case "PRINTING":
      return line.label ?? "Printing";
    case "DESIGN":
      return line.label ?? "Design";
    default:
      return line.label ?? "Additional";
  }
}

export function costLineDetail(line: CostLine): string | null {
  if (line.category !== "DISTRIBUTOR") return null;
  if (line.payType === "PER_THOUSAND" && line.ratePence !== null && line.leafletCount !== null) {
    return `${line.leafletCount.toLocaleString("en-GB")} leaflets at ${formatPence(line.ratePence)} per 1,000`;
  }
  return "Set amount";
}

// True below Tailwind's sm breakpoint, where the overview opens as a sheet.
export function useIsNarrow(): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 639px)");
    const update = () => setNarrow(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return narrow;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Keeps Tab and Shift+Tab inside a dialog.
export function trapTab(e: React.KeyboardEvent, container: HTMLElement | null) {
  if (e.key !== "Tab" || !container) return;
  const items = [...container.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
  if (items.length === 0) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}
