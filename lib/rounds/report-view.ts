import type { Business } from "@/lib/business";
import { BUSINESS_NAMES } from "@/lib/business";
import { FDH_DOCUMENTS } from "@/lib/documents/business/fdh";
import { LDB_DOCUMENTS } from "@/lib/documents/business/ldb";
import { dateLabel } from "./format";
import { trimForClient, type LngLat, type Lines } from "./geometry";

// What a client's route report shows, and nothing more: their own rounds'
// dates, the lines with the start and end trimmed off (the privacy trim),
// the postcode sectors and distance covered, and the screenshots if stored,
// under the business's own name, website and email. Built from a short list
// of fields picked here, so nothing else about a round (its distributor,
// notes, the lead's prices or payments, CRM ids) can reach the page. Pure.

export type ReportBrand = { name: string; website: string; websiteUrl: string; email: string };

export type ReportRound = {
  // "2026-11-10" and "Tuesday 10 November 2026".
  date: string;
  dateLabel: string;
  distanceM: number | null;
  sectors: string[];
  lines: Lines;
  // Only screenshots that are in file storage, by an id the report's own
  // image route checks against the link.
  screenshots: string[];
};

export type ReportView = {
  business: Business;
  brand: ReportBrand;
  clientName: string | null;
  rounds: ReportRound[];
  totals: { rounds: number; distanceM: number; sectors: string[] };
};

export type ReportSourceRound = {
  date: Date;
  distanceM: number | null;
  sectors: unknown;
  screenshots: { id: string; route: unknown; markers: unknown; stored: boolean }[];
};

export type ReportSource = { business: Business; clientName: string | null; rounds: ReportSourceRound[] };

export function brandFor(business: Business): ReportBrand {
  const docs = business === "LDB" ? LDB_DOCUMENTS : FDH_DOCUMENTS;
  return { name: BUSINESS_NAMES[business], website: docs.website, websiteUrl: `https://${docs.website}`, email: docs.email };
}


function sectorCodes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((s) => (s && typeof s === "object" && typeof (s as { code?: unknown }).code === "string" ? (s as { code: string }).code : null)).filter((c): c is string => !!c);
}

function linesOf(value: unknown): Lines {
  return Array.isArray(value) ? (value as Lines) : [];
}

function markersOf(value: unknown): LngLat[] {
  if (!value || typeof value !== "object") return [];
  const m = value as { start?: unknown; end?: unknown };
  return [m.start, m.end].filter((p): p is LngLat => Array.isArray(p) && p.length === 2 && p.every((n) => typeof n === "number"));
}

export function buildReportView(source: ReportSource, trimM: number): ReportView {
  const rounds = [...source.rounds]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((r): ReportRound => {
      // Every start and end dot of the round trims every one of its lines.
      const markers = r.screenshots.flatMap((s) => markersOf(s.markers));
      const lines = trimForClient(
        r.screenshots.flatMap((s) => linesOf(s.route)),
        markers,
        trimM
      );
      return {
        date: r.date.toISOString().slice(0, 10),
        dateLabel: dateLabel(r.date),
        distanceM: r.distanceM,
        sectors: sectorCodes(r.sectors),
        lines,
        screenshots: r.screenshots.filter((s) => s.stored).map((s) => s.id),
      };
    });
  const sectors = [...new Set(rounds.flatMap((r) => r.sectors))].sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
  return {
    business: source.business,
    brand: brandFor(source.business),
    clientName: source.clientName,
    rounds,
    totals: { rounds: rounds.length, distanceM: rounds.reduce((s, r) => s + (r.distanceM ?? 0), 0), sectors },
  };
}
