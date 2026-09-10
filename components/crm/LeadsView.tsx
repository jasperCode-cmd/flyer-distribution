"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import KanbanBoard from "./KanbanBoard";
import LeadTable from "./LeadTable";
import LeadFilterBar from "./LeadFilterBar";
import type { KanbanLead } from "./LeadCard";
import { applyLeadFilters, type LeadFilters } from "@/lib/crm-constants";

export default function LeadsView({
  leads,
  users,
}: {
  leads: KanbanLead[];
  users: { id: string; name: string }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deletedName = searchParams.get("deleted");
  const [deletedBanner, setDeletedBanner] = useState(deletedName);

  // Strips ?deleted= from the URL once shown, so refreshing or coming back
  // to this page later doesn't keep re-showing the same message.
  useEffect(() => {
    if (deletedName) router.replace("/admin/crm/leads", { scroll: false });
  }, [deletedName, router]);

  const [view, setView] = useState<"kanban" | "table">("kanban");
  const [filters, setFilters] = useState<LeadFilters>({});

  const filteredLeads = useMemo(
    () => applyLeadFilters(leads, view === "kanban" ? { ...filters, stage: undefined } : filters),
    [leads, filters, view]
  );

  const exportParams = new URLSearchParams();
  if (filters.stage) exportParams.set("stage", filters.stage);
  if (filters.source) exportParams.set("source", filters.source);
  if (filters.assignedToId) exportParams.set("assignedToId", filters.assignedToId);
  if (filters.priority) exportParams.set("priority", filters.priority);
  if (filters.tagId) exportParams.set("tagId", filters.tagId);
  if (filters.atRiskOnly) exportParams.set("atRiskOnly", "true");

  return (
    <div>
      {deletedBanner && (
        <div className="flex items-center justify-between gap-3 bg-green-50 border border-green-200 text-green-800 text-sm rounded-md px-3 py-2 mb-3">
          <span>{deletedBanner} was deleted.</span>
          <button
            type="button"
            onClick={() => setDeletedBanner(null)}
            aria-label="Dismiss"
            className="text-green-600 hover:text-green-800 font-bold"
          >
            ×
          </button>
        </div>
      )}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-blue-900">Leads</h1>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-gray-300 overflow-hidden">
            <button
              type="button"
              onClick={() => setView("kanban")}
              className={`px-3 py-1.5 text-xs font-medium ${
                view === "kanban" ? "bg-blue-700 text-white" : "bg-white text-gray-600"
              }`}
            >
              Kanban
            </button>
            <button
              type="button"
              onClick={() => setView("table")}
              className={`px-3 py-1.5 text-xs font-medium ${
                view === "table" ? "bg-blue-700 text-white" : "bg-white text-gray-600"
              }`}
            >
              Table
            </button>
          </div>
          <Link
            href="/admin/crm/leads/new"
            className="bg-yellow-400 hover:bg-yellow-300 text-blue-900 text-xs font-bold px-3 py-1.5 rounded-md transition-colors"
          >
            + Add Lead
          </Link>
        </div>
      </div>

      <LeadFilterBar
        filters={filters}
        onChange={setFilters}
        showStageFilter={view === "table"}
        assignees={users}
        exportHref={`/api/crm/leads/export?${exportParams.toString()}`}
      />

      {view === "kanban" ? (
        // Keyed on the filters so KanbanBoard's internal drag state resets
        // to the newly filtered set whenever a filter changes.
        <KanbanBoard key={JSON.stringify(filters)} initialLeads={filteredLeads} />
      ) : (
        <LeadTable leads={filteredLeads} assignees={users} />
      )}
    </div>
  );
}
