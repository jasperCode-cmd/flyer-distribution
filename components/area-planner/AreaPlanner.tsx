"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import BusinessBadge from "@/components/crm/BusinessBadge";
import { areaName } from "@/lib/area-planner/costs";
import { DEFAULT_RADIUS_M, formatArea, type LatLng } from "@/lib/area-planner/geometry";
import type { PendingChange } from "@/lib/area-planner/optimistic";
import { MAX_POSTCODES } from "@/lib/area-planner/postcodes";
import type { PostcodeProblem } from "@/lib/area-planner/postcodes";
import type { ProjectChanges } from "@/lib/area-planner/validate";
import type { Business } from "@/lib/business";
import AddProjectDialog from "./AddProjectDialog";
import AreaPanel, { type AreaFormValues } from "./AreaPanel";
import DistributorSidebar from "./DistributorSidebar";
import ProjectSettings from "./ProjectSettings";
import ProjectSummary from "./ProjectSummary";
import type { PlannerMapHandle, ShapeInput, Tool } from "./PlannerMap";
import { api, shareUrl, type ShareReply } from "./planner-api";
import { downloadShareImage } from "./share-image";
import { usePlanner } from "./use-planner";
import "./area-planner.css";

const PlannerMap = dynamic(() => import("./PlannerMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-gray-100" />,
});

// The Area Planner on the Jobs map page: a tab per open project, the map
// with its drawing tools, the active distributors to drag on, the selected
// area's details, postcodes to add, overlap warnings, the summary, and each
// distributor's image and private link. It draws at once and loads its
// data through the API (use-planner.ts); every change to an area shows
// straight away and saves in the background.

type Props = {
  wantedProjectId: string | null;
  wantedLeadId: string | null;
};

const TOOLS: { id: Tool; label: string; hint: string }[] = [
  { id: "select", label: "Select", hint: "Click an area to see and edit it." },
  { id: "circle", label: "Circle", hint: "Click the centre, then click again to set the size." },
  { id: "rectangle", label: "Rectangle", hint: "Click one corner, then the opposite corner." },
  { id: "polygon", label: "Polygon", hint: "Click each corner; click the first one again to close and fill it." },
  { id: "lasso", label: "Lasso", hint: "Press and drag round the area; let go to close and fill it." },
];

