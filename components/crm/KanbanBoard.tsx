"use client";

import { useEffect, useRef, useState } from "react";
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
      //
      // select-none and the iOS touch-callout reset stop a long press on the
      // card (which is an <a>) from raising the text-selection handles or the
      // link preview sheet, both of which fight the drag gesture.
      className={`select-none [-webkit-touch-callout:none] ${
        isDragging ? "touch-none opacity-50" : "touch-auto"
      }`}
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
      // Mobile: one stage fills the viewport and snaps, so a swipe lands
      // cleanly on the next stage instead of half-way between two.
      // Desktop keeps the original fixed 320px columns.
      className={`flex flex-col w-[calc(100vw-2.5rem)] sm:w-80 shrink-0 snap-center sm:snap-align-none rounded-lg border transition-colors ${
        isOver ? "bg-blue-50 border-blue-300" : "bg-gray-50 border-gray-200"
      }`}
    >
      <div className="px-2.5 sm:px-3 py-2 sm:py-2.5 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-[13px] sm:text-sm font-bold text-blue-900">{STAGE_LABELS[stage]}</h3>
          <span className="text-[11px] sm:text-xs text-gray-500">{leads.length}</span>
        </div>
        {totalValue > 0 && (
          <p className="text-[11px] text-gray-500 mt-0.5">
            {new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(
              totalValue
            )}
          </p>
        )}
      </div>
      <div className="flex-1 p-1.5 sm:p-2 space-y-1.5 sm:space-y-2 min-h-[120px] max-h-[calc(100vh-260px)] sm:max-h-[calc(100vh-220px)] overflow-y-auto">
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeStage, setActiveStage] = useState(0);

  // Every card is a <Link>, so after a touch drag ends the browser still
  // synthesises a click on the anchor under the finger and navigates — which
  // is why a long-press was opening the lead instead of picking the card up.
  // dnd-kit does not suppress that click itself. Latch on drag activation and
  // swallow the single click that follows; a tap that never reaches the 250ms
  // threshold never starts a drag, so it never sets the latch and navigates
  // exactly as before.
  const suppressClickRef = useRef(false);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    };
  }, []);

  function handleDragStart() {
    suppressClickRef.current = true;
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
  }

  // Failsafe: if no click materialises (a drag that moved far enough for the
  // browser to suppress the click on its own), drop the latch so it can never
  // swallow a later, genuine tap.
  function armLatchRelease() {
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    clearTimerRef.current = setTimeout(() => {
      suppressClickRef.current = false;
    }, 400);
  }

  // Capture phase on the board: runs before the anchor's own handler, so
  // stopPropagation keeps Next's Link onClick from firing and preventDefault
  // cancels the native href navigation. Both are needed.
  function handleBoardClickCapture(e: React.MouseEvent) {
    if (!suppressClickRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    suppressClickRef.current = false;
  }

  // Column width is viewport-derived on mobile, so the step is measured from
  // the rendered column rather than assumed. 12px is the gap-3 between them.
  function stageStep(el: HTMLDivElement): number {
    const first = el.firstElementChild as HTMLElement | null;
    return first ? first.offsetWidth + 12 : 0;
  }

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const step = stageStep(el);
    if (step > 0) setActiveStage(Math.round(el.scrollLeft / step));
  }

  function jumpToStage(index: number) {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ left: index * stageStep(el), behavior: "smooth" });
  }

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
    // Arm the failsafe on every drag end, including the early returns below.
    armLatchRelease();

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
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      {/* Mobile-only stage pills: show which stage is in view and jump
          between them, since only one column fits a phone screen. */}
      <div className="sm:hidden flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1">
        {STAGES.map((stage, i) => {
          const count = leads.filter((l) => l.stage === stage).length;
          const active = activeStage === i;
          return (
            <button
              key={stage}
              type="button"
              onClick={() => jumpToStage(i)}
              aria-current={active ? "true" : undefined}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? "bg-blue-700 text-white"
                  : "bg-white border border-gray-300 text-gray-700"
              }`}
            >
              {STAGE_LABELS[stage]}
              <span className={`ml-1.5 ${active ? "text-blue-200" : "text-gray-400"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        onClickCapture={handleBoardClickCapture}
        className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory sm:snap-none"
      >
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
