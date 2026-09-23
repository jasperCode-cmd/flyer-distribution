"use client";

import { useEffect, useRef, useState } from "react";
import { campaignSlots } from "@/lib/campaign-constants";

const DURATION = 2600;

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

// Ticks down from totalSlots to the real slotsRemaining figure, using the
// same requestAnimationFrame + eased-progress technique as the homepage
// StatsBar count-up (components/StatsBar.tsx), just counting down instead
// of up. Self-observes via IntersectionObserver by default, which covers
// both "already in view on page load" and "scrolls into view" in one
// path (same as StatsBar). Pass `triggered` to control it externally
// instead — used by the timed popup, which opens rather than scrolling
// into view.
export default function SlotCountdown({
  triggered,
  className = "",
}: {
  triggered?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [count, setCount] = useState(campaignSlots.totalSlots);
  const startedRef = useRef(false);
  const externallyControlled = triggered !== undefined;

  function runCountdown() {
    if (startedRef.current) return;
    startedRef.current = true;

    if (prefersReducedMotion()) {
      setCount(campaignSlots.slotsRemaining);
      return;
    }

    const from = campaignSlots.totalSlots;
    const to = campaignSlots.slotsRemaining;
    let start: number | null = null;

    const step = (timestamp: number) => {
      if (start === null) start = timestamp;
      const progress = Math.min((timestamp - start) / DURATION, 1);
      // Linear rather than eased — each digit gets roughly equal screen
      // time, so the count is actually readable rather than blurring
      // through the early numbers.
      setCount(Math.round(from - progress * (from - to)));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  useEffect(() => {
    if (externallyControlled) return;
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          runCountdown();
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (externallyControlled && triggered) runCountdown();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggered]);

  return (
    <span ref={ref} className={`inline-block tabular-nums ${className}`}>
      {count}
    </span>
  );
}
