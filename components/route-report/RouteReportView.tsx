"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { ReportView } from "@/lib/rounds/report-view";
import { formatDistance, roundColour } from "@/lib/rounds/format";
import { MAP_TILES } from "@/lib/area-planner/tiles";

const ReportMap = dynamic(() => import("./ReportMap"), {
  ssr: false,
  loading: () => <div className="h-[55vh] min-h-72 w-full rounded-lg border border-gray-200 bg-gray-100" />,
});

// A client's leaflet delivery report: their rounds on a map they can zoom,
// each round's date, the postcode sectors and distance covered, and the
// screenshots where stored, under the business's own name, website and
// email. The start and end of every route are left off (the privacy trim).
// No link anywhere but the business's own public website and email.

const THEMES = {
  FDH: { band: "bg-blue-900", sub: "text-blue-100", accent: "text-blue-900", chip: "bg-blue-50 text-blue-900 border-blue-200" },
  LDB: { band: "bg-[#1D3215]", sub: "text-[#E3EBD5]", accent: "text-[#1D3215]", chip: "bg-[#F6F5F2] text-[#1D3215] border-[#C9D7B4]" },
} as const;

export default function RouteReportView({ view, imageBase }: { view: ReportView; imageBase: string }) {
  const theme = THEMES[view.business];
  const [selected, setSelected] = useState<number | null>(null);
  const roundsText = view.totals.rounds === 1 ? "1 round" : `${view.totals.rounds} rounds`;

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <header className={`${theme.band} text-white`}>
        <div className="mx-auto max-w-5xl px-4 py-5">
          <p className={`text-xs font-semibold uppercase tracking-wide ${theme.sub}`}>{view.brand.name}</p>
          <h1 className="mt-1 text-2xl font-bold">Leaflet delivery report</h1>
          {view.clientName && <p className={`mt-1 text-sm ${theme.sub}`}>For {view.clientName}</p>}
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-5 px-4 py-5">
        <section aria-label="Summary" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-gray-200 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Rounds</p>
            <p className="mt-1 text-xl font-bold">{roundsText}</p>
          </div>
          <div className="rounded-lg border border-gray-200 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Distance covered</p>
            <p className="mt-1 text-xl font-bold">{formatDistance(view.totals.distanceM)}</p>
          </div>
          <div className="rounded-lg border border-gray-200 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Postcode sectors</p>
            <p className="mt-1 text-xl font-bold">{view.totals.sectors.length}</p>
          </div>
        </section>

        {view.rounds.length === 0 ? (
          <p className="rounded-lg border border-gray-200 p-4 text-sm text-gray-700">No rounds have been added to this report yet.</p>
        ) : (
          <ReportMap rounds={view.rounds} selected={selected} onSelect={setSelected} />
        )}
        <p className="text-xs text-gray-500">For privacy, the start and end of each route are not shown on the map.</p>

        <section aria-label="Rounds" className="space-y-3">
          <h2 className={`text-base font-bold ${theme.accent}`}>Your rounds</h2>
          <ul className="space-y-3">
            {view.rounds.map((round, i) => (
              <li
                key={`${round.date}-${i}`}
                className={`rounded-lg border p-3 ${selected === i ? "border-gray-900" : "border-gray-200"}`}
                onMouseEnter={() => setSelected(i)}
                onMouseLeave={() => setSelected(null)}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-2 font-semibold">
                    <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: roundColour(i) }} aria-hidden="true" />
                    {round.dateLabel}
                  </p>
                  <p className="text-sm tabular-nums text-gray-700">{formatDistance(round.distanceM)}</p>
                </div>
                {round.sectors.length > 0 && (
                  <p className="mt-2 flex flex-wrap gap-1.5" aria-label="Postcode sectors">
                    {round.sectors.map((s) => (
                      <span key={s} className={`rounded-full border px-2 py-0.5 text-xs font-medium ${theme.chip}`}>
                        {s}
                      </span>
                    ))}
                  </p>
                )}
                {round.screenshots.length > 0 && (
                  <div className="mt-3 flex gap-2 overflow-x-auto">
                    {round.screenshots.map((id, k) => (
                      <img
                        key={id}
                        src={`${imageBase}/${id}`}
                        alt={`Route screenshot ${k + 1} for ${round.dateLabel}`}
                        className="h-48 w-auto shrink-0 rounded border border-gray-200"
                        loading="lazy"
                      />
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>

        {view.totals.sectors.length > 0 && (
          <section aria-label="All postcode sectors">
            <h2 className={`mb-2 text-base font-bold ${theme.accent}`}>Postcode sectors covered</h2>
            <p className="flex flex-wrap gap-1.5">
              {view.totals.sectors.map((s) => (
                <span key={s} className={`rounded-full border px-2 py-0.5 text-xs font-medium ${theme.chip}`}>
                  {s}
                </span>
              ))}
            </p>
          </section>
        )}

        <p className="text-xs text-gray-500">
          Map {MAP_TILES.attributionText}. Postcode sectors are worked out from ONS data (contains OS, Royal Mail and ONS data, Crown copyright and database rights 2026)
          and are approximate.
        </p>
      </main>

      <footer className="border-t border-gray-200 bg-gray-50">
        <div className="mx-auto flex max-w-5xl flex-col gap-1 px-4 py-5 text-sm text-gray-700 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-semibold text-gray-900">{view.brand.name}</p>
          <p className="flex flex-wrap gap-x-4 gap-y-1">
            <a href={view.brand.websiteUrl} className="underline underline-offset-2" rel="noopener">
              {view.brand.website}
            </a>
            <a href={`mailto:${view.brand.email}`} className="underline underline-offset-2">
              {view.brand.email}
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
