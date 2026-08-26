"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SOURCE_LABELS, PRIORITIES, PRIORITY_LABELS } from "@/lib/crm-constants";

type Duplicate = { id: string; name: string; email: string | null; phone: string | null };

export default function AddLeadForm({ users }: { users: { id: string; name: string }[] }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    postcode: "",
    businessName: "",
    addressArea: "",
    dealValue: "",
    leafletQuantity: "",
    targetAreas: "",
    printingIncluded: false,
    designIncluded: false,
    source: "INSTAGRAM_DM",
    priority: "MEDIUM",
    assignedToId: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ leadId: string; duplicates: Duplicate[] } | null>(null);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.postcode.trim()) {
      setError("Postcode is required.");
      return;
    }
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/crm/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        dealValue: form.dealValue || null,
        assignedToId: form.assignedToId || null,
      }),
    });

    setSubmitting(false);

    if (!res.ok) {
      setError("Something went wrong saving this lead.");
      return;
    }

    const { lead, duplicates } = await res.json();

    if (duplicates && duplicates.length > 0) {
      // Don't block creation — the lead is already saved — but pause here
      // so staff can see the possible match before moving on.
      setResult({ leadId: lead.id, duplicates });
      return;
    }

    router.push(`/admin/crm/leads/${lead.id}`);
  }

  const input = (
    key: keyof typeof form,
    label: string,
    opts: { required?: boolean; type?: string } = {}
  ) => (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">
        {label} {opts.required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={opts.type ?? "text"}
        required={opts.required}
        value={form[key] as string}
        onChange={(e) => set(key, e.target.value as never)}
        className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );

  if (result) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-xl font-bold text-blue-900 mb-4">Add Lead</h1>
        <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-5 space-y-4">
          <div className="bg-yellow-50 border border-yellow-300 rounded-md px-4 py-3">
            <p className="text-sm font-semibold text-yellow-800 mb-2">
              This lead was saved, but it may be a duplicate:
            </p>
            <ul className="space-y-1">
              {result.duplicates.map((d) => (
                <li key={d.id}>
                  <Link href={`/admin/crm/leads/${d.id}`} className="text-sm text-blue-700 hover:underline">
                    {d.name} {d.email ? `— ${d.email}` : d.phone ? `— ${d.phone}` : ""}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <Link
            href={`/admin/crm/leads/${result.leadId}`}
            className="inline-block bg-blue-700 hover:bg-blue-800 text-white font-bold px-5 py-2.5 rounded-md text-sm"
          >
            Continue to New Lead
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold text-blue-900 mb-4">Add Lead</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-4 sm:p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {input("name", "Name", { required: true })}
          {input("phone", "Phone")}
          {input("email", "Email", { type: "email" })}
          {input("postcode", "Postcode", { required: true })}
          {input("businessName", "Business / Organisation")}
          {input("addressArea", "Address / Area")}
          {input("targetAreas", "Target Area(s)")}
          {input("leafletQuantity", "Leaflet Quantity")}
          {input("dealValue", "Deal Value (£)", { type: "number" })}

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Source</label>
            <select
              value={form.source}
              onChange={(e) => set("source", e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm bg-white"
            >
              {Object.entries(SOURCE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Priority</label>
            <select
              value={form.priority}
              onChange={(e) => set("priority", e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm bg-white"
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Assigned To</label>
            <select
              value={form.assignedToId}
              onChange={(e) => set("assignedToId", e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm bg-white"
            >
              <option value="">Unassigned</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.printingIncluded}
              onChange={(e) => set("printingIncluded", e.target.checked)}
              className="h-4 w-4"
            />
            Printing included
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.designIncluded}
              onChange={(e) => set("designIncluded", e.target.checked)}
              className="h-4 w-4"
            />
            Design included
          </label>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white font-bold px-5 py-2.5 rounded-md text-sm"
        >
          {submitting ? "Saving..." : "Save Lead"}
        </button>
      </form>
    </div>
  );
}
