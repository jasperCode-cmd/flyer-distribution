"use client";

import { useEffect, useId, useRef, useState } from "react";
import { formatPence, parsePoundsToPence, penceToInput } from "@/lib/money";
import {
  leafletCountFromQuantity,
  perThousandAmountPence,
  type CostCategory,
  type CostLine,
  type PayType,
} from "@/lib/profit";
import { trapTab, type DistributorOption } from "./profit-ui";

export type CostFormTarget = {
  leadId: string;
  jobName: string;
  leafletQuantity: string | null;
  category: CostCategory;
  // Set when editing an existing line.
  line?: CostLine;
  // Preset when a distributor was dropped on the job or picked from its select.
  distributorId?: string;
};

export type CostPayload = {
  category: CostCategory;
  distributorId: string;
  payType: PayType | "";
  amount: string;
  rate: string;
  leafletCount: string;
  label: string;
  note: string;
};

const TITLES: Record<CostCategory, string> = {
  DISTRIBUTOR: "Distributor pay",
  FUEL: "Fuel",
  PRINTING: "Printing cost",
  DESIGN: "Design cost",
  ADDITIONAL: "Additional cost",
};

const inputCls =
  "w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500";

export default function ProfitCostForm({
  target,
  distributors,
  onCancel,
  onSave,
}: {
  target: CostFormTarget;
  distributors: DistributorOption[];
  onCancel: () => void;
  onSave: (payload: CostPayload) => Promise<string | null>;
}) {
  const id = useId();
  const { line, category } = target;
  const prefill = leafletCountFromQuantity(target.leafletQuantity);
  const [form, setForm] = useState<CostPayload>(() => ({
    category,
    distributorId: line ? line.distributorId ?? "" : target.distributorId ?? "",
    payType: line?.payType ?? (category === "DISTRIBUTOR" ? "PER_THOUSAND" : ""),
    amount: line && line.payType !== "PER_THOUSAND" ? penceToInput(line.amountPence) : "",
    rate: line?.ratePence != null ? penceToInput(line.ratePence) : "",
    leafletCount: line?.leafletCount != null ? String(line.leafletCount) : prefill !== null ? String(prefill) : "",
    label: line?.label ?? "",
    note: line?.note ?? "",
  }));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Active distributors, plus the line's own one if it has since been made
  // inactive, so editing never silently swaps it.
  const options = distributors.filter((d) => d.active || d.id === form.distributorId);
  const lineDistributorDeleted = !!line && line.distributorId === null && category === "DISTRIBUTOR";

  useEffect(() => {
    const returnTo = document.activeElement as HTMLElement | null;
    const first = dialogRef.current?.querySelector<HTMLElement>("select, input, textarea");
    first?.focus();
    return () => returnTo?.focus?.();
  }, []);

  function set<K extends keyof CostPayload>(key: K, value: CostPayload[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const problem = await onSave(form);
    setSaving(false);
    if (problem) setError(problem);
  }

  // What a per-1,000 line comes to, shown as they type. The server works it
  // out again itself from the same two numbers.
  const ratePence = parsePoundsToPence(form.rate);
  const count = /^\d+$/.test(form.leafletCount.replace(/,/g, "")) ? Number(form.leafletCount.replace(/,/g, "")) : null;
  const comesTo = ratePence !== null && count !== null && count > 0 ? perThousandAmountPence(ratePence, count) : null;

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/40 flex items-end sm:items-center justify-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            onCancel();
          }
          trapTab(e, dialogRef.current);
        }}
        className="bg-white w-full sm:max-w-md rounded-t-xl sm:rounded-xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] max-h-[92dvh] overflow-y-auto"
      >
        <h3 id={`${id}-title`} className="text-sm font-bold text-blue-900">
          {line ? "Edit" : "Add"} {TITLES[category].toLowerCase()}
        </h3>
        <p className="text-xs text-gray-500 mb-3 truncate">{target.jobName}</p>

        <form onSubmit={submit} className="space-y-3" noValidate>
          {(category === "DISTRIBUTOR" || category === "FUEL") && (
            <div>
              <label htmlFor={`${id}-dist`} className="block text-xs font-medium text-gray-700 mb-1">
                Distributor{category === "FUEL" ? " (optional)" : ""}
              </label>
              <select
                id={`${id}-dist`}
                value={form.distributorId}
                onChange={(e) => set("distributorId", e.target.value)}
                className={inputCls}
              >
                <option value="">
                  {category === "FUEL" ? "No distributor" : lineDistributorDeleted ? "Deleted distributor" : "Choose a distributor"}
                </option>
                {options.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                    {d.active ? "" : " (inactive)"}
                  </option>
                ))}
              </select>
            </div>
          )}

          {category === "DISTRIBUTOR" && (
            <fieldset>
              <legend className="block text-xs font-medium text-gray-700 mb-1">How they are paid</legend>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ["PER_THOUSAND", "Rate per 1,000"],
                    ["FLAT", "Set amount"],
                  ] as const
                ).map(([value, text]) => (
                  <label
                    key={value}
                    className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer ${
                      form.payType === value ? "border-blue-600 bg-blue-50 text-blue-900" : "border-gray-300 text-gray-700"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`${id}-pay`}
                      value={value}
                      checked={form.payType === value}
                      onChange={() => set("payType", value)}
                      className="accent-blue-700"
                    />
                    {text}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {category === "DISTRIBUTOR" && form.payType === "PER_THOUSAND" ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor={`${id}-rate`} className="block text-xs font-medium text-gray-700 mb-1">
                    Rate per 1,000 (£)
                  </label>
                  <input
                    id={`${id}-rate`}
                    inputMode="decimal"
                    value={form.rate}
                    onChange={(e) => set("rate", e.target.value)}
                    placeholder="45.00"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor={`${id}-count`} className="block text-xs font-medium text-gray-700 mb-1">
                    Leaflets
                  </label>
                  <input
                    id={`${id}-count`}
                    inputMode="numeric"
                    value={form.leafletCount}
                    onChange={(e) => set("leafletCount", e.target.value)}
                    placeholder="5000"
                    className={inputCls}
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500">
                {target.leafletQuantity
                  ? prefill !== null && !line
                    ? `Leaflets filled in from the lead's quantity (${target.leafletQuantity}).`
                    : `Lead's quantity: ${target.leafletQuantity}`
                  : "The lead has no leaflet quantity."}
              </p>
              <p className="text-sm text-gray-900" aria-live="polite">
                Comes to <span className="font-semibold tabular-nums">{formatPence(comesTo)}</span>
              </p>
            </>
          ) : (
            <div>
              <label htmlFor={`${id}-amount`} className="block text-xs font-medium text-gray-700 mb-1">
                Amount (£)
              </label>
              <input
                id={`${id}-amount`}
                inputMode="decimal"
                value={form.amount}
                onChange={(e) => set("amount", e.target.value)}
                placeholder="120.00"
                className={inputCls}
              />
            </div>
          )}

          {(category === "PRINTING" || category === "DESIGN" || category === "ADDITIONAL") && (
            <div>
              <label htmlFor={`${id}-label`} className="block text-xs font-medium text-gray-700 mb-1">
                Label{category === "ADDITIONAL" ? "" : " (optional)"}
              </label>
              <input
                id={`${id}-label`}
                value={form.label}
                maxLength={100}
                onChange={(e) => set("label", e.target.value)}
                placeholder={
                  category === "ADDITIONAL" ? "Parking" : category === "PRINTING" ? "5,000 A5 leaflets" : "Leaflet design"
                }
                className={inputCls}
              />
            </div>
          )}

          <div>
            <label htmlFor={`${id}-note`} className="block text-xs font-medium text-gray-700 mb-1">
              Note (optional)
            </label>
            <textarea
              id={`${id}-note`}
              value={form.note}
              maxLength={500}
              rows={2}
              onChange={(e) => set("note", e.target.value)}
              className={`${inputCls} resize-none`}
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 border border-gray-300 text-gray-700 text-sm font-medium py-2.5 rounded-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-bold py-2.5 rounded-md"
            >
              {saving ? "Saving..." : line ? "Save" : category === "DISTRIBUTOR" ? "Add distributor" : "Add cost"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
