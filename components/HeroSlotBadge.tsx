"use client";

import Link from "next/link";
import { campaignSlots } from "@/lib/campaign-constants";
import SlotCountReveal from "./SlotCountReveal";

export default function HeroSlotBadge() {
  return (
    <Link
      href="/quote"
      className="inline-block bg-yellow-400 hover:bg-yellow-300 hover:shadow-[0_0_20px_rgba(250,204,21,0.5)] text-blue-900 text-[11px] leading-tight sm:text-sm font-semibold px-3 py-1 sm:px-4 sm:py-1.5 rounded-full mb-4 transition duration-200 ease-out hover:scale-105"
    >
      <SlotCountReveal value={campaignSlots.slotsRemaining} className="font-bold" />{" "}
      Campaign Slots Left for {campaignSlots.monthLabel} — Secure your slot
      today
    </Link>
  );
}
