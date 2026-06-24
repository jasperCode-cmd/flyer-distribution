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
