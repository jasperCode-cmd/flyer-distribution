import L from "leaflet";
import type { AreaGeometry } from "@/lib/area-planner/geometry";
import { MAP_TILES } from "@/lib/area-planner/tiles";
import type { PathStyle } from "./map-style";

// The Leaflet pieces both maps share: the base map with the one tile
// setting and its credit, and turning stored GeoJSON into map layers and
// back. Browser only: the maps load it with next/dynamic and ssr false.

// Roughly the five postcode areas, for a map with nothing on it yet.
export const HOME_VIEW: L.LatLngBoundsExpression = [
  [50.55, -2.95],
  [51.3, -0.75],
];

export function createBaseMap(element: HTMLElement, options: L.MapOptions = {}): L.Map {
  const map = L.map(element, { zoomSnap: 0.5, ...options });
  L.tileLayer(MAP_TILES.url, {
    maxZoom: MAP_TILES.maxZoom,
    tileSize: MAP_TILES.tileSize,
    attribution: MAP_TILES.attributionHtml,
    crossOrigin: "anonymous",
  }).addTo(map);
  map.attributionControl.setPrefix(false);
  map.fitBounds(HOME_VIEW);
  return map;
}

// GeoJSON [lng, lat] rings to Leaflet [lat, lng].
export function toLatLngs(geometry: AreaGeometry): L.LatLngExpression[][] | L.LatLngExpression[][][] {
  const ring = (r: number[][]) => r.slice(0, -1).map(([lng, lat]) => [lat, lng] as L.LatLngTuple);
  return geometry.type === "Polygon"
    ? geometry.coordinates.map(ring)
    : geometry.coordinates.map((poly) => poly.map(ring));
}

// A Leaflet polygon's current shape back to GeoJSON.
export function polygonGeometry(layer: L.Polygon): AreaGeometry {
  const feature = layer.toGeoJSON(6) as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>;
  return feature.geometry;
}

export function polygonLayer(geometry: AreaGeometry, style: PathStyle): L.Polygon {
  return L.polygon(toLatLngs(geometry) as L.LatLngExpression[][], style);
}

export function boundsOf(geometries: AreaGeometry[]): L.LatLngBounds | null {
  let bounds: L.LatLngBounds | null = null;
  for (const g of geometries) {
    const b = L.polygon(toLatLngs(g) as L.LatLngExpression[][]).getBounds();
    bounds = bounds ? bounds.extend(b) : b;
  }
  return bounds;
}
