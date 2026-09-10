"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SCRAP_REASON_LABELS } from "@/lib/crm-constants";

type ScrappedLead = {
  id: string;
  name: string;
  businessName: string | null;
  scrapReason: string | null;
  scrapNote: string | null;
  scrappedAt: string | null;
  noAnswerStreak: number;
};

const CLEAR_BIN_PHRASE = "DELETE ALL SCRAPPED LEADS";

function reasonBadge(lead: ScrappedLead) {
  if (!lead.scrapReason) return "—";
  if (lead.scrapReason === "NO_ANSWER") return `No Answer (${lead.noAnswerStreak} calls)`;
  if (lead.scrapReason === "OTHER") return lead.scrapNote || "Other";
  return SCRAP_REASON_LABELS[lead.scrapReason] ?? lead.scrapReason;
}

const BADGE_COLOR: Record<string, string> = {
  NOT_INTERESTED: "bg-gray-100 text-gray-600",
  WRONG_NUMBER: "bg-gray-100 text-gray-600",
  ALREADY_CUSTOMER: "bg-blue-50 text-blue-700",
  ASKED_NOT_TO_CONTACT: "bg-red-50 text-red-700",
  NO_ANSWER: "bg-amber-50 text-amber-700",
  OTHER: "bg-gray-100 text-gray-600",
};

