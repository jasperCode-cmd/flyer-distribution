"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { STAGE_LABELS, SOURCE_LABELS } from "@/lib/crm-constants";
import type { KanbanLead } from "./LeadCard";

type SortKey = "name" | "dealValue" | "stage" | "createdAt";

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);
}

export default function LeadTable({ leads }: { leads: KanbanLead[] }) {
  const [stageFilter, setStageFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [assignedFilter, setAssignedFilter] = useState("");
  const [atRiskOnly, setAtRiskOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const assignees = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of leads) {
      if (l.assignedTo) map.set(l.assignedTo.id, l.assignedTo.name);
    }
    return Array.from(map.entries());
  }, [leads]);

  const filtered = useMemo(() => {
    let result = leads;
    if (stageFilter) result = result.filter((l) => l.stage === stageFilter);
    if (sourceFilter) result = result.filter((l) => (l as unknown as { source: string }).source === sourceFilter);
    if (assignedFilter) result = result.filter((l) => l.assignedTo?.id === assignedFilter);
    if (atRiskOnly) result = result.filter((l) => l.atRisk);

    const sorted = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else if (sortKey === "dealValue")
        cmp = (a.dealValue ? Number(a.dealValue) : 0) - (b.dealValue ? Number(b.dealValue) : 0);
      else if (sortKey === "stage") cmp = a.stage.localeCompare(b.stage);
      else cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [leads, stageFilter, sourceFilter, assignedFilter, atRiskOnly, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const Th = ({ sortableKey, children }: { sortableKey?: SortKey; children: React.ReactNode }) => (
    <th
      onClick={sortableKey ? () => toggleSort(sortableKey) : undefined}
      className={`text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap ${
        sortableKey ? "cursor-pointer select-none hover:text-blue-700" : ""
      }`}
    >
      {children}
      {sortableKey && sortKey === sortableKey && (sortDir === "asc" ? " ↑" : " ↓")}
    </th>
  );

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="border border-gray-300 rounded-md px-2 py-1.5 text-xs bg-white"
        >
          <option value="">All stages</option>
          {Object.entries(STAGE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="border border-gray-300 rounded-md px-2 py-1.5 text-xs bg-white"
        >
          <option value="">All sources</option>
          {Object.entries(SOURCE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          value={assignedFilter}
          onChange={(e) => setAssignedFilter(e.target.value)}
          className="border border-gray-300 rounded-md px-2 py-1.5 text-xs bg-white"
        >
          <option value="">Anyone assigned</option>
          {assignees.map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-gray-600 px-2">
          <input
            type="checkbox"
            checked={atRiskOnly}
            onChange={(e) => setAtRiskOnly(e.target.checked)}
            className="h-3.5 w-3.5"
          />
          At risk only
        </label>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead className="border-b border-gray-200">
            <tr>
              <Th sortableKey="name">Name</Th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Business</th>
              <Th sortableKey="stage">Stage</Th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Source</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Assigned</th>
              <Th sortableKey="dealValue">Value</Th>
              <Th sortableKey="createdAt">Created</Th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((lead) => (
              <tr key={lead.id} className={lead.atRisk ? "bg-red-50/40" : ""}>
                <td className="px-3 py-2.5 text-sm font-medium text-blue-900 whitespace-nowrap">
                  {lead.atRisk && <span className="text-red-500 mr-1">⚑</span>}
                  {lead.name}
                </td>
                <td className="px-3 py-2.5 text-sm text-gray-600 whitespace-nowrap">{lead.businessName ?? "—"}</td>
                <td className="px-3 py-2.5 text-sm text-gray-600 whitespace-nowrap">{STAGE_LABELS[lead.stage]}</td>
                <td className="px-3 py-2.5 text-sm text-gray-600 whitespace-nowrap">
                  {SOURCE_LABELS[(lead as unknown as { source: string }).source] ?? "—"}
                </td>
                <td className="px-3 py-2.5 text-sm text-gray-600 whitespace-nowrap">{lead.assignedTo?.name ?? "—"}</td>
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
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-sm text-gray-400">
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
