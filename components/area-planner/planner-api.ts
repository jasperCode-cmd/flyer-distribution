import type { LinkableLead, PlannerArea, PlannerDistributor, PlannerLink, PlannerProject, ProjectTab, ProjectTotals } from "@/lib/area-planner/types";
import type { PostcodeProblem } from "@/lib/area-planner/postcodes";
import type { ShareView } from "@/lib/area-planner/share-view";

// The Area Planner page's calls to its API. Every reply is { ok, data } or
// { ok: false, error } with a message fit to show. Changes reply with just
// what changed, and the project's totals when they're ready (else null:
// ask totalsUrl).

export type ApiResult<T> = { ok: true; data: T; status: number } | { ok: false; error: string; status: number };

export async function api<T>(url: string, method = "GET", body?: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const error =
        res.status === 401 ? "Your session has ended. Sign in again." : (data?.error as string | undefined) ?? "Something went wrong. Try again.";
      return { ok: false, error, status: res.status };
    }
    return { ok: true, data: data as T, status: res.status };
  } catch {
    return { ok: false, error: "Couldn't reach the CRM. Check your connection and try again.", status: 0 };
  }
}

// Whether a failed change might still have been saved (no reply, or the
// server gave up waiting), so the page should reload what's saved.
export function outcomeUnknown(status: number): boolean {
  return status === 0 || status >= 500;
}

export type DataNote = { installed: boolean; sample: boolean; credits: string[] };
export type ListsReply = { projects: ProjectTab[]; leads: LinkableLead[]; distributors: PlannerDistributor[]; data: DataNote };
export type ProjectReply = { project: PlannerProject; totals: ProjectTotals | null };
export type ProjectsReply = { projects: ProjectTab[]; project: PlannerProject | null; totals: ProjectTotals | null };
export type AreaReply = { area: PlannerArea; distributor: PlannerDistributor | null; totals: ProjectTotals | null };
export type PostcodesReply = { areas: PlannerArea[]; problems: PostcodeProblem[]; totals: ProjectTotals | null };
export type DeleteReply = { id: string; totals: ProjectTotals | null };
export type TotalsReply = { totals: ProjectTotals | null };
export type LinksReply = { url?: string; links: PlannerLink[] };
export type ShareReply = { view: ShareView };

export const listsUrl = "/api/crm/area-planner/projects";
export const projectUrl = (id: string) => `/api/crm/area-planner/projects/${encodeURIComponent(id)}`;
export const totalsUrl = (id: string) => `${projectUrl(id)}/totals`;
export const areaUrl = (id: string) => `/api/crm/area-planner/areas/${encodeURIComponent(id)}`;
export const linkUrl = (projectId: string, distributorId: string) =>
  `${projectUrl(projectId)}/links/${encodeURIComponent(distributorId)}`;
export const shareUrl = (projectId: string, distributorId: string) =>
  `${projectUrl(projectId)}/share/${encodeURIComponent(distributorId)}`;
