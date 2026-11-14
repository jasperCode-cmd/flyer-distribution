"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { solveAlignment } from "@/lib/rounds/alignment";
import { formatUsd } from "@/lib/rounds/format";
import { STATUS_LABELS, nextToDo, progressOf, statusOf, type QueueStatus } from "@/lib/rounds/queue";
import type { RoundScreenshotView } from "@/lib/rounds/types";
import { compressForStorage, makeWorkingImage, type WorkingImage } from "@/lib/rounds/working-image";
import { AutoProcess, canAutoProcess, type AutoItem, type AutoRef, type Source } from "./auto-process";
import { loadDrafts, loadLocateLog, logLocate, removeDrafts, saveDraft, type LocateLogEntry, type StoredDraft } from "./drafts";
import { LOCATE_AT_ONCE, LocateProcess, type LocateItem } from "./locate-process";
import ReviewGrid from "./ReviewGrid";
import ScreenshotWorkspace, { type Bbox } from "./ScreenshotWorkspace";
import { api, send } from "./rounds-api";

// Working through a round's screenshots: every screenshot listed with its
// name, its own date and how far it has got (To do, Lined up, Traced, Saved,
// Skipped, Ready for review, Needs line-up), the progress, and the one in
// hand in the workspace, with Skip and Save and next. Only that one is held
// at full size; the others are just their files, read when their turn comes.
// Each is saved as soon as it is done, and the next opens on the map where
// the last one was. Once one is lined up, "Auto-process the rest" lines up
// and traces the others in a background worker, one at a time, matching each
// to the nearest lined up; those it places wait, in this browser, for review
// (accept, open to fix, or skip), and those it can't are left to do by hand.
// "Locate and trace all" needs no screenshot lined up first: each is placed
// from its street names (Claude reads them on the server), a few at a time,
// with the running cost; those it places wait for review the same way, and
// the rest are then matched to them where they overlap, or left to do by
// hand with the reason.

type Entry = { shot: RoundScreenshotView; file: File | null; status: QueueStatus };
type View = "work" | "review";

type Props = {
  roundId: string;
  shots: RoundScreenshotView[];
  // Files chosen in this browser, by screenshot id.
  files: Map<string, File>;
  startId: string | null;
  focus: Bbox | null;
  storage: boolean;
  // Locate: whether it is set up (the server has its key), and whether the
  // job has Area Planner areas for it to look in.
  locate: { ready: boolean; hasArea: boolean };
  initialView?: View;
  onClose: () => void;
};

const taken = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).format(new Date(iso))
    : "No date in the file";

const CHIP: Record<QueueStatus, string> = {
  todo: "border-gray-300 bg-white text-gray-700",
  lined: "border-blue-200 bg-blue-50 text-blue-900",
  traced: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-900",
  saved: "border-green-200 bg-green-50 text-green-900",
  skipped: "border-amber-200 bg-amber-50 text-amber-900",
  review: "border-violet-200 bg-violet-50 text-violet-900",
  needs: "border-red-200 bg-red-50 text-red-900",
};

// Up to this many lined-up screenshots are handed to the worker to start from.
const START_REFS = 8;

async function storedImage(id: string): Promise<Blob> {
  const res = await fetch(`/api/crm/rounds/screenshots/${id}/image`);
  if (!res.ok) throw new Error("Screenshot not stored. Choose its file to work on it.");
  return res.blob();
}

