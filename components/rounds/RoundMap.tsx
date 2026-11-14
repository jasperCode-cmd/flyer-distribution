"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { createBaseMap } from "@/components/area-planner/leaflet-base";
import { OS_ATTRIBUTION } from "@/lib/rounds/attribution";
import type { LngLat, Lines } from "@/lib/rounds/geometry";
import type { Markers } from "@/lib/rounds/types";

// A round's traced lines on the map in the CRM: the full lines (no privacy
// trim here), in the distributor's colour, with the start and end dots.

type Props = { lines: Lines; colour: string; markers: Markers[]; focus: [number, number, number, number] | null };

const toLatLng = ([lng, lat]: LngLat) => L.latLng(lat, lng);

export default function RoundMap({ lines, colour, markers, focus }: Props) {
  const element = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!element.current) return;
    const map = createBaseMap(element.current);
    map.attributionControl.addAttribution(OS_ATTRIBUTION);
    const group = L.featureGroup().addTo(map);
    for (const line of lines) L.polyline(line.map(toLatLng), { color: colour, weight: 4, opacity: 0.9 }).addTo(group);
    for (const m of markers) {
      if (m.start) L.circleMarker(toLatLng(m.start), { radius: 7, color: "#fff", weight: 2, fillColor: "#DC2626", fillOpacity: 1 }).bindTooltip("Start").addTo(group);
      if (m.end) L.circleMarker(toLatLng(m.end), { radius: 7, color: "#fff", weight: 2, fillColor: "#16A34A", fillOpacity: 1 }).bindTooltip("End").addTo(group);
    }
    const bounds = group.getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [24, 24], maxZoom: 17 });
    else if (focus) map.fitBounds([[focus[1], focus[0]], [focus[3], focus[2]]], { padding: [24, 24], maxZoom: 16 });
    return () => {
      map.remove();
    };
  }, [lines, colour, markers, focus]);
  return <div ref={element} className="h-[50vh] min-h-72 w-full rounded-lg border border-gray-200" aria-label="Map of the round" />;
}
