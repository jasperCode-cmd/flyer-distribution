"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { ShareView } from "@/lib/area-planner/share-view";
import { leafletText } from "@/lib/area-planner/share-view";
import { boundsOf, createBaseMap, polygonLayer } from "@/components/area-planner/leaflet-base";
import { areaPathStyle, escapeHtml } from "@/components/area-planner/map-style";

// The read-only map on a distributor's private link: only their own areas,
// each labelled with its name and leaflet count. Nothing can be changed.
export default function DeliveryMap({ view }: { view: ShareView }) {
  const element = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!element.current) return;
    const map = createBaseMap(element.current);
    for (const area of view.areas) {
      const layer = polygonLayer(area.geometry, areaPathStyle({ colour: view.distributor.colour, assigned: true, status: "ASSIGNED" }));
      const text = [area.label, leafletText(area.leafletCount)].filter(Boolean).join(": ");
      layer.bindTooltip(escapeHtml(text), { permanent: true, direction: "center", className: "ap-label" }).addTo(map);
    }
    const bounds = boundsOf(view.areas.map((a) => a.geometry));
    if (bounds) map.fitBounds(bounds, { padding: [24, 24], maxZoom: 16 });
    return () => {
      map.remove();
    };
  }, [view]);

  return <div ref={element} className="h-[60vh] min-h-80 w-full rounded-lg border border-gray-200" aria-label="Map of your delivery areas" />;
}
