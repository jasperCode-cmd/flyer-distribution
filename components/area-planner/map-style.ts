import { areaColour, OVERLAP_COLOUR } from "@/lib/area-planner/colours";
import type { AreaStatus } from "@/lib/area-planner/types";

// How areas look on every map: the distributor's colour (grey when
// unassigned), a lighter fill once Done, and a thicker edge when selected.
// Text never takes the series colour: labels are dark ink on white.

export type PathStyle = {
  color: string;
  weight: number;
  opacity: number;
  fillColor: string;
  fillOpacity: number;
  dashArray?: string;
};

export function areaPathStyle(params: {
  colour: string | null;
  assigned: boolean;
  status: AreaStatus;
  selected?: boolean;
}): PathStyle {
  const colour = areaColour(params.colour, params.assigned);
  return {
    color: colour,
    weight: params.selected ? 4 : 2,
    opacity: 1,
    fillColor: colour,
    fillOpacity: params.status === "DONE" ? 0.12 : params.assigned ? 0.3 : 0.18,
    dashArray: params.assigned ? undefined : "6 4",
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
