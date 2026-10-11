"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import SearchBar from "./SearchBar";
import NotificationBell from "./NotificationBell";
import AccountMenu from "./AccountMenu";
import NavMenu from "./NavMenu";
import {
  CRM_NAV_ATTRIBUTE,
  CRM_NAV_GROUPS,
  isNavItemActive,
  readStoredNavPosition,
  storeNavPosition,
  type CrmNavItem,
  type CrmNavPosition,
} from "@/lib/crm-nav";
import { APPLICATIONS_CHANGED_EVENT } from "@/lib/distributor-applications";

// The links and their groups come from CRM_NAV_GROUPS in lib/crm-nav.ts.
// The desktop top bar starts at 1024px (narrower screens use the menu
// button): Dashboard, Leads, Inbox and Dialer are direct links there and
// Jobs, Team and Tools are dropdowns. The side navigation and phone menu
// list every group under its own heading.

// Same style as the old "More" heading in the side navigation.
const GROUP_HEADING = "text-[11px] font-semibold uppercase tracking-wide text-blue-200";

// Unread conversations in the Gmail inbox, shown beside the Inbox link.
// Nothing when Gmail isn't connected, the count is zero, or it failed.
function InboxCount({ count }: { count: { value: number; more: boolean } | null }) {
  if (!count || count.value <= 0) return null;
  const label = count.more || count.value > 99 ? "99+" : String(count.value);
  return (
    <span
      className="ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-yellow-400 px-1.5 text-[11px] font-bold leading-5 text-blue-900"
      aria-label={`${label} unread`}
    >
      {label}
    </span>
  );
}

// Applications still marked New, shown beside the Applications link.
function ApplicationsCount({ count, className = "" }: { count: number | null; className?: string }) {
  if (!count || count <= 0) return null;
  const label = count > 99 ? "99+" : String(count);
  return (
    <span
      className={`ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-yellow-400 px-1.5 text-[11px] font-bold leading-5 text-blue-900 ${className}`}
      aria-label={`${label} new applications`}
    >
      {label}
    </span>
  );
}

