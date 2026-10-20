"use client";

import { useEffect, useState } from "react";
import { formatPence, penceToInput } from "@/lib/money";
import { areaName, areaPayPence } from "@/lib/area-planner/costs";
import { homesText } from "@/lib/area-planner/summary";
import { formatArea, areaM2, MAX_RADIUS_M, MIN_RADIUS_M } from "@/lib/area-planner/geometry";
import { AREA_STATUSES, AREA_STATUS_LABELS, type AreaStatus, type PlannerArea, type PlannerDistributor } from "@/lib/area-planner/types";
import type { PayType } from "@/lib/profit";

// Editing the selected area: its distributor, leaflets, label, status and
// pay, a circle's radius, and the shape itself (drag on the map). Saving
// keeps its Profit cost line in step. Changes show at once and save in the
// background, so nothing here waits for the server.

export type AreaFormValues = {
  distributorId: string;
  leafletCount: string;
  label: string;
  status: AreaStatus;
  payType: "" | PayType;
  rate: string;
  amount: string;
};

type Props = {
  area: PlannerArea;
  distributors: PlannerDistributor[];
  linked: boolean;
  readOnly: boolean;
  editingShape: boolean;
  // Its homes are being worked out again after a shape change.
  estimating: boolean;
  onSave: (values: AreaFormValues) => void;
  onRadius: (radiusM: number) => void;
  onToggleShapeEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
};

function initialValues(area: PlannerArea): AreaFormValues {
  return {
    distributorId: area.distributorId ?? "",
    leafletCount: area.leafletCount ? String(area.leafletCount) : "",
    label: area.label ?? "",
    status: area.status,
    payType: area.payType ?? "",
    rate: penceToInput(area.ratePence),
    amount: penceToInput(area.amountPence),
  };
}

const KIND_LABELS = { CIRCLE: "Circle", RECTANGLE: "Rectangle", POLYGON: "Drawn shape", POSTCODE: "Postcode shape" } as const;

