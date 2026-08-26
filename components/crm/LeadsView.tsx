"use client";

import { useState } from "react";
import Link from "next/link";
import KanbanBoard from "./KanbanBoard";
import LeadTable from "./LeadTable";
import type { KanbanLead } from "./LeadCard";

export default function LeadsView({ leads }: { leads: KanbanLead[] }) {
  const [view, setView] = useState<"kanban" | "table">("kanban");

  return (
    <div>
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

      {view === "kanban" ? <KanbanBoard initialLeads={leads} /> : <LeadTable leads={leads} />}
    </div>
  );
}
