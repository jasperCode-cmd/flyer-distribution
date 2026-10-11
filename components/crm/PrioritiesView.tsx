"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import EmailComposeModal, { sentLabel, type ReplyContext } from "./EmailComposeModal";
import type { ConversationMessage } from "./EmailsSection";
import LostReasonModal from "./LostReasonModal";
import PriorityRowCard, { type RowHandlers } from "./PriorityRowCard";
import { trapTab } from "./profit-ui";
import {
  awaitingItem,
  canMarkLost,
  filterRows,
  GROUP_LABELS,
  GROUP_PREVIEW,
  groupRows,
  isPriorityLevel,
  LEVEL_LABELS,
  PRIORITIES_CHANGED_EVENT,
  PRIORITY_LEVELS,
  REASON_TYPES,
  removeItem,
  SNOOZE_DAYS,
  STILL_IN_TALKS_DAYS,
  ukDay,
  urgentHighCount,
  type PriorityAction,
  type PriorityEmailStatus,
  type PriorityItem,
  type PriorityLevel,
  type PriorityList,
  type PriorityRow,
  type ReasonType,
} from "@/lib/priorities";

type Toast = { text: string; kind: "success" | "error" };
type EmailLead = { id: string; name: string; email: string };
type Compose = { lead: EmailLead; latestReply: ReplyContext | null; configured: boolean; configuredKnown: boolean };
type BulkResult = { id: string; status: "done" | "skipped" | "failed"; message?: string };
type Problem = { title: string; lines: string[] };
type LostRequest = { rows: PriorityRow[]; bulk: boolean };

const days = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;

function rowName(row: PriorityRow): string {
  const s = row.primary.subject;
  return s.kind === "none" ? row.primary.title : s.name;
}

function chipClass(active: boolean): string {
  return `inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
    active ? "border-blue-900 bg-blue-900 text-white" : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
  }`;
}

