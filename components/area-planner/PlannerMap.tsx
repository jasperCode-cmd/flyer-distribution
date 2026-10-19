"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import L from "leaflet";
import "@geoman-io/leaflet-geoman-free";
import "leaflet/dist/leaflet.css";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import { simplify } from "@turf/simplify";
import { intersect } from "@turf/intersect";
import { featureCollection } from "@turf/helpers";
import type { Feature, MultiPolygon, Polygon } from "geojson";
import { areaM2, pointInArea, type AreaGeometry, type LatLng } from "@/lib/area-planner/geometry";
import { leafletText } from "@/lib/area-planner/share-view";
import { areaName } from "@/lib/area-planner/costs";
import type { PlannerArea, PlannerDistributor, PlannerOverlap } from "@/lib/area-planner/types";
import { boundsOf, createBaseMap, polygonGeometry, toLatLngs } from "./leaflet-base";
import { OVERLAP_STYLE, areaPathStyle, escapeHtml } from "./map-style";

// The Area Planner's map: every area in its distributor's colour with a
// label, the overlaps hatched in red, the drawing tools (circle, rectangle,
// click-to-place polygon from Geoman, and our own press-and-drag lasso),
// editing the selected area's shape, and finding which area is under a
// point for distributors dropped from the sidebar. Browser only.

export type Tool = "select" | "circle" | "rectangle" | "polygon" | "lasso";

export type ShapeInput =
  | { kind: "CIRCLE"; centre: LatLng; radiusM: number }
  | { kind: "RECTANGLE" | "POLYGON"; geometry: AreaGeometry };

export type PlannerMapHandle = {
  // The place and area (if any) under a screen point, or null off the map.
  pointAt(clientX: number, clientY: number): { latlng: LatLng; areaId: string | null } | null;
  fitTo(geometries: AreaGeometry[]): void;
};

type Props = {
  // Filled in with the map's handle (next/dynamic doesn't pass refs on).
  handleRef: MutableRefObject<PlannerMapHandle | null>;
  areas: PlannerArea[];
  overlaps: PlannerOverlap[];
  distributors: PlannerDistributor[];
  selectedId: string | null;
  editingId: string | null;
  tool: Tool;
  assigning: boolean;
  readOnly: boolean;
  fitKey: string;
  onSelect: (id: string | null) => void;
  onCreate: (shape: ShapeInput) => void;
  onShapeEdited: (id: string, shape: ShapeInput) => void;
  onPlace: (latlng: LatLng, areaId: string | null) => void;
  onToolDone: () => void;
};

type Entry = { layer: L.Polygon | L.Circle; signature: string };

function shapeSignature(area: PlannerArea): string {
  return JSON.stringify([area.kind, area.centre, area.radiusM, area.kind === "CIRCLE" ? null : area.geometry]);
}

function makeLayer(area: PlannerArea): L.Polygon | L.Circle {
  if (area.kind === "CIRCLE" && area.centre && area.radiusM) {
    return L.circle([area.centre.lat, area.centre.lng], { radius: area.radiusM });
  }
  if (area.kind === "RECTANGLE" && area.geometry.type === "Polygon") {
    const latlngs = area.geometry.coordinates[0].map(([lng, lat]) => L.latLng(lat, lng));
    return L.rectangle(L.latLngBounds(latlngs));
  }
  return L.polygon(toLatLngs(area.geometry) as L.LatLngExpression[][]);
}

function layerShape(layer: L.Polygon | L.Circle, kind: PlannerArea["kind"]): ShapeInput {
  if (layer instanceof L.Circle) {
    const c = layer.getLatLng();
    return { kind: "CIRCLE", centre: { lat: c.lat, lng: c.lng }, radiusM: Math.round(layer.getRadius()) };
  }
  return { kind: kind === "RECTANGLE" ? "RECTANGLE" : "POLYGON", geometry: polygonGeometry(layer) };
}

function labelHtml(area: PlannerArea, distributor: PlannerDistributor | undefined): string {
  const title = distributor ? distributor.name : areaName(area);
  const second = distributor ? leafletText(area.leafletCount) : "Unassigned";
  return `<strong>${escapeHtml(title)}</strong><br>${escapeHtml(second)}`;
}

// A lasso drawn freehand, closed and tidied: fewer points, and any place
// where it crossed itself resolved into a proper shape.
function lassoGeometry(points: L.LatLng[]): AreaGeometry | null {
  if (points.length < 4) return null;
  const ring = points.map((p) => [Number(p.lng.toFixed(6)), Number(p.lat.toFixed(6))]);
  ring.push(ring[0]);
  const raw: Feature<Polygon> = { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } };
  const simple = simplify(raw, { tolerance: 0.00003, highQuality: true });
  const lngs = ring.map((p) => p[0]);
  const lats = ring.map((p) => p[1]);
  const [w, e, s, n] = [Math.min(...lngs) - 1, Math.max(...lngs) + 1, Math.min(...lats) - 1, Math.max(...lats) + 1];
  const box: Feature<Polygon> = { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] } };
  try {
    const fixed = intersect(featureCollection<Polygon | MultiPolygon>([simple, box]));
    return fixed ? fixed.geometry : null;
  } catch {
    return null;
  }
}

