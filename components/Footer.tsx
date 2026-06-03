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
                src="/Flyer Distribution Logo White.png"
                width={250}
                height={80}
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
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-blue-300 hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
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