// The Priorities list, grouped by level and then by reason, with a checkbox
// on every row for the bulk bar. The database items come with the page;
// unanswered emails are fetched straight after (Gmail is slower) and merged in.
export default function PrioritiesView({ initial }: { initial: PriorityList }) {
  const { data: session } = useSession();
  const userFirstName = (session?.user?.name ?? "").split(" ")[0] || "the team";
  const [list, setList] = useState(initial);
  const [emailLoading, setEmailLoading] = useState(true);
  const [level, setLevel] = useState<PriorityLevel | "ALL">("ALL");
  const [type, setType] = useState<ReasonType | "ALL">("ALL");
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [adding, setAdding] = useState(false);
  const [compose, setCompose] = useState<Compose | null>(null);
  const [lostFor, setLostFor] = useState<LostRequest | null>(null);
  const loadSeq = useRef(0);
  const composeLeadRef = useRef<string | null>(null);
  const listHeadingRef = useRef<HTMLHeadingElement>(null);

  const reload = useCallback(async (options: { fresh?: boolean } = {}) => {
    const seq = ++loadSeq.current;
    try {
      const res = await fetch(`/api/crm/priorities?gmail=1${options.fresh ? "&fresh=1" : ""}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const data: PriorityList = await res.json();
      if (seq === loadSeq.current) setList(data);
    } catch {
      if (seq === loadSeq.current) setToast({ text: "Couldn't refresh the list. Please try again.", kind: "error" });
    } finally {
      if (seq === loadSeq.current) setEmailLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  function changed() {
    window.dispatchEvent(new Event(PRIORITIES_CHANGED_EVENT));
  }

  const now = new Date(list.generatedAt);
  const visible = useMemo(() => filterRows(list.rows, level, type), [list.rows, level, type]);
  const sections = useMemo(() => groupRows(visible, expanded), [visible, expanded]);
  // Only rows still on screen count as selected, so a filter never hides
  // something the bulk bar would act on.
  const selectedRows = visible.filter((r) => selected.has(r.id));
  const pressing = urgentHighCount(list.rows);
  const filtered = level !== "ALL" || type !== "ALL";
  const levelCount = (l: PriorityLevel | "ALL") => filterRows(list.rows, l, type).length;
  const typeCount = (t: ReasonType | "ALL") => filterRows(list.rows, level, t).length;

  // --- One row --------------------------------------------------------------

  async function act(entry: PriorityItem, action: PriorityAction, n?: number) {
    setBusyKey(entry.key);
    try {
      const res = await fetch("/api/crm/priorities/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: entry.key, action, days: n }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok && res.status !== 404) {
        setToast({ text: data.error ?? "Failed to save. Please try again.", kind: "error" });
        return;
      }
      setList((prev) => ({ ...prev, rows: removeItem(prev.rows, entry.key) }));
      // Focus would otherwise fall to the page when the row disappears.
      listHeadingRef.current?.focus();
      const text =
        res.status === 404
          ? "That item had already cleared."
          : action === "done"
          ? entry.type === "task"
            ? "Task done"
            : "Marked done"
          : action === "snooze"
          ? `Snoozed for ${days(n ?? 0)}`
          : `Still in talks: back in ${days(n ?? 0)}, noted on the lead`;
      setToast({ text, kind: "success" });
      changed();
      reload();
    } catch {
      setToast({ text: "Failed to save. Please try again.", kind: "error" });
    } finally {
      setBusyKey(null);
    }
  }

  async function setTaskPriority(entry: PriorityItem, next: PriorityLevel) {
    if (!entry.taskId || next === entry.level) return;
    setBusyKey(entry.key);
    try {
      const res = await fetch(`/api/crm/priorities/tasks/${entry.taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setToast({ text: data.error ?? "Failed to save. Please try again.", kind: "error" });
        return;
      }
      setToast({ text: `Priority set to ${LEVEL_LABELS[next]}`, kind: "success" });
      changed();
      await reload();
    } catch {
      setToast({ text: "Failed to save. Please try again.", kind: "error" });
    } finally {
      setBusyKey(null);
    }
  }

  // As on the Kanban card: offers "Reply to latest" when the lead has a
  // conversation. An unanswered email brings its own conversation, so the
  // reply goes in that thread even when the lead only wrote via a form.
  async function openEmail(lead: EmailLead, reply: ReplyContext | null) {
    composeLeadRef.current = lead.id;
    if (reply) {
      setCompose({ lead, latestReply: reply, configured: true, configuredKnown: true });
      return;
    }
    setCompose({ lead, latestReply: null, configured: true, configuredKnown: false });
    let configured = true;
    let latestReply: ReplyContext | null = null;
    try {
      const res = await fetch(`/api/crm/leads/${lead.id}/emails`);
      const data = await res.json();
      configured = data.configured ?? true;
      const messages: ConversationMessage[] = res.ok ? data.messages ?? [] : [];
      const last = messages[messages.length - 1];
      if (last) {
        latestReply = { subject: last.subject, threadId: last.threadId, lastMessageId: last.messageIdHeader ?? "" };
      }
    } catch {
      // Falls back to a fresh email; the send itself reports any Gmail problem.
    }
    if (composeLeadRef.current !== lead.id) return;
    setCompose({ lead, latestReply, configured, configuredKnown: true });
  }

  function closeEmail() {
    composeLeadRef.current = null;
    setCompose(null);
  }

  function emailLeadOf(row: PriorityRow): EmailLead | null {
    const s = row.primary.subject;
    return s.kind === "lead" && s.email?.trim() ? { id: s.id, name: s.name, email: s.email.trim() } : null;
  }

  const handlers: RowHandlers = {
    onAct: act,
    onTaskPriority: setTaskPriority,
    onReply: (row) => {
      const lead = emailLeadOf(row);
      if (lead) openEmail(lead, row.primary.reply);
    },
    onEmail: (row) => {
      const lead = emailLeadOf(row);
      if (lead) openEmail(lead, null);
    },
    onMarkLost: (row) => setLostFor({ rows: [row], bulk: false }),
    onToggle: (rowId) =>
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(rowId)) next.delete(rowId);
        else next.add(rowId);
        return next;
      }),
  };

  // --- Bulk -------------------------------------------------------------------

  // What happened, in a toast, and anything that failed in a panel that
  // stays until it is dismissed. Rows that worked are deselected; the ones
  // that failed stay selected, ready to try again.
  function report(verb: string, results: BulkResult[], rowOf: (id: string) => PriorityRow | undefined, skippedBefore = 0) {
    const done = results.filter((r) => r.status === "done");
    const skipped = results.filter((r) => r.status === "skipped").length + skippedBefore;
    const failed = results.filter((r) => r.status === "failed");
    const parts = [`${verb} for ${done.length}`];
    if (skipped > 0) parts.push(`${skipped} skipped`);
    if (failed.length > 0) parts.push(`${failed.length} failed`);
    setToast({ text: parts.join(", "), kind: failed.length > 0 ? "error" : "success" });
    const nameOf = (id: string) => {
      const row = rowOf(id);
      return row ? rowName(row) : "One item";
    };
    setProblem(
      failed.length > 0
        ? {
            title: `${failed.length} could not be saved. ${failed.length === 1 ? "It is" : "They are"} still selected so you can try again.`,
            lines: failed.map((f) => `${nameOf(f.id)}: ${f.message ?? "Failed to save."}`),
          }
        : null
    );
    setSelected(new Set(failed.map((f) => rowOf(f.id)?.id).filter((id): id is string => !!id)));
  }

  async function postBulk(body: Record<string, unknown>): Promise<BulkResult[] | null> {
    try {
      const res = await fetch("/api/crm/priorities/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setToast({ text: data.error ?? "Failed to save. Please try again.", kind: "error" });
        return null;
      }
      return data.results as BulkResult[];
    } catch {
      setToast({ text: "Failed to save. Please try again.", kind: "error" });
      return null;
    }
  }

  async function bulk(action: PriorityAction, n?: number) {
    const rows = selectedRows;
    const targets =
      action === "still_in_talks"
        ? rows.flatMap((r) => {
            const item = awaitingItem(r);
            return item ? [{ key: item.key, row: r }] : [];
          })
        : rows.map((r) => ({ key: r.primary.key, row: r }));
    const notApplicable = rows.filter((r) => !targets.some((t) => t.row.id === r.id)).map(rowName);
    if (targets.length === 0) return;
    setBulkBusy(true);
    const results = await postBulk({ action, keys: targets.map((t) => t.key), days: n });
    setBulkBusy(false);
    if (!results) return;
    const rowOf = (key: string) => targets.find((t) => t.key === key)?.row;
    const verb = action === "done" ? "Done" : action === "snooze" ? `Snoozed ${days(n ?? 0)}` : `Still in talks, ${days(n ?? 0)}`;
    let rowsNext = list.rows;
    for (const r of results) if (r.status === "done") rowsNext = removeItem(rowsNext, r.id);
    setList((prev) => ({ ...prev, rows: rowsNext }));
    report(verb, results, rowOf, notApplicable.length);
    changed();
    reload();
  }

  async function confirmLost(reason: string, note: string) {
    if (!lostFor) return;
    const leads = lostFor.rows.filter(canMarkLost);
    const rowOf = (id: string) => leads.find((r) => r.primary.subject.kind === "lead" && r.primary.subject.id === id);
    const leadId = (r: PriorityRow) => (r.primary.subject.kind === "lead" ? r.primary.subject.id : "");
    setBulkBusy(true);
    if (!lostFor.bulk) {
      // One lead from its row: the same stage route the lead page uses.
      try {
        const res = await fetch(`/api/crm/leads/${leadId(leads[0])}/stage`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stage: "LOST", lostReason: reason, lostReasonNote: note }),
        });
        const data = await res.json().catch(() => ({}));
        setToast(res.ok ? { text: `${rowName(leads[0])} marked as Lost`, kind: "success" } : { text: data.error ?? "Failed to save.", kind: "error" });
      } catch {
        setToast({ text: "Failed to save. Please try again.", kind: "error" });
      }
    } else {
      const results = await postBulk({ action: "lost", leadIds: leads.map(leadId), lostReason: reason, lostReasonNote: note });
      if (results) report("Marked as Lost", results, rowOf, lostFor.rows.length - leads.length);
    }
    setBulkBusy(false);
    setLostFor(null);
    changed();
    reload();
  }

  function toggleGroup(rows: PriorityRow[]) {
    const all = rows.every((r) => selected.has(r.id));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const r of rows) {
        if (all) next.delete(r.id);
        else next.add(r.id);
      }
      return next;
    });
  }

  const lostRows = lostFor?.rows.filter(canMarkLost) ?? [];
  const talkCount = selectedRows.filter((r) => awaitingItem(r)).length;
  const lostCount = selectedRows.filter(canMarkLost).length;

  return (
    <div className={`space-y-4 ${selectedRows.length > 0 ? "pb-28 sm:pb-20" : ""}`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-blue-900">Priorities</h1>
          <p className="text-sm text-gray-600">
            {list.rows.length === 0 ? "Nothing needs doing right now." : `${list.rows.length} to do, ${pressing} urgent or high.`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center rounded-md bg-blue-900 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400"
        >
          Add task
        </button>
      </div>

      <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-3">
        <div role="group" aria-label="Level" className="flex flex-wrap items-center gap-1.5">
          <span className="w-12 text-xs font-medium text-gray-500">Level</span>
          {(["ALL", ...PRIORITY_LEVELS] as const).map((l) => (
            <button key={l} type="button" aria-pressed={level === l} onClick={() => setLevel(l)} className={chipClass(level === l)}>
              {l === "ALL" ? "All" : LEVEL_LABELS[l]}
              <span className={level === l ? "text-blue-100" : "text-gray-500"}>{levelCount(l)}</span>
            </button>
          ))}
        </div>
        <div role="group" aria-label="Type" className="flex flex-wrap items-center gap-1.5">
          <span className="w-12 text-xs font-medium text-gray-500">Type</span>
          <button type="button" aria-pressed={type === "ALL"} onClick={() => setType("ALL")} className={chipClass(type === "ALL")}>
            All types <span className={type === "ALL" ? "text-blue-100" : "text-gray-500"}>{typeCount("ALL")}</span>
          </button>
          {REASON_TYPES.filter((t) => typeCount(t) > 0 || type === t).map((t) => (
            <button key={t} type="button" aria-pressed={type === t} onClick={() => setType(t)} className={chipClass(type === t)}>
              {GROUP_LABELS[t]} <span className={type === t ? "text-blue-100" : "text-gray-500"}>{typeCount(t)}</span>
            </button>
          ))}
          {filtered && (
            <button
              type="button"
              onClick={() => {
                setLevel("ALL");
                setType("ALL");
              }}
              className="ml-1 text-xs font-medium text-blue-800 underline"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      <EmailNote loading={emailLoading} email={list.email} onRefresh={() => reload({ fresh: true })} />

      {problem && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          <div className="flex items-start justify-between gap-3">
            <p className="font-medium">{problem.title}</p>
            <button type="button" onClick={() => setProblem(null)} className="shrink-0 text-xs font-medium underline">
              Dismiss
            </button>
          </div>
          <ul className="mt-1 list-disc pl-5 text-xs">
            {problem.lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
      )}

      <h2 ref={listHeadingRef} tabIndex={-1} className="sr-only">
        {filtered ? `${visible.length} of ${list.rows.length} shown` : "The list"}
      </h2>

      {sections.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-500">
          {filtered ? "Nothing matches these filters." : "Nothing needs doing right now."}
        </div>
      ) : (
        sections.map((section) => (
          <section key={section.level} aria-labelledby={`priorities-${section.level}`} className="space-y-2">
            <h3 id={`priorities-${section.level}`} className="flex items-center gap-2 text-sm font-bold text-blue-900">
              {LEVEL_LABELS[section.level]}
              <span className="text-xs font-medium text-gray-500">{section.count}</span>
            </h3>
            {section.groups.map((group) => {
              const all = group.rows.every((r) => selected.has(r.id));
              const some = !all && group.rows.some((r) => selected.has(r.id));
              return (
                <div key={group.id} className="sm:overflow-hidden sm:rounded-lg sm:border sm:border-gray-200 sm:bg-white">
                  <div className="flex items-center gap-3 px-3 py-1.5 sm:border-b sm:border-gray-100 sm:bg-gray-50/70 sm:px-4">
                    <input
                      type="checkbox"
                      checked={all}
                      ref={(el) => {
                        if (el) el.indeterminate = some;
                      }}
                      onChange={() => toggleGroup(group.rows)}
                      aria-label={`Select all ${group.rows.length} in ${group.label}`}
                      className="h-4 w-4 accent-blue-700"
                    />
                    <h4 className="text-xs font-semibold text-gray-700">
                      {group.label} <span className="font-normal text-gray-500">({group.rows.length})</span>
                    </h4>
                  </div>
                  <ul className="space-y-2 sm:space-y-0 sm:divide-y sm:divide-gray-100">
                    {group.shown.map((row) => (
                      <PriorityRowCard
                        key={row.id}
                        row={row}
                        now={now}
                        selected={selected.has(row.id)}
                        busy={busyKey !== null && [row.primary, ...row.others].some((i) => i.key === busyKey)}
                        handlers={handlers}
                      />
                    ))}
                  </ul>
                  {(group.hidden > 0 || group.rows.length > GROUP_PREVIEW) && (
                    <div className="px-3 py-2 sm:border-t sm:border-gray-100 sm:px-4">
                      <button
                        type="button"
                        aria-expanded={group.hidden === 0}
                        onClick={() =>
                          setExpanded((prev) => {
                            const next = new Set(prev);
                            if (next.has(group.id)) next.delete(group.id);
                            else next.add(group.id);
                            return next;
                          })
                        }
                        className="text-xs font-semibold text-blue-800 hover:underline"
                      >
                        {group.hidden > 0 ? `Show all ${group.rows.length}` : "Show fewer"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        ))
      )}

      {selectedRows.length > 0 && (
        <div
          role="region"
          aria-label="Bulk actions"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white px-3 py-2.5 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] pb-[max(0.625rem,env(safe-area-inset-bottom))] sm:inset-x-auto sm:bottom-4 sm:left-1/2 sm:-translate-x-1/2 sm:rounded-xl sm:border sm:px-4"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-sm font-semibold text-gray-900">{selectedRows.length} selected</span>
            <BulkDaysMenu
              label={`Still in talks${talkCount !== selectedRows.length ? ` (${talkCount})` : ""}`}
              choices={STILL_IN_TALKS_DAYS}
              disabled={bulkBusy || talkCount === 0}
              onPick={(n) => bulk("still_in_talks", n)}
            />
            <BulkDaysMenu label="Snooze" choices={SNOOZE_DAYS} disabled={bulkBusy} onPick={(n) => bulk("snooze", n)} />
            <button type="button" disabled={bulkBusy} onClick={() => bulk("done")} className={BULK_BUTTON}>
              Done
            </button>
            <button
              type="button"
              disabled={bulkBusy || lostCount === 0}
              onClick={() => setLostFor({ rows: selectedRows, bulk: true })}
              className={`${BULK_BUTTON} border-red-200 text-red-700 hover:bg-red-50`}
            >
              Mark as Lost{lostCount !== selectedRows.length ? ` (${lostCount})` : ""}
            </button>
            <button type="button" onClick={() => setSelected(new Set())} className="px-2 py-1.5 text-xs font-medium text-gray-600 underline">
              Clear
            </button>
            {bulkBusy && <span className="text-xs text-gray-500" role="status">Saving...</span>}
          </div>
        </div>
      )}

      <LostReasonModal
        open={lostFor !== null}
        busy={bulkBusy}
        onCancel={() => setLostFor(null)}
        onConfirm={confirmLost}
        title={
          lostFor?.bulk
            ? `Mark ${lostRows.length} ${lostRows.length === 1 ? "lead" : "leads"} as Lost?`
            : `Mark ${lostRows[0] ? rowName(lostRows[0]) : "this lead"} as Lost?`
        }
        confirmLabel={lostFor?.bulk ? `Mark ${lostRows.length} as Lost` : "Mark as Lost"}
        summary={
          lostFor?.bulk ? (
            <div className="mb-2 text-xs text-gray-700">
              <p>
                {lostRows.slice(0, 8).map(rowName).join(", ")}
                {lostRows.length > 8 ? `, and ${lostRows.length - 8} more` : ""}.
              </p>
              <p className="mt-1 text-gray-500">
                The one reason below goes on every lead, each moved to Lost and noted on its activity.
                {lostFor.rows.length > lostRows.length
                  ? ` ${lostFor.rows.length - lostRows.length} selected ${lostFor.rows.length - lostRows.length === 1 ? "row is" : "rows are"} not a lead and will be left alone.`
                  : ""}
              </p>
            </div>
          ) : null
        }
      />

      {adding && (
        <AddTaskForm
          onCancel={() => setAdding(false)}
          onSaved={async () => {
            setAdding(false);
            setToast({ text: "Task added", kind: "success" });
            changed();
            await reload();
          }}
        />
      )}

      {compose && (
        <EmailComposeModal
          open
          onClose={closeEmail}
          leadId={compose.lead.id}
          toAddress={compose.lead.email}
          configured={compose.configured}
          configuredKnown={compose.configuredKnown}
          userFirstName={userFirstName}
          replyTo={null}
          latestReply={compose.latestReply}
          onSent={(result) => {
            setToast({ text: sentLabel("Email", result), kind: "success" });
            // A reply answers the email item, and a first email moves a new
            // enquiry on, so ask for a fresh look at Gmail and the database.
            changed();
            reload({ fresh: true });
          }}
          onError={(message) => setToast({ text: message, kind: "error" })}
        />
      )}

      {toast && (
        <div
          role="status"
          className={`fixed left-1/2 z-[80] max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-full px-4 py-2 text-center text-sm font-medium text-white shadow-lg ${
            selectedRows.length > 0 ? "bottom-28 sm:bottom-24" : "bottom-6"
          } ${toast.kind === "success" ? "bg-gray-900" : "bg-red-600"}`}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}

const BULK_BUTTON =
  "inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50";

// A bulk bar button with a small menu of day counts, opening upwards.
function BulkDaysMenu({
  label,
  choices,
  disabled,
  onPick,
}: {
  label: string;
  choices: readonly number[];
  disabled: boolean;
  onPick: (n: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    wrapRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) return;
    const items = [...(wrapRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      items[(i + 1) % items.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      items[(i - 1 + items.length) % items.length]?.focus();
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div ref={wrapRef} className="relative" onKeyDown={onKeyDown}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={BULK_BUTTON}
      >
        {label}
        <svg aria-hidden="true" viewBox="0 0 12 12" className="ml-1 h-3 w-3">
          <path d="M3 7.5 6 4.5 9 7.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          className="absolute bottom-full left-0 z-50 mb-1 w-36 rounded-md border border-gray-200 bg-white py-1 shadow-lg"
        >
          {choices.map((n) => (
            <button
              key={n}
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => {
                setOpen(false);
                onPick(n);
              }}
              className="block w-full px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-50 focus:bg-blue-50 focus:outline-none"
            >
              {days(n)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function EmailNote({
  loading,
  email,
  onRefresh,
}: {
  loading: boolean;
  email: PriorityEmailStatus | null;
  onRefresh: () => void;
}) {
  const box = "flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md px-3 py-2 text-xs";
  if (loading || !email) {
    return (
      <p className={`${box} bg-gray-50 text-gray-600`} role="status">
        Checking Gmail for unanswered emails...
      </p>
    );
  }
  const time = new Date(email.checkedAt).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  });
  const again = (
    <button type="button" onClick={onRefresh} className="font-medium text-blue-800 underline">
      Check again
    </button>
  );
  if (email.status === "not_configured") {
    return <p className={`${box} bg-gray-50 text-gray-600`}>Gmail isn&apos;t connected, so unanswered emails aren&apos;t included. Everything else is.</p>;
  }
  if (email.status === "reconnect") {
    return (
      <p className={`${box} bg-amber-50 text-amber-900`}>
        Gmail needs reconnecting, so unanswered emails aren&apos;t included right now.
      </p>
    );
  }
  if (email.status === "error") {
    return (
      <p className={`${box} bg-amber-50 text-amber-900`}>
        Couldn&apos;t check Gmail at {time}, so unanswered emails may be missing. {again}
      </p>
    );
  }
  return (
    <p className={`${box} bg-gray-50 text-gray-600`}>
      <span>
        Unanswered emails checked at {time}
        {email.limited
          ? `, looking at the latest ${email.scanned} inbox conversations only. Older ones aren't checked.`
          : "."}
      </span>
      {again}
    </p>
  );
}

type LeadOption = { id: string; name: string; businessName: string | null };

function AddTaskForm({ onCancel, onSaved }: { onCancel: () => void; onSaved: () => void }) {
  const id = useId();
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState(() => ukDay(new Date()));
  const [priority, setPriority] = useState<PriorityLevel>("NORMAL");
  const [lead, setLead] = useState<LeadOption | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LeadOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const returnTo = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLElement>("input")?.focus();
    return () => returnTo?.focus?.();
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/crm/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (!cancelled) setResults(res.ok ? data.leads ?? [] : []);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError("Give the task a title.");
    if (!dueDate) return setError("Choose a due date.");
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/crm/priorities/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), dueDate, priority, leadId: lead?.id ?? null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to save. Please try again.");
        setSaving(false);
        return;
      }
      onSaved();
    } catch {
      setError("Failed to save. Please try again.");
      setSaving(false);
    }
  }

  const inputCls =
    "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  const showResults = !lead && query.trim().length >= 2;

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
        <h3 id={`${id}-title`} className="text-sm font-bold text-blue-900">
          Add task
        </h3>
        <form onSubmit={submit} className="mt-3 space-y-3" noValidate>
          <div>
            <label htmlFor={`${id}-title-input`} className="mb-1 block text-xs font-medium text-gray-700">
              Title
            </label>
            <input
              id={`${id}-title-input`}
              value={title}
              maxLength={200}
              onChange={(e) => {
                setTitle(e.target.value);
                setError("");
              }}
              placeholder="Chase the printer for proofs"
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor={`${id}-lead`} className="mb-1 block text-xs font-medium text-gray-700">
              Lead (optional)
            </label>
            {lead ? (
              <div className="flex items-center justify-between gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm">
                <span className="min-w-0 truncate text-blue-900">
                  {lead.name}
                  {lead.businessName && lead.businessName !== lead.name ? `, ${lead.businessName}` : ""}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setLead(null);
                    setQuery("");
                    setResults([]);
                  }}
                  className="shrink-0 text-xs font-medium text-blue-800 underline"
                >
                  Remove
                </button>
              </div>
            ) : (
              <>
                <input
                  id={`${id}-lead`}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name, phone, email or postcode"
                  autoComplete="off"
                  className={inputCls}
                />
                {showResults && (
                  <ul className="mt-1 max-h-48 overflow-y-auto rounded-md border border-gray-200" aria-label="Matching leads">
                    {results.length === 0 ? (
                      <li className="px-3 py-2 text-xs text-gray-500">{searching ? "Searching..." : "No matching leads."}</li>
                    ) : (
                      results.map((r) => (
                        <li key={r.id}>
                          <button
                            type="button"
                            onClick={() => setLead(r)}
                            className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50 focus:bg-blue-50 focus:outline-none"
                          >
                            <span className="font-medium text-blue-900">{r.name}</span>
                            {r.businessName && r.businessName !== r.name && (
                              <span className="text-gray-500">, {r.businessName}</span>
                            )}
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor={`${id}-due`} className="mb-1 block text-xs font-medium text-gray-700">
                Due date
              </label>
              <input
                id={`${id}-due`}
                type="date"
                value={dueDate}
                onChange={(e) => {
                  setDueDate(e.target.value);
                  setError("");
                }}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor={`${id}-priority`} className="mb-1 block text-xs font-medium text-gray-700">
                Priority
              </label>
              <select
                id={`${id}-priority`}
                value={priority}
                onChange={(e) => isPriorityLevel(e.target.value) && setPriority(e.target.value)}
                className={inputCls}
              >
                {PRIORITY_LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {LEVEL_LABELS[l]}
                  </option>
                ))}
              </select>
            </div>
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
              {saving ? "Saving..." : "Add task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
