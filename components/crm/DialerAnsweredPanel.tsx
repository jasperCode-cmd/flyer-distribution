"use client";

import { useState } from "react";
import { SCRAP_REASONS, SCRAP_REASON_LABELS, CALLBACK_PRESETS } from "@/lib/crm-constants";

type Outcome = "WARM" | "CALL_BACK" | "SCRAP";

// The three outcomes for an answered call, all reached from one panel so
// switching between them (a wrong tap) doesn't lose anything already typed
// in the quick-entry fields, which Warm and Call Back share.
export default function DialerAnsweredPanel({
  leadId,
  onSaved,
  onCancel,
}: {
  leadId: string;
  onSaved: (outcome: Outcome) => void;
  onCancel: () => void;
}) {
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [saving, setSaving] = useState(false);

  // Quick-entry fields, shared by Warm and Call Back.
  const [notes, setNotes] = useState("");
  const [dealValue, setDealValue] = useState("");
  const [leafletQuantity, setLeafletQuantity] = useState("");
  const [targetAreas, setTargetAreas] = useState("");
  const [campaignStartDate, setCampaignStartDate] = useState("");
  const [printingIncluded, setPrintingIncluded] = useState(false);
  const [designIncluded, setDesignIncluded] = useState(false);

  // Call Back specific.
  const [callbackPreset, setCallbackPreset] = useState<string | null>(null);
  const [customDateTime, setCustomDateTime] = useState("");

  // Scrap specific.
  const [scrapReason, setScrapReason] = useState<string | null>(null);
  const [scrapNote, setScrapNote] = useState("");

  function quickEntryBody() {
    return {
      notes,
      dealValue,
      leafletQuantity,
      targetAreas,
      campaignStartDate,
      printingIncluded,
      designIncluded,
    };
  }

  function computeCallbackAt(): Date | null {
    if (callbackPreset === "PICK_A_DATE") {
      if (!customDateTime) return null;
      const d = new Date(customDateTime);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    const preset = CALLBACK_PRESETS.find((p) => p.key === callbackPreset);
    if (!preset) return null;
    return new Date(Date.now() + preset.days * 24 * 60 * 60 * 1000);
  }

  async function save(body: Record<string, unknown>, savedOutcome: Outcome) {
    setSaving(true);
    const res = await fetch(`/api/crm/dialer/leads/${leadId}/outcome`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (res.ok) onSaved(savedOutcome);
  }

  function saveWarm() {
    save({ outcome: "WARM", ...quickEntryBody() }, "WARM");
  }

  function saveCallBack() {
    const callbackAt = computeCallbackAt();
    if (!callbackAt) return;
    save({ outcome: "CALL_BACK", callbackAt: callbackAt.toISOString(), ...quickEntryBody() }, "CALL_BACK");
  }

  function saveScrap(reason: string) {
    if (reason === "OTHER" && !scrapNote.trim()) return;
    save({ outcome: "SCRAP", reason, note: scrapNote.trim() }, "SCRAP");
  }

  const canSaveCallBack = computeCallbackAt() !== null && !saving;

  const inputCls =
    "w-full border border-gray-300 rounded-md px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  const labelCls = "block text-[11px] font-medium text-gray-500 mb-1";

  const quickEntryFields = (
    <div className="space-y-2.5">
      <div>
        <label className={labelCls}>Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className={`${inputCls} resize-none`}
          placeholder="What was said..."
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelCls}>Deal Value (£)</label>
          <input type="number" step="0.01" min="0" value={dealValue} onChange={(e) => setDealValue(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Leaflet Qty</label>
          <input type="text" value={leafletQuantity} onChange={(e) => setLeafletQuantity(e.target.value)} className={inputCls} />
        </div>
      </div>
      <div>
        <label className={labelCls}>Target Area(s) / Postcodes</label>
        <input type="text" value={targetAreas} onChange={(e) => setTargetAreas(e.target.value)} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Campaign Start Date</label>
        <input type="date" value={campaignStartDate} onChange={(e) => setCampaignStartDate(e.target.value)} className={inputCls} />
      </div>
      <div className="flex gap-4">
        <label className="flex items-center gap-1.5 text-xs text-gray-700">
          <input type="checkbox" checked={printingIncluded} onChange={(e) => setPrintingIncluded(e.target.checked)} className="h-3.5 w-3.5" />
          Printing included
        </label>
        <label className="flex items-center gap-1.5 text-xs text-gray-700">
          <input type="checkbox" checked={designIncluded} onChange={(e) => setDesignIncluded(e.target.checked)} className="h-3.5 w-3.5" />
          Design included
        </label>
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-blue-900">
          {outcome === null ? "How did it go?" : outcome === "WARM" ? "Warm / Awaiting Response" : outcome === "CALL_BACK" ? "Call Back" : "Scrap Lead"}
        </h3>
        <button
          type="button"
          onClick={outcome === null ? onCancel : () => setOutcome(null)}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          {outcome === null ? "Cancel" : "← Back"}
        </button>
      </div>

      {outcome === null && (
        <div className="grid grid-cols-1 gap-2">
          <button type="button" onClick={() => setOutcome("WARM")} className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-sm font-bold py-2.5 rounded-md">
            Warm / Awaiting Response
          </button>
          <button type="button" onClick={() => setOutcome("CALL_BACK")} className="bg-amber-50 hover:bg-amber-100 text-amber-800 text-sm font-bold py-2.5 rounded-md">
            Call Back
          </button>
          <button type="button" onClick={() => setOutcome("SCRAP")} className="bg-red-50 hover:bg-red-100 text-red-700 text-sm font-bold py-2.5 rounded-md">
            Scrap
          </button>
        </div>
      )}

      {outcome === "WARM" && (
        <div className="space-y-3">
          {quickEntryFields}
          <button
            type="button"
            onClick={saveWarm}
            disabled={saving}
            className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-bold py-2.5 rounded-md"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      )}

      {outcome === "CALL_BACK" && (
        <div className="space-y-3">
          <div>
            <label className={labelCls}>When?</label>
            <div className="grid grid-cols-2 gap-1.5">
              {CALLBACK_PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setCallbackPreset(p.key)}
                  className={`text-xs font-semibold py-2 rounded-md border ${
                    callbackPreset === p.key ? "bg-blue-700 text-white border-blue-700" : "bg-white text-gray-700 border-gray-300"
                  }`}
                >
                  {p.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCallbackPreset("PICK_A_DATE")}
                className={`text-xs font-semibold py-2 rounded-md border ${
                  callbackPreset === "PICK_A_DATE" ? "bg-blue-700 text-white border-blue-700" : "bg-white text-gray-700 border-gray-300"
                }`}
              >
                Pick a Date
              </button>
            </div>
            {callbackPreset === "PICK_A_DATE" && (
              <input
                type="datetime-local"
                value={customDateTime}
                onChange={(e) => setCustomDateTime(e.target.value)}
                className={`${inputCls} mt-2`}
              />
            )}
          </div>
          {quickEntryFields}
          <button
            type="button"
            onClick={saveCallBack}
            disabled={!canSaveCallBack}
            className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-40 text-white text-sm font-bold py-2.5 rounded-md"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      )}

      {outcome === "SCRAP" && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-1.5">
            {SCRAP_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => (r === "OTHER" ? setScrapReason("OTHER") : saveScrap(r))}
                disabled={saving}
                className={`text-left text-sm font-medium px-3 py-2 rounded-md border ${
                  scrapReason === r ? "border-red-400 bg-red-50 text-red-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
              >
                {SCRAP_REASON_LABELS[r]}
              </button>
            ))}
          </div>
          {scrapReason === "OTHER" && (
            <div>
              <label className={labelCls}>Reason (required)</label>
              <textarea
                value={scrapNote}
                onChange={(e) => setScrapNote(e.target.value)}
                rows={2}
                autoFocus
                className={`${inputCls} resize-none`}
              />
              <button
                type="button"
                onClick={() => saveScrap("OTHER")}
                disabled={!scrapNote.trim() || saving}
                className="w-full mt-2 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white text-sm font-bold py-2.5 rounded-md"
              >
                {saving ? "Saving..." : "Scrap Lead"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
