"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { SOURCE_LABELS } from "@/lib/crm-constants";
import DialerAnsweredPanel from "./DialerAnsweredPanel";

type LastCall = { createdAt: string; user: { name: string } | null };

export type DialerLead = {
  id: string;
  name: string;
  businessName: string | null;
  phone: string | null;
  source: string;
  addressArea: string | null;
  targetAreas: string | null;
  postcode: string | null;
  dealValue: string | null;
  noAnswerStreak: number;
  nextCallableAt: string | null;
  assignedToId: string | null;
  assignedTo: { id: string; name: string } | null;
  createdAt: string;
  activities: LastCall[];
};

function daysAgo(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export default function DialerScreen({ tags }: { tags: { id: string; name: string }[] }) {
  const [source, setSource] = useState("COLD_OUTREACH");
  const [tagId, setTagId] = useState("");
  const [current, setCurrent] = useState<DialerLead | null | undefined>(undefined); // undefined = loading
  const [previous, setPrevious] = useState<DialerLead | null>(null);
  const [skippedIds, setSkippedIds] = useState<string[]>([]);
  const [callsToday, setCallsToday] = useState(0);
  const [inboundCount, setInboundCount] = useState(0);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [answering, setAnswering] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [warmSaved, setWarmSaved] = useState(false);
  const [noAnswerPrompt, setNoAnswerPrompt] = useState<{ leadId: string; leadName: string; streak: number } | null>(null);
  // Both No Answer and Skip trigger a network round-trip before the next
  // lead appears — with no other feedback in between, a click can read as
  // "did that actually register?". actionInFlight puts a spinner directly
  // on the button that was clicked; toast leaves a brief confirmation
  // visible while the next lead loads in. Back is deliberately excluded —
  // it only swaps to an already-held-in-memory snapshot, no network call,
  // so there's no gap for either to fill.
  const [actionInFlight, setActionInFlight] = useState<"NO_ANSWER" | "SKIP" | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1600);
    return () => clearTimeout(t);
  }, [toast]);

  const fetchState = useCallback(
    async (excludeIds: string[]) => {
      const params = new URLSearchParams({ source });
      if (tagId) params.set("tagId", tagId);
      if (excludeIds.length > 0) params.set("excludeIds", excludeIds.join(","));
      const res = await fetch(`/api/crm/dialer/state?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      setCurrent(data.lead);
      setCallsToday(data.callsToday);
      setInboundCount(data.inboundCount);
    },
    [source, tagId]
  );

  useEffect(() => {
    setSkippedIds([]);
    setPrevious(null);
    setWarmSaved(false);
    setCurrent(undefined);
    fetchState([]);
  }, [fetchState]);

  function goToNext() {
    setSkippedIds([]);
    setWarmSaved(false);
    setAnswering(false);
    fetchState([]);
  }

  async function handleSkip() {
    if (!current || actionInFlight) return;
    setActionInFlight("SKIP");
    setPrevious(current);
    const next = [...skippedIds, current.id];
    setSkippedIds(next);
    await fetchState(next);
    setToast("Skipped");
    setActionInFlight(null);
  }

  async function handleNoAnswer() {
    if (!current || actionInFlight) return;
    setActionInFlight("NO_ANSWER");
    const lead = current;
    setPrevious(lead);
    const res = await fetch(`/api/crm/dialer/leads/${lead.id}/outcome`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outcome: "NO_ANSWER" }),
    });
    let promptScrap = false;
    let streak = 0;
    if (res.ok) {
      ({ streak, promptScrap } = await res.json());
    }
    setSkippedIds([]);
    setWarmSaved(false);
    setAnswering(false);
    await fetchState([]);
    setToast("Marked No Answer");
    setActionInFlight(null);
    if (promptScrap) {
      setNoAnswerPrompt({ leadId: lead.id, leadName: lead.name, streak });
    }
  }

  async function resolveNoAnswerPrompt(remove: boolean) {
    if (!noAnswerPrompt) return;
    if (remove) {
      await fetch(`/api/crm/dialer/leads/${noAnswerPrompt.leadId}/outcome`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome: "SCRAP", reason: "NO_ANSWER" }),
      });
    }
    setNoAnswerPrompt(null);
  }

  function handleAnswered() {
    setAnswering(true);
  }

  function handleAnsweredSaved(outcome: "WARM" | "CALL_BACK" | "SCRAP") {
    if (!current) return;
    setPrevious(current);
    if (outcome === "WARM") {
      setAnswering(false);
      setWarmSaved(true);
    } else {
      goToNext();
    }
  }

  async function copyPhone(phone: string) {
    try {
      await navigator.clipboard.writeText(phone);
      setToast("Copied");
    } catch {
      // Clipboard access can be denied (permissions, insecure context); the
      // tel: link right next to this button still works either way.
      setToast("Couldn't copy — clipboard access denied");
    }
  }

  function handleBack() {
    if (!previous) return;
    setCurrent(previous);
    setPrevious(null);
    setAnswering(false);
    setWarmSaved(false);
  }

  const loading = current === undefined;

  return (
    <div className="max-w-xl mx-auto space-y-3">
      {inboundCount > 0 && !bannerDismissed && (
        <div className="flex items-center justify-between gap-3 bg-blue-50 border border-blue-200 text-blue-800 text-sm rounded-md px-3 py-2.5">
          <Link href="/admin/crm/leads" className="font-medium hover:underline">
            {inboundCount} new website {inboundCount === 1 ? "enquiry needs" : "enquiries need"} to be contacted
          </Link>
          <button type="button" onClick={() => setBannerDismissed(true)} aria-label="Dismiss" className="text-blue-500 hover:text-blue-700 font-bold shrink-0">
            ×
          </button>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-blue-900">Dialer</h1>
        <div className="flex items-center gap-2">
          <Link href="/admin/crm/scrapped-leads" aria-label="Scrapped Leads" title="Scrapped Leads" className="text-gray-400 hover:text-red-600 p-1.5">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0l-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6h16z" />
            </svg>
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="border border-gray-300 rounded-md px-2 py-1.5 text-xs bg-white"
        >
          {Object.entries(SOURCE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          value={tagId}
          onChange={(e) => setTagId(e.target.value)}
          className="border border-gray-300 rounded-md px-2 py-1.5 text-xs bg-white"
        >
          <option value="">All tags</option>
          {tags.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <span className="ml-auto text-xs text-gray-500">{callsToday} calls today</span>
        <button type="button" onClick={() => setQueueOpen(true)} className="text-xs font-semibold text-blue-700 hover:underline">
          View queue
        </button>
      </div>

      {loading && (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-sm text-gray-400">Loading...</div>
      )}

      {!loading && current === null && (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center space-y-3">
          <p className="text-sm font-semibold text-gray-700">No Leads Left</p>
          <p className="text-xs text-gray-500">Nothing eligible right now for this filter.</p>
          <Link
            href="/admin/crm/scheduled-callbacks"
            className="inline-block bg-blue-700 hover:bg-blue-800 text-white text-sm font-bold px-4 py-2 rounded-md"
          >
            Show Scheduled Call Backs
          </Link>
        </div>
      )}

      {!loading && current && (
        <div className="space-y-3">
          <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-5">
            <h2 className="text-lg font-bold text-blue-900">{current.name}</h2>
            {current.businessName && <p className="text-sm text-gray-500">{current.businessName}</p>}
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-3 text-xs">
              <div>
                <dt className="text-gray-400">Source</dt>
                <dd className="text-gray-700">{SOURCE_LABELS[current.source] ?? current.source}</dd>
              </div>
              <div>
                <dt className="text-gray-400">Area</dt>
                <dd className="text-gray-700">{current.addressArea || current.postcode || "—"}</dd>
              </div>
              {current.targetAreas && (
                <div className="col-span-2">
                  <dt className="text-gray-400">Target Areas on File</dt>
                  <dd className="text-gray-700">{current.targetAreas}</dd>
                </div>
              )}
              <div className="col-span-2">
                <dt className="text-gray-400">Last Called</dt>
                <dd className="text-gray-700">
                  {current.activities[0]
                    ? `${current.activities[0].user?.name ?? "Someone"}, ${daysAgo(current.activities[0].createdAt)}`
                    : "Never called"}
                </dd>
              </div>
            </dl>

            <div className="mt-4 flex items-center gap-2">
              {current.phone ? (
                <>
                  <a
                    href={`tel:${current.phone}`}
                    className="sm:hidden flex-1 text-center bg-blue-700 hover:bg-blue-800 text-white text-sm font-bold py-3 rounded-md"
                  >
                    Call {current.phone}
                  </a>
                  {/* Desktop: a real tel: link (browsers hand it to whatever's
                      registered, or harmlessly do nothing) plus a copy
                      button, since most desktop machines have nothing
                      registered to actually place the call. */}
                  <a
                    href={`tel:${current.phone}`}
                    className="hidden sm:block flex-1 text-center bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-md py-3 text-lg font-bold text-blue-900 tracking-wide transition-colors"
                  >
                    {current.phone}
                  </a>
                  <button
                    type="button"
                    onClick={() => copyPhone(current.phone!)}
                    title="Copy number"
                    aria-label="Copy phone number"
                    className="hidden sm:flex shrink-0 items-center justify-center border border-gray-200 hover:bg-gray-50 text-gray-500 hover:text-blue-700 rounded-md p-3 transition-colors"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </>
              ) : (
                <p className="flex-1 text-center text-sm text-gray-400 py-3">No phone on file</p>
              )}
            </div>
          </div>

          {warmSaved ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-center space-y-3">
              <p className="text-sm font-semibold text-emerald-800">Saved — moved to Warm / Awaiting Response.</p>
              <button
                type="button"
                onClick={goToNext}
                className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-bold px-4 py-2 rounded-md"
              >
                Next
              </button>
            </div>
          ) : answering ? (
            <DialerAnsweredPanel leadId={current.id} onSaved={handleAnsweredSaved} onCancel={() => setAnswering(false)} />
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleNoAnswer}
                disabled={actionInFlight !== null}
                className="flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-70 text-gray-700 text-sm font-bold py-3 rounded-md"
              >
                {actionInFlight === "NO_ANSWER" && <Spinner className="w-4 h-4" />}
                No Answer
              </button>
              <button
                type="button"
                onClick={handleAnswered}
                disabled={actionInFlight !== null}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-70 text-white text-sm font-bold py-3 rounded-md"
              >
                Answered
              </button>
            </div>
          )}

          {!answering && !warmSaved && (
            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={handleBack}
                disabled={!previous}
                className="text-gray-500 hover:text-gray-700 disabled:opacity-30 font-medium"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={handleSkip}
                disabled={actionInFlight !== null}
                className="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 disabled:opacity-60 font-medium"
              >
                {actionInFlight === "SKIP" && <Spinner className="w-3 h-3" />}
                Skip →
              </button>
            </div>
          )}
        </div>
      )}

      {noAnswerPrompt && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-sm rounded-t-xl sm:rounded-xl p-5">
            <h3 className="text-sm font-bold text-gray-900 mb-1">
              No Answer — {noAnswerPrompt.streak} Calls in a Row
            </h3>
            <p className="text-xs text-gray-500 mb-4">Remove {noAnswerPrompt.leadName}?</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => resolveNoAnswerPrompt(false)}
                className="flex-1 border border-gray-300 text-gray-700 text-sm font-medium py-2.5 rounded-md"
              >
                No
              </button>
              <button
                type="button"
                onClick={() => resolveNoAnswerPrompt(true)}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-bold py-2.5 rounded-md"
              >
                Yes, Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {queueOpen && (
        <DialerQueueModal source={source} tagId={tagId} onClose={() => setQueueOpen(false)} />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-gray-900 text-white text-sm font-medium rounded-full shadow-lg px-4 py-2">
          {toast}
        </div>
      )}
    </div>
  );
}

function DialerQueueModal({ source, tagId, onClose }: { source: string; tagId: string; onClose: () => void }) {
  const [leads, setLeads] = useState<DialerLead[] | null>(null);

  useEffect(() => {
    const params = new URLSearchParams({ source });
    if (tagId) params.set("tagId", tagId);
    fetch(`/api/crm/dialer/queue?${params}`)
      .then((r) => r.json())
      .then((d) => setLeads(d.leads ?? []));
  }, [source, tagId]);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white w-full sm:max-w-md sm:max-h-[80vh] rounded-t-xl sm:rounded-xl flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h3 className="text-sm font-bold text-blue-900">Queue{leads ? ` (${leads.length})` : ""}</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 font-bold">×</button>
        </div>
        <div className="overflow-y-auto">
          {leads === null ? (
            <p className="px-4 py-6 text-sm text-gray-400 text-center">Loading...</p>
          ) : leads.length === 0 ? (
            <p className="px-4 py-6 text-sm text-gray-400 text-center">Nothing in the queue.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {leads.map((l) => (
                <li key={l.id} className="px-4 py-2.5">
                  <p className="text-sm font-medium text-blue-900">{l.name}</p>
                  <p className="text-xs text-gray-400">
                    {l.nextCallableAt ? `Due ${new Date(l.nextCallableAt).toLocaleDateString("en-GB")}` : "Never called"}
                    {l.assignedTo && ` · Assigned to ${l.assignedTo.name}`}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
