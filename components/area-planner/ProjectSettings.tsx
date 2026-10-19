"use client";

import { useEffect, useState } from "react";
import { BUSINESS_NAMES, type Business } from "@/lib/business";
import type { LinkableLead, PlannerProject } from "@/lib/area-planner/types";
import type { ProjectChanges } from "@/lib/area-planner/validate";

// A project's details: its name and notes, the title distributors see, a
// map-only project's target and business, linking it to a Won job (which
// turns its areas' pay into Profit cost lines), the private links switch
// for a Bournemouth project, and closing or reopening it.

type Props = {
  project: PlannerProject;
  leads: LinkableLead[];
  busy: boolean;
  onSave: (changes: ProjectChanges) => void;
};

export default function ProjectSettings({ project, leads, busy, onSave }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(project.name);
  const [notes, setNotes] = useState(project.notes ?? "");
  const [title, setTitle] = useState(project.distributorTitle ?? "");
  const [target, setTarget] = useState(project.targetLeaflets ? String(project.targetLeaflets) : "");
  const [business, setBusiness] = useState<Business>(project.business);
  const [leadId, setLeadId] = useState("");
  const [confirm, setConfirm] = useState<"unlink" | "close" | null>(null);
  // Shown at once; the saved project then confirms it.
  const [linksOn, setLinksOn] = useState(project.ldbLinksEnabled);

  useEffect(() => {
    setName(project.name);
    setNotes(project.notes ?? "");
    setTitle(project.distributorTitle ?? "");
    setTarget(project.targetLeaflets ? String(project.targetLeaflets) : "");
    setBusiness(project.business);
    setLeadId("");
    setConfirm(null);
    setLinksOn(project.ldbLinksEnabled);
  }, [project]);

  const closed = !!project.closedAt;

  return (
    <section aria-label="Project details" className="rounded-lg border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-bold text-blue-900"
      >
        Project details
        <span className="text-xs font-semibold text-gray-500">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <div className="space-y-4 border-t border-gray-100 px-4 py-4">
          <form
            className="grid grid-cols-1 gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              const changes: ProjectChanges = { name, notes, distributorTitle: title };
              if (!project.lead) Object.assign(changes, { targetLeaflets: target, business });
              onSave(changes);
            }}
          >
            <label className="text-xs font-semibold text-gray-700">
              Name (only in the CRM)
              <input value={name} maxLength={100} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm font-normal" />
            </label>
            <label className="text-xs font-semibold text-gray-700">
              Title for distributors
              <input
                value={title}
                maxLength={80}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={project.defaultDistributorTitle}
                className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm font-normal"
              />
              <span className="mt-0.5 block font-normal text-gray-500">Shown on their image and private link. Leave blank for &quot;{project.defaultDistributorTitle}&quot;.</span>
            </label>
            {!project.lead && (
              <>
                <label className="text-xs font-semibold text-gray-700">
                  Leaflet target (optional)
                  <input inputMode="numeric" value={target} onChange={(e) => setTarget(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm font-normal" />
                </label>
                <label className="text-xs font-semibold text-gray-700">
                  Business
                  <select value={business} onChange={(e) => setBusiness(e.target.value as Business)} className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm font-normal">
                    <option value="FDH">{BUSINESS_NAMES.FDH}</option>
                    <option value="LDB">{BUSINESS_NAMES.LDB}</option>
                  </select>
                </label>
              </>
            )}
            <label className="text-xs font-semibold text-gray-700 sm:col-span-2">
              Notes (only in the CRM)
              <textarea value={notes} maxLength={1000} rows={2} onChange={(e) => setNotes(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm font-normal" />
            </label>
            <div className="sm:col-span-2">
              <button type="submit" disabled={busy} className="rounded-md bg-blue-700 px-3 py-1.5 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-60">
                Save details
              </button>
            </div>
          </form>

          <div className="space-y-2 border-t border-gray-100 pt-3 text-sm">
            {project.lead ? (
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-gray-800">
                  Linked to <span className="font-semibold">{project.lead.businessName || project.lead.name}</span>. Areas with a distributor, leaflets and pay make its Profit cost lines.
                </p>
                {confirm === "unlink" ? (
                  <>
                    <span className="text-xs text-gray-700">Unlink? Its map cost lines are removed and the pay is held on the areas.</span>
                    <button type="button" onClick={() => onSave({ leadId: null })} className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-bold text-white">
                      Yes, unlink
                    </button>
                    <button type="button" onClick={() => setConfirm(null)} className="rounded-md border border-gray-300 px-2.5 py-1 text-xs">
                      Keep
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={() => setConfirm("unlink")} className="rounded-md px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-50">
                    Unlink from the job
                  </button>
                )}
              </div>
            ) : (
              <form
                className="flex flex-wrap items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (leadId) onSave({ leadId });
                }}
              >
                <label className="text-xs font-semibold text-gray-700">
                  Link to a Won job
                  <select value={leadId} onChange={(e) => setLeadId(e.target.value)} className="mt-1 block w-64 max-w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm font-normal">
                    <option value="">Choose a job</option>
                    {leads.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.businessName || l.name} ({l.stage === "COMPLETED" ? "Completed" : "Won"}
                        {l.business === "LDB" ? ", Bournemouth" : ""})
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit" disabled={!leadId || busy} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-60">
                  Link
                </button>
                <p className="w-full text-xs text-gray-500">Pay held on this map&apos;s areas becomes cost lines on the job you link.</p>
              </form>
            )}

            {project.business === "LDB" && (
              <label className="flex items-center gap-2 text-sm text-gray-800">
                <input
                  type="checkbox"
                  checked={linksOn}
                  onChange={(e) => {
                    setLinksOn(e.target.checked);
                    onSave({ ldbLinksEnabled: e.target.checked });
                  }}
                />
                Allow private links for this Bournemouth project (off: image only)
              </label>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              {closed ? (
                <button type="button" onClick={() => onSave({ closed: false })} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-800 hover:bg-gray-50">
                  Reopen project
                </button>
              ) : confirm === "close" ? (
                <>
                  <span className="text-xs text-gray-700">Close it? It leaves the tabs; private links stop working 14 days later.</span>
                  <button type="button" onClick={() => onSave({ closed: true })} className="rounded-md bg-gray-800 px-2.5 py-1 text-xs font-bold text-white">
                    Yes, close
                  </button>
                  <button type="button" onClick={() => setConfirm(null)} className="rounded-md border border-gray-300 px-2.5 py-1 text-xs">
                    Keep open
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => setConfirm("close")} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-800 hover:bg-gray-50">
                  Close project
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
