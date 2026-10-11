"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { formatPence, formatPercent } from "@/lib/money";
import { ALL_TIME, COST_GROUPS, monthLabel, type ProfitJob } from "@/lib/profit";
import { activeRetainers, monthlyRows, periodFigures, type MonthRow } from "@/lib/profit-overview";
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS, type ExpenseRecord } from "@/lib/expenses";
import { GROUP_COLORS } from "./profit-ui";

// Profit Overview: jobs, retainers and business expenses together, for the
// chosen month or All time, plus every month side by side.

// Checked with the dataviz palette validator (light surface): both pass,
// and the bars also show profit or loss by direction from the zero line.
const PROFIT_COLOR = "#2a78d6";
const LOSS_COLOR = "#d03b3b";
const EXPENSE_COLOR = "#64748b";

// "£1.5k" for the axis from £1,000 up, "£250" below.
function axisLabel(pence: number): string {
  const abs = Math.abs(pence);
  const sign = pence < 0 ? "-" : "";
  return abs >= 100000 ? `${sign}£${(abs / 100000).toFixed(1).replace(/\.0$/, "")}k` : formatPence(pence).replace(".00", "");
}

function shortMonth(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });
}

export default function ProfitOverview({
  jobs,
  expenses,
  month,
  currentMonth,
  onMonthChange,
}: {
  jobs: ProfitJob[];
  expenses: ExpenseRecord[];
  month: string;
  currentMonth: string;
  onMonthChange: (month: string) => void;
}) {
  const figures = useMemo(() => periodFigures(jobs, expenses, month, currentMonth), [jobs, expenses, month, currentMonth]);
  const rows = useMemo(() => monthlyRows(jobs, expenses, currentMonth), [jobs, expenses, currentMonth]);
  const allTime = useMemo(() => periodFigures(jobs, expenses, ALL_TIME, currentMonth), [jobs, expenses, currentMonth]);
  const retainers = useMemo(() => activeRetainers(jobs, currentMonth), [jobs, currentMonth]);
  const period = month === ALL_TIME ? "All time" : monthLabel(month);

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-500">
        {period}: jobs and retainers together, less job costs and business expenses. Margins are on revenue paid.
      </p>

      <Summary figures={figures} />
      {month === ALL_TIME && figures.undatedJobs > 0 && (
        <p className="-mt-3 text-xs text-gray-500">
          Includes {figures.undatedJobs} {figures.undatedJobs === 1 ? "job" : "jobs"} with no won date, which sit in no
          month below.
        </p>
      )}

      <section aria-labelledby="overview-months" className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 id="overview-months" className="text-sm font-bold text-blue-900">
          Month by month
        </h2>
        <p className="text-xs text-gray-500">Net profit each month. Choose a month in the chart or the table to see it.</p>
        <MonthChart rows={rows.slice(0, 12).reverse()} selected={month} onSelect={onMonthChange} />
        <MonthTable rows={rows} allTime={allTime} selected={month} currentMonth={currentMonth} onSelect={onMonthChange} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Breakdown figures={figures} period={period} />
        <Retainers retainers={retainers} />
      </div>
    </div>
  );
}

function Summary({ figures }: { figures: ReturnType<typeof periodFigures> }) {
  const tiles: { label: string; value: string; sub?: string; extra?: { label: string; value: string }; loss?: boolean }[] = [
    {
      label: "Revenue paid",
      value: formatPence(figures.revenuePence),
      sub: `Jobs ${formatPence(figures.jobRevenuePence)}, retainers ${formatPence(figures.retainerRevenuePence)}`,
    },
    { label: "Job costs", value: formatPence(figures.jobCostsPence) },
    {
      label: figures.jobProfitPence < 0 ? "Job loss" : "Job profit",
      value: formatPence(figures.jobProfitPence),
      extra: { label: "Job margin", value: formatPercent(figures.jobMarginPct) },
      loss: figures.jobProfitPence < 0,
    },
    { label: "Business expenses", value: formatPence(figures.expensesPence) },
    {
      label: figures.netProfitPence < 0 ? "Net loss" : "Net profit",
      value: formatPence(figures.netProfitPence),
      extra: { label: "Net margin", value: formatPercent(figures.netMarginPct) },
      loss: figures.netProfitPence < 0,
    },
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
      {tiles.map((t, i) => (
        <div key={t.label} className={`rounded-lg border border-gray-200 bg-white p-4 ${i === 4 ? "col-span-2 sm:col-span-1" : ""}`}>
          <dt className="text-xs font-medium text-gray-500">{t.label}</dt>
          <dd className={`mt-0.5 text-xl font-bold tabular-nums ${t.loss ? "text-red-700" : "text-gray-900"}`}>{t.value}</dd>
          {t.sub && <dd className="mt-0.5 text-xs text-gray-500">{t.sub}</dd>}
          {t.extra && (
            <dd className="mt-1 text-sm text-gray-600">
              {t.extra.label}{" "}
              <span className={`font-semibold tabular-nums ${t.loss ? "text-red-700" : "text-gray-900"}`}>{t.extra.value}</span>
            </dd>
          )}
        </div>
      ))}
    </dl>
  );
}

