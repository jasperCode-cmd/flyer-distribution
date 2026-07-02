import Link from "next/link";
import Image from "next/image";

const footerLinks = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Services" },
  { href: "/areas", label: "Areas" },
  { href: "/quote", label: "Get a Quote" },
  { href: "/about", label: "About" },
  { href: "/faq", label: "FAQ" },
  { href: "/blog", label: "Blog" },
];

export default function Footer() {
  return (
    <footer className="bg-blue-950 text-blue-200 mt-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <div className="mb-3 flex justify-center">
              <Image
                src="/Flyer Distribution Logo White Cropped.png"
                width={280}
                height={90}
                alt="Flyer Distribution Hampshire"
              />
            </div>
            <p className="text-sm text-blue-300 leading-relaxed">
              Professional flyer and leaflet distribution across Hampshire and
              Dorset. Reliable, targeted, and affordable.
            </p>
          </div>

          {/* Nav */}
          <div>
            <h3 className="text-white font-semibold text-sm mb-3 uppercase tracking-wide">
              Quick Links
            </h3>
            <ul className="space-y-2">
              {footerLinks.map((link) => (
                <li key={link.href} className="flex items-center gap-2">
                  <Link
                    href={link.href}
                    className="text-sm text-blue-300 hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                  {link.href === "/blog" && (
                    <span className="text-xs text-blue-500 border border-blue-700 rounded px-1.5 py-0.5 leading-none">
                      Coming soon
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-white font-semibold text-sm mb-3 uppercase tracking-wide">
              Contact
            </h3>
            <ul className="space-y-2 text-sm text-blue-300">
              <li>
                <span className="block text-blue-400 text-xs uppercase tracking-wide mb-0.5">
                  Email
                </span>
                <a
                  href="mailto:flyerdistributionhampshire@gmail.com"
                  className="hover:text-white transition-colors"
                >
                  flyerdistributionhampshire@gmail.com
                </a>
              </li>

              <li>
                <span className="block text-blue-400 text-xs uppercase tracking-wide mb-0.5">
                  Serving
                </span>
                Hampshire &amp; Dorset
              </li>

              <li>
                <a
                  href="https://share.google/RVxyPi4TzXAzkt1Am"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-white hover:underline transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
                    <path fill="#4285F4" d="M46.145 24.5c0-1.527-.137-3-.39-4.41H24v8.343h12.445c-.537 2.819-2.17 5.207-4.627 6.81v5.658h7.49c4.38-4.036 6.837-9.98 6.837-16.4z"/>
                    <path fill="#34A853" d="M24 47c6.24 0 11.47-2.07 15.308-5.6l-7.49-5.658c-2.072 1.387-4.72 2.207-7.818 2.207-6.015 0-11.108-4.063-12.928-9.528H3.434v5.842C7.254 41.892 15.02 47 24 47z"/>
                    <path fill="#FBBC05" d="M11.072 28.421A13.95 13.95 0 0 1 10.545 24c0-1.533.263-3.022.527-4.421v-5.842H3.434A23.01 23.01 0 0 0 1 24c0 3.71.892 7.223 2.434 10.263l7.638-5.842z"/>
                    <path fill="#EA4335" d="M24 10.05c3.39 0 6.435 1.166 8.832 3.453l6.618-6.618C35.466 3.19 30.237 1 24 1 15.02 1 7.254 6.108 3.434 13.737l7.638 5.842C12.892 14.113 17.985 10.05 24 10.05z"/>
                  </svg>
                  Find us on Google
                </a>
              </li>

              <li>
                <a
                  href="https://instagram.com/aw.flyers"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-white hover:underline transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                  @aw.flyers
                </a>
              </li>
              <li>
                <a
                  href="https://www.tiktok.com/@aw.flyers"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-white hover:underline transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
                    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.79 1.53V6.77a4.85 4.85 0 01-1.02-.08z"/>
                  </svg>
                  @aw.flyers
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-blue-900 mt-10 pt-6 text-xs text-blue-400 flex flex-col sm:flex-row justify-between gap-2">
          <p>
            &copy; {new Date().getFullYear()} Flyer Distribution Hampshire. All
            rights reserved.
          </p>
          <p>Hampshire, UK</p>
        </div>
      </div>
    </footer>
  );
}
