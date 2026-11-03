"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { hidesSiteChrome } from "@/lib/site-chrome";
import { campaignSlots, slotNoun } from "@/lib/campaign-constants";
import SlotCountdown from "./SlotCountdown";

// Shown at most once per visit: recorded in sessionStorage the moment it
// appears, whether it is then closed, clicked or ignored, so no other page in
// the same visit shows it again. The key's name dates from when it was only
// recorded on closing. Never shown to someone who has sent a quote request in
// this visit. If sessionStorage cannot be used, the flags below in memory
// still limit it to once per page load.
const SEEN_KEY = "fdh-slot-popup-dismissed";
const QUOTE_SENT_KEY = "fdh-quote-request-sent";
const SHOW_AFTER_MS = 13000;
const BACKDROP_GUARD_MS = 1000;

// The quote form's own subject field, which marks a quote request (the
// distributor application form has its own). The quote form is not changed
// for this: a submit only fires once the browser's checks pass, and the
// request is sent straight after.
export const QUOTE_REQUEST_SUBJECT = "New Quote Request - Flyer Distribution Hampshire";

let shownThisPageLoad = false;
let quoteSentThisPageLoad = false;

function readFlag(key: string): boolean {
  try {
    return sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function setFlag(key: string) {
  try {
    sessionStorage.setItem(key, "1");
  } catch {}
}

function mayShow(): boolean {
  return !shownThisPageLoad && !quoteSentThisPageLoad && !readFlag(SEEN_KEY) && !readFlag(QUOTE_SENT_KEY);
}

export default function SlotPopup() {
  const pathname = usePathname();
  const skip = pathname === "/quote" || hidesSiteChrome(pathname);

  const [visible, setVisible] = useState(false);
  const [canDismissOnBackdrop, setCanDismissOnBackdrop] = useState(false);
  const guardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A quote request sent on any page, including /quote, means no popup for
  // the rest of the visit.
  useEffect(() => {
    function onSubmit(e: Event) {
      const form = e.target;
      if (!(form instanceof HTMLFormElement)) return;
      const subject = form.querySelector<HTMLInputElement>('input[name="subject"]')?.value;
      if (subject !== QUOTE_REQUEST_SUBJECT) return;
      quoteSentThisPageLoad = true;
      setFlag(QUOTE_SENT_KEY);
    }
    document.addEventListener("submit", onSubmit, true);
    return () => document.removeEventListener("submit", onSubmit, true);
  }, []);

  useEffect(() => {
    if (skip) return;

    // ?resetpopup=1 clears the "already shown this visit" flag so the popup
    // can be re-tested without opening a fresh browser context.
    try {
      if (new URLSearchParams(window.location.search).get("resetpopup") === "1") {
        sessionStorage.removeItem(SEEN_KEY);
      }
    } catch {}

    if (!mayShow()) return;

    const showTimer = setTimeout(() => {
      // Checked again: a quote may have been sent in the meantime.
      if (!mayShow()) return;
      shownThisPageLoad = true;
      setFlag(SEEN_KEY);
      setVisible(true);
    }, SHOW_AFTER_MS);
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

  // Already recorded as shown when it appeared, so closing only hides it.
  function dismiss() {
    setVisible(false);
  }

  // Never on /quote or the pages without the site around them.
  if (!visible || skip) return null;

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
        <p className="font-heading text-blue-900 font-bold text-lg mb-2 pr-6">
          <SlotCountdown
            triggered={visible}
            label={(count) =>
              ` Distribution Campaign ${slotNoun(count)} Available for ${campaignSlots.monthLabel}`
            }
          />
        </p>
        <p className="text-gray-600 text-base mb-5">
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
