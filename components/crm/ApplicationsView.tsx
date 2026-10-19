"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  APPLICATIONS_CHANGED_EVENT,
  APPLICATION_STATUSES,
  APPLICATION_STATUS_LABELS,
  filterApplications,
  type ApplicationFilters,
  type ApplicationStatus,
} from "@/lib/distributor-applications";
import type { BulkOutcome } from "@/lib/application-bulk";
import { StatusBadge, formatReceived, yesNo } from "./application-ui";
import ApplicationImport from "./ApplicationImport";
import ApplicationBulkMove from "./ApplicationBulkMove";
import BusinessBadge from "./BusinessBadge";
import BusinessFilter from "./BusinessFilter";
import type { Business } from "@/lib/business";

export type ApplicationRow = {
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
  business: Business;
  receivedAt: string;
  distributor: { id: string; name: string } | null;
};

const inputClass =
  "w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";

function SourceTag({ source }: { source: string }) {
  if (source !== "GMAIL_IMPORT") return null;
  return <span className="ml-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">Imported</span>;
}

export default function ApplicationsView({
  applications,
  gmailConfigured,
  initialBusiness,
}: {
  applications: ApplicationRow[];
  gmailConfigured: boolean;
  // From ?business=, like the Leads page.
  initialBusiness?: Business;
}) {
  const router = useRouter();
  const [filters, setFilters] = useState<ApplicationFilters>(initialBusiness ? { business: initialBusiness } : {});
  const [importOpen, setImportOpen] = useState(false);
  const [toast, setToast] = useState<{ text: string; kind: "success" | "error" } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [moving, setMoving] = useState<string[] | null>(null);
  const headerBoxRef = useRef<HTMLInputElement>(null);

  const shown = useMemo(() => filterApplications(applications, filters), [applications, filters]);
  const newCount = applications.filter((a) => a.status === "NEW").length;
  const filtering = Object.values(filters).some(Boolean);
  const allShownSelected = shown.length > 0 && shown.every((a) => selected.has(a.id));

  // The selection only ever covers applications on screen: changing the
  // filters drops any that no longer match, so a bulk action never reaches
  // something hidden.
  useEffect(() => {
    setSelected((prev) => {
      const visible = new Set(shown.map((a) => a.id));
      const next = new Set([...prev].filter((id) => visible.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [shown]);

  useEffect(() => {
    if (headerBoxRef.current) headerBoxRef.current.indeterminate = selected.size > 0 && !allShownSelected;
  }, [selected, allShownSelected]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllShown() {
    setSelected(new Set(shown.map((a) => a.id)));
  }

  // Straight after the move, before the summary is closed: the list, the
  // Applications count in the navigation and the bell all update.
  function onMoved(results: BulkOutcome[]) {
    window.dispatchEvent(new Event(APPLICATIONS_CHANGED_EVENT));
    router.refresh();
    // Failed ones stay selected, ready to try again.
    setSelected(new Set(results.filter((r) => r.result === "failed").map((r) => r.id)));
  }

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  function set<K extends keyof ApplicationFilters>(key: K, value: ApplicationFilters[K]) {
    setFilters((f) => ({ ...f, [key]: value || undefined }));
  }

  function onImported(imported: number, skipped: number) {
    setImportOpen(false);
    setToast({
      text:
        `Imported ${imported} application${imported === 1 ? "" : "s"}` +
        (skipped > 0 ? `, ${skipped} skipped` : ""),
      kind: "success",
    });
    window.dispatchEvent(new Event(APPLICATIONS_CHANGED_EVENT));
    router.refresh();
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-blue-900">Applications</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {applications.length} in total, {newCount} new
          </p>
        </div>
        <button
          type="button"
          onClick={() => setImportOpen(true)}
          className="w-full sm:w-auto text-sm font-semibold text-blue-700 bg-white border border-blue-300 hover:bg-blue-50 rounded-md px-4 py-2 transition-colors"
        >
          Import past applications from Gmail
        </button>
      </div>

      <BusinessFilter
        value={filters.business ?? "ALL"}
        onChange={(business) => setFilters((f) => ({ ...f, business: business === "ALL" ? undefined : business }))}
        className="mb-3"
      />

      <div className="bg-white rounded-lg border border-gray-200 p-3 mb-4 grid grid-cols-2 lg:grid-cols-6 gap-2">
        <input
          type="search"
          value={filters.q ?? ""}
          onChange={(e) => set("q", e.target.value)}
          placeholder="Search name, phone or postcode"
          aria-label="Search name, phone or postcode"
          className={`${inputClass} col-span-2`}
        />
        <select
          value={filters.status ?? ""}
          onChange={(e) => set("status", e.target.value as ApplicationStatus | "")}
          aria-label="Status"
          className={inputClass}
        >
          <option value="">All statuses</option>
          {APPLICATION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {APPLICATION_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          value={filters.car ?? ""}
          onChange={(e) => set("car", e.target.value as "yes" | "no" | "")}
          aria-label="Car access"
          className={inputClass}
        >
          <option value="">Car: any</option>
          <option value="yes">Car: yes</option>
          <option value="no">Car: no</option>
        </select>
        <select
          value={filters.licence ?? ""}
          onChange={(e) => set("licence", e.target.value as "yes" | "no" | "")}
          aria-label="Full UK licence"
          className={inputClass}
        >
          <option value="">Licence: any</option>
          <option value="yes">Licence: yes</option>
          <option value="no">Licence: no</option>
        </select>
        <input
          type="text"
          value={filters.area ?? ""}
          onChange={(e) => set("area", e.target.value)}
          placeholder="Where they live"
          aria-label="Where they live"
          className={inputClass}
        />
        {filtering && (
          <div className="col-span-2 lg:col-span-6 flex items-center justify-between text-xs text-gray-500">
            <span>
              Showing {shown.length} of {applications.length}
            </span>
            <button type="button" onClick={() => setFilters({})} className="text-blue-700 hover:underline">
              Clear filters
            </button>
          </div>
        )}
      </div>

      {shown.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-3 bg-blue-50 border border-blue-200 rounded-md px-3 py-2">
          <span className="text-xs font-semibold text-blue-800">
            {selected.size > 0 ? `${selected.size} selected` : "None selected"}
          </span>
          {!allShownSelected && (
            <button type="button" onClick={selectAllShown} className="text-xs font-semibold text-blue-700 hover:underline">
              Select all {shown.length}
              {filtering ? " matching" : ""}
            </button>
          )}
          {selected.size > 0 && (
            <button type="button" onClick={() => setSelected(new Set())} className="text-xs font-semibold text-blue-700 hover:underline">
              Clear selection
            </button>
          )}
          <button
            type="button"
            onClick={() => setMoving(shown.filter((a) => selected.has(a.id)).map((a) => a.id))}
            disabled={selected.size === 0}
            className="w-full sm:w-auto sm:ml-auto bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-bold px-3 py-2 rounded-md"
          >
            Move to distributors
          </button>
        </div>
      )}

      {shown.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 px-4 py-10 text-center text-sm text-gray-400">
          {applications.length === 0
            ? "No applications yet. New ones from the Work With Us form appear here, and past ones can be imported from Gmail."
            : "No applications match these filters."}
        </div>
      ) : (
        <>
          {/* Desktop and tablet: every field in a table. */}
          <div className="hidden md:block bg-white rounded-lg border border-gray-200 overflow-x-auto">
            <table className="w-full min-w-[1000px]">
              <thead className="border-b border-gray-200">
                <tr>
                  <th className="w-10 pl-3 pr-1 py-2">
                    <input
                      ref={headerBoxRef}
                      type="checkbox"
                      checked={allShownSelected}
                      onChange={() => (allShownSelected ? setSelected(new Set()) : selectAllShown())}
                      aria-label={allShownSelected ? "Clear selection" : `Select all ${shown.length} shown`}
                      className="h-4 w-4 align-middle accent-blue-700"
                    />
                  </th>
                  {["Received", "Name", "Phone", "Where they live", "Age", "Car", "Licence", "Availability", "Status"].map(
                    (h) => (
                      <th
                        key={h}
                        className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {shown.map((a) => (
                  <tr
                    key={a.id}
                    onClick={() => router.push(`/admin/crm/applications/${a.id}`)}
                    className={`cursor-pointer align-top ${selected.has(a.id) ? "bg-blue-50 hover:bg-blue-100/70" : "hover:bg-gray-50"}`}
                  >
                    <td className="w-10 pl-3 pr-1 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(a.id)}
                        onChange={() => toggle(a.id)}
                        aria-label={`Select ${a.fullName}`}
                        className="h-4 w-4 align-middle accent-blue-700"
                      />
                    </td>
                    <td className="px-3 py-2.5 text-sm text-gray-500 whitespace-nowrap">
                      {formatReceived(a.receivedAt)}
                      <SourceTag source={a.source} />
                    </td>
                    <td className="px-3 py-2.5 text-sm">
                      <Link
                        href={`/admin/crm/applications/${a.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-medium text-blue-900 hover:underline"
                      >
                        {a.fullName}
                      </Link>
                      <BusinessBadge business={a.business} className="ml-1.5 align-middle" />
                      {a.email && <p className="text-xs text-gray-500 break-all">{a.email}</p>}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-gray-700 whitespace-nowrap">{a.phone ?? "-"}</td>
                    <td className="px-3 py-2.5 text-sm text-gray-700">{a.area ?? "-"}</td>
                    <td className="px-3 py-2.5 text-sm text-gray-700">{a.age ?? "-"}</td>
                    <td className="px-3 py-2.5 text-sm text-gray-700">{yesNo(a.hasCar)}</td>
                    <td className="px-3 py-2.5 text-sm text-gray-700">{yesNo(a.hasLicence)}</td>
                    <td className="px-3 py-2.5 text-sm text-gray-600 max-w-[260px]">
                      <p className="line-clamp-2" title={a.availability ?? undefined}>
                        {a.availability ?? "-"}
                      </p>
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={a.status} />
                      {a.distributor && (
                        <p className="mt-1 text-[11px] text-green-700 whitespace-nowrap">Added as distributor</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Phones: one card per application. */}
          <div className="md:hidden space-y-2">
            {shown.map((a) => (
              <div
                key={a.id}
                className={`flex items-start gap-1 bg-white rounded-lg border shadow-sm ${
                  selected.has(a.id) ? "border-blue-400 ring-1 ring-blue-400" : "border-gray-200"
                }`}
              >
                <label className="shrink-0 p-3 pr-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.has(a.id)}
                    onChange={() => toggle(a.id)}
                    aria-label={`Select ${a.fullName}`}
                    className="h-5 w-5 accent-blue-700"
                  />
                </label>
                <Link href={`/admin/crm/applications/${a.id}`} className="block min-w-0 flex-1 p-3 pl-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-blue-900 min-w-0 wrap-break-word">
                      {a.fullName}
                      <BusinessBadge business={a.business} className="ml-1.5 align-middle" />
                    </p>
                    <StatusBadge status={a.status} />
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    {a.area ?? "Area not given"}
                    {a.age ? `, age ${a.age}` : ""}
                  </p>
                  <p className="text-xs text-gray-600 mt-0.5">{a.phone ?? "No phone"}</p>
                  {a.email && <p className="text-xs text-gray-500 mt-0.5 break-all">{a.email}</p>}
                  <p className="text-xs text-gray-600 mt-0.5">
                    Car: {yesNo(a.hasCar)}. Licence: {yesNo(a.hasLicence)}.
                  </p>
                  {a.availability && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{a.availability}</p>}
                  <p className="text-[11px] text-gray-400 mt-1.5">
                    Received {formatReceived(a.receivedAt)}
                    <SourceTag source={a.source} />
                    {a.distributor && <span className="ml-1.5 text-green-700">Added as distributor</span>}
                  </p>
                </Link>
              </div>
            ))}
          </div>
        </>
      )}

      {moving && <ApplicationBulkMove ids={moving} onMoved={onMoved} onClose={() => setMoving(null)} />}

      {importOpen && (
        <ApplicationImport gmailConfigured={gmailConfigured} onClose={() => setImportOpen(false)} onImported={onImported} />
      )}

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
