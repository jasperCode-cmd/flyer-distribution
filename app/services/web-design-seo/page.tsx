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
            <p className="text-gray-600 leading-relaxed mb-4">
              We design and build bespoke websites for local businesses across
              Hampshire and Dorset, and beyond. Whether you&apos;re a trades
              business, a service company, a restaurant, or a charity, we build
              websites that look professional, load fast, and are built to
              convert visitors into enquiries.
            </p>
            <p className="text-gray-600 leading-relaxed">
              Every website we build is custom, designed around your business
              and your goals, not adapted from a generic template. We work with
              you from initial brief through to launch, keeping the process
              straightforward and jargon-free.
            </p>
          </div>
          <div>
            <Image
              src="https://images.pexels.com/photos/7055/pexels-photo.jpg?auto=compress&cs=tinysrgb&w=800"
              alt="Clean iMac workspace representing professional web design"
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
              <h2 className="text-base font-semibold text-blue-900 mb-2">
                Who We Work With
              </h2>
              <p className="text-gray-600 text-sm leading-relaxed">
                We work with service businesses, tradespeople, restaurants,
                retailers, charities, and local organisations. If you need a
                website or want to improve your search rankings, we&apos;d love
                to hear about your project.
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
    </>
  );
}
