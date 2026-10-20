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
//
// Areas are drawn on one canvas, which stays quick with many detailed
// shapes; Leaflet simplifies each outline for the zoom it's drawn at (the
// stored shape, used for saving and estimates, is never changed). Only an
// area that changed is touched: its layer is remade only when its shape
// changed, and restyled or relabelled only when those changed. A label
// shows when its area is at least as big as the label on screen and it
// doesn't cover another label (see placeLabels), and otherwise on hover, so
// labels never pile up. Overlaps go on their own SVG layer above, for the
// hatching.

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

type Entry = {
  layer: L.Polygon | L.Circle;
  area: PlannerArea;
  shape: string;
  style: string;
  label: string;
  selected: boolean;
  // The label's size on screen, measured once shown.
  labelSize: { w: number; h: number } | null;
  hovered: boolean;
};

// Pixels of leeway Leaflet may drop from an outline at the zoom it's drawn at.
const SMOOTH_FACTOR = 1.5;

function shapeSignature(area: PlannerArea): string {
  return JSON.stringify([area.kind, area.centre, area.radiusM, area.kind === "CIRCLE" ? null : area.geometry]);
}

function makeLayer(area: PlannerArea, renderer: L.Renderer): L.Polygon | L.Circle {
  if (area.kind === "CIRCLE" && area.centre && area.radiusM) {
    return L.circle([area.centre.lat, area.centre.lng], { radius: area.radiusM, renderer });
  }
  if (area.kind === "RECTANGLE" && area.geometry.type === "Polygon") {
    const latlngs = area.geometry.coordinates[0].map(([lng, lat]) => L.latLng(lat, lng));
    return L.rectangle(L.latLngBounds(latlngs), { renderer, smoothFactor: SMOOTH_FACTOR });
  }
  return L.polygon(toLatLngs(area.geometry) as L.LatLngExpression[][], { renderer, smoothFactor: SMOOTH_FACTOR });
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
  const renderer = useRef<L.Canvas | null>(null);
  const overlapRenderer = useRef<L.SVG | null>(null);
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

  // Shows the labels that have room: a label shows when its area is at
  // least as big as the label on screen and it doesn't cover a label already
  // shown (smaller areas first, so a shape inside another keeps its label).
  // The selected and hovered areas always show theirs; the rest show on hover.
  function placeLabels() {
    const map = mapRef.current;
    if (!map) return;
    const candidates: { entry: Entry; el: HTMLElement; roomy: boolean; size: number; box: [number, number, number, number] }[] = [];
    for (const entry of entries.current.values()) {
      const tooltip = entry.layer.getTooltip();
      const el = tooltip?.getElement();
      const at = tooltip?.getLatLng();
      if (!el || !at) continue;
      if (!entry.labelSize) {
        el.classList.remove("ap-label-hidden");
        const measured = el.getBoundingClientRect();
        if (measured.width > 0) entry.labelSize = { w: measured.width, h: measured.height };
      }
      const label = entry.labelSize ?? { w: 90, h: 32 };
      const bounds = entry.layer.getBounds();
      const sw = map.latLngToContainerPoint(bounds.getSouthWest());
      const ne = map.latLngToContainerPoint(bounds.getNorthEast());
      const w = Math.abs(ne.x - sw.x);
      const h = Math.abs(sw.y - ne.y);
      const c = map.latLngToContainerPoint(at);
      candidates.push({ entry, el, roomy: w >= label.w && h >= label.h, size: w * h, box: [c.x - label.w / 2, c.y - label.h / 2, c.x + label.w / 2, c.y + label.h / 2] });
    }
    candidates.sort((a, b) => Number(b.entry.selected) - Number(a.entry.selected) || a.size - b.size);
    const shown: [number, number, number, number][] = [];
    const covers = (a: number[], b: number[]) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
    for (const c of candidates) {
      const forced = c.entry.selected || c.entry.hovered;
      const show = forced || (c.roomy && !shown.some((box) => covers(box, c.box)));
      if (show && !c.entry.hovered) shown.push(c.box);
      c.el.classList.toggle("ap-label-hidden", !show);
    }
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
    renderer.current = L.canvas({ padding: 0.5, tolerance: 6 });
    areaGroup.current = L.layerGroup().addTo(map);
    const pane = map.createPane("ap-overlaps");
    pane.style.zIndex = "450";
    pane.style.pointerEvents = "none";
    overlapRenderer.current = L.svg({ pane: "ap-overlaps" });
    overlapGroup.current = L.layerGroup().addTo(map);

    map.on("click", (e: L.LeafletMouseEvent) => {
      const p = latest.current;
      if (p.tool !== "select") return;
      if (p.assigning) p.onPlace({ lat: e.latlng.lat, lng: e.latlng.lng }, areaUnder(e.latlng));
      else p.onSelect(null);
    });
    map.on("zoomend", placeLabels);

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

  // Areas: kept in step with the props, touching only what changed.
  useEffect(() => {
    const map = mapRef.current;
    const group = areaGroup.current;
    const canvas = renderer.current;
    if (!map || !group || !canvas) return;
    const byId = new Map(props.distributors.map((d) => [d.id, d]));
    const ids = new Set(props.areas.map((a) => a.id));
    for (const [id, entry] of entries.current) {
      if (!ids.has(id)) {
        entry.layer.remove();
        entries.current.delete(id);
      }
    }
    let changed = false;
    for (const area of props.areas) {
      const distributor = area.distributorId ? byId.get(area.distributorId) : undefined;
      const selected = area.id === props.selectedId;
      const style = areaPathStyle({ colour: distributor?.colour ?? null, assigned: !!distributor, status: area.status, selected });
      const styleKey = JSON.stringify(style);
      const label = labelHtml(area, distributor);
      const editing = area.id === props.editingId && !props.readOnly;
      let entry = entries.current.get(area.id);
      if (entry && entry.area === area && entry.style === styleKey && entry.label === label && entry.selected === selected && entry.layer.pm.enabled() === editing) {
        continue;
      }
      const shape = shapeSignature(area);
      if (entry && !editing && entry.layer.pm.enabled()) {
        // Editing has finished: send any edit still waiting, then draw the
        // area afresh from what's stored (which a failed save puts back).
        const timer = editTimers.current.get(area.id);
        if (timer !== undefined) {
          window.clearTimeout(timer);
          editTimers.current.delete(area.id);
          latest.current.onShapeEdited(area.id, layerShape(entry.layer, entry.area.kind));
        }
        entry.layer.pm.disable();
        entry.layer.remove();
        entries.current.delete(area.id);
        entry = undefined;
      } else if (entry && entry.shape !== shape) {
        if (entry.layer.pm.enabled()) {
          // Being edited: the layer already shows the new shape.
          entry.shape = shape;
        } else {
          entry.layer.remove();
          entries.current.delete(area.id);
          entry = undefined;
        }
      }
      if (!entry) {
        const layer = makeLayer(area, canvas);
        const id = area.id;
        layer.on("click", (e: L.LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(e);
          const p = latest.current;
          if (p.tool !== "select") return;
          if (p.assigning) p.onPlace({ lat: e.latlng.lat, lng: e.latlng.lng }, id);
          else p.onSelect(id);
        });
        layer.on("pm:edit", () => {
          const timers = editTimers.current;
          window.clearTimeout(timers.get(id));
          timers.set(
            id,
            window.setTimeout(() => {
              timers.delete(id);
              const now = entries.current.get(id);
              if (now) latest.current.onShapeEdited(id, layerShape(now.layer, now.area.kind));
            }, 400)
          );
        });
        layer.bindTooltip("", { permanent: true, direction: "center", className: "ap-label", interactive: false });
        layer.addTo(group);
        const fresh: Entry = { layer, area, shape, style: "", label: "", selected: false, labelSize: null, hovered: false };
        layer.on("mouseover", () => {
          fresh.hovered = true;
          placeLabels();
        });
        layer.on("mouseout", () => {
          fresh.hovered = false;
          placeLabels();
        });
        entry = fresh;
        entries.current.set(area.id, entry);
      }
      if (entry.style !== styleKey) {
        entry.layer.setStyle(style);
        entry.style = styleKey;
      }
      if (entry.label !== label) {
        entry.layer.setTooltipContent(label);
        entry.label = label;
        entry.labelSize = null;
      }
      if (editing && !entry.layer.pm.enabled()) entry.layer.pm.enable({ draggable: true, allowSelfIntersection: false });
      if (!editing && entry.layer.pm.enabled()) entry.layer.pm.disable();
      if (selected && !entry.selected) entry.layer.bringToFront();
      entry.selected = selected;
      entry.area = area;
      changed = true;
    }
    if (changed) placeLabels();
  }, [props.areas, props.distributors, props.selectedId, props.editingId, props.readOnly]);

  // Overlaps, hatched red over everything, redrawn only when they change.
  useEffect(() => {
    const group = overlapGroup.current;
    const map = mapRef.current;
    if (!group || !map) return;
    const svg = overlapRenderer.current;
    if (!svg) return;
    group.clearLayers();
    for (const o of props.overlaps) {
      L.polygon(toLatLngs(o.geometry) as L.LatLngExpression[][], { ...OVERLAP_STYLE, className: "ap-overlap", interactive: false, pane: "ap-overlaps", renderer: svg }).addTo(group);
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
