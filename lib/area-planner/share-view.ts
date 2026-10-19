import type { Business } from "../business";
import type { AreaGeometry } from "./geometry";

// What a distributor may see of a project, the one source for both the
// "Download image" PNG and the private link page: the title for
// distributors, the date, their own name and colour, and their own areas
// with labels and leaflet counts. Nothing else is ever put in here: no pay,
// no client, no households, no other distributor. Pure and client-safe.

export type ShareArea = {
  id: string;
  label: string | null;
  leafletCount: number | null;
  geometry: AreaGeometry;
};

export type ShareView = {
  title: string;
  preparedOn: string;
  campaignStart: string | null;
  distributor: { name: string; colour: string };
  areas: ShareArea[];
  totalLeaflets: number;
  // The business shown on the image; the private page shows none for LDB.
  business: Business;
};

export type ShareSource = {
  name: string;
  distributorTitle: string | null;
  business: Business;
  createdAt: Date;
  campaignStart: Date | null;
  linked: boolean;
  areas: {
    id: string;
    distributorId: string | null;
    label: string | null;
    postcode: string | null;
    leafletCount: number | null;
    geometry: AreaGeometry;
  }[];
};

const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" });
const MONTH = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "Europe/London" });

export function formatShareDate(date: Date): string {
  return DAY.format(date);
}

// The title for distributors when none is typed: a map-only project's own
// name, or for a lead's project (usually named after the client) "Leaflet
// delivery, <month year>" from the campaign start, or else when it was made.
export function defaultDistributorTitle(source: Pick<ShareSource, "name" | "linked" | "campaignStart" | "createdAt">): string {
  if (!source.linked) return source.name;
  return `Leaflet delivery, ${MONTH.format(source.campaignStart ?? source.createdAt)}`;
}

export function distributorTitle(source: Pick<ShareSource, "name" | "linked" | "campaignStart" | "createdAt" | "distributorTitle">): string {
  return source.distributorTitle?.trim() || defaultDistributorTitle(source);
}

export function buildShareView(
  source: ShareSource,
  distributor: { id: string; name: string; colour: string },
  now: Date
): ShareView {
  const areas: ShareArea[] = source.areas
    .filter((a) => a.distributorId === distributor.id)
    .map((a) => ({
      id: a.id,
      label: a.label?.trim() || a.postcode || null,
      leafletCount: a.leafletCount,
      geometry: a.geometry,
    }));
  return {
    title: distributorTitle(source),
    preparedOn: formatShareDate(now),
    campaignStart: source.campaignStart ? formatShareDate(source.campaignStart) : null,
    distributor: { name: distributor.name, colour: distributor.colour },
    areas,
    totalLeaflets: areas.reduce((n, a) => n + (a.leafletCount ?? 0), 0),
    business: source.business,
  };
}

// "Sam Jones, 1,200 leaflets" style text for labels.
export function leafletText(count: number | null): string {
  return count === null ? "leaflets not set" : `${count.toLocaleString("en-GB")} leaflet${count === 1 ? "" : "s"}`;
}

// The total, or "leaflets not set" when no area has a count yet.
export function totalText(view: Pick<ShareView, "areas" | "totalLeaflets">): string {
  return view.areas.some((a) => a.leafletCount !== null) ? leafletText(view.totalLeaflets) : "leaflets not set";
}

export function shareFileName(view: Pick<ShareView, "title" | "distributor">, now: Date): string {
  const slug = (s: string) =>
    s
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/[\s_]+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 50) || "areas";
  const day = now.toISOString().slice(0, 10);
  return `${slug(view.title)}-${slug(view.distributor.name)}-${day}.png`;
}
