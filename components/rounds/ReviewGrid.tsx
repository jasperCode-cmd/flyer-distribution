"use client";

import { useEffect, useMemo, useState } from "react";
import { flagsOf, type DraftFlag } from "@/lib/rounds/auto";
import { MAP_TILES } from "@/lib/area-planner/tiles";
import { formatDistance } from "@/lib/rounds/format";
import { LOW_CONFIDENCE } from "@/lib/rounds/match";
import type { RoundScreenshotView } from "@/lib/rounds/types";
import type { StoredDraft } from "./drafts";
import MiniMap from "./MiniMap";

// Reviewing automatic line-ups: a card for each, with its screenshot, its
// trace over the map and how sure the match was; low ones and anything odd
// flagged. Accept all (the ones not flagged), or one by one; open one to fix
// in the usual workspace; or skip it to line up by hand. Nothing is saved
// until accepted.

// fromIndex: where in the round the screenshot it was matched to is.
type Item = { index: number; shot: RoundScreenshotView; stored: StoredDraft; canOpen: boolean; fromIndex: number | null };

type Props = {
  items: Item[];
  busy: boolean;
  onAccept: (ids: string[]) => void;
  onOpen: (id: string) => void;
  onSkip: (id: string) => void;
};

const FLAG_TEXT: Record<DraftFlag, (d: StoredDraft) => string> = {
  low: () => "Low confidence",
  "no-route": () => "No route found",
  turned: (d) => `Turned ${Math.abs(d.draft.turnDeg).toFixed(0)}°`,
};

function Thumb({ blob, label }: { blob: Blob | null; label: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) return;
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  if (!url) return <div className="flex h-[200px] w-[92px] items-center justify-center rounded border border-gray-200 bg-gray-50 text-[10px] text-gray-400">No preview</div>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={label} className="h-[200px] w-[92px] rounded border border-gray-200 object-cover object-top" />;
}

export default function ReviewGrid({ items, busy, onAccept, onOpen, onSkip }: Props) {
  const withFlags = useMemo(
    () =>
      items.map((it) => {
        const flags = flagsOf(it.stored.draft, LOW_CONFIDENCE);
        // A turned map is only worth knowing; the other flags need a look.
        const needsLook = flags.some((f) => f !== "turned");
        return { ...it, flags, needsLook };
      }),
    [items]
  );
  const confident = withFlags.filter((i) => !i.needsLook);
  const flagged = withFlags.length - confident.length;

  if (items.length === 0) {
    return (
      <section className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600" aria-label="Review automatic line-ups">
        Nothing waiting for review.
      </section>
    );
  }
  return (
    <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-3" aria-label="Review automatic line-ups">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-blue-900">Review automatic line-ups</h2>
          <p className="text-sm text-gray-600" role="status">
            {items.length} waiting{flagged ? `, ${flagged} flagged for a closer look` : ""}. Nothing is saved until accepted.
          </p>
        </div>
        <button
          type="button"
          disabled={busy || confident.length === 0}
          onClick={() => onAccept(confident.map((i) => i.shot.id))}
          className="rounded-md bg-green-700 px-3 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-50"
        >
          {busy ? "Saving..." : `Accept all ${flagged ? "not flagged " : ""}(${confident.length})`}
        </button>
      </div>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Automatic line-ups">
        {withFlags.map((it) => {
          const d = it.stored.draft;
          const name = it.shot.originalName ?? "Screenshot";
          return (
            <li key={it.shot.id} className={`rounded-lg border p-2 ${it.needsLook ? "border-amber-300 bg-amber-50/40" : "border-gray-200"}`} aria-label={`${it.index + 1}. ${name}`}>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <p className="min-w-0 truncate text-sm font-semibold text-gray-900" title={name}>
                  {it.index + 1}. {name}
                </p>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${d.confidence >= LOW_CONFIDENCE ? "bg-green-100 text-green-900" : "bg-amber-100 text-amber-900"}`}
                  title={`${d.blocks} matching patches of the imagery agree, to ${d.rmsPx.toFixed(2)} px`}
                >
                  {Math.round(d.confidence * 100)}% sure
                </span>
              </div>
              <div className="flex gap-2">
                <Thumb blob={it.stored.thumb} label={`Screenshot ${it.index + 1}`} />
                <MiniMap footprint={d.footprint} lines={d.lines} width={200} height={200} label={`Screenshot ${it.index + 1}'s trace over the map`} />
              </div>
              <p className="mt-1.5 text-xs text-gray-600">
                {d.lines.length ? formatDistance(d.lengthM) : "No line"} · about {d.metresPerPixel.toFixed(2)} m a pixel
                {it.fromIndex !== null ? ` · matched to ${it.fromIndex + 1}` : ""}
              </p>
              {it.flags.length > 0 && (
                <p className="mt-1 flex flex-wrap gap-1">
                  {it.flags.map((f) => (
                    <span key={f} className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${f === "turned" ? "bg-gray-100 text-gray-700" : "bg-amber-100 text-amber-900"}`}>
                      {FLAG_TEXT[f](it.stored)}
                    </span>
                  ))}
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button type="button" disabled={busy} onClick={() => onAccept([it.shot.id])} className="rounded-md bg-green-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-green-800 disabled:opacity-50">
                  Accept
                </button>
                <button
                  type="button"
                  disabled={busy || !it.canOpen}
                  title={it.canOpen ? undefined : "Choose this screenshot's file again to open it"}
                  onClick={() => onOpen(it.shot.id)}
                  className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                >
                  Open to fix
                </button>
                <button type="button" disabled={busy} onClick={() => onSkip(it.shot.id)} className="rounded-md px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50">
                  Skip
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-[11px] text-gray-500">Maps {MAP_TILES.attributionText}</p>
    </section>
  );
}