export default function AreaPlanner({ wantedProjectId, wantedLeadId }: Props) {
  const [tool, setTool] = useState<Tool>("select");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [postcodes, setPostcodes] = useState("");
  const [problems, setProblems] = useState<PostcodeProblem[]>([]);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [newLink, setNewLink] = useState<{ distributorId: string; url: string } | null>(null);
  const [fitKey, setFitKey] = useState("none");
  const mapHandle = useRef<PlannerMapHandle | null>(null);

  const planner = usePlanner({
    wantedProjectId,
    wantedLeadId,
    onRenamed: (from, to) => {
      setSelectedId((id) => (id === from ? to : id));
      setEditingId((id) => (id === from ? to : id));
    },
    onUndone: (change: PendingChange) => {
      const id = change.type === "create" ? change.tempId : change.areaId;
      if (change.type === "create") setSelectedId((s) => (s === id ? null : s));
      setEditingId((e) => (e === id ? null : e));
    },
  });
  const { project, areas, distributors, lists, message, say, busy } = planner;

  const projects = lists?.projects ?? [];
  const openTabs = projects.filter((p) => !p.closedAt);
  const closedTabs = projects.filter((p) => p.closedAt);
  const data = lists?.data ?? null;
  const readOnly = !project || !!project.closedAt;
  const selected = areas.find((a) => a.id === selectedId) ?? null;
  const assigning = assigningId ? distributors.find((d) => d.id === assigningId) ?? null : null;
  const areaCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of areas) if (a.distributorId) counts.set(a.distributorId, (counts.get(a.distributorId) ?? 0) + 1);
    return counts;
  }, [areas]);
  const names = useMemo(() => {
    const byId = new Map(distributors.map((d) => [d.id, d.name]));
    return new Map(areas.map((a) => [a.id, a.distributorId ? `${areaName(a)} (${byId.get(a.distributorId) ?? "distributor"})` : areaName(a)]));
  }, [areas, distributors]);

  // Refit the map once a project's areas are first in.
  const projectId = project?.id ?? null;
  useEffect(() => {
    if (projectId) setFitKey(`${projectId}:${Date.now()}`);
  }, [projectId]);

  async function openProject(id: string) {
    setSelectedId(null);
    setEditingId(null);
    setAssigningId(null);
    setProblems([]);
    setNewLink(null);
    if (await planner.openProject(id)) say("");
  }

  function createShape(shape: ShapeInput, distributorId: string | null = null) {
    const tempId = planner.createArea({ ...shape, distributorId }, "the new area");
    if (tempId) {
      setSelectedId(tempId);
      say(distributorId ? "Area added and assigned." : "Area added. Drag a distributor onto it to assign it.");
    }
  }

  function place(distributorId: string, latlng: LatLng, areaId: string | null) {
    if (readOnly) return;
    const name = distributors.find((d) => d.id === distributorId)?.name ?? "Distributor";
    if (areaId) {
      const area = areas.find((a) => a.id === areaId);
      if (planner.updateArea(areaId, { distributorId }, `${name} on ${area ? areaName(area) : "the area"}`)) {
        setSelectedId(areaId);
        say(`${name} assigned.`);
      }
    } else {
      createShape({ kind: "CIRCLE", centre: latlng, radiusM: DEFAULT_RADIUS_M }, distributorId);
    }
    setAssigningId(null);
  }

  function dropDistributor(distributorId: string, clientX: number, clientY: number) {
    const at = mapHandle.current?.pointAt(clientX, clientY);
    if (at) place(distributorId, at.latlng, at.areaId);
  }

  function saveArea(values: AreaFormValues) {
    if (!selected) return;
    const body = {
      distributorId: values.distributorId || null,
      leafletCount: values.leafletCount,
      label: values.label,
      status: values.status,
      payType: values.payType || null,
      rate: values.rate,
      amount: values.amount,
    };
    if (planner.updateArea(selected.id, body, `the changes to ${areaName(selected)}`)) say("Area saved.");
  }

  function editShape(id: string, shape: ShapeInput) {
    const area = areas.find((a) => a.id === id);
    if (planner.updateArea(id, { shape }, `the new shape of ${area ? areaName(area) : "the area"}`)) say("Shape saved.");
  }

  function deleteSelected() {
    if (!selected) return;
    planner.deleteArea(selected.id, `the deletion of ${areaName(selected)}`);
    setSelectedId(null);
    setEditingId(null);
    say("Area deleted.");
  }

  async function addPostcodes() {
    if (!project || !postcodes.trim()) return;
    const reply = await planner.addPostcodes(postcodes);
    if (!reply) return;
    setProblems(reply.problems);
    const made = reply.areas.length;
    if (made > 0) {
      setPostcodes("");
      mapHandle.current?.fitTo(reply.areas.map((a) => a.geometry));
    }
    say(
      made > 0
        ? `${made} postcode shape${made === 1 ? "" : "s"} added${reply.problems.length ? `, ${reply.problems.length} not used (listed below)` : ""}.`
        : "No postcode shapes added. See the list below.",
      made > 0 ? "info" : "error"
    );
  }

  async function saveProject(changes: ProjectChanges) {
    if (await planner.saveProject(changes)) {
      say(changes.closed === true ? "Project closed." : changes.closed === false ? "Project reopened." : "Project saved.");
    }
  }

  async function createProject(input: { leadId: string } | { name: string; notes: string; business: Business }) {
    setAddError(null);
    const error = await planner.createProject(input);
    if (error) return setAddError(error);
    setAdding(false);
    setSelectedId(null);
    say("Project added. Draw areas, type postcodes, or drag a distributor onto the map.");
  }

  async function download(distributorId: string) {
    if (!project) return;
    planner.setBusy(`image:${distributorId}`);
    const res = await api<ShareReply>(shareUrl(project.id, distributorId));
    if (!res.ok) {
      planner.setBusy(null);
      return say(res.error, "error");
    }
    try {
      const { missingTiles } = await downloadShareImage(res.data.view);
      say(missingTiles ? `Image saved, but ${missingTiles} map tile${missingTiles === 1 ? "" : "s"} couldn't load and show grey. Try again for a full map.` : "Image saved.");
    } catch (err) {
      say(err instanceof Error ? err.message : "The image couldn't be made.", "error");
    }
    planner.setBusy(null);
  }

  async function makeLink(distributorId: string) {
    const url = await planner.makeLink(distributorId);
    if (url) {
      setNewLink({ distributorId, url });
      say("Private link made. Copy it now: it is only shown once.");
    }
  }

  async function revokeLink(distributorId: string) {
    if ((await planner.revokeLink(distributorId)) !== false) {
      if (newLink?.distributorId === distributorId) setNewLink(null);
      say("Link revoked. It stops working straight away.");
    }
  }

  const hint = assigning
    ? `Click an area to give it to ${assigning.name}, or click empty map for a new ${DEFAULT_RADIUS_M}m circle. Press the name again to stop.`
    : TOOLS.find((t) => t.id === tool)?.hint;
  const mapLoading = planner.loading === "project";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-blue-900">Area Planner</h1>
          <p className="text-sm text-gray-500">Plan each job&apos;s distributor areas on the map.</p>
        </div>
        {data && !data.installed ? (
          <p className="max-w-xl rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-900">
            The postcode and household data isn&apos;t installed yet, so postcode shapes and home estimates aren&apos;t available. Drawing and assigning work as normal.
          </p>
        ) : data?.sample ? (
          <p className="max-w-xl rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900">
            Sample data: these postcode shapes and household figures are made up, for testing only.
          </p>
        ) : null}
      </div>

      <nav aria-label="Projects" className="flex items-center gap-2 overflow-x-auto border-b border-gray-200 pb-2">
        {!lists && !planner.listsError && (
          <span className="flex items-center gap-2" aria-live="polite">
            <span className="h-8 w-40 animate-pulse rounded-md bg-gray-100" aria-hidden="true" />
            <span className="text-sm text-gray-500">Loading projects...</span>
          </span>
        )}
        {planner.listsError && (
          <span className="text-sm text-red-700">
            {planner.listsError}{" "}
            <button type="button" onClick={() => void planner.reloadLists()} className="font-semibold underline">
              Try again
            </button>
          </span>
        )}
        {openTabs.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => openProject(p.id)}
            aria-current={project?.id === p.id ? "page" : undefined}
            className={`flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold ${
              project?.id === p.id ? "bg-blue-900 text-white" : "bg-white text-blue-900 border border-gray-200 hover:bg-blue-50"
            }`}
          >
            <span className="max-w-[14rem] truncate">{p.name}</span>
            <BusinessBadge business={p.business} />
          </button>
        ))}
        {lists && (
          <button
            type="button"
            onClick={() => {
              setAddError(null);
              setAdding(true);
            }}
            className="shrink-0 rounded-md border border-dashed border-blue-300 px-3 py-1.5 text-sm font-semibold text-blue-700 hover:bg-blue-50"
          >
            + Add project
          </button>
        )}
        {closedTabs.length > 0 && (
          <select
            aria-label="Open a closed project"
            value=""
            onChange={(e) => e.target.value && openProject(e.target.value)}
            className="shrink-0 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-700"
          >
            <option value="">Closed projects ({closedTabs.length})</option>
            {closedTabs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
      </nav>

      <div className="flex min-h-5 flex-wrap items-center justify-between gap-2">
        <p aria-live="polite" className={`text-sm ${message?.tone === "error" ? "text-red-700" : "text-gray-700"}`}>
          {message?.text}
        </p>
        {project && (
          <p className="text-xs text-gray-500" aria-live="polite">
            {planner.saving ? "Saving changes..." : "All changes saved"}
          </p>
        )}
      </div>

      {!project && !mapLoading && lists ? (
        <div className="rounded-lg border border-gray-200 bg-white p-10 text-center">
          <h2 className="text-sm font-bold text-blue-900">No project open</h2>
          <p className="mt-1 text-sm text-gray-500">
            {openTabs.length ? "Choose a project above." : "Add a project for a Won job, or a map-only one, to start planning areas."}
          </p>
        </div>
      ) : (
        <>
          {project?.closedAt && (
            <p className="rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-800">
              This project is closed, so its areas can&apos;t be changed. Reopen it under Project details.
            </p>
          )}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_16rem]">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-1.5" role="toolbar" aria-label="Drawing tools">
                {TOOLS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    disabled={readOnly && t.id !== "select"}
                    aria-pressed={tool === t.id}
                    onClick={() => {
                      setAssigningId(null);
                      setTool(t.id);
                    }}
                    className={`rounded-md px-3 py-1.5 text-sm font-semibold disabled:opacity-50 ${
                      tool === t.id ? "bg-blue-900 text-white" : "border border-gray-300 bg-white text-gray-800 hover:bg-gray-50"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => mapHandle.current?.fitTo(areas.map((a) => a.geometry))}
                  disabled={areas.length === 0}
                  className="rounded-md px-3 py-1.5 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                >
                  Show all areas
                </button>
              </div>
              <p className="text-xs text-gray-600">{hint}</p>
              <div className="relative h-[58vh] min-h-[340px] overflow-hidden rounded-lg border border-gray-200 bg-gray-100 lg:h-[640px]">
                <PlannerMap
                  handleRef={mapHandle}
                  areas={areas}
                  overlaps={planner.overlaps}
                  distributors={distributors}
                  selectedId={selectedId}
                  editingId={editingId}
                  tool={tool}
                  assigning={!!assigningId}
                  readOnly={readOnly}
                  fitKey={fitKey}
                  onSelect={(id) => {
                    setSelectedId(id);
                    if (id !== editingId) setEditingId(null);
                  }}
                  onCreate={(shape) => createShape(shape)}
                  onShapeEdited={editShape}
                  onPlace={(latlng, areaId) => assigningId && place(assigningId, latlng, areaId)}
                  onToolDone={() => setTool("select")}
                />
                {(mapLoading || !lists) && (
                  <div className="pointer-events-none absolute inset-x-0 top-3 z-[500] flex justify-center" role="status">
                    <span className="rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-blue-900 shadow">Loading the areas...</span>
                  </div>
                )}
              </div>
            </div>
            <aside aria-label="Distributors" className="order-first rounded-lg border border-gray-200 bg-white p-3 lg:order-none lg:h-[704px]">
              <h2 className="mb-2 hidden text-sm font-bold text-blue-900 lg:block">Distributors</h2>
              {lists ? (
                <DistributorSidebar
                  distributors={distributors}
                  areaCounts={areaCounts}
                  assigningId={assigningId}
                  disabled={readOnly}
                  onTap={(id) => {
                    setTool("select");
                    setAssigningId((current) => (current === id ? null : id));
                  }}
                  onDrop={dropDistributor}
                />
              ) : (
                <div className="space-y-2" aria-hidden="true">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="h-8 animate-pulse rounded-md bg-gray-100" />
                  ))}
                </div>
              )}
            </aside>
          </div>

          {project && planner.overlaps.length > 0 && (
            <section aria-label="Overlapping areas" className="rounded-lg border border-red-300 bg-red-50 p-3">
              <h2 className="text-sm font-bold text-red-800">
                {planner.overlaps.length === 1 ? "Two areas overlap" : `${planner.overlaps.length} overlaps`}: the same streets would get leaflets twice
              </h2>
              <ul className="mt-1 space-y-1 text-sm text-red-900">
                {planner.overlaps.map((o) => (
                  <li key={`${o.a}:${o.b}`}>
                    <button type="button" onClick={() => mapHandle.current?.fitTo([o.geometry])} className="text-left underline-offset-2 hover:underline">
                      {names.get(o.a)} and {names.get(o.b)}: about {formatArea(o.areaM2)}
                      {o.households !== null ? `, about ${o.households.toLocaleString("en-GB")} homes` : ""}
                    </button>
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-xs text-red-800">
                Shown hatched in red on the map. Click one to zoom to it.{planner.totalsStale ? " Checking again for the latest changes..." : ""}
              </p>
            </section>
          )}

          {project && (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div className="space-y-3">
                {selected ? (
                  <AreaPanel
                    key={selected.id}
                    area={selected}
                    distributors={distributors}
                    linked={!!project.lead}
                    readOnly={readOnly}
                    editingShape={editingId === selected.id}
                    estimating={planner.estimating.has(selected.id)}
                    onSave={saveArea}
                    onRadius={(radiusM) => selected.centre && editShape(selected.id, { kind: "CIRCLE", centre: selected.centre, radiusM })}
                    onToggleShapeEdit={() => setEditingId((id) => (id === selected.id ? null : selected.id))}
                    onDelete={deleteSelected}
                    onClose={() => {
                      setSelectedId(null);
                      setEditingId(null);
                    }}
                  />
                ) : (
                  <p className="rounded-lg border border-dashed border-gray-300 bg-white p-4 text-sm text-gray-500">
                    Select an area on the map to set its leaflets, label, status and pay.
                  </p>
                )}

                <section aria-label="Add postcodes" className="rounded-lg border border-gray-200 bg-white p-4">
                  <h2 className="text-sm font-bold text-blue-900">Add postcode areas</h2>
                  <form
                    className="mt-2 flex flex-wrap items-start gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void addPostcodes();
                    }}
                  >
                    <label className="sr-only" htmlFor="ap-postcodes">
                      Postcode districts or sectors
                    </label>
                    <textarea
                      id="ap-postcodes"
                      value={postcodes}
                      onChange={(e) => setPostcodes(e.target.value)}
                      disabled={readOnly || !data?.installed}
                      rows={2}
                      placeholder="BH6, PO14, SO14 or sectors like BH6 3"
                      className="min-w-0 flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                    />
                    <button
                      type="submit"
                      disabled={readOnly || !data?.installed || !postcodes.trim() || busy === "postcodes"}
                      className="rounded-md bg-blue-700 px-3 py-1.5 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-60"
                    >
                      {busy === "postcodes" ? "Adding..." : "Add"}
                    </button>
                  </form>
                  <p className="mt-1 text-xs text-gray-500">
                    Districts or sectors in BH, SO, PO, SP and DT, separated by commas or new lines; up to {MAX_POSTCODES} at once. Each becomes its own shape, ready to assign.
                  </p>
                  {problems.length > 0 && (
                    <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 p-2">
                      <p className="text-xs font-semibold text-amber-900">Not added:</p>
                      <ul className="mt-1 space-y-0.5 text-xs text-amber-900">
                        {problems.map((p, i) => (
                          <li key={`${p.input}:${i}`}>
                            <span className="font-semibold">{p.input}</span>: {p.reason}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </section>
              </div>

              <div className="space-y-3">
                <ProjectSummary
                  project={project}
                  areas={areas}
                  totalHouseholds={planner.totalHouseholds}
                  totalsKnown={planner.totalsKnown}
                  totalsStale={planner.totalsStale}
                  overlapCount={planner.overlaps.length}
                  distributors={distributors}
                  onSelectArea={(id) => {
                    setSelectedId(id);
                    const area = areas.find((a) => a.id === id);
                    if (area) mapHandle.current?.fitTo([area.geometry]);
                  }}
                  onDownload={download}
                  onMakeLink={makeLink}
                  onRevokeLink={revokeLink}
                  busyKey={busy}
                  newLink={newLink}
                />
                <ProjectSettings project={project} leads={lists?.leads ?? []} busy={busy === "project"} onSave={saveProject} />
              </div>
            </div>
          )}

          <p className="text-xs text-gray-500">
            Map tiles &copy; OpenStreetMap contributors. Homes are Census 2021 household counts by Output Area (ONS), shared by how much of each Output Area falls inside an area.
            {data && data.credits.length > 0 ? ` ${data.credits.join(". ")}.` : ""}
          </p>
        </>
      )}

      {adding && lists && <AddProjectDialog leads={lists.leads} busy={busy === "add"} error={addError} onCreate={createProject} onClose={() => setAdding(false)} />}
    </div>
  );
}
