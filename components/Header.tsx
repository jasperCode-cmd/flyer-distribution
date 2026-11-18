"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { hidesSiteChrome } from "@/lib/site-chrome";
import { useState, useRef, useEffect, useLayoutEffect } from "react";

type ServiceItem = { href: string; label: string; description: string; look?: "featured" | "highlight" };

// The Services menu, shared by the desktop dropdown (two columns) and the
// phone menu (one). The leaflet services lead with Leaflet Distribution, the
// most prominent (navy, its badge on a line of its own above the title, and
// opening /leaflet-delivery), then Leaflet Printing, lighter (light blue, with
// a printer icon); the rest are plain. Each says in a line what it is. Both
// end with the All services bar.
const LEAFLET_SERVICES: ServiceItem[] = [
  { href: "/leaflet-delivery", label: "Leaflet Distribution", description: "Door to door, GPS tracked. We can design and print it too.", look: "featured" },
  { href: "/leaflet-printing", label: "Leaflet Printing", description: "Flyers, leaflets and business cards", look: "highlight" },
  { href: "/services/public-notice-leafleting", label: "Public Notice Leafleting", description: "Road closures, works and consultations" },
  { href: "/services/hand-to-hand-distribution", label: "Hand-to-Hand Leaflet Distribution", description: "Leaflets handed out at events and busy spots" },
  { href: "/services/b2b-distribution", label: "B2B Leaflet Distribution", description: "Reach local businesses directly" },
];
const ADDITIONAL_SERVICES: ServiceItem[] = [
  { href: "/services/web-design-seo", label: "Web Design & SEO", description: "A site that brings in enquiries" },
  { href: "/services/screen-hire", label: "Screen Hire", description: "Mobile screen trailer for events" },
];
const BADGE = "Most popular";

const GROUP_LABEL = "text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500";
const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1";

function PrinterIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9V2h12v7" />
      <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </svg>
  );
}

// One service, as the desktop panel and the phone menu both show it: a bold
// navy title (white on the navy card) with its line underneath. Each is at
// least 44px tall.
function ServiceLink({ item, onClick }: { item: ServiceItem; onClick: () => void }) {
  if (item.look === "featured") {
    return (
      <Link href={item.href} onClick={onClick} className={`block min-h-11 rounded-xl bg-[#1e3a8a] px-4 py-3 text-white transition-colors hover:bg-[#172554] ${FOCUS}`}>
        <span className="inline-block rounded-full bg-[#facc15] px-2 py-0.5 text-[10px] font-bold uppercase leading-tight tracking-wider text-[#1e3a8a]">{BADGE}</span>
        <span className="mt-1.5 block whitespace-nowrap text-[15px] font-bold leading-snug">{item.label}</span>
        <span className="mt-0.5 block text-balance text-[13px] leading-snug text-[#dbeafe]">{item.description}</span>
      </Link>
    );
  }
  if (item.look === "highlight") {
    return (
      <Link href={item.href} onClick={onClick} className={`flex min-h-11 items-start gap-3 rounded-xl bg-[#dbeafe] px-4 py-3 transition-colors hover:bg-[#bfdbfe] ${FOCUS}`}>
        <PrinterIcon />
        <span className="min-w-0">
          <span className="block text-sm font-bold leading-snug text-[#1e3a8a]">{item.label}</span>
          <span className="mt-0.5 block text-balance text-[13px] leading-snug text-slate-600">{item.description}</span>
        </span>
      </Link>
    );
  }
  return (
    <Link href={item.href} onClick={onClick} className={`block min-h-11 rounded-lg px-4 py-2.5 transition-colors hover:bg-slate-100 ${FOCUS}`}>
      <span className="block text-sm font-bold leading-snug text-[#1e3a8a]">{item.label}</span>
      <span className="mt-0.5 block text-balance text-[13px] leading-snug text-slate-500">{item.description}</span>
    </Link>
  );
}

