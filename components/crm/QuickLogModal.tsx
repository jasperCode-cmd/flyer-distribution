"use client";

import { useState, useEffect } from "react";

export default function QuickLogModal({
  open,
  onClose,
  onSave,
  defaultText,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (detail: string) => Promise<void>;
  defaultText: string;
}) {
  const [text, setText] = useState(defaultText);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setText(defaultText);
  }, [open, defaultText]);

  if (!open) return null;

  async function handleSave() {
    setSaving(true);
    await onSave(text);
    setSaving(false);
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
        <h3 className="text-sm font-bold text-blue-900 mb-3">Log this activity</h3>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          autoFocus
          className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
        />
        <div className="flex gap-2 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 border border-gray-300 text-gray-700 text-sm font-medium py-2.5 rounded-md"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !text.trim()}
            className="flex-1 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-bold py-2.5 rounded-md"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
