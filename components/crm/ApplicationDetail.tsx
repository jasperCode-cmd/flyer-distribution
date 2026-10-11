"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  APPLICATIONS_CHANGED_EVENT,
  APPLICATION_LIMITS,
  APPLICATION_SOURCE_LABELS,
  APPLICATION_STATUSES,
  APPLICATION_STATUS_LABELS,
  telHref,
  whatsAppHref,
  type ApplicationStatus,
} from "@/lib/distributor-applications";
import { StatusBadge, formatReceived, yesNo } from "./application-ui";

type Application = {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  area: string | null;
  age: string | null;
  hasCar: boolean | null;
  hasLicence: boolean | null;
  availability: string | null;
  status: ApplicationStatus;
  source: string;
  notes: string | null;
  receivedAt: string;
  distributor: { id: string; name: string } | null;
};

type Toast = { text: string; kind: "success" | "error" };

export default function ApplicationDetail({ application }: { application: Application }) {
  const [status, setStatus] = useState<ApplicationStatus>(application.status);
  const [notes, setNotes] = useState(application.notes ?? "");
  const [savedNotes, setSavedNotes] = useState(application.notes ?? "");
  const [distributor, setDistributor] = useState(application.distributor);
  const [busy, setBusy] = useState(false);
  const [confirmingApprove, setConfirmingApprove] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  const tel = telHref(application.phone);
  const whatsApp = whatsAppHref(application.phone);
  const notesChanged = notes.trim() !== savedNotes.trim();

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  async function patch(body: { status?: ApplicationStatus; notes?: string }): Promise<boolean> {
    try {
      const res = await fetch(`/api/crm/applications/${application.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setToast({ text: data?.error ?? "Couldn't save. Try again.", kind: "error" });
        return false;
      }
      return true;
    } catch {
      setToast({ text: "Couldn't save. Try again.", kind: "error" });
      return false;
    }
  }

  async function changeStatus(next: ApplicationStatus) {
    if (next === status || busy) return;
    const previous = status;
    setStatus(next);
    setBusy(true);
    const ok = await patch({ status: next });
    setBusy(false);
    if (!ok) {
      setStatus(previous);
      return;
    }
    window.dispatchEvent(new Event(APPLICATIONS_CHANGED_EVENT));
    setToast({ text: `Marked as ${APPLICATION_STATUS_LABELS[next]}`, kind: "success" });
  }

  async function saveNotes() {
    if (busy) return;
    setBusy(true);
    const ok = await patch({ notes });
    setBusy(false);
    if (ok) {
      setSavedNotes(notes.trim());
      setNotes(notes.trim());
      setToast({ text: "Notes saved", kind: "success" });
    }
  }

  async function approve() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/crm/applications/${application.id}/approve`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setToast({ text: data?.error ?? "Couldn't add them as a distributor. Try again.", kind: "error" });
        return;
      }
      setDistributor(data.distributor);
      setStatus("APPROVED");
      setConfirmingApprove(false);
      window.dispatchEvent(new Event(APPLICATIONS_CHANGED_EVENT));
      setToast({ text: "Added as a distributor", kind: "success" });
    } catch {
      setToast({ text: "Couldn't add them as a distributor. Try again.", kind: "error" });
    } finally {
      setBusy(false);
    }
  }

  const details: [string, string][] = [
    ["Phone", application.phone ?? "-"],
    ["Email", application.email ?? "-"],
    ["Where they live", application.area ?? "-"],
    ["Age", application.age ?? "-"],
    ["Access to a car", yesNo(application.hasCar)],
    ["Full UK licence", yesNo(application.hasLicence)],
  ];

  return (
    <div className="max-w-3xl">
      <Link href="/admin/crm/applications" className="text-xs text-blue-700 hover:underline">
        ← All applications
      </Link>

      <div className="mt-2 mb-4 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-blue-900 wrap-break-word">{application.fullName}</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Received {formatReceived(application.receivedAt, true)}, {APPLICATION_SOURCE_LABELS[application.source] ?? application.source}
          </p>
        </div>
        <StatusBadge status={status} />
      </div>

      {(tel || whatsApp) && (
        <div className="grid grid-cols-2 sm:flex gap-2 mb-4">
          {tel && (
            <a
              href={tel}
              aria-label={`Call ${application.phone}`}
              className="inline-flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold px-4 py-2.5 rounded-md"
            >
              Call
            </a>
          )}
          {whatsApp && (
            <a
              href={whatsApp}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2.5 rounded-md"
            >
              WhatsApp
            </a>
          )}
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <h2 className="text-sm font-bold text-blue-900 mb-3">Their application</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
          {details.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</dt>
              <dd className="text-sm text-gray-800 break-all">{value}</dd>
            </div>
          ))}
          <div className="sm:col-span-2">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Availability</dt>
            <dd className="text-sm text-gray-800 whitespace-pre-line wrap-break-word">{application.availability ?? "-"}</dd>
          </div>
        </dl>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <h2 className="text-sm font-bold text-blue-900 mb-3">Status</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {APPLICATION_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => changeStatus(s)}
              disabled={busy}
              aria-pressed={status === s}
              className={`text-sm font-medium px-3 py-2 rounded-md border transition-colors disabled:cursor-wait ${
                status === s
                  ? "bg-blue-700 border-blue-700 text-white"
                  : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
            >
              {APPLICATION_STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <label htmlFor="application-notes" className="block text-sm font-bold text-blue-900 mb-2">
          Notes
        </label>
        <textarea
          id="application-notes"
          rows={4}
          value={notes}
          maxLength={APPLICATION_LIMITS.notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Calls, messages, anything worth remembering"
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={saveNotes}
            disabled={!notesChanged || busy}
            className="bg-blue-700 hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-2 rounded-md"
          >
            Save notes
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="text-sm font-bold text-blue-900 mb-2">Distributor</h2>
        {distributor ? (
          <p className="text-sm text-gray-700">
            Added as a distributor:{" "}
            <Link href="/admin/crm/distributors" className="font-semibold text-blue-700 hover:underline">
              {distributor.name}
            </Link>
          </p>
        ) : confirmingApprove ? (
          <div>
            <p className="text-sm text-gray-700">
              This creates a distributor called <strong>{application.fullName}</strong> with their phone, email and
              application details in the notes, and marks this application Approved.
            </p>
            <div className="mt-3 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={approve}
                disabled={busy}
                className="bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-bold px-4 py-2 rounded-md"
              >
                {busy ? "Adding..." : "Create distributor"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingApprove(false)}
                disabled={busy}
                className="border border-gray-300 text-gray-700 text-sm font-medium px-4 py-2 rounded-md"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-xs text-gray-500 mb-3">
              Nothing is added to Distributors until you choose to.
            </p>
            <button
              type="button"
              onClick={() => setConfirmingApprove(true)}
              className="w-full sm:w-auto bg-white border border-green-600 text-green-700 hover:bg-green-50 text-sm font-bold px-4 py-2 rounded-md"
            >
              Approve and add as distributor
            </button>
          </div>
        )}
      </div>

      {toast && (
        <div
          role="status"
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] text-white text-sm font-medium rounded-full shadow-lg px-4 py-2 w-max max-w-[calc(100vw-2rem)] text-center ${
            toast.kind === "success" ? "bg-gray-900" : "bg-red-600"
          }`}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}
