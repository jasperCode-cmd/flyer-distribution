import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import ScrollReveal from "@/components/ScrollReveal";
import StaggerGroup from "@/components/StaggerGroup";

export const metadata: Metadata = {
  title: "Public Notice Leafleting for NSIPs",
  description:
    "Statutory public notice leafleting in Hampshire for Nationally Significant Infrastructure Projects. Section 47 and Section 48 Planning Act 2008 distribution, delivered to your project's own area and deadline.",
  alternates: {
    canonical: "https://www.flyerdistributionhampshire.co.uk/services/public-notice-leafleting",
  },
  openGraph: {
    title: "Public Notice Leafleting for NSIPs | Flyer Distribution Hampshire",
    description:
      "Statutory public notice leafleting in Hampshire for Nationally Significant Infrastructure Projects. Section 47 and Section 48 Planning Act 2008 distribution, delivered to your project's own area and deadline.",
    url: "https://www.flyerdistributionhampshire.co.uk/services/public-notice-leafleting",
    siteName: "Flyer Distribution Hampshire",
    images: [
      {
        url: "https://images.pexels.com/photos/35110918/pexels-photo-35110918.jpeg?auto=compress&cs=tinysrgb&w=1200",
        width: 1200,
        height: 630,
        alt: "Flyer Distribution Hampshire",
      },
    ],
    locale: "en_GB",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Public Notice Leafleting for NSIPs | Flyer Distribution Hampshire",
    description:
      "Statutory public notice leafleting in Hampshire for Nationally Significant Infrastructure Projects. Section 47 and Section 48 Planning Act 2008 distribution, delivered to your project's own area and deadline.",
    images: [
      "https://images.pexels.com/photos/35110918/pexels-photo-35110918.jpeg?auto=compress&cs=tinysrgb&w=1200",
    ],
  },
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: "https://www.flyerdistributionhampshire.co.uk",
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Services",
      item: "https://www.flyerdistributionhampshire.co.uk/services",
    },
    {
      "@type": "ListItem",
      position: 3,
      name: "Public Notice Leafleting",
      item: "https://www.flyerdistributionhampshire.co.uk/services/public-notice-leafleting",
    },
  ],
};

const beyondStatutory = [
  { title: "Utility Works Notifications", body: "Notices ahead of planned upgrades or works to gas, water, electricity, or telecoms infrastructure." },
  { title: "Traffic Management & Road Closures", body: "Distribution supporting Temporary Traffic Regulation Orders (TTROs) and other road closure or diversion notices." },
  { title: "Local Authority Announcements", body: "Council-led notices and community announcements delivered to the households and streets they affect." },
  { title: "Highways Maintenance Notices", body: "Advance notice of resurfacing, drainage work, or other planned highways maintenance." },
  { title: "Construction Project Updates", body: "Keeping nearby residents informed as a project progresses, not just at the consultation stage." },
  { title: "Supporting Print Materials", body: "Lamp post wraps, banners, and site signage to sit alongside your leaflet distribution where useful." },
];

