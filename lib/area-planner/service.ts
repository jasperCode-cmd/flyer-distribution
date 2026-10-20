import "server-only";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { WON_STAGES } from "@/lib/lead-stage";
import { leafletCountFromQuantity } from "@/lib/profit";
import type { Business } from "@/lib/business";
import { estimateHouseholds, findPostcode, postcodeGeometry } from "./data";
import { nextMapColour } from "./colours";
import { syncAreaCostLine } from "./costs";
import { circleGeometry, type AreaGeometry } from "./geometry";
import { parsePostcodeList, sectorReading, type PostcodeProblem } from "./postcodes";
import { buildShareView, defaultDistributorTitle, type ShareView } from "./share-view";
import { hashShareToken, isShareTokenShaped, linkState, newShareToken, shareExpiryFrom } from "./share-links";
import { projectHouseholds, projectHouseholdsWithin } from "./project-estimates";
import { untimed, type StepTimer } from "./timing";
import type { AreaChanges, NewArea, NewProject, ProjectChanges } from "./validate";
import type {
  AreaKind,
  AreaStatus,
  LinkableLead,
  PlannerArea,
  PlannerDistributor,
  PlannerLink,
  PlannerProject,
  ProjectTab,
  ProjectTotals,
} from "./types";

// The Area Planner in the database. Every change to an area and its Profit
// cost line runs in one transaction, so the line always matches the area:
// made when it has a distributor, leaflets and pay on a linked project,
// updated with every edit, removed when the area is unassigned, loses its
// pay or is deleted. A map-only project holds its areas' pay until it is
// linked to a Won or Completed lead, when the lines are made.

type Db = PrismaClient;
type Tx = Prisma.TransactionClient;

export class AreaPlannerError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

const notFound = () => new AreaPlannerError("That project no longer exists.", 404);
const areaGone = () => new AreaPlannerError("That area has already been deleted.", 404);

const AREA_SELECT = {
  id: true,
  projectId: true,
  kind: true,
  geometry: true,
  centreLat: true,
  centreLng: true,
  radiusM: true,
  postcode: true,
  label: true,
  distributorId: true,
  leafletCount: true,
  status: true,
  households: true,
  payType: true,
  ratePence: true,
  amountPence: true,
  costLine: { select: { id: true } },
} satisfies Prisma.PlannedAreaSelect;

type AreaRow = Prisma.PlannedAreaGetPayload<{ select: typeof AREA_SELECT }>;

// Areas made together (a list of postcodes) share a time, so the id settles
// their order: the same every time, for the overlaps and the totals.
const AREA_ORDER: Prisma.PlannedAreaOrderByWithRelationInput[] = [{ createdAt: "asc" }, { id: "asc" }];

const PROJECT_INCLUDE = {
  lead: {
    select: {
      id: true,
      name: true,
      businessName: true,
      business: true,
      stage: true,
      leafletQuantity: true,
      job: { select: { campaignStartDate: true } },
    },
  },
  areas: { select: AREA_SELECT, orderBy: AREA_ORDER },
  shareLinks: { where: { revokedAt: null }, orderBy: { createdAt: "desc" } },
} satisfies Prisma.AreaProjectInclude;

type ProjectRow = Prisma.AreaProjectGetPayload<{ include: typeof PROJECT_INCLUDE }>;

function asGeometry(value: Prisma.JsonValue): AreaGeometry {
  return value as unknown as AreaGeometry;
}

function jsonGeometry(geometry: AreaGeometry): Prisma.InputJsonValue {
  return geometry as unknown as Prisma.InputJsonValue;
}

// A linked project takes its lead's business; a map-only one has its own.
function businessOf(project: { business: Business; lead: { business: Business } | null }): Business {
  return project.lead?.business ?? project.business;
}

function toPlannerArea(row: AreaRow): PlannerArea {
  return {
    id: row.id,
    kind: row.kind as AreaKind,
    geometry: asGeometry(row.geometry),
    centre: row.centreLat !== null && row.centreLng !== null ? { lat: row.centreLat, lng: row.centreLng } : null,
    radiusM: row.radiusM,
    postcode: row.postcode,
    label: row.label,
    distributorId: row.distributorId,
    leafletCount: row.leafletCount,
    status: row.status as AreaStatus,
    households: row.households,
    payType: row.payType,
    ratePence: row.ratePence,
    amountPence: row.amountPence,
    hasCostLine: !!row.costLine,
  };
}

