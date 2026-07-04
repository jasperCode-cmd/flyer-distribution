import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import ScreenHireCards from "@/components/ScreenHireCards";
import ScrollReveal from "@/components/ScrollReveal";

export const metadata: Metadata = {
  title: "Mobile Screen Trailer Hire | Flyer Distribution Hampshire",
  description:
    "Hire our mobile LED screen trailer for events, advertising, movies, or gaming across Hampshire and Dorset. A 7m² screen mounted on a trailer, easy to set up and guaranteed to get you noticed.",
  alternates: {
    canonical: "https://www.flyerdistributionhampshire.co.uk/services/screen-hire",
  },
  openGraph: {
    title: "Mobile Screen Trailer Hire | Flyer Distribution Hampshire",
    description:
      "Hire our mobile LED screen trailer for events, advertising, movies, or gaming across Hampshire and Dorset. A 7m² screen mounted on a trailer, easy to set up and guaranteed to get you noticed.",
    url: "https://www.flyerdistributionhampshire.co.uk/services/screen-hire",
    siteName: "Flyer Distribution Hampshire",
    locale: "en_GB",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Mobile Screen Trailer Hire | Flyer Distribution Hampshire",
    description:
      "Hire our mobile LED screen trailer for events, advertising, movies, or gaming across Hampshire and Dorset. A 7m² screen mounted on a trailer, easy to set up and guaranteed to get you noticed.",
  },
};

export default function ScreenHirePage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-blue-900 text-white py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">
            Mobile Screen Trailer Hire
          </h1>
          <p className="text-blue-200 text-lg max-w-xl">
            A powerful, portable LED screen for events, advertising, and
            entertainment across Hampshire and Dorset.
          </p>
        </div>
      </section>

      {/* Trailer image */}
      <section className="bg-slate-50 pt-16">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <div className="relative h-96 w-full overflow-hidden rounded-lg shadow-xl ring-1 ring-black/5">
              <Image
                src="/Mobile%20Screen%20Trailer%20Hire%20Enquire.jpg"
                alt="Mobile LED screen trailer ready for hire"
                width={1244}
                height={1600}
                className="object-cover w-full h-full"
                style={{ objectPosition: "center center" }}
              />
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Feature cards */}
      <section className="bg-slate-50 py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScreenHireCards />
        </div>
      </section>

      {/* CTA */}
      <section className="bg-white py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-blue-900 mb-4">
            Interested in Screen Hire?
          </h2>
          <p className="text-gray-600 max-w-lg mx-auto mb-8 leading-relaxed">
            Get in touch for availability, pricing, and to discuss your event or
            campaign. We cover Hampshire and Dorset and are happy to advise on
            the best setup for your needs.
          </p>
          <Link
            href="/quote"
            className="inline-block bg-blue-700 hover:bg-blue-800 text-white font-bold px-10 py-4 rounded-md text-base transition duration-200 ease-out hover:scale-105 shadow"
          >
            Get a Quote
          </Link>
        </div>
      </section>

      {/* Web Design cross-link */}
      <section className="bg-slate-50 py-12 border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-xl font-bold text-blue-900 mb-2">
            Looking to Grow Online Too?
          </h2>
          <p className="text-gray-600 mb-6 max-w-md mx-auto text-sm leading-relaxed">
            We also offer bespoke web design and SEO for local businesses across
            Hampshire and Dorset.
          </p>
          <Link
            href="/services/web-design-seo"
            className="inline-block bg-white border border-blue-700 text-blue-700 hover:bg-blue-700 hover:text-white font-semibold px-7 py-3 rounded-md text-sm transition duration-200 ease-out hover:scale-105"
          >
            Web Design &amp; SEO
          </Link>
        </div>
      </section>
    </>
  );
}
