"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import CaseStudyCollage from "./CaseStudyCollage";

export default function HeroCaseStudyTeaser() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group w-full text-left bg-blue-800/60 hover:bg-blue-800/80 border border-blue-700 rounded-lg px-4 py-3 mt-6 transition-colors duration-200"
      >
        <p className="text-white text-sm font-semibold flex items-center justify-between gap-2">
          What does our bespoke tracked service actually look like?
          <span
            className="text-yellow-400 group-hover:translate-x-1 transition-transform duration-200 flex-shrink-0"
            aria-hidden="true"
          >
            →
          </span>
        </p>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 popup-backdrop"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative bg-white rounded-lg shadow-2xl max-w-md w-full p-6 popup-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 transition-colors"
            >
              <svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
            <h3 className="text-lg font-bold text-blue-900 mb-3 pr-6">
              A Real Tracked Round: Oakley
            </h3>
            <CaseStudyCollage
              hero={{
                src: "/Oakley-Route1.webp",
                alt: "Aerial GPS-recorded route map showing an extensive leaflet round covering East Oakley, Kennet Way, The Drive and Hill Road",
              }}
              stacked={[
                {
                  src: "/Oakley-Route2.webp",
                  alt: "Aerial GPS-recorded route map showing a leaflet round through the streets of Oakley village",
                },
              ]}
            />
            <p className="text-gray-600 text-sm mt-4 mb-5">
              Every round we run is tracked and confirmed this way, so you
              know exactly what was delivered, where, and when.
            </p>
            <Link
              href="/case-studies"
              onClick={() => setOpen(false)}
              className="inline-block w-full text-center bg-blue-700 hover:bg-blue-800 text-white font-bold px-6 py-3 rounded-md text-sm transition duration-200 ease-out hover:scale-105"
            >
              See the full case studies
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