export default function CrmShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  // Which top bar dropdown is open, if any: only one at a time.
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [inboxCount, setInboxCount] = useState<{ value: number; more: boolean } | null>(null);
  const [applicationsCount, setApplicationsCount] = useState<number | null>(null);

  // Desktop navigation position. Layout comes from the data attribute the
  // CRM layout's inline script puts on <html> before first paint; this state
  // only decides where the single NotificationBell lives (it polls, so it is
  // never mounted twice) and which toggle label to show.
  const [navPosition, setNavPosition] = useState<CrmNavPosition>("top");
  const [isDesktop, setIsDesktop] = useState(false);
  const sideActive = navPosition === "side" && isDesktop;

  useEffect(() => {
    const attr = document.documentElement.getAttribute(CRM_NAV_ATTRIBUTE);
    // The inline script normally sets this; fall back to storage in case it
    // didn't run (a client-side navigation into the CRM, say).
    const position: CrmNavPosition = attr === "side" || attr === "top" ? attr : readStoredNavPosition();
    document.documentElement.setAttribute(CRM_NAV_ATTRIBUTE, position);
    setNavPosition(position);

    const desktop = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(desktop.matches);
    update();
    desktop.addEventListener("change", update);
    return () => desktop.removeEventListener("change", update);
  }, []);

  function moveNav(position: CrmNavPosition) {
    storeNavPosition(position);
    document.documentElement.setAttribute(CRM_NAV_ATTRIBUTE, position);
    setNavPosition(position);
    setOpenMenu(null);
  }

  // Fetched once when the shell mounts (it persists across CRM navigation).
  // No polling: the badge refreshes on the next full page load.
  useEffect(() => {
    if (pathname === "/admin/crm/login") return;
    let cancelled = false;
    fetch("/api/crm/inbox/unread-count")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.configured) setInboxCount({ value: data.count ?? 0, more: !!data.more });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A plain database count, so it is refreshed on every CRM navigation and
  // goes down as soon as an application is moved on from New.
  useEffect(() => {
    if (pathname === "/admin/crm/login") return;
    let cancelled = false;
    function refresh() {
      fetch("/api/crm/applications/count")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!cancelled && typeof data?.count === "number") setApplicationsCount(data.count);
        })
        .catch(() => {});
    }
    refresh();
    window.addEventListener(APPLICATIONS_CHANGED_EVENT, refresh);
    return () => {
      cancelled = true;
      window.removeEventListener(APPLICATIONS_CHANGED_EVENT, refresh);
    };
  }, [pathname]);

  // Navigating away should never leave a menu hanging open.
  useEffect(() => {
    setOpenMenu(null);
  }, [pathname]);

  const renderCount = useCallback(
    (item: CrmNavItem) =>
      item.count === "inbox" ? (
        <InboxCount count={inboxCount} />
      ) : item.count === "applications" ? (
        <ApplicationsCount count={applicationsCount} />
      ) : null,
    [inboxCount, applicationsCount]
  );

  // The login page renders standalone, without the authenticated shell.
  if (pathname === "/admin/crm/login") {
    return <>{children}</>;
  }

  // While a password change is forced, hide the rest of the nav so the
  // only way forward is the change-password page middleware already
  // redirects everything else back to.
  const forcedChange = session?.user?.mustChangePassword === true;

  return (
    <div className="min-h-screen flex flex-col bg-gray-100 lg:crm-side:pl-60">
      {/* Side navigation: desktop only, and only when chosen. Holds every
          item from the top bar, with the "More" items listed in full. */}
      <aside
        aria-label="CRM navigation"
        className="hidden lg:crm-side:flex fixed inset-y-0 left-0 z-40 w-60 flex-col bg-blue-900 text-white"
      >
        <div className="flex h-20 shrink-0 items-center justify-between gap-2 border-b border-blue-800 px-4">
          <Link href="/admin/crm" className="flex min-w-0 items-center gap-2">
            <Image
              src="/Flyer Distribution Logo White Cropped.webp"
              width={270}
              height={100}
              alt="Flyer Distribution Hampshire"
              className="h-11 w-auto"
            />
            <span className="font-bold text-sm tracking-wide">CRM</span>
          </Link>
          {!forcedChange && sideActive && <NotificationBell menuAlign="left" />}
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4">
          {!forcedChange && (
            <>
              <div className="mb-4 px-1">
                <SearchBar />
              </div>
              <nav aria-label="Main">
                {CRM_NAV_GROUPS.map((group) => (
                  <div
                    key={group.id}
                    role="group"
                    aria-labelledby={group.label ? `side-nav-${group.id}` : undefined}
                    aria-label={group.label ? undefined : "Dashboard"}
                    className="space-y-1"
                  >
                    {group.label && (
                      <p id={`side-nav-${group.id}`} className={`mt-5 mb-1 px-3 ${GROUP_HEADING}`}>
                        {group.label}
                      </p>
                    )}
                    {group.items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={isNavItemActive(pathname, item.href) ? "page" : undefined}
                        className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 ${
                          isNavItemActive(pathname, item.href)
                            ? "bg-blue-800 text-yellow-400"
                            : "text-blue-100 hover:bg-blue-800/60"
                        }`}
                      >
                        {item.label}
                        {renderCount(item)}
                      </Link>
                    ))}
                  </div>
                ))}
              </nav>
            </>
          )}
        </div>

        <div className="shrink-0 space-y-2 border-t border-blue-800 px-4 py-4">
          {session?.user && <p className="truncate text-xs text-blue-200">{session.user.name}</p>}
          {!forcedChange && (
            <Link
              href="/admin/crm/change-password"
              className="block text-xs text-blue-100 hover:text-yellow-400"
            >
              Account Settings
            </Link>
          )}
          {!forcedChange && (
            <button
              type="button"
              onClick={() => moveNav("top")}
              className="block text-left text-xs text-blue-100 hover:text-yellow-400"
            >
              Move menu to top
            </button>
          )}
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/admin/crm/login" })}
            className="w-full bg-yellow-400 hover:bg-yellow-300 text-blue-900 text-xs font-bold px-3 py-1.5 rounded-md transition-colors duration-150"
          >
            Sign out
          </button>
        </div>
      </aside>

      <header className="bg-blue-900 text-white sticky top-0 z-40 lg:crm-side:hidden">
        {/* From 1024 to 1279px the bar is tight, so the side padding, the
            "CRM" label and the search box give way to the navigation. */}
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-4 xl:px-6 flex items-center justify-between h-20">
          <div className="flex items-center gap-4 min-w-0">
            <Link href="/admin/crm" className="shrink-0 flex items-center gap-3">
              <Image
                src="/Flyer Distribution Logo White Cropped.webp"
                width={270}
                height={100}
                alt="Flyer Distribution Hampshire"
                className="h-14 w-auto lg:h-11 xl:h-14"
              />
              <span className="font-bold text-sm tracking-wide hidden sm:inline lg:hidden xl:inline">
                CRM
              </span>
            </Link>
            {!forcedChange && (
              <nav aria-label="Main" className="hidden lg:flex items-center gap-0.5 xl:gap-1 ml-3 xl:ml-6">
                {CRM_NAV_GROUPS.map((group) =>
                  group.topBar === "links" ? (
                    group.items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={isNavItemActive(pathname, item.href) ? "page" : undefined}
                        className={`inline-flex items-center px-2 xl:px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 ${
                          isNavItemActive(pathname, item.href)
                            ? "bg-blue-800 text-yellow-400"
                            : "text-blue-100 hover:bg-blue-800/60"
                        }`}
                      >
                        {item.label}
                        {renderCount(item)}
                      </Link>
                    ))
                  ) : (
                    <NavMenu
                      key={group.id}
                      group={group}
                      pathname={pathname}
                      open={openMenu === group.id}
                      onOpenChange={(open) => setOpenMenu(open ? group.id : null)}
                      renderCount={renderCount}
                      footer={
                        group.id === "tools"
                          ? (close) => (
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  close();
                                  moveNav("side");
                                }}
                                className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:bg-gray-100"
                              >
                                Move menu to side
                              </button>
                            )
                          : undefined
                      }
                    />
                  )
                )}
              </nav>
            )}
          </div>

          <div className="flex items-center gap-3">
            {!forcedChange && <div className="hidden lg:block lg:w-36 xl:w-auto"><SearchBar /></div>}
            {!forcedChange && !sideActive && <NotificationBell />}
            {session?.user && (
              <span className="hidden sm:inline lg:hidden text-xs text-blue-200 truncate max-w-[160px]">
                {session.user.name}
              </span>
            )}
            <AccountMenu className="hidden lg:block" name={session?.user?.name} showSettings={!forcedChange} />
            <button
              type="button"
              aria-label="Toggle menu"
              onClick={() => setMenuOpen((o) => !o)}
              className="lg:hidden p-2 -mr-2"
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
          <nav className="lg:hidden border-t border-blue-800 bg-blue-900 px-4 py-2">
            {!forcedChange && (
              <div className="py-2">
                <SearchBar />
              </div>
            )}
            {!forcedChange &&
              CRM_NAV_GROUPS.map((group) => (
                <div
                  key={group.id}
                  role="group"
                  aria-labelledby={group.label ? `phone-nav-${group.id}` : undefined}
                  aria-label={group.label ? undefined : "Dashboard"}
                >
                  {group.label && (
                    <p id={`phone-nav-${group.id}`} className={`mt-3 mb-0.5 px-2 ${GROUP_HEADING}`}>
                      {group.label}
                    </p>
                  )}
                  {group.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMenuOpen(false)}
                      aria-current={isNavItemActive(pathname, item.href) ? "page" : undefined}
                      className={`flex items-center px-2 py-2.5 rounded-md text-sm ${
                        isNavItemActive(pathname, item.href)
                          ? "bg-blue-800 text-yellow-400 font-semibold"
                          : "text-blue-100 hover:text-yellow-400"
                      }`}
                    >
                      {item.label}
                      {renderCount(item)}
                    </Link>
                  ))}
                </div>
              ))}
            {!forcedChange && <div className="mt-2 border-t border-blue-800" />}
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
