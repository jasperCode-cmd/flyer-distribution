"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LevelChip, OverdueTag, subjectHref, subjectName } from "./priority-ui";
import { urgentHighCount, waitingLabel, type PriorityList } from "@/lib/priorities";

const SHOWN = 5;

// The Dashboard's first card: the top five of the Priorities list. The
// database items come with the page and unanswered emails are merged in
// once Gmail has been checked.
export default function TopPriorities({ initial }: { initial: PriorityList }) {
  const [list, setList] = useState(initial);
  const [checkingEmail, setCheckingEmail] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/crm/priorities?gmail=1", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: PriorityList | null) => {
        if (!cancelled && data) setList(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setCheckingEmail(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const now = new Date(list.generatedAt);
  const top = list.rows.slice(0, SHOWN);
  const pressing = urgentHighCount(list.rows);

  return (
    <section aria-labelledby="top-priorities-title" className="rounded-lg border border-gray-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 id="top-priorities-title" className="text-sm font-bold text-blue-900">
            Top priorities
          </h2>
          {pressing > 0 && (
            <span className="rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-semibold text-white">
              {pressing} urgent or high
            </span>
          )}
        </div>
        <Link href="/admin/crm/priorities" className="text-xs text-blue-700 hover:underline">
          View all priorities{list.rows.length > 0 ? ` (${list.rows.length})` : ""}
        </Link>
      </div>
      {top.length === 0 ? (
        <p className="px-4 py-4 text-sm text-gray-500">{checkingEmail ? "Checking..." : "Nothing needs doing right now."}</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {top.map((row) => {
            const entry = row.primary;
            const name = subjectName(entry.subject);
            const when = (
              <>
                {entry.overdue && <OverdueTag />}
                {waitingLabel(entry, now)}
              </>
            );
            const whenCls = entry.overdue ? "font-medium text-red-700" : "text-gray-500";
            return (
              <li key={row.id}>
                <Link
                  href={subjectHref(entry.subject) ?? "/admin/crm/priorities"}
                  className="flex items-start justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-gray-50 sm:items-center"
                >
                  <div className="flex min-w-0 items-start gap-2 sm:items-center">
                    <LevelChip level={entry.level} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-blue-900">
                        {entry.title}
                        {row.others.length > 0 && (
                          <span className="font-normal text-gray-500"> +{row.others.length} more</span>
                        )}
                      </p>
                      {name && <p className="truncate text-xs text-gray-600">{name}</p>}
                      {/* On a phone the timing sits under the name. */}
                      <p className={`mt-0.5 flex items-center gap-1.5 text-xs sm:hidden ${whenCls}`}>{when}</p>
                    </div>
                  </div>
                  <span className={`hidden shrink-0 items-center gap-1.5 text-xs sm:flex ${whenCls}`}>{when}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {checkingEmail && top.length > 0 && (
        <p className="border-t border-gray-100 px-4 py-2 text-[11px] text-gray-500" role="status">
          Checking Gmail for unanswered emails...
        </p>
      )}
    </section>
  );
}
