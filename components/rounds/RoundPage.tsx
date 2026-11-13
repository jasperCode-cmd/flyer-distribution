"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import BusinessBadge from "@/components/crm/BusinessBadge";
import { UNASSIGNED_COLOUR } from "@/lib/area-planner/colours";
import { dateLabel, formatDistance } from "@/lib/rounds/format";
import { imageTimeInstant, readImageTime } from "@/lib/rounds/exif";
import type { RoundDetail, RoundOptions, RoundScreenshotView } from "@/lib/rounds/types";
import { compressForStorage, makeWorkingImage } from "@/lib/rounds/working-image";
import ScreenshotWorkspace, { type WorkImage } from "./ScreenshotWorkspace";
import ShareLinks from "./ShareLinks";
import { api, send, ukDate } from "./rounds-api";

const RoundMap = dynamic(() => import("./RoundMap"), { ssr: false, loading: () => <div className="h-[50vh] min-h-72 w-full animate-pulse rounded-lg bg-gray-100" /> });

// One round in the CRM: its details (which can be changed), the distance
// and postcode sectors worked out from its lines, the full lines on a map,
// each screenshot's state ("Screenshot not stored" until storage is on),
// lining up a screenshot again from its file, adding screenshots, sharing
// with the client, and deleting the round.

type Detail = RoundDetail & { focus: [number, number, number, number] | null };
type Working = { shot: RoundScreenshotView; image: WorkImage; queue: { shot: RoundScreenshotView; image: WorkImage }[] };

const when = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).format(new Date(iso));

function status(s: RoundScreenshotView): string {
  if (s.routeLengthM !== null) return `Traced, ${formatDistance(s.routeLengthM)}`;
  if (s.alignment) return "Lined up, not traced";
  return "Not lined up yet";
}

export default function RoundPage({ id }: { id: string }) {
  const router = useRouter();
  const [round, setRound] = useState<Detail | null>(null);
  const [options, setOptions] = useState<RoundOptions | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [working, setWorking] = useState<Working | null>(null);
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

  // Lining a screenshot up again: from the stored image, or from its file
  // picked again (checked to be the same file by its fingerprint).
  async function reopen(shot: RoundScreenshotView, file: File | null) {
    setError(null);
    try {
      if (file) {
        const image = await makeWorkingImage(file);
        if (shot.sha256 && image.sha256 !== shot.sha256) {
          setError("That isn't the same screenshot file as the one this was traced from.");
          return;
        }
        if (image.width !== shot.width || image.height !== shot.height) {
          setError("That screenshot is a different size from the one this was traced from.");
          return;
        }
        setWorking({ shot, image, queue: [] });
      } else {
        const res = await fetch(`/api/crm/rounds/screenshots/${shot.id}/image`);
        if (!res.ok) throw new Error("Screenshot not stored.");
        setWorking({ shot, image: await makeWorkingImage(await res.blob()), queue: [] });
      }
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

  async function addShots(files: FileList | null) {
    if (!files?.length || !round) return;
    setError(null);
    try {
      const picked: { file: File; image: Awaited<ReturnType<typeof makeWorkingImage>>; time: ReturnType<typeof readImageTime> }[] = [];
      for (const file of [...files]) {
        const image = await makeWorkingImage(file);
        const time = readImageTime(new Uint8Array(await file.arrayBuffer()));
        picked.push({ file, image, time });
      }
      const made = await api<{ screenshotIds: string[] }>(
        `/api/crm/rounds/${id}/screenshots`,
        send("POST", {
          screenshots: picked.map((p) => ({ width: p.image.width, height: p.image.height, sha256: p.image.sha256, originalName: p.file.name, takenAt: p.time ? imageTimeInstant(p.time).toISOString() : null })),
        })
      );
      if (options?.storage) {
        for (const [i, sid] of made.screenshotIds.entries()) {
          await fetch(`/api/crm/rounds/screenshots/${sid}/image`, { method: "PUT", body: await compressForStorage(picked[i].image), headers: { "x-source-sha256": picked[i].image.sha256 } });
        }
      }
      const fresh = await api<Detail>(`/api/crm/rounds/${id}`);
      setRound(fresh);
      const queue = made.screenshotIds.map((sid, i) => ({ shot: fresh.shots.find((s) => s.id === sid)!, image: picked[i].image }));
      setWorking({ ...queue[0], queue: queue.slice(1) });
    } catch (e) {
      setError((e as Error).message);
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

  if (working) {
    const position = round.shots.findIndex((s) => s.id === working.shot.id);
    const finish = async () => {
      const [next, ...rest] = working.queue;
      if (next) setWorking({ ...next, queue: rest });
      else {
        setWorking(null);
        await load();
      }
    };
    return (
      <ScreenshotWorkspace
        key={working.shot.id}
        shot={working.shot}
        image={working.image}
        index={position}
        total={round.shots.length}
        focus={round.focus}
        onSaved={finish}
        onSkip={finish}
        skipLabel="Back to the round"
      />
    );
  }

  const colour = round.distributor?.colour ?? UNASSIGNED_COLOUR;
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
              {round.distributor?.name ?? "No distributor"}
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
              <option value="">Not set</option>
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
          <h2 className="text-sm font-bold text-blue-900">Screenshots</h2>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-blue-700 px-3 py-1.5 text-sm font-semibold text-blue-800 hover:bg-blue-50">
            Add screenshots
            <input type="file" accept="image/png,image/jpeg,image/webp" multiple className="sr-only" onChange={(e) => addShots(e.target.files)} />
          </label>
        </div>
        <ul className="mt-3 divide-y divide-gray-100">
          {round.shots.map((s, i) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0 text-sm">
                <p className="font-medium text-gray-900">
                  {i + 1}. {s.originalName ?? "Screenshot"} <span className="font-normal text-gray-500">({s.width} by {s.height})</span>
                </p>
                <p className="text-gray-600">
                  {status(s)}
                  {s.takenAt ? ` · taken ${when(s.takenAt)}` : ""}
                </p>
                {!s.stored && <p className="mt-0.5 inline-block rounded bg-amber-50 px-1.5 py-0.5 text-xs font-semibold text-amber-900">Screenshot not stored</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                {s.stored ? (
                  <button type="button" onClick={() => reopen(s, null)} className="rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-50">
                    Line up and trace
                  </button>
                ) : (
                  <label className="cursor-pointer rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-50">
                    Line up and trace (choose the file)
                    <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => e.target.files?.[0] && reopen(s, e.target.files[0])} />
                  </label>
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
