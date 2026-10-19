import { areaName, areaPayPence } from "./costs";
import type { PlannerArea, PlannerDistributor } from "./types";

// The project summary under the map: leaflets assigned against the job's
// quantity, and per distributor their areas, leaflets and pay. Pure.

export type DistributorSummary = {
  distributorId: string;
  name: string;
  colour: string | null;
  areas: { id: string; name: string; leafletCount: number | null }[];
  leaflets: number;
  payPence: number;
  // Some of their areas have no pay (or no leaflet count) set, so they make
  // no cost line yet.
  payNotSet: boolean;
};

export type ProjectSummary = {
  assignedLeaflets: number;
  target: number | null;
  unassignedAreas: number;
  distributors: DistributorSummary[];
  totalPayPence: number;
};

export function projectSummary(
  areas: PlannerArea[],
  distributors: PlannerDistributor[],
  target: number | null
): ProjectSummary {
  const byId = new Map(distributors.map((d) => [d.id, d]));
  const groups = new Map<string, DistributorSummary>();
  let unassignedAreas = 0;
  for (const area of areas) {
    if (!area.distributorId) {
      unassignedAreas++;
      continue;
    }
    const d = byId.get(area.distributorId);
    let group = groups.get(area.distributorId);
    if (!group) {
      group = {
        distributorId: area.distributorId,
        name: d?.name ?? "Unknown distributor",
        colour: d?.colour ?? null,
        areas: [],
        leaflets: 0,
        payPence: 0,
        payNotSet: false,
      };
      groups.set(area.distributorId, group);
    }
    group.areas.push({ id: area.id, name: areaName(area), leafletCount: area.leafletCount });
    group.leaflets += area.leafletCount ?? 0;
    const pay = areaPayPence(area);
    if (pay === null) group.payNotSet = true;
    else group.payPence += pay;
  }
  const list = [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
  return {
    assignedLeaflets: list.reduce((n, g) => n + g.leaflets, 0),
    target,
    unassignedAreas,
    distributors: list,
    totalPayPence: list.reduce((n, g) => n + g.payPence, 0),
  };
}

export function homesText(households: number | null): string {
  return households === null ? "Household estimate not available" : `about ${households.toLocaleString("en-GB")} homes (Census 2021 estimate)`;
}
