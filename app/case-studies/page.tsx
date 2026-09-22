import type { Metadata } from "next";
import Link from "next/link";
import RoutePlaceholderGraphic from "@/components/RoutePlaceholderGraphic";

export const metadata: Metadata = {
  title: "Case Studies",
  description:
    "Real completed leaflet distribution campaigns across Hampshire, from residential rounds to statutory public notice leafleting.",
  alternates: {
    canonical: "https://www.flyerdistributionhampshire.co.uk/case-studies",
  },
  openGraph: {
    title: "Case Studies | Flyer Distribution Hampshire",
    description:
      "Real completed leaflet distribution campaigns across Hampshire, from residential rounds to statutory public notice leafleting.",
    url: "https://www.flyerdistributionhampshire.co.uk/case-studies",
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
    title: "Case Studies | Flyer Distribution Hampshire",
    description:
      "Real completed leaflet distribution campaigns across Hampshire, from residential rounds to statutory public notice leafleting.",
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
      name: "Case Studies",
      item: "https://www.flyerdistributionhampshire.co.uk/case-studies",
    },
  ],
};

// All four entries below are real completed jobs, but we don't yet have
// specific leaflet counts, client names, dates, or measured outcomes to
// publish for them. Copy is deliberately written at the level of "what
// kind of work this was" rather than specific figures, and nothing here
// should be treated as final. Swap in real details (and a real Strava
// route export in place of RoutePlaceholderGraphic) once available.
const caseStudies = [
  {
    place: "West Wellow",
    body: "A residential door-to-door leaflet drop across West Wellow, delivering printed materials directly to households throughout the village.",
    linkHref: "/areas",
    linkLabel: "See our coverage areas",
  },
  {
    place: "Micheldever & Winchester Area",
    body: "Leaflet distribution covering Micheldever and the wider Winchester area, reaching households and local businesses within a defined round.",
    linkHref: "/areas/winchester",
    linkLabel: "See our Winchester coverage",
  },
  {
    place: "Oakley",
    body: "A completed leaflet distribution round in Oakley, delivering door-to-door across residential streets in the village.",
    linkHref: "/areas",
    linkLabel: "See our coverage areas",
  },
  {
    place: "Across Hampshire",
    subtitle: "Public Notice Leafleting",
    body: "Statutory public notice leafleting supporting community consultation requirements for a Nationally Significant Infrastructure Project, distributed across the project-defined area rather than a standard postcode round.",
    linkHref: "/services/public-notice-leafleting",
    linkLabel: "Learn about Public Notice Leafleting",
  },
];

export default function CaseStudiesPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <section className="bg-blue-900 text-white py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">Case Studies</h1>
          <p className="text-blue-200 text-lg max-w-xl">
            A look at real leaflet distribution campaigns we&apos;ve completed
            across Hampshire.
          </p>
        </div>
      </section>

      <section className="bg-slate-50 py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            {caseStudies.map((study) => (
              <div
                key={study.place}
                className="group bg-white rounded-lg border border-gray-200 overflow-hidden hover:border-blue-300 hover:shadow-lg hover:scale-[1.02] transition-all duration-300 ease-out"
              >
                <div className="p-4 pb-0">
                  <RoutePlaceholderGraphic />
                </div>
                <div className="p-6">
                  {study.subtitle && (
                    <p className="text-xs font-semibold uppercase tracking-widest text-blue-500 mb-1">
                      {study.subtitle}
                    </p>
                  )}
                  <h2 className="text-lg font-bold text-blue-900 mb-2">{study.place}</h2>
                  <p className="text-gray-600 text-sm leading-relaxed mb-4">{study.body}</p>
                  <Link
                    href={study.linkHref}
                    className="text-blue-700 hover:text-blue-900 font-semibold text-sm underline underline-offset-2"
                  >
                    {study.linkLabel} →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-16 border-t border-gray-100 text-center">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-blue-900 mb-4">
            Have a Campaign in Mind?
          </h2>
          <p className="text-gray-600 mb-8 max-w-md mx-auto">
            Get in touch for a free, no-obligation quote for your own
            leaflet distribution campaign.
          </p>
          <Link
            href="/quote"
            className="inline-block bg-blue-700 hover:bg-blue-800 text-white font-bold px-8 py-4 rounded-md transition duration-200 ease-out hover:scale-105"
          >
            Get a Free Quote
          </Link>
        </div>
      </section>
    </>
  );
}
