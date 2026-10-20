"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  TEMP_PREFIX,
  areasBeingEstimated,
  isTempId,
  movesAreas,
  renameInChanges,
  replay,
  withPredictedColours,
  withoutFailed,
  type PendingChange,
} from "@/lib/area-planner/optimistic";
import type { PlannerDistributor, PlannerProject, ProjectTotals } from "@/lib/area-planner/types";
import { validateAreaChanges, validateNewArea, type ProjectChanges } from "@/lib/area-planner/validate";
import type { Business } from "@/lib/business";
import {
  api,
  areaUrl,
  linkUrl,
  listsUrl,
  outcomeUnknown,
  projectUrl,
  totalsUrl,
  type AreaReply,
  type DeleteReply,
  type LinksReply,
  type ListsReply,
  type PostcodesReply,
  type ProjectReply,
  type ProjectsReply,
  type TotalsReply,
} from "./planner-api";

// The Area Planner page's state and its saving. Area changes show at once:
// each is checked here as the server will check it, applied to the page's
// copy, and saved in the background. Saves go one at a time, in the order
// they were made, so the server applies them in order; a reply only ever
// updates the confirmed copy, and the page shows the confirmed copy with
// the changes still waiting applied on top, so an older reply can't undo a
// newer change (lib/area-planner/optimistic.ts). A save that fails is taken
// off with a message saying so; one whose outcome is unknown (no reply, or
// the server gave up) also reloads what's saved. Replies carry just the
// changed area and the project's totals, or null when those are still being
// worked out, in which case the page asks for them until they're ready.

type Queued = PendingChange & { body: unknown; what: string };

type Confirmed = {
  project: PlannerProject;
  totals: ProjectTotals | null;
  // Whether `totals` are for these areas (false while the server works them out).
  totalsCurrent: boolean;
  // Goes up whenever a reply moves, adds or removes an area.
  version: number;
};

type State = { confirmed: Confirmed | null; pending: Queued[] };

export type Message = { text: string; tone: "info" | "error" };

