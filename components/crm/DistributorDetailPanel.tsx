"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { formatPence } from "@/lib/money";
import { formatWonDate } from "@/lib/profit";
import { telHref, whatsAppHref } from "@/lib/distributor-applications";
import { formatUkPhone, type DistributorJob, type DistributorSummary } from "@/lib/distributor-directory";
import { ActiveChip, CarLicenceChips } from "./distributor-ui";
import { trapTab, useIsNarrow } from "./profit-ui";

export type DistributorPatch = {
  name?: string;
  phone?: string;
  email?: string;
  notes?: string;
  active?: boolean;
};

const inputClass =
  "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

function shiftWhen(start: string, end: string | null): string {
  const day = new Date(start).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Europe/London",
  });
  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
  if (!end) return `${day}, ${time(start)}`;
  const sameDay =
    new Date(start).toLocaleDateString("en-CA", { timeZone: "Europe/London" }) ===
    new Date(end).toLocaleDateString("en-CA", { timeZone: "Europe/London" });
  return sameDay ? `${day}, ${time(start)} to ${time(end)}` : `${day}, ${time(start)} to ${formatWonDate(end)} ${time(end)}`;
}

function lineDetail(line: DistributorJob["lines"][number]): string {
  if (line.payType === "PER_THOUSAND" && line.ratePence !== null && line.leafletCount !== null) {
    return `${line.leafletCount.toLocaleString("en-GB")} leaflets at ${formatPence(line.ratePence)} per 1,000`;
  }
  return "Set amount";
}

