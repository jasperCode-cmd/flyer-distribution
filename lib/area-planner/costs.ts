import { validateCostInput, MAX_NOTE, type CostData } from "../job-costs";
import { penceToInput } from "../money";
import { perThousandAmountPence, type PayType } from "../profit";

// The Profit cost line an area makes. An area with a distributor, a leaflet
// count and its pay makes one Distributor line for the project's lead,
// checked and worked out by the same job cost logic as the Profit page;
// without any of those it makes none ("pay not set"). The line is kept in
// step by the Area Planner service on every save and is edited from the
// map, never the Profit page.

export type AreaPay = {
  payType: PayType | null;
  ratePence: number | null;
  amountPence: number | null;
};

export type AreaForCost = AreaPay & {
  distributorId: string | null;
  leafletCount: number | null;
  label: string | null;
  postcode: string | null;
  kind: string;
};

const KIND_NAMES: Record<string, string> = {
  CIRCLE: "Circle",
  RECTANGLE: "Rectangle",
  POLYGON: "Shape",
  POSTCODE: "Postcode area",
};

export function areaName(area: Pick<AreaForCost, "label" | "postcode" | "kind">): string {
  return area.label?.trim() || area.postcode || KIND_NAMES[area.kind] || "Area";
}

export function costNote(area: Pick<AreaForCost, "label" | "postcode" | "kind">): string {
  return `Area Planner: ${areaName(area)}`.slice(0, MAX_NOTE);
}

// The area's pay in pence, or null when it isn't fully set.
export function areaPayPence(area: AreaPay & { leafletCount: number | null }): number | null {
  if (area.payType === "FLAT") return area.amountPence ?? null;
  if (area.payType === "PER_THOUSAND") {
    if (area.ratePence === null || !area.leafletCount) return null;
    return perThousandAmountPence(area.ratePence, area.leafletCount);
  }
  return null;
}

// What the area's cost line should be, or null for no line.
export function costLineFor(area: AreaForCost): CostData | null {
  if (!area.distributorId || !area.leafletCount || !area.payType) return null;
  const pay =
    area.payType === "FLAT"
      ? area.amountPence === null
        ? null
        : { payType: "FLAT", amount: penceToInput(area.amountPence) }
      : area.ratePence === null
        ? null
        : { payType: "PER_THOUSAND", rate: penceToInput(area.ratePence), leafletCount: area.leafletCount };
  if (!pay) return null;
  const checked = validateCostInput(
    { distributorId: area.distributorId, note: costNote(area), ...pay },
    { fixedCategory: "DISTRIBUTOR" }
  );
  return checked.ok ? checked.data : null;
}

// The subset of Prisma the cost sync needs, so tests can pass a fake.
export type CostSyncDb = {
  jobCost: {
    findUnique(args: { where: { areaId: string }; select: { id: true } }): Promise<{ id: string } | null>;
    create(args: { data: CostData & { leadId: string; areaId: string } }): Promise<unknown>;
    update(args: { where: { id: string }; data: CostData & { leadId: string } }): Promise<unknown>;
    delete(args: { where: { id: string } }): Promise<unknown>;
  };
};

// Makes, updates or removes the area's line. leadId is the project's lead,
// or null for a map-only project, whose pay is held on the area until the
// project is linked.
export async function syncAreaCostLine(
  db: CostSyncDb,
  area: AreaForCost & { id: string },
  leadId: string | null
): Promise<"created" | "updated" | "removed" | "none"> {
  const wanted = leadId ? costLineFor(area) : null;
  const existing = await db.jobCost.findUnique({ where: { areaId: area.id }, select: { id: true } });
  if (!wanted) {
    if (!existing) return "none";
    await db.jobCost.delete({ where: { id: existing.id } });
    return "removed";
  }
  if (existing) {
    await db.jobCost.update({ where: { id: existing.id }, data: { ...wanted, leadId: leadId! } });
    return "updated";
  }
  await db.jobCost.create({ data: { ...wanted, leadId: leadId!, areaId: area.id } });
  return "created";
}
