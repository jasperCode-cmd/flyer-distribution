"use client";

import { useMemo, useRef, useState } from "react";
import { ALL_TIME, monthLabel, type ProfitJob } from "@/lib/profit";
import { overviewMonthOptions } from "@/lib/profit-overview";
import type { ExpenseRecord } from "@/lib/expenses";
import {
  filterByBusiness,
  filterExpensesByBusiness,
  SHARED_COSTS_NOTE,
  type BusinessFilter as BusinessView,
} from "@/lib/business";
import ProfitView from "./ProfitView";
import ProfitOverview from "./ProfitOverview";
import ProfitExpenses from "./ProfitExpenses";
import BusinessFilter from "./BusinessFilter";
import type { DistributorOption } from "./profit-ui";

// The Profit page: Overview (the default), Jobs and Expenses, under one
// month selector and one business filter that apply to all three. Under a
// business filter, jobs are that business's and expenses are its own plus
// shared ones. The tab, the month and the business live in the address, so
// Refresh and the back button keep them; the defaults (Overview, All time,
// both businesses) need nothing there.

export type ProfitTab = "overview" | "jobs" | "expenses";
export const PROFIT_TABS: { id: ProfitTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "jobs", label: "Jobs" },
  { id: "expenses", label: "Expenses" },
];

export default function ProfitTabs({
  jobs: initialJobs,
  expenses: initialExpenses,
  distributors,
  initialMonth,
  initialTab,
  initialBusiness = "ALL",
  currentMonth,
}: {
  jobs: ProfitJob[];
  expenses: ExpenseRecord[];
  distributors: DistributorOption[];
  initialMonth: string;
  initialTab: ProfitTab;
  initialBusiness?: BusinessView;
  currentMonth: string;
}) {
  const [allJobs, setJobs] = useState(initialJobs);
  const [allExpenses, setExpenses] = useState(initialExpenses);
  const [month, setMonth] = useState(initialMonth);
  const [tab, setTab] = useState<ProfitTab>(initialTab);
  const [business, setBusiness] = useState<BusinessView>(initialBusiness);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  // Every figure on all three tabs comes from these. Edits still go to the
  // full lists (the setters only ever update by id).
  const jobs = useMemo(() => filterByBusiness(allJobs, business), [allJobs, business]);
  const expenses = useMemo(() => filterExpensesByBusiness(allExpenses, business), [allExpenses, business]);
  const months = useMemo(
    () => overviewMonthOptions(jobs, expenses, currentMonth, month),
    [jobs, expenses, currentMonth, month]
  );

  function writeAddress(next: { month: string; tab: ProfitTab; business: BusinessView }) {
    const url = new URL(window.location.href);
    if (next.month === ALL_TIME) url.searchParams.delete("month");
    else url.searchParams.set("month", next.month);
    if (next.tab === "overview") url.searchParams.delete("tab");
    else url.searchParams.set("tab", next.tab);
    if (next.business === "ALL") url.searchParams.delete("business");
    else url.searchParams.set("business", next.business);
    window.history.replaceState(null, "", url);
  }

  function chooseMonth(next: string) {
    setMonth(next);
    writeAddress({ month: next, tab, business });
  }

  function chooseTab(next: ProfitTab) {
    setTab(next);
    writeAddress({ month, tab: next, business });
  }

  function chooseBusiness(next: BusinessView) {
    setBusiness(next);
    writeAddress({ month, tab, business: next });
  }

  function onTabKey(e: React.KeyboardEvent, index: number) {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    const target = e.key === "Home" ? 0 : e.key === "End" ? PROFIT_TABS.length - 1 : step ? (index + step + PROFIT_TABS.length) % PROFIT_TABS.length : -1;
    if (target < 0) return;
    e.preventDefault();
    const next = PROFIT_TABS[target].id;
    chooseTab(next);
    tabRefs.current[next]?.focus();
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-blue-900">Profit</h1>
          <div role="tablist" aria-label="Profit views" className="mt-3 inline-flex rounded-lg border border-gray-200 bg-white p-1">
            {PROFIT_TABS.map((t, i) => (
              <button
                key={t.id}
                ref={(el) => {
                  tabRefs.current[t.id] = el;
                }}
                type="button"
                role="tab"
                id={`profit-tab-${t.id}`}
                aria-selected={tab === t.id}
                aria-controls={`profit-panel-${t.id}`}
                tabIndex={tab === t.id ? 0 : -1}
                onClick={() => chooseTab(t.id)}
                onKeyDown={(e) => onTabKey(e, i)}
                className={`rounded-md px-4 py-1.5 text-sm font-semibold transition-colors ${
                  tab === t.id ? "bg-blue-700 text-white" : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-start gap-3">
          <div>
            <p className="mb-1 text-xs font-medium text-gray-600">Business</p>
            <BusinessFilter value={business} onChange={chooseBusiness} />
          </div>
          <div>
            <label htmlFor="profit-month" className="mb-1 block text-xs font-medium text-gray-600">
              Month
            </label>
            <select
              id="profit-month"
              value={month}
              onChange={(e) => chooseMonth(e.target.value)}
              className="min-w-44 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              <option value={ALL_TIME}>All time</option>
              {months.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                  {m === currentMonth ? " (this month)" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      {business !== "ALL" && <p className="-mt-2 mb-4 text-xs text-gray-500">{SHARED_COSTS_NOTE}</p>}

      <div role="tabpanel" id={`profit-panel-${tab}`} aria-labelledby={`profit-tab-${tab}`}>
        {tab === "overview" && (
          <ProfitOverview
            jobs={jobs}
            expenses={expenses}
            month={month}
            currentMonth={currentMonth}
            onMonthChange={chooseMonth}
          />
        )}
        {tab === "jobs" && (
          <ProfitView jobs={jobs} setJobs={setJobs} distributors={distributors} month={month} onMonthChange={chooseMonth} />
        )}
        {tab === "expenses" && (
          <ProfitExpenses expenses={expenses} setExpenses={setExpenses} month={month} currentMonth={currentMonth} />
        )}
      </div>
    </div>
  );
}
