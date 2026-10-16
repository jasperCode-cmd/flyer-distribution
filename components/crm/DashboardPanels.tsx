import Link from "next/link";
import { formatPence, formatPercent } from "@/lib/money";
import { STAGE_LABELS, STAGES } from "@/lib/crm-constants";
import { CALENDAR_EVENT_TYPE_LABELS } from "@/lib/calendar-constants";
import type { BusinessFilter } from "@/lib/business";
import {
  CAMPAIGN_DAYS,
  EVENT_DAYS,
  periodLabel,
  type ColdOutreachFigures,
  type DashboardPeriod,
  type PipelineFigures,
  type UpcomingCampaign,
  type UpcomingEvent,
} from "@/lib/dashboard";

// The Dashboard's Sales pipeline, Upcoming and Cold outreach sections. Plain
// server-rendered markup; the figures come from lib/dashboard.ts.

const STAGE_DOT: Record<string, string> = {
  UNCONTACTED: "bg-gray-400",
  AWAITING_RESPONSE: "bg-amber-500",
  WON: "bg-blue-600",
  COMPLETED: "bg-green-600",
  LOST: "bg-red-500",
};

function Figure({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="min-w-0 rounded-md border border-gray-100 bg-gray-50/60 px-3 py-2">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="truncate text-lg font-bold tabular-nums text-blue-900">{value}</p>
      <p className="text-[11px] leading-snug text-gray-500">{note}</p>
    </div>
  );
}

export function SalesPipeline({
  pipeline,
  period,
  business = "ALL",
  className = "",
}: {
  pipeline: PipelineFigures;
  period: DashboardPeriod;
  business?: BusinessFilter;
  className?: string;
}) {
  const created = STAGES.reduce((sum, s) => sum + (pipeline.stageCounts[s] ?? 0), 0);
  return (
    <section aria-labelledby="dash-pipeline" className={`rounded-lg border border-gray-200 bg-white p-4 ${className}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="dash-pipeline" className="text-sm font-bold text-blue-900">
          Sales pipeline <span className="font-normal text-gray-500">· {periodLabel(period)}, cold outreach left out</span>
        </h2>
        <Link
          href={business === "ALL" ? "/admin/crm/leads" : `/admin/crm/leads?business=${business}`}
          className="text-xs text-blue-700 hover:underline"
        >
          Leads
        </Link>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Figure label="New enquiries" value={String(pipeline.newEnquiries)} note="From the website quote form" />
        <Figure label="Win rate" value={formatPercent(pipeline.winRatePct)} note="(Won + Completed) ÷ (Won + Completed + Lost)" />
        <Figure
          label="Average job value"
          value={formatPence(pipeline.avgJobPence)}
          note={`Mean deal value of jobs won, based on ${pipeline.avgBasedOn} ${pipeline.avgBasedOn === 1 ? "job" : "jobs"}`}
        />
      </div>
      <div className="mt-3">
        <p className="text-[11px] text-gray-500">
          {created} {created === 1 ? "lead" : "leads"} created in this period, by the stage they are in now
        </p>
        <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
          {STAGES.map((s) => (
            <li key={s} className="inline-flex items-center gap-1.5 text-xs text-gray-700">
              <span className={`inline-block h-2 w-2 rounded-full ${STAGE_DOT[s]}`} aria-hidden="true" />
              {STAGE_LABELS[s]}
              <span className="font-semibold tabular-nums text-gray-900">{pipeline.stageCounts[s] ?? 0}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const ROWS = 6;

function dayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/London" });
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
}

export function Upcoming({
  campaigns,
  events,
  className = "",
}: {
  campaigns: UpcomingCampaign[];
  events: UpcomingEvent[];
  className?: string;
}) {
  // About six rows between the two, campaigns first.
  const campaignRows = Math.min(campaigns.length, Math.max(3, ROWS - events.length));
  const eventRows = Math.min(events.length, ROWS - campaignRows);
  const hidden = campaigns.length - campaignRows + (events.length - eventRows);

  return (
    <section aria-labelledby="dash-upcoming" className={`rounded-lg border border-gray-200 bg-white p-4 ${className}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="dash-upcoming" className="text-sm font-bold text-blue-900">
          Upcoming
        </h2>
        <Link href="/admin/crm/calendar" className="text-xs text-blue-700 hover:underline">
          Calendar{hidden > 0 ? `, ${hidden} more` : ""}
        </Link>
      </div>

      <h3 className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Campaigns, next {CAMPAIGN_DAYS} days</h3>
      {campaigns.length === 0 ? (
        <p className="py-1 text-sm text-gray-500">No campaigns starting.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {campaigns.slice(0, campaignRows).map((c) => (
            <li key={c.leadId} className="flex items-center justify-between gap-3 py-1.5 text-sm">
              <span className="w-[7.5rem] shrink-0 whitespace-nowrap text-xs text-gray-600">{dayLabel(c.start)}</span>
              <Link href={`/admin/crm/leads/${c.leadId}`} className="min-w-0 flex-1 truncate font-medium text-blue-900 hover:underline">
                {c.businessName || c.name}
              </Link>
              <span className={`shrink-0 truncate text-xs ${c.distributor ? "text-gray-600" : "font-medium text-amber-800"}`}>
                {c.distributor ?? "No distributor"}
              </span>
            </li>
          ))}
        </ul>
      )}

      <h3 className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Calendar, next {EVENT_DAYS} days</h3>
      {events.length === 0 ? (
        <p className="py-1 text-sm text-gray-500">Nothing booked.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {events.slice(0, eventRows).map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 py-1.5 text-sm">
              <span className="w-[7.5rem] shrink-0 whitespace-nowrap text-xs text-gray-600">
                {dayLabel(e.start)}, {timeLabel(e.start)}
              </span>
              {e.leadId ? (
                <Link href={`/admin/crm/leads/${e.leadId}`} className="min-w-0 flex-1 truncate text-gray-900 hover:underline">
                  {e.title}
                </Link>
              ) : (
                <span className="min-w-0 flex-1 truncate text-gray-900">{e.title}</span>
              )}
              <span className="shrink-0 text-xs text-gray-500">{CALENDAR_EVENT_TYPE_LABELS[e.type] ?? e.type}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ColdOutreach({ cold }: { cold: ColdOutreachFigures }) {
  const items: [string, number][] = [
    ["Cold leads", cold.total],
    ["Still uncontacted", cold.uncontacted],
    ["Called in the last 7 days", cold.calledLast7Days],
    ["Moved to Awaiting Response", cold.awaitingResponse],
    ["Won", cold.won],
  ];
  return (
    <details className="group rounded-lg border border-gray-200 bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-4 py-3 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 [&::-webkit-details-marker]:hidden">
        <span className="text-sm font-bold text-blue-900">
          Cold outreach <span className="font-normal text-gray-500">· {cold.total} leads, kept out of the figures above</span>
        </span>
        <svg aria-hidden="true" viewBox="0 0 12 12" className="h-3 w-3 shrink-0 text-gray-500 transition-transform group-open:rotate-180">
          <path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </summary>
      <div className="border-t border-gray-100 px-4 py-3">
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {items.map(([label, value]) => (
            <div key={label} className="rounded-md border border-gray-100 bg-gray-50/60 px-3 py-2">
              <dt className="text-xs text-gray-500">{label}</dt>
              <dd className="text-lg font-bold tabular-nums text-blue-900">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-[11px] text-gray-500">
          As things stand now, leaving out scrapped leads.{" "}
          <Link href="/admin/crm/dialer" className="text-blue-700 hover:underline">
            Open the Dialer
          </Link>
        </p>
      </div>
    </details>
  );
}
