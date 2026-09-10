"use client";

import { useState } from "react";

export default function DeleteLeadModal({
  open,
  leadName,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  leadName: string;
  onCancel: () => void;
  onConfirm: () => Promise<string | null>; // resolves with an error message, or null on success
}) {
  const [typedName, setTypedName] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const canDelete = typedName === leadName && !deleting;

  function handleCancel() {
    setTypedName("");
    setError(null);
    onCancel();
  }

  async function handleConfirm() {
    if (!canDelete) return;
    setDeleting(true);
    setError(null);
    const err = await onConfirm();
    if (err) {
      setError(err);
      setDeleting(false);
    }
    // On success the caller navigates away, so no need to reset state here.
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={handleCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full sm:max-w-md rounded-t-xl sm:rounded-xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
      >
        <h3 className="text-sm font-bold text-red-700 mb-1">Delete this lead?</h3>
        <p className="text-xs text-gray-500 mb-3">
          This permanently deletes <span className="font-semibold text-gray-700">{leadName}</span> and
          all of its activity, follow-ups, and tags. This cannot be undone.
        </p>

        <label className="block text-xs font-medium text-gray-500 mb-1">
          Type <span className="font-semibold text-gray-700">{leadName}</span> to confirm
        </label>
        <input
          type="text"
          value={typedName}
          onChange={(e) => setTypedName(e.target.value)}
          autoFocus
          className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
        />

        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

        <div className="flex gap-2 mt-4">
          <button
            type="button"
            onClick={handleCancel}
            className="flex-1 border border-gray-300 text-gray-700 text-sm font-medium py-2.5 rounded-md"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canDelete}
            className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:hover:bg-red-600 text-white text-sm font-bold py-2.5 rounded-md"
          >
            {deleting ? "Deleting..." : "Delete Lead"}
          </button>
        </div>
      </div>
    </div>
  );
}
