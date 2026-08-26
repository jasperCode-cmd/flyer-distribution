"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";

const navLinks = [
  { href: "/admin/crm", label: "Dashboard" },
  { href: "/admin/crm/leads", label: "Leads" },
  { href: "/admin/crm/leads/new", label: "Add Lead" },
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

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      <header className="bg-blue-900 text-white sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/admin/crm" className="shrink-0 flex items-center gap-2">
              <Image
                src="/Flyer Distribution Logo White Cropped.png"
                width={135}
                height={50}
                alt="Flyer Distribution Hampshire"
                className="h-7 w-auto"
              />
              <span className="font-bold text-sm tracking-wide hidden sm:inline">
                CRM
              </span>
            </Link>
            <nav className="hidden md:flex items-center gap-1 ml-4">
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
          </div>

          <div className="flex items-center gap-3">
            {session?.user && (
              <span className="hidden sm:inline text-xs text-blue-200 truncate max-w-[160px]">
                {session.user.name}
              </span>
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
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="block px-2 py-2.5 text-sm text-blue-100 hover:text-yellow-400"
              >
                {link.label}
              </Link>
            ))}
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
