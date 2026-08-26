"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import QuickLogModal from "./QuickLogModal";
import { STAGE_LABELS, SOURCE_LABELS, STAGES } from "@/lib/crm-constants";

type Activity = {
  id: string;
  type: string;
  detail: string;
  createdAt: string;
  user: { name: string } | null;
};

type Job = {
  id: string;
  printStatus: string;
  designStatus: string;
  distributorName: string | null;
  campaignStartDate: string | null;
  completionDate: string | null;
  deliveryConfirmed: boolean;
  deliveryProofNote: string | null;
  status: string;
};

export type LeadDetailData = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  postcode: string | null;
  businessName: string | null;
  addressArea: string | null;
  dealValue: string | null;
  leafletQuantity: string | null;
  targetAreas: string | null;
  printingIncluded: boolean;
  designIncluded: boolean;
  source: string;
  stage: string;
  atRisk: boolean;
  assignedToId: string | null;
  createdAt: string;
  activities: Activity[];
  job: Job | null;
};

const ACTIVITY_LABELS: Record<string, string> = {
  CALL: "Call",
  EMAIL: "Email",
  NOTE: "Note",
  STAGE_CHANGE: "Stage Change",
};

const WORK_STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  DONE: "Done",
};

const JOB_STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
};

export default function LeadDetail({
  lead,
  users,
}: {
  lead: LeadDetailData;
  users: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    phone: lead.phone ?? "",
    email: lead.email ?? "",
    postcode: lead.postcode ?? "",
    businessName: lead.businessName ?? "",
    addressArea: lead.addressArea ?? "",
    dealValue: lead.dealValue ?? "",
    leafletQuantity: lead.leafletQuantity ?? "",
    targetAreas: lead.targetAreas ?? "",
    printingIncluded: lead.printingIncluded,
    designIncluded: lead.designIncluded,
    source: lead.source,
    assignedToId: lead.assignedToId ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [stage, setStage] = useState(lead.stage);
  const [atRisk, setAtRisk] = useState(lead.atRisk);

  const [modalOpen, setModalOpen] = useState<"call" | "email" | null>(null);
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  async function saveFields() {
    setSaving(true);
    await fetch(`/api/crm/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        dealValue: form.dealValue === "" ? null : form.dealValue,
        assignedToId: form.assignedToId || null,
      }),
    });
    setSaving(false);
    setSaved(true);
    router.refresh();
    setTimeout(() => setSaved(false), 2000);
  }

  async function changeStage(newStage: string) {
    setStage(newStage);
    await fetch(`/api/crm/leads/${lead.id}/stage`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: newStage }),
    });
    router.refresh();
  }

  async function toggleAtRisk() {
    const next = !atRisk;
    setAtRisk(next);
    await fetch(`/api/crm/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ atRisk: next }),
    });
    router.refresh();
  }

  async function logActivity(type: string, detail: string) {
    await fetch(`/api/crm/leads/${lead.id}/activities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, detail }),
    });
    router.refresh();
  }

  async function addNote() {
    if (!newNote.trim()) return;
    setAddingNote(true);
    await logActivity("NOTE", newNote.trim());
    setNewNote("");
    setAddingNote(false);
  }

  async function updateJob(field: string, value: unknown) {
    if (!lead.job) return;
    await fetch(`/api/crm/jobs/${lead.job.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    router.refresh();
  }

  const field = (
    key: keyof typeof form,
    label: string,
    type: "text" | "number" = "text"
  ) => (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <input
        type={type}
        value={form[key] as string}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-blue-900 truncate">{lead.name}</h1>
            {lead.businessName && (
              <p className="text-sm text-gray-500">{lead.businessName}</p>
            )}
          </div>
          <button
            type="button"
            onClick={toggleAtRisk}
            className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-md border transition-colors ${
              atRisk
                ? "bg-red-50 text-red-600 border-red-300"
                : "bg-white text-gray-500 border-gray-300"
            }`}
          >
            {atRisk ? "⚑ At Risk" : "Mark At Risk"}
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Stage</label>
            <select
              value={stage}
              onChange={(e) => changeStage(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-2 py-2 text-sm bg-white"
            >
              {STAGES.map((s) => (
                <option key={s} value={s}>{STAGE_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Assigned To</label>
            <select
              value={form.assignedToId}
              onChange={(e) => setForm((f) => ({ ...f, assignedToId: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-2 py-2 text-sm bg-white"
            >
              <option value="">Unassigned</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Source</label>
            <select
              value={form.source}
              onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-2 py-2 text-sm bg-white"
            >
              {Object.entries(SOURCE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Created</label>
            <p className="text-sm text-gray-700 py-2">
              {new Date(lead.createdAt).toLocaleDateString("en-GB")}
            </p>
          </div>
        </div>

        {/* Call / Email quick actions */}
        <div className="flex gap-2 mt-4">
          <a
            href={lead.phone ? `tel:${lead.phone}` : undefined}
            onClick={() => lead.phone && setModalOpen("call")}
            className={`flex-1 text-center text-sm font-bold py-2.5 rounded-md transition-colors ${
              lead.phone
                ? "bg-blue-700 hover:bg-blue-800 text-white"
                : "bg-gray-100 text-gray-400 pointer-events-none"
            }`}
          >
            Call
          </a>
          <a
            href={lead.email ? `mailto:${lead.email}` : undefined}
            onClick={() => lead.email && setModalOpen("email")}
            className={`flex-1 text-center text-sm font-bold py-2.5 rounded-md transition-colors ${
              lead.email
                ? "bg-yellow-400 hover:bg-yellow-300 text-blue-900"
                : "bg-gray-100 text-gray-400 pointer-events-none"
            }`}
          >
            Email
          </a>
        </div>
      </div>

      {/* Editable details */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-5">
        <h2 className="text-sm font-bold text-blue-900 mb-3">Lead Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {field("phone", "Phone")}
          {field("email", "Email")}
          {field("postcode", "Postcode")}
          {field("businessName", "Business / Organisation")}
          {field("addressArea", "Address / Area")}
          {field("targetAreas", "Target Area(s)")}
          {field("leafletQuantity", "Leaflet Quantity")}
          {field("dealValue", "Deal Value (£)", "number")}
        </div>
        <div className="flex gap-6 mt-3">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.printingIncluded}
              onChange={(e) => setForm((f) => ({ ...f, printingIncluded: e.target.checked }))}
              className="h-4 w-4"
            />
            Printing included
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.designIncluded}
              onChange={(e) => setForm((f) => ({ ...f, designIncluded: e.target.checked }))}
              className="h-4 w-4"
            />
            Design included
          </label>
        </div>
        <div className="flex items-center gap-3 mt-4">
          <button
            type="button"
            onClick={saveFields}
            disabled={saving}
            className="bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-bold px-4 py-2 rounded-md"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
          {saved && <span className="text-xs text-green-600">Saved.</span>}
        </div>
      </div>

      {/* Job (only present once Won) */}
      {lead.job && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-5">
          <h2 className="text-sm font-bold text-blue-900 mb-3">Job</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Print Status</label>
              <select
                defaultValue={lead.job.printStatus}
                onChange={(e) => updateJob("printStatus", e.target.value)}
                className="w-full border border-gray-300 rounded-md px-2 py-2 text-sm bg-white"
              >
                {Object.entries(WORK_STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Design Status</label>
              <select
                defaultValue={lead.job.designStatus}
                onChange={(e) => updateJob("designStatus", e.target.value)}
                className="w-full border border-gray-300 rounded-md px-2 py-2 text-sm bg-white"
              >
                {Object.entries(WORK_STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Distributor</label>
              <input
                type="text"
                defaultValue={lead.job.distributorName ?? ""}
                onBlur={(e) => updateJob("distributorName", e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Overall Status</label>
              <select
                defaultValue={lead.job.status}
                onChange={(e) => updateJob("status", e.target.value)}
                className="w-full border border-gray-300 rounded-md px-2 py-2 text-sm bg-white"
              >
                {Object.entries(JOB_STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Campaign Start</label>
              <input
                type="date"
                defaultValue={lead.job.campaignStartDate?.slice(0, 10) ?? ""}
                onChange={(e) => updateJob("campaignStartDate", e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Completion Date</label>
              <input
                type="date"
                defaultValue={lead.job.completionDate?.slice(0, 10) ?? ""}
                onChange={(e) => updateJob("completionDate", e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="mt-3">
            <label className="flex items-center gap-2 text-sm text-gray-700 mb-2">
              <input
                type="checkbox"
                defaultChecked={lead.job.deliveryConfirmed}
                onChange={(e) => updateJob("deliveryConfirmed", e.target.checked)}
                className="h-4 w-4"
              />
              Delivery confirmed
            </label>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Strava Proof Link / Note
            </label>
            <input
              type="text"
              defaultValue={lead.job.deliveryProofNote ?? ""}
              onBlur={(e) => updateJob("deliveryProofNote", e.target.value)}
              placeholder="https://strava.com/... or a note"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
        </div>
      )}

      {/* Activity timeline */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-5">
        <h2 className="text-sm font-bold text-blue-900 mb-3">Activity</h2>

        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Add a note..."
            className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={addNote}
            disabled={addingNote || !newNote.trim()}
            className="bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-semibold px-4 rounded-md"
          >
            Add
          </button>
        </div>

        {lead.activities.length === 0 ? (
          <p className="text-sm text-gray-400">No activity logged yet.</p>
        ) : (
          <ul className="space-y-3">
            {lead.activities.map((a) => (
              <li key={a.id} className="border-l-2 border-blue-100 pl-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-blue-700">
                    {ACTIVITY_LABELS[a.type] ?? a.type}
                  </span>
                  <span className="text-[11px] text-gray-400">
                    {new Date(a.createdAt).toLocaleString("en-GB")}
                  </span>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{a.detail}</p>
                {a.user && <p className="text-[11px] text-gray-400">{a.user.name}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <QuickLogModal
        open={modalOpen === "call"}
        onClose={() => setModalOpen(null)}
        defaultText={`Called ${lead.name}`}
        onSave={(detail) => logActivity("CALL", detail)}
      />
      <QuickLogModal
        open={modalOpen === "email"}
        onClose={() => setModalOpen(null)}
        defaultText={`Emailed ${lead.name}`}
        onSave={(detail) => logActivity("EMAIL", detail)}
      />
    </div>
  );
}
