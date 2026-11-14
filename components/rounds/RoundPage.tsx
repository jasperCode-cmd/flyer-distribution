"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import BusinessBadge from "@/components/crm/BusinessBadge";
import { NOT_SPECIFIED, dateLabel, distributorColour, distributorName, formatDistance } from "@/lib/rounds/format";
import { imageTimeInstant } from "@/lib/rounds/exif";
import { STATUS_LABELS, planFiles, progressOf, statusOf } from "@/lib/rounds/queue";
import type { RoundDetail, RoundOptions, RoundScreenshotView } from "@/lib/rounds/types";
import { MAX_SCREENSHOTS } from "@/lib/rounds/validate";
import { compressForStorage, makeWorkingImage, readAllFacts } from "@/lib/rounds/working-image";
import { loadDrafts } from "./drafts";
import { clearHandedOver, handedOver } from "./pending-files";
import ScreenshotQueue from "./ScreenshotQueue";
import ShareLinks from "./ShareLinks";
import { api, send, ukDate } from "./rounds-api";

const RoundMap = dynamic(() => import("./RoundMap"), { ssr: false, loading: () => <div className="h-[50vh] min-h-72 w-full animate-pulse rounded-lg bg-gray-100" /> });

// One round in the CRM: its details (which can be changed), the distance
// and postcode sectors worked out from its lines, the full lines on a map,
// each screenshot's state (To do, Lined up or Saved, and "Screenshot not
// stored" until storage is on) with the progress, choosing screenshot files
// to work through (the round's own are recognised by their fingerprint, so
// choosing the same files again carries on; new ones are added, all in one
// request), sharing with the client, and deleting the round.

type Detail = RoundDetail & { focus: [number, number, number, number] | null };
type Queue = { startId: string | null; view?: "work" | "review" };

const when = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).format(new Date(iso));

function status(s: RoundScreenshotView, review: boolean): string {
  const st = statusOf(s);
  if (st !== "saved" && review) return STATUS_LABELS.review;
  return st === "saved" ? `${STATUS_LABELS.saved}, ${formatDistance(s.routeLengthM)}` : STATUS_LABELS[st];
}

