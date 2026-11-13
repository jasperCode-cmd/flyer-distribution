"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { createBaseMap } from "@/components/area-planner/leaflet-base";
import { overlayCorners, type Transform } from "@/lib/rounds/alignment";
import type { LngLat, Lines } from "@/lib/rounds/geometry";
import type { Markers } from "@/lib/rounds/types";
import { AffineImageOverlay } from "./affine-overlay";

// The map side of lining up a screenshot: OSM tiles, the A and B points
// clicked on it, the screenshot laid over it see-through once lined up, the
// traced route (in magenta, to stand out from the screenshot's blue), the
// start and end markers, and an eraser brush for stray bits. Browser only.

export type AlignMode = "view" | "pick" | "erase" | "start" | "end";

export type AlignMapHandle = {
  fitBbox(bbox: [number, number, number, number]): void;
  // What the map shows now, as [west, south, east, north].
  bounds(): [number, number, number, number] | null;
};

type Props = {
  handleRef: MutableRefObject<AlignMapHandle | null>;
  focus: [number, number, number, number] | null;
  mode: AlignMode;
  points: (LngLat | null)[];
  overlay: { url: string; width: number; height: number; transform: Transform } | null;
  overlayOpacity: number;
  lines: Lines;
  markers: Markers;
  brushPx: number;
  onPick: (p: LngLat) => void;
  onErase: (centre: LngLat, radiusM: number) => void;
  onEraseEnd: () => void;
  onMarker: (which: "start" | "end", p: LngLat) => void;
};

const toLatLng = ([lng, lat]: LngLat) => L.latLng(lat, lng);

function label(text: string, colour: string) {
  return L.divIcon({
    className: "",
    html: `<span style="display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:9999px;background:${colour};color:#fff;font:700 12px/1 system-ui,sans-serif;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4)">${text}</span>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

export default function AlignMap(props: Props) {
  const element = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const pointLayer = useRef<L.LayerGroup | null>(null);
  const lineLayer = useRef<L.LayerGroup | null>(null);
  const overlayLayer = useRef<AffineImageOverlay | null>(null);
  const brush = useRef<L.CircleMarker | null>(null);
  const latest = useRef(props);
  latest.current = props;

  props.handleRef.current = {
    fitBbox([w, s, e, n]) {
      mapRef.current?.fitBounds([[s, w], [n, e]], { padding: [20, 20], maxZoom: 17 });
    },
    bounds() {
      const b = mapRef.current?.getBounds();
      return b ? [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()] : null;
    },
  };

  useEffect(() => {
    if (!element.current) return;
    const map = createBaseMap(element.current, { doubleClickZoom: false });
    mapRef.current = map;
    pointLayer.current = L.layerGroup().addTo(map);
    lineLayer.current = L.layerGroup().addTo(map);
    const f = latest.current.focus;
    if (f) map.fitBounds([[f[1], f[0]], [f[3], f[2]]], { padding: [20, 20], maxZoom: 17 });
    map.on("click", (e: L.LeafletMouseEvent) => {
      const p = latest.current;
      const at: LngLat = [e.latlng.lng, e.latlng.lat];
      if (p.mode === "pick") p.onPick(at);
      else if (p.mode === "start" || p.mode === "end") p.onMarker(p.mode, at);
    });

    // The eraser: press and drag; the brush follows the pointer.
    const container = map.getContainer();
    let erasing = false;
    const brushAt = (ev: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const pt = L.point(ev.clientX - rect.left, ev.clientY - rect.top);
      const centre = map.containerPointToLatLng(pt);
      const edge = map.containerPointToLatLng(pt.add([latest.current.brushPx, 0]));
      return { centre, radiusM: map.distance(centre, edge) };
    };
    const onDown = (ev: PointerEvent) => {
      if (latest.current.mode !== "erase") return;
      erasing = true;
      container.setPointerCapture(ev.pointerId);
      const { centre, radiusM } = brushAt(ev);
      latest.current.onErase([centre.lng, centre.lat], radiusM);
      ev.preventDefault();
    };
    const onMove = (ev: PointerEvent) => {
      if (latest.current.mode !== "erase") {
        brush.current?.remove();
        brush.current = null;
        return;
      }
      const { centre, radiusM } = brushAt(ev);
      if (!brush.current) brush.current = L.circleMarker(centre, { radius: latest.current.brushPx, color: "#111827", weight: 1, fillOpacity: 0.08, interactive: false }).addTo(map);
      brush.current.setLatLng(centre).setRadius(latest.current.brushPx);
      if (erasing) latest.current.onErase([centre.lng, centre.lat], radiusM);
    };
    const onUp = () => {
      if (erasing) latest.current.onEraseEnd();
      erasing = false;
    };
    container.addEventListener("pointerdown", onDown);
    container.addEventListener("pointermove", onMove);
    container.addEventListener("pointerup", onUp);
    container.addEventListener("pointercancel", onUp);
    return () => {
      container.removeEventListener("pointerdown", onDown);
      container.removeEventListener("pointermove", onMove);
      container.removeEventListener("pointerup", onUp);
      container.removeEventListener("pointercancel", onUp);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Panning is off while erasing, so a drag rubs out instead.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (props.mode === "erase") map.dragging.disable();
    else map.dragging.enable();
    map.getContainer().style.cursor = props.mode === "view" ? "" : props.mode === "erase" ? "none" : "crosshair";
    if (props.mode !== "erase") {
      brush.current?.remove();
      brush.current = null;
    }
  }, [props.mode]);

  useEffect(() => {
    const group = pointLayer.current;
    if (!group) return;
    group.clearLayers();
    props.points.forEach((p, i) => p && L.marker(toLatLng(p), { icon: label(i === 0 ? "A" : "B", "#1C398E"), interactive: false }).addTo(group));
    if (props.markers.start) L.marker(toLatLng(props.markers.start), { icon: label("S", "#DC2626"), interactive: false }).addTo(group);
    if (props.markers.end) L.marker(toLatLng(props.markers.end), { icon: label("E", "#16A34A"), interactive: false }).addTo(group);
  }, [props.points, props.markers]);

  useEffect(() => {
    const group = lineLayer.current;
    if (!group) return;
    group.clearLayers();
    for (const line of props.lines) {
      L.polyline(line.map(toLatLng), { color: "#FF00D4", weight: 3, opacity: 0.95, interactive: false }).addTo(group);
    }
  }, [props.lines]);

  const overlayKey = props.overlay ? `${props.overlay.url}|${JSON.stringify(props.overlay.transform)}` : "";
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    overlayLayer.current?.remove();
    overlayLayer.current = null;
    const o = latest.current.overlay;
    if (!o) return;
    const corners = overlayCorners(o.transform, o.width, o.height).map(toLatLng) as [L.LatLng, L.LatLng, L.LatLng];
    overlayLayer.current = new AffineImageOverlay(o.url, corners, { width: o.width, height: o.height }, latest.current.overlayOpacity).addTo(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlayKey]);

  useEffect(() => {
    overlayLayer.current?.setOpacity(props.overlayOpacity);
  }, [props.overlayOpacity]);

  return <div ref={element} className="h-full w-full" aria-label="Map for lining up the screenshot" />;
}
