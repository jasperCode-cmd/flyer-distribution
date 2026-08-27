"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import QuickLogModal from "./QuickLogModal";
import LostReasonModal from "./LostReasonModal";
import ScheduleFollowUpModal from "./ScheduleFollowUpModal";
import {
  STAGE_LABELS,
  SOURCE_LABELS,
  STAGES,
  PRIORITIES,
  PRIORITY_LABELS,
  LOST_REASON_LABELS,
  REVIEW_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_AUTOFILL_FRACTION,
  isOverdue,
} from "@/lib/crm-constants";

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(n);
}

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

type Tag = { id: string; name: string; color: string };

type Task = {
  id: string;
  description: string;
  dueDate: string;
  completed: boolean;
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
  priority: string;
  atRisk: boolean;
  lostReason: string | null;
  lostReasonNote: string | null;
  reviewStatus: string;
  paymentStatus: string;
  amountPaid: string | null;
  assignedToId: string | null;
  createdAt: string;
  activities: Activity[];
  job: Job | null;
  tags: Tag[];
  tasks: Task[];
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
    priority: lead.priority,
    assignedToId: lead.assignedToId ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [stage, setStage] = useState(lead.stage);
  const [atRisk, setAtRisk] = useState(lead.atRisk);
  const [lostReason, setLostReason] = useState(lead.lostReason);
  const [lostReasonNote, setLostReasonNote] = useState(lead.lostReasonNote);
  const [lostPromptOpen, setLostPromptOpen] = useState(false);

  const [reviewStatus, setReviewStatus] = useState(lead.reviewStatus);
  const [paymentStatus, setPaymentStatus] = useState(lead.paymentStatus);
  const [amountPaid, setAmountPaid] = useState(lead.amountPaid ?? "");

  function patchLead(body: Record<string, unknown>) {
    return fetch(`/api/crm/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  // Picking a status pre-fills the amount from the deal value where there is
  // a sensible share to take (50% deposit, 100% in full). Partial has no
  // default — the figure is arbitrary, so the user types it. With no deal
  // value there is nothing to derive from, so every status just leaves the
  // field open to type into. The pre-filled figure stays editable either way.
  function onPaymentStatusChange(next: string) {
    setPaymentStatus(next);

    const dealValue = lead.dealValue ? Number(lead.dealValue) : null;
    const fraction = PAYMENT_AUTOFILL_FRACTION[next];

    let nextAmount: string;
    if (next === "NOT_PAID") {
      // Leaving a figure against "Not Paid" would misreport the lead; it is
      // one click to restore by choosing a paid status again.
      nextAmount = "";
    } else if (fraction !== undefined && dealValue !== null && !Number.isNaN(dealValue)) {
      nextAmount = (dealValue * fraction).toFixed(2);
    } else {
      nextAmount = amountPaid;
    }

    setAmountPaid(nextAmount);
    patchLead({ paymentStatus: next, amountPaid: nextAmount === "" ? null : nextAmount });
  }

  const dealValueNumber = lead.dealValue ? Number(lead.dealValue) : null;
  const amountPaidNumber = amountPaid === "" ? null : Number(amountPaid);
  // Flagged rather than blocked: revised quotes, fees and overpayments are
  // all real, so this warns without preventing the save.
  const overpaid =
    dealValueNumber !== null &&
    amountPaidNumber !== null &&
    !Number.isNaN(amountPaidNumber) &&
    amountPaidNumber > dealValueNumber;

  const [modalOpen, setModalOpen] = useState<"call" | "email" | null>(null);
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [tags, setTags] = useState(lead.tags);

  const [tasks, setTasks] = useState(lead.tasks);
  const [followUpModalOpen, setFollowUpModalOpen] = useState(false);

  useEffect(() => {
    fetch("/api/crm/tags")
      .then((r) => r.json())
      .then((d) => setAllTags(d.tags ?? []))
      .catch(() => {});
  }, []);

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

  async function commitStage(newStage: string, extra?: { lostReason?: string; lostReasonNote?: string }) {
    setStage(newStage);
    if (extra) {
      setLostReason(extra.lostReason ?? null);
      setLostReasonNote(extra.lostReasonNote ?? null);
    }
    await fetch(`/api/crm/leads/${lead.id}/stage`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: newStage, ...extra }),
    });
    router.refresh();
  }

  function changeStage(newStage: string) {
    if (newStage === "LOST") {
      setLostPromptOpen(true);
      return;
    }
    commitStage(newStage);
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

  async function addTag(tagId: string) {
    const tag = allTags.find((t) => t.id === tagId);
    if (!tag) return;
    setTags((prev) => [...prev, tag]);
    await fetch(`/api/crm/leads/${lead.id}/tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagId: tag.id }),
    });
  }

  async function removeTag(tagId: string) {
    setTags((prev) => prev.filter((t) => t.id !== tagId));
    await fetch(`/api/crm/leads/${lead.id}/tags`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagId }),
    });
  }

  async function addFollowUp(description: string, dueDate: string) {
    const res = await fetch(`/api/crm/leads/${lead.id}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description, dueDate }),
    });
    if (res.ok) {
      const { task } = await res.json();
      setTasks((prev) => [...prev, task]);
    }
  }

  async function toggleTask(taskId: string, completed: boolean) {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, completed } : t)));
    await fetch(`/api/crm/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed }),
    });
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

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-4">
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
            <label className="block text-xs font-medium text-gray-500 mb-1">Priority</label>
            <select
              value={form.priority}
              onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-2 py-2 text-sm bg-white"
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

        {stage === "LOST" && (
          <div className="mt-3 bg-gray-50 border border-gray-200 rounded-md px-3 py-2.5">
            <label className="block text-xs font-medium text-gray-500 mb-1">Lost Reason</label>
            <select
              value={lostReason ?? ""}
              onChange={(e) => {
                const value = e.target.value;
                setLostReason(value || null);
                fetch(`/api/crm/leads/${lead.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ lostReason: value || null }),
                });
              }}
              className="w-full sm:w-64 border border-gray-300 rounded-md px-2 py-2 text-sm bg-white"
            >
              <option value="">Not set</option>
              {Object.entries(LOST_REASON_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            {lostReasonNote && (
              <p className="text-sm text-gray-600 mt-2">{lostReasonNote}</p>
            )}
          </div>
        )}

        {/* Only meaningful once the lead is Won — same conditional pattern as
            the Lost Reason block above. */}
        {stage === "WON" && (
          <div className="mt-3 bg-gray-50 border border-gray-200 rounded-md px-3 py-2.5">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Review Status</label>
                <select
                  value={reviewStatus}
                  onChange={(e) => {
                    const value = e.target.value;
                    setReviewStatus(value);
                    patchLead({ reviewStatus: value });
                  }}
                  className="w-full border border-gray-300 rounded-md px-2 py-2 text-sm bg-white"
                >
                  {Object.entries(REVIEW_STATUS_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Payment Status</label>
                <select
                  value={paymentStatus}
                  onChange={(e) => onPaymentStatusChange(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-2 py-2 text-sm bg-white"
                >
                  {Object.entries(PAYMENT_STATUS_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            </div>

            {paymentStatus !== "NOT_PAID" && (
              <div className="mt-3">
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Amount Paid
                  {lead.dealValue && (
                    <span className="text-gray-400 font-normal">
                      {" "}
                      · quoted {formatCurrency(Number(lead.dealValue))}
                    </span>
                  )}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  onBlur={() =>
                    patchLead({ amountPaid: amountPaid === "" ? null : amountPaid })
                  }
                  placeholder={lead.dealValue ? "" : "Enter amount"}
                  className="w-full sm:w-48 border border-gray-300 rounded-md px-2 py-2 text-sm"
                />
                {overpaid && (
                  <p className="text-xs text-amber-700 mt-1">
                    Amount paid is more than the quoted deal value.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tags */}
        <div className="flex flex-wrap items-center gap-1.5 mt-3">
          {tags.map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full text-white"
              style={{ backgroundColor: t.color }}
            >
              {t.name}
              <button
                type="button"
                onClick={() => removeTag(t.id)}
                aria-label={`Remove ${t.name}`}
                className="opacity-80 hover:opacity-100"
              >
                ×
              </button>
            </span>
          ))}
          <select
            value=""
            onChange={(e) => e.target.value && addTag(e.target.value)}
            className="text-xs border border-gray-300 rounded-full px-2 py-1 bg-white text-gray-500"
          >
            <option value="">+ Add tag</option>
            {allTags
              .filter((t) => !tags.some((existing) => existing.id === t.id))
              .map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
          </select>
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

      {/* Follow-up tasks */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-blue-900">Follow-ups</h2>
          <button
            type="button"
            onClick={() => setFollowUpModalOpen(true)}
            className="text-xs font-semibold text-blue-700 hover:underline"
          >
            + Schedule follow-up
          </button>
        </div>
        {tasks.filter((t) => !t.completed).length === 0 ? (
          <p className="text-sm text-gray-400">No open follow-ups.</p>
        ) : (
          <ul className="space-y-2">
            {tasks
              .filter((t) => !t.completed)
              .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
              .map((t) => (
                <li key={t.id} className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={t.completed}
                    onChange={(e) => toggleTask(t.id, e.target.checked)}
                    className="h-4 w-4 mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-700">{t.description}</p>
                    <p className={`text-xs ${isOverdue(t.dueDate) ? "text-red-600 font-semibold" : "text-gray-400"}`}>
                      Due {new Date(t.dueDate).toLocaleDateString("en-GB")}
                      {isOverdue(t.dueDate) && " (overdue)"}
                    </p>
                  </div>
                </li>
              ))}
          </ul>
        )}
      </div>

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
      <LostReasonModal
        open={lostPromptOpen}
        onCancel={() => setLostPromptOpen(false)}
        onConfirm={(reason, note) => {
          commitStage("LOST", { lostReason: reason, lostReasonNote: note });
          setLostPromptOpen(false);
        }}
      />
      <ScheduleFollowUpModal
        open={followUpModalOpen}
        onClose={() => setFollowUpModalOpen(false)}
        onSave={addFollowUp}
      />
    </div>
  );
}