export default function ScreenshotQueue({ roundId, shots, files, startId, focus, storage, locate, initialView = "work", onClose }: Props) {
  const [entries, setEntries] = useState<Entry[]>(() => shots.map((shot) => ({ shot, file: files.get(shot.id) ?? null, status: statusOf(shot) })));
  const openable = (e: Entry) => !!e.file || e.shot.stored;
  const [current, setCurrent] = useState<number>(() => {
    const start = entries.findIndex((e) => e.shot.id === startId);
    if (start >= 0 && openable(entries[start])) return start;
    return nextToDo(
      entries.map((e) => e.status),
      -1,
      (i) => openable(entries[i])
    );
  });
  const [view, setView] = useState<View>(initialView);
  const [drafts, setDrafts] = useState<Map<string, StoredDraft>>(() => new Map());
  // The drafts as of now (state is only as of the last render), for a pass
  // that follows another within one click.
  const draftsNow = useRef(drafts);
  const [locateLog, setLocateLog] = useState<Map<string, LocateLogEntry>>(() => new Map());
  const [locating, setLocating] = useState<{ done: number; total: number; active: number; placed: number; missed: number; costUsd: number; seconds: number; calls: number; stopping: boolean } | null>(null);
  const [locateSummary, setLocateSummary] = useState<string | null>(null);
  const locator = useRef<LocateProcess | null>(null);
  const [fixing, setFixing] = useState<string | null>(null);
  const [auto, setAuto] = useState<{ done: number; total: number; name: string | null; placed: number; missed: number } | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [image, setImage] = useState<(WorkingImage & { forId: string }) | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Where the last screenshot was on the map, for the next one to open there.
  const [where, setWhere] = useState<Bbox | null>(null);
  const latest = useRef(entries);
  latest.current = entries;
  const listRef = useRef<HTMLOListElement>(null);
  const processor = useRef<AutoProcess | null>(null);

  // Drafts already waiting in this browser for this round.
  useEffect(() => {
    let live = true;
    loadLocateLog(roundId).then((log) => {
      if (live && log.length) setLocateLog(new Map(log.map((e) => [e.id, e])));
    });
    loadDrafts(roundId).then((found) => {
      if (!live || found.length === 0) return;
      const byId = new Map(found.map((d) => [d.id, d]));
      draftsNow.current = byId;
      setDrafts(byId);
      const next = latest.current.map((e) => (byId.has(e.shot.id) && e.status !== "saved" ? { ...e, status: "review" as QueueStatus } : e));
      latest.current = next;
      setEntries(next);
    });
    return () => {
      live = false;
      processor.current?.stop();
      locator.current?.stop();
    };
  }, [roundId]);

  const progress = useMemo(() => progressOf(entries.map((e) => e.status)), [entries]);
  const currentId = view === "work" && current >= 0 ? entries[current]?.shot.id : null;

  // Only the one in hand is read at full size; the last one is let go.
  useEffect(() => {
    if (!currentId) return;
    const entry = latest.current.find((e) => e.shot.id === currentId)!;
    let live = true;
    let url: string | null = null;
    setImage(null);
    setLoadError(null);
    (async () => {
      try {
        const source = entry.file ?? (entry.shot.stored ? await storedImage(entry.shot.id) : null);
        if (!source) throw new Error("Choose this screenshot's file to work on it.");
        const made = await makeWorkingImage(source);
        url = made.url;
        if (!live) return URL.revokeObjectURL(made.url);
        if (entry.shot.sha256 && made.sha256 !== entry.shot.sha256) throw new Error("That file isn't this screenshot (its fingerprint is different).");
        if (made.width !== entry.shot.width || made.height !== entry.shot.height) throw new Error("That file is a different size from this screenshot.");
        setImage({ ...made, forId: entry.shot.id });
        // Kept only where file storage is switched on.
        if (storage && entry.file && !entry.shot.stored) {
          const res = await fetch(`/api/crm/rounds/screenshots/${entry.shot.id}/image`, { method: "PUT", body: await compressForStorage(made), headers: { "x-source-sha256": made.sha256 } });
          if (res.ok) setEntries((all) => all.map((e) => (e.shot.id === entry.shot.id ? { ...e, shot: { ...e.shot, stored: true } } : e)));
          else if (live) setNotice("This screenshot couldn't be stored; its traced line is still saved.");
        }
      } catch (e) {
        if (url) URL.revokeObjectURL(url);
        url = null;
        if (live) setLoadError((e as Error).message);
      }
    })();
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [currentId, storage]);

  // Keep the one in hand in view in the list.
  useEffect(() => {
    listRef.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: "nearest" });
  }, [current]);

  function update(id: string, change: (e: Entry) => Entry): Entry[] {
    const next = latest.current.map((e) => (e.shot.id === id ? change(e) : e));
    latest.current = next;
    setEntries(next);
    return next;
  }

  function moveOn(after: Entry[], from: number) {
    setNotice(null);
    setFixing(null);
    setCurrent(
      nextToDo(
        after.map((e) => e.status),
        from,
        (i) => openable(after[i])
      )
    );
  }

  function open(i: number) {
    const e = entries[i];
    if (!openable(e)) return;
    // A skipped one opened again is back to where it had got.
    if (e.status === "skipped") update(e.shot.id, (x) => ({ ...x, status: statusOf(x.shot) }));
    setFixing(e.status === "review" ? e.shot.id : null);
    setView("work");
    setCurrent(i);
  }

  function revisitSkipped() {
    const after = latest.current.map((e) => (e.status === "skipped" ? { ...e, status: statusOf(e.shot) } : e));
    latest.current = after;
    setEntries(after);
    moveOn(after, -1);
  }

  async function forgetDrafts(ids: string[]) {
    await removeDrafts(ids);
    const next = new Map(draftsNow.current);
    for (const id of ids) next.delete(id);
    draftsNow.current = next;
    setDrafts(next);
  }

  // --- Auto-process the rest ------------------------------------------------------------------

  const position = (id: string) => latest.current.findIndex((e) => e.shot.id === id);
  const sourceOf = (e: Entry): Source => e.file ?? (() => storedImage(e.shot.id));
  const lineable = entries.filter((e) => ["todo", "needs", "skipped"].includes(e.status) && openable(e));
  const startingPoints = entries.filter((e) => (e.shot.alignment || drafts.has(e.shot.id)) && openable(e));
  const autoAvailable = canAutoProcess();

  async function autoProcess() {
    const all = latest.current;
    const items: AutoItem[] = all
      .map((e, i) => ({ e, i }))
      .filter(({ e }) => ["todo", "needs", "skipped"].includes(e.status) && openable(e))
      .map(({ e, i }) => ({ id: e.shot.id, position: i, file: sourceOf(e), name: e.shot.originalName ?? `Screenshot ${i + 1}` }));
    // Lined up ones (by hand, or waiting for review) nearest the rest go first.
    const refs: AutoRef[] = [];
    for (const { e, i } of all.map((e, i) => ({ e, i }))) {
      if (!openable(e)) continue;
      const draft = draftsNow.current.get(e.shot.id)?.draft;
      const transform = e.shot.alignment?.transform ?? (draft ? (() => { const s = solveAlignment(draft.pairs, { turnDeg: draft.turnDeg }); return s.ok ? s.alignment.transform : null; })() : null);
      if (!transform) continue;
      refs.push({ id: e.shot.id, position: i, file: sourceOf(e), transform, crop: e.shot.crop ?? draft?.crop ?? null, confidence: draft && !e.shot.alignment ? draft.confidence : 1, depth: draft && !e.shot.alignment ? (draft.depth ?? 3) : e.shot.alignment?.source?.kind === "auto" ? 2 : 0 });
    }
    const gap = (r: AutoRef) => Math.min(...items.map((it) => Math.abs(it.position - r.position)));
    const start = refs.sort((a, b) => gap(a) - gap(b)).slice(0, START_REFS);
    if (!items.length || !start.length) return;
    setNotice(null);
    setAuto({ done: 0, total: items.length, name: null, placed: 0, missed: 0 });
    const run = new AutoProcess();
    processor.current = run;
    let placed = 0;
    let missed = 0;
    try {
      await run.run(start, items, {
        onStart: (item, done, total) => setAuto({ done, total, name: item.name, placed, missed }),
        onResult: (outcome, done, total) => {
          if (outcome.ok) {
            placed++;
            const shot = latest.current[position(outcome.id)]?.shot;
            const stored: StoredDraft = { id: outcome.id, roundId, sha256: shot?.sha256 ?? null, savedAt: new Date().toISOString(), draft: outcome.draft, thumb: outcome.thumb };
            putDraft(stored);
            update(outcome.id, (x) => ({ ...x, status: "review" }));
          } else {
            missed++;
            update(outcome.id, (x) => ({ ...x, status: "needs" }));
          }
          setAuto({ done, total, name: null, placed, missed });
        },
      });
      setNotice(`Auto-processing ${run.wasStopped ? "stopped" : "finished"}: ${placed} lined up and traced for review${missed ? `, ${missed} need lining up by hand` : ""}.`);
      if (placed) setView("review");
    } catch (e) {
      setNotice(`Auto-processing stopped: ${(e as Error).message}`);
    } finally {
      processor.current = null;
      setAuto(null);
    }
  }

  // --- Locate and trace all ------------------------------------------------------------------

  function putDraft(stored: StoredDraft) {
    saveDraft(stored);
    draftsNow.current = new Map(draftsNow.current).set(stored.id, stored);
    setDrafts(draftsNow.current);
  }

  const locateBlocked = !locate.ready
    ? "Locate isn't set up yet"
    : !locate.hasArea
      ? "Add this job's areas in the Area Planner first: Locate only looks for street names there"
      : !autoAvailable
        ? "This browser can't run Locate; use a recent Chrome, Edge, Firefox or Safari"
        : !lineable.length
          ? "Nothing left to locate"
          : null;

  async function locateAll() {
    const items: LocateItem[] = latest.current
      .map((e, i) => ({ e, i }))
      .filter(({ e }) => ["todo", "needs", "skipped"].includes(e.status) && openable(e))
      .map(({ e, i }) => ({ id: e.shot.id, position: i, file: sourceOf(e), name: e.shot.originalName ?? `Screenshot ${i + 1}` }));
    if (!items.length) return;
    setNotice(null);
    setLocateSummary(null);
    const totals = { done: 0, total: items.length, active: 0, placed: 0, missed: 0, costUsd: 0, seconds: 0, calls: 0, stopping: false };
    setLocating({ ...totals });
    const run = new LocateProcess();
    locator.current = run;
    try {
      await run.run(items, {
        onStart: (_item, active) => setLocating((l) => (l ? { ...l, active } : l)),
        onResult: (result, done) => {
          totals.done = done;
          if (result.record) {
            totals.costUsd += result.record.costUsd;
            totals.seconds += result.record.seconds;
            totals.calls++;
          }
          const shot = latest.current[position(result.id)]?.shot;
          if (result.ok) {
            totals.placed++;
            putDraft({ id: result.id, roundId, sha256: shot?.sha256 ?? null, savedAt: new Date().toISOString(), draft: result.draft, thumb: result.thumb });
            update(result.id, (x) => ({ ...x, status: "review" }));
          } else {
            totals.missed++;
            update(result.id, (x) => ({ ...x, status: "needs" }));
          }
          logLocate(roundId, result.id, result.record, result.ok, result.ok ? "Placed" : result.reason).then((entry) => setLocateLog((m) => new Map(m).set(entry.id, entry)));
          setLocating((l) => (l ? { ...totals, active: l.active, stopping: l.stopping } : l));
        },
      });
    } catch (e) {
      setNotice(`Locate stopped: ${(e as Error).message}`);
    } finally {
      locator.current = null;
      setLocating(null);
    }
    if (run.wasNotSetUp) {
      setLocateSummary("Locate isn't set up yet. Nothing was changed: line the screenshots up by hand, or line one up and auto-process the rest.");
      return;
    }
    const each = totals.calls ? ` (about ${formatUsd(totals.costUsd / totals.calls)} and ${Math.round(totals.seconds / totals.calls)} s each)` : "";
    setLocateSummary(
      `Locate ${run.wasStopped ? "stopped" : "finished"}: ${totals.placed} placed for review${totals.missed ? `, ${totals.missed} not placed (the reason is beside each)` : ""}. ${formatUsd(totals.costUsd)} for ${totals.calls} screenshot${totals.calls === 1 ? "" : "s"}${each}.`
    );
    if (totals.placed) setView("review");
    // The rest, matched to the placed ones where they overlap.
    if (!run.wasStopped && totals.missed && totals.placed && autoAvailable) await autoProcess();
  }

  // --- Review ---------------------------------------------------------------------------------

  async function accept(ids: string[]) {
    const items = ids
      .map((id) => ({ id, d: drafts.get(id)?.draft }))
      .filter((x) => x.d)
      .map(({ id, d }) => ({
        id,
        work: {
          crop: d!.crop,
          pairs: d!.pairs,
          turnDeg: d!.turnDeg,
          source: d!.source,
          locate: d!.locate ?? locateLog.get(id)?.record ?? undefined,
          route: d!.lines.length ? d!.lines : null,
          markers: d!.markers.start || d!.markers.end ? d!.markers : null,
        },
      }));
    if (!items.length) return;
    setAccepting(true);
    setNotice(null);
    try {
      // All in one request; the round's figures are worked out once.
      const res = await api<{ shots: RoundScreenshotView[] }>(`/api/crm/rounds/${roundId}/screenshots`, send("PATCH", { items }));
      for (const shot of res.shots) update(shot.id, (x) => ({ ...x, shot, status: statusOf(shot) }));
      await forgetDrafts(res.shots.map((s) => s.id));
      setNotice(`${res.shots.length} accepted and saved.`);
    } catch (e) {
      setNotice(`Not saved: ${(e as Error).message}`);
    } finally {
      setAccepting(false);
    }
  }

  async function skipDraft(id: string) {
    await forgetDrafts([id]);
    update(id, (x) => ({ ...x, status: "skipped" }));
  }

  const reviewItems = entries
    .map((e, index) => ({ e, index }))
    .filter(({ e }) => e.status === "review" && drafts.has(e.shot.id))
    .map(({ e, index }) => {
      const stored = drafts.get(e.shot.id)!;
      const from = stored.draft.source.kind === "auto" ? stored.draft.source.from : null;
      const fromIndex = from ? entries.findIndex((x) => x.shot.id === from) : -1;
      return { index, shot: e.shot, stored, canOpen: openable(e), fromIndex: fromIndex >= 0 ? fromIndex : null };
    });

  const entry = current >= 0 ? entries[current] : null;
  const fixDraft = entry && (fixing === entry.shot.id || entry.status === "review") ? (drafts.get(entry.shot.id)?.draft ?? null) : null;
  const left = entry
    ? nextToDo(
        entries.map((e, i) => (i === current ? "saved" : e.status)),
        current,
        (i) => openable(entries[i])
      )
    : -1;
  // What Locate has cost for this round: spent from this browser, and recorded with saved line-ups.
  const logged = [...locateLog.values()].filter((e) => e.record);
  const recorded = entries.map((e) => e.shot.alignment?.locate).filter((r) => !!r);
  const locateCosts = {
    spent: logged.reduce((sum, e) => sum + e.record!.costUsd, 0),
    spentCount: logged.length,
    recorded: recorded.reduce((sum, r) => sum + r!.costUsd, 0),
    recordedCount: recorded.length,
  };
  const waitingForFiles = entries.filter((e) => !openable(e) && e.status !== "saved" && e.status !== "review").length;

  return (
    <div className="space-y-3">
      <section className="rounded-lg border border-gray-200 bg-white p-3" aria-label="Screenshots to work through">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-blue-900" role="status">
              {progress.label}
            </p>
            <div className="mt-1 h-2 w-full max-w-md overflow-hidden rounded-full bg-gray-100" aria-hidden="true">
              <div className="h-full rounded-full bg-green-600" style={{ width: `${progress.total ? (progress.saved / progress.total) * 100 : 0}%` }} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {!auto && !locating && (
              <button
                type="button"
                onClick={locateAll}
                disabled={!!locateBlocked}
                title={locateBlocked ?? `Places each screenshot from its street names, ${LOCATE_AT_ONCE} at a time. Nothing is saved until you accept.`}
                className="rounded-md bg-blue-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-900 disabled:opacity-50"
              >
                Locate and trace all{lineable.length ? ` (${lineable.length})` : ""}
              </button>
            )}
            {!auto && !locating && (
              <button
                type="button"
                onClick={autoProcess}
                disabled={!autoAvailable || !startingPoints.length || !lineable.length}
                title={
                  !autoAvailable
                    ? "This browser can't auto-process; use a recent Chrome, Edge, Firefox or Safari"
                    : !startingPoints.length
                      ? "Line up one screenshot by hand first; the rest are matched to it"
                      : !lineable.length
                        ? "Nothing left to auto-process"
                        : undefined
                }
                className="rounded-md bg-violet-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-50"
              >
                Auto-process the rest{lineable.length ? ` (${lineable.length})` : ""}
              </button>
            )}
            {view === "work" ? (
              reviewItems.length > 0 && (
                <button type="button" onClick={() => setView("review")} className="rounded-md border border-violet-300 px-3 py-1.5 text-sm font-semibold text-violet-900 hover:bg-violet-50">
                  Review automatic line-ups ({reviewItems.length})
                </button>
              )
            ) : (
              <button type="button" onClick={() => setView("work")} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-800 hover:bg-gray-50">
                Back to working through
              </button>
            )}
            <button type="button" onClick={onClose} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-800 hover:bg-gray-50">
              Back to the round
            </button>
          </div>
        </div>
        {!startingPoints.length && lineable.length > 1 && (
          <p className="mt-2 text-xs text-gray-600">
            {locate.ready && locate.hasArea ? "\"Locate and trace all\" places each screenshot from its street names. Or line" : "Line"} up one screenshot by hand, then &quot;Auto-process the rest&quot; matches the others to it.
          </p>
        )}
        {!locate.ready && (
          <p className="mt-1 text-xs text-gray-600" role="note">
            Locate isn&apos;t set up yet.
          </p>
        )}
        {locate.ready && !locate.hasArea && lineable.length > 0 && (
          <p className="mt-1 text-xs text-gray-600" role="note">
            Locate needs this job&apos;s areas in the Area Planner, so it knows where to look.
          </p>
        )}
        {locating && (
          <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 p-2 text-sm" role="status" aria-label="Locating">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-blue-900">
                Locating: {locating.done} of {locating.total} done{locating.active ? `, ${locating.active} in progress` : ""}
              </p>
              <button
                type="button"
                disabled={locating.stopping}
                onClick={() => {
                  locator.current?.stop();
                  setLocating((l) => (l ? { ...l, stopping: true } : l));
                }}
                className="rounded-md border border-blue-300 bg-white px-2.5 py-1 text-xs font-semibold text-blue-900 hover:bg-blue-100 disabled:opacity-50"
              >
                {locating.stopping ? "Stopping..." : "Stop"}
              </button>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-white" aria-hidden="true">
              <div className="h-full rounded-full bg-blue-700" style={{ width: `${(locating.done / locating.total) * 100}%` }} />
            </div>
            <p className="mt-1 text-xs text-blue-900" aria-label="Running cost">
              {locating.placed} placed for review{locating.missed ? `, ${locating.missed} not placed` : ""}. Running cost {formatUsd(locating.costUsd)}
              {locating.calls ? ` for ${locating.calls} (about ${formatUsd(locating.costUsd / locating.calls)} and ${Math.round(locating.seconds / locating.calls)} s each)` : ""}. {LOCATE_AT_ONCE} at a time
              {locating.stopping ? "; stopping once the ones in progress are done" : ""}.
            </p>
          </div>
        )}
        {locateSummary && (
          <p className="mt-2 text-sm text-blue-900" role="status">
            {locateSummary}
          </p>
        )}
        {locateCosts.spent > 0 || locateCosts.recorded > 0 ? (
          <p className="mt-1 text-xs text-gray-600">
            Locate for this round: {formatUsd(locateCosts.spent)} spent in this browser on {locateCosts.spentCount} screenshot{locateCosts.spentCount === 1 ? "" : "s"}; {formatUsd(locateCosts.recorded)} recorded with{" "}
            {locateCosts.recordedCount} saved line-up{locateCosts.recordedCount === 1 ? "" : "s"}.
          </p>
        ) : null}
        {auto && (
          <div className="mt-3 rounded-md border border-violet-200 bg-violet-50 p-2 text-sm" role="status" aria-label="Auto-processing">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-violet-900">
                Auto-processing {Math.min(auto.done + 1, auto.total)} of {auto.total}
                {auto.name ? `: ${auto.name}` : ""}
              </p>
              <button type="button" onClick={() => processor.current?.stop()} className="rounded-md border border-violet-300 bg-white px-2.5 py-1 text-xs font-semibold text-violet-900 hover:bg-violet-100">
                Stop
              </button>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-white" aria-hidden="true">
              <div className="h-full rounded-full bg-violet-600" style={{ width: `${(auto.done / auto.total) * 100}%` }} />
            </div>
            <p className="mt-1 text-xs text-violet-900">
              {auto.placed} lined up for review{auto.missed ? `, ${auto.missed} to do by hand` : ""}. One screenshot is read at a time, in the background.
            </p>
          </div>
        )}
        <ol ref={listRef} className="mt-3 max-h-48 divide-y divide-gray-100 overflow-y-auto rounded-md border border-gray-100 text-sm" aria-label="Screenshots">
          {entries.map((e, i) => (
            <li key={e.shot.id} aria-current={view === "work" && i === current ? "true" : undefined} className={view === "work" && i === current ? "bg-blue-50" : undefined}>
              <button
                type="button"
                onClick={() => open(i)}
                disabled={!openable(e) || (view === "work" && i === current) || !!auto || !!locating}
                className="flex w-full items-center gap-2 px-2 py-1.5 text-left enabled:hover:bg-gray-50 disabled:cursor-default"
              >
                <span className="w-7 shrink-0 text-right tabular-nums text-gray-500">{i + 1}.</span>
                <span className="min-w-0 flex-1 truncate font-medium text-gray-900" title={e.shot.originalName ?? undefined}>
                  {e.shot.originalName ?? "Screenshot"}
                </span>
                <span className="hidden shrink-0 text-xs text-gray-500 sm:inline">{taken(e.shot.takenAt)}</span>
                {!openable(e) && e.status !== "saved" && e.status !== "review" && <span className="shrink-0 text-xs text-gray-500">file not chosen</span>}
                {e.status === "needs" && locateLog.get(e.shot.id)?.placed === false && (
                  <span className="hidden min-w-0 max-w-[45%] truncate text-xs text-red-800 md:inline" title={locateLog.get(e.shot.id)!.reason}>
                    {locateLog.get(e.shot.id)!.reason}
                  </span>
                )}
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold ${CHIP[e.status]}`}>{STATUS_LABELS[e.status]}</span>
              </button>
            </li>
          ))}
        </ol>
        {waitingForFiles > 0 && (
          <p className="mt-2 text-xs text-gray-600">
            {waitingForFiles} not saved yet whose file isn&apos;t chosen here. Choose the screenshot files again from the round to carry on with them.
          </p>
        )}
      </section>

      {notice && (
        <p className="text-sm text-violet-900" role="status">
          {notice}
        </p>
      )}

      {view === "review" ? (
        <ReviewGrid
          items={reviewItems}
          busy={accepting || !!auto || !!locating}
          onAccept={accept}
          onOpen={(id) => {
            const i = entries.findIndex((e) => e.shot.id === id);
            if (i >= 0) open(i);
          }}
          onSkip={skipDraft}
        />
      ) : auto || locating ? (
        <p className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600">The automatic line-ups appear for review as they are done.</p>
      ) : entry ? (
        loadError ? (
          <div className="space-y-2 rounded-lg border border-red-200 bg-white p-4 text-sm">
            <p className="text-red-700" role="alert">
              {entry.shot.originalName ?? "This screenshot"}: {loadError}
            </p>
            <button
              type="button"
              onClick={() => {
                const after = update(entry.shot.id, (x) => ({ ...x, status: x.status === "saved" ? "saved" : "skipped" }));
                moveOn(after, current);
              }}
              className="rounded-md border border-gray-300 px-3 py-1.5 font-semibold text-gray-800 hover:bg-gray-50"
            >
              Skip it
            </button>
          </div>
        ) : image && image.forId === entry.shot.id ? (
          <ScreenshotWorkspace
            key={`${entry.shot.id}${fixDraft ? "-draft" : ""}`}
            shot={entry.shot}
            image={image}
            index={current}
            total={entries.length}
            focus={fixDraft ? footprintBox(fixDraft.footprint) : (where ?? focus)}
            draft={fixDraft}
            locate={fixDraft?.locate ?? locateLog.get(entry.shot.id)?.record ?? null}
            onProgress={(status, shot) => update(entry.shot.id, (x) => ({ ...x, shot: shot ?? x.shot, status }))}
            onSaved={(shot, at) => {
              if (at) setWhere(at);
              if (drafts.has(shot.id)) forgetDrafts([shot.id]);
              const after = update(entry.shot.id, (x) => ({ ...x, shot, status: statusOf(shot) }));
              moveOn(after, current);
            }}
            onSkip={(at) => {
              if (at) setWhere(at);
              const after = update(entry.shot.id, (x) => ({ ...x, status: x.status === "saved" || x.status === "review" ? x.status : "skipped" }));
              moveOn(after, current);
            }}
            skipLabel="Skip"
            saveLabel={left >= 0 ? "Save and next" : "Save"}
          />
        ) : (
          <p className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600" role="status">
            Reading {entry.shot.originalName ?? "the screenshot"}...
          </p>
        )
      ) : (
        <section className="space-y-3 rounded-lg border border-green-200 bg-white p-4 text-sm" aria-label="Finished">
          <p className="font-semibold text-green-900">
            {progress.saved === progress.total ? "Every screenshot is saved." : `Nothing left to work on here: ${progress.label}.`}
          </p>
          <div className="flex flex-wrap gap-2">
            {reviewItems.length > 0 && (
              <button type="button" onClick={() => setView("review")} className="rounded-md bg-violet-700 px-3 py-1.5 font-semibold text-white hover:bg-violet-800">
                Review automatic line-ups ({reviewItems.length})
              </button>
            )}
            {progress.skipped > 0 && (
              <button type="button" onClick={revisitSkipped} className="rounded-md border border-gray-300 px-3 py-1.5 font-semibold text-gray-800 hover:bg-gray-50">
                Go back to the skipped ones
              </button>
            )}
            <button type="button" onClick={onClose} className="rounded-md bg-blue-900 px-3 py-1.5 font-semibold text-white hover:bg-blue-800">
              Back to the round
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function footprintBox(points: [number, number][]): Bbox {
  return [Math.min(...points.map((p) => p[0])), Math.min(...points.map((p) => p[1])), Math.max(...points.map((p) => p[0])), Math.max(...points.map((p) => p[1]))];
}
