"use client";

import Link from "next/link";
import { useId, useState } from "react";

// One region of the homepage's "Areas We Cover". From md up: its name and its
// towns, always shown, as before. On phones: a row that opens and closes
// (closed to start with), a real button with aria-expanded and aria-controls
// inside the heading. The towns are always in the page (so they are in the
// server HTML for search engines); closed, they are collapsed and hidden
// with CSS, which also keeps them out of the tab order and away from screen
// readers until opened. The open and close is smooth, and instant with
// reduced motion.

type Area = { slug: string; name: string; href: string };

const Arrow = ({ className }: { className: string }) => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15] focus-visible:ring-offset-2 focus-visible:ring-offset-blue-900";
// On phones the towns sit in a box that clips while it opens, so their focus ring is drawn inside them there.
const PHONE_FOCUS = "max-md:focus-visible:ring-inset max-md:focus-visible:ring-offset-0";
const LABEL = "text-xs font-bold uppercase tracking-[0.14em] text-blue-300";

export default function HomeAreaGroup({ label, areas }: { label: string; areas: Area[] }) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  return (
    <div>
      {/* From md: the region's name, as before. */}
      <h3 className={`hidden md:block ${LABEL} mb-2`}>{label}</h3>
      {/* Phones: the same name as a button that opens and closes its towns. */}
      <h3 className="md:hidden">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((o) => !o)}
          className={`flex min-h-14 w-full items-center gap-3 text-left ${FOCUS} max-md:focus-visible:ring-inset max-md:focus-visible:ring-offset-0`}
        >
          <span className={LABEL}>{label}</span>
          <span className="ml-auto text-sm text-blue-200/70">
            {areas.length} {areas.length === 1 ? "area" : "areas"}
          </span>
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className={`h-5 w-5 shrink-0 text-[#facc15] transition-transform duration-300 motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </h3>
      <div
        id={listId}
        className={`grid transition-[grid-template-rows,visibility] duration-300 ease-out motion-reduce:transition-none md:visible md:grid-rows-[1fr] ${
          open ? "visible grid-rows-[1fr]" : "invisible grid-rows-[0fr]"
        }`}
      >
        <ul className="overflow-hidden md:overflow-visible">
          {areas.map((area) => (
            <li key={area.slug} className="border-b border-white/15 max-md:last:border-b-0">
              <Link
                href={area.href}
                className={`group flex min-h-11 items-center justify-between gap-3 rounded-sm py-2 font-semibold text-white transition-colors hover:text-[#facc15] ${FOCUS} ${PHONE_FOCUS}`}
              >
                {area.name}
                <Arrow className="h-4 w-4 shrink-0 text-[#facc15] transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
