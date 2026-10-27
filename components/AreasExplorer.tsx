"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Breadcrumb from "@/components/Breadcrumb";
import { AREA_REGIONS, START, chooseRegion, queryFromSearch, searchFor, visibleAreas, type ExplorerState, type OverviewCard, type RegionId } from "@/lib/area-search";

// The /areas overview's hero, search, region chips and cards. Every card is
// in the server-rendered HTML; searching and the chips only hide cards in the
// browser, so with JavaScript off all of them show. Arriving with ?q= (from
// the homepage's "Check if we cover you") runs that search straight away.

const ASK_HREF = "/quote?service=leaflet";
const YELLOW_BUTTON =
  "inline-block bg-yellow-400 hover:bg-yellow-300 text-blue-900 font-bold px-7 py-3.5 rounded-md transition duration-200 ease-out hover:scale-105 shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2";
const TICKS = ["Hundreds of postcodes covered", "Several towns in one campaign", "Every round GPS tracked"];

export default function AreasExplorer({ cards }: { cards: OverviewCard[] }) {
  const [state, setState] = useState<ExplorerState>(START);

  useEffect(() => {
    const q = queryFromSearch(window.location.search);
    if (q) setState((s) => searchFor(s, q));
  }, []);

  return (
    <>
      {/* 1. Hero: the search, and a panel for towns without a page */}
      <section className="bg-blue-900 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-20 grid grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] gap-10 lg:gap-14 items-center">
          <div>
            <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Areas" }]} />
            <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight mb-5">Areas We Cover</h1>
            <p className="text-blue-100 text-lg sm:text-xl leading-relaxed mb-8">
              We distribute flyers and leaflets across Hampshire and Dorset, covering hundreds of postcodes as part of our full{" "}
              <Link href="/services" className="text-white underline underline-offset-2 hover:text-blue-200">
                leaflet distribution service
              </Link>
              . Every round is GPS tracked.
            </p>
            <div role="search" className="max-w-xl">
              <label htmlFor="area-search" className="block text-sm font-semibold text-white mb-2">
                Find your area
              </label>
              <div className="relative">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-3.5-3.5" />
                </svg>
                <input
                  id="area-search"
                  type="search"
                  value={state.query}
                  onChange={(e) => setState((s) => searchFor(s, e.target.value))}
                  placeholder="Type a town or postcode, e.g. BH14 or Romsey"
                  aria-describedby="area-search-hint"
                  autoComplete="off"
                  spellCheck={false}
                  enterKeyHint="search"
                  className="w-full rounded-xl bg-white py-4 pl-11 pr-3 sm:pl-12 sm:pr-4 text-base text-gray-900 placeholder:text-gray-500 placeholder:text-[13px] min-[375px]:placeholder:text-sm sm:placeholder:text-base shadow-lg focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-400"
                />
              </div>
              <p id="area-search-hint" className="mt-2 text-sm text-blue-200">
                Works with full postcodes too, like SO51 8AB.
              </p>
            </div>
          </div>
          <div className="rounded-2xl bg-white p-6 sm:p-8 text-gray-600 shadow-2xl shadow-black/30">
            <h2 className="text-xl sm:text-2xl font-bold text-blue-900">Don&apos;t see your town?</h2>
            <p className="mt-3 leading-relaxed">
              These are our main areas, but we deliver to many more towns and villages across Hampshire and Dorset. Tell us where
              you&apos;d like to reach and we&apos;ll confirm within 24 hours.
            </p>
            <ul className="mt-5 space-y-3">
              {TICKS.map((tick) => (
                <li key={tick} className="flex items-center gap-3 font-semibold text-blue-900">
                  <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12.5l4.5 4.5L19 7.5" />
                    </svg>
                  </span>
                  {tick}
                </li>
              ))}
            </ul>
            <Link href={ASK_HREF} className={`${YELLOW_BUTTON} mt-7`}>
              Ask about your area
            </Link>
          </div>
        </div>
      </section>

      {/* 2 and 3. Region chips, the results line and the cards */}
      <AreaResults cards={cards} state={state} onRegion={(region) => setState(chooseRegion(region))} />
    </>
  );
}

export function AreaResults({
  cards,
  state,
  onRegion,
}: {
  cards: OverviewCard[];
  state: ExplorerState;
  onRegion: (region: RegionId | "all") => void;
}) {
  const { shown, line, empty } = visibleAreas(cards, state);
  const showing = new Set(shown.map((c) => c.slug));
  // Matches in their own order, the rest after them, hidden.
  const ordered = [...shown, ...cards.filter((c) => !showing.has(c.slug))];
  const chips: { id: RegionId | "all"; label: string }[] = [{ id: "all", label: "All areas" }, ...AREA_REGIONS];

  return (
    <section className="bg-slate-50 py-14">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="sr-only">Our main areas</h2>
        <div role="group" aria-label="Filter by region" className="flex flex-wrap gap-2.5">
          {chips.map((chip) => {
            const pressed = state.region === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                aria-pressed={pressed}
                onClick={() => onRegion(chip.id)}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 ${
                  pressed ? "border-blue-900 bg-blue-900 text-white" : "border-blue-200 bg-white text-blue-800 hover:border-blue-400 hover:bg-blue-50"
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
        <p role="status" aria-live="polite" className="mt-6 font-semibold text-gray-700">
          {line}
        </p>
        <ul className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {ordered.map((card) => (
            <li key={card.slug} hidden={!showing.has(card.slug)}>
              <Link
                href={card.href}
                className="group flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:border-blue-400 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50"
              >
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-700">{card.regionLabel}</p>
                <h3 className="mt-2 text-xl font-bold text-blue-900">{card.name}</h3>
                <p className="mt-2 text-gray-600 leading-relaxed">{card.blurb}</p>
                <div className="mt-auto pt-5 flex items-end justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-800">{card.range}</span>
                    <span className="text-sm text-gray-600">{card.homes}</span>
                  </div>
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-blue-700 transition-transform duration-200 group-hover:translate-x-1" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </div>
              </Link>
            </li>
          ))}
        </ul>
        {empty && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-sm max-w-2xl">
            <h3 className="text-xl font-bold text-blue-900">We don&apos;t have a page for that one yet</h3>
            <p className="mt-2 text-gray-600 leading-relaxed">
              We may still deliver there. Tell us where you&apos;d like to reach and we&apos;ll let you know.
            </p>
            <Link href={ASK_HREF} className={`${YELLOW_BUTTON} mt-6`}>
              Ask about your area
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
