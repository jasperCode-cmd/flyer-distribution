"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import EmailComposeModal, { sentLabel, type ReplyContext } from "./EmailComposeModal";
import type { ConversationMessage } from "./EmailsSection";
import { trapTab } from "./profit-ui";
import { LevelChip, OverdueTag, subjectHref, subjectName, subjectNote } from "./priority-ui";
import {
  filterRows,
  isPriorityLevel,
  LEVEL_LABELS,
  PRIORITIES_CHANGED_EVENT,
  PRIORITY_LEVELS,
  REASON_LABELS,
  REASON_TYPES,
  removeItem,
  SNOOZE_DAYS,
  STILL_IN_TALKS_DAYS,
  ukDay,
  urgentHighCount,
  waitingLabel,
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

const days = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;

const BUTTON =
  "inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50";
const SMALL_BUTTON =
  "inline-flex items-center rounded px-2 py-1 text-xs font-medium text-blue-800 hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50";

// The Priorities list. The database items come with the page; unanswered
// emails are fetched straight after (Gmail is slower) and merged in.
export default function PrioritiesView({ initial }: { initial: PriorityList }) {
  const { data: session } = useSession();
  const userFirstName = (session?.user?.name ?? "").split(" ")[0] || "the team";
  const [list, setList] = useState(initial);
  const [emailLoading, setEmailLoading] = useState(true);
  const [level, setLevel] = useState<PriorityLevel | "ALL">("ALL");
  const [type, setType] = useState<ReasonType | "ALL">("ALL");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [adding, setAdding] = useState(false);
  const [compose, setCompose] = useState<Compose | null>(null);
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
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  function changed() {
    window.dispatchEvent(new Event(PRIORITIES_CHANGED_EVENT));
  }

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
    if (reply) {
      composeLeadRef.current = lead.id;
      setCompose({ lead, latestReply: reply, configured: true, configuredKnown: true });
      return;
    }
    composeLeadRef.current = lead.id;
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

  const now = new Date(list.generatedAt);
  const visible = filterRows(list.rows, level, type);
  const groups = PRIORITY_LEVELS.map((l) => ({ level: l, rows: visible.filter((r) => r.level === l) })).filter(
    (g) => g.rows.length > 0
  );
  const levelCounts = Object.fromEntries(PRIORITY_LEVELS.map((l) => [l, list.rows.filter((r) => r.level === l).length]));
  const pressing = urgentHighCount(list.rows);
  const filtered = level !== "ALL" || type !== "ALL";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-blue-900">Priorities</h1>
          <p className="text-sm text-gray-600">
            {list.rows.length === 0
              ? "Nothing needs doing right now."
              : `${list.rows.length} to do, ${pressing} urgent or high.`}
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

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-3">
        <div className="min-w-[9rem] flex-1 sm:flex-none">
          <label htmlFor="priorities-level" className="mb-1 block text-xs font-medium text-gray-700">
            Level
          </label>
          <select
            id="priorities-level"
            value={level}
            onChange={(e) => setLevel(isPriorityLevel(e.target.value) ? e.target.value : "ALL")}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All levels ({list.rows.length})</option>
            {PRIORITY_LEVELS.map((l) => (
              <option key={l} value={l}>
                {LEVEL_LABELS[l]} ({levelCounts[l]})
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[12rem] flex-1 sm:flex-none">
          <label htmlFor="priorities-type" className="mb-1 block text-xs font-medium text-gray-700">
            Type
          </label>
          <select
            id="priorities-type"
            value={type}
            onChange={(e) => {
              const value = e.target.value;
              setType((REASON_TYPES as readonly string[]).includes(value) ? (value as ReasonType) : "ALL");
            }}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All types</option>
            {REASON_TYPES.map((t) => (
              <option key={t} value={t}>
                {t === "task" ? "Tasks" : REASON_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        {filtered && (
          <button
            type="button"
            onClick={() => {
              setLevel("ALL");
              setType("ALL");
            }}
            className="py-2 text-xs font-medium text-blue-800 underline"
          >
            Clear filters
          </button>
        )}
      </div>

      <EmailNote loading={emailLoading} email={list.email} onRefresh={() => reload({ fresh: true })} />

      <h2 ref={listHeadingRef} tabIndex={-1} className="sr-only">
        {filtered ? `${visible.length} of ${list.rows.length} shown` : "The list"}
      </h2>

      {groups.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-500">
          {filtered ? "Nothing matches these filters." : "Nothing needs doing right now."}
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.level} aria-labelledby={`priorities-${group.level}`}>
            <h3 id={`priorities-${group.level}`} className="mb-2 flex items-center gap-2 text-sm font-bold text-blue-900">
              {LEVEL_LABELS[group.level]}
              <span className="text-xs font-medium text-gray-500">{group.rows.length}</span>
            </h3>
            <ul className="divide-y divide-gray-100 overflow-visible rounded-lg border border-gray-200 bg-white">
              {group.rows.map((row) => (
                <PriorityRowItem
                  key={row.id}
                  row={row}
                  now={now}
                  busyKey={busyKey}
                  onAct={act}
                  onEmail={openEmail}
                  onTaskPriority={setTaskPriority}
                />
              ))}
            </ul>
          </section>
        ))
      )}

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
          className={`fixed bottom-6 left-1/2 z-[80] max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-full px-4 py-2 text-center text-sm font-medium text-white shadow-lg ${
            toast.kind === "success" ? "bg-gray-900" : "bg-red-600"
          }`}
        >
          {toast.text}
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

function PriorityRowItem({
  row,
  now,
  busyKey,
  onAct,
  onEmail,
  onTaskPriority,
}: {
  row: PriorityRow;
  now: Date;
  busyKey: string | null;
  onAct: (entry: PriorityItem, action: PriorityAction, n?: number) => void;
  onEmail: (lead: EmailLead, reply: ReplyContext | null) => void;
  onTaskPriority: (entry: PriorityItem, level: PriorityLevel) => void;
}) {
  const entry = row.primary;
  const subject = entry.subject;
  const name = subjectName(subject);
  const note = subjectNote(subject);
  const href = subjectHref(subject);
  const phone = subject.kind === "none" ? null : subject.phone?.trim() || null;
  const tel = phone ? `tel:${phone.replace(/[^\d+]/g, "")}` : null;
  const email = subject.kind === "lead" ? subject.email?.trim() || null : null;
  const busy = busyKey === entry.key;
  const isTask = entry.type === "task";
  const reply = [entry, ...row.others].find((i) => i.reply)?.reply ?? null;

  return (
    <li className="p-3 sm:p-4">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between lg:gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <LevelChip level={entry.level} />
            {isTask && <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Task</span>}
            <p className="text-sm font-semibold text-blue-900 [overflow-wrap:anywhere]">{entry.title}</p>
            {entry.overdue && <OverdueTag />}
          </div>
          {name && (
            <p className="mt-1 text-sm text-gray-800">
              {href ? (
                <Link href={href} className="font-medium hover:underline">
                  {name}
                </Link>
              ) : (
                <span className="font-medium">{name}</span>
              )}
              {note && <span className="text-gray-500">, {note}</span>}
            </p>
          )}
          {entry.detail && (
            <p className="mt-0.5 truncate text-xs text-gray-600" title={entry.detail}>
              {entry.type === "unanswered_email" ? `Subject: ${entry.detail}` : entry.detail}
            </p>
          )}
          <p className={`mt-0.5 text-xs ${entry.overdue ? "font-medium text-red-700" : "text-gray-500"}`}>
            {waitingLabel(entry, now)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 lg:max-w-[28rem] lg:shrink-0 lg:justify-end">
          {href && (
            <Link href={href} className={BUTTON}>
              Open
            </Link>
          )}
          {email && subject.kind === "lead" && (
            <button type="button" onClick={() => onEmail({ id: subject.id, name: subject.name, email }, reply)} className={BUTTON}>
              Email
            </button>
          )}
          {tel && (
            <a href={tel} className={BUTTON}>
              Call
            </a>
          )}
          {isTask && (
            <>
              <label htmlFor={`priority-${entry.key}`} className="sr-only">
                Priority of {entry.title}
              </label>
              <select
                id={`priority-${entry.key}`}
                value={entry.level}
                disabled={busy}
                onChange={(e) => isPriorityLevel(e.target.value) && onTaskPriority(entry, e.target.value)}
                className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {PRIORITY_LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {LEVEL_LABELS[l]}
                  </option>
                ))}
              </select>
            </>
          )}
          {entry.type === "awaiting" && (
            <DaysMenu
              label="Still in talks"
              heading="Snooze, and note it on the lead"
              choices={STILL_IN_TALKS_DAYS}
              disabled={busy}
              onPick={(n) => onAct(entry, "still_in_talks", n)}
              className={BUTTON}
            />
          )}
          <DaysMenu label="Snooze" choices={SNOOZE_DAYS} disabled={busy} onPick={(n) => onAct(entry, "snooze", n)} className={BUTTON} />
          <button
            type="button"
            disabled={busy}
            onClick={() => onAct(entry, "done")}
            className="inline-flex items-center justify-center rounded-md bg-blue-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 disabled:opacity-50"
          >
            {busy ? "Saving..." : "Done"}
          </button>
        </div>
      </div>

      {row.others.length > 0 && (
        <ul className="mt-2 space-y-1 border-l-2 border-gray-200 pl-3" aria-label={`Other reasons for ${name ?? entry.title}`}>
          {row.others.map((other) => (
            <li key={other.key} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-600">
              <span className="text-gray-500">Also:</span>
              <LevelChip level={other.level} />
              <span className="font-medium text-gray-800">{other.title}</span>
              {other.overdue && <OverdueTag />}
              <span>{waitingLabel(other, now)}</span>
              <span className="flex items-center gap-0.5">
                {other.type === "awaiting" && (
                  <DaysMenu
                    label="Still in talks"
                    heading="Snooze, and note it on the lead"
                    choices={STILL_IN_TALKS_DAYS}
                    disabled={busyKey === other.key}
                    onPick={(n) => onAct(other, "still_in_talks", n)}
                    className={SMALL_BUTTON}
                  />
                )}
                <DaysMenu
                  label="Snooze"
                  choices={SNOOZE_DAYS}
                  disabled={busyKey === other.key}
                  onPick={(n) => onAct(other, "snooze", n)}
                  className={SMALL_BUTTON}
                />
                <button type="button" disabled={busyKey === other.key} onClick={() => onAct(other, "done")} className={SMALL_BUTTON}>
                  Done
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

// A small menu of day counts (Snooze 1, 3 or 7; Still in talks 2, 5 or 7).
// Opens below its button, on whichever side has room; arrow keys move,
// Escape and an outside click close it.
function DaysMenu({
  label,
  heading,
  choices,
  disabled,
  onPick,
  className,
}: {
  label: string;
  heading?: string;
  choices: readonly number[];
  disabled: boolean;
  onPick: (n: number) => void;
  className: string;
}) {
  const [open, setOpen] = useState<null | "left" | "right">(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(null);
    }
    document.addEventListener("mousedown", onDown);
    wrapRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function toggle() {
    if (open) return setOpen(null);
    const rect = buttonRef.current?.getBoundingClientRect();
    // The menu is 11rem wide: open it to the right of the button's left edge
    // unless that would run off the screen.
    setOpen(rect && rect.left + 176 > window.innerWidth - 8 ? "right" : "left");
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) return;
    const items = [...(wrapRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setOpen(null);
      buttonRef.current?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      items[(i + 1) % items.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      items[(i - 1 + items.length) % items.length]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      items[items.length - 1]?.focus();
    } else if (e.key === "Tab") {
      setOpen(null);
    }
  }

  return (
    <div ref={wrapRef} className="relative" onKeyDown={onKeyDown}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={!!open}
        aria-controls={open ? menuId : undefined}
        disabled={disabled}
        onClick={toggle}
        className={className}
      >
        {label}
        <svg aria-hidden="true" viewBox="0 0 12 12" className="ml-1 h-3 w-3">
          <path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          className={`absolute top-full z-40 mt-1 w-44 rounded-md border border-gray-200 bg-white py-1 shadow-lg ${
            open === "left" ? "left-0" : "right-0"
          }`}
        >
          {heading && <p className="px-3 pb-1 pt-1.5 text-[11px] text-gray-500">{heading}</p>}
          {choices.map((n) => (
            <button
              key={n}
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => {
                setOpen(null);
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
