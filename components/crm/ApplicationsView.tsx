"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  APPLICATIONS_CHANGED_EVENT,
  APPLICATION_STATUSES,
  APPLICATION_STATUS_LABELS,
  filterApplications,
  type ApplicationFilters,
  type ApplicationStatus,
} from "@/lib/distributor-applications";
import { StatusBadge, formatReceived, yesNo } from "./application-ui";
import ApplicationImport from "./ApplicationImport";

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
}: {
  applications: ApplicationRow[];
  gmailConfigured: boolean;
}) {
  const router = useRouter();
  const [filters, setFilters] = useState<ApplicationFilters>({});
  const [importOpen, setImportOpen] = useState(false);
  const [toast, setToast] = useState<{ text: string; kind: "success" | "error" } | null>(null);

  const shown = useMemo(() => filterApplications(applications, filters), [applications, filters]);
  const newCount = applications.filter((a) => a.status === "NEW").length;
  const filtering = Object.values(filters).some(Boolean);

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
            <table className="w-full min-w-[960px]">
              <thead className="border-b border-gray-200">
                <tr>
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
                    className="cursor-pointer hover:bg-gray-50 align-top"
                  >
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
              <Link
                key={a.id}
                href={`/admin/crm/applications/${a.id}`}
                className="block bg-white rounded-lg border border-gray-200 p-3 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-blue-900 min-w-0 wrap-break-word">{a.fullName}</p>
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
            ))}
          </div>
        </>
      )}

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
