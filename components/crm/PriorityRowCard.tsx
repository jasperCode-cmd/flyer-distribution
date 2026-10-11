"use client";

import Link from "next/link";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { OverdueTag, subjectHref } from "./priority-ui";
import {
  awaitingItem,
  canMarkLost,
  LEVEL_LABELS,
  PRIORITY_LEVELS,
  primaryAction,
  REASON_LABELS,
  SNOOZE_DAYS,
  STILL_IN_TALKS_DAYS,
  waitingLabel,
  type PriorityAction,
  type PriorityItem,
  type PriorityLevel,
  type PriorityRow,
} from "@/lib/priorities";

export type RowHandlers = {
  onAct: (entry: PriorityItem, action: PriorityAction, days?: number) => void;
  onTaskPriority: (entry: PriorityItem, level: PriorityLevel) => void;
  onReply: (row: PriorityRow) => void;
  onEmail: (row: PriorityRow) => void;
  onMarkLost: (row: PriorityRow) => void;
  onToggle: (rowId: string) => void;
};

const days = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;

// What a reason says on a row: the plain-English reason, or a task's title.
export function reasonText(entry: PriorityItem): string {
  return entry.type === "task" ? entry.title : REASON_LABELS[entry.type];
}

function rowName(row: PriorityRow): { name: string; business: string | null } {
  const s = row.primary.subject;
  if (s.kind === "lead") {
    const business = s.businessName?.trim();
    return { name: s.name, business: business && business !== s.name ? business : null };
  }
  if (s.kind === "application") return { name: s.name, business: "applicant" };
  // A task with no lead: its title is the name.
  return { name: row.primary.title, business: null };
}

const PRIMARY =
  "inline-flex w-full items-center justify-center rounded-md bg-blue-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400";
const SECONDARY =
  "inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50";

// One row of the list: the name first, the reason and how long it has
// waited underneath, and on the right, in a column the same width on every
// row, the one main button, Done and the "⋯" menu. Anywhere else on the row
// opens the lead or record. On a phone it is a card.
export default function PriorityRowCard({
  row,
  now,
  selected,
  busy,
  handlers,
}: {
  row: PriorityRow;
  now: Date;
  selected: boolean;
  busy: boolean;
  handlers: RowHandlers;
}) {
  const router = useRouter();
  const entry = row.primary;
  const { name, business } = rowName(row);
  const href = subjectHref(entry.subject);
  const action = primaryAction(row);
  const subject = entry.subject;
  const tel = subject.kind === "lead" && subject.phone?.trim() ? `tel:${subject.phone.replace(/[^\d+]/g, "")}` : null;
  const noLead = subject.kind === "none";

  return (
    <li
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a, button, input, label, [role=menu]")) return;
        if (href) router.push(href);
      }}
      className={`flex flex-col gap-2 rounded-lg border bg-white p-3 sm:flex-row sm:items-center sm:gap-3 sm:rounded-none sm:border-0 sm:px-4 sm:py-2.5 ${
        href ? "cursor-pointer" : ""
      } ${selected ? "border-blue-300 bg-blue-50/60 sm:bg-blue-50/60" : "border-gray-200 hover:bg-gray-50"}`}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => handlers.onToggle(row.id)}
          aria-label={`Select ${name}`}
          className="mt-1 h-4 w-4 shrink-0 accent-blue-700"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm">
            {href ? (
              <Link href={href} className="font-semibold text-gray-900 hover:underline">
                {name}
              </Link>
            ) : (
              <span className="font-semibold text-gray-900">{name}</span>
            )}
            {business && <span className="text-gray-500">, {business}</span>}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-gray-600">
            <span className="font-medium text-gray-700">{noLead ? "Task" : reasonText(entry)}</span>
            {entry.type === "unpaid" && entry.detail && <span className="text-gray-500">({entry.detail})</span>}
            {entry.type === "unanswered_email" && entry.detail && (
              <span className="max-w-[16rem] truncate text-gray-500" title={entry.detail}>
                &ldquo;{entry.detail}&rdquo;
              </span>
            )}
            <span aria-hidden="true" className="text-gray-400">
              ·
            </span>
            <span className={entry.overdue ? "font-medium text-red-700" : ""}>{waitingLabel(entry, now)}</span>
            {entry.overdue && <OverdueTag />}
          </p>
          {row.others.length > 0 && (
            <p className="mt-0.5 truncate text-[11px] text-gray-500">Also: {row.others.map(reasonText).join(", ")}</p>
          )}
        </div>
      </div>

      <div className="flex w-full shrink-0 items-center gap-1.5 pl-7 sm:w-[14.5rem] sm:justify-end sm:pl-0">
        <span className="min-w-0 flex-1 sm:w-[5.25rem] sm:flex-none">
          {action === "reply" && (
            <button type="button" onClick={() => handlers.onReply(row)} className={PRIMARY}>
              Reply
            </button>
          )}
          {action === "call" && tel && (
            <a href={tel} className={PRIMARY}>
              Call
            </a>
          )}
          {action === "email" && (
            <button type="button" onClick={() => handlers.onEmail(row)} className={PRIMARY}>
              Email
            </button>
          )}
          {action === "open" && href && (
            <Link href={href} className={PRIMARY}>
              Open
            </Link>
          )}
        </span>
        <button
          type="button"
          disabled={busy}
          onClick={() => handlers.onAct(entry, "done")}
          aria-label={`Done: ${reasonText(entry)}, ${name}`}
          className={`${SECONDARY} flex-1 sm:w-[4.25rem] sm:flex-none`}
        >
          {busy ? "..." : "Done"}
        </button>
        <RowMenu row={row} name={name} href={href} busy={busy} handlers={handlers} />
      </div>
    </li>
  );
}

