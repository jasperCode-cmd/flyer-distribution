"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useRef, useEffect } from "react";

const servicesDropdown = [
  { href: "/services", label: "Leaflet Services" },
  { href: "/services/web-design-seo", label: "Web Design & SEO" },
  { href: "/services/screen-hire", label: "Screen Hire" },
];

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/areas", label: "Areas" },
  { href: "/about", label: "About" },
  { href: "/faq", label: "FAQ" },
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

  return (
    <header className="bg-white border-b border-blue-100 sticky top-0 z-50 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="shrink-0">
            <Image
              src="/website_logo_main.png"
              width={220}
              height={60}
              alt="Flyer Distribution Hampshire"
              priority
            />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6">
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
                    {servicesDropdown.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="block px-4 py-2.5 text-sm text-gray-600 hover:text-blue-700 hover:bg-blue-50 transition-colors font-medium"
                        onClick={() => setServicesOpen(false)}
                      >
                        {item.label}
                      </Link>
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
          <div className="hidden md:block">
            <Link
              href="/quote"
              className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold px-5 py-2.5 rounded-md transition duration-200 ease-out hover:scale-105"
            >
              Get a Quote
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded text-gray-500 hover:text-blue-700"
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
          <div className="md:hidden pb-4 border-t border-blue-50 mt-1">
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
                    {servicesDropdown.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="text-sm text-gray-600 hover:text-blue-700 px-2 py-2 rounded hover:bg-blue-50 transition-colors font-medium"
                        onClick={() => { setMenuOpen(false); setMobileServicesOpen(false); }}
                      >
                        {item.label}
                      </Link>
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
