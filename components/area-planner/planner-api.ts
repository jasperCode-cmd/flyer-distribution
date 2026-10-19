import type { PlannerDistributor, PlannerProject, ProjectTab } from "@/lib/area-planner/types";
import type { PostcodeProblem } from "@/lib/area-planner/postcodes";
import type { ShareView } from "@/lib/area-planner/share-view";

// The Area Planner page's calls to its API. Every reply is { ok, data } or
// { ok: false, error } with a message fit to show.

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string; status: number };

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
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, error: "Couldn't reach the CRM. Check your connection and try again.", status: 0 };
  }
}

export type ProjectReply = { project: PlannerProject | null; distributors?: PlannerDistributor[] };
export type ProjectsReply = { projects: ProjectTab[]; project: PlannerProject | null; distributors?: PlannerDistributor[] };
export type AreasReply = { project: PlannerProject | null; distributors: PlannerDistributor[]; createdIds: string[]; problems: PostcodeProblem[] };
export type LinkReply = { url: string; project: PlannerProject | null; distributors?: PlannerDistributor[] };
export type ShareReply = { view: ShareView };

export const projectUrl = (id: string) => `/api/crm/area-planner/projects/${encodeURIComponent(id)}`;
export const areaUrl = (id: string) => `/api/crm/area-planner/areas/${encodeURIComponent(id)}`;
export const linkUrl = (projectId: string, distributorId: string) =>
  `${projectUrl(projectId)}/links/${encodeURIComponent(distributorId)}`;
export const shareUrl = (projectId: string, distributorId: string) =>
  `${projectUrl(projectId)}/share/${encodeURIComponent(distributorId)}`;