export default function PublicNoticeLeafletingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      {/* Hero */}
      <section className="bg-blue-900 text-white py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-blue-300 text-sm font-semibold uppercase tracking-widest mb-3">
            Hampshire &middot; Statutory Consultation Leafleting
          </p>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 max-w-2xl">
            Public Notice Leafleting for NSIPs
          </h1>
          <p className="text-blue-200 text-lg max-w-2xl leading-relaxed">
            Door-to-door distribution supporting Section 47 and Section 48
            Planning Act 2008 obligations for Nationally Significant
            Infrastructure Projects across Hampshire.
          </p>
        </div>
      </section>

      {/* What this service covers */}
      <section className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-blue-900 mb-6">
            What This Service Covers
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            <div className="space-y-4 text-gray-600 leading-relaxed">
              <p>
                Nationally Significant Infrastructure Projects carry specific
                public consultation obligations under the Planning Act 2008.
                Before an applicant can submit a Development Consent Order
                application, they need to consult the communities their
                project affects, and be able to show that consultation was
                carried out properly.
              </p>
              <p>
                Flyer Distribution Hampshire handles the physical side of that
                obligation. We deliver consultation leaflets, notices, and
                supporting materials door to door across the area your
                project defines. We are not a planning consultancy, and this
                page is not planning advice. For our wider leaflet
                distribution work across Hampshire, see our{" "}
                <Link href="/services" className="text-blue-700 hover:underline font-medium">
                  standard services
                </Link>
                .
              </p>
              <p>
                The distribution geography for a statutory notice comes from
                your Statement of Community Consultation, not from our usual
                postcode boundaries, so we work to the exact area your project
                sets out rather than a standard coverage zone. Your
                consultation schedule sets the timeline too. Before we take on
                a job, we tell you plainly whether your deadline is
                achievable, rather than agreeing to a date we cannot meet.
              </p>
            </div>
            <div className="max-w-md mx-auto lg:mx-0">
              <ScrollReveal>
                <div className="aspect-square overflow-hidden rounded-lg shadow-lg ring-1 ring-black/5">
                  <Image
                    src="/Road-Closure-Public-Notice-Leaflet.webp"
                    alt="A stack of 'ROAD CLOSURE' public notice leaflets produced for Hampshire County Council, held alongside a Flyer Distribution Hampshire business card"
                    width={1600}
                    height={1600}
                    className="w-full h-full object-cover"
                  />
                </div>
              </ScrollReveal>
              <p className="text-xs text-gray-500 mt-3 text-center lg:text-left">
                A road closure notice we distributed on behalf of Hampshire
                County Council.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 47 / 48 explainer */}
      <section className="bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-blue-900 mb-10">
            Section 47 and Section 48
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="group relative bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:border-blue-300 hover:scale-[1.02] hover:shadow-lg transition-all duration-300 ease-out">
              <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-lg bg-blue-200 group-hover:bg-blue-500 transition-colors duration-300" aria-hidden="true" />
              <h3 className="text-base font-semibold text-blue-900 mb-2">
                Section 47: Duty to Consult
              </h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Section 47 of the Planning Act 2008 requires applicants for
                major infrastructure projects to consult local communities
                before submitting a Development Consent Order application.
                As part of this, applicants prepare a Statement of Community
                Consultation (SoCC) setting out who they will consult and
                how. Once the SoCC is finalised, following the local
                authority&apos;s 28-day response window, we distribute the
                consultation materials exactly as the statement requires, to
                the streets, postcodes, or areas it specifies.
              </p>
            </div>
            <div className="group relative bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:border-blue-300 hover:scale-[1.02] hover:shadow-lg transition-all duration-300 ease-out">
              <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-lg bg-blue-200 group-hover:bg-blue-500 transition-colors duration-300" aria-hidden="true" />
              <h3 className="text-base font-semibold text-blue-900 mb-2">
                Section 48: Duty to Publicise
              </h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Section 48 requires applicants to publicise the application
                once it has been accepted, so people know it exists and how
                to respond to it. This typically reaches a wider audience
                than the pre-application consultation stage. We deliver
                these publicity materials on the same project-defined
                basis, working to whatever area and deadline your Section
                48 obligations set.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Beyond statutory */}
      <section className="bg-white border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-blue-900 mb-3">
            Beyond the Statutory Requirements
          </h2>
          <p className="text-gray-600 max-w-2xl mb-10">
            The same door-to-door distribution set up for a statutory
            notice extends naturally to other notification work, whether or
            not it carries a legal consultation requirement.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {beyondStatutory.map((item) => (
              <div
                key={item.title}
                className="group relative bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:border-blue-300 hover:scale-[1.02] hover:shadow-lg transition-all duration-300 ease-out"
              >
                <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-lg bg-blue-200 group-hover:bg-blue-500 transition-colors duration-300" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-blue-900 mb-2">{item.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tracking / confirmation */}
      <section className="bg-slate-50 border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <ScrollReveal>
            <div className="flex items-center gap-3 mb-6">
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-50 text-blue-700 flex-shrink-0">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M8.5 12.5l2.5 2.5 4.5-5" />
                </svg>
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-blue-900">
                How Confirmation Works
              </h2>
            </div>
            <p className="text-gray-600 leading-relaxed max-w-3xl mb-8">
              Statutory consultation work is deadline-driven, so we
              schedule distribution rounds around your project&apos;s
              timetable rather than our own.
            </p>
          </ScrollReveal>
          <StaggerGroup className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              {
                icon: (
                  <path d="M20 6L9 17l-5-5" />
                ),
                body: "Confirmed the same way as every campaign we run.",
              },
              {
                icon: (
                  <>
                    <path d="M12 21s-7-6.1-7-11a7 7 0 0114 0c0 4.9-7 11-7 11z" />
                    <circle cx="12" cy="10" r="2.5" />
                  </>
                ),
                body: "Distributors record each round with Strava route screenshots.",
              },
              {
                icon: (
                  <>
                    <rect x="6" y="4" width="12" height="17" rx="2" />
                    <path d="M9 4V3a1 1 0 011-1h4a1 1 0 011 1v1M9 11h6M9 15h6" />
                  </>
                ),
                body: "A genuine, tracked record of the streets covered, and when.",
              },
            ].map((item, i) => (
              <div
                key={i}
                className="group relative bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:border-blue-300 hover:scale-[1.02] hover:shadow-lg transition-all duration-300 ease-out h-full"
              >
                <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-lg bg-blue-200 group-hover:bg-blue-500 transition-colors duration-300" aria-hidden="true" />
                <svg className="w-6 h-6 text-blue-600 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {item.icon}
                </svg>
                <p className="text-gray-700 text-sm leading-relaxed">{item.body}</p>
              </div>
            ))}
          </StaggerGroup>
        </div>
      </section>

      {/* Post-distribution documentation */}
      <section className="bg-white border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <ScrollReveal>
            <div className="flex items-center gap-3 mb-6">
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-50 text-blue-700 flex-shrink-0">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M7 3h7l4 4v14a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z" />
                  <path d="M14 3v4h4" />
                  <path d="M9 13h6M9 17h6" />
                </svg>
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-blue-900">
                Post-Distribution Documentation
              </h2>
            </div>
            <p className="text-gray-600 leading-relaxed max-w-3xl mb-8">
              For each round, we provide documentation your records can
              rely on:
            </p>
          </ScrollReveal>
          <StaggerGroup className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
            {[
              {
                icon: (
                  <>
                    <rect x="4" y="5" width="16" height="16" rx="2" />
                    <path d="M8 3v4M16 3v4M4 10h16" />
                    <path d="M9 15l2 2 4-4" />
                  </>
                ),
                body: "Confirmation of the areas covered and completion dates.",
              },
              {
                icon: (
                  <>
                    <rect x="6" y="11" width="12" height="9" rx="2" />
                    <path d="M9 11V8a3 3 0 016 0v3" />
                  </>
                ),
                body: "Notes on any properties we could not access, for example gated developments or locked communal entrances.",
              },
              {
                icon: (
                  <>
                    <path d="M12 3l9 5-9 5-9-5 9-5z" />
                    <path d="M3 13l9 5 9-5" />
                  </>
                ),
                body: "Multiple rounds, whether repeated across a large area or split by phase, each tracked and documented separately, so your records clearly show what was delivered, where, and when.",
              },
            ].map((item, i) => (
              <div
                key={i}
                className="group relative bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:border-blue-300 hover:scale-[1.02] hover:shadow-lg transition-all duration-300 ease-out h-full"
              >
                <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-lg bg-blue-200 group-hover:bg-blue-500 transition-colors duration-300" aria-hidden="true" />
                <svg className="w-6 h-6 text-blue-600 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {item.icon}
                </svg>
                <p className="text-gray-700 text-sm leading-relaxed">{item.body}</p>
              </div>
            ))}
          </StaggerGroup>
          <ScrollReveal>
            <p className="text-gray-600 leading-relaxed max-w-3xl">
              This documentation is designed to support your application
              file. It is not a substitute for your own consultant&apos;s
              record-keeping.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* Legal disclaimer */}
      <section className="bg-slate-50 border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <ScrollReveal>
            <div className="max-w-3xl bg-amber-50 border border-amber-200 rounded-lg p-6">
              <div className="flex items-center gap-2.5 mb-2">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-100 text-amber-700 flex-shrink-0">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6l7-3z" />
                  </svg>
                </span>
                <h2 className="text-sm font-bold text-amber-900">
                  Scope of This Service
                </h2>
              </div>
              <p className="text-amber-900/90 text-sm leading-relaxed">
                Flyer Distribution Hampshire provides physical leaflet and
                notice distribution only. We are not a planning consultancy
                and do not provide legal advice. This page is a general guide
                to how our distribution service works and should not be
                relied on as guidance on your statutory obligations. Your
                planning consultant or solicitor should confirm your
                Statement of Community Consultation requirements and wider
                statutory compliance before you rely on any distribution
                timeline we agree.
              </p>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Scaling note */}
      <section className="bg-white border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <ScrollReveal>
            <div className="flex items-center gap-3 mb-4">
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-blue-50 text-blue-700 flex-shrink-0">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
                </svg>
              </span>
              <h2 className="text-xl font-bold text-blue-900">
                From a Handful of Streets to a Whole Project Area
              </h2>
            </div>
            <p className="text-gray-600 max-w-3xl leading-relaxed">
              Our teams scale to the job, whether that means a handful of
              streets around a single substation upgrade or a much larger
              area spanning several parishes for a major infrastructure
              project. The planning and the documentation work the same way
              either way.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="bg-blue-900 text-white border-t border-blue-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">
            Working on an NSIP in Hampshire?
          </h2>
          <p className="text-blue-200 mb-8 max-w-xl">
            Get in touch to talk through your project&apos;s consultation
            area and timeline. We also cover general leaflet distribution
            across:
          </p>
          <div className="flex flex-wrap gap-3 mb-10">
            {[
              { name: "Southampton", href: "/areas/southampton" },
              { name: "Winchester", href: "/areas/winchester" },
              { name: "Eastleigh", href: "/areas/eastleigh" },
              { name: "New Forest", href: "/areas/new-forest" },
            ].map((area) => (
              <Link
                key={area.name}
                href={area.href}
                className="bg-blue-800 hover:bg-blue-700 border border-blue-700 text-white text-sm font-medium px-5 py-2.5 rounded-md transition duration-200 ease-out hover:scale-105"
              >
                {area.name}
              </Link>
            ))}
          </div>
          <Link
            href="/quote"
            className="inline-block bg-white text-blue-900 hover:bg-blue-50 font-bold px-8 py-4 rounded-md text-base transition duration-200 ease-out hover:scale-105 shadow-lg"
          >
            Get a Free Quote
          </Link>
        </div>
      </section>
    </>
  );
}
