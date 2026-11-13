"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { createBaseMap } from "@/components/area-planner/leaflet-base";
import { escapeHtml } from "@/components/area-planner/map-style";
import type { ReportRound } from "@/lib/rounds/report-view";
import { formatDistance, roundColour } from "@/lib/rounds/format";

// The map on a client's report: each round's (trimmed) route in its own
// colour, zoomable, read-only. Tapping a route shows its date and distance.

type Props = { rounds: ReportRound[]; selected: number | null; onSelect: (index: number | null) => void };

export default function ReportMap({ rounds, selected, onSelect }: Props) {
  const element = useRef<HTMLDivElement>(null);
  const layers = useRef<L.Polyline[]>([]);
  const select = useRef(onSelect);
  select.current = onSelect;

  useEffect(() => {
    if (!element.current) return;
    const map = createBaseMap(element.current);
    const renderer = L.canvas({ tolerance: 8 });
    layers.current = rounds.map((round, i) => {
      const line = L.polyline(
        round.lines.map((l) => l.map(([lng, lat]) => [lat, lng] as L.LatLngTuple)),
        { color: roundColour(i), weight: 4, opacity: 0.9, renderer }
      );
      line.bindTooltip(escapeHtml(`${round.dateLabel}: ${formatDistance(round.distanceM)}`), { sticky: true, className: "rr-label" });
      line.on("click", () => select.current(i));
      return line.addTo(map);
    });
    const all = L.featureGroup(layers.current.filter((l) => l.getLatLngs().length > 0));
    const bounds = all.getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [24, 24], maxZoom: 17 });
    return () => {
      map.remove();
      layers.current = [];
    };
  }, [rounds]);

  useEffect(() => {
    layers.current.forEach((line, i) => line.setStyle({ weight: selected === i ? 7 : 4, opacity: selected === null || selected === i ? 0.95 : 0.45 }));
  }, [selected]);

  return <div ref={element} className="h-[55vh] min-h-72 w-full rounded-lg border border-gray-200" aria-label="Map of your delivery rounds" />;
}
