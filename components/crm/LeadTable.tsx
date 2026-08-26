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

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) => (prev.size === sorted.length ? new Set() : new Set(sorted.map((l) => l.id))));
  }

  async function applyBulkStage() {
    if (!bulkStage || selected.size === 0) return;
    setApplying(true);
    await fetch("/api/crm/leads/bulk", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selected), stage: bulkStage }),
    });
    setApplying(false);
    setBulkStage("");
    setSelected(new Set());
    router.refresh();
  }

  async function applyBulkAssignee() {
    if (bulkAssignee === "" || selected.size === 0) return;
    setApplying(true);
    await fetch("/api/crm/leads/bulk", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selected), assignedToId: bulkAssignee === "unassigned" ? null : bulkAssignee }),
    });
    setApplying(false);
    setBulkAssignee("");
    setSelected(new Set());
    router.refresh();
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
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-3 bg-blue-50 border border-blue-200 rounded-md px-3 py-2">
          <span className="text-xs font-semibold text-blue-800">{selected.size} selected</span>
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
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="ml-auto text-xs text-gray-500 hover:underline"
          >
            Clear selection
          </button>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="w-full min-w-[720px]">
          <thead className="border-b border-gray-200">
            <tr>
              <th className="px-3 py-2 w-8">
                <input
                  type="checkbox"
                  checked={sorted.length > 0 && selected.size === sorted.length}
                  onChange={toggleSelectAll}
                  className="h-3.5 w-3.5"
                />
              </th>
              <Th sortableKey="name">Name</Th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Business</th>
              <Th sortableKey="stage">Stage</Th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Priority</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Source</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Assigned</th>
              <Th sortableKey="dealValue">Value</Th>
              <Th sortableKey="createdAt">Created</Th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map((lead) => (
              <tr key={lead.id} className={lead.atRisk ? "bg-red-50/40" : ""}>
                <td className="px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={selected.has(lead.id)}
                    onChange={() => toggleSelected(lead.id)}
                    className="h-3.5 w-3.5"
                  />
                </td>
                <td className="px-3 py-2.5 text-sm font-medium text-blue-900 whitespace-nowrap">
                  {lead.atRisk && <span className="text-red-500 mr-1">⚑</span>}
                  {lead.name}
                </td>
                <td className="px-3 py-2.5 text-sm text-gray-600 whitespace-nowrap">{lead.businessName ?? "—"}</td>
                <td className="px-3 py-2.5 text-sm text-gray-600 whitespace-nowrap">{STAGE_LABELS[lead.stage]}</td>
                <td className="px-3 py-2.5 text-sm text-gray-600 whitespace-nowrap">
                  {PRIORITY_LABELS[lead.priority] ?? lead.priority}
                </td>
                <td className="px-3 py-2.5 text-sm text-gray-600 whitespace-nowrap">
                  {SOURCE_LABELS[lead.source] ?? "—"}
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
