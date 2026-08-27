"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { STAGE_LABELS, SOURCE_LABELS, PRIORITY_LABELS, STAGES } from "@/lib/crm-constants";
import type { KanbanLead } from "./LeadCard";

type SortKey = "name" | "dealValue" | "stage" | "createdAt";

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);
}

// The Google Maps import set businessName to the same company name as name on
// every row it created, so both layouts would otherwise repeat identical text.
// Shared so the match rule stays identical between table and cards.
function businessMatchesName(lead: KanbanLead): boolean {
  const business = lead.businessName?.trim() ?? "";
  return business !== "" && business === lead.name.trim();
}

export default function LeadTable({
  leads,
  assignees,
}: {
  leads: KanbanLead[];
  assignees: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStage, setBulkStage] = useState("");
  const [bulkAssignee, setBulkAssignee] = useState("");
  const [bulkSource, setBulkSource] = useState("");
  const [applying, setApplying] = useState(false);

  const sorted = useMemo(() => {
    const copy = [...leads].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else if (sortKey === "dealValue")
        cmp = (a.dealValue ? Number(a.dealValue) : 0) - (b.dealValue ? Number(b.dealValue) : 0);
      else if (sortKey === "stage") cmp = a.stage.localeCompare(b.stage);
      else cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [leads, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  // The selection is scoped to the rows currently on screen. `leads` is
  // already the filtered set, but the raw `selected` state survives a filter
  // change — so a lead selected under one filter could otherwise still be
  // caught by a bulk action taken under another, with no row visible to show
  // it. Intersecting with the visible ids makes what you see what you change.
  const visibleIds = useMemo(() => new Set(sorted.map((l) => l.id)), [sorted]);
  const activeSelection = useMemo(
    () => Array.from(selected).filter((id) => visibleIds.has(id)),
    [selected, visibleIds]
  );
  const selectedCount = activeSelection.length;

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Selects exactly the rows on screen — i.e. the current filtered set —
  // never the whole table.
  function toggleSelectAll() {
    setSelected(
      selectedCount === sorted.length ? new Set() : new Set(sorted.map((l) => l.id))
    );
  }

  async function applyBulk(body: Record<string, unknown>, reset: () => void) {
    if (selectedCount === 0) return;
    setApplying(true);
    await fetch("/api/crm/leads/bulk", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: activeSelection, ...body }),
    });
    setApplying(false);
    reset();
    setSelected(new Set());
    router.refresh();
  }

  async function applyBulkStage() {
    if (!bulkStage) return;
    await applyBulk({ stage: bulkStage }, () => setBulkStage(""));
  }

  async function applyBulkAssignee() {
    if (bulkAssignee === "") return;
    await applyBulk(
      { assignedToId: bulkAssignee === "unassigned" ? null : bulkAssignee },
      () => setBulkAssignee("")
    );
  }

  async function applyBulkSource() {
    if (!bulkSource) return;
    await applyBulk({ source: bulkSource }, () => setBulkSource(""));
  }

  const Th = ({
    sortableKey,
    width,
    children,
  }: {
    sortableKey?: SortKey;
    width?: string;
    children: React.ReactNode;
  }) => (
    <th
      onClick={sortableKey ? () => toggleSort(sortableKey) : undefined}
      className={`text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap ${
        width ?? ""
      } ${sortableKey ? "cursor-pointer select-none hover:text-blue-700" : ""}`}
    >
      {children}
      {sortableKey && sortKey === sortableKey && (sortDir === "asc" ? " ↑" : " ↓")}
    </th>
  );

  return (
    <div>
      {selectedCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-3 bg-blue-50 border border-blue-200 rounded-md px-3 py-2">
          <span className="text-xs font-semibold text-blue-800">{selectedCount} selected</span>
          <select
            value={bulkStage}
            onChange={(e) => setBulkStage(e.target.value)}
            className="border border-gray-300 rounded-md px-2 py-1.5 text-xs bg-white"
          >
            <option value="">Change stage to...</option>
            {STAGES.map((s) => (
              <option key={s} value={s}>{STAGE_LABELS[s]}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={applyBulkStage}
            disabled={!bulkStage || applying}
            className="bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-bold px-3 py-1.5 rounded-md"
          >
            Apply
          </button>
          <select
            value={bulkAssignee}
            onChange={(e) => setBulkAssignee(e.target.value)}
            className="border border-gray-300 rounded-md px-2 py-1.5 text-xs bg-white"
          >
            <option value="">Reassign to...</option>
            <option value="unassigned">Unassigned</option>
            {assignees.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={applyBulkAssignee}
            disabled={bulkAssignee === "" || applying}
            className="bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-bold px-3 py-1.5 rounded-md"
          >
            Apply
          </button>
          <select
            value={bulkSource}
            onChange={(e) => setBulkSource(e.target.value)}
            className="border border-gray-300 rounded-md px-2 py-1.5 text-xs bg-white"
          >
            <option value="">Change source to...</option>
            {Object.entries(SOURCE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={applyBulkSource}
            disabled={!bulkSource || applying}
            className="bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-bold px-3 py-1.5 rounded-md"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="ml-auto text-xs text-gray-500 hover:underline"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Mobile: each row becomes a stacked card. The table's sortable
          headers and select-all live in <thead>, which is hidden here, so
          both are re-exposed in this toolbar. */}
      <div className="sm:hidden mb-2 flex items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs text-gray-600">
          <input
            type="checkbox"
            checked={sorted.length > 0 && selectedCount === sorted.length}
            onChange={toggleSelectAll}
            className="h-3.5 w-3.5"
          />
          Select all
        </label>
        <select
          value={`${sortKey}:${sortDir}`}
          onChange={(e) => {
            const [k, d] = e.target.value.split(":");
            setSortKey(k as SortKey);
            setSortDir(d as "asc" | "desc");
          }}
          className="ml-auto border border-gray-300 rounded-md px-2 py-1.5 text-xs bg-white"
        >
          <option value="createdAt:desc">Newest first</option>
          <option value="createdAt:asc">Oldest first</option>
          <option value="name:asc">Name A–Z</option>
          <option value="name:desc">Name Z–A</option>
          <option value="dealValue:desc">Value high–low</option>
          <option value="dealValue:asc">Value low–high</option>
          <option value="stage:asc">Stage</option>
        </select>
      </div>

      <div className="sm:hidden space-y-2">
        {sorted.map((lead) => (
          <div
            key={lead.id}
            className={`bg-white rounded-lg border p-3 shadow-sm transition-shadow hover:shadow-md ${
              lead.atRisk
                ? "border-l-4 border-l-red-500 border-y-gray-200 border-r-gray-200"
                : "border-gray-200"
            }`}
          >
            <div className="flex items-start gap-2.5">
              <input
                type="checkbox"
                checked={selected.has(lead.id)}
                onChange={() => toggleSelected(lead.id)}
                className="h-3.5 w-3.5 mt-1 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/admin/crm/leads/${lead.id}`}
                    className="text-[13px] font-semibold text-blue-900 hover:underline truncate"
                  >
                    {lead.atRisk && <span className="text-red-500 mr-1">⚑</span>}
                    {lead.name}
                  </Link>
                  <span className="text-[11px] font-medium text-gray-700 shrink-0">
                    {lead.dealValue ? formatCurrency(Number(lead.dealValue)) : "—"}
                  </span>
                </div>
                {lead.businessName &&
                  (businessMatchesName(lead) ? (
                    <p className="text-[11px] italic text-gray-400 truncate mt-0.5">
                      same as name
                    </p>
                  ) : (
                    <p className="text-[11px] text-gray-500 truncate mt-0.5">{lead.businessName}</p>
                  ))}
                <dl className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-1.5 text-[11px]">
                  <div className="flex gap-1 min-w-0">
                    <dt className="text-gray-400 shrink-0">Stage</dt>
                    <dd className="text-gray-700 truncate">{STAGE_LABELS[lead.stage]}</dd>
                  </div>
                  <div className="flex gap-1 min-w-0">
                    <dt className="text-gray-400 shrink-0">Priority</dt>
                    <dd className="text-gray-700 truncate">
                      {PRIORITY_LABELS[lead.priority] ?? lead.priority}
                    </dd>
                  </div>
                  <div className="flex gap-1 min-w-0">
                    <dt className="text-gray-400 shrink-0">Source</dt>
                    <dd className="text-gray-700 truncate">{SOURCE_LABELS[lead.source] ?? "—"}</dd>
                  </div>
                  <div className="flex gap-1 min-w-0">
                    <dt className="text-gray-400 shrink-0">Assigned</dt>
                    <dd className="text-gray-700 truncate">{lead.assignedTo?.name ?? "—"}</dd>
                  </div>
                  <div className="flex gap-1 min-w-0 col-span-2">
                    <dt className="text-gray-400 shrink-0">Created</dt>
                    <dd className="text-gray-500 truncate">
                      {new Date(lead.createdAt).toLocaleDateString("en-GB")}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        ))}
        {sorted.length === 0 && (
          <div className="bg-white rounded-lg border border-gray-200 px-3 py-8 text-center text-sm text-gray-400">
            No leads match these filters.
          </div>
        )}
      </div>

      {/* Desktop: the original table, unchanged. */}
      <div className="hidden sm:block bg-white rounded-lg border border-gray-200 overflow-x-auto">
        {/* table-fixed: with auto layout every column stretched to its longest
            value, and the imported company names pushed the later columns off
            screen. Fixed layout honours the widths below and lets long values
            ellipsis instead. */}
        <table className="w-full table-fixed min-w-[780px]">
          <thead className="border-b border-gray-200">
            <tr>
              <th className="px-3 py-2 w-8">
                <input
                  type="checkbox"
                  checked={sorted.length > 0 && selectedCount === sorted.length}
                  onChange={toggleSelectAll}
                  className="h-3.5 w-3.5"
                />
              </th>
              <Th sortableKey="name" width="w-[19%]">Name</Th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide w-[16%]">Business</th>
              <Th sortableKey="stage" width="w-[12%]">Stage</Th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide w-[9%]">Priority</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide w-[12%]">Source</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide w-[11%]">Assigned</th>
              <Th sortableKey="dealValue" width="w-[7%]">Value</Th>
              <Th sortableKey="createdAt" width="w-[8%]">Created</Th>
              <th className="px-3 py-2 w-[6%]" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map((lead) => {
              // Muted marker when the two match — kept distinct from "—",
              // which means no business recorded at all.
              const business = lead.businessName?.trim() ?? "";
              const sameAsName = businessMatchesName(lead);

              return (
              <tr key={lead.id} className={lead.atRisk ? "bg-red-50/40" : ""}>
                <td className="px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={selected.has(lead.id)}
                    onChange={() => toggleSelected(lead.id)}
                    className="h-3.5 w-3.5"
                  />
                </td>
                <td className="px-3 py-2.5 text-sm font-medium text-blue-900 truncate" title={lead.name}>
                  {lead.atRisk && <span className="text-red-500 mr-1">⚑</span>}
                  {lead.name}
                </td>
                <td className="px-3 py-2.5 text-sm text-gray-600 truncate">
                  {business === "" ? (
                    "—"
                  ) : sameAsName ? (
                    <span className="text-xs italic text-gray-400" title={business}>
                      same as name
                    </span>
                  ) : (
                    <span title={business}>{business}</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-sm text-gray-600 truncate">{STAGE_LABELS[lead.stage]}</td>
                <td className="px-3 py-2.5 text-sm text-gray-600 truncate">
                  {PRIORITY_LABELS[lead.priority] ?? lead.priority}
                </td>
                <td className="px-3 py-2.5 text-sm text-gray-600 truncate" title={SOURCE_LABELS[lead.source] ?? ""}>
                  {SOURCE_LABELS[lead.source] ?? "—"}
                </td>
                <td className="px-3 py-2.5 text-sm text-gray-600 truncate" title={lead.assignedTo?.name ?? ""}>
                  {lead.assignedTo?.name ?? "—"}
                </td>
                <td className="px-3 py-2.5 text-sm text-gray-600 whitespace-nowrap">
                  {lead.dealValue ? formatCurrency(Number(lead.dealValue)) : "—"}
                </td>
                <td className="px-3 py-2.5 text-sm text-gray-500 whitespace-nowrap">
                  {new Date(lead.createdAt).toLocaleDateString("en-GB")}
                </td>
                <td className="px-3 py-2.5 text-right whitespace-nowrap">
                  <Link href={`/admin/crm/leads/${lead.id}`} className="text-xs text-blue-700 hover:underline">
                    View
                  </Link>
                </td>
              </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-sm text-gray-400">
                  No leads match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