// One distributor, opened from their row or card: a wide panel, or a
// full-width sheet on a phone. Escape or the backdrop closes it.
export default function DistributorDetailPanel({
  distributor: d,
  onClose,
  onSave,
  onToast,
}: {
  distributor: DistributorSummary;
  onClose: () => void;
  onSave: (patch: DistributorPatch) => Promise<string | null>;
  onToast: (toast: { text: string; kind: "success" | "error" }) => void;
}) {
  const id = useId();
  const reduce = useReducedMotion();
  const narrow = useIsNarrow();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [editing, setEditing] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [notes, setNotes] = useState(d.notes ?? "");
  const [savingNotes, setSavingNotes] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      // Escape backs out of a question first, then closes.
      if (confirmDeactivate) setConfirmDeactivate(false);
      else onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirmDeactivate, onClose]);

  const phone = formatUkPhone(d.phone);
  const tel = telHref(d.phone);
  const whatsApp = whatsAppHref(d.phone);
  const notesChanged = notes.trim() !== (d.notes ?? "").trim();
  const app = d.application;

  async function saveNotes() {
    setSavingNotes(true);
    const error = await onSave({ notes });
    setSavingNotes(false);
    onToast(error ? { text: error, kind: "error" } : { text: "Notes saved", kind: "success" });
  }

  async function setActive(active: boolean) {
    setBusy(true);
    const error = await onSave({ active });
    setBusy(false);
    setConfirmDeactivate(false);
    onToast(
      error
        ? { text: error, kind: "error" }
        : { text: active ? `${d.name} is active again` : `${d.name} deactivated. Their history is kept.`, kind: "success" }
    );
  }

  const radius = narrow
    ? { borderTopLeftRadius: 16, borderTopRightRadius: 16, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }
    : { borderRadius: 12 };

  return (
    <>
      <motion.div
        key="backdrop"
        className="fixed inset-0 z-50 bg-black/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reduce ? 0 : 0.2 }}
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6 pointer-events-none">
        <motion.div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${id}-title`}
          onKeyDown={(e) => trapTab(e, dialogRef.current)}
          style={radius}
          initial={reduce ? { opacity: 1 } : narrow ? { y: 40, opacity: 0 } : { scale: 0.97, opacity: 0 }}
          animate={{ y: 0, scale: 1, opacity: 1, transition: { duration: reduce ? 0 : 0.2 } }}
          exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, transition: { duration: 0.12 } }}
          className="pointer-events-auto bg-white w-full sm:max-w-3xl max-h-[92dvh] sm:max-h-[88vh] flex flex-col overflow-hidden shadow-2xl"
        >
          <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-4 sm:px-6 py-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id={`${id}-title`} className="text-lg font-bold text-blue-900 [overflow-wrap:anywhere]">
                  {d.name}
                </h2>
                <ActiveChip active={d.active} />
              </div>
              <p className="mt-0.5 text-sm text-gray-600 [overflow-wrap:anywhere]">
                {[phone, d.email].filter(Boolean).join(", ") || "No phone or email"}
              </p>
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="shrink-0 rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <path d="M5 5l10 10M15 5L5 15" />
              </svg>
            </button>
          </div>

          <div className="overflow-y-auto overscroll-contain px-4 sm:px-6 py-5 space-y-6 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            {(tel || whatsApp || d.email) && (
              <div className="flex flex-wrap gap-2">
                {tel && (
                  <a href={tel} className="inline-flex items-center rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">
                    Call
                  </a>
                )}
                {whatsApp && (
                  <a
                    href={whatsApp}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
                  >
                    WhatsApp
                  </a>
                )}
                {d.email && (
                  <a
                    href={`mailto:${d.email}`}
                    className="inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Email
                  </a>
                )}
              </div>
            )}

            {editing && (
              <EditForm
                distributor={d}
                onCancel={() => setEditing(false)}
                onSave={async (patch) => {
                  const error = await onSave(patch);
                  if (!error) {
                    setEditing(false);
                    onToast({ text: "Details saved", kind: "success" });
                  }
                  return error;
                }}
              />
            )}

            <section aria-label="Totals" className="grid grid-cols-3 gap-3">
              <Tile label="Jobs worked" value={String(d.jobsWorked)} />
              <Tile label="Total earned" value={formatPence(d.totalPaidPence)} />
              <Tile label="Last job" value={d.lastJobDate ? formatWonDate(d.lastJobDate) : "-"} />
            </section>

            <section aria-labelledby={`${id}-jobs`}>
              <h3 id={`${id}-jobs`} className="mb-2 text-sm font-bold text-blue-900">
                Jobs
              </h3>
              {d.jobs.length === 0 ? (
                <p className="text-sm text-gray-500">No jobs yet.</p>
              ) : (
                <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                  {d.jobs.map((job) => (
                    <li key={job.leadId} className="flex items-start justify-between gap-3 px-3 py-2.5">
                      <div className="min-w-0">
                        <Link href={`/admin/crm/leads/${job.leadId}`} className="text-sm font-medium text-blue-900 hover:underline">
                          {job.leadName}
                        </Link>
                        {job.businessName && <span className="text-sm text-gray-500">, {job.businessName}</span>}
                        <p className="text-xs text-gray-500">
                          {[
                            job.wonAt ? `Won ${formatWonDate(job.wonAt)}` : "Won date unknown",
                            job.campaignStartDate ? `campaign ${formatWonDate(job.campaignStartDate)}` : null,
                            job.assigned ? "assigned distributor" : null,
                          ]
                            .filter(Boolean)
                            .join(", ")}
                        </p>
                        {job.lines.length > 0 ? (
                          <ul className="mt-0.5 text-xs text-gray-500">
                            {job.lines.map((line) => (
                              <li key={line.id}>
                                {lineDetail(line)}: {formatPence(line.amountPence)}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-0.5 text-xs text-amber-800">No pay recorded on the Profit page yet</p>
                        )}
                      </div>
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-gray-900">{formatPence(job.paidPence)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby={`${id}-shifts`}>
              <h3 id={`${id}-shifts`} className="mb-2 text-sm font-bold text-blue-900">
                Upcoming shifts
              </h3>
              {d.upcomingShifts.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No upcoming shifts.{" "}
                  <Link href="/admin/crm/calendar" className="text-blue-700 hover:underline">
                    Open the calendar
                  </Link>
                </p>
              ) : (
                <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                  {d.upcomingShifts.map((s) => (
                    <li key={s.id} className="px-3 py-2 text-sm">
                      <span className="font-medium text-gray-900">{shiftWhen(s.startDateTime, s.endDateTime)}</span>
                      <span className="text-gray-600">, {s.title}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby={`${id}-app`}>
              <h3 id={`${id}-app`} className="mb-2 text-sm font-bold text-blue-900">
                From their application
              </h3>
              {app ? (
                <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[8rem_1fr]">
                  <dt className="text-gray-500">Area</dt>
                  <dd className="text-gray-900">{app.area || "-"}</dd>
                  <dt className="text-gray-500">Car and licence</dt>
                  <dd>
                    <CarLicenceChips car={app.hasCar} licence={app.hasLicence} manual={false} />
                  </dd>
                  <dt className="text-gray-500">Availability</dt>
                  <dd className="whitespace-pre-line text-gray-900">{app.availability || "-"}</dd>
                  <dt className="sr-only">Application</dt>
                  <dd className="sm:col-start-2">
                    <Link href={`/admin/crm/applications/${app.id}`} className="text-blue-700 hover:underline">
                      View their application
                    </Link>
                  </dd>
                </dl>
              ) : (
                <p className="text-sm text-gray-500">
                  Added by hand, so there is no application. Area, car, licence and availability show as -.
                </p>
              )}
            </section>

            <div>
              <label htmlFor={`${id}-notes-input`} className="mb-2 block text-sm font-bold text-blue-900">
                Notes
              </label>
              <textarea
                id={`${id}-notes-input`}
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className={inputClass}
              />
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={saveNotes}
                  disabled={!notesChanged || savingNotes}
                  className="rounded-md bg-blue-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-40"
                >
                  {savingNotes ? "Saving..." : "Save notes"}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
              {!editing && (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Edit details
                </button>
              )}
              {d.active ? (
                <button
                  type="button"
                  onClick={() => setConfirmDeactivate(true)}
                  disabled={busy}
                  className="rounded-md border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  Deactivate
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setActive(true)}
                  disabled={busy}
                  className="rounded-md border border-green-300 px-3 py-1.5 text-sm font-semibold text-green-800 hover:bg-green-50 disabled:opacity-50"
                >
                  {busy ? "Saving..." : "Reactivate"}
                </button>
              )}
            </div>

            {confirmDeactivate && (
              <div role="alertdialog" aria-labelledby={`${id}-deactivate`} className="rounded-lg border border-red-200 bg-red-50 p-3">
                <p id={`${id}-deactivate`} className="text-sm text-red-900">
                  Deactivate {d.name}? They will be hidden from the Profit page&apos;s distributor list and from new
                  calendar shifts. Their {d.jobsWorked} {d.jobsWorked === 1 ? "job" : "jobs"}, {formatPence(d.totalPaidPence)} paid
                  and shifts all stay on record, and you can reactivate them at any time.
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setActive(false)}
                    disabled={busy}
                    className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {busy ? "Saving..." : "Deactivate"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeactivate(false)}
                    className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-white"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-0.5 text-base sm:text-lg font-bold tabular-nums text-gray-900">{value}</p>
    </div>
  );
}

function EditForm({
  distributor: d,
  onCancel,
  onSave,
}: {
  distributor: DistributorSummary;
  onCancel: () => void;
  onSave: (patch: DistributorPatch) => Promise<string | null>;
}) {
  const id = useId();
  const [form, setForm] = useState({ name: d.name, phone: d.phone ?? "", email: d.email ?? "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return setError("Distributor name is required");
    setSaving(true);
    const problem = await onSave(form);
    setSaving(false);
    if (problem) setError(problem);
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-blue-200 bg-blue-50/40 p-3 space-y-3" noValidate aria-label="Edit details">
      <div className="grid gap-3 sm:grid-cols-3">
        {(
          [
            ["name", "Name", "text"],
            ["phone", "Phone", "tel"],
            ["email", "Email", "email"],
          ] as const
        ).map(([key, label, type], i) => (
          <div key={key}>
            <label htmlFor={`${id}-${key}`} className="mb-1 block text-xs font-medium text-gray-700">
              {label}
            </label>
            <input
              id={`${id}-${key}`}
              ref={i === 0 ? firstRef : undefined}
              type={type}
              value={form[key]}
              onChange={(e) => {
                setForm({ ...form, [key]: e.target.value });
                setError("");
              }}
              className={inputClass}
            />
          </div>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-white">
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-blue-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save details"}
        </button>
      </div>
    </form>
  );
}
