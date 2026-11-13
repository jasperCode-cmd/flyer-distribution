"use client";

import { useEffect, useState } from "react";
import type { MapRound, RoundOptions } from "@/lib/rounds/types";
import { api, filtersQuery, ukDate } from "@/components/rounds/rounds-api";
import { NOT_SPECIFIED } from "@/lib/rounds/format";
import { NOT_SPECIFIED_FILTER } from "@/lib/rounds/validate";

// The Area Planner's "Rounds" layer: off by default, and nothing is read
// until it is switched on. Then the traced rounds for the filters (date
// range, business, lead, distributor) are read once, and again only when a
// filter changes; never polled.

type Props = { onRounds: (rounds: MapRound[] | null) => void };

export default function RoundsLayerControls({ onRounds }: Props) {
  const [on, setOn] = useState(false);
  const [options, setOptions] = useState<RoundOptions | null>(null);
  const [filters, setFilters] = useState({ from: ukDate(30), to: ukDate(), business: "", leadId: "", distributorId: "" });
  const [state, setState] = useState<{ count: number; more: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!on || options) return;
    api<RoundOptions>("/api/crm/rounds/options").then(setOptions).catch((e) => setError((e as Error).message));
  }, [on, options]);

  useEffect(() => {
    if (!on) {
      onRounds(null);
      setState(null);
      return;
    }
    let live = true;
    setLoading(true);
    setError(null);
    api<{ rounds: MapRound[]; more: boolean }>(`/api/crm/rounds/map${filtersQuery(filters)}`)
      .then((r) => {
        if (!live) return;
        onRounds(r.rounds);
        setState({ count: r.rounds.length, more: r.more });
      })
      .catch((e) => live && setError((e as Error).message))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, filters]);

  const leads = options ? [...new Map(options.jobs.filter((j) => j.leadId).map((j) => [j.leadId!, j.label.replace(/ \(closed\)$/, "")])).entries()] : [];
  const set = (k: keyof typeof filters) => (e: { target: { value: string } }) => setFilters({ ...filters, [k]: e.target.value });

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <button
        type="button"
        aria-pressed={on}
        onClick={() => setOn(!on)}
        className={`rounded-md px-3 py-1.5 font-semibold ${on ? "bg-fuchsia-700 text-white" : "border border-gray-300 bg-white text-gray-800 hover:bg-gray-50"}`}
      >
        Rounds
      </button>
      {on && (
        <>
          <label className="flex items-center gap-1 text-xs text-gray-700">
            From
            <input type="date" value={filters.from} onChange={set("from")} className="rounded border border-gray-300 px-1.5 py-1" />
          </label>
          <label className="flex items-center gap-1 text-xs text-gray-700">
            To
            <input type="date" value={filters.to} onChange={set("to")} className="rounded border border-gray-300 px-1.5 py-1" />
          </label>
          <select value={filters.business} onChange={set("business")} aria-label="Business" className="rounded border border-gray-300 px-1.5 py-1 text-xs">
            <option value="">FDH and LDB</option>
            <option value="FDH">FDH</option>
            <option value="LDB">LDB</option>
          </select>
          <select value={filters.leadId} onChange={set("leadId")} aria-label="Lead" className="max-w-40 rounded border border-gray-300 px-1.5 py-1 text-xs">
            <option value="">All leads</option>
            {leads.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
          <select value={filters.distributorId} onChange={set("distributorId")} aria-label="Distributor" className="max-w-40 rounded border border-gray-300 px-1.5 py-1 text-xs">
            <option value="">All distributors</option>
            <option value={NOT_SPECIFIED_FILTER}>{NOT_SPECIFIED}</option>
            {options?.distributors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <span className="text-xs text-gray-600" role="status">
            {loading ? "Loading rounds..." : error ? error : state ? `${state.count} round${state.count === 1 ? "" : "s"}${state.more ? " (the first 500)" : ""}` : ""}
          </span>
        </>
      )}
    </div>
  );
}
