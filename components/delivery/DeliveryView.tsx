"use client";

import dynamic from "next/dynamic";
import type { ShareView } from "@/lib/area-planner/share-view";
import { leafletText, totalText } from "@/lib/area-planner/share-view";
import { MAP_TILES } from "@/lib/area-planner/tiles";

const DeliveryMap = dynamic(() => import("./DeliveryMap"), {
  ssr: false,
  loading: () => <div className="h-[60vh] min-h-80 w-full rounded-lg border border-gray-200 bg-gray-100" />,
});

// A distributor's private link page: their areas and leaflet counts, the
// title, the date, and nothing else. An FDH job's page carries the FDH
// name; a Bournemouth job's page carries no business at all.
export default function DeliveryView({ view, showBusiness }: { view: ShareView; showBusiness: boolean }) {
  return (
    <div className="min-h-screen bg-white">
      <header className={showBusiness ? "bg-blue-900 text-white" : "border-b border-gray-200 bg-white text-gray-900"}>
        <div className="mx-auto max-w-5xl px-4 py-4">
          {showBusiness && <p className="text-xs font-semibold uppercase tracking-wide text-blue-100">Flyer Distribution Hampshire</p>}
          <h1 className="text-xl font-bold">{view.title}</h1>
          <p className={`mt-1 text-sm ${showBusiness ? "text-blue-100" : "text-gray-600"}`}>
            Prepared {view.preparedOn}
            {view.campaignStart ? `, delivery from ${view.campaignStart}` : ""}
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-4 px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-base font-semibold text-gray-900">
            <span className="inline-block h-3.5 w-3.5 rounded-full" style={{ backgroundColor: view.distributor.colour }} aria-hidden="true" />
            {view.distributor.name}
          </p>
          <p className="text-sm text-gray-700">
            Total: <span className="font-semibold">{totalText(view)}</span>
          </p>
        </div>

        <DeliveryMap view={view} />

        <section aria-label="Your areas">
          <h2 className="mb-2 text-sm font-bold text-gray-900">Your areas</h2>
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
            {view.areas.map((area, i) => (
              <li key={area.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="min-w-0 break-words text-gray-900">{area.label ?? `Area ${i + 1}`}</span>
                <span className="shrink-0 tabular-nums text-gray-700">{leafletText(area.leafletCount)}</span>
              </li>
            ))}
          </ul>
        </section>

        <p className="text-xs text-gray-500">
          Map {MAP_TILES.attributionText}. Postcode boundaries contain OS, Royal Mail and ONS data, Crown copyright and database rights 2026.
        </p>
      </main>
    </div>
  );
}
