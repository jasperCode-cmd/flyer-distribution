"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import BusinessBadge from "@/components/crm/BusinessBadge";
import type { Business } from "@/lib/business";
import { imageTimeInstant } from "@/lib/rounds/exif";
import { NOT_SPECIFIED } from "@/lib/rounds/format";
import { planFiles } from "@/lib/rounds/queue";
import { MAX_SCREENSHOTS } from "@/lib/rounds/validate";
import type { RoundOptions } from "@/lib/rounds/types";
import { readAllFacts, type FileFacts } from "@/lib/rounds/working-image";
import { handOver } from "./pending-files";
import { api, send, ukDate } from "./rounds-api";

// Adding a round: pick its screenshots, up to MAX_SCREENSHOTS (each read
// here, in the browser, one at a time: fingerprinted, its working size and
// its own date read, and let go; none is held in memory), choose the job,
// the distributor (Not specified unless chosen) and the date, then save the
// round with every screenshot's details in one request. The round's own
// page then opens to work through them one at a time. Only the round's
// details and the traced lines are saved; screenshots are kept only once
// storage is on.

type Picked = { file: File; facts: FileFacts };

export default function NewRound({ leadId, projectId }: { leadId: string | null; projectId: string | null }) {
  const router = useRouter();
  const [options, setOptions] = useState<RoundOptions | null>(null);
  const [picked, setPicked] = useState<Picked[]>([]);
  const [reading, setReading] = useState<{ done: number; total: number } | null>(null);
  const [pickNote, setPickNote] = useState<string | null>(null);
  const [jobKey, setJobKey] = useState("");
  const [business, setBusiness] = useState<Business>("FDH");
  const [distributorId, setDistributorId] = useState("");
  const [date, setDate] = useState("");
  const [dateFromFile, setDateFromFile] = useState(false);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

  async function pick(list: FileList | null) {
    if (!list?.length) return;
    const files = [...list];
    setReading({ done: 0, total: files.length });
    setError(null);
    setPickNote(null);
    try {
      const { read, unreadable } = await readAllFacts(files, (done) => setReading({ done, total: files.length }));
      // Already picked count as the round's screenshots: a file picked again is left out.
      const plan = planFiles(
        read.map((r) => r.facts),
        picked.map((p, i) => ({ id: String(i), sha256: p.facts.sha256 })),
        MAX_SCREENSHOTS
      );
      const all = [...picked, ...plan.fresh.map((i) => read[i])];
      setPicked(all);
      const repeats = plan.repeats + plan.matched.length;
      const notes = [
        repeats ? `${repeats} picked twice, used once` : "",
        plan.overLimit ? `${plan.overLimit} left out: a round can have at most ${MAX_SCREENSHOTS}` : "",
        unreadable.length ? `${unreadable.length} couldn't be read as images (${unreadable.slice(0, 3).join(", ")}${unreadable.length > 3 ? "..." : ""})` : "",
      ].filter(Boolean);
      if (notes.length) setPickNote(notes.join("; ") + ".");
      const dated = all.find((p) => p.facts.time);
      if (dated && (!date || dateFromFile)) {
        setDate(dated.facts.time!.date);
        setDateFromFile(true);
      }
    } finally {
      setReading(null);
    }
  }

  async function create() {
    setSaving(true);
    setError(null);
    try {
      // Every screenshot's details in this one request.
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
            width: p.facts.width,
            height: p.facts.height,
            sha256: p.facts.sha256,
            originalName: p.file.name,
            takenAt: p.facts.time ? imageTimeInstant(p.facts.time).toISOString() : null,
          })),
        })
      );
      handOver(
        made.id,
        picked.map((p) => ({ file: p.file, sha256: p.facts.sha256 }))
      );
      router.push(`/admin/crm/rounds/${made.id}`);
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  const ready = picked.length > 0 && !!date && !saving;
  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-gray-200 bg-white p-4" aria-label="Screenshots">
        <h2 className="text-sm font-bold text-blue-900">Screenshots</h2>
        <p className="mt-1 text-sm text-gray-600">
          The MapMyRun route screenshots for this round, up to {MAX_SCREENSHOTS}. Several can show different parts of the same round; after saving, you work through them one at a time.
          {options && !options.storage && " Screenshots aren't stored yet: they are used here to trace the route, and only the round and its lines are saved."}
        </p>
        <p className="mt-2 rounded-md bg-violet-50 px-3 py-2 text-sm text-violet-900" role="note">
          <span className="font-semibold">Tip:</span> For quicker auto line-up, keep the same zoom, overlap each screenshot by about half a screen, and tap the compass so north is up.
        </p>
        <label className={`mt-3 inline-flex items-center gap-2 rounded-md border border-blue-700 px-3 py-2 text-sm font-semibold text-blue-800 ${reading || picked.length >= MAX_SCREENSHOTS ? "opacity-60" : "cursor-pointer hover:bg-blue-50"}`}>
          {reading ? `Reading ${reading.done} of ${reading.total}...` : picked.length ? "Add more screenshots" : "Choose screenshots"}
          <input type="file" accept="image/png,image/jpeg,image/webp" multiple className="sr-only" onChange={(e) => pick(e.target.files)} disabled={!!reading || picked.length >= MAX_SCREENSHOTS} />
        </label>
        {pickNote && (
          <p className="mt-2 text-sm text-amber-800" role="status">
            {pickNote}
          </p>
        )}
        {picked.length > 0 && (
          <>
            <p className="mt-3 text-sm font-semibold text-gray-800">
              {picked.length} screenshot{picked.length === 1 ? "" : "s"}
            </p>
            <ol className="mt-1 max-h-72 divide-y divide-gray-100 overflow-y-auto rounded-md border border-gray-100 text-sm" aria-label="Chosen screenshots">
              {picked.map((p, i) => (
                <li key={p.facts.sha256} className="flex items-center gap-2 px-2 py-1.5">
                  <span className="w-7 shrink-0 text-right tabular-nums text-gray-500">{i + 1}.</span>
                  <span className="min-w-0 flex-1 truncate font-medium text-gray-900" title={p.file.name}>
                    {p.file.name}
                  </span>
                  <span className="shrink-0 text-xs text-gray-500">{p.facts.time ? `${p.facts.time.date.split("-").reverse().join("/")} ${p.facts.time.time.slice(0, 5)}` : "No date in the file"}</span>
                  <span className="shrink-0 rounded-full border border-gray-300 px-2 py-0.5 text-xs font-semibold text-gray-700">To do</span>
                  <button type="button" className="shrink-0 text-xs text-red-700 hover:underline" onClick={() => setPicked(picked.filter((_, k) => k !== i))} aria-label={`Remove ${p.file.name}`}>
                    Remove
                  </button>
                </li>
              ))}
            </ol>
          </>
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
            <option value="">{NOT_SPECIFIED}</option>
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
          {saving ? "Saving the round..." : `Save the round and work through ${picked.length > 1 ? `the ${picked.length} screenshots` : "the screenshot"}`}
        </button>
      </div>
    </div>
  );
}