export default function ScrappedLeadsView({ leads }: { leads: ScrappedLead[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [askedNotToContactWarning, setAskedNotToContactWarning] = useState<string[] | null>(null);
  const [clearBinOpen, setClearBinOpen] = useState(false);
  const [clearBinPhrase, setClearBinPhrase] = useState("");
  const [lastResult, setLastResult] = useState<string | null>(null);

  const selectedCount = selected.size;
  const allSelected = leads.length > 0 && selectedCount === leads.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(leads.map((l) => l.id)));
  }

  async function recoverIds(ids: string[]) {
    if (ids.length === 0) return;
    setBusy(true);
    await fetch("/api/crm/leads/recover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    setBusy(false);
    setSelected(new Set());
    router.refresh();
  }

  function recoverSelected() {
    const ids = Array.from(selected);
    const asked = leads.filter((l) => ids.includes(l.id) && l.scrapReason === "ASKED_NOT_TO_CONTACT");
    if (asked.length > 0) {
      setAskedNotToContactWarning(ids);
      return;
    }
    recoverIds(ids);
  }

  function recoverAll() {
    // Deliberately excludes ASKED_NOT_TO_CONTACT — a real opt-out request,
    // never swept back in by a bulk action.
    const ids = leads.filter((l) => l.scrapReason !== "ASKED_NOT_TO_CONTACT").map((l) => l.id);
    recoverIds(ids);
  }

  async function deleteIds(ids: string[]) {
    if (ids.length === 0) return;
    setBusy(true);
    const res = await fetch("/api/crm/leads/bulk", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    setBusy(false);
    if (res.ok) {
      const { deleted, blocked } = await res.json();
      if (blocked.length > 0) {
        setLastResult(
          `Deleted ${deleted}. ${blocked.length} couldn't be deleted (has a Job on record): ${blocked
            .map((b: { name: string }) => b.name)
            .join(", ")}`
        );
      } else {
        setLastResult(null);
      }
    }
    setSelected(new Set());
    router.refresh();
  }

  function deleteSelected() {
    deleteIds(Array.from(selected));
  }

  function confirmClearBin() {
    setClearBinOpen(false);
    setClearBinPhrase("");
    deleteIds(leads.map((l) => l.id));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold text-blue-900">Scrapped Leads</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={recoverAll}
            disabled={busy || leads.length === 0}
            className="text-xs font-semibold text-blue-700 hover:underline disabled:opacity-40"
          >
            Recover All
          </button>
          <button
            type="button"
            onClick={() => setClearBinOpen(true)}
            disabled={leads.length === 0}
            className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-40"
          >
            Clear Bin
          </button>
        </div>
      </div>

      {lastResult && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-md px-3 py-2">
          {lastResult}
        </div>
      )}

      {selectedCount > 0 && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-md px-3 py-2">
          <span className="text-xs font-semibold text-blue-800">{selectedCount} selected</span>
          <button
            type="button"
            onClick={recoverSelected}
            disabled={busy}
            className="text-xs font-bold text-blue-700 bg-white border border-blue-300 rounded-md px-3 py-1.5 hover:bg-blue-50"
          >
            Recover selected
          </button>
          <button
            type="button"
            onClick={deleteSelected}
            disabled={busy}
            className="text-xs font-bold text-red-600 bg-white border border-red-300 rounded-md px-3 py-1.5 hover:bg-red-50"
          >
            Delete selected
          </button>
          <button type="button" onClick={() => setSelected(new Set())} className="ml-auto text-xs text-gray-500 hover:underline">
            Clear selection
          </button>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        {leads.length === 0 ? (
          <p className="px-4 py-8 text-sm text-gray-400 text-center">The bin is empty.</p>
        ) : (
          <table className="w-full min-w-[600px]">
            <thead className="border-b border-gray-200">
              <tr>
                <th className="px-3 py-2 w-8">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-3.5 w-3.5" />
                </th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Business</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Reason</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Scrapped</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {leads.map((l) => (
                <tr key={l.id}>
                  <td className="px-3 py-2.5">
                    <input type="checkbox" checked={selected.has(l.id)} onChange={() => toggle(l.id)} className="h-3.5 w-3.5" />
                  </td>
                  <td className="px-3 py-2.5 text-sm">
                    <Link href={`/admin/crm/leads/${l.id}`} className="font-medium text-blue-900 hover:underline">
                      {l.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-sm text-gray-600">{l.businessName || "—"}</td>
                  <td className="px-3 py-2.5">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${BADGE_COLOR[l.scrapReason ?? ""] ?? "bg-gray-100 text-gray-600"}`}>
                      {reasonBadge(l)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-sm text-gray-500">
                    {l.scrappedAt ? new Date(l.scrappedAt).toLocaleDateString("en-GB") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {askedNotToContactWarning && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-sm rounded-t-xl sm:rounded-xl p-5">
            <h3 className="text-sm font-bold text-red-700 mb-1">This includes an opt-out request</h3>
            <p className="text-xs text-gray-500 mb-4">
              At least one selected lead asked not to be contacted. Recovering it means they may be called again.
              Are you sure?
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAskedNotToContactWarning(null)}
                className="flex-1 border border-gray-300 text-gray-700 text-sm font-medium py-2.5 rounded-md"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const ids = askedNotToContactWarning;
                  setAskedNotToContactWarning(null);
                  recoverIds(ids);
                }}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-bold py-2.5 rounded-md"
              >
                Recover Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {clearBinOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setClearBinOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-white w-full sm:max-w-md rounded-t-xl sm:rounded-xl p-5">
            <h3 className="text-sm font-bold text-red-700 mb-1">Clear the entire bin?</h3>
            <p className="text-xs text-gray-500 mb-3">
              This permanently deletes all {leads.length} scrapped lead{leads.length === 1 ? "" : "s"}. This cannot be undone.
            </p>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Type <span className="font-semibold text-gray-700">{CLEAR_BIN_PHRASE}</span> to confirm
            </label>
            <input
              type="text"
              value={clearBinPhrase}
              onChange={(e) => setClearBinPhrase(e.target.value)}
              autoFocus
              className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={() => setClearBinOpen(false)}
                className="flex-1 border border-gray-300 text-gray-700 text-sm font-medium py-2.5 rounded-md"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmClearBin}
                disabled={clearBinPhrase !== CLEAR_BIN_PHRASE}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white text-sm font-bold py-2.5 rounded-md"
              >
                Clear Bin
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