export default function AreaPanel(props: Props) {
  const { area, distributors, linked, readOnly } = props;
  const [values, setValues] = useState(() => initialValues(area));
  const [radius, setRadius] = useState(area.radiusM ? String(area.radiusM) : "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Refilled only when this area's saved values change (after a save, or a
  // shape edit), so typing isn't lost when something else on the map saves.
  // A different area gets a fresh panel (it is keyed by area).
  const saved = JSON.stringify([initialValues(area), area.radiusM]);
  useEffect(() => {
    const [fresh, radiusM] = JSON.parse(saved) as [AreaFormValues, number | null];
    setValues(fresh);
    setRadius(radiusM ? String(radiusM) : "");
    setConfirmDelete(false);
  }, [saved]);

  const set = <K extends keyof AreaFormValues>(key: K, value: AreaFormValues[K]) => setValues((v) => ({ ...v, [key]: value }));
  const choosable = distributors.filter((d) => d.active || d.id === area.distributorId);
  const pay = areaPayPence(area);
  const costNote = !area.distributorId
    ? "No distributor yet, so no cost line."
    : pay === null || !area.leafletCount
      ? "Pay not set, so no cost line yet."
      : linked
        ? `Profit: a distributor cost of ${formatPence(pay)} on this job.`
        : `Pay of ${formatPence(pay)} held until the project is linked to a Won job.`;

  return (
    <section aria-label={`Area: ${areaName(area)}`} className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-bold text-blue-900">{areaName(area)}</h2>
          <p className="text-xs text-gray-500">
            {KIND_LABELS[area.kind]}, {formatArea(areaM2(area.geometry))}, {props.estimating ? "working out the homes..." : homesText(area.households)}
          </p>
        </div>
        <button type="button" onClick={props.onClose} className="text-xs font-semibold text-gray-500 hover:text-gray-800">
          Close
        </button>
      </div>

      <form
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          props.onSave(values);
        }}
      >
        <label className="text-xs font-semibold text-gray-700">
          Distributor
          <select
            value={values.distributorId}
            disabled={readOnly}
            onChange={(e) => set("distributorId", e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm font-normal"
          >
            <option value="">Unassigned</option>
            {choosable.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
                {d.active ? "" : " (inactive)"}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-gray-700">
          Leaflets
          <input
            inputMode="numeric"
            value={values.leafletCount}
            disabled={readOnly}
            onChange={(e) => set("leafletCount", e.target.value)}
            placeholder="For example 1200"
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm font-normal"
          />
        </label>
        <label className="text-xs font-semibold text-gray-700">
          Label (optional)
          <input
            value={values.label}
            disabled={readOnly}
            maxLength={60}
            onChange={(e) => set("label", e.target.value)}
            placeholder={area.postcode ?? "For example Southbourne north"}
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm font-normal"
          />
        </label>
        <label className="text-xs font-semibold text-gray-700">
          Status
          <select
            value={values.status}
            disabled={readOnly}
            onChange={(e) => set("status", e.target.value as AreaStatus)}
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm font-normal"
          >
            {AREA_STATUSES.map((s) => (
              <option key={s} value={s}>
                {AREA_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="sm:col-span-2" disabled={readOnly}>
          <legend className="text-xs font-semibold text-gray-700">Pay for this area</legend>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {(
              [
                ["", "Not set"],
                ["PER_THOUSAND", "Rate per 1,000"],
                ["FLAT", "Set amount"],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="flex items-center gap-1.5">
                <input type="radio" name="ap-pay" checked={values.payType === value} onChange={() => set("payType", value)} />
                {label}
              </label>
            ))}
          </div>
          {values.payType === "PER_THOUSAND" && (
            <label className="mt-2 block text-xs text-gray-700">
              Rate per 1,000 leaflets (£)
              <input
                inputMode="decimal"
                value={values.rate}
                onChange={(e) => set("rate", e.target.value)}
                placeholder="45"
                className="mt-1 w-40 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
            </label>
          )}
          {values.payType === "FLAT" && (
            <label className="mt-2 block text-xs text-gray-700">
              Set amount (£)
              <input
                inputMode="decimal"
                value={values.amount}
                onChange={(e) => set("amount", e.target.value)}
                placeholder="120"
                className="mt-1 w-40 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
            </label>
          )}
          <p className="mt-2 text-xs text-gray-600">{costNote}</p>
        </fieldset>

        {!readOnly && (
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
            <button type="submit" className="rounded-md bg-blue-700 px-3 py-1.5 text-sm font-bold text-white hover:bg-blue-800">
              Save area
            </button>
          </div>
        )}
      </form>

      {!readOnly && (
        <div className="mt-4 space-y-3 border-t border-gray-100 pt-3">
          {area.kind === "CIRCLE" && (
            <form
              className="flex flex-wrap items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const r = Number(radius);
                if (Number.isFinite(r)) props.onRadius(Math.round(r));
              }}
            >
              <label className="text-xs font-semibold text-gray-700">
                Radius (metres)
                <input
                  type="number"
                  min={MIN_RADIUS_M}
                  max={MAX_RADIUS_M}
                  step={50}
                  value={radius}
                  onChange={(e) => setRadius(e.target.value)}
                  className="mt-1 block w-32 rounded-md border border-gray-300 px-2 py-1.5 text-sm font-normal"
                />
              </label>
              <button type="submit" className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-800 hover:bg-gray-50">
                Set radius
              </button>
            </form>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={props.onToggleShapeEdit}
              aria-pressed={props.editingShape}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            >
              {props.editingShape ? "Done editing shape" : "Edit or move shape"}
            </button>
            {confirmDelete ? (
              <>
                <span className="text-xs text-gray-700">Delete this area{area.hasCostLine ? " and its Profit cost line" : ""}?</span>
                <button type="button" onClick={props.onDelete} className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-bold text-white hover:bg-red-700">
                  Yes, delete
                </button>
                <button type="button" onClick={() => setConfirmDelete(false)} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm">
                  Keep
                </button>
              </>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)} className="rounded-md px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50">
                Delete area
              </button>
            )}
          </div>
          {props.editingShape && (
            <p className="text-xs text-gray-600">
              Drag the handles on the map to reshape it, or drag the shape to move it. Changes save as you go.
              {area.kind === "POSTCODE" ? " Once edited, this postcode shape becomes an ordinary drawn shape." : ""}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
