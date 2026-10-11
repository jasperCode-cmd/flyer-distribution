"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { formatPence, formatPercent } from "@/lib/money";
import { monthLabel } from "@/lib/profit";
import {
  CHART_LABELS,
  CHART_SERIES,
  dayCount,
  periodLabel,
  type ChartPoint,
  type ChartSeries,
  type DashboardPeriod,
} from "@/lib/dashboard";
import type { DashboardData } from "@/lib/dashboard-data";

const BAR_COLOR = "#2a78d6";
const LOSS_COLOR = "#d03b3b";
const NOW_BAND = "#e8f0fb";

// Whole pounds with thousands as "k", for the chart.
function compactPounds(pence: number): string {
  const sign = pence < 0 ? "-" : "";
  const pounds = Math.abs(pence) / 100;
  if (pounds >= 1000) return `${sign}£${(pounds / 1000).toFixed(pounds >= 10000 ? 0 : 1).replace(/\.0$/, "")}k`;
  return `${sign}£${Math.round(pounds)}`;
}

function shortMonth(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });
}

export default function DashboardMoney({
  data,
  period,
  className = "",
}: {
  data: Pick<DashboardData, "money" | "change" | "owed" | "coldJobsInMoney" | "chart" | "currentMonth">;
  period: DashboardPeriod;
  className?: string;
}) {
  const [series, setSeries] = useState<ChartSeries>("revenue");
  const { money, change, owed, coldJobsInMoney, chart, currentMonth } = data;
  const previous = change
    ? `The small figures are the change against the previous ${dayCount(change.previous.from, change.previous.to)} days, ${periodLabel({
        kind: "custom",
        ...change.previous,
      })}.`
    : null;

  return (
    <section aria-labelledby="dash-money" className={`rounded-lg border border-gray-200 bg-white p-4 ${className}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="dash-money" className="text-sm font-bold text-blue-900">
          Money <span className="font-normal text-gray-500">· {periodLabel(period)}</span>
        </h2>
        <Link href="/admin/crm/profit" className="text-xs text-blue-700 hover:underline">
          Profit page
        </Link>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tile label="Revenue paid" value={formatPence(money.revenuePence)}>
          {change && <Change value={change.change.revenuePence} kind="money" />}
        </Tile>
        <Tile
          label={money.netProfitPence < 0 ? "Net loss" : "Net profit"}
          value={formatPence(money.netProfitPence)}
          loss={money.netProfitPence < 0}
          note="after expenses"
        >
          {change && <Change value={change.change.netProfitPence} kind="money" />}
        </Tile>
        <Tile label="Margin (net)" value={formatPercent(money.netMarginPct)} loss={(money.netMarginPct ?? 0) < 0}>
          {change && <Change value={change.change.netMarginPts} kind="pts" />}
        </Tile>
        <Tile label="Money owed" value={formatPence(owed.owedPence)} note="now">
          <p className="mt-0.5 text-[11px] text-gray-500">
            {owed.jobsOwing === 0 ? "Nothing owed" : `On ${owed.jobsOwing} ${owed.jobsOwing === 1 ? "job" : "jobs"}, any period`}
          </p>
        </Tile>
      </div>
      {(previous || coldJobsInMoney > 0) && (
        <p className="mt-1.5 text-[11px] text-gray-500">
          {previous}
          {previous && coldJobsInMoney > 0 ? " " : ""}
          {coldJobsInMoney > 0 &&
            `Includes ${coldJobsInMoney} won cold outreach ${coldJobsInMoney === 1 ? "job" : "jobs"}, as the Profit page does.`}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div role="group" aria-label="Chart shows" className="inline-flex flex-wrap rounded-md border border-gray-300 p-0.5">
          {CHART_SERIES.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={series === s}
              onClick={() => setSeries(s)}
              className={`rounded px-2.5 py-1 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                series === s ? "bg-blue-900 text-white" : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              {CHART_LABELS[s]}
            </button>
          ))}
        </div>
      </div>
      <MonthBars points={chart[series]} series={series} currentMonth={currentMonth} />
    </section>
  );
}

function Tile({
  label,
  value,
  loss = false,
  note,
  children,
}: {
  label: string;
  value: string;
  loss?: boolean;
  note?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-md border border-gray-100 bg-gray-50/60 px-3 py-2">
      <p className="text-xs text-gray-500">
        {label}
        {note && <span className="ml-1 rounded bg-white px-1 text-[10px] font-medium text-gray-500 ring-1 ring-gray-200">{note}</span>}
      </p>
      <p className={`truncate text-lg font-bold tabular-nums ${loss ? "text-red-700" : "text-blue-900"}`}>{value}</p>
      {children}
    </div>
  );
}

