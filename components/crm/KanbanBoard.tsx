"use client";

import { useState } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import LeadCard, { type KanbanLead } from "./LeadCard";
import { STAGES, STAGE_LABELS } from "@/lib/crm-constants";

function DraggableCard({ lead }: { lead: KanbanLead }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
  });

  const style = transform
    ? {
        transform: `translate(${transform.x}px, ${transform.y}px)`,
        zIndex: 50,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`touch-none ${isDragging ? "opacity-50" : ""}`}
    >
      <LeadCard lead={lead} />
    </div>
  );
}

function Column({
  stage,
  leads,
}: {
  stage: string;
  leads: KanbanLead[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });

  const totalValue = leads.reduce((sum, l) => sum + (l.dealValue ? Number(l.dealValue) : 0), 0);

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col w-72 sm:w-80 shrink-0 rounded-lg border transition-colors ${
        isOver ? "bg-blue-50 border-blue-300" : "bg-gray-50 border-gray-200"
      }`}
    >
      <div className="px-3 py-2.5 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-blue-900">{STAGE_LABELS[stage]}</h3>
          <span className="text-xs text-gray-500">{leads.length}</span>
        </div>
        {totalValue > 0 && (
          <p className="text-[11px] text-gray-500 mt-0.5">
            {new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(
              totalValue
            )}
          </p>
        )}
      </div>
      <div className="flex-1 p-2 space-y-2 min-h-[120px] max-h-[calc(100vh-220px)] overflow-y-auto">
        {leads.map((lead) => (
          <DraggableCard key={lead.id} lead={lead} />
        ))}
        {leads.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-6">No leads</p>
        )}
      </div>
    </div>
  );
}

export default function KanbanBoard({ initialLeads }: { initialLeads: KanbanLead[] }) {
  const [leads, setLeads] = useState(initialLeads);
  const [pending, setPending] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const leadId = active.id as string;
    const newStage = over.id as string;

    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.stage === newStage) return;

    // Optimistic update
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, stage: newStage } : l)));
    setPending(true);

    try {
      const res = await fetch(`/api/crm/leads/${leadId}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: newStage }),
      });
      if (!res.ok) throw new Error("Failed to update stage");
    } catch {
      // Revert on failure
      setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, stage: lead.stage } : l)));
    } finally {
      setPending(false);
    }
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
        {STAGES.map((stage) => (
          <Column key={stage} stage={stage} leads={leads.filter((l) => l.stage === stage)} />
        ))}
      </div>
      {pending && (
        <p className="text-xs text-gray-400 mt-2">Saving...</p>
      )}
    </DndContext>
  );
}
