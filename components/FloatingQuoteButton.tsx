"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { hidesSiteChrome } from "@/lib/site-chrome";
import styles from "./FloatingQuoteButton.module.css";

const HERO_EXIT_DELAY_MS = 3000;
// How long the pill and the panel take to animate out before they are
// removed: the same as their transitions in FloatingQuoteButton.module.css.
const PILL_LEAVE_MS = 200;
const PANEL_LEAVE_MS = 530;

// The quote form is only fetched (a dynamic import) the first time the panel
// is opened, so no page loads it for the many visitors who never open the
// panel. Held in state rather than behind Suspense, so it shows the moment
// it arrives. While it is on its way the panel shows a small loading state;
// if it can't be fetched (offline, say), the panel points to the quote page,
// and opening the panel again tries again.
type QuoteFormComponent = typeof import("./QuoteForm").default;

// As tall as the form first is (three cards, with the panel's width), so the
// panel doesn't jump when it arrives.
function QuoteFormLoading() {
  return (
    <div
      role="status"
      className={`flex min-h-[592px] md:min-h-[319px] items-center justify-center gap-3 text-sm text-gray-600 ${styles.loading}`}
    >
      <span
        aria-hidden="true"
        className="h-5 w-5 rounded-full border-2 border-blue-200 border-t-blue-700 motion-safe:animate-spin"
      />
      Loading the quote form...
    </div>
  );
}

function QuoteFormUnavailable() {
  return (
    <div role="alert" className="py-8 text-center text-gray-600">
      The quote form could not be loaded. Please check your connection, or{" "}
      <Link href="/quote" className="text-blue-700 underline font-medium">
        open the quote page
      </Link>
      .
    </div>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 shrink-0">
      <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.897 28.897 0 0015.293-7.155.75.75 0 000-1.114A28.897 28.897 0 003.105 2.289z" />
    </svg>
  );
}

function CloseIcon() {
  return (
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
  );
}

type Stage = "gone" | "enter" | "shown" | "leave";

// Keeps the pill or the panel on the page while it animates in and out with
// CSS transitions. "enter" draws it at its starting look, and two frames
// later "shown" lets it transition in. Hidden, "leave" lets it transition
// out for leaveMs before it is removed ("gone"). Shown again on its way out,
// it turns back from where it is, as with framer-motion before.
function usePresence(show: boolean, leaveMs: number): Stage {
  const [stage, setStage] = useState<Stage>(show ? "enter" : "gone");
  const [wasShown, setWasShown] = useState(show);
  if (show !== wasShown) {
    setWasShown(show);
    if (show) setStage(stage === "gone" ? "enter" : "shown");
    else setStage(stage === "enter" ? "gone" : "leave");
  }
  useEffect(() => {
    if (stage === "enter") {
      let frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => setStage("shown"));
      });
      return () => cancelAnimationFrame(frame);
    }
    if (stage === "leave") {
      const timer = setTimeout(() => setStage("gone"), leaveMs);
      return () => clearTimeout(timer);
    }
  }, [stage, leaveMs]);
  return stage;
}

// Sitewide floating "Get a Quote" launcher. Reuses the same QuoteForm used
// on /quote rather than duplicating it. On the homepage it stays hidden
// until the hero has scrolled fully out of view, then waits a cancelable
// 3s before appearing (mirrors the scroll-aware reveal pattern, but with
// its own IntersectionObserver on the hero rather than watching itself).
// Never shown on /quote itself, since that page already has its own
// full-size form, or on the internal /admin/crm tool.
export default function FloatingQuoteButton() {
  const pathname = usePathname();
  const skip = pathname === "/quote" || hidesSiteChrome(pathname);
  const isHomepage = pathname === "/";

  const [visible, setVisible] = useState(!isHomepage);
  const [open, setOpen] = useState(false);
  const [hasOpenedOnce, setHasOpenedOnce] = useState(false);
  const [footerInView, setFooterInView] = useState(false);
  const [QuoteForm, setQuoteForm] = useState<QuoteFormComponent | null>(null);
  const [formFailed, setFormFailed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const pillStage = usePresence(!skip && visible && !open && !footerInView, PILL_LEAVE_MS);
  const panelStage = usePresence(!skip && open, PANEL_LEAVE_MS);

  useEffect(() => {
    if (!open || QuoteForm) return;
    import("./QuoteForm").then(
      (loaded) => setQuoteForm(() => loaded.default),
      () => setFormFailed(true)
    );
  }, [open, QuoteForm]);

  useEffect(() => {
    if (skip || !isHomepage) return;
    const heroEl = document.getElementById("hero");
    if (!heroEl) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (timer) {
            clearTimeout(timer);
            timer = null;
          }
          setVisible(false);
        } else {
          timer = setTimeout(() => setVisible(true), HERO_EXIT_DELAY_MS);
        }
      },
      { threshold: 0 }
    );
    observer.observe(heroEl);

    return () => {
      observer.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, [skip, isHomepage]);

  // Hidden while the site footer is on screen (or about to be, via the
  // bottom rootMargin, so the exit animation finishes first), so the pill
  // never sits on top of a footer link or the partner credit below it. The
  // footer has its own Get a Quote link. Re-run per pathname so a footer
  // remounted by a route change is the one being observed.
  useEffect(() => {
    if (skip) return;
    const footerEl = document.getElementById("site-footer");
    if (!footerEl) return;
    const observer = new IntersectionObserver(
      ([entry]) => setFooterInView(entry.isIntersecting),
      { rootMargin: "0px 0px 120px 0px" }
    );
    observer.observe(footerEl);
    return () => observer.disconnect();
  }, [skip, pathname]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onClickOutside);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, [open]);

  if (skip) return null;

  function handleOpen() {
    setOpen(true);
    setHasOpenedOnce(true);
    setFormFailed(false);
  }

  // Idle attention wiggle while resting and unopened; stops for good the
  // first time the panel is opened, per hasOpenedOnce rather than `open`
  // alone, so it doesn't resume after the user closes the panel again.
  const wiggling = visible && !open && !hasOpenedOnce && !footerInView;

  return (
    <div ref={containerRef} className="fixed bottom-6 right-6 z-50">
      {pillStage !== "gone" && (
        <button
          type="button"
          onClick={handleOpen}
          data-stage={pillStage}
          className={`${styles.pill} origin-bottom-right flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-bold pl-4 pr-5 py-3.5 rounded-full shadow-lg`}
        >
          <span className={`flex items-center gap-2${wiggling ? ` ${styles.wiggle}` : ""}`}>
            <SendIcon />
            <span className="text-sm">Get a Quote</span>
          </span>
        </button>
      )}

      {panelStage !== "gone" && (
        <div
          data-stage={panelStage}
          // Named for screen readers; the form's own "Get Your Free Quote"
          // is the only heading seen, so there's no second one above it.
          role="region"
          aria-label="Get a Quote"
          className={`${styles.panel} origin-bottom-right relative bg-white rounded-2xl shadow-2xl w-[calc(100vw-32px)] sm:w-[460px] md:w-[min(560px,92vw)]`}
        >
          <div className="max-h-[85vh] overflow-y-auto rounded-2xl p-6 pb-20">
            {QuoteForm ? <QuoteForm inPanel /> : formFailed ? <QuoteFormUnavailable /> : <QuoteFormLoading />}
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="absolute bottom-4 right-4 flex items-center justify-center w-11 h-11 rounded-full bg-blue-700 hover:bg-blue-800 text-white shadow-lg transition-colors"
          >
            <CloseIcon />
          </button>
        </div>
      )}
    </div>
  );
}
