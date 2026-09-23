"use client";

import Link from "next/link";
import { campaignSlots } from "@/lib/campaign-constants";
import SlotCountdown from "./SlotCountdown";

export default function HeroSlotBadge() {
  return (
    <Link
      href="/quote"
      className="inline-flex items-center gap-2 bg-yellow-400 hover:bg-yellow-300 hover:shadow-[0_0_24px_rgba(250,204,21,0.6)] text-blue-900 text-sm sm:text-lg font-bold px-5 py-3 sm:px-7 sm:py-4 rounded-full mb-6 shadow-lg transition duration-200 ease-out hover:scale-105"
    >
      <SlotCountdown className="text-xl sm:text-3xl font-extrabold" />
      <span>
        Campaign Slots Left for {campaignSlots.monthLabel} — Secure your slot
        today
      </span>
    </Link>
  );
}