// Net profit per month as bars from a zero line: up for a profit, down for a
// loss. Drawn at the real width of its box, so the text stays the same size
// on a phone rather than being scaled down.
function MonthChart({ rows, selected, onSelect }: { rows: MonthRow[]; selected: string; onSelect: (month: string) => void }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [hover, setHover] = useState<string | null>(null);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(240, Math.floor(entry.contentRect.width))));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const values = rows.map((r) => r.netProfitPence);
  const max = Math.max(0, ...values);
  const min = Math.min(0, ...values);
  const slot = (width - 44 - 8) / Math.max(rows.length, 1);
  const wide = slot >= 44;
  // Room under the lowest loss bar for its value, clear of the month names.
  const pad = { top: 18, bottom: wide && min < 0 ? 40 : 26, left: 44, right: 8 };
  const height = 200 + (pad.bottom - 26);
  const span = max - min || 1;
  const plotH = height - pad.top - pad.bottom;
  const y = (v: number) => pad.top + ((max - v) / span) * plotH;
  const barW = Math.max(6, Math.min(36, slot * 0.6));
  const active = hover ?? (selected !== ALL_TIME ? selected : null);
  const activeRow = rows.find((r) => r.month === active) ?? null;
  const ticks = [max, 0, min].filter((v, i, a) => a.indexOf(v) === i);

  return (
    <div className="mt-3">
      <div className="mb-2 flex flex-wrap items-center gap-4 text-xs text-gray-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: PROFIT_COLOR }} aria-hidden="true" />
          Profit (above the line)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: LOSS_COLOR }} aria-hidden="true" />
          Loss (below the line)
        </span>
        <span className="min-h-4 text-gray-800" aria-live="polite">
          {activeRow
            ? `${monthLabel(activeRow.month)}: ${activeRow.netProfitPence < 0 ? "loss" : "net profit"} ${formatPence(activeRow.netProfitPence)}`
            : ""}
        </span>
      </div>
      <div ref={boxRef} className="w-full">
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`Net profit by month: ${rows.map((r) => `${monthLabel(r.month)} ${formatPence(r.netProfitPence)}`).join("; ")}`}
          className="block"
        >
          {ticks.map((v) => (
            <g key={v}>
              <line x1={pad.left} x2={width - pad.right} y1={y(v)} y2={y(v)} stroke={v === 0 ? "#9ca3af" : "#e5e7eb"} strokeWidth={1} />
              <text x={pad.left - 6} y={y(v) + 4} textAnchor="end" className="fill-gray-500" style={{ fontSize: 10 }}>
                {axisLabel(v)}
              </text>
            </g>
          ))}
          {rows.map((r, i) => {
            const cx = pad.left + slot * i + slot / 2;
            const v = r.netProfitPence;
            const top = v >= 0 ? y(v) : y(0);
            const h = Math.max(v === 0 ? 0 : 2, Math.abs(y(v) - y(0)));
            const isActive = r.month === active;
            return (
              <g
                key={r.month}
                role="button"
                tabIndex={0}
                aria-label={`${monthLabel(r.month)}, ${v < 0 ? "loss" : "net profit"} ${formatPence(v)}. Show this month.`}
                onClick={() => onSelect(r.month)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(r.month);
                  }
                }}
                onMouseEnter={() => setHover(r.month)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(r.month)}
                onBlur={() => setHover(null)}
                className="cursor-pointer focus:outline-none"
              >
                <title>{`${monthLabel(r.month)}: revenue ${formatPence(r.revenuePence)}, job costs ${formatPence(r.jobCostsPence)}, expenses ${formatPence(r.expensesPence)}, net ${formatPence(v)}`}</title>
                <rect x={cx - slot / 2} y={pad.top} width={slot} height={plotH} fill={isActive ? "#f3f4f6" : "transparent"} />
                <rect
                  x={cx - barW / 2}
                  y={top}
                  width={barW}
                  height={h}
                  rx={3}
                  fill={v < 0 ? LOSS_COLOR : PROFIT_COLOR}
                  opacity={active && !isActive ? 0.55 : 1}
                />
                {wide && v !== 0 && (
                  <text
                    x={cx}
                    y={v >= 0 ? top - 4 : top + h + 11}
                    textAnchor="middle"
                    className="fill-gray-700"
                    style={{ fontSize: 10 }}
                  >
                    {formatPence(v).replace(".00", "")}
                  </text>
                )}
                <text
                  x={cx}
                  y={height - 8}
                  textAnchor="middle"
                  className={isActive ? "fill-gray-900" : "fill-gray-500"}
                  style={{ fontSize: 10, fontWeight: isActive ? 700 : 400 }}
                >
                  {shortMonth(r.month)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      {rows.length < 2 && <p className="mt-1 text-xs text-gray-500">More months appear here as they pass.</p>}
    </div>
  );
}

function MonthTable({
  rows,
  allTime,
  selected,
  currentMonth,
  onSelect,
}: {
  rows: MonthRow[];
  allTime: ReturnType<typeof periodFigures>;
  selected: string;
  currentMonth: string;
  onSelect: (month: string) => void;
}) {
  const cell = "px-3 py-2 text-right tabular-nums whitespace-nowrap";
  const money = (pence: number, loss = false) => (
    <span className={loss ? "text-red-700" : "text-gray-900"}>{formatPence(pence)}</span>
  );
  return (
    <div className="mt-4 overflow-x-auto rounded-md border border-gray-200" tabIndex={0} aria-label="Months table, scrolls sideways">
      <table className="w-full min-w-[640px] text-sm">
        <caption className="sr-only">Each month, newest first, with an All time total</caption>
        <thead className="bg-gray-50 text-xs text-gray-500">
          <tr>
            <th scope="col" className="px-3 py-2 text-left font-semibold">Month</th>
            <th scope="col" className={`${cell} font-semibold`}>Revenue paid</th>
            <th scope="col" className={`${cell} font-semibold`}>Job costs</th>
            <th scope="col" className={`${cell} font-semibold`}>Expenses</th>
            <th scope="col" className={`${cell} font-semibold`}>Net profit</th>
            <th scope="col" className={`${cell} font-semibold`}>Net margin</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((r) => (
            <tr key={r.month} className={r.month === selected ? "bg-blue-50" : "hover:bg-gray-50"}>
              <th scope="row" className="px-3 py-2 text-left font-normal">
                <button
                  type="button"
                  onClick={() => onSelect(r.month)}
                  aria-current={r.month === selected ? "true" : undefined}
                  className="font-semibold text-blue-700 hover:underline"
                >
                  {monthLabel(r.month)}
                </button>
                {r.month === currentMonth && <span className="ml-1.5 text-xs text-gray-500">(this month)</span>}
              </th>
              <td className={cell}>{money(r.revenuePence)}</td>
              <td className={cell}>{money(r.jobCostsPence)}</td>
              <td className={cell}>{money(r.expensesPence)}</td>
              <td className={`${cell} font-semibold`}>{money(r.netProfitPence, r.netProfitPence < 0)}</td>
              <td className={cell}>{formatPercent(r.netMarginPct)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t-2 border-gray-200 bg-gray-50">
          <tr className={selected === ALL_TIME ? "bg-blue-50" : ""}>
            <th scope="row" className="px-3 py-2 text-left">
              <button type="button" onClick={() => onSelect(ALL_TIME)} className="font-bold text-blue-700 hover:underline">
                All time
              </button>
            </th>
            <td className={`${cell} font-bold`}>{money(allTime.revenuePence)}</td>
            <td className={`${cell} font-bold`}>{money(allTime.jobCostsPence)}</td>
            <td className={`${cell} font-bold`}>{money(allTime.expensesPence)}</td>
            <td className={`${cell} font-bold`}>{money(allTime.netProfitPence, allTime.netProfitPence < 0)}</td>
            <td className={`${cell} font-bold`}>{formatPercent(allTime.netMarginPct)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function Breakdown({ figures, period }: { figures: ReturnType<typeof periodFigures>; period: string }) {
  const total = figures.jobCostsPence + figures.expensesPence;
  const jobRows = COST_GROUPS.map((g) => ({
    key: g.id,
    label: g.id === "distributors" ? "Distributors and fuel" : g.id === "additional" ? "Additional job costs" : g.label,
    pence: figures.costGroups[g.id],
    color: GROUP_COLORS[g.id],
  }));
  const expenseRows = EXPENSE_CATEGORIES.map((c) => ({
    key: c,
    label: EXPENSE_CATEGORY_LABELS[c],
    pence: figures.expensesByCategory[c],
    color: EXPENSE_COLOR,
  })).filter((r) => r.pence > 0);
  const share = (p: number) => (total > 0 ? formatPercent((p / total) * 100) : "-");

  const list = (rows: { key: string; label: string; pence: number; color: string }[]) => (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-gray-800">{r.label}</span>
            <span className="tabular-nums text-gray-900">
              {formatPence(r.pence)} <span className="text-xs text-gray-500">{share(r.pence)}</span>
            </span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-gray-100">
            <div
              className="h-2 rounded-full"
              style={{ width: `${total > 0 ? (r.pence / total) * 100 : 0}%`, backgroundColor: r.color }}
            />
          </div>
        </li>
      ))}
    </ul>
  );

  return (
    <section aria-labelledby="overview-costs" className="rounded-lg border border-gray-200 bg-white p-4">
      <h2 id="overview-costs" className="text-sm font-bold text-blue-900">
        Where the money went, {period}
      </h2>
      <p className="mb-3 text-xs text-gray-500">
        Total {formatPence(total)}. Percentages are shares of job costs and expenses together.
      </p>
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Job costs</h3>
      {list(jobRows)}
      <h3 className="mb-2 mt-4 text-xs font-bold uppercase tracking-wide text-gray-500">Business expenses</h3>
      {expenseRows.length === 0 ? <p className="text-sm text-gray-500">No expenses in this period.</p> : list(expenseRows)}
    </section>
  );
}

function Retainers({ retainers }: { retainers: ReturnType<typeof activeRetainers> }) {
  return (
    <section aria-labelledby="overview-retainers" className="rounded-lg border border-gray-200 bg-white p-4">
      <h2 id="overview-retainers" className="text-sm font-bold text-blue-900">
        Active retainers
      </h2>
      <p className="mb-3 text-xs text-gray-500">
        Monthly recurring revenue:{" "}
        <span className="font-semibold tabular-nums text-gray-900">{formatPence(retainers.monthlyPence)}</span> a month
      </p>
      {retainers.list.length === 0 ? (
        <p className="text-sm text-gray-500">No active retainers. Turn one on from a job&apos;s panel in the Jobs tab.</p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-md border border-gray-200">
          {retainers.list.map((r) => (
            <li key={r.leadId} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
              <div className="min-w-0">
                <Link href={`/admin/crm/leads/${r.leadId}`} className="font-semibold text-blue-900 hover:underline">
                  {r.name}
                </Link>
                {r.businessName && <span className="text-gray-500">, {r.businessName}</span>}
                <p className="text-xs text-gray-500">
                  From {monthLabel(r.start)}
                  {r.end ? ` to ${monthLabel(r.end)}` : ", ongoing"}
                </p>
              </div>
              <span className="shrink-0 font-semibold tabular-nums text-gray-900">{formatPence(r.monthlyPence)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
