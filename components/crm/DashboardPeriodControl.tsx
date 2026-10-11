"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addDays, periodSearch, type DashboardPeriod } from "@/lib/dashboard";

const SEGMENT =
  "inline-flex items-center gap-1 rounded px-3 py-1.5 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500";
const ON = "bg-blue-900 text-white";
const OFF = "text-gray-700 hover:bg-gray-100";

// All time, Last 30 days, or a custom range, kept in the page address so
// Refresh and Back keep it.
export default function DashboardPeriodControl({ period, today }: { period: DashboardPeriod; today: string }) {
  const router = useRouter();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(period.kind === "custom" ? period.from : addDays(today, -29));
  const [to, setTo] = useState(period.kind === "custom" ? period.to : today);
  const [error, setError] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    wrapRef.current?.querySelector<HTMLInputElement>("input")?.focus();
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function apply(e: React.FormEvent) {
    e.preventDefault();
    if (!from || !to) return setError("Choose both dates.");
    if (from > to) return setError("The start must be on or before the end.");
    if (from > today) return setError("The start can't be in the future.");
    setOpen(false);
    router.push(`/admin/crm${periodSearch({ kind: "custom", from, to: to > today ? today : to })}`, { scroll: false });
  }

  return (
    <div ref={wrapRef} className="relative">
      <div role="group" aria-label="Period" className="inline-flex flex-wrap rounded-md border border-gray-300 bg-white p-0.5">
        <Link href="/admin/crm" scroll={false} aria-current={period.kind === "all" ? "true" : undefined} className={`${SEGMENT} ${period.kind === "all" ? ON : OFF}`}>
          All time
        </Link>
        <Link
          href="/admin/crm?period=30d"
          scroll={false}
          aria-current={period.kind === "last30" ? "true" : undefined}
          className={`${SEGMENT} ${period.kind === "last30" ? ON : OFF}`}
        >
          Last 30 days
        </Link>
        <button
          ref={buttonRef}
          type="button"
          aria-expanded={open}
          aria-controls={open ? `${id}-range` : undefined}
          aria-current={period.kind === "custom" ? "true" : undefined}
          onClick={() => {
            setError("");
            setOpen((o) => !o);
          }}
          className={`${SEGMENT} ${period.kind === "custom" ? ON : OFF}`}
        >
          Custom
          <svg aria-hidden="true" viewBox="0 0 12 12" className="h-3 w-3">
            <path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      {open && (
        <form
          id={`${id}-range`}
          role="dialog"
          aria-label="Custom date range"
          onSubmit={apply}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              setOpen(false);
              buttonRef.current?.focus();
            }
          }}
          className="absolute right-0 top-full z-40 mt-1 w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-gray-200 bg-white p-3 shadow-lg"
          noValidate
        >
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor={`${id}-from`} className="mb-1 block text-xs font-medium text-gray-700">
                From
              </label>
              <input
                id={`${id}-from`}
                type="date"
                value={from}
                max={today}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setError("");
                }}
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor={`${id}-to`} className="mb-1 block text-xs font-medium text-gray-700">
                To
              </label>
              <input
                id={`${id}-to`}
                type="date"
                value={to}
                max={today}
                onChange={(e) => {
                  setTo(e.target.value);
                  setError("");
                }}
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          {error && (
            <p role="alert" className="mt-2 text-xs text-red-600">
              {error}
            </p>
          )}
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-md px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100">
              Cancel
            </button>
            <button type="submit" className="rounded-md bg-blue-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-800">
              Show
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
