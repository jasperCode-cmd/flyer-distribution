"use client";

import { useState } from "react";
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import LeadCard, { type KanbanLead } from "./LeadCard";
import LostReasonModal from "./LostReasonModal";
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
      // touch-action must permit panning while idle, or a swipe starting on a
      // card can't scroll the column strip at all. Suppressed only once a
      // drag is actually active.
      className={isDragging ? "touch-none opacity-50" : "touch-auto"}
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
  const [lostPrompt, setLostPrompt] = useState<{ leadId: string; previousStage: string } | null>(null);

  // Split deliberately: one PointerSensor would apply the same constraint to
  // both input types. Mouse keeps the original 8px threshold, unchanged.
  // Touch instead requires a stationary long-press, so a swipe across the
  // column strip scrolls rather than picking a card up — moving more than
  // `tolerance` before `delay` elapses cancels the activation.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  async function commitStageChange(
    leadId: string,
    newStage: string,
    previousStage: string,
    extra?: { lostReason?: string; lostReasonNote?: string }
  ) {
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, stage: newStage } : l)));
    setPending(true);

    try {
      const res = await fetch(`/api/crm/leads/${leadId}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: newStage, ...extra }),
      });
      if (!res.ok) throw new Error("Failed to update stage");
    } catch {
      // Revert on failure
      setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, stage: previousStage } : l)));
    } finally {
      setPending(false);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const leadId = active.id as string;
    const newStage = over.id as string;

    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.stage === newStage) return;

    if (newStage === "LOST") {
      // Don't move the card (or call the API) until a reason is confirmed.
      setLostPrompt({ leadId, previousStage: lead.stage });
      return;
    }

    commitStageChange(leadId, newStage, lead.stage);
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
      <LostReasonModal
        open={lostPrompt !== null}
        onCancel={() => setLostPrompt(null)}
        onConfirm={(reason, note) => {
          if (!lostPrompt) return;
          commitStageChange(lostPrompt.leadId, "LOST", lostPrompt.previousStage, {
            lostReason: reason,
            lostReasonNote: note,
          });
          setLostPrompt(null);
        }}
      />
    </DndContext>
  );
}
