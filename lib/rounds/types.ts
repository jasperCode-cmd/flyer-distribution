import type { Business } from "@/lib/business";
import type { Alignment } from "./alignment";
import type { Crop } from "./extract/image";
import type { LngLat, Lines } from "./geometry";

// What the Rounds pages and the API pass about. No server imports.

export type SectorShare = { code: string; metres: number };
export type Markers = { start?: LngLat; end?: LngLat };

export type RoundScreenshotView = {
  id: string;
  position: number;
  width: number;
  height: number;
  originalName: string | null;
  takenAt: string | null;
  sha256: string | null;
  // Whether the image itself is in file storage (only once storage is on).
  stored: boolean;
  crop: Crop | null;
  alignment: Alignment | null;
  route: Lines | null;
  markers: Markers | null;
  routeLengthM: number | null;
};

export type RoundPerson = { id: string; name: string };
export type RoundDistributor = { id: string; name: string; colour: string };

export type RoundSummary = {
  id: string;
  business: Business;
  // "2026-11-10"
  date: string;
  lead: RoundPerson | null;
  project: RoundPerson | null;
  distributor: RoundDistributor | null;
  distanceM: number | null;
  sectors: SectorShare[];
  screenshots: { total: number; traced: number; stored: number };
};

export type ReportLinkState = "active" | "revoked" | "expired";

export type ReportLinkView = {
  id: string;
  scope: "round" | "lead";
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  lastViewedAt: string | null;
  state: ReportLinkState;
};

export type RoundDetail = RoundSummary & {
  notes: string | null;
  createdAt: string;
  screenshots: RoundSummary["screenshots"];
  shots: RoundScreenshotView[];
  links: ReportLinkView[];
};

// One round on the Area Planner's Rounds layer.
export type MapRound = {
  id: string;
  business: Business;
  date: string;
  lead: RoundPerson | null;
  distributor: RoundDistributor | null;
  distanceM: number | null;
  sectors: string[];
  lines: Lines;
  screenshots: { id: string; stored: boolean }[];
};

export type RoundFilters = {
  from?: string;
  to?: string;
  business?: Business;
  leadId?: string;
  // null: rounds with no distributor ("Not specified").
  distributorId?: string | null;
  projectId?: string;
};

// What a round can be for: an Area Planner project, or a Won or Completed lead.
export type JobOption = {
  key: string;
  label: string;
  business: Business;
  leadId: string | null;
  projectId: string | null;
  // Where its planned areas are, to centre the map on.
  bbox: [number, number, number, number] | null;
};

export type RoundOptions = {
  jobs: JobOption[];
  distributors: (RoundDistributor & { active: boolean })[];
  storage: boolean;
  trimM: number;
};