function Change({ value, kind }: { value: number | null; kind: "money" | "pts" }) {
  if (value === null) return <p className="mt-0.5 text-[11px] text-gray-500">-</p>;
  const zero = kind === "money" ? value === 0 : Math.abs(value) < 0.05;
  const up = value > 0;
  const sign = up ? "+" : value < 0 ? "-" : "";
  const text = kind === "money" ? `${sign}${formatPence(Math.abs(value))}` : `${sign}${Math.abs(value).toFixed(1)} pts`;
  return (
    <p className={`mt-0.5 truncate text-[11px] ${zero ? "text-gray-500" : up ? "text-green-700" : "text-red-700"}`}>
      {!zero && <span aria-hidden="true">{up ? "▲ " : "▼ "}</span>}
      {zero ? "No change" : text}
      <span className="sr-only"> against the previous period</span>
    </p>
  );
}

// One bar per whole month: the current month shaded and marked "so far",
// a loss drawn below the line in red with its minus sign written out.
function MonthBars({ points, series, currentMonth }: { points: ChartPoint[]; series: ChartSeries; currentMonth: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(240, Math.floor(entry.contentRect.width))));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const money = series === "revenue" || series === "net";
  const label = (v: number) => (money ? compactPounds(v) : String(v));
  const full = (v: number) => (money ? formatPence(v) : String(v));
  const values = points.map((p) => p.value);
  const max = Math.max(0, ...values);
  const min = Math.min(0, ...values);
  const pad = { top: 16, bottom: min < 0 ? 34 : 22, left: 40, right: 6 };
  // At least 34px a month; on a narrow screen the chart scrolls sideways.
  const svgWidth = Math.max(width, pad.left + pad.right + points.length * 34);
  const slot = (svgWidth - pad.left - pad.right) / Math.max(points.length, 1);
  const height = 140 + (pad.bottom - 22);
  const plotH = height - pad.top - pad.bottom;
  const span = max - min || 1;
  const y = (v: number) => pad.top + ((max - v) / span) * plotH;
  const barW = Math.max(6, Math.min(32, slot * 0.6));
  const showLabels = slot >= 34;
  const ticks = [max, 0, min].filter((v, i, a) => a.indexOf(v) === i);
  const shown = points.find((p) => p.month === active) ?? null;
  const describe = (p: ChartPoint) =>
    `${monthLabel(p.month)}${p.month === currentMonth ? " so far" : ""}: ${CHART_LABELS[series].toLowerCase()} ${full(p.value)}`;

  return (
    <div className="mt-2">
      <p className="min-h-4 text-xs text-gray-600" aria-live="polite">
        {shown ? describe(shown) : (
          <>
            <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm align-middle ring-1 ring-blue-200" style={{ backgroundColor: NOW_BAND }} aria-hidden="true" />
            Shaded: this month so far.{series === "net" ? " Losses sit below the line." : ""}
          </>
        )}
      </p>
      <div ref={boxRef} className="w-full overflow-x-auto">
        <svg
          width={svgWidth}
          height={height}
          role="img"
          aria-label={`${CHART_LABELS[series]} by month: ${points.map(describe).join("; ")}`}
          className="block"
        >
          {ticks.map((v) => (
            <g key={v}>
              <line x1={pad.left} x2={svgWidth - pad.right} y1={y(v)} y2={y(v)} stroke={v === 0 ? "#9ca3af" : "#eef0f3"} strokeWidth={1} />
              <text x={pad.left - 6} y={y(v) + 3.5} textAnchor="end" className="fill-gray-500" style={{ fontSize: 10 }}>
                {label(v)}
              </text>
            </g>
          ))}
          {points.map((p, i) => {
            const cx = pad.left + slot * i + slot / 2;
            const v = p.value;
            const top = v >= 0 ? y(v) : y(0);
            const h = Math.max(v === 0 ? 0 : 2, Math.abs(y(v) - y(0)));
            const now = p.month === currentMonth;
            return (
              <g
                key={p.month}
                tabIndex={0}
                aria-label={describe(p)}
                onMouseEnter={() => setActive(p.month)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(p.month)}
                onBlur={() => setActive(null)}
                className="focus:outline-none"
              >
                <title>{describe(p)}</title>
                <rect x={cx - slot / 2} y={pad.top - 6} width={slot} height={plotH + 6} fill={now ? NOW_BAND : active === p.month ? "#f3f4f6" : "transparent"} />
                <rect x={cx - barW / 2} y={top} width={barW} height={h} rx={3} fill={v < 0 ? LOSS_COLOR : BAR_COLOR} />
                {showLabels && v !== 0 && (
                  <text x={cx} y={v >= 0 ? top - 3 : top + h + 10} textAnchor="middle" className="fill-gray-700" style={{ fontSize: 10 }}>
                    {label(v)}
                  </text>
                )}
                <text
                  x={cx}
                  y={height - 6}
                  textAnchor="middle"
                  className={now ? "fill-gray-900" : "fill-gray-500"}
                  style={{ fontSize: 10, fontWeight: now ? 700 : 400 }}
                >
                  {shortMonth(p.month)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
