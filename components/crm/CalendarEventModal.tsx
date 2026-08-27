"use client";

import { useEffect, useState } from "react";
import {
  CALENDAR_EVENT_TYPES,
  CALENDAR_EVENT_TYPE_LABELS,
  toLocalInputValue,
  type CalendarEntry,
} from "@/lib/calendar-constants";

type Option = { id: string; name: string };

export default function CalendarEventModal({
  open,
  entry,
  defaultDate,
  users,
  distributors,
  leads,
  jobs,
  onClose,
  onSaved,
  onDeleted,
}: {
  open: boolean;
  // null = creating a new event; otherwise editing this stored event.
  entry: CalendarEntry | null;
  defaultDate: Date | null;
  users: Option[];
  distributors: Option[];
  leads: Option[];
  jobs: Option[];
  onClose: () => void;
  onSaved: () => void;
  onDeleted: (id: string) => void;
}) {
  const [type, setType] = useState<string>("CALL");
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [notes, setNotes] = useState("");
  const [assignedToUserId, setAssignedToUserId] = useState("");
  const [distributorId, setDistributorId] = useState("");
  const [linkedLeadId, setLinkedLeadId] = useState("");
  const [linkedJobId, setLinkedJobId] = useState("");
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Re-seed the form whenever the modal is opened for a different entry.
  useEffect(() => {
    if (!open) return;
    if (entry) {
      setType(entry.type);
      setTitle(entry.title);
      setStart(toLocalInputValue(entry.start));
      setEnd(toLocalInputValue(entry.end));
      setNotes(entry.notes ?? "");
      setAssignedToUserId(entry.assignedToUserId ?? "");
      setDistributorId(entry.distributorId ?? "");
      setLinkedLeadId(entry.linkedLeadId ?? "");
      setLinkedJobId(entry.linkedJobId ?? "");
      setCompleted(entry.completed);
    } else {
      const seed = defaultDate ?? new Date();
      const at9 = new Date(seed);
      at9.setHours(9, 0, 0, 0);
      setType("CALL");
      setTitle("");
      setStart(toLocalInputValue(at9.toISOString()));
      setEnd("");
      setNotes("");
      setAssignedToUserId("");
      setDistributorId("");
      setLinkedLeadId("");
      setLinkedJobId("");
      setCompleted(false);
    }
    setError("");
  }, [open, entry, defaultDate]);

  if (!open) return null;

  const isShift = type === "DISTRIBUTOR_SHIFT";
  const isCallLike = type === "CALL" || type === "COLD_CALL_BLOCK";

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !start) return;
    setSubmitting(true);
    setError("");

    const payload = {
      type,
      title: title.trim(),
      startDateTime: new Date(start).toISOString(),
      endDateTime: end ? new Date(end).toISOString() : null,
      notes,
      assignedToUserId: isCallLike ? assignedToUserId : "",
      distributorId: isShift ? distributorId : "",
      linkedLeadId: isCallLike ? linkedLeadId : "",
      linkedJobId: isShift ? linkedJobId : "",
      completed,
    };

    const res = await fetch(
      entry ? `/api/crm/calendar-events/${entry.id}` : "/api/crm/calendar-events",
      {
        method: entry ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );

    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Something went wrong.");
      return;
    }

    onSaved();
  }

  async function remove() {
    if (!entry) return;
    setSubmitting(true);
    await fetch(`/api/crm/calendar-events/${entry.id}`, { method: "DELETE" });
    setSubmitting(false);
    onDeleted(entry.id);
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <form
        onSubmit={save}
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full sm:max-w-lg rounded-t-xl sm:rounded-xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] max-h-[90vh] overflow-y-auto"
      >
        <h3 className="text-sm font-bold text-blue-900 mb-3">
          {entry ? "Edit Event" : "New Event"}
        </h3>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm bg-white"
            >
              {CALENDAR_EVENT_TYPES.map((t) => (
                <option key={t} value={t}>{CALENDAR_EVENT_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Starts</label>
              <input
                type="datetime-local"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Ends <span className="text-gray-400">(optional)</span>
              </label>
              <input
                type="datetime-local"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm"
              />
            </div>
          </div>

          {isShift && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Distributor</label>
                <select
                  value={distributorId}
                  onChange={(e) => setDistributorId(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm bg-white"
                >
                  <option value="">No distributor</option>
                  {distributors.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Linked job <span className="text-gray-400">(optional)</span>
                </label>
                <select
                  value={linkedJobId}
                  onChange={(e) => setLinkedJobId(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm bg-white"
                >
                  <option value="">No linked job</option>
                  {jobs.map((j) => (
                    <option key={j.id} value={j.id}>{j.name}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {isCallLike && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Linked lead <span className="text-gray-400">(optional)</span>
                </label>
                <select
                  value={linkedLeadId}
                  onChange={(e) => setLinkedLeadId(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm bg-white"
                >
                  <option value="">No linked lead</option>
                  {leads.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Assigned to <span className="text-gray-400">(optional)</span>
                </label>
                <select
                  value={assignedToUserId}
                  onChange={(e) => setAssignedToUserId(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm bg-white"
                >
                  <option value="">Unassigned</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Notes <span className="text-gray-400">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {entry && (
            <label className="flex items-center gap-2 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={completed}
                onChange={(e) => setCompleted(e.target.checked)}
                className="h-3.5 w-3.5"
              />
              Mark as done
            </label>
          )}
        </div>

        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

        <div className="flex gap-2 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 border border-gray-300 text-gray-700 text-sm font-medium py-2.5 rounded-md"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !title.trim() || !start}
            className="flex-1 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-bold py-2.5 rounded-md"
          >
            {entry ? "Save" : "Create"}
          </button>
        </div>

        {entry && (
          <button
            type="button"
            onClick={remove}
            disabled={submitting}
            className="w-full text-xs text-red-600 hover:underline mt-3"
          >
            Delete event
          </button>
        )}
      </form>
    </div>
  );
}
