"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { campaignSlots } from "@/lib/campaign-constants";
import SlotCountReveal from "./SlotCountReveal";

export default function AnnouncementBar() {
  const pathname = usePathname();
  if (pathname === "/quote" || pathname.startsWith("/admin/crm")) return null;

  return (
    <Link
      href="/quote"
      className="block bg-yellow-400 hover:bg-yellow-300 transition-colors duration-200 text-center px-4 py-2"
    >
      <p className="text-blue-900 text-xs sm:text-sm leading-snug">
        <span className="font-bold">
          <SlotCountReveal value={campaignSlots.slotsRemaining} /> Campaign
          Slots Left for {campaignSlots.monthLabel}
        </span>
        , secure your slot today
      </p>
    </Link>
  );
}
