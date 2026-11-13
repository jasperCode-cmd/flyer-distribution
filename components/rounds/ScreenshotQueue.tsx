"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { STATUS_LABELS, nextToDo, progressOf, statusOf, type QueueStatus } from "@/lib/rounds/queue";
import type { RoundScreenshotView } from "@/lib/rounds/types";
import { compressForStorage, makeWorkingImage, type WorkingImage } from "@/lib/rounds/working-image";
import ScreenshotWorkspace, { type Bbox } from "./ScreenshotWorkspace";

// Working through a round's screenshots one at a time: every screenshot
// listed with its name, its own date and how far it has got (To do, Lined
// up, Traced, Saved, Skipped), the progress, and the one in hand in the
// workspace, with Skip and Save and next. Only that one is held at full
// size; the others are just their files, read when their turn comes. Each
// is saved as soon as it is done, and the next opens on the map where the
// last one was. A screenshot whose file isn't to hand here (and isn't
// stored) is listed but can't be opened until its file is chosen.

type Entry = { shot: RoundScreenshotView; file: File | null; status: QueueStatus };

type Props = {
  shots: RoundScreenshotView[];
  // Files chosen in this browser, by screenshot id.
  files: Map<string, File>;
  startId: string | null;
  focus: Bbox | null;
  storage: boolean;
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
};

async function storedImage(id: string): Promise<Blob> {
  const res = await fetch(`/api/crm/rounds/screenshots/${id}/image`);
  if (!res.ok) throw new Error("Screenshot not stored. Choose its file to work on it.");
  return res.blob();
}

export default function ScreenshotQueue({ shots, files, startId, focus, storage, onClose }: Props) {
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
  const [image, setImage] = useState<(WorkingImage & { forId: string }) | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Where the last screenshot was on the map, for the next one to open there.
  const [where, setWhere] = useState<Bbox | null>(null);
  const latest = useRef(entries);
  latest.current = entries;
  const listRef = useRef<HTMLOListElement>(null);

  const progress = useMemo(() => progressOf(entries.map((e) => e.status)), [entries]);
  const currentId = current >= 0 ? entries[current]?.shot.id : null;

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
    setCurrent(i);
  }

  function revisitSkipped() {
    const after = latest.current.map((e) => (e.status === "skipped" ? { ...e, status: statusOf(e.shot) } : e));
    latest.current = after;
    setEntries(after);
    moveOn(after, -1);
  }

  const entry = current >= 0 ? entries[current] : null;
  const left = entry
    ? nextToDo(
        entries.map((e, i) => (i === current ? "saved" : e.status)),
        current,
        (i) => openable(entries[i])
      )
    : -1;
  const waitingForFiles = entries.filter((e) => !openable(e) && e.status !== "saved").length;

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
          <button type="button" onClick={onClose} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-800 hover:bg-gray-50">
            Back to the round
          </button>
        </div>
        <ol ref={listRef} className="mt-3 max-h-48 divide-y divide-gray-100 overflow-y-auto rounded-md border border-gray-100 text-sm" aria-label="Screenshots">
          {entries.map((e, i) => (
            <li key={e.shot.id} aria-current={i === current ? "true" : undefined} className={i === current ? "bg-blue-50" : undefined}>
              <button
                type="button"
                onClick={() => open(i)}
                disabled={!openable(e) || i === current}
                className="flex w-full items-center gap-2 px-2 py-1.5 text-left enabled:hover:bg-gray-50 disabled:cursor-default"
              >
                <span className="w-7 shrink-0 text-right tabular-nums text-gray-500">{i + 1}.</span>
                <span className="min-w-0 flex-1 truncate font-medium text-gray-900" title={e.shot.originalName ?? undefined}>
                  {e.shot.originalName ?? "Screenshot"}
                </span>
                <span className="hidden shrink-0 text-xs text-gray-500 sm:inline">{taken(e.shot.takenAt)}</span>
                {!openable(e) && e.status !== "saved" && <span className="shrink-0 text-xs text-gray-500">file not chosen</span>}
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
        <p className="text-sm text-amber-800" role="status">
          {notice}
        </p>
      )}

      {entry ? (
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
            key={entry.shot.id}
            shot={entry.shot}
            image={image}
            index={current}
            total={entries.length}
            focus={where ?? focus}
            onProgress={(status, shot) => update(entry.shot.id, (x) => ({ ...x, shot: shot ?? x.shot, status }))}
            onSaved={(shot, at) => {
              if (at) setWhere(at);
              const after = update(entry.shot.id, (x) => ({ ...x, shot, status: statusOf(shot) }));
              moveOn(after, current);
            }}
            onSkip={(at) => {
              if (at) setWhere(at);
              const after = update(entry.shot.id, (x) => ({ ...x, status: x.status === "saved" ? "saved" : "skipped" }));
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
