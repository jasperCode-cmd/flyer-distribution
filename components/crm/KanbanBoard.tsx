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
import Link from "next/link";
import { useSession } from "next-auth/react";
import LeadCard, { type KanbanLead } from "./LeadCard";
import LostReasonModal from "./LostReasonModal";
import EmailComposeModal, { sentLabel, type ReplyContext } from "./EmailComposeModal";
import type { ConversationMessage } from "./EmailsSection";
import { STAGES, STAGE_LABELS } from "@/lib/crm-constants";

function DraggableCard({
  lead,
  onAdvance,
  onEmail,
}: {
  lead: KanbanLead;
  onAdvance: (leadId: string) => void;
  onEmail: (lead: KanbanLead) => void;
}) {
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
      <LeadCard lead={lead} onAdvance={onAdvance} onEmail={onEmail} />
    </div>
  );
}

function Column({
  stage,
  leads,
  onAdvance,
  onEmail,
}: {
  stage: string;
  leads: KanbanLead[];
  onAdvance: (leadId: string) => void;
  onEmail: (lead: KanbanLead) => void;
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
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[13px] sm:text-sm font-bold text-blue-900">{STAGE_LABELS[stage]}</h3>
          <div className="flex items-center gap-2 shrink-0">
            {stage === "UNCONTACTED" && (
              <Link
                href="/admin/crm/dialer"
                className="text-[11px] font-semibold text-blue-700 hover:underline"
              >
                Dial →
              </Link>
            )}
            <span className="text-[11px] sm:text-xs text-gray-500">{leads.length}</span>
          </div>
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
          <DraggableCard key={lead.id} lead={lead} onAdvance={onAdvance} onEmail={onEmail} />
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
  const [stageError, setStageError] = useState<string | null>(null);
  const [lostPrompt, setLostPrompt] = useState<{ leadId: string; previousStage: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeStage, setActiveStage] = useState(0);

  // Quick email from a card, without leaving the board. Same modal and send
  // route as the lead page, so the Activity and the Uncontacted to Awaiting
  // Response move come from the shared server logic.
  const { data: session } = useSession();
  const userFirstName = (session?.user?.name ?? "").split(" ")[0] || "the team";
  const [compose, setCompose] = useState<{
    lead: KanbanLead;
    latestReply: ReplyContext | null;
    configured: boolean;
    configuredKnown: boolean;
  } | null>(null);
  const composeLeadRef = useRef<string | null>(null);
  const [toast, setToast] = useState<{ text: string; kind: "success" | "error" } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // Opens straight away in its "Checking Gmail connection..." state. With a
  // conversation, the modal offers "Reply to latest" (threaded onto the
  // latest message, exactly as the lead page's Reply does) or "New email";
  // without one it is a fresh email. Not connected shows the modal's own
  // not-connected state.
  async function openEmail(lead: KanbanLead) {
    composeLeadRef.current = lead.id;
    setCompose({ lead, latestReply: null, configured: true, configuredKnown: false });
    let configured = true;
    let latestReply: ReplyContext | null = null;
    try {
      const res = await fetch(`/api/crm/leads/${lead.id}/emails`);
      const data = await res.json();
      configured = data.configured ?? true;
      const messages: ConversationMessage[] = res.ok ? data.messages ?? [] : [];
      const last = messages[messages.length - 1];
      if (last) {
        latestReply = { subject: last.subject, threadId: last.threadId, lastMessageId: last.messageIdHeader ?? "" };
      }
    } catch {
      // Falls back to a fresh email; the send itself reports any Gmail problem.
    }
    if (composeLeadRef.current !== lead.id) return;
    setCompose({ lead, latestReply, configured, configuredKnown: true });
  }

  function closeEmail() {
    composeLeadRef.current = null;
    setCompose(null);
  }

  // Every card is a <Link>, so after a touch drag ends the browser still
  // synthesises a click on the anchor under the finger and navigates, which
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
  // both input types. Mouse keeps the original 8px threshold. Touch instead
  // requires a stationary long-press, so a swipe across the column strip
  // scrolls rather than picking a card up; moving more than `tolerance`
  // before `delay` elapses cancels the activation.
  //
  // (This was briefly raised to 16px, paired with letting mousedown reach
  // this sensor from inside the pills, to support dragging a card by
  // grabbing a pill directly. That combination broke both pills in Firefox
  // (see InlinePaymentReview.tsx), so both changes were reverted together;
  // pills are back to being fully outside dnd-kit's reach, same as before.)
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
    setStageError(null);

    try {
      const res = await fetch(`/api/crm/leads/${leadId}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: newStage, ...extra }),
      });
      if (!res.ok) {
        // Surfaced instead of just reverting silently: a card moving then
        // snapping back with no visible reason is nearly undiagnosable
        // remotely; the server's actual error (e.g. a database rejecting a
        // stage value it doesn't actually have yet) is worth showing.
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `Failed to update stage (${res.status})`);
      }
    } catch (err) {
      setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, stage: previousStage } : l)));
      setStageError(err instanceof Error ? err.message : "Failed to update stage");
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

  // Same underlying action as dragging a card from Uncontacted to Awaiting
  // Response: same commitStageChange call, so the same PATCH request and
  // the same server-side Stage Change activity log either way.
  function handleAdvance(leadId: string) {
    commitStageChange(leadId, "AWAITING_RESPONSE", "UNCONTACTED");
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      // Default acceleration (10) combined with the 5ms tick interval covers
      // a full column's width (~330px) in well under 200ms once the pointer
      // sits near the board's edge, confirmed directly: holding at the
      // edge for 150ms+ scrolls straight past the intended column (e.g.
      // Won -> Completed) onto the next one (Lost) before the drop lands,
      // rather than stopping at Completed. A real user pausing briefly at
      // the edge (completely ordinary) reproduces this. Lowering
      // acceleration slows the scroll enough that a normal pause lands on
      // the intended column instead of sailing past it.
      autoScroll={{ acceleration: 1 }}
    >
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
          <Column
            key={stage}
            stage={stage}
            leads={leads.filter((l) => l.stage === stage)}
            onAdvance={handleAdvance}
            onEmail={openEmail}
          />
        ))}
      </div>
      {pending && (
        <p className="text-xs text-gray-400 mt-2">Saving...</p>
      )}
      {stageError && (
        <p className="text-xs text-red-600 mt-2">
          {stageError}. The card was moved back.{" "}
          <button type="button" onClick={() => setStageError(null)} className="underline">
            Dismiss
          </button>
        </p>
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
      {compose?.lead.email && (
        <EmailComposeModal
          open
          onClose={closeEmail}
          leadId={compose.lead.id}
          toAddress={compose.lead.email}
          configured={compose.configured}
          configuredKnown={compose.configuredKnown}
          userFirstName={userFirstName}
          replyTo={null}
          latestReply={compose.latestReply}
          onSent={(result) => {
            const leadId = compose.lead.id;
            setToast({ text: sentLabel("Email", result), kind: "success" });
            // The server already moved the lead (and logged it), so this only
            // mirrors it on screen; no second stage PATCH.
            if (result.movedToAwaitingResponse) {
              setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, stage: "AWAITING_RESPONSE" } : l)));
            }
          }}
          onError={(message) => setToast({ text: message, kind: "error" })}
        />
      )}
      {toast && (
        <div
          role="status"
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] text-white text-sm font-medium rounded-full shadow-lg px-4 py-2 ${
            toast.kind === "success" ? "bg-gray-900" : "bg-red-600"
          }`}
        >
          {toast.text}
        </div>
      )}
    </DndContext>
  );
}
