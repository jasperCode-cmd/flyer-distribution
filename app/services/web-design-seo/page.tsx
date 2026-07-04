import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Web Design & SEO | Flyer Distribution Hampshire",
  description:
    "Fast, professional websites and search engine optimisation for businesses across Hampshire and Dorset. We handle design, development, and SEO end to end.",
  alternates: {
    canonical: "https://www.flyerdistributionhampshire.co.uk/services/web-design-seo",
  },
  openGraph: {
    title: "Web Design & SEO | Flyer Distribution Hampshire",
    description:
      "Fast, professional websites and search engine optimisation for businesses across Hampshire and Dorset. We handle design, development, and SEO end to end.",
    url: "https://www.flyerdistributionhampshire.co.uk/services/web-design-seo",
    siteName: "Flyer Distribution Hampshire",
    locale: "en_GB",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Web Design & SEO | Flyer Distribution Hampshire",
    description:
      "Fast, professional websites and search engine optimisation for businesses across Hampshire and Dorset. We handle design, development, and SEO end to end.",
  },
};

export default function WebDesignSeoPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-blue-900 text-white py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">
            Web Design &amp; SEO
          </h1>
          <p className="text-blue-200 text-lg max-w-xl">
            Fast, professional websites and search engine optimisation for
            businesses across Hampshire and Dorset.
          </p>
        </div>
      </section>

      {/* Intro: two-column with image */}
      <section className="bg-white py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          <div>
            <p className="text-gray-600 leading-relaxed mb-6">
              We design and build bespoke websites for local businesses across
              Hampshire and Dorset, and beyond.
            </p>
            <ul className="space-y-3">
              {[
                "Bespoke websites built around your business",
                "Fast and easy to navigate for your customers",
                "Built to convert visitors into enquiries",
                "Clean and mobile-friendly from the beginning",
                "SEO built in from the ground up so you get work organically",
                "A professional online presence customers can trust",
              ].map((point) => (
                <li key={point} className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-blue-700 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  <span className="text-gray-600 text-sm leading-relaxed">{point}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <Image
              src="https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&q=80"
              alt="MacBook Pro with code on screen representing professional web design"
              width={800}
              height={534}
              className="rounded-lg w-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* Service detail cards */}
      <section className="bg-slate-50 py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <svg className="w-8 h-8 text-blue-700 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <path d="M8 21h8M12 17v4" />
              </svg>
              <h2 className="text-base font-semibold text-blue-900 mb-2">
                Web Design
              </h2>
              <p className="text-gray-600 text-sm leading-relaxed">
                We build fast, clean websites tailored to your business. Every
                site is mobile-friendly, easy to navigate, and designed to make
                a strong first impression with potential customers.
              </p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <svg className="w-8 h-8 text-blue-700 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <h2 className="text-base font-semibold text-blue-900 mb-2">
                Search Engine Optimisation
              </h2>
              <p className="text-gray-600 text-sm leading-relaxed">
                A great website is only valuable if people can find it. We build
                every site with SEO in mind from the ground up, covering
                technical setup, on-page optimisation, and local search
                visibility. We also offer ongoing SEO support and retainers for
                businesses looking to grow their search presence over time.
              </p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <svg className="w-8 h-8 text-blue-700 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
              </svg>
              <h2 className="text-base font-semibold text-blue-900 mb-2">
                Who We Work With
              </h2>
              <p className="text-gray-600 text-sm leading-relaxed">
                Most of our web design clients are service businesses that rely
                on local customers finding them online: trades, home
                improvement, health and wellness, food and drink, professional
                services, and community organisations. If your business depends
                on people in your area being able to find you and trust what
                they see, we can help. We&apos;re happy to work with any
                business, and we don&apos;t need a brief to give you a quote.
                Just tell us what you&apos;re trying to achieve.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-white py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-blue-900 mb-4">
            Ready to Grow Online?
          </h2>
          <p className="text-gray-600 max-w-lg mx-auto mb-8 leading-relaxed">
            Tell us about your business and what you&apos;re looking to achieve.
            We&apos;ll come back to you with a clear proposal and no obligation.
          </p>
          <Link
            href="/quote"
            className="inline-block bg-blue-700 hover:bg-blue-800 text-white font-bold px-10 py-4 rounded-md text-base transition-colors shadow"
          >
            Get in Touch
          </Link>
        </div>
      </section>

      {/* Leaflet services */}
      <section className="bg-white py-16 border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-blue-900 mb-8">
            Leaflet Services
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Link
              href="/services"
              className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:border-blue-300 hover:shadow-md transition-all group"
            >
              <Image
                src="https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800&q=80"
                alt="Designer working on creative artwork at a desk"
                width={600}
                height={300}
                className="w-full h-44 object-cover"
              />
              <div className="p-5">
                <h3 className="text-base font-semibold text-blue-900 mb-2 group-hover:text-blue-700 transition-colors">
                  Design, Print and Deliver
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Our full end-to-end service. We handle design, printing in A6, A5, A4 or DL, and full distribution across your chosen areas.
                </p>
              </div>
            </Link>
            <Link
              href="/services"
              className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:border-blue-300 hover:shadow-md transition-all group"
            >
              <Image
                src="https://images.pexels.com/photos/19843566/pexels-photo-19843566.jpeg?auto=compress&cs=tinysrgb&w=800"
                alt="Printed leaflets ready for delivery"
                width={600}
                height={300}
                className="w-full h-44 object-cover"
              />
              <div className="p-5">
                <h3 className="text-base font-semibold text-blue-900 mb-2 group-hover:text-blue-700 transition-colors">
                  Print and Deliver
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Already have your design ready? We handle printing in A6, A5, A4 or DL and deliver your leaflets directly through letterboxes.
                </p>
              </div>
            </Link>
            <Link
              href="/services"
              className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:border-blue-300 hover:shadow-md transition-all group"
            >
              <Image
                src="https://images.pexels.com/photos/35110918/pexels-photo-35110918.jpeg?auto=compress&cs=tinysrgb&w=800"
                alt="Leaflets being delivered through a letterbox"
                width={600}
                height={300}
                className="w-full h-44 object-cover"
              />
              <div className="p-5">
                <h3 className="text-base font-semibold text-blue-900 mb-2 group-hover:text-blue-700 transition-colors">
                  Leaflet Distribution
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Door-to-door delivery to households across your chosen areas in Hampshire and Dorset. Your materials posted directly through letterboxes.
                </p>
              </div>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
