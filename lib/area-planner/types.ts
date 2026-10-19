import type { Business } from "../business";
import type { PayType } from "../profit";
import type { AreaGeometry, LatLng } from "./geometry";
import type { LinkState } from "./share-links";

// What the Area Planner page works with, as the API sends it. Pure types.

export const AREA_KINDS = ["CIRCLE", "RECTANGLE", "POLYGON", "POSTCODE"] as const;
export type AreaKind = (typeof AREA_KINDS)[number];

export const AREA_STATUSES = ["PLANNED", "ASSIGNED", "DONE"] as const;
export type AreaStatus = (typeof AREA_STATUSES)[number];

export const AREA_STATUS_LABELS: Record<AreaStatus, string> = {
  PLANNED: "Planned",
  ASSIGNED: "Assigned",
  DONE: "Done",
};

export type PlannerDistributor = {
  id: string;
  name: string;
  colour: string | null;
  active: boolean;
};

export type PlannerArea = {
  id: string;
  kind: AreaKind;
  geometry: AreaGeometry;
  centre: LatLng | null;
  radiusM: number | null;
  postcode: string | null;
  label: string | null;
  distributorId: string | null;
  leafletCount: number | null;
  status: AreaStatus;
  households: number | null;
  payType: PayType | null;
  ratePence: number | null;
  amountPence: number | null;
  // Whether it has made a Profit cost line (only on a linked project).
  hasCostLine: boolean;
};

export type PlannerOverlap = {
  a: string;
  b: string;
  geometry: AreaGeometry;
  areaM2: number;
  households: number | null;
};

export type PlannerLink = {
  distributorId: string;
  createdAt: string;
  lastViewedAt: string | null;
  expiresAt: string | null;
  state: LinkState;
};

export type PlannerLead = {
  id: string;
  name: string;
  businessName: string | null;
  stage: string;
  leafletQuantity: string | null;
  quantity: number | null;
  campaignStart: string | null;
};

export type PlannerProject = {
  id: string;
  name: string;
  notes: string | null;
  business: Business;
  lead: PlannerLead | null;
  distributorTitle: string | null;
  defaultDistributorTitle: string;
  targetLeaflets: number | null;
  ldbLinksEnabled: boolean;
  closedAt: string | null;
  areas: PlannerArea[];
  overlaps: PlannerOverlap[];
  // About how many homes all its areas cover together, overlaps counted
  // once; null when the household data isn't installed.
  totalHouseholds: number | null;
  links: PlannerLink[];
};

export type ProjectTab = {
  id: string;
  name: string;
  business: Business;
  closedAt: string | null;
  leadId: string | null;
};

// A Won or Completed lead with no project yet, for "Add project".
export type LinkableLead = {
  id: string;
  name: string;
  businessName: string | null;
  business: Business;
  stage: string;
};