export default function PlannerMap(props: Props) {
  const element = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const areaGroup = useRef<L.LayerGroup | null>(null);
  const overlapGroup = useRef<L.LayerGroup | null>(null);
  const entries = useRef(new Map<string, Entry>());
  const latest = useRef(props);
  latest.current = props;
  const editTimers = useRef(new Map<string, number>());

  function areaUnder(latlng: L.LatLng): string | null {
    const map = mapRef.current;
    if (!map) return null;
    let best: { id: string; size: number } | null = null;
    for (const area of latest.current.areas) {
      const inside =
        area.kind === "CIRCLE" && area.centre && area.radiusM
          ? map.distance(latlng, [area.centre.lat, area.centre.lng]) <= area.radiusM
          : pointInArea({ lat: latlng.lat, lng: latlng.lng }, area.geometry);
      if (!inside) continue;
      const size = areaM2(area.geometry);
      if (!best || size < best.size) best = { id: area.id, size };
    }
    return best?.id ?? null;
  }

  props.handleRef.current = {
    pointAt(clientX, clientY) {
      const map = mapRef.current;
      const box = element.current?.getBoundingClientRect();
      if (!map || !box) return null;
      if (clientX < box.left || clientX > box.right || clientY < box.top || clientY > box.bottom) return null;
      const latlng = map.containerPointToLatLng([clientX - box.left, clientY - box.top]);
      return { latlng: { lat: latlng.lat, lng: latlng.lng }, areaId: areaUnder(latlng) };
    },
    fitTo(geometries) {
      const bounds = boundsOf(geometries);
      if (bounds && mapRef.current) mapRef.current.fitBounds(bounds, { padding: [32, 32], maxZoom: 16 });
    },
  };

  // The map, once.
  useEffect(() => {
    if (!element.current) return;
    const map = createBaseMap(element.current);
    map.pm.setGlobalOptions({ snappable: false, allowSelfIntersection: false });
    mapRef.current = map;
    areaGroup.current = L.layerGroup().addTo(map);
    overlapGroup.current = L.layerGroup().addTo(map);

    map.on("click", (e: L.LeafletMouseEvent) => {
      const p = latest.current;
      if (p.tool !== "select") return;
      if (p.assigning) p.onPlace({ lat: e.latlng.lat, lng: e.latlng.lng }, areaUnder(e.latlng));
      else p.onSelect(null);
    });

    map.on("pm:create", (e) => {
      const layer = e.layer as L.Polygon | L.Circle;
      const p = latest.current;
      const shape = layerShape(layer, p.tool === "rectangle" ? "RECTANGLE" : "POLYGON");
      layer.remove();
      p.onCreate(shape);
      p.onToolDone();
    });

    const timers = editTimers.current;
    const knownEntries = entries.current;
    return () => {
      for (const t of timers.values()) window.clearTimeout(t);
      knownEntries.clear();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Areas: kept in step with the props, rebuilding only what changed so a
  // shape being edited isn't interrupted.
  useEffect(() => {
    const map = mapRef.current;
    const group = areaGroup.current;
    if (!map || !group) return;
    const byId = new Map(props.distributors.map((d) => [d.id, d]));
    const ids = new Set(props.areas.map((a) => a.id));
    for (const [id, entry] of entries.current) {
      if (!ids.has(id)) {
        entry.layer.remove();
        entries.current.delete(id);
      }
    }
    for (const area of props.areas) {
      const signature = shapeSignature(area);
      let entry = entries.current.get(area.id);
      if (entry && entry.signature !== signature) {
        entry.layer.remove();
        entry = undefined;
      }
      if (!entry) {
        const layer = makeLayer(area);
        layer.on("click", (e: L.LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(e);
          const p = latest.current;
          if (p.tool !== "select") return;
          if (p.assigning) p.onPlace({ lat: e.latlng.lat, lng: e.latlng.lng }, area.id);
          else p.onSelect(area.id);
        });
        layer.on("pm:edit", () => {
          const timers = editTimers.current;
          window.clearTimeout(timers.get(area.id));
          timers.set(
            area.id,
            window.setTimeout(() => latest.current.onShapeEdited(area.id, layerShape(layer, area.kind)), 400)
          );
        });
        layer.bindTooltip("", { permanent: true, direction: "center", className: "ap-label", interactive: false });
        layer.addTo(group);
        entry = { layer, signature };
        entries.current.set(area.id, entry);
      }
      const distributor = area.distributorId ? byId.get(area.distributorId) : undefined;
      entry.layer.setStyle(
        areaPathStyle({ colour: distributor?.colour ?? null, assigned: !!distributor, status: area.status, selected: area.id === props.selectedId })
      );
      entry.layer.setTooltipContent(labelHtml(area, distributor));
      const editing = area.id === props.editingId && !props.readOnly;
      if (editing && !entry.layer.pm.enabled()) entry.layer.pm.enable({ draggable: true, allowSelfIntersection: false });
      if (!editing && entry.layer.pm.enabled()) entry.layer.pm.disable();
      if (area.id === props.selectedId) entry.layer.bringToFront();
    }
  }, [props.areas, props.distributors, props.selectedId, props.editingId, props.readOnly]);

  // Overlaps, hatched red over everything.
  useEffect(() => {
    const group = overlapGroup.current;
    if (!group) return;
    group.clearLayers();
    for (const o of props.overlaps) {
      L.polygon(toLatLngs(o.geometry) as L.LatLngExpression[][], { ...OVERLAP_STYLE, className: "ap-overlap", interactive: false }).addTo(group);
    }
  }, [props.overlaps]);

  // Fit the view when another project opens.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const bounds = boundsOf(latest.current.areas.map((a) => a.geometry));
    if (bounds) map.fitBounds(bounds, { padding: [32, 32], maxZoom: 16 });
  }, [props.fitKey]);

  // Drawing tools.
  useEffect(() => {
    const map = mapRef.current;
    const container = element.current;
    if (!map || !container) return;
    map.pm.disableDraw();
    container.style.cursor = props.assigning ? "copy" : "";
    if (props.readOnly) return;
    const pathOptions = { color: "#334155", weight: 2, fillOpacity: 0.15 };
    if (props.tool === "circle") map.pm.enableDraw("Circle", { continueDrawing: false, pathOptions });
    if (props.tool === "rectangle") map.pm.enableDraw("Rectangle", { continueDrawing: false, pathOptions });
    if (props.tool === "polygon") map.pm.enableDraw("Polygon", { continueDrawing: false, allowSelfIntersection: false, pathOptions });
    if (props.tool !== "lasso") return;

    // The lasso: press and drag round the area, let go to close it.
    map.dragging.disable();
    map.doubleClickZoom.disable();
    container.style.cursor = "crosshair";
    container.style.touchAction = "none";
    let points: L.LatLng[] = [];
    let line: L.Polyline | null = null;
    let last: L.Point | null = null;
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      container.setPointerCapture(e.pointerId);
      points = [map.mouseEventToLatLng(e as unknown as MouseEvent)];
      last = map.mouseEventToContainerPoint(e as unknown as MouseEvent);
      line = L.polyline(points, { color: "#334155", weight: 2, dashArray: "4 4", interactive: false }).addTo(map);
    };
    const move = (e: PointerEvent) => {
      if (!line || !last) return;
      const here = map.mouseEventToContainerPoint(e as unknown as MouseEvent);
      if (here.distanceTo(last) < 4) return;
      last = here;
      points.push(map.containerPointToLatLng(here));
      line.setLatLngs(points);
    };
    const up = () => {
      if (!line) return;
      line.remove();
      line = null;
      const geometry = lassoGeometry(points);
      points = [];
      if (geometry) {
        latest.current.onCreate({ kind: "POLYGON", geometry });
        latest.current.onToolDone();
      }
    };
    container.addEventListener("pointerdown", down);
    container.addEventListener("pointermove", move);
    container.addEventListener("pointerup", up);
    container.addEventListener("pointercancel", up);
    return () => {
      container.removeEventListener("pointerdown", down);
      container.removeEventListener("pointermove", move);
      container.removeEventListener("pointerup", up);
      container.removeEventListener("pointercancel", up);
      line?.remove();
      map.dragging.enable();
      map.doubleClickZoom.enable();
      container.style.cursor = "";
      container.style.touchAction = "";
    };
  }, [props.tool, props.readOnly, props.assigning]);

  return (
    <>
      <svg width="0" height="0" className="absolute" aria-hidden="true" focusable="false">
        <defs>
          <pattern id="ap-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="8" height="8" fill="#DC2626" fillOpacity="0.12" />
            <line x1="0" y1="0" x2="0" y2="8" stroke="#DC2626" strokeWidth="3" />
          </pattern>
        </defs>
      </svg>
      <div ref={element} className="relative z-0 h-full w-full" aria-label="Area Planner map" />
    </>
  );
}