type Options = {
  wantedProjectId: string | null;
  wantedLeadId: string | null;
  // A new area's temporary id has become its real one.
  onRenamed: (from: string, to: string) => void;
  // A change was taken back off the map.
  onUndone: (change: PendingChange) => void;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function withTotals(confirmed: Confirmed, totals: ProjectTotals | null, moved: boolean): Confirmed {
  if (totals) return { ...confirmed, totals, totalsCurrent: true };
  return moved ? { ...confirmed, totalsCurrent: false } : confirmed;
}

export function usePlanner(options: Options) {
  const opts = useRef(options);
  opts.current = options;
  const [lists, setLists] = useState<ListsReply | null>(null);
  const [listsError, setListsError] = useState<string | null>(null);
  const [state, setState] = useState<State>({ confirmed: null, pending: [] });
  const stateRef = useRef(state);
  const [loading, setLoading] = useState<"project" | null>(options.wantedProjectId ? "project" : null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const seq = useRef(0);
  const opening = useRef(0);

  const update = useCallback((change: (s: State) => State) => {
    stateRef.current = change(stateRef.current);
    setState(stateRef.current);
  }, []);
  const say = useCallback((text: string, tone: Message["tone"] = "info") => setMessage({ text, tone }), []);

  // Runs saves one after another; a failed one doesn't stop the rest.
  const enqueue = useCallback((task: () => Promise<void>): Promise<void> => {
    const run = queue.current.then(task, task);
    queue.current = run.catch(() => undefined);
    return run;
  }, []);

  const mergeDistributor = useCallback((d: PlannerDistributor | null) => {
    if (!d) return;
    setLists((l) =>
      l && {
        ...l,
        distributors: l.distributors.some((x) => x.id === d.id)
          ? l.distributors.map((x) => (x.id === d.id ? d : x))
          : [...l.distributors, d].sort((a, b) => a.name.localeCompare(b.name)),
      }
    );
  }, []);

  const showProject = useCallback(
    (project: PlannerProject, totals: ProjectTotals | null) => {
      update((s) => ({
        confirmed: { project, totals, totalsCurrent: !!totals, version: (s.confirmed?.version ?? 0) + 1 },
        pending: s.confirmed?.project.id === project.id ? s.pending : [],
      }));
      window.history.replaceState(null, "", `/admin/crm/map?project=${encodeURIComponent(project.id)}`);
    },
    [update]
  );

  // Reloads the open project as saved, keeping changes still waiting on top.
  const reload = useCallback(async () => {
    const id = stateRef.current.confirmed?.project.id;
    if (!id) return;
    const res = await api<ProjectReply>(projectUrl(id));
    if (res.ok && stateRef.current.confirmed?.project.id === id) showProject(res.data.project, res.data.totals);
  }, [showProject]);

  const openProject = useCallback(
    async (id: string): Promise<boolean> => {
      const mine = ++opening.current;
      setLoading("project");
      await queue.current;
      const res = await api<ProjectReply>(projectUrl(id));
      if (mine !== opening.current) return false;
      setLoading(null);
      if (!res.ok) {
        say(res.error, "error");
        return false;
      }
      update(() => ({ confirmed: null, pending: [] }));
      showProject(res.data.project, res.data.totals);
      return true;
    },
    [say, showProject, update]
  );

  const reloadLists = useCallback(async () => {
    const res = await api<ListsReply>(listsUrl);
    if (res.ok) setLists(res.data);
    return res;
  }, []);

  // First the lists and (when named) the project, side by side.
  useEffect(() => {
    let cancelled = false;
    const wanted = opts.current.wantedProjectId;
    const opened = wanted ? openProject(wanted) : Promise.resolve(false);
    void (async () => {
      const res = await reloadLists();
      if (cancelled) return;
      if (!res.ok) {
        setListsError(res.error);
        return;
      }
      if (await opened) return;
      const lead = opts.current.wantedLeadId;
      const tab = res.data.projects.find((p) => lead && p.leadId === lead) ?? res.data.projects.find((p) => !p.closedAt);
      if (tab) await openProject(tab.id);
      else setLoading(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [openProject, reloadLists]);

  const fail = useCallback(
    async (change: Queued, res: { error: string; status: number }) => {
      update((s) => ({ ...s, pending: withoutFailed(s.pending, change) }));
      opts.current.onUndone(change);
      if (outcomeUnknown(res.status)) {
        say(`Couldn't confirm ${change.what} was saved: ${res.error} The map now shows what is saved.`, "error");
        await reload();
      } else {
        say(`Couldn't save ${change.what}: ${res.error} It has been put back as it was.`, "error");
      }
    },
    [reload, say, update]
  );

  // Sends one change, as it stands now (an earlier new area may have been
  // given its real id since it was made).
  const send = useCallback(
    async (seqNo: number) => {
      const change = stateRef.current.pending.find((c) => c.seq === seqNo);
      const project = stateRef.current.confirmed?.project;
      if (!change || !project) return;
      if (change.type !== "create" && isTempId(change.areaId)) return;

      if (change.type === "create") {
        const res = await api<AreaReply>(`${projectUrl(project.id)}/areas`, "POST", change.body);
        if (!res.ok) return fail(change, res);
        const saved = res.data.area;
        update((s) => {
          if (!s.confirmed) return s;
          const confirmed = { ...s.confirmed, project: { ...s.confirmed.project, areas: [...s.confirmed.project.areas, saved] }, version: s.confirmed.version + 1 };
          return { confirmed: withTotals(confirmed, res.data.totals, true), pending: renameInChanges(s.pending.filter((c) => c.seq !== seqNo), change.tempId, saved.id) };
        });
        mergeDistributor(res.data.distributor);
        opts.current.onRenamed(change.tempId, saved.id);
        return;
      }

      if (change.type === "update") {
        const res = await api<AreaReply>(areaUrl(change.areaId), "PATCH", change.body);
        if (!res.ok) return fail(change, res);
        const saved = res.data.area;
        const moved = movesAreas(change);
        update((s) => {
          if (!s.confirmed) return s;
          const project = { ...s.confirmed.project, areas: s.confirmed.project.areas.map((a) => (a.id === saved.id ? saved : a)) };
          const confirmed = { ...s.confirmed, project, version: s.confirmed.version + (moved ? 1 : 0) };
          return { confirmed: withTotals(confirmed, res.data.totals, moved), pending: s.pending.filter((c) => c.seq !== seqNo) };
        });
        mergeDistributor(res.data.distributor);
        return;
      }

      const res = await api<DeleteReply>(areaUrl(change.areaId), "DELETE");
      if (!res.ok) return fail(change, res);
      update((s) => {
        if (!s.confirmed) return s;
        const project = { ...s.confirmed.project, areas: s.confirmed.project.areas.filter((a) => a.id !== change.areaId) };
        const confirmed = { ...s.confirmed, project, version: s.confirmed.version + 1 };
        return { confirmed: withTotals(confirmed, res.data.totals, true), pending: s.pending.filter((c) => c.seq !== seqNo) };
      });
    },
    [fail, mergeDistributor, update]
  );

  const canChange = () => {
    const project = stateRef.current.confirmed?.project;
    return !!project && !project.closedAt;
  };

  // A new area, shown at once. Returns its temporary id, or null if the
  // shape isn't valid (the reason is shown).
  const createArea = useCallback(
    (body: Record<string, unknown>, what: string): string | null => {
      if (!canChange()) return null;
      const checked = validateNewArea(body);
      if (!checked.ok) {
        say(checked.error, "error");
        return null;
      }
      const seqNo = ++seq.current;
      const tempId = `${TEMP_PREFIX}${seqNo}`;
      update((s) => ({ ...s, pending: [...s.pending, { seq: seqNo, type: "create", tempId, area: checked.area, body, what }] }));
      void enqueue(() => send(seqNo));
      return tempId;
    },
    [enqueue, say, send, update]
  );

  const updateArea = useCallback(
    (areaId: string, body: Record<string, unknown>, what: string): boolean => {
      if (!canChange()) return false;
      const checked = validateAreaChanges(body);
      if (!checked.ok) {
        say(checked.error, "error");
        return false;
      }
      const seqNo = ++seq.current;
      update((s) => ({ ...s, pending: [...s.pending, { seq: seqNo, type: "update", areaId, changes: checked.changes, body, what }] }));
      void enqueue(() => send(seqNo));
      return true;
    },
    [enqueue, say, send, update]
  );

  const deleteArea = useCallback(
    (areaId: string, what: string) => {
      if (!canChange()) return;
      const seqNo = ++seq.current;
      update((s) => ({ ...s, pending: [...s.pending, { seq: seqNo, type: "delete", areaId, body: null, what }] }));
      void enqueue(() => send(seqNo));
    },
    [enqueue, send, update]
  );

  // Postcode shapes come from the server, so these wait for the reply (in
  // turn with everything else).
  const addPostcodes = useCallback(
    (text: string): Promise<PostcodesReply | null> =>
      new Promise((resolve) => {
        void enqueue(async () => {
          const project = stateRef.current.confirmed?.project;
          if (!project) return resolve(null);
          setBusy("postcodes");
          const res = await api<PostcodesReply>(`${projectUrl(project.id)}/areas`, "POST", { postcodes: text });
          setBusy(null);
          if (!res.ok) {
            say(res.error, "error");
            if (outcomeUnknown(res.status)) await reload();
            return resolve(null);
          }
          const added = res.data.areas;
          if (added.length > 0) {
            update((s) => {
              if (!s.confirmed) return s;
              const confirmed = { ...s.confirmed, project: { ...s.confirmed.project, areas: [...s.confirmed.project.areas, ...added] }, version: s.confirmed.version + 1 };
              return { ...s, confirmed: withTotals(confirmed, res.data.totals, true) };
            });
          }
          resolve(res.data);
        });
      }),
    [enqueue, reload, say, update]
  );

  const saveProject = useCallback(
    (changes: ProjectChanges): Promise<boolean> =>
      new Promise((resolve) => {
        void enqueue(async () => {
          const id = stateRef.current.confirmed?.project.id;
          if (!id) return resolve(false);
          setBusy("project");
          const res = await api<ProjectsReply>(projectUrl(id), "PATCH", changes);
          setBusy(null);
          if (!res.ok) {
            say(res.error, "error");
            return resolve(false);
          }
          setLists((l) => l && { ...l, projects: res.data.projects });
          if (res.data.project) showProject(res.data.project, res.data.totals);
          if (changes.leadId !== undefined || changes.closed !== undefined) await reloadLists();
          resolve(true);
        });
      }),
    [enqueue, reloadLists, say, showProject]
  );

  const createProject = useCallback(
    (input: { leadId: string } | { name: string; notes: string; business: Business }): Promise<string | null> =>
      new Promise((resolve) => {
        void enqueue(async () => {
          setBusy("add");
          const res = await api<ProjectsReply>(listsUrl, "POST", input);
          setBusy(null);
          if (!res.ok) return resolve(res.error);
          setLists((l) => l && { ...l, projects: res.data.projects, leads: "leadId" in input ? l.leads.filter((x) => x.id !== input.leadId) : l.leads });
          update(() => ({ confirmed: null, pending: [] }));
          if (res.data.project) showProject(res.data.project, res.data.totals);
          resolve(null);
        });
      }),
    [enqueue, showProject, update]
  );

  const changeLink = useCallback(
    (distributorId: string, method: "POST" | "DELETE"): Promise<string | null | false> =>
      new Promise((resolve) => {
        void enqueue(async () => {
          const id = stateRef.current.confirmed?.project.id;
          if (!id) return resolve(false);
          setBusy(`link:${distributorId}`);
          const res = await api<LinksReply>(linkUrl(id, distributorId), method);
          setBusy(null);
          if (!res.ok) {
            say(res.error, "error");
            return resolve(false);
          }
          update((s) => (s.confirmed?.project.id === id ? { ...s, confirmed: { ...s.confirmed, project: { ...s.confirmed.project, links: res.data.links } } } : s));
          resolve(res.data.url ?? null);
        });
      }),
    [enqueue, say, update]
  );

  // The totals, asked for again while the server is still working them out,
  // but only while no change is on its way (its reply brings them).
  const confirmed = state.confirmed;
  const idle = state.pending.length === 0;
  useEffect(() => {
    if (!confirmed || confirmed.totalsCurrent || !idle) return;
    const id = confirmed.project.id;
    const version = confirmed.version;
    let stop = false;
    void (async () => {
      for (let tries = 0; !stop; tries++) {
        const res = await api<TotalsReply>(totalsUrl(id));
        if (stop) return;
        const totals = res.ok ? res.data.totals : null;
        if (totals) {
          update((s) =>
            s.confirmed && s.confirmed.project.id === id && s.confirmed.version === version && s.pending.length === 0
              ? { ...s, confirmed: { ...s.confirmed, totals, totalsCurrent: true } }
              : s
          );
          return;
        }
        await sleep(Math.min(5000, 1000 + tries * 500));
      }
    })();
    return () => {
      stop = true;
    };
  }, [confirmed, idle, update]);

  // Saves still on their way when the tab is closed: ask first.
  useEffect(() => {
    if (idle) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [idle]);

  const areas = useMemo(() => (confirmed ? replay(confirmed.project.areas, state.pending) : []), [confirmed, state.pending]);
  const estimating = useMemo(() => areasBeingEstimated(state.pending), [state.pending]);
  const distributors = useMemo(() => withPredictedColours(lists?.distributors ?? [], areas), [lists, areas]);
  const totalsStale = !!confirmed && (!confirmed.totalsCurrent || state.pending.some(movesAreas));
  // Overlaps still standing: none for an area that's gone or being moved.
  const overlaps = useMemo(() => {
    const ids = new Set(areas.map((a) => a.id));
    return (confirmed?.totals?.overlaps ?? []).filter((o) => ids.has(o.a) && ids.has(o.b) && !estimating.has(o.a) && !estimating.has(o.b));
  }, [confirmed, areas, estimating]);

  return {
    lists,
    listsError,
    distributors,
    project: confirmed?.project ?? null,
    areas,
    overlaps,
    totalHouseholds: confirmed?.totals?.totalHouseholds ?? null,
    totalsKnown: !!confirmed?.totals,
    totalsStale,
    estimating,
    saving: !idle,
    loading,
    busy,
    message,
    say,
    setBusy,
    openProject,
    reloadLists,
    createArea,
    updateArea,
    deleteArea,
    addPostcodes,
    saveProject,
    createProject,
    makeLink: (distributorId: string) => changeLink(distributorId, "POST"),
    revokeLink: (distributorId: string) => changeLink(distributorId, "DELETE"),
  };
}
