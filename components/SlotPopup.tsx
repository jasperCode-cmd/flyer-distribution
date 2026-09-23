"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { campaignSlots } from "@/lib/campaign-constants";
import SlotCountdown from "./SlotCountdown";

const DISMISS_KEY = "fdh-slot-popup-dismissed";
const SHOW_AFTER_MS = 16000;
const BACKDROP_GUARD_MS = 1000;

export default function SlotPopup() {
  const pathname = usePathname();
  const skip = pathname === "/quote" || pathname.startsWith("/admin/crm");

  const [visible, setVisible] = useState(false);
  const [canDismissOnBackdrop, setCanDismissOnBackdrop] = useState(false);
  const guardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (skip) return;
    let dismissed = false;
    try {
      dismissed = sessionStorage.getItem(DISMISS_KEY) === "1";
    } catch {}
    if (dismissed) return;

    const showTimer = setTimeout(() => setVisible(true), SHOW_AFTER_MS);
    return () => clearTimeout(showTimer);
  }, [skip]);

  useEffect(() => {
    if (!visible) return;
    setCanDismissOnBackdrop(false);
    guardTimerRef.current = setTimeout(() => setCanDismissOnBackdrop(true), BACKDROP_GUARD_MS);

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") dismiss();
    }
    document.addEventListener("keydown", onKeyDown);

    return () => {
      if (guardTimerRef.current) clearTimeout(guardTimerRef.current);
      document.removeEventListener("keydown", onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  function dismiss() {
    setVisible(false);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {}
  }

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/60 popup-backdrop"
      onClick={() => {
        if (canDismissOnBackdrop) dismiss();
      }}
    >
      <div
        className="relative bg-white rounded-lg shadow-2xl max-w-sm w-full p-6 popup-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={dismiss}
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
        <p className="text-blue-900 font-bold text-lg mb-2 pr-6">
          <SlotCountdown triggered={visible} /> Distribution Campaign Slots
          Left for {campaignSlots.monthLabel}
        </p>
        <p className="text-gray-600 text-sm mb-5">
          Get in touch before this month&apos;s slots are gone.
        </p>
        <Link
          href="/quote"
          onClick={dismiss}
          className="inline-block w-full text-center bg-blue-700 hover:bg-blue-800 text-white font-bold px-6 py-3 rounded-md text-sm transition duration-200 ease-out hover:scale-105"
        >
          Get a Quote
        </Link>
      </div>
    </div>
  );
}
