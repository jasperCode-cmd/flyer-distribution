import type { Metadata } from "next";
import Link from "next/link";
import CaseStudyCollage from "@/components/CaseStudyCollage";

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

// All four entries below are real completed jobs. Leaflet counts and
// client type are now real figures. We still don't have specific client
// names, dates, or measured outcomes to publish, so copy stays at the
// level of "what kind of work this was" rather than more specific detail,
// and nothing here should be treated as final beyond the stat tags.
const caseStudies = [
  {
    place: "West Wellow",
    stat: "2,500 Leaflets (Financial Services)",
    body: "A residential door-to-door leaflet drop across West Wellow, delivering printed materials directly to households throughout the village.",
    linkHref: "/areas",
    linkLabel: "See our coverage areas",
    collage: {
      hero: {
        src: "/Wellow-Route1.webp",
        alt: "Aerial GPS-recorded route map showing a dense door-to-door leaflet round through the Whinwhistle Road and The Drive area of West Wellow",
      },
      stacked: [
        {
          src: "/Wellow-Route2.webp",
          alt: "Aerial GPS-recorded route map showing a leaflet round along Maurys Lane, Slab Lane and Gazing Lane in West Wellow",
        },
        {
          src: "/Wellow-Route3.webp",
          alt: "Aerial GPS-recorded route map showing a leaflet round through Buttons Lane, Gazing Lane and School Road in West Wellow",
        },
      ],
    },
  },
  {
    place: "Across Hampshire",
    subtitle: "Public Notice Leafleting",
    stat: "3,500+ Leaflets (Hampshire Council Road Closure)",
    body: "Statutory public notice leafleting supporting community consultation requirements for a Nationally Significant Infrastructure Project, distributed across the project-defined area rather than a standard postcode round.",
    linkHref: "/services/public-notice-leafleting",
    linkLabel: "Learn about Public Notice Leafleting",
    collage: {
      hero: {
        src: "/Road-Closure-Hampshire-Route4.webp",
        alt: "Aerial GPS-recorded route map showing a road closure notice round along Clay Hill near Lyndhurst",
      },
      stacked: [
        {
          src: "/Road-Closure-Hampshire-Route1.webp",
          alt: "Aerial GPS-recorded route map showing a road closure notice round through an industrial and retail park, past car dealerships and takeaway outlets",
        },
        {
          src: "/Road-Closure-Hampshire-Route3.webp",
          alt: "Aerial GPS-recorded route map showing a road closure notice round along Sandy Lane and Winchester Road in Fair Oak",
        },
        {
          src: "/Road-Closure-Hampshire-Route2.webp",
          alt: "Aerial GPS-recorded route map showing a road closure notice round along Witt Road and Brookfield Road in Fair Oak",
        },
      ],
    },
  },
  {
    place: "Oakley",
    stat: "1,000 Leaflets (Beauty & Wellness Services)",
    body: "A completed leaflet distribution round in Oakley, delivering door-to-door across residential streets in the village.",
    linkHref: "/areas",
    linkLabel: "See our coverage areas",
    collage: {
      hero: {
        src: "/Oakley-Route1.webp",
        alt: "Aerial GPS-recorded route map showing an extensive leaflet round covering East Oakley, Kennet Way, The Drive and Hill Road",
      },
      stacked: [
        {
          src: "/Oakley-Route2.webp",
          alt: "Aerial GPS-recorded route map showing a leaflet round through the streets of Oakley village",
        },
      ],
    },
  },
  {
    place: "Micheldever & Winchester Area",
    stat: "1,000 Leaflets (Opera Performance)",
    body: "Leaflet distribution covering Micheldever and the wider Winchester area, reaching households and local businesses within a defined round.",
    linkHref: "/areas/winchester",
    linkLabel: "See our Winchester coverage",
    collage: {
      hero: {
        src: "/Micheldever-Route2.webp",
        alt: "Aerial GPS-recorded route map showing a leaflet round along Northbrook in Micheldever",
      },
      stacked: [
        {
          src: "/Micheldever-Route1.webp",
          alt: "Aerial GPS-recorded route map showing a leaflet round through Sloe Lane, past Micheldever Village Store",
        },
        {
          src: "/Micheldever-Route3.webp",
          alt: "Aerial GPS-recorded route map showing a leaflet round through Wonston Road, Old Stoke Road and Weston Down Road near Micheldever",
        },
      ],
    },
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
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">Case Studies - What Does GPS Tracked Leaflet Distribution Look Like?</h1>
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
                  <CaseStudyCollage hero={study.collage.hero} stacked={study.collage.stacked} />
                </div>
                <div className="p-6">
                  {study.subtitle && (
                    <p className="text-xs font-semibold uppercase tracking-widest text-blue-500 mb-1">
                      {study.subtitle}
                    </p>
                  )}
                  <h2 className="text-lg font-bold text-blue-900 mb-2">{study.place}</h2>
                  <span className="inline-block bg-blue-50 border border-blue-200 text-blue-800 text-xs font-semibold px-3 py-1 rounded-full mb-3">
                    {study.stat}
                  </span>
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
