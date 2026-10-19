import { isBusiness, type Business } from "../business";
import { parsePoundsToPence } from "../money";
import { MAX_LEAFLETS, type PayType } from "../profit";
import {
  DEFAULT_RADIUS_M,
  MAX_RADIUS_M,
  MIN_RADIUS_M,
  isLatLng,
  validateGeometry,
  type AreaGeometry,
  type LatLng,
} from "./geometry";
import { AREA_STATUSES, type AreaStatus } from "./types";

// Checks everything the Area Planner page sends before it is stored. Each
// function returns the changes to make, or the error to show. Pure.

export const MAX_PROJECT_NAME = 100;
export const MAX_PROJECT_NOTES = 1000;
export const MAX_DISTRIBUTOR_TITLE = 80;
export const MAX_AREA_LABEL = 60;

type Fail = { ok: false; error: string };
const fail = (error: string): Fail => ({ ok: false, error });

function text(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function optionalCount(value: unknown, what: string): { ok: true; value: number | null } | Fail {
  if (value === null || value === undefined || value === "") return { ok: true, value: null };
  const raw = typeof value === "number" ? String(value) : text(value).replace(/,/g, "");
  if (!/^\d+$/.test(raw)) return fail(`Enter ${what} as a whole number.`);
  const n = Number(raw);
  if (n < 1 || n > MAX_LEAFLETS) return fail(`Enter ${what} from 1 to 10,000,000.`);
  return { ok: true, value: n };
}

export type NewArea =
  | { kind: "CIRCLE"; centre: LatLng; radiusM: number; distributorId: string | null }
  | { kind: "RECTANGLE" | "POLYGON"; geometry: AreaGeometry; distributorId: string | null };

export function validateNewArea(raw: unknown): { ok: true; area: NewArea } | Fail {
  if (!raw || typeof raw !== "object") return fail("Invalid request.");
  const body = raw as Record<string, unknown>;
  const distributorId = text(body.distributorId) || null;
  if (body.kind === "CIRCLE") {
    if (!isLatLng(body.centre)) return fail("That place is off the map.");
    const radius = body.radiusM === undefined ? DEFAULT_RADIUS_M : Number(body.radiusM);
    if (!Number.isFinite(radius) || radius < MIN_RADIUS_M || radius > MAX_RADIUS_M) {
      return fail(`A circle's radius can be from ${MIN_RADIUS_M}m to ${MAX_RADIUS_M / 1000}km.`);
    }
    const centre = body.centre as LatLng;
    return { ok: true, area: { kind: "CIRCLE", centre: { lat: centre.lat, lng: centre.lng }, radiusM: Math.round(radius), distributorId } };
  }
  if (body.kind === "RECTANGLE" || body.kind === "POLYGON") {
    const checked = validateGeometry(body.geometry);
    if (!checked.ok) return checked;
    return { ok: true, area: { kind: body.kind, geometry: checked.geometry, distributorId } };
  }
  return fail("Choose a shape to draw.");
}

export type AreaChanges = {
  label?: string | null;
  distributorId?: string | null;
  leafletCount?: number | null;
  status?: AreaStatus;
  payType?: PayType | null;
  ratePence?: number | null;
  amountPence?: number | null;
  // A redrawn shape. A circle is moved or resized by its centre and radius;
  // a postcode shape becomes an ordinary polygon once its shape is edited.
  shape?: { kind: "CIRCLE"; centre: LatLng; radiusM: number } | { kind: "RECTANGLE" | "POLYGON"; geometry: AreaGeometry };
};

export function validateAreaChanges(raw: unknown): { ok: true; changes: AreaChanges } | Fail {
  if (!raw || typeof raw !== "object") return fail("Invalid request.");
  const body = raw as Record<string, unknown>;
  const changes: AreaChanges = {};

  if ("label" in body) {
    const label = text(body.label);
    if (label.length > MAX_AREA_LABEL) return fail(`The label can be up to ${MAX_AREA_LABEL} characters.`);
    changes.label = label || null;
  }
  if ("distributorId" in body) changes.distributorId = text(body.distributorId) || null;
  if ("leafletCount" in body) {
    const count = optionalCount(body.leafletCount, "the leaflets");
    if (!count.ok) return count;
    changes.leafletCount = count.value;
  }
  if ("status" in body) {
    if (!(AREA_STATUSES as readonly unknown[]).includes(body.status)) return fail("Choose Planned, Assigned or Done.");
    changes.status = body.status as AreaStatus;
  }
  if ("payType" in body) {
    if (body.payType === null || body.payType === "") {
      Object.assign(changes, { payType: null, ratePence: null, amountPence: null });
    } else if (body.payType === "FLAT") {
      const amount = parsePoundsToPence(body.amount);
      if (amount === null) return fail("Enter the set amount in pounds, for example 120 or 120.50.");
      Object.assign(changes, { payType: "FLAT", amountPence: amount, ratePence: null });
    } else if (body.payType === "PER_THOUSAND") {
      const rate = parsePoundsToPence(body.rate);
      if (rate === null) return fail("Enter the rate per 1,000 leaflets in pounds, for example 45.");
      Object.assign(changes, { payType: "PER_THOUSAND", ratePence: rate, amountPence: null });
    } else {
      return fail("Choose a set amount or a rate per 1,000 leaflets.");
    }
  }
  if ("shape" in body) {
    const shape = validateNewArea(body.shape);
    if (!shape.ok) return shape;
    const { distributorId: _ignored, ...rest } = shape.area;
    changes.shape = rest;
  }
  return { ok: true, changes };
}

export type NewProject =
  | { leadId: string }
  | { leadId: null; name: string; notes: string | null; business: Business };

export function validateNewProject(raw: unknown): { ok: true; project: NewProject } | Fail {
  if (!raw || typeof raw !== "object") return fail("Invalid request.");
  const body = raw as Record<string, unknown>;
  const leadId = text(body.leadId);
  if (leadId) return { ok: true, project: { leadId } };
  const name = text(body.name);
  if (!name) return fail("Give the project a name.");
  if (name.length > MAX_PROJECT_NAME) return fail(`The name can be up to ${MAX_PROJECT_NAME} characters.`);
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  if (notes.length > MAX_PROJECT_NOTES) return fail(`Notes can be up to ${MAX_PROJECT_NOTES} characters.`);
  const business = body.business ?? "FDH";
  if (!isBusiness(business)) return fail("Choose FDH or LDB.");
  return { ok: true, project: { leadId: null, name, notes: notes || null, business } };
}

export type ProjectChanges = {
  name?: string;
  notes?: string | null;
  distributorTitle?: string | null;
  targetLeaflets?: number | null;
  business?: Business;
  ldbLinksEnabled?: boolean;
  closed?: boolean;
  // A lead to link a map-only project to, or null to unlink.
  leadId?: string | null;
};

export function validateProjectChanges(raw: unknown): { ok: true; changes: ProjectChanges } | Fail {
  if (!raw || typeof raw !== "object") return fail("Invalid request.");
  const body = raw as Record<string, unknown>;
  const changes: ProjectChanges = {};
  if ("name" in body) {
    const name = text(body.name);
    if (!name) return fail("Give the project a name.");
    if (name.length > MAX_PROJECT_NAME) return fail(`The name can be up to ${MAX_PROJECT_NAME} characters.`);
    changes.name = name;
  }
  if ("notes" in body) {
    const notes = typeof body.notes === "string" ? body.notes.trim() : "";
    if (notes.length > MAX_PROJECT_NOTES) return fail(`Notes can be up to ${MAX_PROJECT_NOTES} characters.`);
    changes.notes = notes || null;
  }
  if ("distributorTitle" in body) {
    const title = text(body.distributorTitle);
    if (title.length > MAX_DISTRIBUTOR_TITLE) return fail(`The title can be up to ${MAX_DISTRIBUTOR_TITLE} characters.`);
    changes.distributorTitle = title || null;
  }
  if ("targetLeaflets" in body) {
    const target = optionalCount(body.targetLeaflets, "the leaflet total");
    if (!target.ok) return target;
    changes.targetLeaflets = target.value;
  }
  if ("business" in body) {
    if (!isBusiness(body.business)) return fail("Choose FDH or LDB.");
    changes.business = body.business;
  }
  if ("ldbLinksEnabled" in body) {
    if (typeof body.ldbLinksEnabled !== "boolean") return fail("Invalid request.");
    changes.ldbLinksEnabled = body.ldbLinksEnabled;
  }
  if ("closed" in body) {
    if (typeof body.closed !== "boolean") return fail("Invalid request.");
    changes.closed = body.closed;
  }
  if ("leadId" in body) changes.leadId = text(body.leadId) || null;
  return { ok: true, changes };
}
