"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { campaignSlots, slotNoun } from "@/lib/campaign-constants";
import SlotCountReveal from "./SlotCountReveal";

export default function AnnouncementBar() {
  const pathname = usePathname();
  if (pathname === "/quote" || pathname.startsWith("/admin/crm")) return null;

  return (
    <Link
      href="/quote"
      className="block bg-yellow-400 hover:bg-yellow-300 transition-colors duration-200 text-center px-2 py-2.5"
    >
      <p className="text-blue-900 text-[13px] sm:text-base leading-snug">
        <span className="font-heading font-bold">
          <SlotCountReveal value={campaignSlots.slotsRemaining} />
          {` Campaign ${slotNoun(campaignSlots.slotsRemaining)} Available for ${campaignSlots.monthLabel}`}
        </span>
        , secure your slot today
      </p>
    </Link>
  );
}
