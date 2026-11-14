"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ROUNDS_MAP_CREDIT } from "@/lib/rounds/attribution";
import { distributorColour, distributorName, formatDistance, roundColour, shortDate } from "@/lib/rounds/format";
import type { ReportRound } from "@/lib/rounds/report-view";
import type { ReportLinkView, RoundSummary } from "@/lib/rounds/types";
import ShareLinks from "./ShareLinks";

const ReportMap = dynamic(() => import("@/components/route-report/ReportMap"), {
  ssr: false,
  loading: () => <div className="h-[55vh] min-h-72 w-full rounded-lg border border-gray-200 bg-gray-100" />,
});

// A lead's page: its rounds (read with the page, no extra request), all of
// them together on one map as the client's link shows them (each round in its
// own colour, the start and end of every route trimmed off), adding one for
// this lead, and sharing all of them with the client.

export default function LeadRounds({ leadId, rounds, links, map }: { leadId: string; rounds: RoundSummary[]; links: ReportLinkView[]; map: ReportRound[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<number | null>(null);
  const traced = map.some((r) => r.lines.length > 0);
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5" aria-label="Rounds">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-blue-900">Rounds</h2>
        <Link href={`/admin/crm/rounds/new?leadId=${leadId}`} className="rounded-md border border-blue-700 px-3 py-1.5 text-sm font-semibold text-blue-800 hover:bg-blue-50">
          Add a round
        </Link>
      </div>
      {rounds.length === 0 ? (
        <p className="text-sm text-gray-600">No rounds recorded for this lead yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-md border border-gray-200">
          {rounds.map((r) => (
            <li key={r.id}>
              <Link href={`/admin/crm/rounds/${r.id}`} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-blue-50">
                <span className="font-medium text-gray-900">{shortDate(r.date)}</span>
                <span className="flex items-center gap-1.5 text-gray-700">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: distributorColour(r.distributor) }} aria-hidden="true" />
                  {distributorName(r.distributor)}
                </span>
                <span className="tabular-nums text-gray-800">{r.distanceM !== null ? formatDistance(r.distanceM) : "Not traced yet"}</span>
                <span className="text-xs text-gray-600">{r.sectors.map((s) => s.code).join(", ")}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {traced && (
        <section className="mt-4 space-y-2" aria-label="All of this lead's rounds on one map">
          <h3 className="text-sm font-bold text-gray-900">All rounds on one map</h3>
          <ReportMap rounds={map} selected={selected} onSelect={setSelected} />
          <ul className="flex flex-wrap gap-1.5" aria-label="Map key">
            {/* Each round keeps its colour (by its place in the list); untraced ones aren't on the map. */}
            {map.map((r, i) =>
              r.lines.length === 0 ? null : (
                <li key={`${r.date}-${i}`}>
                  <button
                    type="button"
                    onMouseEnter={() => setSelected(i)}
                    onMouseLeave={() => setSelected(null)}
                    onFocus={() => setSelected(i)}
                    onBlur={() => setSelected(null)}
                    className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs ${selected === i ? "border-gray-900" : "border-gray-200"}`}
                  >
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: roundColour(i) }} aria-hidden="true" />
                    {r.dateLabel} · {formatDistance(r.distanceM)}
                  </button>
                </li>
              )
            )}
          </ul>
          <p className="text-xs text-gray-500">As the client sees it: the start and end of each route are left off. {ROUNDS_MAP_CREDIT}</p>
        </section>
      )}
      <div className="mt-4 border-t border-gray-100 pt-4">
        <h3 className="mb-2 text-sm font-bold text-gray-900">Share all of this lead&apos;s rounds with the client</h3>
        <ShareLinks scope={{ leadId }} links={links} onChanged={() => router.refresh()} />
      </div>
    </div>
  );
}
