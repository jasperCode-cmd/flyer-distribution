import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import WebDesignCards from "@/components/WebDesignCards";
import WebDesignBenefits from "@/components/WebDesignBenefits";
import ScrollReveal from "@/components/ScrollReveal";

export const metadata: Metadata = {
  title: "Web Design & SEO",
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

const trustStripItems = [
  {
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="7" y="2" width="10" height="20" rx="2" />
        <path d="M11 18h2" />
      </svg>
    ),
    label: "Mobile-first design",
  },
  {
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.35-4.35" />
      </svg>
    ),
    label: "SEO built in from day one",
  },
  {
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 21s-7-6.1-7-11a7 7 0 0114 0c0 4.9-7 11-7 11z" />
        <circle cx="12" cy="10" r="2.5" />
      </svg>
    ),
    label: "Local Hampshire and Dorset team",
  },
];

// Pure CSS/HTML browser-window mockup, no photo. Deliberately free of any
// numbers, rankings, percentages, traffic figures or client names, real or
// invented, since this is illustrating the shape of a website, not a claim.
function BrowserMockup() {
  return (
    <div className="relative">
      <div className="hero-mockup-float w-full max-w-md rounded-xl overflow-hidden shadow-2xl ring-1 ring-black/10 bg-white">
        <div className="bg-slate-100 px-4 py-3 flex items-center gap-2 border-b border-slate-200">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
          <div className="ml-3 flex-1 bg-white rounded-full px-3 py-1 text-[10px] text-slate-400 truncate">
            yourbusiness.co.uk
          </div>
        </div>
        <div className="p-4 space-y-3 bg-slate-50">
          <div className="flex items-center justify-between">
            <div className="h-2.5 w-16 rounded-full bg-blue-700" />
            <div className="flex gap-2">
              <div className="h-2 w-8 rounded-full bg-slate-300" />
              <div className="h-2 w-8 rounded-full bg-slate-300" />
              <div className="h-2 w-8 rounded-full bg-slate-300" />
            </div>
          </div>
          <div className="rounded-lg bg-blue-900 p-4">
            <div className="h-2.5 w-2/3 rounded-full bg-white/80 mb-2" />
            <div className="h-2 w-1/2 rounded-full bg-blue-300/60 mb-3" />
            <div className="h-6 w-20 rounded-md bg-yellow-400" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-white border border-slate-200 p-3">
              <div className="h-2 w-1/2 rounded-full bg-slate-300 mb-2" />
              <div className="h-1.5 w-full rounded-full bg-slate-200" />
            </div>
            <div className="rounded-lg bg-white border border-slate-200 p-3">
              <div className="h-2 w-1/2 rounded-full bg-slate-300 mb-2" />
              <div className="h-1.5 w-full rounded-full bg-slate-200" />
            </div>
          </div>
        </div>
      </div>

      {/* Floating search-result snippet, representing being found on Google */}
      <div className="hero-mockup-float-delay absolute -bottom-6 -left-3 sm:-left-8 bg-white rounded-lg shadow-xl p-3 w-44 sm:w-48">
        <div className="flex items-center gap-1.5 mb-1.5">
          <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <div className="h-1.5 w-16 rounded-full bg-blue-700" />
        </div>
        <div className="h-1.5 w-full rounded-full bg-slate-200 mb-1" />
        <div className="h-1.5 w-3/4 rounded-full bg-slate-200" />
      </div>
    </div>
  );
}

