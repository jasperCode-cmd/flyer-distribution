"use client";

import {
  CALENDAR_EVENT_TYPE_LABELS,
  DERIVED_KIND_LABELS,
  type CalendarFilters,
} from "@/lib/calendar-constants";

type Option = { id: string; name: string };

export default function CalendarFilterBar({
  filters,
  onChange,
  users,
  distributors,
  onAddEvent,
}: {
  filters: CalendarFilters;
  onChange: (filters: CalendarFilters) => void;
  users: Option[];
  distributors: Option[];
  onAddEvent: () => void;
}) {
  function set<K extends keyof CalendarFilters>(key: K, value: CalendarFilters[K]) {
    onChange({ ...filters, [key]: value || undefined });
  }

  const hasActiveFilters = Object.values(filters).some((v) => v !== undefined);

  return (
    <div className="mb-3 flex flex-wrap gap-2 items-center">
      <select
        value={filters.type ?? ""}
        onChange={(e) => set("type", e.target.value)}
        className="border border-gray-300 rounded-md px-2 py-1.5 text-xs bg-white"
      >
        <option value="">All types</option>
        <optgroup label="Events">
          {Object.entries(CALENDAR_EVENT_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </optgroup>
        <optgroup label="From jobs &amp; tasks">
          {Object.entries(DERIVED_KIND_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </optgroup>
      </select>

      <select
        value={filters.assignedToUserId ?? ""}
        onChange={(e) => set("assignedToUserId", e.target.value)}
        className="border border-gray-300 rounded-md px-2 py-1.5 text-xs bg-white"
      >
        <option value="">Anyone assigned</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>{u.name}</option>
        ))}
      </select>

      <select
        value={filters.distributorId ?? ""}
        onChange={(e) => set("distributorId", e.target.value)}
        className="border border-gray-300 rounded-md px-2 py-1.5 text-xs bg-white"
      >
        <option value="">All distributors</option>
        {distributors.map((d) => (
          <option key={d.id} value={d.id}>{d.name}</option>
        ))}
      </select>

      {hasActiveFilters && (
        <button
          type="button"
          onClick={() => onChange({})}
          className="text-xs font-semibold text-blue-700 hover:underline whitespace-nowrap"
        >
          Clear filters
        </button>
      )}

      <div className="ml-auto">
        <button
          type="button"
          onClick={onAddEvent}
          className="bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold px-3 py-1.5 rounded-md"
        >
          + Add Event
        </button>
      </div>
    </div>
  );
}
