"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { prefersReducedMotion } from "./SlotCountdown";

// "final": the real figures, as the server renders them and as shown with
// reduced motion. "waiting": set to zero, off screen, until it scrolls into
// view. "counting": the count-up, then resting on the real figures.
type Phase = "final" | "waiting" | "counting";

function useCountUp(target: number, duration: number, phase: Phase) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (phase !== "counting") return;
    let start: number | null = null;
    let frame = 0;
    const step = (timestamp: number) => {
      if (start === null) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [phase, target, duration]);
  return phase === "final" ? target : count;
}

// The real figure is the text in the page (in the server HTML, and what
// screen readers read). While counting it is kept, invisible, to hold its
// width, and the counting copy is drawn over it for the eye only.
function Figure({ value, counting }: { value: string; counting: string | null }) {
  return (
    <span className="inline-grid tabular-nums">
      <span className={`col-start-1 row-start-1 ${counting === null ? "" : "opacity-0"}`}>{value}</span>
      {counting !== null && (
        <span aria-hidden="true" className="col-start-1 row-start-1 text-right">
          {counting}
        </span>
      )}
    </span>
  );
}

function House({ lit }: { lit: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      strokeLinejoin="round"
      className={`block w-full h-auto transition-colors duration-200 ${
        lit ? "fill-yellow-400 stroke-yellow-400" : "fill-transparent stroke-blue-300"
      }`}
    >
      <path d="M12 3 2.5 11H5v10h5v-6h4v6h5V11h2.5z" />
    </svg>
  );
}

const HOMES = 25;
const READING = 23;

export default function StatsBar() {
  const ref = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>("final");

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    // Already on screen when the page wakes up (a reload part-way down): it
    // has been showing the real figures, so leave them rather than drop to 0.
    const box = el.getBoundingClientRect();
    if (box.top < window.innerHeight && box.bottom > 0) return;
    setPhase("waiting");
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setPhase("counting");
          observer.disconnect();
        }
      },
      { threshold: 0.25 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const stat92 = useCountUp(92, 1800, phase);
  const stat74 = useCountUp(74, 1800, phase);
  const stat4 = useCountUp(4, 1600, phase);
  const counting = phase !== "final";
  // The houses light up in step with the 92% counter, all 23 as it lands.
  const lit = Math.round((stat92 / 92) * READING);

  return (
    <section className="bg-blue-900 text-white">
      <div
        ref={ref}
        className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-16 grid grid-cols-1 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-10 lg:gap-16 items-center"
      >
        {/* The one big stat */}
        <div>
          <p className="text-yellow-400 text-xs sm:text-sm font-bold uppercase tracking-[0.18em] mb-3">
            Out of every 25 homes
          </p>
          <div className="flex items-center gap-4 sm:gap-6 mb-8">
            <p className="font-heading font-bold leading-none tracking-tight text-[5.25rem] sm:text-[6.5rem] lg:text-[7.5rem] shrink-0">
              <Figure value="92%" counting={counting ? `${stat92}%` : null} />
            </p>
            <p className="text-lg sm:text-xl text-blue-100 leading-snug max-w-[15rem]">
              of people who receive a door drop read it
            </p>
          </div>
          <div
            role="img"
            aria-label="23 out of 25 homes"
            className="grid grid-cols-9 sm:grid-cols-13 gap-1.5 sm:gap-2 max-w-xl"
          >
            {Array.from({ length: HOMES }, (_, i) => (
              <House key={i} lit={i < READING && i < lit} />
            ))}
          </div>
          <p className="mt-6 text-base sm:text-lg text-blue-100 leading-relaxed">
            That&apos;s 23 in every 25 households reading what comes through the door.
          </p>
        </div>

        {/* The other two figures and the quote button */}
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-5">
            <div className="rounded-2xl border border-blue-300/30 p-6">
              <p className="font-heading font-bold text-5xl sm:text-6xl leading-none mb-3">
                <Figure value="74%" counting={counting ? `${stat74}%` : null} />
              </p>
              <p className="text-blue-200 leading-relaxed">
                of door drops are opened, read, filed or set aside for later
              </p>
            </div>
            <div className="rounded-2xl border border-blue-300/30 p-6">
              <p className="font-heading font-bold text-5xl sm:text-6xl leading-none mb-3">
                <Figure value="4 in 5" counting={counting ? `${stat4} in 5` : null} />
              </p>
              <p className="text-blue-200 leading-relaxed">door drop items are engaged with</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <Link
              href="/quote"
              className="inline-block bg-yellow-400 hover:bg-yellow-300 text-blue-900 font-bold px-8 py-3.5 rounded-md text-base transition duration-200 ease-out hover:scale-105 shadow"
            >
              Get a Free Quote
            </Link>
            <p className="text-blue-300 text-sm">Source: Royal Mail</p>
          </div>
        </div>
      </div>
    </section>
  );
}
