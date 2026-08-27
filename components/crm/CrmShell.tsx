"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";
import SearchBar from "./SearchBar";

const navLinks = [
  { href: "/admin/crm", label: "Dashboard" },
  { href: "/admin/crm/leads", label: "Leads" },
  { href: "/admin/crm/leads/new", label: "Add Lead" },
  { href: "/admin/crm/jobs-by-area", label: "Jobs by Area" },
  { href: "/admin/crm/calendar", label: "Calendar" },
  { href: "/admin/crm/distributors", label: "Distributors" },
  { href: "/admin/crm/map", label: "Map" },
  { href: "/admin/crm/tags", label: "Tags" },
  { href: "/admin/crm/import", label: "Import" },
];

export default function CrmShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  // The login page renders standalone, without the authenticated shell.
  if (pathname === "/admin/crm/login") {
    return <>{children}</>;
  }

  // While a password change is forced, hide the rest of the nav so the
  // only way forward is the change-password page middleware already
  // redirects everything else back to.
  const forcedChange = session?.user?.mustChangePassword === true;

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      <header className="bg-blue-900 text-white sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 flex items-center justify-between h-20">
          <div className="flex items-center gap-4 min-w-0">
            <Link href="/admin/crm" className="shrink-0 flex items-center gap-3">
              <Image
                src="/Flyer Distribution Logo White Cropped.png"
                width={270}
                height={100}
                alt="Flyer Distribution Hampshire"
                className="h-14 w-auto"
              />
              <span className="font-bold text-sm tracking-wide hidden sm:inline">
                CRM
              </span>
            </Link>
            {!forcedChange && (
              <nav className="hidden md:flex items-center gap-1 ml-6">
                {navLinks.map((link) => {
                  const active =
                    link.href === "/admin/crm"
                      ? pathname === "/admin/crm"
                      : pathname.startsWith(link.href);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 ${
                        active
                          ? "bg-blue-800 text-yellow-400"
                          : "text-blue-100 hover:bg-blue-800/60"
                      }`}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </nav>
            )}
          </div>

          <div className="flex items-center gap-3">
            {!forcedChange && <div className="hidden lg:block"><SearchBar /></div>}
            {session?.user && (
              <span className="hidden sm:inline text-xs text-blue-200 truncate max-w-[160px]">
                {session.user.name}
              </span>
            )}
            {!forcedChange && (
              <Link
                href="/admin/crm/change-password"
                className="hidden md:inline-block text-xs text-blue-100 hover:text-yellow-400 px-2"
              >
                Account Settings
              </Link>
            )}
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/admin/crm/login" })}
              className="hidden md:inline-block bg-yellow-400 hover:bg-yellow-300 text-blue-900 text-xs font-bold px-3 py-1.5 rounded-md transition-colors duration-150"
            >
              Sign out
            </button>
            <button
              type="button"
              aria-label="Toggle menu"
              onClick={() => setMenuOpen((o) => !o)}
              className="md:hidden p-2 -mr-2"
            >
              <svg
                className="w-6 h-6"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {menuOpen ? <path d="M18 6L6 18M6 6l12 12" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
              </svg>
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav className="md:hidden border-t border-blue-800 bg-blue-900 px-4 py-2">
            {!forcedChange && (
              <div className="py-2">
                <SearchBar />
              </div>
            )}
            {!forcedChange &&
              navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="block px-2 py-2.5 text-sm text-blue-100 hover:text-yellow-400"
                >
                  {link.label}
                </Link>
              ))}
            {!forcedChange && (
              <Link
                href="/admin/crm/change-password"
                onClick={() => setMenuOpen(false)}
                className="block px-2 py-2.5 text-sm text-blue-100 hover:text-yellow-400"
              >
                Account Settings
              </Link>
            )}
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/admin/crm/login" })}
              className="block w-full text-left px-2 py-2.5 text-sm text-yellow-400 font-semibold"
            >
              Sign out
            </button>
          </nav>
        )}
      </header>

      <main className="flex-1 max-w-[1600px] w-full mx-auto px-3 sm:px-6 py-4 sm:py-6">
        {children}
      </main>
    </div>
  );
}
