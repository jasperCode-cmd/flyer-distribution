"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

function initials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

// The signed-in name, Account Settings and Sign out, gathered behind one
// small button so the top bar has room for the navigation.
export default function AccountMenu({
  name,
  showSettings,
  className = "",
}: {
  name: string | null | undefined;
  showSettings: boolean;
  className?: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const letters = initials(name);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={name ? `Account menu for ${name}` : "Account menu"}
        className="flex items-center gap-1 rounded-full p-0.5 pr-1.5 text-blue-100 hover:bg-blue-800/60 transition-colors duration-150"
      >
        <span
          aria-hidden="true"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-400 text-xs font-bold text-blue-900"
        >
          {letters || (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
            </svg>
          )}
        </span>
        <svg
          aria-hidden="true"
          className={`h-3 w-3 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-56 bg-white rounded-md border border-gray-200 shadow-lg py-1 z-50"
        >
          {name && (
            <div className="px-3 py-2 border-b border-gray-100">
              <p className="text-[11px] text-gray-400">Signed in as</p>
              <p className="text-sm font-semibold text-gray-800 truncate">{name}</p>
            </div>
          )}
          {showSettings && (
            <Link
              href="/admin/crm/change-password"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Account Settings
            </Link>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => signOut({ callbackUrl: "/admin/crm/login" })}
            className="block w-full px-3 py-2 text-left text-sm font-semibold text-blue-900 hover:bg-gray-50"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
