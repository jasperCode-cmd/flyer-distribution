"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BusinessBadge from "@/components/crm/BusinessBadge";
import { NOT_SPECIFIED, distributorColour, distributorName, formatDistance, shortDate } from "@/lib/rounds/format";
import { MAX_TRIM_M, MIN_TRIM_M, NOT_SPECIFIED_FILTER } from "@/lib/rounds/validate";
import type { RoundOptions, RoundSummary } from "@/lib/rounds/types";
import { api, filtersQuery, send } from "./rounds-api";

// The Rounds page: every recorded round, newest first, filtered by date,
// business, lead and distributor (read when the page opens or a filter
// changes, never polled), and the privacy trim for what clients see.

type Filters = { from: string; to: string; business: string; leadId: string; distributorId: string };

export default function RoundsView() {
  const [filters, setFilters] = useState<Filters>({ from: "", to: "", business: "", leadId: "", distributorId: "" });
  const [rounds, setRounds] = useState<RoundSummary[] | null>(null);
  const [more, setMore] = useState(false);
  const [options, setOptions] = useState<RoundOptions | null>(null);
  const [trim, setTrim] = useState("");
  const [trimNote, setTrimNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<RoundOptions>("/api/crm/rounds/options")
      .then((o) => {
        setOptions(o);
        setTrim(String(o.trimM));
      })
      .catch((e) => setError((e as Error).message));
  }, []);

  useEffect(() => {
    let live = true;
    api<{ rounds: RoundSummary[]; more: boolean }>(`/api/crm/rounds${filtersQuery(filters)}`)
      .then((r) => {
        if (!live) return;
        setRounds(r.rounds);
        setMore(r.more);
      })
      .catch((e) => live && setError((e as Error).message));
    return () => {
      live = false;
    };
  }, [filters]);

  async function saveTrim() {
    setTrimNote(null);
    try {
      const r = await api<{ trimM: number }>("/api/crm/rounds/settings", send("PUT", { trimM: Number(trim) }));
      setTrimNote(`Saved: clients don't see the first and last ${r.trimM} m of a route.`);
    } catch (e) {
      setTrimNote((e as Error).message);
    }
  }

  const leads = options ? [...new Map(options.jobs.filter((j) => j.leadId).map((j) => [j.leadId!, j.label.replace(/ \(closed\)$/, "")])).entries()] : [];
  const set = (k: keyof Filters) => (e: { target: { value: string } }) => setFilters({ ...filters, [k]: e.target.value });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-blue-900">Rounds</h1>
          <p className="text-sm text-gray-500">Delivery rounds traced from distributors&apos; MapMyRun screenshots.</p>
        </div>
        <Link href="/admin/crm/rounds/new" className="rounded-md bg-blue-900 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">
          Add a round
        </Link>
      </div>

      <section aria-label="Filters" className="grid grid-cols-2 gap-2 rounded-lg border border-gray-200 bg-white p-3 text-sm md:grid-cols-5">
        <label>
          <span className="block text-xs font-semibold text-gray-600">From</span>
          <input type="date" value={filters.from} onChange={set("from")} className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5" />
        </label>
        <label>
          <span className="block text-xs font-semibold text-gray-600">To</span>
          <input type="date" value={filters.to} onChange={set("to")} className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5" />
        </label>
        <label>
          <span className="block text-xs font-semibold text-gray-600">Business</span>
          <select value={filters.business} onChange={set("business")} className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5">
            <option value="">All</option>
            <option value="FDH">FDH</option>
            <option value="LDB">LDB</option>
          </select>
        </label>
        <label>
          <span className="block text-xs font-semibold text-gray-600">Lead</span>
          <select value={filters.leadId} onChange={set("leadId")} className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5">
            <option value="">All</option>
            {leads.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="block text-xs font-semibold text-gray-600">Distributor</span>
          <select value={filters.distributorId} onChange={set("distributorId")} className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5">
            <option value="">All</option>
            <option value={NOT_SPECIFIED_FILTER}>{NOT_SPECIFIED}</option>
            {options?.distributors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      {error && (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      {!rounds ? (
        <p className="text-sm text-gray-500">Loading the rounds...</p>
      ) : rounds.length === 0 ? (
        <p className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600">No rounds yet{Object.values(filters).some(Boolean) ? " for these filters" : ""}.</p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
          {rounds.map((r) => (
            <li key={r.id}>
              <Link href={`/admin/crm/rounds/${r.id}`} className="grid grid-cols-1 gap-1 px-3 py-3 hover:bg-blue-50 md:grid-cols-[7rem_minmax(0,1.4fr)_minmax(0,1fr)_6rem_minmax(0,1.4fr)_8rem] md:items-center md:gap-3">
                <span className="text-sm font-semibold text-gray-900">{shortDate(r.date)}</span>
                <span className="flex min-w-0 items-center gap-2 text-sm">
                  <BusinessBadge business={r.business} />
                  <span className="truncate text-gray-900">{r.lead?.name ?? r.project?.name ?? "No job"}</span>
                </span>
                <span className="flex min-w-0 items-center gap-1.5 text-sm text-gray-700">
                  <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: distributorColour(r.distributor) }} aria-hidden="true" />
                  <span className="truncate">{distributorName(r.distributor)}</span>
                </span>
                <span className="text-sm tabular-nums text-gray-800">{r.distanceM !== null ? formatDistance(r.distanceM) : "-"}</span>
                <span className="truncate text-xs text-gray-600">{r.sectors.length ? r.sectors.map((s) => s.code).join(", ") : "No sectors yet"}</span>
                <span className="text-xs text-gray-600">
                  {r.screenshots.traced}/{r.screenshots.total} traced
                  {r.screenshots.stored === 0 ? " · not stored" : ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {more && <p className="text-xs text-gray-500">Showing the first 500. Narrow the filters to see others.</p>}

      <section aria-label="Client privacy" className="rounded-lg border border-gray-200 bg-white p-4 text-sm">
        <h2 className="font-bold text-blue-900">Client privacy</h2>
        <p className="mt-1 text-gray-600">
          Anything shown to a client (their report link) leaves out everything within this distance of where a round started and ended (the red and green dots). The CRM always shows the full line.
        </p>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label>
            <span className="block text-xs font-semibold text-gray-600">Trim (metres)</span>
            <input type="number" min={MIN_TRIM_M} max={MAX_TRIM_M} step={10} value={trim} onChange={(e) => setTrim(e.target.value)} className="mt-1 w-28 rounded-md border border-gray-300 px-2 py-1.5" />
          </label>
          <button type="button" onClick={saveTrim} className="rounded-md border border-blue-700 px-3 py-1.5 font-semibold text-blue-800 hover:bg-blue-50">
            Save
          </button>
          {trimNote && <span className="text-gray-700">{trimNote}</span>}
        </div>
      </section>
    </div>
  );
}
