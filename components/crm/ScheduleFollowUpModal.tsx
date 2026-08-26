"use client";

import { useState } from "react";

export default function ScheduleFollowUpModal({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (description: string, dueDate: string) => Promise<void>;
}) {
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  async function handleSave() {
    if (!description.trim() || !dueDate) return;
    setSaving(true);
    await onSave(description.trim(), dueDate);
    setSaving(false);
    setDescription("");
    onClose();
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full sm:max-w-md rounded-t-xl sm:rounded-xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
      >
        <h3 className="text-sm font-bold text-blue-900 mb-3">Schedule Follow-up</h3>

        <label className="block text-xs font-medium text-gray-500 mb-1">What needs doing?</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          autoFocus
          placeholder="e.g. Call to confirm campaign start date"
          className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <label className="block text-xs font-medium text-gray-500 mb-1 mt-3">Due date</label>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm"
        />

        <div className="flex gap-2 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 border border-gray-300 text-gray-700 text-sm font-medium py-2.5 rounded-md"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !description.trim() || !dueDate}
            className="flex-1 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-bold py-2.5 rounded-md"
          >
            {saving ? "Saving..." : "Schedule"}
          </button>
        </div>
      </div>
    </div>
  );
}
