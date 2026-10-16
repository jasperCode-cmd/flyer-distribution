"use client";

import {
  BUSINESS_FILTERS,
  BUSINESS_FILTER_LABELS,
  BUSINESS_NAMES,
  type BusinessFilter as Filter,
} from "@/lib/business";

const TITLES: Record<Filter, string> = {
  ALL: "Both businesses",
  FDH: BUSINESS_NAMES.FDH,
  LDB: BUSINESS_NAMES.LDB,
};

// All / FDH / LDB. Used on Leads, Priorities, the Dialer, Profit, the
// Dashboard and the Inbox.
export default function BusinessFilter({
  value,
  onChange,
  className = "",
}: {
  value: Filter;
  onChange: (value: Filter) => void;
  className?: string;
}) {
  return (
    <div role="group" aria-label="Business" className={`inline-flex rounded-md border border-gray-300 overflow-hidden bg-white ${className}`}>
      {BUSINESS_FILTERS.map((option) => {
        const active = option === value;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={active}
            title={TITLES[option]}
            onClick={() => onChange(option)}
            className={`px-3 py-1.5 text-xs font-medium border-l border-gray-300 first:border-l-0 ${
              active ? "bg-blue-700 text-white" : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            {BUSINESS_FILTER_LABELS[option]}
          </button>
        );
      })}
    </div>
  );
}
