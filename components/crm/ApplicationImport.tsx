"use client";

import { useEffect, useState } from "react";
import { APPLICATION_FIELD_LABELS, type ApplicationFieldKey, type ApplicationFields } from "@/lib/distributor-applications";
import { formatReceived, yesNo } from "./application-ui";

type DuplicateFlag =
  | { kind: "existing"; name: string; receivedAt: string }
  | { kind: "batch"; name: string }
  | null;

type PreviewItem = {
  messageId: string;
  threadId: string;
  receivedAt: string;
  fields: ApplicationFields;
  missing: ApplicationFieldKey[];
  readable: boolean;
  duplicate: DuplicateFlag;
};

type Preview = {
  alreadyImported: number;
  truncated: boolean;
  scanLimit: number;
  items: PreviewItem[];
};

type State =
  | { phase: "loading" }
  | { phase: "message"; text: string }
  | { phase: "preview"; preview: Preview }
  | { phase: "saving"; preview: Preview };

function duplicateText(flag: DuplicateFlag): string | null {
  if (!flag) return null;
  if (flag.kind === "existing") {
    return `Possible duplicate: same phone number as ${flag.name}'s application from ${formatReceived(flag.receivedAt)}.`;
  }
  return `Possible duplicate: same phone number as ${flag.name}'s application in this import.`;
}

function failureText(status: number, reason?: string): string {
  if (status === 401) return "Your session has ended. Sign in again to import.";
  if (status === 503) return "Gmail is not connected, so past applications can't be searched.";
  if (reason === "reconnect") return "Gmail needs to be reconnected before past applications can be searched.";
  return "Couldn't search Gmail just now. Try again in a moment.";
}

