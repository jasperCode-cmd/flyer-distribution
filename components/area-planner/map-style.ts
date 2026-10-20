import { areaColour, OVERLAP_COLOUR } from "@/lib/area-planner/colours";
import type { AreaStatus } from "@/lib/area-planner/types";

// How areas look on every map: filled in the distributor's colour with a
// darker edge of the same colour, so outline and fill both stand out on the
// light map at any zoom; unassigned areas in a dark slate with a dashed
// edge; a lighter fill once Done, and a thicker edge when selected. Text
// never takes the series colour: labels are dark ink on white.

export type PathStyle = {
  color: string;
  weight: number;
  opacity: number;
  fillColor: string;
  fillOpacity: number;
  dashArray?: string;
};

const UNASSIGNED_EDGE = "#334155";
const UNASSIGNED_FILL = "#64748B";

// A colour mixed with black, for its edge.
export function darker(hex: string, amount = 0.28): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const channel = (shift: number) => Math.round(((n >> shift) & 255) * (1 - amount));
  return `#${[16, 8, 0].map((s) => channel(s).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

export function areaPathStyle(params: {
  colour: string | null;
  assigned: boolean;
  status: AreaStatus;
  selected?: boolean;
}): PathStyle {
  if (!params.assigned) {
    return {
      color: UNASSIGNED_EDGE,
      weight: params.selected ? 4 : 2.5,
      opacity: 1,
      fillColor: UNASSIGNED_FILL,
      fillOpacity: params.selected ? 0.34 : 0.24,
      dashArray: "7 4",
    };
  }
  const colour = areaColour(params.colour, true);
  return {
    color: darker(colour),
    weight: params.selected ? 4.5 : 3,
    opacity: 1,
    fillColor: colour,
    fillOpacity: params.status === "DONE" ? 0.2 : params.selected ? 0.45 : 0.35,
    // Said outright, so an area that was unassigned loses its dashes.
    dashArray: undefined,
  };
}

export const OVERLAP_STYLE: PathStyle = {
  color: OVERLAP_COLOUR,
  weight: 2,
  opacity: 1,
  fillColor: OVERLAP_COLOUR,
  fillOpacity: 0.35,
  dashArray: "4 3",
};

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
