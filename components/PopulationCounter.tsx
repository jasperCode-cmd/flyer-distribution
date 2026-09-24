"use client";

import { useEffect, useRef } from "react";

const DURATION = 1400;

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

interface Props {
  population: number;
  label: string;
  className?: string;
}

// The real, final population figure is always what's in the JSX below, so
// it's in the server-rendered HTML from the very first response, never a
// placeholder or "0". The count-up is a purely visual layer added on top
// afterwards: it mutates the number span's textContent directly via a ref,
// entirely outside React's render cycle, so there is no state that could
// ever cause the real value to be replaced by a zero or blank on the way
// to hydration. If it's already in view on mount, or prefers-reduced-motion
// is set, it just shows the final figure straight away.
export default function PopulationCounter({ population, label, className = "" }: Props) {
  const numberRef = useRef<HTMLSpanElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    function runCountUp() {
      if (startedRef.current) return;
      startedRef.current = true;

      const numberEl = numberRef.current;
      if (!numberEl || prefersReducedMotion()) return;

      let start: number | null = null;
      const step = (timestamp: number) => {
        if (start === null) start = timestamp;
        const progress = Math.min((timestamp - start) / DURATION, 1);
        const current = Math.round(progress * population);
        numberEl.textContent = current.toLocaleString("en-GB");
        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          numberEl.textContent = population.toLocaleString("en-GB");
        }
      };
      requestAnimationFrame(step);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          runCountUp();
          observer.disconnect();
        }
      },
      { threshold: 0.4 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [population]);

  return (
    <div ref={wrapperRef} className={`inline-flex items-baseline gap-2 ${className}`}>
      <span ref={numberRef} className="text-2xl font-bold text-blue-900 tabular-nums">
        {population.toLocaleString("en-GB")}
      </span>
      <span className="text-sm text-gray-500">{label}</span>
    </div>
  );
}
