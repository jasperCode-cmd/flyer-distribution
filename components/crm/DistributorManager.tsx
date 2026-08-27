"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type Distributor = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  active: boolean;
  _count?: { jobs: number; calendarEvents: number };
};

const EMPTY = { name: "", phone: "", email: "", notes: "" };

export default function DistributorManager({
  distributors: initial,
}: {
  distributors: Distributor[];
}) {
  const router = useRouter();
  const [distributors, setDistributors] = useState(initial);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  function sortList(list: Distributor[]) {
    return [...list].sort(
      (a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name),
    );
  }

  async function createDistributor(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSubmitting(true);
    setError("");

    const res = await fetch("/api/crm/distributors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Something went wrong.");
      return;
    }

    const { distributor } = await res.json();
    setDistributors((prev) => sortList([...prev, { ...distributor, _count: { jobs: 0, calendarEvents: 0 } }]));
    setForm(EMPTY);
    router.refresh();
  }

  function startEdit(d: Distributor) {
    setEditingId(d.id);
    setEditForm({
      name: d.name,
      phone: d.phone ?? "",
      email: d.email ?? "",
      notes: d.notes ?? "",
    });
    setError("");
  }

  async function saveEdit(id: string) {
    if (!editForm.name.trim()) return;
    setSubmitting(true);
    setError("");

    const res = await fetch(`/api/crm/distributors/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });

    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Something went wrong.");
      return;
    }

    const { distributor } = await res.json();
    setDistributors((prev) =>
      sortList(prev.map((d) => (d.id === id ? { ...d, ...distributor } : d))),
    );
    setEditingId(null);
    router.refresh();
  }

  async function setActive(id: string, active: boolean) {
    setDistributors((prev) => sortList(prev.map((d) => (d.id === id ? { ...d, active } : d))));
    await fetch(`/api/crm/distributors/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    router.refresh();
  }

  const visible = showInactive ? distributors : distributors.filter((d) => d.active);
  const inactiveCount = distributors.filter((d) => !d.active).length;

  return (
    <div className="max-w-2xl space-y-4">
      <form onSubmit={createDistributor} className="bg-white rounded-lg border border-gray-200 p-4 sm:p-5">
        <h2 className="text-sm font-bold text-blue-900 mb-3">Add Distributor</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Phone</label>
            <input
              type="text"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
            <input
              type="text"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="mt-3">
          <button
            type="submit"
            disabled={submitting || !form.name.trim()}
            className="bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-bold px-4 py-2 rounded-md"
          >
            Add
          </button>
        </div>
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      </form>

      <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-blue-900">All Distributors</h2>
          {inactiveCount > 0 && (
            <button
              type="button"
              onClick={() => setShowInactive((s) => !s)}
              className="text-xs font-semibold text-blue-700 hover:underline"
            >
              {showInactive ? "Hide" : "Show"} inactive ({inactiveCount})
            </button>
          )}
        </div>

        {visible.length === 0 ? (
          <p className="text-sm text-gray-400">No distributors yet.</p>
        ) : (
          <ul className="space-y-2">
            {visible.map((d) => (
              <li
                key={d.id}
                className={`rounded-md border p-3 transition-shadow hover:shadow-md ${
                  d.active ? "border-gray-200" : "border-gray-200 bg-gray-50 opacity-70"
                }`}
              >
                {editingId === d.id ? (
                  <div className="space-y-2">
                    <div className="grid sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        placeholder="Name"
                        className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                      />
                      <input
                        type="text"
                        value={editForm.phone}
                        onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                        placeholder="Phone"
                        className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                      />
                      <input
                        type="email"
                        value={editForm.email}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        placeholder="Email"
                        className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                      />
                      <input
                        type="text"
                        value={editForm.notes}
                        onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                        placeholder="Notes"
                        className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div className="flex gap-3 items-center">
                      <button
                        type="button"
                        onClick={() => saveEdit(d.id)}
                        disabled={submitting || !editForm.name.trim()}
                        className="bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-xs font-bold px-3 py-1.5 rounded-md"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="text-xs text-gray-500 hover:underline"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-blue-900 truncate">{d.name}</p>
                        {!d.active && (
                          <span className="text-[10px] font-medium bg-gray-200 text-gray-600 rounded-full px-2 py-0.5">
                            Inactive
                          </span>
                        )}
                      </div>
                      {(d.phone || d.email) && (
                        <p className="text-xs text-gray-500 truncate mt-0.5">
                          {[d.phone, d.email].filter(Boolean).join(" · ")}
                        </p>
                      )}
                      {d.notes && <p className="text-xs text-gray-500 mt-0.5">{d.notes}</p>}
                      {d._count && (
                        <p className="text-[11px] text-gray-400 mt-1">
                          {d._count.jobs} job(s) · {d._count.calendarEvents} shift(s)
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        type="button"
                        onClick={() => startEdit(d)}
                        className="text-xs font-semibold text-blue-700 hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setActive(d.id, !d.active)}
                        className={`text-xs hover:underline ${
                          d.active ? "text-red-600" : "text-emerald-700 font-semibold"
                        }`}
                      >
                        {d.active ? "Deactivate" : "Reactivate"}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
