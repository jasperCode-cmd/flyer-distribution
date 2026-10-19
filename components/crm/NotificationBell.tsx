"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { APPLICATIONS_CHANGED_EVENT } from "@/lib/distributor-applications";
import type { Business } from "@/lib/business";
import BusinessBadge from "./BusinessBadge";

const POLL_MS = 45000;

// One line of the toast; a Bournemouth enquiry carries the badge.
type ToastLine = { text: string; business?: Business };

type Notifications = {
  count: number;
  websiteLeads: { id: string; name: string; createdAt: string; business?: Business }[];
  // Older responses (a deploy mid-session) may not have this yet.
  newApplications?: { id: string; fullName: string; receivedAt: string; business?: Business }[];
  dueCallbacks: { id: string; name: string; nextCallableAt: string }[];
  followUps: { id: string; description: string; leadId: string; leadName: string; overdue: boolean }[];
};

// Shared identically for both users, not scoped to assignment, and
// backed by plain polling rather than any real-time infrastructure, which
// is the appropriate amount of complexity for a two-person internal tool.
// Also owns the live inbound-lead toast: a website lead whose id wasn't
// present on this component's first successful poll, appearing in a later
// one, is treated as "just arrived" for this browser tab and toasted once.
// New distributor applications from the website form work the same way.
// menuAlign="left" opens the menu from the bell's left edge, for the side
// navigation where there's no room to its left.
export default function NotificationBell({ menuAlign = "right" }: { menuAlign?: "left" | "right" }) {
  const [data, setData] = useState<Notifications | null>(null);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<ToastLine[] | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const knownWebsiteIdsRef = useRef<Set<string> | null>(null);
  const knownApplicationIdsRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      // A tab in the background doesn't poll; it catches up when shown again.
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/crm/notifications");
        if (!res.ok || cancelled) return;
        const next: Notifications = await res.json();

        const incomingIds = new Set(next.websiteLeads.map((l) => l.id));
        const applications = next.newApplications ?? [];
        const incomingApplicationIds = new Set(applications.map((a) => a.id));
        if (knownWebsiteIdsRef.current === null || knownApplicationIdsRef.current === null) {
          // First poll this tab has ever done, establishes the baseline,
          // deliberately not toasted, or every pre-existing website lead
          // would pop up the moment the CRM is opened.
          knownWebsiteIdsRef.current = incomingIds;
          knownApplicationIdsRef.current = incomingApplicationIds;
        } else {
          const newOnes = next.websiteLeads.filter((l) => !knownWebsiteIdsRef.current!.has(l.id));
          const newApplications = applications.filter((a) => !knownApplicationIdsRef.current!.has(a.id));
          const messages: ToastLine[] = [];
          if (newOnes.length === 1) {
            messages.push({ text: `New website enquiry: ${newOnes[0].name}`, business: newOnes[0].business });
          } else if (newOnes.length > 1) {
            const ldb = newOnes.filter((l) => l.business === "LDB").length;
            messages.push({
              text: `${newOnes.length} new website enquiries just came in${ldb > 0 ? `, ${ldb} for Bournemouth` : ""}`,
            });
          }
          if (newApplications.length === 1) {
            messages.push({
              text: `New distributor application: ${newApplications[0].fullName}`,
              business: newApplications[0].business,
            });
          } else if (newApplications.length > 1) {
            const ldb = newApplications.filter((a) => a.business === "LDB").length;
            messages.push({
              text: `${newApplications.length} new distributor applications just came in${ldb > 0 ? `, ${ldb} for Bournemouth` : ""}`,
            });
          }
          if (messages.length > 0) setToast(messages);
          knownWebsiteIdsRef.current = incomingIds;
          knownApplicationIdsRef.current = incomingApplicationIds;
        }

        if (!cancelled) setData(next);
      } catch {
        // A missed poll just tries again next interval, nothing to show.
      }
    }

    poll();
    const interval = setInterval(poll, POLL_MS);
    // An application approved or moved on from New (one at a time or in
    // bulk) leaves the bell straight away rather than at the next poll.
    window.addEventListener(APPLICATIONS_CHANGED_EVENT, poll);
    document.addEventListener("visibilitychange", poll);
    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener(APPLICATIONS_CHANGED_EVENT, poll);
      document.removeEventListener("visibilitychange", poll);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 8000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const count = data?.count ?? 0;

  return (
    <>
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label="Notifications"
          aria-expanded={open}
          className="relative p-2 rounded-md text-blue-100 hover:bg-blue-800/60 transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .53-.21 1.04-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </button>

        {open && (
          <div
            role="menu"
            className={`absolute ${menuAlign === "left" ? "left-0" : "right-0"} mt-1 w-80 max-h-[70vh] overflow-y-auto bg-white rounded-md border border-gray-200 shadow-lg py-1 z-50`}
          >
            {count === 0 ? (
              <p className="px-3 py-4 text-sm text-gray-400 text-center">Nothing needs attention.</p>
            ) : (
              <>
                {data!.websiteLeads.length > 0 && (
                  <div>
                    <p className="px-3 pt-2 pb-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                      New Website Enquiries
                    </p>
                    {data!.websiteLeads.map((l) => (
                      <Link
                        key={l.id}
                        href={`/admin/crm/leads/${l.id}`}
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <span className="truncate">{l.name}</span>
                        <BusinessBadge business={l.business} />
                      </Link>
                    ))}
                  </div>
                )}
                {(data!.newApplications ?? []).length > 0 && (
                  <div>
                    <p className="px-3 pt-2 pb-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                      New Applications
                    </p>
                    {data!.newApplications!.map((a) => (
                      <Link
                        key={a.id}
                        href={`/admin/crm/applications/${a.id}`}
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <span className="truncate">{a.fullName}</span>
                        <BusinessBadge business={a.business} />
                      </Link>
                    ))}
                  </div>
                )}
                {data!.dueCallbacks.length > 0 && (
                  <div>
                    <p className="px-3 pt-2 pb-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                      Callbacks Due
                    </p>
                    {data!.dueCallbacks.map((l) => (
                      <Link
                        key={l.id}
                        href="/admin/crm/scheduled-callbacks"
                        onClick={() => setOpen(false)}
                        className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        {l.name}
                      </Link>
                    ))}
                  </div>
                )}
                {data!.followUps.length > 0 && (
                  <div>
                    <p className="px-3 pt-2 pb-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                      Follow-ups
                    </p>
                    {data!.followUps.map((t) => (
                      <Link
                        key={t.id}
                        href={`/admin/crm/leads/${t.leadId}`}
                        onClick={() => setOpen(false)}
                        className="flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50"
                      >
                        <span className="text-gray-700 truncate">{t.leadName}</span>
                        {t.overdue && <span className="text-red-600 text-[11px] font-semibold shrink-0 ml-2">Overdue</span>}
                      </Link>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed top-20 right-4 z-[60] bg-blue-900 text-white text-sm rounded-lg shadow-xl px-4 py-3 flex items-center gap-3 max-w-xs animate-in fade-in">
          <span className="flex-1 space-y-1">
            {toast.map((line) => (
              <span key={line.text} className="flex flex-wrap items-center gap-1.5">
                <span>{line.text}</span>
                <BusinessBadge business={line.business} />
              </span>
            ))}
          </span>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Dismiss"
            className="text-blue-200 hover:text-white font-bold shrink-0"
          >
            ×
          </button>
        </div>
      )}
    </>
  );
}