export default function WebDesignSeoPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative bg-blue-900 text-white overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at 80% 15%, rgba(96,165,250,0.18), transparent 55%)",
          }}
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
          aria-hidden="true"
        />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-16 lg:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <p className="text-blue-300 text-sm font-semibold uppercase tracking-widest mb-3">
                Web Design &amp; SEO, Hampshire and Dorset
              </p>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
                Web Design &amp; SEO
              </h1>
              <p className="text-blue-200 text-lg sm:text-xl max-w-xl leading-relaxed mb-8">
                Fast, professional websites and search engine optimisation for
                businesses across Hampshire and Dorset.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link
                  href="/quote"
                  className="inline-block bg-yellow-400 hover:bg-yellow-300 text-blue-900 font-bold px-8 py-4 rounded-md text-base transition duration-200 ease-out hover:scale-105 shadow-lg"
                >
                  Book a Free Call
                </Link>
                <a
                  href="#offer"
                  className="inline-block border-2 border-white text-white hover:bg-white hover:text-blue-900 font-bold px-8 py-4 rounded-md text-base transition duration-200 ease-out hover:scale-105"
                >
                  See the Offer
                </a>
              </div>
            </div>
            <div className="flex justify-center lg:justify-end mt-2 lg:mt-0">
              <div className="scale-[0.72] origin-top lg:scale-100">
                <BrowserMockup />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="bg-slate-50 border-b border-gray-100 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-4 sm:divide-x sm:divide-gray-200">
            {trustStripItems.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-center gap-3 px-2"
              >
                <span className="text-blue-600 shrink-0">{item.icon}</span>
                <span className="text-sm font-semibold text-blue-900">
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Intro: two-column with layered photo composition */}
      <section className="bg-white py-12 sm:py-14">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-blue-900 mb-5">
                  Websites Built to Bring in Enquiries
                </h2>
                <p className="text-gray-600 text-xl leading-relaxed">
                  We design and build{" "}
                  <strong className="font-semibold text-gray-800">
                    bespoke websites
                  </strong>{" "}
                  for local businesses across Hampshire and Dorset, and
                  beyond. Every site we build is fast, easy to navigate, and
                  designed to{" "}
                  <strong className="font-semibold text-gray-800">
                    turn visitors into real enquiries
                  </strong>
                  , with{" "}
                  <strong className="font-semibold text-gray-800">
                    SEO built in from the ground up
                  </strong>{" "}
                  so you get found organically.
                </p>
              </div>
              <div className="relative max-w-md mx-auto lg:mx-0">
                <div
                  className="absolute -bottom-4 -right-4 w-full h-full bg-blue-900 rounded-lg"
                  aria-hidden="true"
                />
                <div className="relative rounded-lg overflow-hidden shadow-xl ring-1 ring-black/5">
                  <Image
                    src="https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&q=80"
                    alt="MacBook Pro with code on screen representing professional web design"
                    width={800}
                    height={534}
                    className="w-full object-cover"
                  />
                </div>
                <div className="absolute -bottom-6 -left-3 sm:-left-8 bg-white rounded-lg shadow-xl p-4 flex items-center gap-3 max-w-[220px]">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-600 shrink-0">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </span>
                  <p className="text-xs font-semibold text-blue-900 leading-snug">
                    Designed, built and managed for you
                  </p>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Why choose us — icon-led benefit cards */}
      <section className="bg-slate-50 border-y border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <ScrollReveal>
            <h2 className="text-2xl sm:text-3xl font-bold text-blue-900 text-center mb-4">
              Why Choose Us
            </h2>
            <p className="text-gray-600 text-center max-w-2xl mx-auto mb-12">
              Every website we build comes with the same standards, built in
              from day one.
            </p>
          </ScrollReveal>
          <WebDesignBenefits />
        </div>
      </section>

      {/* Get Online for Less — contained offer box */}
      <section id="offer" className="bg-white py-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-blue-900 rounded-xl px-8 py-10 sm:px-12 md:py-8 shadow-[0_0_30px_rgba(250,204,21,0.2)] md:flex md:items-center md:justify-between md:gap-10">
            <div>
              <h2 className="text-3xl font-bold text-white mb-3">
                Get Online for Less
              </h2>
              <p className="text-xl text-blue-100 leading-relaxed md:mb-0 mb-6">
                Professional websites from{" "}
                <span className="text-yellow-400 font-bold">£60 a month</span>
                , no big upfront cost.
              </p>
            </div>
            <Link
              href="/quote"
              className="inline-block shrink-0 bg-yellow-400 hover:bg-yellow-300 text-blue-900 font-bold px-10 py-5 rounded-md transition duration-200 ease-out hover:scale-105 text-lg"
            >
              Book a Free Call
            </Link>
          </div>
        </div>
      </section>

      {/* Service detail cards */}
      <section className="bg-blue-900 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <WebDesignCards />
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
            className="inline-block bg-blue-700 hover:bg-blue-800 text-white font-bold px-10 py-4 rounded-md text-base transition duration-200 ease-out hover:scale-105 shadow"
          >
            Get in Touch
          </Link>
        </div>
      </section>

      {/* Leaflet services */}
      <section className="bg-slate-50 py-16 border-t border-gray-100">
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
