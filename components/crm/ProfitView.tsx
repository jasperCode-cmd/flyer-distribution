"use client";

import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import Link from "next/link";
import BusinessBadge from "./BusinessBadge";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "framer-motion";
import { formatPence, formatPercent } from "@/lib/money";
import {
  ALL_TIME,
  formatWonDate,
  jobFigures,
  jobsForMonth,
  monthLabel,
  monthKeyLondon,
  summarize,
  wonDateInput,
  type CostCategory,
  type CostLine,
  type ProfitJob,
} from "@/lib/profit";
import ProfitJobPanel, { AddDistributorSelect } from "./ProfitJobPanel";
import ProfitCostForm, { type CostFormTarget, type CostPayload } from "./ProfitCostForm";
import { IncludedBadges, RetainerBadge, StageBadge, type DistributorOption } from "./profit-ui";
import type { RetainerPayload } from "./ProfitJobPanel";

// The Profit page's Jobs tab: every Won or Completed lead as a job card, for
// the chosen month (by won date) or all time. Distributors are dragged from
// the panel onto a card to add what they were paid; each card also has an
// "Add distributor" select for keyboards and phones. The jobs and the month
// belong to the page around it, which the Overview tab shares.

export default function ProfitView({
  jobs,
  setJobs,
  distributors,
  month,
  onMonthChange: chooseMonth,
}: {
  jobs: ProfitJob[];
  setJobs: Dispatch<SetStateAction<ProfitJob[]>>;
  distributors: DistributorOption[];
  month: string;
  onMonthChange: (month: string) => void;
}) {
  const reduce = useReducedMotion();
  const [openId, setOpenId] = useState<string | null>(null);
  const [form, setForm] = useState<CostFormTarget | null>(null);
  const [dragging, setDragging] = useState<DistributorOption | null>(null);
  const [toast, setToast] = useState<{ text: string; kind: "success" | "error" } | null>(null);

  const activeDistributors = distributors.filter((d) => d.active);
  const visible = useMemo(() => jobsForMonth(jobs, month), [jobs, month]);
  const summary = useMemo(() => summarize(visible), [visible]);
  const undatedCount = jobs.filter((j) => !j.wonAt).length;
  const openJob = jobs.find((j) => j.leadId === openId) ?? null;
  const today = wonDateInput(new Date().toISOString());

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const closePanel = useCallback(() => {
    const leadId = openId;
    setOpenId(null);
    // Back to the card that opened it, once the panel has gone. If the job
    // has left this month (its won date changed), the month select instead.
    setTimeout(() => {
      const card = leadId ? document.getElementById(`profit-open-${leadId}`) : null;
      (card ?? document.getElementById("profit-month"))?.focus({ preventScroll: !!card });
    }, 0);
  }, [openId]);

  // A saved job comes back from the server with its figures worked out from
  // what was stored. Null means the lead has left Won or Completed.
  function applyJob(leadId: string, job: ProfitJob | null) {
    if (job) {
      setJobs((prev) => prev.map((j) => (j.leadId === leadId ? job : j)));
    } else {
      setJobs((prev) => prev.filter((j) => j.leadId !== leadId));
      if (openId === leadId) setOpenId(null);
      setToast({ text: "That lead is no longer Won or Completed, so it has left this page.", kind: "error" });
    }
  }

  async function request(url: string, method: string, body?: unknown): Promise<{ job?: ProfitJob | null; error?: string }> {
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { error: data.error || `Something went wrong (${res.status}).`, job: res.status === 409 ? null : undefined };
      return { job: data.job ?? null };
    } catch {
      return { error: "Couldn't reach the server. Check your connection and try again." };
    }
  }

  async function saveCost(target: CostFormTarget, payload: CostPayload): Promise<string | null> {
    const result = target.line
      ? await request(`/api/crm/profit/costs/${target.line.id}`, "PATCH", payload)
      : await request(`/api/crm/profit/jobs/${target.leadId}/costs`, "POST", payload);
    if (result.error) {
      if (result.job === null) {
        setForm(null);
        applyJob(target.leadId, null);
      }
      return result.error;
    }
    applyJob(target.leadId, result.job ?? null);
    setForm(null);
    setToast({ text: target.line ? "Cost saved." : "Cost added.", kind: "success" });
    return null;
  }

  async function deleteCost(job: ProfitJob, line: CostLine): Promise<string | null> {
    const result = await request(`/api/crm/profit/costs/${line.id}`, "DELETE");
    if (result.error) {
      setToast({ text: result.error, kind: "error" });
      return result.error;
    }
    applyJob(job.leadId, result.job ?? null);
    setToast({ text: "Cost deleted.", kind: "success" });
    return null;
  }

  async function saveWonDate(job: ProfitJob, date: string): Promise<string | null> {
    const result = await request(`/api/crm/profit/jobs/${job.leadId}`, "PATCH", { wonDate: date });
    if (result.error) {
      if (result.job === null) applyJob(job.leadId, null);
      return result.error;
    }
    applyJob(job.leadId, result.job ?? null);
    const saved = result.job?.wonAt ?? null;
    const movedOut = month !== ALL_TIME && saved && monthKeyLondon(saved) !== month;
    setToast({
      text: movedOut
        ? `Won date saved. This job now counts towards ${monthLabel(monthKeyLondon(saved))}.`
        : "Won date saved.",
      kind: "success",
    });
    return null;
  }

  async function saveRetainer(job: ProfitJob, payload: RetainerPayload): Promise<string | null> {
    const result = await request(`/api/crm/profit/jobs/${job.leadId}/retainer`, "PATCH", payload);
    if (result.error) {
      if (result.job === null) applyJob(job.leadId, null);
      return result.error;
    }
    applyJob(job.leadId, result.job ?? null);
    setToast({ text: payload.isRetainer ? "Retainer saved." : "Retainer turned off.", kind: "success" });
    return null;
  }

  function addCost(job: ProfitJob, category: CostCategory, distributorId?: string) {
    setForm({
      leadId: job.leadId,
      jobName: job.businessName ? `${job.name}, ${job.businessName}` : job.name,
      leafletQuantity: job.leafletQuantity,
      category,
      distributorId,
    });
  }

  function editCost(job: ProfitJob, line: CostLine) {
    setForm({
      leadId: job.leadId,
      jobName: job.businessName ? `${job.name}, ${job.businessName}` : job.name,
      leafletQuantity: job.leafletQuantity,
      category: line.category,
      line,
    });
  }

  // Same activation rules as the Kanban board: a mouse drag starts after
  // 8px, a touch drag after a 250ms press, so a swipe still scrolls.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  function onDragStart(event: DragStartEvent) {
    setDragging(activeDistributors.find((d) => `distributor:${d.id}` === event.active.id) ?? null);
  }

  function onDragEnd(event: DragEndEvent) {
    const distributor = dragging;
    setDragging(null);
    const overId = event.over?.id;
    if (!distributor || typeof overId !== "string" || !overId.startsWith("job:")) return;
    const job = jobs.find((j) => `job:${j.leadId}` === overId);
    if (job) addCost(job, "DISTRIBUTOR", distributor.id);
  }

  const label = monthLabel(month);

  return (
    <MotionConfig reducedMotion="user" transition={reduce ? { duration: 0 } : { type: "spring", bounce: 0.12, duration: 0.45 }}>
      <div>
        <p className="mb-3 text-sm text-gray-500">
          Won and Completed jobs, by the month they were won. Profit and margin are on the amount paid.
        </p>

        <Summary summary={summary} />

        {undatedCount > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
            <span>
              {undatedCount} {undatedCount === 1 ? "job has" : "jobs have"} no won date yet
              {month === ALL_TIME ? ". Open a job to set it." : ", so only show under All time."}
            </span>
            {month !== ALL_TIME && (
              <button type="button" onClick={() => chooseMonth(ALL_TIME)} className="font-semibold underline">
                Show All time
              </button>
            )}
          </div>
        )}

        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
          <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-start">
            <DistributorPanel distributors={activeDistributors} />

            <section className="@container min-w-0 flex-1" aria-label={`Jobs, ${label}`}>
              {visible.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-300 bg-white px-4 py-10 text-center text-sm text-gray-500">
                  {month === ALL_TIME ? "No Won or Completed leads yet." : `No jobs won in ${label}.`}
                </div>
              ) : (
                <ul className="grid gap-4 @xl:grid-cols-2 @4xl:grid-cols-3">
                  {visible.map((job) => (
                    <li key={job.leadId}>
                      <JobCard
                        job={job}
                        distributors={activeDistributors}
                        dragging={dragging}
                        onOpen={() => setOpenId(job.leadId)}
                        onAddDistributor={(id) => addCost(job, "DISTRIBUTOR", id)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <DragOverlay dropAnimation={null}>
            {dragging ? <Chip name={dragging.name} lifted /> : null}
          </DragOverlay>
        </DndContext>

        <AnimatePresence>
          {openJob && (
            <ProfitJobPanel
              key={openJob.leadId}
              job={openJob}
              distributors={distributors}
              blocked={form !== null}
              today={today}
              onClose={closePanel}
              onAddCost={(category, distributorId) => addCost(openJob, category, distributorId)}
              onEditCost={(line) => editCost(openJob, line)}
              onDeleteCost={(line) => deleteCost(openJob, line)}
              onSaveWonDate={(date) => saveWonDate(openJob, date)}
              onSaveRetainer={(payload) => saveRetainer(openJob, payload)}
            />
          )}
        </AnimatePresence>

        {form && (
          <ProfitCostForm
            key={`${form.leadId}-${form.line?.id ?? form.category}-${form.distributorId ?? ""}`}
            target={form}
            distributors={distributors}
            onCancel={() => setForm(null)}
            onSave={(payload) => saveCost(form, payload)}
          />
        )}

        {toast && (
          <div
            role="status"
            className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[80] w-max max-w-[calc(100vw-2rem)] text-white text-sm font-medium rounded-full shadow-lg px-4 py-2 ${
              toast.kind === "success" ? "bg-gray-900" : "bg-red-600"
            }`}
          >
            {toast.text}
          </div>
        )}
      </div>
    </MotionConfig>
  );
}

function Summary({ summary }: { summary: ReturnType<typeof summarize> }) {
  const loss = summary.profitPence < 0;
  const tiles: { label: string; value: string; sub?: string; tone?: "loss" }[] = [
    {
      label: "Revenue paid",
      value: formatPence(summary.paidPence),
      sub: `${summary.jobCount} ${summary.jobCount === 1 ? "job" : "jobs"}`,
    },
    {
      label: "Deal value",
      value: formatPence(summary.dealPence),
      sub: summary.noDealCount ? `${summary.noDealCount} without a deal value` : undefined,
    },
    { label: "Job costs", value: formatPence(summary.costsPence) },
    {
      label: loss ? "Loss" : "Profit",
      value: formatPence(summary.profitPence),
      sub: `Expected on deal value: ${formatPence(summary.expectedProfitPence)}`,
      tone: loss ? "loss" : undefined,
    },
    { label: "Margin", value: formatPercent(summary.marginPct), sub: "On amount paid", tone: loss ? "loss" : undefined },
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
      {tiles.map((t, i) => (
        <div
          key={t.label}
          className={`rounded-lg border border-gray-200 bg-white p-4 ${i === 4 ? "col-span-2 sm:col-span-1" : ""}`}
        >
          <dt className="text-xs font-medium text-gray-500">{t.label}</dt>
          <dd className={`mt-0.5 text-xl font-bold tabular-nums ${t.tone === "loss" ? "text-red-700" : "text-gray-900"}`}>
            {t.value}
          </dd>
          {t.sub && <dd className="mt-0.5 text-xs text-gray-500">{t.sub}</dd>}
        </div>
      ))}
    </dl>
  );
}

function DistributorPanel({ distributors }: { distributors: DistributorOption[] }) {
  return (
    <aside
      aria-label="Distributors"
      className="rounded-lg border border-gray-200 bg-white p-3 lg:sticky lg:top-24 lg:w-56 lg:shrink-0"
    >
      <h2 className="text-sm font-bold text-blue-900">Distributors</h2>
      <p className="mt-0.5 text-xs text-gray-500">
        Drag onto a job to add what they were paid, or use Add distributor on the job.
      </p>
      {distributors.length === 0 ? (
        <p className="mt-2 text-xs text-gray-500">
          No active distributors.{" "}
          <Link href="/admin/crm/distributors" className="font-semibold text-blue-700 underline">
            Add one
          </Link>
        </p>
      ) : (
        <ul className="mt-2 flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
          {distributors.map((d) => (
            <li key={d.id} className="shrink-0">
              <DraggableDistributor distributor={d} />
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

function DraggableDistributor({ distributor }: { distributor: DistributorOption }) {
  // Only the pointer listeners: the select on each card is the keyboard
  // route, so the chip isn't a focusable control that does nothing.
  const { listeners, setNodeRef, isDragging } = useDraggable({ id: `distributor:${distributor.id}` });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      data-distributor={distributor.id}
      className={`select-none [-webkit-touch-callout:none] ${isDragging ? "opacity-40 touch-none" : "touch-auto"}`}
    >
      <Chip name={distributor.name} />
    </div>
  );
}

function Chip({ name, lifted = false }: { name: string; lifted?: boolean }) {
  return (
    <span
      className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm font-medium cursor-grab whitespace-nowrap ${
        lifted
          ? "border-blue-600 bg-blue-700 text-white shadow-lg cursor-grabbing"
          : "border-blue-200 bg-blue-50 text-blue-900 hover:bg-blue-100"
      }`}
    >
      <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 shrink-0 opacity-60" fill="currentColor" aria-hidden="true">
        <circle cx="7" cy="5" r="1.5" />
        <circle cx="13" cy="5" r="1.5" />
        <circle cx="7" cy="10" r="1.5" />
        <circle cx="13" cy="10" r="1.5" />
        <circle cx="7" cy="15" r="1.5" />
        <circle cx="13" cy="15" r="1.5" />
      </svg>
      {name}
    </span>
  );
}

function JobCard({
  job,
  distributors,
  dragging,
  onOpen,
  onAddDistributor,
}: {
  job: ProfitJob;
  distributors: DistributorOption[];
  dragging: DistributorOption | null;
  onOpen: () => void;
  onAddDistributor: (distributorId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `job:${job.leadId}` });
  const f = jobFigures(job);
  const printingMissing = job.printingIncluded && !job.costs.some((c) => c.category === "PRINTING");

  return (
    <motion.div
      layoutId={`profit-job-${job.leadId}`}
      ref={setNodeRef}
      style={{ borderRadius: 8 }}
      data-job={job.leadId}
      className={`relative h-full flex flex-col overflow-hidden bg-white border shadow-sm ${
        isOver ? "border-blue-600" : f.isLoss ? "border-red-300" : "border-gray-200"
      }`}
    >
      <button
        id={`profit-open-${job.leadId}`}
        type="button"
        onClick={onOpen}
        aria-haspopup="dialog"
        className="flex flex-1 flex-col justify-start w-full text-left p-4 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
      >
        <span className="flex items-start justify-between gap-3">
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 min-w-0">
              <span className="block font-semibold text-gray-900 truncate">{job.name}</span>
              <BusinessBadge business={job.business} />
            </span>
            <span className="block text-xs text-gray-500 truncate">{job.businessName || "-"}</span>
          </span>
          <StageBadge stage={job.stage} />
        </span>
        <span className={`mt-1 block text-xs ${job.wonAt ? "text-gray-500" : "font-medium text-amber-800"}`}>
          {job.wonAt ? `Won ${formatWonDate(job.wonAt)}` : "Won date unknown"}
        </span>
        {(job.printingIncluded || job.designIncluded || job.isRetainer) && (
          <span className="mt-2 flex flex-wrap gap-1.5">
            {job.isRetainer && <RetainerBadge />}
            <IncludedBadges printing={job.printingIncluded} design={job.designIncluded} />
          </span>
        )}

        <span className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
          <Figure label="Deal value" value={formatPence(job.dealPence)} />
          <Figure label="Paid" value={formatPence(job.paidPence)} />
          <Figure label="Costs" value={formatPence(f.costsPence)} />
          <Figure label="Margin" value={formatPercent(f.marginPct)} loss={f.isLoss} />
          <span className="col-span-2 mt-1 flex items-baseline justify-between border-t border-gray-100 pt-2">
            <span className="text-xs font-medium text-gray-500">{f.isLoss ? "Loss" : "Profit"}</span>
            <span className={`text-base font-bold tabular-nums ${f.isLoss ? "text-red-700" : "text-gray-900"}`}>
              {formatPence(f.profitPence)}
            </span>
          </span>
        </span>
        {printingMissing && (
          <span className="mt-2 block text-xs font-medium text-amber-800">Printing cost not added yet</span>
        )}
      </button>

      <div className="border-t border-gray-100 px-4 py-2.5">
        <AddDistributorSelect
          label={`Add distributor to ${job.name}`}
          distributors={distributors}
          onPick={onAddDistributor}
          className="w-full"
        />
      </div>

      {isOver && dragging && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-blue-50/85 ring-2 ring-inset ring-blue-600">
          <span className="rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-blue-900 shadow">
            Add {dragging.name} to this job
          </span>
        </div>
      )}
    </motion.div>
  );
}

function Figure({ label, value, loss = false }: { label: string; value: string; loss?: boolean }) {
  return (
    <span className="flex items-baseline justify-between gap-2">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`tabular-nums ${loss ? "text-red-700 font-medium" : "text-gray-900"}`}>{value}</span>
    </span>
  );
}
