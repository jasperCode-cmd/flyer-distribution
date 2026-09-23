"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useAnimation } from "framer-motion";
import QuoteForm from "./QuoteForm";

const HERO_EXIT_DELAY_MS = 3000;
const IDLE_WIGGLE_INTERVAL_MS = 7000;

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

// Sitewide floating "Get a Quote" launcher. Reuses the same QuoteForm used
// on /quote rather than duplicating it. On the homepage it stays hidden
// until the hero has scrolled fully out of view, then waits a cancelable
// 3s before appearing (mirrors the scroll-aware reveal pattern, but with
// its own IntersectionObserver on the hero rather than watching itself).
// Never shown on /quote itself, since that page already has its own
// full-size form, or on the internal /admin/crm tool.
export default function FloatingQuoteButton() {
  const pathname = usePathname();
  const skip = pathname === "/quote" || pathname.startsWith("/admin/crm");
  const isHomepage = pathname === "/";

  const [visible, setVisible] = useState(!isHomepage);
  const [open, setOpen] = useState(false);
  const [hasOpenedOnce, setHasOpenedOnce] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const wiggleControls = useAnimation();

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

  // Idle attention wiggle while resting and unopened; stops for good the
  // first time the panel is opened, per hasOpenedOnce rather than `open`
  // alone, so it doesn't resume after the user closes the panel again.
  useEffect(() => {
    if (skip || !visible || open || hasOpenedOnce) return;
    const interval = setInterval(() => {
      wiggleControls.start({
        rotate: [0, -8, 8, -5, 5, 0],
        transition: { duration: 0.6, ease: "easeInOut" },
      });
    }, IDLE_WIGGLE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [skip, visible, open, hasOpenedOnce, wiggleControls]);

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
  }

  return (
    <div ref={containerRef} className="fixed bottom-6 right-6 z-50">
      <AnimatePresence>
        {visible && !open && (
          <motion.button
            key="pill"
            type="button"
            onClick={handleOpen}
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.3, opacity: 0, transition: { duration: 0.2 } }}
            transition={{ type: "spring", stiffness: 400, damping: 26 }}
            whileHover={{ scale: 1.12, transition: { duration: 0.18, ease: "easeOut" } }}
            className="origin-bottom-right flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-bold pl-4 pr-5 py-3.5 rounded-full shadow-lg"
          >
            <motion.span animate={wiggleControls} className="flex items-center gap-2">
              <SendIcon />
              <span className="text-sm">Get a Quote</span>
            </motion.span>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.3, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="origin-bottom-right relative bg-white rounded-2xl shadow-2xl w-[calc(100vw-32px)] sm:w-[460px]"
          >
            <div className="max-h-[85vh] overflow-y-auto rounded-2xl p-6 pb-20">
              <h2 className="text-xl font-bold text-blue-900 mb-4">
                Get a Quote
              </h2>
              <QuoteForm />
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute bottom-4 right-4 flex items-center justify-center w-11 h-11 rounded-full bg-blue-700 hover:bg-blue-800 text-white shadow-lg transition-colors"
            >
              <CloseIcon />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