// Preview first, nothing saved: every application email found, what could
// be read from it, and any it couldn't read fully. Only Confirm saves, and
// only the ones ticked. Likely duplicates start unticked.
export default function ApplicationImport({
  gmailConfigured,
  onClose,
  onImported,
}: {
  gmailConfigured: boolean;
  onClose: () => void;
  onImported: (imported: number, skipped: number) => void;
}) {
  const [state, setState] = useState<State>(
    gmailConfigured ? { phase: "loading" } : { phase: "message", text: failureText(503) }
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!gmailConfigured) return;
    let cancelled = false;
    fetch("/api/crm/applications/import")
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok) {
          setState({ phase: "message", text: failureText(res.status, data?.reason) });
          return;
        }
        const preview = data as Preview;
        setSelected(new Set(preview.items.filter((i) => i.readable && !i.duplicate).map((i) => i.messageId)));
        setState({ phase: "preview", preview });
      })
      .catch(() => {
        if (!cancelled) setState({ phase: "message", text: failureText(0) });
      });
    return () => {
      cancelled = true;
    };
  }, [gmailConfigured]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const preview = state.phase === "preview" || state.phase === "saving" ? state.preview : null;
  const importable = preview?.items.filter((i) => i.readable) ?? [];

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function confirm() {
    if (!preview || selected.size === 0) return;
    setSaveError(null);
    setState({ phase: "saving", preview });
    const selections = preview.items
      .filter((i) => selected.has(i.messageId))
      .map((i) => ({ messageId: i.messageId, threadId: i.threadId }));
    try {
      const res = await fetch("/api/crm/applications/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selections }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setSaveError(data?.error && res.status === 400 ? data.error : failureText(res.status, data?.reason));
        setState({ phase: "preview", preview });
        return;
      }
      onImported(data.imported ?? 0, data.skipped ?? 0);
    } catch {
      setSaveError(failureText(0));
      setState({ phase: "preview", preview });
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-title"
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full sm:max-w-3xl max-h-[92vh] rounded-t-xl sm:rounded-xl flex flex-col"
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-gray-100">
          <div>
            <h2 id="import-title" className="text-base font-bold text-blue-900">
              Import past applications from Gmail
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">Nothing is saved until you press Import.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600 text-xl leading-none">
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {state.phase === "loading" && (
            <p className="text-sm text-gray-500 py-8 text-center">Searching Gmail for application emails...</p>
          )}
          {state.phase === "message" && <p className="text-sm text-gray-600 py-8 text-center">{state.text}</p>}

          {preview && (
            <>
              <div className="text-xs text-gray-600 space-y-1 mb-3">
                <p>
                  Found {preview.items.length} application email{preview.items.length === 1 ? "" : "s"} not yet imported.
                  {preview.alreadyImported > 0 &&
                    ` ${preview.alreadyImported} already imported ${preview.alreadyImported === 1 ? "was" : "were"} skipped.`}
                </p>
                {preview.truncated && (
                  <p className="text-amber-700">
                    Only the latest {preview.scanLimit} matching emails were checked. Import these, then run it again
                    for older ones.
                  </p>
                )}
              </div>

              {importable.length > 1 && (
                <div className="flex gap-3 text-xs mb-2">
                  <button
                    type="button"
                    onClick={() => setSelected(new Set(importable.map((i) => i.messageId)))}
                    className="text-blue-700 hover:underline"
                  >
                    Tick all
                  </button>
                  <button type="button" onClick={() => setSelected(new Set())} className="text-blue-700 hover:underline">
                    Untick all
                  </button>
                </div>
              )}

              {preview.items.length === 0 ? (
                <p className="text-sm text-gray-400 py-6 text-center">No new application emails found.</p>
              ) : (
                <ul className="space-y-2">
                  {preview.items.map((item) => {
                    const f = item.fields;
                    const dup = duplicateText(item.duplicate);
                    return (
                      <li
                        key={item.messageId}
                        className={`rounded-lg border p-3 ${
                          item.readable ? "border-gray-200" : "border-red-200 bg-red-50/40"
                        }`}
                      >
                        <label className="flex items-start gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            className="mt-1 h-4 w-4 shrink-0"
                            checked={selected.has(item.messageId)}
                            disabled={!item.readable || state.phase === "saving"}
                            onChange={() => toggle(item.messageId)}
                            aria-label={item.readable ? `Import ${f.fullName}` : "Can't be imported"}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                              <p className="text-sm font-semibold text-blue-900 wrap-break-word">
                                {f.fullName || "Name not found"}
                              </p>
                              <p className="text-[11px] text-gray-400">Received {formatReceived(item.receivedAt, true)}</p>
                            </div>
                            <dl className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
                              {(
                                [
                                  ["Phone", f.phone],
                                  ["Email", f.email],
                                  ["Where they live", f.area],
                                  ["Age", f.age],
                                  ["Car access", f.hasCar === null ? null : yesNo(f.hasCar)],
                                  ["Full UK licence", f.hasLicence === null ? null : yesNo(f.hasLicence)],
                                ] as const
                              ).map(([label, value]) => (
                                <div key={label} className="flex gap-1.5 min-w-0">
                                  <dt className="text-gray-500 shrink-0">{label}:</dt>
                                  <dd className="text-gray-800 break-all">{value ?? "-"}</dd>
                                </div>
                              ))}
                              <div className="flex gap-1.5 sm:col-span-2 min-w-0">
                                <dt className="text-gray-500 shrink-0">Availability:</dt>
                                <dd className="text-gray-800 whitespace-pre-line wrap-break-word">{f.availability ?? "-"}</dd>
                              </div>
                            </dl>
                            {!item.readable && (
                              <p className="mt-1.5 text-xs font-medium text-red-700">
                                No name could be read from this email, so it can&apos;t be imported.
                              </p>
                            )}
                            {item.readable && item.missing.length > 0 && (
                              <p className="mt-1.5 text-xs text-amber-700">
                                Couldn&apos;t read: {item.missing.map((k) => APPLICATION_FIELD_LABELS[k]).join(", ")}
                              </p>
                            )}
                            {dup && <p className="mt-1 text-xs text-amber-700">{dup}</p>}
                          </div>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </div>

        <div className="border-t border-gray-100 px-5 py-3 flex flex-col-reverse sm:flex-row sm:items-center gap-2">
          {saveError && <p className="text-xs text-red-600 sm:mr-auto">{saveError}</p>}
          <div className="flex gap-2 sm:ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none border border-gray-300 text-gray-700 text-sm font-medium px-4 py-2 rounded-md"
            >
              Cancel
            </button>
            {preview && (
              <button
                type="button"
                onClick={confirm}
                disabled={selected.size === 0 || state.phase === "saving"}
                className="flex-1 sm:flex-none bg-blue-700 hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold px-4 py-2 rounded-md"
              >
                {state.phase === "saving"
                  ? "Importing..."
                  : `Import ${selected.size} application${selected.size === 1 ? "" : "s"}`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
