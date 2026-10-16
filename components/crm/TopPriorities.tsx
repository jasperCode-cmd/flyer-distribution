"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { LevelChip, OverdueTag, subjectHref, subjectName } from "./priority-ui";
import BusinessBadge from "./BusinessBadge";
import {
  PRIORITIES_CHANGED_EVENT,
  removeItem,
  rowsForBusiness,
  urgentHighCount,
  waitingLabel,
  type PriorityItem,
  type PriorityList,
} from "@/lib/priorities";
import type { BusinessFilter } from "@/lib/business";

const SHOWN = 5;

// The Dashboard's Top priorities: the first five of the Priorities list,
// each with Done as its quick action. The database items come with the page
// and unanswered emails are merged in once Gmail has been checked, so the
// Dashboard never waits on Gmail. Under the Dashboard's business filter it
// shows that business's rows, plus applications and tasks with no lead.
export default function TopPriorities({
  initial,
  business = "ALL",
  className = "",
}: {
  initial: PriorityList;
  business?: BusinessFilter;
  className?: string;
}) {
  const [list, setList] = useState(initial);
  const [checkingEmail, setCheckingEmail] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState("");
  const loadSeq = useRef(0);

  const reload = useCallback(async () => {
    const seq = ++loadSeq.current;
    try {
      const res = await fetch("/api/crm/priorities?gmail=1", { cache: "no-store" });
      const data: PriorityList | null = res.ok ? await res.json() : null;
      if (seq === loadSeq.current && data) setList(data);
    } catch {
      // The list from the page stays.
    } finally {
      if (seq === loadSeq.current) setCheckingEmail(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function done(entry: PriorityItem) {
    setBusyKey(entry.key);
    setError("");
    try {
      const res = await fetch("/api/crm/priorities/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: entry.key, action: "done" }),
      });
      if (!res.ok && res.status !== 404) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to save. Please try again.");
        return;
      }
      setList((prev) => ({ ...prev, rows: removeItem(prev.rows, entry.key) }));
      window.dispatchEvent(new Event(PRIORITIES_CHANGED_EVENT));
      reload();
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setBusyKey(null);
    }
  }

  const now = new Date(list.generatedAt);
  const rows = rowsForBusiness(list.rows, business);
  const top = rows.slice(0, SHOWN);
  const pressing = urgentHighCount(rows);

  return (
    <section aria-labelledby="top-priorities-title" className={`rounded-lg border border-gray-200 bg-white ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 id="top-priorities-title" className="text-sm font-bold text-blue-900">
            Top priorities
          </h2>
          {pressing > 0 && (
            <span className="rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-semibold text-white">{pressing} urgent or high</span>
          )}
        </div>
        <Link
          href={business === "ALL" ? "/admin/crm/priorities" : `/admin/crm/priorities?business=${business}`}
          className="text-xs text-blue-700 hover:underline"
        >
          View all priorities{rows.length > 0 ? ` (${rows.length})` : ""}
        </Link>
      </div>
      {top.length === 0 ? (
        <p className="px-4 py-4 text-sm text-gray-500">{checkingEmail ? "Checking..." : "Nothing needs doing right now."}</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {top.map((row) => {
            const entry = row.primary;
            const name = subjectName(entry.subject);
            return (
              <li key={row.id} className="flex items-center gap-2 pr-3">
                <Link
                  href={subjectHref(entry.subject) ?? "/admin/crm/priorities"}
                  className="flex min-w-0 flex-1 items-start gap-2 px-4 py-2 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
                >
                  <LevelChip level={entry.level} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-blue-900">
                      {entry.title}
                      {row.others.length > 0 && <span className="font-normal text-gray-500"> +{row.others.length} more</span>}
                    </span>
                    <span className={`flex flex-wrap items-center gap-x-1.5 text-xs ${entry.overdue ? "text-red-700" : "text-gray-500"}`}>
                      {entry.subject.kind === "lead" && <BusinessBadge business={entry.subject.business} />}
                      {name && <span className="truncate text-gray-600">{name},</span>}
                      {entry.overdue && <OverdueTag />}
                      <span>{waitingLabel(entry, now)}</span>
                    </span>
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={() => done(entry)}
                  disabled={busyKey === entry.key}
                  aria-label={`Done: ${entry.title}${name ? `, ${name}` : ""}`}
                  className="shrink-0 rounded-md border border-gray-300 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50"
                >
                  {busyKey === entry.key ? "Saving..." : "Done"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {error && (
        <p role="alert" className="border-t border-gray-100 px-4 py-2 text-xs text-red-600">
          {error}
        </p>
      )}
      {checkingEmail && top.length > 0 && (
        <p className="border-t border-gray-100 px-4 py-2 text-[11px] text-gray-500" role="status">
          Checking Gmail for unanswered emails...
        </p>
      )}
    </section>
  );
}
