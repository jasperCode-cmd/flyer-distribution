"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { formatPence, formatPercent, penceToInput } from "@/lib/money";
import {
  COST_GROUPS,
  distributorPayments,
  formatWonDate,
  jobFigures,
  monthKeyLondon,
  monthLabel,
  wonDateInput,
  type CostCategory,
  type CostGroupId,
  type CostLine,
  type ProfitJob,
} from "@/lib/profit";
import ProfitDonut, { type DonutSegment } from "./ProfitDonut";
import {
  costLineDetail,
  costLineTitle,
  GROUP_COLORS,
  IncludedBadges,
  RetainerBadge,
  StageBadge,
  trapTab,
  useIsNarrow,
  type DistributorOption,
} from "./profit-ui";

// The job overview. It grows out of the job's card (the two share a
// framer-motion layoutId) into a wide panel, or a full-width sheet on a
// phone. With reduced motion it simply appears.

export default function ProfitJobPanel({
  job,
  distributors,
  blocked,
  today,
  onClose,
  onAddCost,
  onEditCost,
  onDeleteCost,
  onSaveWonDate,
  onSaveRetainer,
}: {
  job: ProfitJob;
  distributors: DistributorOption[];
  blocked: boolean;
  today: string;
  onClose: () => void;
  onAddCost: (category: CostCategory, distributorId?: string) => void;
  onEditCost: (line: CostLine) => void;
  onDeleteCost: (line: CostLine) => Promise<string | null>;
  onSaveWonDate: (date: string) => Promise<string | null>;
  onSaveRetainer: (payload: RetainerPayload) => Promise<string | null>;
}) {
  const id = useId();
  const reduce = useReducedMotion();
  const narrow = useIsNarrow();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  const figures = jobFigures(job);
  const payments = distributorPayments(job.costs);

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (blocked) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [blocked, onClose]);

  const radius = narrow
    ? { borderTopLeftRadius: 16, borderTopRightRadius: 16, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }
    : { borderRadius: 12 };

  return (
    <>
      <motion.div
        key="backdrop"
        className="fixed inset-0 z-50 bg-black/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reduce ? 0 : 0.2 }}
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6 pointer-events-none">
        <motion.div
          layoutId={`profit-job-${job.leadId}`}
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${id}-title`}
          onKeyDown={(e) => trapTab(e, dialogRef.current)}
          style={radius}
          className="pointer-events-auto bg-white w-full sm:max-w-4xl max-h-[92dvh] sm:max-h-[88vh] flex flex-col overflow-hidden shadow-2xl"
        >
          <motion.div
            className="flex flex-col min-h-0"
            initial={{ opacity: reduce ? 1 : 0 }}
            animate={{ opacity: 1, transition: { duration: reduce ? 0 : 0.18, delay: reduce ? 0 : 0.12 } }}
            exit={{ opacity: 0, transition: { duration: reduce ? 0 : 0.08 } }}
          >
            <Header
              job={job}
              titleId={`${id}-title`}
              closeRef={closeRef}
              onClose={onClose}
              today={today}
              onSaveWonDate={onSaveWonDate}
            />

            <div className="overflow-y-auto overscroll-contain px-4 sm:px-6 py-5 space-y-6 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
              <Breakdown job={job} figures={figures} hovered={hovered} onHover={setHovered} />

              <section className="grid gap-3 sm:grid-cols-3" aria-label="Revenue, profit and margin">
                <RevenueTile figures={figures} />
                <div className="rounded-lg border border-gray-200 p-4">
                  <p className="text-xs font-medium text-gray-500">{figures.isLoss ? "Loss" : "Profit"} on amount paid</p>
                  <p className={`text-xl font-bold tabular-nums ${figures.isLoss ? "text-red-700" : "text-gray-900"}`}>
                    {formatPence(figures.profitPence)}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    Expected on deal value:{" "}
                    <span className="font-medium text-gray-700 tabular-nums">{formatPence(figures.expectedProfitPence)}</span>
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 p-4">
                  <p className="text-xs font-medium text-gray-500">Margin on amount paid</p>
                  <p className={`text-xl font-bold tabular-nums ${figures.isLoss ? "text-red-700" : "text-gray-900"}`}>
                    {formatPercent(figures.marginPct)}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    Expected on deal value:{" "}
                    <span className="font-medium text-gray-700 tabular-nums">{formatPercent(figures.expectedMarginPct)}</span>
                  </p>
                </div>
              </section>

              <RetainerSection job={job} today={today} onSave={onSaveRetainer} />

              <section aria-labelledby={`${id}-paid`}>
                <h3 id={`${id}-paid`} className="text-sm font-bold text-blue-900 mb-2">
                  Paid to distributors
                </h3>
                {payments.length === 0 ? (
                  <p className="text-sm text-gray-500">No distributors added yet.</p>
                ) : (
                  <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                    {payments.map((p) => (
                      <li key={p.key} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                        <span className="min-w-0 truncate text-gray-900">{p.name}</span>
                        <span className="font-medium tabular-nums text-gray-900">{formatPence(p.amountPence)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <CostGroups
                job={job}
                figures={figures}
                distributors={distributors}
                onAddCost={onAddCost}
                onEditCost={onEditCost}
                onDeleteCost={onDeleteCost}
              />

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-4">
                <p className="text-sm text-gray-700">
                  Total costs <span className="font-semibold tabular-nums text-gray-900">{formatPence(figures.costsPence)}</span>
                  <span className="mx-2 text-gray-300" aria-hidden="true">|</span>
                  Total {figures.isLoss ? "loss" : "profit"}{" "}
                  <span className={`font-bold tabular-nums ${figures.isLoss ? "text-red-700" : "text-gray-900"}`}>
                    {formatPence(figures.profitPence)}
                  </span>
                </p>
                <Link
                  href={`/admin/crm/leads/${job.leadId}`}
                  className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:text-blue-900 hover:underline"
                >
                  Open lead
                  <span aria-hidden="true">&rarr;</span>
                </Link>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </>
  );
}

function Header({
  job,
  titleId,
  closeRef,
  onClose,
  today,
  onSaveWonDate,
}: {
  job: ProfitJob;
  titleId: string;
  closeRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  today: string;
  onSaveWonDate: (date: string) => Promise<string | null>;
}) {
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const dateRef = useRef<HTMLInputElement>(null);

  function startEditing() {
    setDate(wonDateInput(job.wonAt) || today);
    setError("");
    setEditing(true);
    requestAnimationFrame(() => dateRef.current?.focus());
  }

  async function save() {
    setSaving(true);
    const problem = await onSaveWonDate(date);
    setSaving(false);
    if (problem) setError(problem);
    else setEditing(false);
  }

  return (
    <div className="flex items-start gap-3 border-b border-gray-200 px-4 sm:px-6 py-4">
      <div className="min-w-0 flex-1">
        <h2 id={titleId} className="text-lg font-bold text-blue-900 truncate">
          {job.name}
        </h2>
        <p className="text-sm text-gray-500 truncate">{job.businessName || "-"}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StageBadge stage={job.stage} />
          {job.isRetainer && <RetainerBadge />}
          <IncludedBadges printing={job.printingIncluded} design={job.designIncluded} />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          {editing ? (
            <>
              <label htmlFor={`${titleId}-won`} className="text-gray-600">
                Won on
              </label>
              <input
                ref={dateRef}
                id={`${titleId}-won`}
                type="date"
                value={date}
                max={today}
                onChange={(e) => setDate(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") save();
                  if (e.key === "Escape") {
                    e.stopPropagation();
                    e.nativeEvent.stopImmediatePropagation();
                    setEditing(false);
                  }
                }}
                className="border border-gray-300 rounded-md px-2 py-1 text-sm"
              />
              <button
                type="button"
                onClick={save}
                disabled={saving || !date}
                className="rounded-md bg-blue-700 px-3 py-1 text-xs font-bold text-white hover:bg-blue-800 disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700"
              >
                Cancel
              </button>
              {error && (
                <span role="alert" className="w-full text-xs text-red-700">
                  {error}
                </span>
              )}
            </>
          ) : (
            <>
              <span className={job.wonAt ? "text-gray-700" : "font-medium text-amber-800"}>
                {job.wonAt ? `Won ${formatWonDate(job.wonAt)}` : "Won date unknown"}
              </span>
              <button
                type="button"
                onClick={startEditing}
                className="text-xs font-semibold text-blue-700 hover:text-blue-900 hover:underline"
              >
                {job.wonAt ? "Change won date" : "Set won date"}
              </button>
            </>
          )}
        </div>
      </div>
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        aria-label="Close job overview"
        className="shrink-0 rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

type Figures = ReturnType<typeof jobFigures>;

// The chart and its legend table. A normal job shows where the amount paid
// went (each cost group plus profit, as shares of the amount paid). When
// the costs are more than the amount paid there is no honest pie to draw,
// so the loss is spelled out instead, with costs as shares of total costs.
function Breakdown({
  job,
  figures,
  hovered,
  onHover,
}: {
  job: ProfitJob;
  figures: Figures;
  hovered: string | null;
  onHover: (id: string | null) => void;
}) {
  const showsLoss = figures.costsPence > figures.paidPence;
  const base = showsLoss ? figures.costsPence : figures.paidPence;
  const share = (pence: number) => (base > 0 ? formatPercent((pence / base) * 100) : "-");

  const rows: (DonutSegment & { id: CostGroupId | "profit" })[] = COST_GROUPS.map((g) => ({
    id: g.id,
    label: g.label,
    color: GROUP_COLORS[g.id],
    valuePence: figures.groups[g.id],
    detail: `${formatPence(figures.groups[g.id])}, ${share(figures.groups[g.id])}`,
  }));
  if (!showsLoss) {
    rows.push({
      id: "profit",
      label: "Profit",
      color: GROUP_COLORS.profit,
      valuePence: figures.profitPence,
      detail: `${formatPence(figures.profitPence)}, ${share(figures.profitPence)}`,
    });
  }

  const legend = (
    <table className="w-full text-sm">
      <caption className="sr-only">
        {showsLoss ? "Costs, with each group's share of the total costs" : "Where the amount paid went"}
      </caption>
      <thead>
        <tr className="text-left text-xs text-gray-500">
          <th scope="col" className="pb-1.5 font-medium">
            {showsLoss ? "Costs" : "Amount paid"}
          </th>
          <th scope="col" className="pb-1.5 text-right font-medium">
            Amount
          </th>
          <th scope="col" className="pb-1.5 pl-3 text-right font-medium">
            {showsLoss ? "Of costs" : "Of paid"}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.id}
            onMouseEnter={() => onHover(row.id)}
            onMouseLeave={() => onHover(null)}
            className={`border-t border-gray-100 ${hovered === row.id ? "bg-gray-50" : ""}`}
          >
            <th scope="row" className="py-1.5 pr-2 text-left font-normal text-gray-900">
              <span className="inline-flex items-center gap-2">
                <span
                  className="inline-block h-3 w-3 shrink-0 rounded-sm"
                  style={{ backgroundColor: row.color }}
                  aria-hidden="true"
                />
                {row.label}
              </span>
            </th>
            <td className="py-1.5 text-right tabular-nums text-gray-900">{formatPence(row.valuePence)}</td>
            <td className="py-1.5 pl-3 text-right tabular-nums text-gray-600">{share(row.valuePence)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  if (showsLoss) {
    const paidWidth = figures.costsPence > 0 ? (figures.paidPence / figures.costsPence) * 100 : 0;
    return (
      <section aria-label="Cost breakdown" className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div role="status" className="rounded-lg border-2 border-red-300 bg-red-50 p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-red-800">
            <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0" fill="currentColor" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.721-1.36 3.486 0l6.518 11.59c.75 1.334-.213 2.98-1.742 2.98H3.48c-1.53 0-2.493-1.646-1.743-2.98L8.257 3.1zM11 14a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V7a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            Loss of {formatPence(-figures.profitPence)}
          </p>
          <p className="mt-1 text-sm text-red-900">
            {figures.paidPence === 0
              ? `Nothing has been paid yet, so the costs of ${formatPence(figures.costsPence)} show as a loss.`
              : `Costs of ${formatPence(figures.costsPence)} are more than the ${formatPence(figures.paidPence)} paid.`}
          </p>
          <div className="mt-4 space-y-2.5">
            <div>
              <div className="flex justify-between text-xs text-gray-700">
                <span>Amount paid</span>
                <span className="tabular-nums font-medium">{formatPence(figures.paidPence)}</span>
              </div>
              <div className="mt-1 h-3 rounded-full bg-white">
                <div className="h-3 rounded-full bg-gray-600" style={{ width: `${paidWidth}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs text-gray-700">
                <span>Costs</span>
                <span className="tabular-nums font-medium">{formatPence(figures.costsPence)}</span>
              </div>
              <div className="mt-1 h-3 rounded-full bg-red-600" />
            </div>
          </div>
        </div>
        <div>{legend}</div>
      </section>
    );
  }

  if (figures.paidPence === 0) {
    return (
      <section aria-label="Cost breakdown" className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-600">
          Nothing has been paid and no costs are added yet. The chart appears once there is an amount paid.
        </div>
        <div>{legend}</div>
      </section>
    );
  }

  return (
    <section aria-label="Cost breakdown" className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <ProfitDonut
        segments={rows}
        hovered={hovered}
        onHover={onHover}
        centre={{ value: formatPercent(figures.marginPct), caption: "margin" }}
        label={`Of ${formatPence(figures.paidPence)} paid: ${rows.map((r) => `${r.label} ${r.detail}`).join("; ")}`}
      />
      <div className="w-full min-w-0 flex-1">{legend}</div>
    </section>
  );
}

