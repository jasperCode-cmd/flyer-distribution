import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Leaflet Distribution Eastleigh",
  description:
    "Targeted leaflet and flyer distribution across Eastleigh and SO50 postcodes. Door-to-door delivery for local businesses in one of Hampshire's largest towns.",
  alternates: {
    canonical: "https://www.flyerdistributionhampshire.co.uk/areas/eastleigh",
  },
  openGraph: {
    title: "Leaflet Distribution Eastleigh",
    description:
      "Targeted leaflet and flyer distribution across Eastleigh and SO50 postcodes. Door-to-door delivery for local businesses in one of Hampshire's largest towns.",
    url: "https://www.flyerdistributionhampshire.co.uk/areas/eastleigh",
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
    title: "Leaflet Distribution Eastleigh",
    description:
      "Targeted leaflet and flyer distribution across Eastleigh and SO50 postcodes. Door-to-door delivery for local businesses in one of Hampshire's largest towns.",
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
      name: "Areas",
      item: "https://www.flyerdistributionhampshire.co.uk/areas",
    },
    {
      "@type": "ListItem",
      position: 3,
      name: "Eastleigh",
      item: "https://www.flyerdistributionhampshire.co.uk/areas/eastleigh",
    },
  ],
};

export default function EastleighPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <section className="bg-blue-900 text-white py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-blue-300 text-sm uppercase tracking-widest mb-2">
            Coverage Area
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">
            Leaflet Distribution Eastleigh
          </h1>
          <p className="text-blue-200 text-lg max-w-xl">
            Targeted door-to-door leaflet delivery across Eastleigh and
            surrounding SO50 postcodes.
          </p>
        </div>
      </section>

      <section className="bg-slate-50 py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          <div>
            <h2 className="text-2xl font-bold text-blue-900 mb-4">
              About Our Eastleigh Coverage
            </h2>
            <p className="text-gray-600 mb-4 leading-relaxed">
              Eastleigh is one of Hampshire&apos;s largest towns, home to around
              50,000 residents across a mix of residential neighbourhoods and
              commercial areas. We cover SO50 and surrounding postcodes,
              delivering directly through letterboxes across the town.
            </p>
            <p className="text-gray-600 mb-4 leading-relaxed">
              Whether you&apos;re targeting the town centre, Chandler&apos;s
              Ford, Hedge End, or surrounding villages, our experienced
              distributors know these routes well.
            </p>
            <p className="text-gray-600 leading-relaxed">
              Eastleigh&apos;s proximity to Southampton Airport and strong
              commuter population also makes it well suited to targeted postcode
              campaigns for local service businesses.
            </p>
            <div className="mt-8">
              <Link
                href="/quote"
                className="inline-block bg-blue-700 hover:bg-blue-800 text-white font-bold px-7 py-3.5 rounded-md transition-colors"
              >
                Get an Eastleigh Quote
              </Link>
            </div>
          </div>
          <div className="aspect-square overflow-hidden rounded-lg">
            <Image
              src="/Street_Image_when_distributing_flyers.jpg"
              alt="Street scene during leaflet distribution in Eastleigh"
              width={700}
              height={700}
              className="w-full h-full object-cover object-center"
            />
          </div>
        </div>
      </section>

      <section className="bg-white py-12 border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-xl font-bold text-blue-900 mb-4">
            Eastleigh Postcodes We Cover
          </h2>
          <div className="flex flex-wrap gap-2">
            {["SO50", "SO53"].map((pc) => (
              <span
                key={pc}
                className="bg-blue-50 border border-blue-200 text-blue-800 text-sm px-4 py-1.5 rounded-full font-medium"
              >
                {pc}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-12 border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-xl font-bold text-blue-900 mb-6">
            Other Areas Nearby
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link
              href="/areas/southampton"
              className="bg-white border border-gray-200 rounded-lg p-5 hover:border-blue-400 hover:shadow-md transition-all block"
            >
              <h3 className="text-sm font-semibold text-blue-900 mb-1">Southampton</h3>
              <p className="text-gray-600 text-xs mb-3">Hampshire&apos;s largest city with residential coverage across all major postcodes.</p>
              <span className="text-blue-600 text-xs font-semibold">View area →</span>
            </Link>
            <Link
              href="/areas/winchester"
              className="bg-white border border-gray-200 rounded-lg p-5 hover:border-blue-400 hover:shadow-md transition-all block"
            >
              <h3 className="text-sm font-semibold text-blue-900 mb-1">Winchester</h3>
              <p className="text-gray-600 text-xs mb-3">Historic cathedral city and prosperous Hampshire county town.</p>
              <span className="text-blue-600 text-xs font-semibold">View area →</span>
            </Link>
            <Link
              href="/areas/new-forest"
              className="bg-white border border-gray-200 rounded-lg p-5 hover:border-blue-400 hover:shadow-md transition-all block"
            >
              <h3 className="text-sm font-semibold text-blue-900 mb-1">New Forest</h3>
              <p className="text-gray-600 text-xs mb-3">Towns and villages across one of Hampshire&apos;s most distinctive districts.</p>
              <span className="text-blue-600 text-xs font-semibold">View area →</span>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
