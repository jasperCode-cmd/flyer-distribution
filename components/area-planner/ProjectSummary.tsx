"use client";

import { useState } from "react";
import { formatPence } from "@/lib/money";
import { homesText, projectSummary } from "@/lib/area-planner/summary";
import type { PlannerDistributor, PlannerLink, PlannerProject } from "@/lib/area-planner/types";

// Under the map: leaflets assigned against the job's quantity, about how
// many homes the project covers, and per distributor their areas, leaflets
// and pay, with their image and private link.

type Props = {
  project: PlannerProject;
  distributors: PlannerDistributor[];
  onSelectArea: (id: string) => void;
  onDownload: (distributorId: string) => void;
  onMakeLink: (distributorId: string) => void;
  onRevokeLink: (distributorId: string) => void;
  busyKey: string | null;
  newLink: { distributorId: string; url: string } | null;
};

const LINK_STATES: Record<PlannerLink["state"], string> = {
  active: "Link active",
  revoked: "Link revoked",
  expired: "Link expired",
  "switched-off": "Link switched off",
};

function day(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function ProjectSummary({ project, distributors, onSelectArea, onDownload, onMakeLink, onRevokeLink, busyKey, newLink }: Props) {
  const target = project.lead ? project.lead.quantity : project.targetLeaflets;
  const summary = projectSummary(project.areas, distributors, target);
  const linksOn = project.business === "FDH" || project.ldbLinksEnabled;
  const [copied, setCopied] = useState<string | null>(null);
  const percent = summary.target ? Math.min(100, Math.round((summary.assignedLeaflets / summary.target) * 100)) : null;

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(url);
    } catch {
      setCopied(null);
    }
  }

  return (
    <section aria-label="Project summary" className="rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="text-sm font-bold text-blue-900">Summary</h2>
      <dl className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <dt className="text-xs text-gray-500">Leaflets assigned</dt>
          <dd className="text-lg font-bold tabular-nums text-gray-900">
            {summary.assignedLeaflets.toLocaleString("en-GB")}
            {summary.target ? <span className="text-sm font-normal text-gray-600"> of {summary.target.toLocaleString("en-GB")}</span> : null}
          </dd>
          {percent !== null ? (
            <div className="mt-1 h-1.5 w-full rounded-full bg-gray-100" aria-hidden="true">
              <div className="h-1.5 rounded-full bg-blue-700" style={{ width: `${percent}%` }} />
            </div>
          ) : (
            <p className="text-xs text-gray-500">{project.lead ? "The job has no leaflet quantity." : "No target set."}</p>
          )}
        </div>
        <div>
          <dt className="text-xs text-gray-500">Homes covered</dt>
          <dd className="text-sm font-semibold text-gray-900">{homesText(project.totalHouseholds)}</dd>
          {project.overlaps.length > 0 && <p className="text-xs text-gray-500">Overlapping areas counted once.</p>}
        </div>
        <div>
          <dt className="text-xs text-gray-500">Distributor pay</dt>
          <dd className="text-lg font-bold tabular-nums text-gray-900">{formatPence(summary.totalPayPence)}</dd>
          {summary.unassignedAreas > 0 && (
            <p className="text-xs text-gray-500">
              {summary.unassignedAreas} area{summary.unassignedAreas === 1 ? "" : "s"} not assigned yet.
            </p>
          )}
        </div>
      </dl>

      {summary.distributors.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">No distributors assigned yet. Drag one from the list onto the map.</p>
      ) : (
        <ul className="mt-4 divide-y divide-gray-100 border-t border-gray-100">
          {summary.distributors.map((d) => {
            const link = project.links.find((l) => l.distributorId === d.distributorId);
            const fresh = newLink?.distributorId === d.distributorId ? newLink.url : null;
            return (
              <li key={d.distributorId} className="py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: d.colour ?? "#8A8F98" }} aria-hidden="true" />
                    {d.name}
                  </p>
                  <p className="text-sm tabular-nums text-gray-700">
                    {d.leaflets.toLocaleString("en-GB")} leaflets,{" "}
                    {d.payNotSet ? (
                      <span className="font-semibold text-amber-700">
                        {d.payPence > 0 ? `${formatPence(d.payPence)} so far, ` : ""}pay not set
                      </span>
                    ) : (
                      <span className="font-semibold">{formatPence(d.payPence)}</span>
                    )}
                  </p>
                </div>
                <p className="mt-1 text-xs text-gray-600">
                  {d.areas.map((a, i) => (
                    <span key={a.id}>
                      {i > 0 && ", "}
                      <button type="button" onClick={() => onSelectArea(a.id)} className="text-blue-700 hover:underline">
                        {a.name}
                      </button>
                      {a.leafletCount ? ` (${a.leafletCount.toLocaleString("en-GB")})` : ""}
                    </span>
                  ))}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onDownload(d.distributorId)}
                    disabled={busyKey === `image:${d.distributorId}`}
                    className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-60"
                  >
                    {busyKey === `image:${d.distributorId}` ? "Preparing image..." : "Download image"}
                  </button>
                  {linksOn ? (
                    <>
                      {!project.closedAt && (
                        <button
                          type="button"
                          onClick={() => onMakeLink(d.distributorId)}
                          disabled={busyKey === `link:${d.distributorId}`}
                          className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-60"
                        >
                          {link?.state === "active" ? "Replace link" : "Make private link"}
                        </button>
                      )}
                      {link?.state === "active" && (
                        <button
                          type="button"
                          onClick={() => onRevokeLink(d.distributorId)}
                          className="rounded-md px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                        >
                          Revoke link
                        </button>
                      )}
                      {link && (
                        <span className="text-xs text-gray-500">
                          {LINK_STATES[link.state]}, made {day(link.createdAt)}
                          {link.lastViewedAt ? `, last opened ${day(link.lastViewedAt)}` : ", not opened yet"}
                          {link.state === "active" && link.expiresAt ? `, expires ${day(link.expiresAt)}` : ""}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-gray-500">Private links are off for this Bournemouth project (image only).</span>
                  )}
                </div>
                {fresh && (
                  <div className="mt-2 rounded-md border border-green-300 bg-green-50 p-2">
                    <p className="text-xs font-semibold text-green-900">
                      New private link. Copy it now: it is only shown this once. Making another replaces it.
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <code className="min-w-0 flex-1 break-all rounded bg-white px-2 py-1 text-xs text-gray-800">{fresh}</code>
                      <button type="button" onClick={() => copy(fresh)} className="rounded-md bg-green-700 px-2.5 py-1 text-xs font-bold text-white hover:bg-green-800">
                        {copied === fresh ? "Copied" : "Copy"}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
