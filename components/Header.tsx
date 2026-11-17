"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { hidesSiteChrome } from "@/lib/site-chrome";
import { useState, useRef, useEffect } from "react";

type ServiceItem = { href: string; label: string; description?: string; highlight?: boolean };
type ServiceGroup = { label: string; href: string | null; featured?: { badge: string; description: string }; items: ServiceItem[] };

// The Services menu, shared by the desktop dropdown and the phone menu. It
// leads with Leaflet Distribution, the most prominent (navy, with a badge),
// then Leaflet Printing, lighter (light blue, with a printer icon); each says
// in a line what it is. The rest are plain links.
const servicesGroups: ServiceGroup[] = [
  {
    label: "Leaflet Distribution",
    href: "/services",
    featured: { badge: "Most popular", description: "Door to door, GPS tracked. We can design and print it too." },
    items: [
      { href: "/leaflet-printing", label: "Leaflet Printing", description: "Flyers, leaflets and business cards", highlight: true },
      { href: "/services/public-notice-leafleting", label: "Public Notice Leafleting" },
      { href: "/services/hand-to-hand-distribution", label: "Hand-to-Hand Leaflet Distribution" },
      { href: "/services/b2b-distribution", label: "B2B Leaflet Distribution" },
    ],
  },
  {
    label: "Additional Services",
    href: null,
    items: [
      { href: "/services/web-design-seo", label: "Web Design & SEO" },
      { href: "/services/screen-hire", label: "Screen Hire" },
    ],
  },
];

const FEATURED_ITEM = "block rounded-md bg-[#1e3a8a] px-3 py-2.5 text-white hover:bg-[#172554] transition-colors";
const HIGHLIGHT_ITEM = "flex items-start gap-2.5 rounded-md bg-[#dbeafe] px-3 py-2.5 text-blue-900 hover:bg-[#bfdbfe] transition-colors";

function FeaturedLabel({ label, badge, description }: { label: string; badge: string; description: string }) {
  return (
    <>
      <span className="flex flex-wrap items-center gap-2 text-sm font-semibold">
        {label}
        <span className="rounded-full bg-[#facc15] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-900">{badge}</span>
      </span>
      <span className="mt-0.5 block text-xs text-[#dbeafe]">{description}</span>
    </>
  );
}

function HighlightLabel({ label, description }: { label: string; description?: string }) {
  return (
    <>
      {/* A printer, in line. */}
      <svg aria-hidden="true" viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 9V2h12v7" />
        <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
        <rect x="6" y="14" width="12" height="8" />
      </svg>
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-blue-800">{description}</span>}
      </span>
    </>
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

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setServicesOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

            {/* Services dropdown */}
            <div
              ref={dropdownRef}
              className="relative"
              onMouseEnter={() => setServicesOpen(true)}
              onMouseLeave={() => setServicesOpen(false)}
            >
              <button
                onClick={() => setServicesOpen((o) => !o)}
                className="flex items-center gap-1 text-sm text-gray-600 hover:text-blue-700 transition-colors font-medium"
                aria-expanded={servicesOpen}
                aria-haspopup="true"
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
                <div className="absolute left-0 top-full pt-2 z-50">
                  <div className="bg-white border border-blue-100 rounded-md shadow-lg py-1 min-w-[200px]">
                    {servicesGroups.map((group, gi) => (
                      <div key={group.label} className={gi > 0 ? "mt-2" : ""}>
                        {group.href && group.featured ? (
                          <Link href={group.href} className={`mx-2 mt-1 mb-1 ${FEATURED_ITEM}`} onClick={() => setServicesOpen(false)}>
                            <FeaturedLabel label={group.label} badge={group.featured.badge} description={group.featured.description} />
                          </Link>
                        ) : group.href ? (
                          <Link
                            href={group.href}
                            className="block px-4 py-2.5 text-sm text-gray-600 hover:text-blue-700 hover:bg-blue-50 transition-colors font-semibold"
                            onClick={() => setServicesOpen(false)}
                          >
                            {group.label}
                          </Link>
                        ) : (
                          <p className="px-4 py-2.5 text-sm text-gray-600 font-semibold">
                            {group.label}
                          </p>
                        )}
                        {group.items.map((item) =>
                          item.highlight ? (
                            <Link key={item.href} href={item.href} className={`mx-2 mb-1 ${HIGHLIGHT_ITEM}`} onClick={() => setServicesOpen(false)}>
                              <HighlightLabel label={item.label} description={item.description} />
                            </Link>
                          ) : (
                            <Link
                              key={item.href}
                              href={item.href}
                              className="block px-4 py-2.5 text-sm text-gray-600 hover:text-blue-700 hover:bg-blue-50 transition-colors font-medium"
                              onClick={() => setServicesOpen(false)}
                            >
                              {item.label}
                            </Link>
                          )
                        )}
                      </div>
                    ))}
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
                  <div className="pl-4 flex flex-col gap-1 mt-1">
                    {servicesGroups.map((group, gi) => (
                      <div key={group.label} className={gi > 0 ? "mt-2" : ""}>
                        {group.href && group.featured ? (
                          <Link
                            href={group.href}
                            className={`my-1 ${FEATURED_ITEM}`}
                            onClick={() => { setMenuOpen(false); setMobileServicesOpen(false); }}
                          >
                            <FeaturedLabel label={group.label} badge={group.featured.badge} description={group.featured.description} />
                          </Link>
                        ) : group.href ? (
                          <Link
                            href={group.href}
                            className="block text-sm text-gray-600 hover:text-blue-700 px-2 py-2 rounded hover:bg-blue-50 transition-colors font-semibold"
                            onClick={() => { setMenuOpen(false); setMobileServicesOpen(false); }}
                          >
                            {group.label}
                          </Link>
                        ) : (
                          <p className="text-sm text-gray-600 px-2 py-2 font-semibold">
                            {group.label}
                          </p>
                        )}
                        {group.items.map((item) =>
                          item.highlight ? (
                            <Link
                              key={item.href}
                              href={item.href}
                              className={`mb-1 ${HIGHLIGHT_ITEM}`}
                              onClick={() => { setMenuOpen(false); setMobileServicesOpen(false); }}
                            >
                              <HighlightLabel label={item.label} description={item.description} />
                            </Link>
                          ) : (
                            <Link
                              key={item.href}
                              href={item.href}
                              className="block text-sm text-gray-600 hover:text-blue-700 px-2 py-2 rounded hover:bg-blue-50 transition-colors font-medium"
                              onClick={() => { setMenuOpen(false); setMobileServicesOpen(false); }}
                            >
                              {item.label}
                            </Link>
                          )
                        )}
                      </div>
                    ))}
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