// The "⋯" menu: Snooze, Still in talks where it applies, Mark as Lost for
// leads, Open, and Done or Snooze for each of the row's other reasons.
function RowMenu({
  row,
  name,
  href,
  busy,
  handlers,
}: {
  row: PriorityRow;
  name: string;
  href: string | null;
  busy: boolean;
  handlers: RowHandlers;
}) {
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const talks = awaitingItem(row);
  const subject = row.primary.subject;

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Opens upwards when there isn't room below.
  useLayoutEffect(() => {
    if (!open || !menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    if (rect.bottom > window.innerHeight - 8 && rect.height < rect.top) setUp(true);
  }, [open]);

  function close(refocus: boolean) {
    setOpen(false);
    setUp(false);
    if (refocus) buttonRef.current?.focus();
  }

  function pick(fn: () => void) {
    close(false);
    fn();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) return;
    const items = [...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close(true);
    } else if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      items[(i + 1) % items.length]?.focus();
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      items[(i - 1 + items.length) % items.length]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      items[items.length - 1]?.focus();
    } else if (e.key === "Tab") {
      close(false);
    }
  }

  const chip =
    "rounded border border-gray-200 px-2 py-1 text-xs text-gray-800 hover:bg-gray-50 focus:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500";
  const line = "block w-full px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-50 focus:bg-blue-50 focus:outline-none";

  const dayChoices = (label: string, choices: readonly number[], onPick: (n: number) => void) => (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-1.5 px-3 py-1.5">
      <span className="w-[5.5rem] shrink-0 text-xs text-gray-500">{label}</span>
      {choices.map((n) => (
        <button key={n} type="button" role="menuitem" tabIndex={-1} onClick={() => pick(() => onPick(n))} className={chip}>
          {days(n)}
        </button>
      ))}
    </div>
  );

  return (
    <div ref={wrapRef} className="relative" onKeyDown={onKeyDown}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`More actions for ${name}`}
        disabled={busy}
        onClick={() => (open ? close(false) : setOpen(true))}
        className={`${SECONDARY} w-9 px-0 text-base leading-none`}
      >
        <span aria-hidden="true">⋯</span>
      </button>
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={`More actions for ${name}`}
          className={`absolute right-0 z-40 w-[20rem] max-w-[calc(100vw-2rem)] rounded-lg border border-gray-200 bg-white py-1 shadow-lg ${
            up ? "bottom-full mb-1" : "top-full mt-1"
          }`}
        >
          {dayChoices("Snooze", SNOOZE_DAYS, (n) => handlers.onAct(row.primary, "snooze", n))}
          {talks && dayChoices("Still in talks", STILL_IN_TALKS_DAYS, (n) => handlers.onAct(talks, "still_in_talks", n))}
          {row.primary.type === "task" && (
            <div role="group" aria-label="Task priority" className="flex flex-wrap items-center gap-1.5 px-3 py-1.5">
              <span className="w-[5.5rem] shrink-0 text-xs text-gray-500">Priority</span>
              {PRIORITY_LEVELS.map((l) => (
                <button
                  key={l}
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  aria-current={row.primary.level === l ? "true" : undefined}
                  onClick={() => pick(() => handlers.onTaskPriority(row.primary, l))}
                  className={`${chip} ${row.primary.level === l ? "border-blue-900 bg-blue-900 text-white hover:bg-blue-800" : ""}`}
                >
                  {LEVEL_LABELS[l]}
                </button>
              ))}
            </div>
          )}
          {(canMarkLost(row) || href) && <div className="my-1 border-t border-gray-100" />}
          {canMarkLost(row) && (
            <button type="button" role="menuitem" tabIndex={-1} onClick={() => pick(() => handlers.onMarkLost(row))} className={line}>
              Mark as Lost...
            </button>
          )}
          {href && (
            <Link href={href} role="menuitem" tabIndex={-1} onClick={() => close(false)} className={line}>
              {subject.kind === "application" ? "Open application" : "Open lead"}
            </Link>
          )}
          {row.others.map((other) => (
            <div key={other.key} role="group" aria-label={`Also: ${reasonText(other)}`} className="border-t border-gray-100 py-1">
              <p className="px-3 pt-1 text-xs font-medium text-gray-700">Also: {reasonText(other)}</p>
              <div className="flex flex-wrap items-center gap-1.5 px-3 py-1.5">
                <button
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  onClick={() => pick(() => handlers.onAct(other, "done"))}
                  className={chip}
                >
                  Done
                </button>
                <span className="text-xs text-gray-500">Snooze</span>
                {SNOOZE_DAYS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="menuitem"
                    tabIndex={-1}
                    aria-label={`Snooze ${reasonText(other)} for ${days(n)}`}
                    onClick={() => pick(() => handlers.onAct(other, "snooze", n))}
                    className={chip}
                  >
                    {days(n)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
