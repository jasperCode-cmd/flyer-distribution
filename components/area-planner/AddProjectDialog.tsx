"use client";

import { useEffect, useState } from "react";
import { BUSINESS_NAMES, type Business } from "@/lib/business";
import type { LinkableLead } from "@/lib/area-planner/types";

// "Add project": a map for a Won or Completed job (one per job), or a
// map-only project that can be linked to a job later.

type Props = {
  leads: LinkableLead[];
  busy: boolean;
  error: string | null;
  onCreate: (input: { leadId: string } | { name: string; notes: string; business: Business }) => void;
  onClose: () => void;
};

export default function AddProjectDialog({ leads, busy, error, onCreate, onClose }: Props) {
  const [mode, setMode] = useState<"lead" | "map">(leads.length ? "lead" : "map");
  const [leadId, setLeadId] = useState("");
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [business, setBusiness] = useState<Business>("FDH");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[1500] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ap-add-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full rounded-t-xl bg-white p-5 sm:max-w-md sm:rounded-xl"
      >
        <h2 id="ap-add-title" className="text-base font-bold text-blue-900">
          Add project
        </h2>
        <div className="mt-3 flex gap-4 text-sm">
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={mode === "lead"} onChange={() => setMode("lead")} disabled={leads.length === 0} />
            A Won job
          </label>
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={mode === "map"} onChange={() => setMode("map")} />
            Map only
          </label>
        </div>
        <form
          className="mt-3 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (mode === "lead") {
              if (leadId) onCreate({ leadId });
            } else {
              onCreate({ name, notes, business });
            }
          }}
        >
          {mode === "lead" ? (
            <label className="block text-xs font-semibold text-gray-700">
              Job
              <select value={leadId} onChange={(e) => setLeadId(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm font-normal">
                <option value="">Choose a Won or Completed job</option>
                {leads.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.businessName || l.name} ({l.stage === "COMPLETED" ? "Completed" : "Won"}
                    {l.business === "LDB" ? ", Bournemouth" : ""})
                  </option>
                ))}
              </select>
              {leads.length === 0 && <span className="mt-1 block font-normal text-gray-500">Every Won and Completed job already has a project.</span>}
            </label>
          ) : (
            <>
              <label className="block text-xs font-semibold text-gray-700">
                Name
                <input value={name} maxLength={100} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm font-normal" />
              </label>
              <label className="block text-xs font-semibold text-gray-700">
                Business
                <select value={business} onChange={(e) => setBusiness(e.target.value as Business)} className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm font-normal">
                  <option value="FDH">{BUSINESS_NAMES.FDH}</option>
                  <option value="LDB">{BUSINESS_NAMES.LDB}</option>
                </select>
              </label>
              <label className="block text-xs font-semibold text-gray-700">
                Notes (optional)
                <textarea value={notes} maxLength={1000} rows={2} onChange={(e) => setNotes(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm font-normal" />
              </label>
            </>
          )}
          {error && <p className="text-xs text-red-700">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm">
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || (mode === "lead" ? !leadId : !name.trim())}
              className="rounded-md bg-blue-700 px-3 py-1.5 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-60"
            >
              {busy ? "Adding..." : "Add project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
