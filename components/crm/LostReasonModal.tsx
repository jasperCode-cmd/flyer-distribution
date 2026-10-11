"use client";

import { useEffect, useId, useState } from "react";
import { LOST_REASONS, LOST_REASON_LABELS } from "@/lib/crm-constants";

// Asks why a lead was lost. The Priorities page's bulk Mark as Lost passes a
// title, a summary (how many and who) and its own button wording; everywhere
// else it looks as it always has.
export default function LostReasonModal({
  open,
  onCancel,
  onConfirm,
  title = "Why was this lead lost?",
  summary,
  confirmLabel = "Confirm Lost",
  busy = false,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: (reason: string, note: string) => void;
  title?: string;
  summary?: React.ReactNode;
  confirmLabel?: string;
  busy?: boolean;
}) {
  const [reason, setReason] = useState("PRICE");
  const [note, setNote] = useState("");
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  function handleConfirm() {
    onConfirm(reason, reason === "OTHER" ? note.trim() : "");
    setReason("PRICE");
    setNote("");
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full sm:max-w-md rounded-t-xl sm:rounded-xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
      >
        <h3 id={titleId} className="text-sm font-bold text-blue-900 mb-1">{title}</h3>
        {summary}
        <p className="text-xs text-gray-500 mb-3">This helps track patterns over time.</p>

        <label htmlFor={`${titleId}-reason`} className="sr-only">
          Lost reason
        </label>
        <select
          id={`${titleId}-reason`}
          autoFocus
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm bg-white"
        >
          {LOST_REASONS.map((r) => (
            <option key={r} value={r}>{LOST_REASON_LABELS[r]}</option>
          ))}
        </select>

        {reason === "OTHER" && (
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Briefly describe why..."
            rows={2}
            autoFocus
            className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm mt-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        )}

        <div className="flex gap-2 mt-4">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 border border-gray-300 text-gray-700 text-sm font-medium py-2.5 rounded-md"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            className="flex-1 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-bold py-2.5 rounded-md"
          >
            {busy ? "Saving..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
