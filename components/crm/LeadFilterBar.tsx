"use client";

import { useEffect, useState } from "react";
import {
  STAGE_LABELS,
  SOURCE_LABELS,
  PRIORITY_LABELS,
  REVIEW_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  type LeadFilters,
} from "@/lib/crm-constants";

type Tag = { id: string; name: string; color: string };
type SavedView = { id: string; name: string; filters: LeadFilters };
type Assignee = { id: string; name: string };

export default function LeadFilterBar({
  filters,
  onChange,
  showStageFilter,
  assignees,
  exportHref,
}: {
  filters: LeadFilters;
  onChange: (filters: LeadFilters) => void;
  showStageFilter: boolean;
  assignees: Assignee[];
  exportHref: string;
}) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [saveName, setSaveName] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);

  useEffect(() => {
    fetch("/api/crm/tags")
      .then((r) => r.json())
      .then((d) => setTags(d.tags ?? []))
      .catch(() => {});
    fetch("/api/crm/saved-views")
      .then((r) => r.json())
      .then((d) => setSavedViews(d.views ?? []))
      .catch(() => {});
  }, []);

  function set<K extends keyof LeadFilters>(key: K, value: LeadFilters[K]) {
    onChange({ ...filters, [key]: value || undefined });
  }

  async function saveCurrentView() {
    if (!saveName.trim()) return;
    const res = await fetch("/api/crm/saved-views", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: saveName.trim(), filters }),
    });
    if (res.ok) {
      const { view } = await res.json();
      setSavedViews((prev) => [view, ...prev]);
      setSaveName("");
      setShowSaveInput(false);
    }
  }

  async function deleteView(id: string) {
    await fetch(`/api/crm/saved-views/${id}`, { method: "DELETE" });
    setSavedViews((prev) => prev.filter((v) => v.id !== id));
  }

  const hasActiveFilters = Object.values(filters).some((v) => v !== undefined && v !== false);

  return (
    <div className="mb-3 space-y-2">
      <div className="flex flex-wrap gap-2 items-center">
        {showStageFilter && (
          <select
            value={filters.stage ?? ""}
            onChange={(e) => set("stage", e.target.value)}
            className="border border-gray-300 rounded-md px-2 py-1.5 text-xs bg-white"
          >
            <option value="">All stages</option>
            {Object.entries(STAGE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        )}
        <select
          value={filters.source ?? ""}
          onChange={(e) => set("source", e.target.value)}
          className="border border-gray-300 rounded-md px-2 py-1.5 text-xs bg-white"
        >
          <option value="">All sources</option>
          {Object.entries(SOURCE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          value={filters.assignedToId ?? ""}
          onChange={(e) => set("assignedToId", e.target.value)}
          className="border border-gray-300 rounded-md px-2 py-1.5 text-xs bg-white"
        >
          <option value="">Anyone assigned</option>
          {assignees.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        <select
          value={filters.priority ?? ""}
          onChange={(e) => set("priority", e.target.value)}
          className="border border-gray-300 rounded-md px-2 py-1.5 text-xs bg-white"
        >
          <option value="">All priorities</option>
          {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          value={filters.tagId ?? ""}
          onChange={(e) => set("tagId", e.target.value)}
          className="border border-gray-300 rounded-md px-2 py-1.5 text-xs bg-white"
        >
          <option value="">All tags</option>
          {tags.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        {/* Independent of each other and of stage: these only carry meaning
            on Won leads, but filtering by them is left unrestricted so a
            filter can be combined however the user wants. */}
        <select
          value={filters.reviewStatus ?? ""}
          onChange={(e) => set("reviewStatus", e.target.value)}
          className="border border-gray-300 rounded-md px-2 py-1.5 text-xs bg-white"
        >
          <option value="">Any review status</option>
          {Object.entries(REVIEW_STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          value={filters.paymentStatus ?? ""}
          onChange={(e) => set("paymentStatus", e.target.value)}
          className="border border-gray-300 rounded-md px-2 py-1.5 text-xs bg-white"
        >
          <option value="">Any payment status</option>
          {Object.entries(PAYMENT_STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-gray-600 px-1">
          <input
            type="checkbox"
            checked={filters.atRiskOnly ?? false}
            onChange={(e) => set("atRiskOnly", e.target.checked)}
            className="h-3.5 w-3.5"
          />
          At risk only
        </label>

        <div className="ml-auto flex items-center gap-2">
          <a
            href={exportHref}
            className="text-xs font-semibold text-blue-700 hover:underline whitespace-nowrap"
          >
            Export CSV
          </a>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => setShowSaveInput((s) => !s)}
              className="text-xs font-semibold text-blue-700 hover:underline whitespace-nowrap"
            >
              Save filters
            </button>
          )}
        </div>
      </div>

      {showSaveInput && (
        <div className="flex gap-2 items-center">
          <input
            type="text"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder="Name this view..."
            className="border border-gray-300 rounded-md px-2 py-1.5 text-xs w-48"
          />
          <button
            type="button"
            onClick={saveCurrentView}
            className="bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold px-3 py-1.5 rounded-md"
          >
            Save
          </button>
        </div>
      )}

      {savedViews.length > 0 && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-[11px] text-gray-400">Saved views:</span>
          {savedViews.map((v) => (
            <span
              key={v.id}
              className="inline-flex items-center gap-1 bg-gray-100 hover:bg-gray-200 rounded-full pl-2.5 pr-1 py-1 text-xs"
            >
              <button type="button" onClick={() => onChange(v.filters)} className="text-gray-700">
                {v.name}
              </button>
              <button
                type="button"
                onClick={() => deleteView(v.id)}
                aria-label={`Delete ${v.name}`}
                className="text-gray-400 hover:text-red-500 px-1"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