// --- Reading -------------------------------------------------------------------

export async function listProjects(db: Db): Promise<ProjectTab[]> {
  const rows = await db.areaProject.findMany({
    select: { id: true, name: true, business: true, closedAt: true, leadId: true, lead: { select: { business: true } } },
    orderBy: [{ createdAt: "asc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    business: businessOf(r),
    closedAt: r.closedAt ? r.closedAt.toISOString() : null,
    leadId: r.leadId,
  }));
}

export async function linkableLeads(db: Db): Promise<LinkableLead[]> {
  const rows = await db.lead.findMany({
    where: { stage: { in: [...WON_STAGES] }, scrapped: false, areaProject: null },
    select: { id: true, name: true, businessName: true, business: true, stage: true },
    orderBy: [{ wonAt: { sort: "desc", nulls: "last" } }, { name: "asc" }],
    take: 300,
  });
  return rows;
}

// Active distributors for the sidebar, plus any inactive one still on a map.
export async function plannerDistributors(db: Db): Promise<PlannerDistributor[]> {
  const rows = await db.distributor.findMany({
    where: { OR: [{ active: true }, { plannedAreas: { some: {} } }] },
    select: { id: true, name: true, mapColour: true, active: true },
    orderBy: { name: "asc" },
  });
  return rows.map((r) => ({ id: r.id, name: r.name, colour: r.mapColour, active: r.active }));
}

function linksByDistributor(
  row: Pick<ProjectRow, "shareLinks" | "ldbLinksEnabled">,
  business: Business,
  now: Date
): PlannerLink[] {
  const seen = new Set<string>();
  const links: PlannerLink[] = [];
  for (const link of row.shareLinks) {
    if (seen.has(link.distributorId)) continue;
    seen.add(link.distributorId);
    links.push({
      distributorId: link.distributorId,
      createdAt: link.createdAt.toISOString(),
      lastViewedAt: link.lastViewedAt ? link.lastViewedAt.toISOString() : null,
      expiresAt: link.expiresAt ? link.expiresAt.toISOString() : null,
      state: linkState(link, { business, ldbLinksEnabled: row.ldbLinksEnabled }, now),
    });
  }
  return links;
}

function toPlannerProject(row: ProjectRow, now: Date): PlannerProject {
  const business = businessOf(row);
  const campaignStart = row.lead?.job?.campaignStartDate ?? null;
  return {
    id: row.id,
    name: row.name,
    notes: row.notes,
    business,
    lead: row.lead
      ? {
          id: row.lead.id,
          name: row.lead.name,
          businessName: row.lead.businessName,
          stage: row.lead.stage,
          leafletQuantity: row.lead.leafletQuantity,
          quantity: leafletCountFromQuantity(row.lead.leafletQuantity),
          campaignStart: campaignStart ? campaignStart.toISOString() : null,
        }
      : null,
    distributorTitle: row.distributorTitle,
    defaultDistributorTitle: defaultDistributorTitle({
      name: row.name,
      linked: !!row.lead,
      campaignStart,
      createdAt: row.createdAt,
    }),
    targetLeaflets: row.targetLeaflets,
    ldbLinksEnabled: row.ldbLinksEnabled,
    closedAt: row.closedAt ? row.closedAt.toISOString() : null,
    areas: row.areas.map(toPlannerArea),
    links: linksByDistributor(row, business, now),
  };
}

// The project's details and areas, straight from the database, without the
// totals (they can take longer; see totalsFor).
export async function loadProjectAreas(db: Db, id: string, now = new Date(), timer: StepTimer = untimed): Promise<PlannerProject | null> {
  const row = await timer.step("db-project", () => db.areaProject.findUnique({ where: { id }, include: PROJECT_INCLUDE }));
  return row ? toPlannerProject(row, now) : null;
}

// The project with its totals, waiting however long they take. For tests
// and scripts; the routes send the areas first (loadProjectAreas, totalsFor).
export async function loadProject(db: Db, id: string, now = new Date(), timer: StepTimer = untimed): Promise<(PlannerProject & ProjectTotals) | null> {
  const project = await loadProjectAreas(db, id, now, timer);
  if (!project) return null;
  return { ...project, ...(await projectHouseholds(totalsInput(project.areas), timer)) };
}

function totalsInput(areas: { id: string; geometry: AreaGeometry }[]) {
  return areas.map((a) => ({ id: a.id, geometry: a.geometry }));
}

// The totals for these areas if they're ready within budgetMs, else null
// (the page then asks /totals).
export function totalsFor(areas: { id: string; geometry: AreaGeometry }[], budgetMs: number, timer: StepTimer, route: string): Promise<ProjectTotals | null> {
  return projectHouseholdsWithin(totalsInput(areas), budgetMs, timer, route);
}

// A project's area shapes as they're stored now, in the order
// loadProjectAreas gives them, for its totals.
export async function storedShapes(db: Db, projectId: string): Promise<{ id: string; geometry: AreaGeometry }[]> {
  const rows = await db.plannedArea.findMany({ where: { projectId }, select: { id: true, geometry: true }, orderBy: AREA_ORDER });
  return rows.map((r) => ({ id: r.id, geometry: asGeometry(r.geometry) }));
}

// The distributor an area went to, as the page shows it (their colour may
// have just been given).
export async function plannerDistributor(db: Db, id: string | null): Promise<PlannerDistributor | null> {
  if (!id) return null;
  const d = await db.distributor.findUnique({ where: { id }, select: { id: true, name: true, mapColour: true, active: true } });
  return d ? { id: d.id, name: d.name, colour: d.mapColour, active: d.active } : null;
}

// A project's private links, as the summary shows them.
export async function projectLinks(db: Db, projectId: string, now = new Date()): Promise<PlannerLink[]> {
  const row = await db.areaProject.findUnique({
    where: { id: projectId },
    select: {
      business: true,
      ldbLinksEnabled: true,
      lead: { select: { business: true } },
      shareLinks: PROJECT_INCLUDE.shareLinks,
    },
  });
  if (!row) throw notFound();
  return linksByDistributor(row, businessOf(row), now);
}

// --- Projects --------------------------------------------------------------------

async function checkLinkableLead(tx: Tx, leadId: string, exceptProjectId?: string) {
  const lead = await tx.lead.findUnique({
    where: { id: leadId },
    select: { id: true, name: true, businessName: true, business: true, stage: true, scrapped: true, areaProject: { select: { id: true } } },
  });
  if (!lead || lead.scrapped) throw new AreaPlannerError("That lead no longer exists.", 404);
  if (!(WON_STAGES as readonly string[]).includes(lead.stage)) {
    throw new AreaPlannerError("Only a Won or Completed lead can have a project.", 409);
  }
  if (lead.areaProject && lead.areaProject.id !== exceptProjectId) {
    throw new AreaPlannerError("That lead already has a project.", 409);
  }
  return lead;
}

export async function createProject(db: Db, input: NewProject): Promise<string> {
  return db.$transaction(async (tx) => {
    if (input.leadId !== null) {
      const lead = await checkLinkableLead(tx, input.leadId);
      const project = await tx.areaProject.create({
        data: { leadId: lead.id, name: (lead.businessName?.trim() || lead.name).slice(0, 100), business: lead.business },
        select: { id: true },
      });
      return project.id;
    }
    const project = await tx.areaProject.create({
      data: { name: input.name, notes: input.notes, business: input.business },
      select: { id: true },
    });
    return project.id;
  });
}

// Makes, moves or removes every area's cost line for the project's lead.
async function syncProjectCostLines(tx: Tx, projectId: string, leadId: string | null) {
  const areas = await tx.plannedArea.findMany({ where: { projectId }, select: AREA_SELECT });
  for (const area of areas) await syncAreaCostLine(tx, area, leadId);
}

export async function updateProject(db: Db, id: string, changes: ProjectChanges, now = new Date()): Promise<void> {
  await db.$transaction(async (tx) => {
    const project = await tx.areaProject.findUnique({ where: { id }, select: { id: true, leadId: true, closedAt: true } });
    if (!project) throw notFound();
    const data: Prisma.AreaProjectUpdateInput = {};
    if (changes.name !== undefined) data.name = changes.name;
    if (changes.notes !== undefined) data.notes = changes.notes;
    if (changes.distributorTitle !== undefined) data.distributorTitle = changes.distributorTitle;
    if (changes.targetLeaflets !== undefined) data.targetLeaflets = changes.targetLeaflets;
    if (changes.ldbLinksEnabled !== undefined) data.ldbLinksEnabled = changes.ldbLinksEnabled;
    if (changes.business !== undefined) {
      if (project.leadId && (changes.leadId === undefined || changes.leadId !== null)) {
        throw new AreaPlannerError("A linked project follows its lead's business.", 409);
      }
      data.business = changes.business;
    }

    let leadChanged = false;
    let newLeadId = project.leadId;
    if (changes.leadId !== undefined && changes.leadId !== project.leadId) {
      if (changes.leadId) {
        const lead = await checkLinkableLead(tx, changes.leadId, id);
        data.lead = { connect: { id: lead.id } };
        data.business = lead.business;
      } else {
        data.lead = { disconnect: true };
      }
      leadChanged = true;
      newLeadId = changes.leadId;
    }

    if (changes.closed === true && !project.closedAt) {
      data.closedAt = now;
      await tx.areaShareLink.updateMany({
        where: { projectId: id, revokedAt: null, expiresAt: null },
        data: { expiresAt: shareExpiryFrom(now) },
      });
    } else if (changes.closed === false && project.closedAt) {
      data.closedAt = null;
      // Links still within their 14 days carry on; expired ones stay expired.
      await tx.areaShareLink.updateMany({
        where: { projectId: id, revokedAt: null, expiresAt: { gt: now } },
        data: { expiresAt: null },
      });
    }

    await tx.areaProject.update({ where: { id }, data });
    if (leadChanged) await syncProjectCostLines(tx, id, newLeadId);
  });
}

// --- Areas -------------------------------------------------------------------------

async function projectForChange(tx: Tx, projectId: string) {
  const project = await tx.areaProject.findUnique({ where: { id: projectId }, select: { id: true, leadId: true, closedAt: true } });
  if (!project) throw notFound();
  if (project.closedAt) throw new AreaPlannerError("This project is closed. Reopen it to change its areas.", 409);
  return project;
}

// A distributor being placed: they must exist and be active, and get their
// colour the first time.
async function prepareDistributor(tx: Tx, distributorId: string) {
  const distributor = await tx.distributor.findUnique({ where: { id: distributorId }, select: { id: true, active: true, mapColour: true } });
  if (!distributor) throw new AreaPlannerError("That distributor no longer exists.", 400);
  if (!distributor.active) throw new AreaPlannerError("That distributor is no longer active.", 400);
  if (!distributor.mapColour) {
    const taken = await tx.distributor.findMany({ where: { mapColour: { not: null } }, select: { mapColour: true } });
    await tx.distributor.updateMany({
      where: { id: distributorId, mapColour: null },
      data: { mapColour: nextMapColour(taken.map((t) => t.mapColour)) },
    });
  }
}

function shapeData(shape: NonNullable<AreaChanges["shape"]> | NewArea) {
  if (shape.kind === "CIRCLE") {
    const geometry = circleGeometry(shape.centre, shape.radiusM);
    return { kind: "CIRCLE" as const, geometry, centreLat: shape.centre.lat, centreLng: shape.centre.lng, radiusM: shape.radiusM, postcode: null };
  }
  return { kind: shape.kind, geometry: shape.geometry, centreLat: null, centreLng: null, radiusM: null, postcode: null };
}

export async function createArea(db: Db, projectId: string, input: NewArea): Promise<PlannerArea> {
  const shape = shapeData(input);
  const households = await estimateHouseholds(shape.geometry);
  return db.$transaction(async (tx) => {
    await projectForChange(tx, projectId);
    if (input.distributorId) await prepareDistributor(tx, input.distributorId);
    const row = await tx.plannedArea.create({
      data: {
        projectId,
        ...shape,
        geometry: jsonGeometry(shape.geometry),
        households,
        distributorId: input.distributorId,
        status: input.distributorId ? "ASSIGNED" : "PLANNED",
      },
      select: AREA_SELECT,
    });
    return toPlannerArea(row);
  });
}

// Each district or sector typed becomes its own shape, ready to assign;
// everything that can't be mapped comes back with the reason.
export async function createPostcodeAreas(
  db: Db,
  projectId: string,
  text: string
): Promise<{ created: PlannerArea[]; problems: PostcodeProblem[] }> {
  const { requests, problems } = parsePostcodeList(text);
  const shapes: { code: string; geometry: AreaGeometry; households: number }[] = [];
  for (const request of requests) {
    const info = await findPostcode(request.code);
    if (!info) {
      const reading = request.kind === "district" ? sectorReading(request.code) : null;
      const suggestion = reading && (await findPostcode(reading)) ? `: did you mean ${reading}?` : "";
      problems.push({ input: request.input, reason: `no such postcode ${request.kind}${suggestion}` });
      continue;
    }
    if (!info.mappable) {
      problems.push({ input: request.input, reason: "too small to map from open data: its postcodes sit in neighbouring sectors' Output Areas" });
      continue;
    }
    const geometry = await postcodeGeometry(request.code);
    if (!geometry) {
      problems.push({ input: request.input, reason: "its shape is missing from the postcode data" });
      continue;
    }
    shapes.push({ code: info.code, geometry, households: info.households });
  }
  const created = await db.$transaction(async (tx) => {
    await projectForChange(tx, projectId);
    const rows: PlannerArea[] = [];
    for (const shape of shapes) {
      const row = await tx.plannedArea.create({
        data: { projectId, kind: "POSTCODE", postcode: shape.code, geometry: jsonGeometry(shape.geometry), households: shape.households },
        select: AREA_SELECT,
      });
      rows.push(toPlannerArea(row));
    }
    return rows;
  });
  return { created, problems };
}

// Returns the area as saved, and its project.
export async function updateArea(db: Db, id: string, changes: AreaChanges): Promise<{ projectId: string; area: PlannerArea }> {
  const shape = changes.shape ? shapeData(changes.shape) : null;
  const households = shape ? await estimateHouseholds(shape.geometry) : undefined;
  return db.$transaction(async (tx) => {
    const existing = await tx.plannedArea.findUnique({ where: { id }, select: { projectId: true, distributorId: true, status: true } });
    if (!existing) throw areaGone();
    const project = await projectForChange(tx, existing.projectId);

    const data: Prisma.PlannedAreaUncheckedUpdateInput = {};
    if (changes.label !== undefined) data.label = changes.label;
    if (changes.leafletCount !== undefined) data.leafletCount = changes.leafletCount;
    if (changes.payType !== undefined) data.payType = changes.payType;
    if (changes.ratePence !== undefined) data.ratePence = changes.ratePence;
    if (changes.amountPence !== undefined) data.amountPence = changes.amountPence;
    if (changes.status !== undefined) data.status = changes.status;
    if (changes.distributorId !== undefined && changes.distributorId !== existing.distributorId) {
      if (changes.distributorId) await prepareDistributor(tx, changes.distributorId);
      data.distributorId = changes.distributorId;
      // Assigning moves a Planned area to Assigned; unassigning an Assigned
      // one moves it back. A status sent alongside wins.
      if (changes.status === undefined) {
        if (changes.distributorId && existing.status === "PLANNED") data.status = "ASSIGNED";
        if (!changes.distributorId && existing.status === "ASSIGNED") data.status = "PLANNED";
      }
    }
    if (shape) {
      Object.assign(data, { ...shape, geometry: jsonGeometry(shape.geometry), households: households ?? null });
    }

    const row = await tx.plannedArea.update({ where: { id }, data, select: AREA_SELECT });
    const line = await syncAreaCostLine(tx, row, project.leadId);
    return { projectId: existing.projectId, area: { ...toPlannerArea(row), hasCostLine: line === "created" || line === "updated" } };
  });
}

// The area's cost line goes with it (the database removes it too).
// Returns the area's project.
export async function deleteArea(db: Db, id: string): Promise<string> {
  return db.$transaction(async (tx) => {
    const existing = await tx.plannedArea.findUnique({ where: { id }, select: { projectId: true } });
    if (!existing) throw areaGone();
    await projectForChange(tx, existing.projectId);
    await tx.jobCost.deleteMany({ where: { areaId: id } });
    await tx.plannedArea.delete({ where: { id } });
    return existing.projectId;
  });
}

// --- Sharing -------------------------------------------------------------------------

const SHARE_INCLUDE = {
  lead: { select: { business: true, job: { select: { campaignStartDate: true } } } },
  areas: {
    select: { id: true, distributorId: true, label: true, postcode: true, leafletCount: true, geometry: true },
    orderBy: { createdAt: "asc" },
  },
} satisfies Prisma.AreaProjectInclude;

type ShareRow = Prisma.AreaProjectGetPayload<{ include: typeof SHARE_INCLUDE }>;

function shareSource(row: ShareRow) {
  return {
    name: row.name,
    distributorTitle: row.distributorTitle,
    business: businessOf(row),
    createdAt: row.createdAt,
    campaignStart: row.lead?.job?.campaignStartDate ?? null,
    linked: !!row.lead,
    areas: row.areas.map((a) => ({ ...a, geometry: asGeometry(a.geometry) })),
  };
}

async function distributorForShare(db: Db | Tx, distributorId: string) {
  const d = await db.distributor.findUnique({ where: { id: distributorId }, select: { id: true, name: true, mapColour: true } });
  return d ? { id: d.id, name: d.name, colour: d.mapColour ?? "#2A78D6" } : null;
}

// For "Download image": only this distributor's areas.
export async function shareViewForDistributor(db: Db, projectId: string, distributorId: string, now = new Date()): Promise<ShareView> {
  const row = await db.areaProject.findUnique({ where: { id: projectId }, include: SHARE_INCLUDE });
  if (!row) throw notFound();
  const distributor = await distributorForShare(db, distributorId);
  if (!distributor) throw new AreaPlannerError("That distributor no longer exists.", 404);
  const view = buildShareView(shareSource(row), distributor, now);
  if (view.areas.length === 0) throw new AreaPlannerError("This distributor has no areas on this project.", 404);
  return view;
}

// Makes a new private link (revoking any earlier one). The token is only
// ever returned here, once.
export async function createShareLink(db: Db, projectId: string, distributorId: string, now = new Date()): Promise<string> {
  return db.$transaction(async (tx) => {
    const project = await tx.areaProject.findUnique({
      where: { id: projectId },
      select: { business: true, ldbLinksEnabled: true, closedAt: true, lead: { select: { business: true } } },
    });
    if (!project) throw notFound();
    if (project.closedAt) throw new AreaPlannerError("This project is closed. Reopen it to make a link.", 409);
    if (businessOf(project) === "LDB" && !project.ldbLinksEnabled) {
      throw new AreaPlannerError("Private links are switched off for this Bournemouth project.", 409);
    }
    const distributor = await tx.distributor.findUnique({ where: { id: distributorId }, select: { id: true } });
    if (!distributor) throw new AreaPlannerError("That distributor no longer exists.", 404);
    const areas = await tx.plannedArea.count({ where: { projectId, distributorId } });
    if (areas === 0) throw new AreaPlannerError("This distributor has no areas on this project.", 409);
    await tx.areaShareLink.updateMany({ where: { projectId, distributorId, revokedAt: null }, data: { revokedAt: now } });
    const token = newShareToken();
    await tx.areaShareLink.create({ data: { projectId, distributorId, tokenHash: hashShareToken(token) } });
    return token;
  });
}

export async function revokeShareLinks(db: Db, projectId: string, distributorId: string, now = new Date()): Promise<number> {
  const result = await db.areaShareLink.updateMany({ where: { projectId, distributorId, revokedAt: null }, data: { revokedAt: now } });
  return result.count;
}

// The private link page: the view for a live token, or null for anything
// else (unknown, revoked, expired or switched off all look the same).
export async function resolveShareToken(db: Db, token: unknown, now = new Date()): Promise<ShareView | null> {
  if (!isShareTokenShaped(token)) return null;
  const link = await db.areaShareLink.findUnique({
    where: { tokenHash: hashShareToken(token) },
    include: { project: { include: SHARE_INCLUDE } },
  });
  if (!link) return null;
  const business = businessOf(link.project);
  if (linkState(link, { business, ldbLinksEnabled: link.project.ldbLinksEnabled }, now) !== "active") return null;
  const distributor = await distributorForShare(db, link.distributorId);
  if (!distributor) return null;
  // Noted at most every few minutes, so a busy page doesn't write on every view.
  if (!link.lastViewedAt || now.getTime() - link.lastViewedAt.getTime() > 5 * 60 * 1000) {
    await db.areaShareLink.update({ where: { id: link.id }, data: { lastViewedAt: now } });
  }
  return buildShareView(shareSource(link.project), distributor, now);
}