function RevenueTile({ figures }: { figures: Figures }) {
  const { paidPence, dealPence } = figures;
  const ratio = dealPence && dealPence > 0 ? paidPence / dealPence : null;
  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <p className="text-xs font-medium text-gray-500">Revenue paid</p>
      <p className="text-xl font-bold tabular-nums text-gray-900">{formatPence(paidPence)}</p>
      <p className="mt-1 text-xs text-gray-500">
        Deal value <span className="font-medium text-gray-700 tabular-nums">{formatPence(dealPence)}</span>
      </p>
      {ratio !== null && (
        <>
          <div
            className="mt-2 h-2 rounded-full bg-gray-200"
            role="meter"
            aria-label="Amount paid against deal value"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(Math.min(ratio, 1) * 100)}
          >
            <div className="h-2 rounded-full bg-blue-700" style={{ width: `${Math.min(ratio, 1) * 100}%` }} />
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {ratio > 1
              ? `${formatPence(paidPence - dealPence!)} more than the deal value`
              : `${formatPercent(ratio * 100)} of the deal value paid`}
          </p>
        </>
      )}
    </div>
  );
}

function CostGroups({
  job,
  figures,
  distributors,
  onAddCost,
  onEditCost,
  onDeleteCost,
}: {
  job: ProfitJob;
  figures: Figures;
  distributors: DistributorOption[];
  onAddCost: (category: CostCategory, distributorId?: string) => void;
  onEditCost: (line: CostLine) => void;
  onDeleteCost: (line: CostLine) => Promise<string | null>;
}) {
  const active = distributors.filter((d) => d.active);
  const linesFor = (group: (typeof COST_GROUPS)[number]) => job.costs.filter((c) => group.categories.includes(c.category));

  return (
    <section aria-label="Costs" className="space-y-4">
      {COST_GROUPS.map((group) => {
        const lines = linesFor(group);
        const printingMissing = group.id === "printing" && job.printingIncluded && lines.length === 0;
        const quietPrinting = group.id === "printing" && !job.printingIncluded && lines.length === 0;
        return (
          <div key={group.id} className="rounded-lg border border-gray-200">
            <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-3 py-2">
              <h3 className="flex items-center gap-2 text-sm font-bold text-blue-900">
                <span
                  className="inline-block h-3 w-3 rounded-sm"
                  style={{ backgroundColor: GROUP_COLORS[group.id] }}
                  aria-hidden="true"
                />
                {group.label}
              </h3>
              <span className="text-sm font-semibold tabular-nums text-gray-900">{formatPence(figures.groups[group.id])}</span>
            </div>

            {printingMissing && (
              <p className="mx-3 mt-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
                Printing is included in this job. Add what the printing cost.
              </p>
            )}
            {quietPrinting && <p className="px-3 pt-2 text-xs text-gray-500">Printing isn&apos;t included in this job.</p>}

            {lines.length > 0 ? (
              <ul className="divide-y divide-gray-100 px-3">
                {lines.map((line) => (
                  <CostLineRow key={line.id} line={line} onEdit={() => onEditCost(line)} onDelete={() => onDeleteCost(line)} />
                ))}
              </ul>
            ) : (
              !printingMissing && !quietPrinting && <p className="px-3 pt-2 text-xs text-gray-500">No costs added.</p>
            )}

            <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
              {group.id === "distributors" ? (
                <>
                  <AddDistributorSelect
                    label={`Add distributor to ${job.name}`}
                    distributors={active}
                    onPick={(distributorId) => onAddCost("DISTRIBUTOR", distributorId)}
                  />
                  <AddButton onClick={() => onAddCost("FUEL")}>Add fuel</AddButton>
                </>
              ) : (
                <AddButton onClick={() => onAddCost(group.categories[0])}>
                  {group.id === "additional" ? "Add additional cost" : `Add ${group.label.toLowerCase()} cost`}
                </AddButton>
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}

function AddButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100"
    >
      + {children}
    </button>
  );
}

// The keyboard and phone way to add a distributor, alongside drag and drop.
export function AddDistributorSelect({
  label,
  distributors,
  onPick,
  className = "",
}: {
  label: string;
  distributors: DistributorOption[];
  onPick: (distributorId: string) => void;
  className?: string;
}) {
  return (
    <select
      aria-label={label}
      value=""
      onChange={(e) => {
        if (e.target.value) onPick(e.target.value);
      }}
      disabled={distributors.length === 0}
      className={`rounded-md border border-blue-200 bg-blue-50 px-2 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100 disabled:opacity-60 ${className}`}
    >
      <option value="">{distributors.length ? "+ Add distributor" : "No active distributors"}</option>
      {distributors.map((d) => (
        <option key={d.id} value={d.id}>
          {d.name}
        </option>
      ))}
    </select>
  );
}

function CostLineRow({
  line,
  onEdit,
  onDelete,
}: {
  line: CostLine;
  onEdit: () => void;
  onDelete: () => Promise<string | null>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const detail = costLineDetail(line);

  async function remove() {
    setBusy(true);
    const problem = await onDelete();
    setBusy(false);
    if (problem) setConfirming(false);
  }

  return (
    <li className="flex flex-wrap items-start gap-x-3 gap-y-1 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-gray-900 break-words">{costLineTitle(line)}</p>
        {detail && <p className="text-xs text-gray-500">{detail}</p>}
        {line.note && <p className="text-xs italic text-gray-500 break-words">{line.note}</p>}
      </div>
      <span className="text-sm font-medium tabular-nums text-gray-900">{formatPence(line.amountPence)}</span>
      <div className="flex w-full justify-end gap-1 sm:w-auto">
        {confirming ? (
          <>
            <span className="self-center text-xs text-gray-600">Delete?</span>
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="rounded-md bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            >
              {busy ? "Deleting..." : "Yes, delete"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700"
            >
              Keep
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onEdit}
              aria-label={`Edit ${costLineTitle(line)}, ${formatPence(line.amountPence)}`}
              className="rounded-md px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              aria-label={`Delete ${costLineTitle(line)}, ${formatPence(line.amountPence)}`}
              className="rounded-md px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
            >
              Delete
            </button>
          </>
        )}
      </div>
    </li>
  );
}

export type RetainerPayload =
  | { isRetainer: true; monthly: string; startMonth: string; endMonth: string }
  | { isRetainer: false };

// A retainer's monthly amount counts as revenue paid in every month from its
// start to its end (or ongoing), on top of any one-off amount paid on the
// job, which still counts in the month it was won.
function RetainerSection({
  job,
  today,
  onSave,
}: {
  job: ProfitJob;
  today: string;
  onSave: (payload: RetainerPayload) => Promise<string | null>;
}) {
  const id = useId();
  const [editing, setEditing] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);
  const [form, setForm] = useState({ monthly: "", startMonth: "", endMonth: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const wonMonth = job.wonAt ? monthKeyLondon(job.wonAt) : today.slice(0, 7);

  function startEditing() {
    setForm({
      monthly: job.retainerMonthlyPence ? penceToInput(job.retainerMonthlyPence) : "",
      startMonth: job.retainerStart ?? wonMonth,
      endMonth: job.retainerEnd ?? "",
    });
    setError("");
    setConfirmOff(false);
    setEditing(true);
  }

  async function save(payload: RetainerPayload) {
    setSaving(true);
    setError("");
    const problem = await onSave(payload);
    setSaving(false);
    if (problem) {
      setError(problem);
      return;
    }
    setEditing(false);
    setConfirmOff(false);
  }

  const on = job.isRetainer;
  const inputCls =
    "w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <section aria-labelledby={`${id}-title`} className="rounded-lg border border-violet-200 bg-violet-50/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 id={`${id}-title`} className="text-sm font-bold text-blue-900">
          Retainer
        </h3>
        <button
          type="button"
          role="switch"
          aria-checked={on || editing}
          aria-label="Retainer"
          disabled={saving}
          onClick={() => {
            if (editing && !on) setEditing(false);
            else if (on) setConfirmOff(true);
            else startEditing();
          }}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
            on || editing ? "bg-violet-600" : "bg-gray-300"
          }`}
        >
          <span
            aria-hidden="true"
            className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
              on || editing ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      {!on && !editing && (
        <p className="mt-1 text-sm text-gray-600">
          Not a retainer. Turn it on to count a monthly amount as revenue in every month it runs.
        </p>
      )}

      {on && !editing && (
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="text-sm text-gray-800">
            <span className="font-semibold tabular-nums">{formatPence(job.retainerMonthlyPence)}</span> a month from{" "}
            {job.retainerStart ? monthLabel(job.retainerStart) : "-"}
            {job.retainerEnd ? ` to ${monthLabel(job.retainerEnd)}` : ", ongoing"}
          </p>
          {!confirmOff && (
            <button type="button" onClick={startEditing} className="text-xs font-semibold text-blue-700 hover:underline">
              Edit
            </button>
          )}
        </div>
      )}

      {confirmOff && (
        <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <p>
            Turn the retainer off? None of its months will count any more. To stop it from a month on and keep the
            months before, set an end month instead.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => save({ isRetainer: false })}
              disabled={saving}
              className="rounded-md bg-amber-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-800 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Turn off"}
            </button>
            <button
              type="button"
              onClick={startEditing}
              className="rounded-md border border-amber-400 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900"
            >
              Set an end month
            </button>
            <button type="button" onClick={() => setConfirmOff(false)} className="px-2 text-xs font-semibold text-amber-900">
              Keep it
            </button>
          </div>
        </div>
      )}

      {editing && (
        <form
          className="mt-3 grid gap-3 sm:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            save({ isRetainer: true, ...form });
          }}
        >
          <div>
            <label htmlFor={`${id}-monthly`} className="mb-1 block text-xs font-medium text-gray-700">
              Monthly amount (£)
            </label>
            <input
              id={`${id}-monthly`}
              inputMode="decimal"
              value={form.monthly}
              onChange={(e) => setForm((f) => ({ ...f, monthly: e.target.value }))}
              placeholder="250.00"
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor={`${id}-start`} className="mb-1 block text-xs font-medium text-gray-700">
              Starts
            </label>
            <input
              id={`${id}-start`}
              type="month"
              value={form.startMonth}
              onChange={(e) => setForm((f) => ({ ...f, startMonth: e.target.value }))}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor={`${id}-end`} className="mb-1 block text-xs font-medium text-gray-700">
              Ends (optional)
            </label>
            <input
              id={`${id}-end`}
              type="month"
              value={form.endMonth}
              min={form.startMonth || undefined}
              onChange={(e) => setForm((f) => ({ ...f, endMonth: e.target.value }))}
              className={inputCls}
            />
          </div>
          <p className="text-xs text-gray-500 sm:col-span-3">
            Starts on the won month unless you change it. Leave the end empty while it is ongoing; set it when the
            retainer stops, and the months before stay counted.
          </p>
          {error && (
            <p role="alert" className="text-sm text-red-700 sm:col-span-3">
              {error}
            </p>
          )}
          <div className="flex gap-2 sm:col-span-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save retainer"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {error && !editing && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
