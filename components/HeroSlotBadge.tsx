"use client";

import { useState } from "react";
import Link from "next/link";
import { campaignSlots } from "@/lib/campaign-constants";
import SlotCountdown, { prefersReducedMotion } from "./SlotCountdown";

// Three phases: "counting" (large, catches the eye while the number ticks
// down), "pop" (a brief overshoot on the real figure as it lands), then
// "settled" (shrinks to the badge's normal resting size for the rest of
// the page). Reduced motion skips straight to "settled" with no pop and
// no shrink transition.
type Phase = "counting" | "pop" | "settled";

const BADGE_SIZE: Record<Phase, string> = {
  counting:
    "text-sm sm:text-lg px-5 py-3 sm:px-7 sm:py-4 shadow-lg hover:shadow-[0_0_24px_rgba(250,204,21,0.6)]",
  pop: "text-sm sm:text-lg px-5 py-3 sm:px-7 sm:py-4 shadow-lg hover:shadow-[0_0_24px_rgba(250,204,21,0.6)]",
  settled:
    "text-[11px] sm:text-sm px-3 py-1 sm:px-4 sm:py-1.5 hover:shadow-[0_0_20px_rgba(250,204,21,0.5)]",
};

const NUMBER_SIZE: Record<Phase, string> = {
  counting: "text-xl sm:text-3xl font-extrabold scale-100",
  pop: "text-xl sm:text-3xl font-extrabold scale-125",
  settled: "text-[11px] sm:text-sm font-bold scale-100",
};

// Pop is a quick transform-only bounce (font-size doesn't change between
// counting and pop, so only scale needs to animate, fast). Settling back
// down changes font-size too, so it needs its own longer transition-all —
// without this the shrink snapped instantly instead of animating.
const NUMBER_TRANSITION: Record<Phase, string> = {
  counting: "",
  pop: "transition-transform duration-200 ease-out",
  settled: "transition-all duration-[350ms] ease-out",
};

export default function HeroSlotBadge() {
  const [phase, setPhase] = useState<Phase>("counting");

  function handleDone() {
    if (prefersReducedMotion()) {
      setPhase("settled");
      return;
    }
    setPhase("pop");
    setTimeout(() => setPhase("settled"), 200);
  }

  return (
    <Link
      href="/quote"
      className={`inline-flex items-center gap-2 bg-yellow-400 hover:bg-yellow-300 text-blue-900 font-bold rounded-full mb-6 transition-all duration-[350ms] ease-out hover:scale-105 ${BADGE_SIZE[phase]}`}
    >
      <SlotCountdown
        onDone={handleDone}
        className={`${NUMBER_TRANSITION[phase]} ${NUMBER_SIZE[phase]}`}
      />
      <span>
        Campaign Slots Left for {campaignSlots.monthLabel}, secure your slot
        today
      </span>
    </Link>
  );
}