export default function RoundPage({ id }: { id: string }) {
  const router = useRouter();
  const [round, setRound] = useState<Detail | null>(null);
  const [options, setOptions] = useState<RoundOptions | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [queue, setQueue] = useState<Queue | null>(null);
  // Screenshot files chosen in this visit, by screenshot id (only ever held
  // as files; each is read in full only when its turn comes).
  const [chosen, setChosen] = useState<Map<string, File>>(() => new Map());
  const [reading, setReading] = useState<{ done: number; total: number } | null>(null);
  // Automatic line-ups waiting for review in this browser.
  const [waiting, setWaiting] = useState<Set<string>>(() => new Set());
  const [form, setForm] = useState({ jobKey: "", distributorId: "", date: "", notes: "" });

  const load = useCallback(async () => {
    try {
      setRound(await api<Detail>(`/api/crm/rounds/${id}`));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    load();
    api<RoundOptions>("/api/crm/rounds/options").then(setOptions).catch(() => {});
  }, [load]);

  useEffect(() => {
    if (queue) return;
    let live = true;
    loadDrafts(id).then((d) => live && setWaiting(new Set(d.map((x) => x.id))));
    return () => {
      live = false;
    };
  }, [id, queue]);

  // Straight from adding the round: its files were handed over, so the work
  // goes on here at once.
  useEffect(() => {
    if (!round) return;
    const handed = handedOver(id);
    if (!handed) return;
    clearHandedOver(id);
    const bySha = new Map(round.shots.filter((s) => s.sha256).map((s) => [s.sha256!, s.id]));
    const files = new Map<string, File>();
    for (const h of handed) {
      const sid = bySha.get(h.sha256);
      if (sid) files.set(sid, h.file);
    }
    setChosen(files);
    setQueue({ startId: null });
  }, [round, id]);

  const lines = useMemo(() => round?.shots.flatMap((s) => s.route ?? []) ?? [], [round]);
  const markers = useMemo(() => round?.shots.map((s) => s.markers ?? {}) ?? [], [round]);

  if (error && !round) return <p className="text-sm text-red-700">{error}</p>;
  if (!round) return <p className="text-sm text-gray-500">Loading the round...</p>;

  function startEditing() {
    if (!round) return;
    const key = round.project ? `project:${round.project.id}` : round.lead ? `lead:${round.lead.id}` : "";
    setForm({ jobKey: key, distributorId: round.distributor?.id ?? "", date: round.date, notes: round.notes ?? "" });
    setEditing(true);
  }

  async function saveDetails() {
    const job = options?.jobs.find((j) => j.key === form.jobKey);
    try {
      setRound(
        await api<Detail>(
          `/api/crm/rounds/${id}`,
          send("PATCH", {
            leadId: job?.leadId ?? null,
            projectId: job?.projectId ?? null,
            ...(job ? {} : { business: round!.business }),
            distributorId: form.distributorId || null,
            date: form.date,
            notes: form.notes,
          })
        )
      );
      setEditing(false);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function attach(shot: RoundScreenshotView, file: File) {
    setError(null);
    try {
      const image = await makeWorkingImage(file);
      if (shot.sha256 && image.sha256 !== shot.sha256) throw new Error("That isn't the same screenshot file as the one this was traced from.");
      const res = await fetch(`/api/crm/rounds/screenshots/${shot.id}/image`, { method: "PUT", body: await compressForStorage(image), headers: { "x-source-sha256": image.sha256 } });
      if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "The screenshot couldn't be attached.");
      setNotice("Screenshot attached.");
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  // Choosing screenshot files: read one at a time; any the round already
  // has are recognised by their fingerprint (so its saved ones stay as they
  // are), and new ones are added together in one request. Then work
  // through them, starting from the first not yet saved.
  async function choose(list: FileList | null) {
    if (!list?.length || !round) return;
    setError(null);
    setNotice(null);
    const picked = [...list];
    setReading({ done: 0, total: picked.length });
    try {
      const { read, unreadable } = await readAllFacts(picked, (done) => setReading({ done, total: picked.length }));
      const plan = planFiles(
        read.map((r) => r.facts),
        round.shots,
        MAX_SCREENSHOTS
      );
      const files = new Map(chosen);
      for (const m of plan.matched) files.set(m.shotId, read[m.file].file);
      let fresh = round;
      if (plan.fresh.length) {
        const made = await api<{ screenshotIds: string[] }>(
          `/api/crm/rounds/${id}/screenshots`,
          send("POST", {
            screenshots: plan.fresh.map((i) => ({
              width: read[i].facts.width,
              height: read[i].facts.height,
              sha256: read[i].facts.sha256,
              originalName: read[i].file.name,
              takenAt: read[i].facts.time ? imageTimeInstant(read[i].facts.time!).toISOString() : null,
            })),
          })
        );
        made.screenshotIds.forEach((sid, k) => files.set(sid, read[plan.fresh[k]].file));
        fresh = await api<Detail>(`/api/crm/rounds/${id}`);
        setRound(fresh);
      }
      setChosen(files);
      const notes = [
        plan.matched.length ? `${plan.matched.length} already in this round` : "",
        plan.fresh.length ? `${plan.fresh.length} added` : "",
        plan.repeats ? `${plan.repeats} chosen twice` : "",
        plan.overLimit ? `${plan.overLimit} left out: a round can have at most ${MAX_SCREENSHOTS}` : "",
        unreadable.length ? `${unreadable.length} not readable as images (${unreadable.slice(0, 3).join(", ")}${unreadable.length > 3 ? "..." : ""})` : "",
      ].filter(Boolean);
      setNotice(notes.join("; ") + ".");
      const first = fresh.shots.find((s) => files.has(s.id) && statusOf(s) !== "saved");
      setQueue({ startId: first?.id ?? null });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setReading(null);
    }
  }

  async function removeShot(shot: RoundScreenshotView) {
    if (!window.confirm("Remove this screenshot and its traced line from the round?")) return;
    try {
      await api(`/api/crm/rounds/screenshots/${shot.id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function deleteRound() {
    if (!window.confirm("Delete this round, its traced lines and its client links? This can't be undone.")) return;
    try {
      await api(`/api/crm/rounds/${id}`, { method: "DELETE" });
      router.push("/admin/crm/rounds");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (queue) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-500">
          <Link href="/admin/crm/rounds" className="hover:underline">
            Rounds
          </Link>{" "}
          / {dateLabel(new Date(`${round.date}T00:00:00Z`))} / {round.lead ? round.lead.name : round.project ? round.project.name : "Round"}
        </p>
        <ScreenshotQueue
          roundId={round.id}
          initialView={queue.view}
          shots={round.shots}
          files={chosen}
          startId={queue.startId}
          focus={round.focus}
          storage={!!options?.storage}
          onClose={async () => {
            setQueue(null);
            await load();
          }}
        />
      </div>
    );
  }

  const colour = distributorColour(round.distributor);
  const shotStatus = (s: RoundScreenshotView) => (waiting.has(s.id) && statusOf(s) !== "saved" ? "review" : statusOf(s));
  const progress = progressOf(round.shots.map(shotStatus));
  const waitingCount = round.shots.filter((s) => shotStatus(s) === "review").length;
  const canWork = round.shots.some((s) => (chosen.has(s.id) || s.stored) && statusOf(s) !== "saved");
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-gray-500">
            <Link href="/admin/crm/rounds" className="hover:underline">
              Rounds
            </Link>{" "}
            / {dateLabel(new Date(`${round.date}T00:00:00Z`))}
          </p>
          <h1 className="mt-1 flex flex-wrap items-center gap-2 text-xl font-bold text-blue-900">
            {round.lead ? round.lead.name : round.project ? round.project.name : "Round"} <BusinessBadge business={round.business} />
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-700">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: colour }} aria-hidden="true" />
              {distributorName(round.distributor)}
            </span>
            {round.lead && (
              <Link href={`/admin/crm/leads/${round.lead.id}`} className="text-blue-700 hover:underline">
                Lead
              </Link>
            )}
            {round.project && (
              <Link href={`/admin/crm/map?project=${round.project.id}`} className="text-blue-700 hover:underline">
                Area Planner project
              </Link>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={startEditing} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-800 hover:bg-gray-50">
            Edit details
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="text-sm text-green-800" role="status">
          {notice}
        </p>
      )}

      {editing && (
        <section className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 bg-white p-4 md:grid-cols-2" aria-label="Edit details">
          <label className="text-sm md:col-span-2">
            <span className="font-semibold text-gray-800">Job</span>
            <select value={form.jobKey} onChange={(e) => setForm({ ...form, jobKey: e.target.value })} className="mt-1 w-full rounded-md border border-gray-300 px-2 py-2">
              <option value="">No job</option>
              {options?.jobs.map((j) => (
                <option key={j.key} value={j.key}>
                  {j.projectId ? "Project: " : "Lead: "}
                  {j.label} ({j.business})
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="font-semibold text-gray-800">Distributor</span>
            <select value={form.distributorId} onChange={(e) => setForm({ ...form, distributorId: e.target.value })} className="mt-1 w-full rounded-md border border-gray-300 px-2 py-2">
              <option value="">{NOT_SPECIFIED}</option>
              {options?.distributors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                  {d.active ? "" : " (inactive)"}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="font-semibold text-gray-800">Date</span>
            <input type="date" max={ukDate()} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="mt-1 w-full rounded-md border border-gray-300 px-2 py-2" />
          </label>
          <label className="text-sm md:col-span-2">
            <span className="font-semibold text-gray-800">Notes (CRM only)</span>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="mt-1 w-full rounded-md border border-gray-300 px-2 py-2" />
          </label>
          <div className="flex justify-end gap-2 md:col-span-2">
            <button type="button" onClick={() => setEditing(false)} className="rounded-md px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100">
              Cancel
            </button>
            <button type="button" onClick={saveDetails} className="rounded-md bg-blue-900 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">
              Save details
            </button>
          </div>
        </section>
      )}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Summary">
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Distance</p>
          <p className="mt-1 text-xl font-bold text-gray-900">{formatDistance(round.distanceM)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3 sm:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Postcode sectors</p>
          {round.sectors.length ? (
            <p className="mt-2 flex flex-wrap gap-1.5">
              {round.sectors.map((s) => (
                <span key={s.code} className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-900">
                  {s.code} <span className="text-blue-700">· {formatDistance(s.metres)}</span>
                </span>
              ))}
            </p>
          ) : (
            <p className="mt-1 text-sm text-gray-600">Worked out once a screenshot is traced.</p>
          )}
        </div>
      </section>

      {lines.length > 0 && <RoundMap lines={lines} colour={colour} markers={markers} focus={round.focus} />}
      {round.notes && <p className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">Notes: {round.notes}</p>}

      <section className="rounded-lg border border-gray-200 bg-white p-4" aria-label="Screenshots">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-blue-900">Screenshots</h2>
            {round.shots.length > 0 && (
              <p className="text-sm text-gray-700" role="status">
                {progress.label}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canWork && (
              <button type="button" onClick={() => setQueue({ startId: null })} className="rounded-md bg-blue-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-800">
                Carry on
              </button>
            )}
            <label className={`inline-flex items-center gap-2 rounded-md border border-blue-700 px-3 py-1.5 text-sm font-semibold text-blue-800 ${reading ? "opacity-60" : "cursor-pointer hover:bg-blue-50"}`}>
              {reading ? `Reading ${reading.done} of ${reading.total}...` : "Choose screenshots"}
              <input type="file" accept="image/png,image/jpeg,image/webp" multiple className="sr-only" disabled={!!reading} onChange={(e) => choose(e.target.files)} />
            </label>
          </div>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Choose this round&apos;s screenshot files to carry on, or more to add (up to {MAX_SCREENSHOTS} in a round). Ones already here are recognised and keep their saved work.
        </p>
        {waitingCount > 0 && (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-900">
            <span>
              {waitingCount} automatic line-up{waitingCount === 1 ? " is" : "s are"} waiting for review in this browser. Nothing is saved until accepted.
            </span>
            <button type="button" onClick={() => setQueue({ startId: null, view: "review" })} className="rounded-md bg-violet-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-violet-800">
              Review
            </button>
          </div>
        )}
        <ul className="mt-3 divide-y divide-gray-100">
          {round.shots.map((s, i) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
              <div className="min-w-0 text-sm">
                <p className="font-medium text-gray-900">
                  {i + 1}. {s.originalName ?? "Screenshot"} <span className="font-normal text-gray-500">({s.width} by {s.height})</span>
                </p>
                <p className="text-gray-600">
                  {status(s, waiting.has(s.id))}
                  {s.takenAt ? ` · taken ${when(s.takenAt)}` : ""}
                  {chosen.has(s.id) ? " · file chosen" : ""}
                </p>
                {!s.stored && <p className="mt-0.5 inline-block rounded bg-amber-50 px-1.5 py-0.5 text-xs font-semibold text-amber-900">Screenshot not stored</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                {(chosen.has(s.id) || s.stored) && (
                  <button type="button" onClick={() => setQueue({ startId: s.id })} className="rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-50">
                    Line up and trace
                  </button>
                )}
                {!s.stored &&
                  (options?.storage ? (
                    <label className="cursor-pointer rounded-md border border-blue-300 px-2.5 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-50">
                      Attach screenshot
                      <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => e.target.files?.[0] && attach(s, e.target.files[0])} />
                    </label>
                  ) : (
                    <button type="button" disabled title="Screenshot storage isn't switched on yet" className="cursor-not-allowed rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-400">
                      Attach screenshot
                    </button>
                  ))}
                <button type="button" onClick={() => removeShot(s)} className="rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50">
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
        {options && !options.storage && (
          <p className="mt-2 text-xs text-gray-500">Screenshot storage isn&apos;t switched on, so screenshots aren&apos;t kept. &quot;Attach screenshot&quot; works once it is.</p>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4" aria-label="Share with client">
        <h2 className="mb-2 text-sm font-bold text-blue-900">Share with client</h2>
        <ShareLinks scope={{ roundId: round.id }} links={round.links} onChanged={load} />
      </section>

      <section className="rounded-lg border border-red-200 bg-white p-4" aria-label="Delete">
        <button type="button" onClick={deleteRound} className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50">
          Delete this round
        </button>
      </section>
    </div>
  );
}