// The last row of the Services menu, the full width of the desktop panel and
// at the bottom of the phone menu's Services: one link to /services, light grey
// with a 1px border and 12px corners, its title and line on the left and
// View all on the right.
function AllServicesBar({ onClick, className }: { onClick: () => void; className: string }) {
  return (
    <Link
      href="/services"
      onClick={onClick}
      className={`flex min-h-11 items-center justify-between gap-4 rounded-[12px] border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3 transition-colors hover:border-[#cbd5e1] hover:bg-slate-100 ${FOCUS} ${className}`}
    >
      <span className="min-w-0">
        <span className="block text-sm font-bold leading-snug text-[#1e3a8a]">All services</span>
        <span className="mt-0.5 block text-balance text-[13px] leading-snug text-slate-600">Leaflet delivery, printing, web design and screen hire in one place</span>
      </span>
      <span className="shrink-0 text-sm font-bold text-blue-700">View all &rarr;</span>
    </Link>
  );
}

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/areas", label: "Areas" },
  { href: "/case-studies", label: "Case Studies" },
  { href: "/about", label: "About" },
  { href: "/before-you-book", label: "Before You Book" },
];

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [mobileServicesOpen, setMobileServicesOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const servicesButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // A click on Services opens the panel and keeps it open. Hover opens it
  // too, and moving away closes it only if hover opened it; a click closes it
  // only if a click opened it.
  const openedByClick = useRef(false);
  const closePanel = () => {
    openedByClick.current = false;
    setServicesOpen(false);
  };

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        closePanel();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Escape closes the panel and puts focus back on Services.
  useEffect(() => {
    if (!servicesOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      closePanel();
      servicesButtonRef.current?.focus();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [servicesOpen]);

  // The panel opens under Services; if that would take it within 16px of the
  // right edge of the screen, it moves left just enough (never past 16px from
  // the left edge). Placed before it is painted, and again if the window resizes.
  useLayoutEffect(() => {
    if (!servicesOpen) return;
    function place() {
      const wrapper = dropdownRef.current;
      const panel = panelRef.current;
      if (!wrapper || !panel) return;
      const left = wrapper.getBoundingClientRect().left;
      const over = left + panel.offsetWidth - (document.documentElement.clientWidth - 16);
      panel.style.transform = over > 0 ? `translateX(${-Math.min(over, left - 16)}px)` : "";
    }
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [servicesOpen]);

  const closeMobile = () => {
    setMenuOpen(false);
    setMobileServicesOpen(false);
  };

  const pathname = usePathname();
  if (hidesSiteChrome(pathname)) return null;

  return (
    <header className="bg-white border-b border-blue-100 sticky top-0 z-50 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="shrink-0">
            <Image
              src="/website_logo_main.webp"
              width={220}
              height={60}
              alt="Flyer Distribution Hampshire"
              priority
            />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-6">
            <Link
              href="/"
              className="text-sm text-gray-600 hover:text-blue-700 transition-colors font-medium"
            >
              Home
            </Link>

            {/* Services dropdown: two columns, leaflet services on the left and
                the additional services on the right, then the All services bar. */}
            <div
              ref={dropdownRef}
              className="relative"
              onMouseEnter={() => setServicesOpen(true)}
              onMouseLeave={() => {
                if (!openedByClick.current) setServicesOpen(false);
              }}
              onBlur={(e) => {
                // Tabbing on past the panel closes it.
                if (e.relatedTarget && !e.currentTarget.contains(e.relatedTarget as Node)) closePanel();
              }}
            >
              <button
                ref={servicesButtonRef}
                onClick={() => {
                  if (servicesOpen && openedByClick.current) return closePanel();
                  openedByClick.current = true;
                  setServicesOpen(true);
                }}
                className="flex items-center gap-1 text-sm text-gray-600 hover:text-blue-700 transition-colors font-medium"
                aria-expanded={servicesOpen}
                aria-haspopup="true"
                aria-controls="services-menu"
              >
                Services
                <svg
                  className={`w-3.5 h-3.5 transition-transform ${servicesOpen ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {servicesOpen && (
                <div ref={panelRef} id="services-menu" className="absolute left-0 top-full pt-3 z-50">
                  <div className="w-[640px] max-w-[calc(100vw-32px)] rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_24px_48px_-12px_rgba(15,23,42,0.28)]">
                    <div className="grid grid-cols-[3fr_2fr]">
                      <div className="pr-5">
                        <p className={GROUP_LABEL}>Leaflet services</p>
                        <ul className="mt-2.5 space-y-1.5">
                          {LEAFLET_SERVICES.map((item) => (
                            <li key={item.href}>
                              <ServiceLink item={item} onClick={closePanel} />
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="flex flex-col border-l border-[#e2e8f0] pl-5">
                        <p className={GROUP_LABEL}>Additional services</p>
                        <ul className="mt-2.5 space-y-1.5">
                          {ADDITIONAL_SERVICES.map((item) => (
                            <li key={item.href}>
                              <ServiceLink item={item} onClick={closePanel} />
                            </li>
                          ))}
                        </ul>
                        {/* Pinned to the bottom of the column. */}
                        <div className="mt-auto pt-4">
                          <div className="rounded-xl bg-[#1e3a8a] p-4 text-white">
                            <p className="text-sm font-bold">Not sure which you need?</p>
                            <Link
                              href="/quote"
                              onClick={closePanel}
                              className={`mt-1 inline-flex min-h-8 items-center rounded text-sm font-bold text-[#facc15] underline-offset-4 hover:text-yellow-200 hover:underline ${FOCUS}`}
                            >
                              Get a free quote &rarr;
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                    <AllServicesBar onClick={closePanel} className="mt-4" />
                  </div>
                </div>
              )}
            </div>

            {navLinks.slice(1).map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-gray-600 hover:text-blue-700 transition-colors font-medium"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* CTA */}
          <div className="hidden lg:block">
            <Link
              href="/quote"
              className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold px-5 py-2.5 rounded-md transition duration-200 ease-out hover:scale-105"
            >
              Get a Quote
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="lg:hidden p-2 rounded text-gray-500 hover:text-blue-700"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="lg:hidden pb-4 border-t border-blue-50 mt-1">
            <nav className="flex flex-col gap-1 pt-3">
              <Link
                href="/"
                className="text-sm text-gray-600 hover:text-blue-700 px-2 py-2 rounded hover:bg-blue-50 transition-colors font-medium"
                onClick={() => setMenuOpen(false)}
              >
                Home
              </Link>

              {/* Mobile services accordion */}
              <div>
                <button
                  onClick={() => setMobileServicesOpen((o) => !o)}
                  className="w-full flex items-center justify-between text-sm text-gray-600 hover:text-blue-700 px-2 py-2 rounded hover:bg-blue-50 transition-colors font-medium"
                  aria-expanded={mobileServicesOpen}
                >
                  Services
                  <svg
                    className={`w-3.5 h-3.5 transition-transform ${mobileServicesOpen ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {mobileServicesOpen && (
                  <div className="mt-1 flex flex-col gap-1.5 pl-2">
                    <p className={`${GROUP_LABEL} px-2 pt-1`}>Leaflet services</p>
                    {LEAFLET_SERVICES.map((item) => (
                      <ServiceLink key={item.href} item={item} onClick={closeMobile} />
                    ))}
                    <p className={`${GROUP_LABEL} px-2 pt-2`}>Also</p>
                    <div className="grid grid-cols-2 gap-2">
                      {ADDITIONAL_SERVICES.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={closeMobile}
                          className={`flex min-h-11 items-center justify-center rounded-full border border-blue-200 bg-white px-3 text-center text-sm font-bold text-[#1e3a8a] transition-colors hover:border-blue-400 hover:bg-blue-50 ${FOCUS}`}
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>
                    <AllServicesBar onClick={closeMobile} className="mt-1.5" />
                  </div>
                )}
              </div>

              {navLinks.slice(1).map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-gray-600 hover:text-blue-700 px-2 py-2 rounded hover:bg-blue-50 transition-colors font-medium"
                  onClick={() => setMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}

              <Link
                href="/quote"
                className="mt-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold px-4 py-2.5 rounded-md text-center transition duration-200 ease-out hover:scale-105"
                onClick={() => setMenuOpen(false)}
              >
                Get a Quote
              </Link>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
