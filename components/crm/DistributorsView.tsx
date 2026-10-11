"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { formatPence } from "@/lib/money";
import { formatWonDate } from "@/lib/profit";
import {
  availabilityPreview,
  DEFAULT_STATUS,
  filterDistributors,
  isDistributorSort,
  sortDistributors,
  SORT_LABELS,
  type DistributorFilters,
  type DistributorSort,
  type DistributorSummary,
  type StatusFilter,
  type YesNoFilter,
} from "@/lib/distributor-directory";
import DistributorDetailPanel, { type DistributorPatch } from "./DistributorDetailPanel";
import { ActiveChip, CarLicenceChips, PhoneCell } from "./distributor-ui";
import { trapTab } from "./profit-ui";

type Toast = { text: string; kind: "success" | "error" };

const inputClass =
  "w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";

// The Distributors page: everyone who delivers, with what they've worked
// and been paid. A table on wide screens, cards below; clicking one opens
// its panel.
export default function DistributorsView({ initial }: { initial: DistributorSummary[] }) {
  const [list, setList] = useState(initial);
  const [filters, setFilters] = useState<DistributorFilters>({ status: DEFAULT_STATUS });
  const [sort, setSort] = useState<DistributorSort>("name");
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const shown = useMemo(() => sortDistributors(filterDistributors(list, filters), sort), [list, filters, sort]);
  const activeCount = list.filter((d) => d.active).length;
  const inactiveCount = list.length - activeCount;
  const filtering =
    !!filters.q?.trim() || !!filters.area?.trim() || !!filters.car || !!filters.licence || (filters.status ?? DEFAULT_STATUS) !== DEFAULT_STATUS;
  const open = list.find((d) => d.id === openId) ?? null;

  function set<K extends keyof DistributorFilters>(key: K, value: DistributorFilters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  const closePanel = useCallback(() => {
    const id = openId;
    setOpenId(null);
    // Back to whichever of its row or card is showing; if a filter now hides
    // it (it was just deactivated), the search box.
    setTimeout(() => {
      const target = [`distributor-open-${id}`, `distributor-card-${id}`]
        .map((x) => document.getElementById(x))
        .find((el) => el && el.offsetParent !== null);
      (target ?? document.getElementById("distributor-search"))?.focus();
    }, 0);
  }, [openId]);

  // Saves an edit, the notes, or Active, and mirrors the stored result.
  async function save(id: string, patch: DistributorPatch): Promise<string | null> {
    try {
      const res = await fetch(`/api/crm/distributors/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return data.error ?? "Failed to save. Please try again.";
      const d = data.distributor;
      setList((prev) =>
        prev.map((x) =>
          x.id === id ? { ...x, name: d.name, phone: d.phone, email: d.email, notes: d.notes, active: d.active } : x
        )
      );
      return null;
    } catch {
      return "Failed to save. Please try again.";
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-bold text-blue-900">Distributors</h1>
          <p className="text-sm text-gray-600">
            {activeCount} active{inactiveCount > 0 ? `, ${inactiveCount} inactive` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center rounded-md bg-blue-900 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400"
        >
          Add distributor
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-3 mb-4 grid grid-cols-2 lg:grid-cols-7 gap-2">
        <input
          id="distributor-search"
          type="search"
          value={filters.q ?? ""}
          onChange={(e) => set("q", e.target.value)}
          placeholder="Search name, phone or email"
          aria-label="Search name, phone or email"
          className={`${inputClass} col-span-2`}
        />
        <input
          type="text"
          value={filters.area ?? ""}
          onChange={(e) => set("area", e.target.value)}
          placeholder="Area"
          aria-label="Area"
          className={inputClass}
        />
        <select
          value={filters.car ?? ""}
          onChange={(e) => set("car", e.target.value as YesNoFilter)}
          aria-label="Car"
          className={inputClass}
        >
          <option value="">Car: any</option>
          <option value="yes">Car: yes</option>
          <option value="no">Car: no</option>
        </select>
        <select
          value={filters.licence ?? ""}
          onChange={(e) => set("licence", e.target.value as YesNoFilter)}
          aria-label="Licence"
          className={inputClass}
        >
          <option value="">Licence: any</option>
          <option value="yes">Licence: yes</option>
          <option value="no">Licence: no</option>
        </select>
        <select
          value={filters.status ?? DEFAULT_STATUS}
          onChange={(e) => set("status", e.target.value as StatusFilter)}
          aria-label="Active or inactive"
          className={inputClass}
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="all">Active and inactive</option>
        </select>
        <select
          value={sort}
          onChange={(e) => isDistributorSort(e.target.value) && setSort(e.target.value)}
          aria-label="Sort by"
          className={inputClass}
        >
          {(Object.keys(SORT_LABELS) as DistributorSort[]).map((s) => (
            <option key={s} value={s}>
              Sort: {SORT_LABELS[s]}
            </option>
          ))}
        </select>
        {filtering && (
          <div className="col-span-2 lg:col-span-7 flex items-center justify-between text-xs text-gray-500">
            <span>
              Showing {shown.length} of {list.length}
            </span>
            <button
              type="button"
              onClick={() => setFilters({ status: DEFAULT_STATUS })}
              className="text-blue-700 hover:underline"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {shown.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 px-4 py-10 text-center text-sm text-gray-500">
          {list.length === 0 ? "No distributors yet. Add one, or approve an application." : "No distributors match these filters."}
        </div>
      ) : (
        <>
          {/* Wide screens: a table. */}
          <div className="hidden xl:block bg-white rounded-lg border border-gray-200">
            <table className="w-full">
              <thead className="border-b border-gray-200">
                <tr>
                  {[
                    ["Name", ""],
                    ["Phone", ""],
                    ["Email", ""],
                    ["Area", ""],
                    ["Car and licence", ""],
                    ["Availability", ""],
                    ["Jobs", "text-right"],
                    ["Total paid", "text-right"],
                    ["Last job", ""],
                    ["Status", ""],
                  ].map(([h, align]) => (
                    <th
                      key={h}
                      scope="col"
                      className={`px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap ${align || "text-left"}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {shown.map((d) => (
                  <tr key={d.id} onClick={() => setOpenId(d.id)} className="cursor-pointer align-top hover:bg-gray-50">
                    <td className="px-3 py-2.5 text-sm">
                      <button
                        id={`distributor-open-${d.id}`}
                        type="button"
                        aria-haspopup="dialog"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenId(d.id);
                        }}
                        className="text-left font-semibold text-blue-900 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
                      >
                        {d.name}
                      </button>
                    </td>
                    <td className="px-3 py-2.5 text-sm text-gray-700" onClick={(e) => e.stopPropagation()}>
                      <PhoneCell phone={d.phone} name={d.name} />
                    </td>
                    <td className="px-3 py-2.5 text-sm max-w-[220px]" onClick={(e) => e.stopPropagation()}>
                      {d.email ? (
                        <a href={`mailto:${d.email}`} className="block truncate text-blue-700 hover:underline" title={d.email}>
                          {d.email}
                        </a>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-gray-700 max-w-[180px]">
                      <span className="line-clamp-2">{d.application?.area || "-"}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <CarLicenceChips car={d.application?.hasCar ?? null} licence={d.application?.hasLicence ?? null} manual={!d.application} />
                    </td>
                    <td className="px-3 py-2.5 text-sm text-gray-600 max-w-[220px]">
                      <span className="line-clamp-2" title={d.application?.availability ?? undefined}>
                        {availabilityPreview(d.application?.availability)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-sm text-right tabular-nums text-gray-900">{d.jobsWorked}</td>
                    <td className="px-3 py-2.5 text-sm text-right tabular-nums text-gray-900 whitespace-nowrap">
                      {formatPence(d.totalPaidPence)}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-gray-700 whitespace-nowrap">
                      {d.lastJobDate ? formatWonDate(d.lastJobDate) : "-"}
                    </td>
                    <td className="px-3 py-2.5">
                      <ActiveChip active={d.active} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Narrower screens: one card per distributor. */}
          <div className="xl:hidden grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {shown.map((d) => (
              <DistributorCard key={d.id} d={d} onOpen={() => setOpenId(d.id)} />
            ))}
          </div>
        </>
      )}

      <AnimatePresence>
        {open && (
          <DistributorDetailPanel
            key={open.id}
            distributor={open}
            onClose={closePanel}
            onSave={(patch) => save(open.id, patch)}
            onToast={setToast}
          />
        )}
      </AnimatePresence>

      {adding && (
        <AddDistributorForm
          onCancel={() => setAdding(false)}
          onAdded={(d) => {
            setList((prev) => [...prev, d]);
            setAdding(false);
            setToast({ text: `${d.name} added`, kind: "success" });
          }}
        />
      )}

      {toast && (
        <div
          role="status"
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[80] text-white text-sm font-medium rounded-full shadow-lg px-4 py-2 w-max max-w-[calc(100vw-2rem)] text-center ${
            toast.kind === "success" ? "bg-gray-900" : "bg-red-600"
          }`}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}

function DistributorCard({ d, onOpen }: { d: DistributorSummary; onOpen: () => void }) {
  return (
    <div className="flex flex-col bg-white rounded-lg border border-gray-200 shadow-sm">
      <button
        id={`distributor-card-${d.id}`}
        type="button"
        aria-haspopup="dialog"
        onClick={onOpen}
        className="flex-1 text-left p-3 rounded-t-lg hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
      >
        <span className="flex items-start justify-between gap-2">
          <span className="min-w-0 text-sm font-semibold text-blue-900 [overflow-wrap:anywhere]">{d.name}</span>
          <ActiveChip active={d.active} />
        </span>
        <span className="mt-1 block text-xs text-gray-600">{d.application?.area || "Area: -"}</span>
        {d.application && (d.application.hasCar !== null || d.application.hasLicence !== null) ? (
          <span className="mt-1.5 block">
            <CarLicenceChips car={d.application.hasCar} licence={d.application.hasLicence} manual={false} />
          </span>
        ) : (
          <span className="mt-1 block text-xs text-gray-600">Car and licence: -</span>
        )}
        <span className="mt-1.5 block text-xs text-gray-500 line-clamp-2">
          Availability: {availabilityPreview(d.application?.availability, 80)}
        </span>
        <span className="mt-2 grid grid-cols-3 gap-2 border-t border-gray-100 pt-2">
          <Stat label="Jobs" value={String(d.jobsWorked)} />
          <Stat label="Paid" value={formatPence(d.totalPaidPence)} />
          <Stat label="Last job" value={d.lastJobDate ? formatWonDate(d.lastJobDate) : "-"} />
        </span>
      </button>
      <div className="border-t border-gray-100 px-3 py-2 space-y-1 text-sm text-gray-700">
        <PhoneCell phone={d.phone} name={d.name} />
        {d.email && (
          <a href={`mailto:${d.email}`} className="block break-all text-xs text-blue-700 hover:underline">
            {d.email}
          </a>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="min-w-0">
      <span className="block text-[11px] text-gray-500">{label}</span>
      <span className="block truncate text-sm font-semibold tabular-nums text-gray-900">{value}</span>
    </span>
  );
}

// "Add distributor": the same four fields and the same create rules as
// before, now in a small form that opens from the button.
function AddDistributorForm({
  onCancel,
  onAdded,
}: {
  onCancel: () => void;
  onAdded: (d: DistributorSummary) => void;
}) {
  const id = useId();
  const [form, setForm] = useState({ name: "", phone: "", email: "", notes: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const returnTo = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLElement>("input")?.focus();
    return () => returnTo?.focus?.();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return setError("Distributor name is required");
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/crm/distributors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        setSaving(false);
        return;
      }
      const d = data.distributor;
      onAdded({
        id: d.id,
        name: d.name,
        phone: d.phone,
        email: d.email,
        notes: d.notes,
        active: d.active,
        application: null,
        jobs: [],
        jobsWorked: 0,
        totalPaidPence: 0,
        lastJobDate: null,
        upcomingShifts: [],
      });
    } catch {
      setError("Something went wrong.");
      setSaving(false);
    }
  }

  const field = (key: keyof typeof form, label: string, type = "text") => (
    <div>
      <label htmlFor={`${id}-${key}`} className="mb-1 block text-xs font-medium text-gray-700">
        {label}
      </label>
      <input
        id={`${id}-${key}`}
        type={type}
        value={form[key]}
        onChange={(e) => {
          setForm({ ...form, [key]: e.target.value });
          setError("");
        }}
        className={inputClass}
      />
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
          trapTab(e, dialogRef.current);
        }}
        className="max-h-[92dvh] w-full overflow-y-auto rounded-t-xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:max-w-md sm:rounded-xl"
      >
        <h2 id={`${id}-title`} className="text-sm font-bold text-blue-900">
          Add distributor
        </h2>
        <form onSubmit={submit} className="mt-3 space-y-3" noValidate>
          {field("name", "Name")}
          <div className="grid gap-3 sm:grid-cols-2">
            {field("phone", "Phone", "tel")}
            {field("email", "Email", "email")}
          </div>
          <div>
            <label htmlFor={`${id}-notes`} className="mb-1 block text-xs font-medium text-gray-700">
              Notes
            </label>
            <textarea
              id={`${id}-notes`}
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className={inputClass}
            />
          </div>
          {error && (
            <p role="alert" className="text-xs text-red-600">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onCancel} className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-blue-900 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
            >
              {saving ? "Adding..." : "Add distributor"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
