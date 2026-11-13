"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import BusinessBadge from "@/components/crm/BusinessBadge";
import type { Business } from "@/lib/business";
import { imageTimeInstant, readImageTime, type ImageTime } from "@/lib/rounds/exif";
import { MAX_SCREENSHOTS } from "@/lib/rounds/validate";
import type { RoundDetail, RoundOptions, RoundScreenshotView } from "@/lib/rounds/types";
import { compressForStorage, makeWorkingImage, type WorkingImage } from "@/lib/rounds/working-image";
import ScreenshotWorkspace from "./ScreenshotWorkspace";
import { api, send, ukDate } from "./rounds-api";

// Adding a round: pick its screenshots (they are read here, in the browser:
// scaled to the working size, fingerprinted, and their own date read where
// they have one), choose the job, the distributor and the date, then line
// up and trace each screenshot in turn. Only the round's details and the
// traced lines are saved; screenshots are kept only once storage is on.

type Picked = { file: File; image: WorkingImage; time: ImageTime | null };

export default function NewRound({ leadId, projectId }: { leadId: string | null; projectId: string | null }) {
  const router = useRouter();
  const [options, setOptions] = useState<RoundOptions | null>(null);
  const [picked, setPicked] = useState<Picked[]>([]);
  const [reading, setReading] = useState(false);
  const [jobKey, setJobKey] = useState("");
  const [business, setBusiness] = useState<Business>("FDH");
  const [distributorId, setDistributorId] = useState("");
  const [date, setDate] = useState("");
  const [dateFromFile, setDateFromFile] = useState(false);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [round, setRound] = useState<(RoundDetail & { focus: [number, number, number, number] | null }) | null>(null);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    api<RoundOptions>("/api/crm/rounds/options")
      .then((o) => {
        setOptions(o);
        const wanted = o.jobs.find((j) => (projectId && j.projectId === projectId) || (!projectId && leadId && j.leadId === leadId && !j.projectId)) ?? o.jobs.find((j) => leadId && j.leadId === leadId);
        if (wanted) {
          setJobKey(wanted.key);
          setBusiness(wanted.business);
        }
      })
      .catch((e) => setError((e as Error).message));
  }, [leadId, projectId]);

  const job = useMemo(() => options?.jobs.find((j) => j.key === jobKey) ?? null, [options, jobKey]);

  async function pick(files: FileList | null) {
    if (!files?.length) return;
    setReading(true);
    setError(null);
    try {
      const add: Picked[] = [];
      for (const file of [...files].slice(0, MAX_SCREENSHOTS - picked.length)) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        add.push({ file, image: await makeWorkingImage(file), time: readImageTime(bytes) });
      }
      const all = [...picked, ...add];
      setPicked(all);
      const dated = all.find((p) => p.time);
      if (dated && (!date || dateFromFile)) {
        setDate(dated.time!.date);
        setDateFromFile(true);
      }
    } catch {
      setError("A file couldn't be read as an image. Use the PNG or JPEG screenshots.");
    } finally {
      setReading(false);
    }
  }

  async function create() {
    setSaving(true);
    setError(null);
    try {
      const made = await api<{ id: string; screenshotIds: string[] }>(
        "/api/crm/rounds",
        send("POST", {
          business: job?.business ?? business,
          leadId: job?.leadId ?? null,
          projectId: job?.projectId ?? null,
          distributorId: distributorId || null,
          date,
          notes,
          screenshots: picked.map((p) => ({
            width: p.image.width,
            height: p.image.height,
            sha256: p.image.sha256,
            originalName: p.file.name,
            takenAt: p.time ? imageTimeInstant(p.time).toISOString() : null,
          })),
        })
      );
      // Kept only where file storage is switched on.
      if (options?.storage) {
        for (const [i, sid] of made.screenshotIds.entries()) {
          const body = await compressForStorage(picked[i].image);
          await fetch(`/api/crm/rounds/screenshots/${sid}/image`, { method: "PUT", body, headers: { "x-source-sha256": picked[i].image.sha256 } });
        }
      }
      setRound(await api(`/api/crm/rounds/${made.id}`));
      setCurrent(0);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function advance(updated?: RoundScreenshotView) {
    if (round && updated) setRound({ ...round, shots: round.shots.map((s) => (s.id === updated.id ? updated : s)) });
    if (round && current + 1 < round.shots.length) setCurrent(current + 1);
    else if (round) router.push(`/admin/crm/rounds/${round.id}`);
  }

  if (round) {
    const shot = round.shots[current];
    return (
      <ScreenshotWorkspace
        key={shot.id}
        shot={shot}
        image={picked[current].image}
        index={current}
        total={round.shots.length}
        focus={round.focus}
        onSaved={advance}
        onSkip={() => advance()}
        skipLabel={current + 1 < round.shots.length ? "Skip this one" : "Finish later"}
      />
    );
  }

  const ready = picked.length > 0 && !!date && !saving;
  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-gray-200 bg-white p-4" aria-label="Screenshots">
        <h2 className="text-sm font-bold text-blue-900">Screenshots</h2>
        <p className="mt-1 text-sm text-gray-600">
          The MapMyRun route screenshots for this round, up to {MAX_SCREENSHOTS}. Several can show different parts of the same round.
          {options && !options.storage && " Screenshots aren't stored yet: they are used here to trace the route, and only the round and its lines are saved."}
        </p>
        <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-md border border-blue-700 px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50">
          {reading ? "Reading..." : picked.length ? "Add more screenshots" : "Choose screenshots"}
          <input type="file" accept="image/png,image/jpeg,image/webp" multiple className="sr-only" onChange={(e) => pick(e.target.files)} disabled={reading || picked.length >= MAX_SCREENSHOTS} />
        </label>
        {picked.length > 0 && (
          <ul className="mt-3 flex gap-3 overflow-x-auto pb-1">
            {picked.map((p, i) => (
              <li key={`${p.file.name}-${i}`} className="w-28 shrink-0 text-xs text-gray-600">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.image.url} alt={`Screenshot ${i + 1}`} className="h-44 w-full rounded border border-gray-200 object-cover object-top" />
                <p className="mt-1 truncate font-medium text-gray-800" title={p.file.name}>
                  {p.file.name}
                </p>
                <p>{p.time ? `Taken ${p.time.date.split("-").reverse().join("/")} ${p.time.time.slice(0, 5)}` : "No date in the file"}</p>
                <button type="button" className="mt-1 text-red-700 hover:underline" onClick={() => setPicked(picked.filter((_, k) => k !== i))}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 bg-white p-4 md:grid-cols-2" aria-label="Round details">
        <label className="text-sm md:col-span-2">
          <span className="font-semibold text-gray-800">Job</span>
          <select
            value={jobKey}
            onChange={(e) => {
              setJobKey(e.target.value);
              const j = options?.jobs.find((x) => x.key === e.target.value);
              if (j) setBusiness(j.business);
            }}
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-2"
          >
            <option value="">No job (not linked to a lead or project)</option>
            <optgroup label="Area Planner projects">
              {options?.jobs.filter((j) => j.projectId).map((j) => (
                <option key={j.key} value={j.key}>
                  {j.label} ({j.business})
                </option>
              ))}
            </optgroup>
            <optgroup label="Won and Completed leads">
              {options?.jobs.filter((j) => !j.projectId).map((j) => (
                <option key={j.key} value={j.key}>
                  {j.label} ({j.business})
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        <div className="text-sm">
          <span className="font-semibold text-gray-800">Business</span>
          {job ? (
            <p className="mt-2 flex items-center gap-2">
              <span className="font-semibold text-gray-900">{job.business}</span>
              <BusinessBadge business={job.business} />
              <span className="text-gray-600">(from the job)</span>
            </p>
          ) : (
            <div className="mt-2 flex gap-3">
              {(["FDH", "LDB"] as const).map((b) => (
                <label key={b} className="flex items-center gap-1.5">
                  <input type="radio" name="business" checked={business === b} onChange={() => setBusiness(b)} /> {b}
                </label>
              ))}
            </div>
          )}
        </div>
        <label className="text-sm">
          <span className="font-semibold text-gray-800">Distributor</span>
          <select value={distributorId} onChange={(e) => setDistributorId(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-2 py-2">
            <option value="">Not set</option>
            {options?.distributors.filter((d) => d.active).map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="font-semibold text-gray-800">Date of the round</span>
          <input
            type="date"
            max={ukDate()}
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setDateFromFile(false);
            }}
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-2"
          />
          <span className="mt-1 block text-xs text-gray-500">{dateFromFile ? "From the screenshot's own time. Change it if that was a later day." : "Screenshots without a date: enter it."}</span>
        </label>
        <label className="text-sm md:col-span-2">
          <span className="font-semibold text-gray-800">Notes</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={2000} className="mt-1 w-full rounded-md border border-gray-300 px-2 py-2" />
          <span className="block text-xs text-gray-500">For the CRM only; never shown to clients.</span>
        </label>
      </section>

      {error && (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <button type="button" onClick={create} disabled={!ready} className="rounded-md bg-blue-900 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
          {saving ? "Saving the round..." : "Save the round and line up the screenshots"}
        </button>
      </div>
    </div>
  );
}
