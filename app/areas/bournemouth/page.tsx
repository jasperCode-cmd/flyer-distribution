import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Flyer Distribution Bournemouth",
  description:
    "Leaflet and flyer distribution across Bournemouth. Targeted door-to-door delivery for local businesses in Dorset.",
  alternates: {
    canonical: "https://www.flyerdistributionhampshire.co.uk/areas/bournemouth",
  },
  openGraph: {
    title: "Flyer Distribution Bournemouth",
    description:
      "Leaflet and flyer distribution across Bournemouth. Targeted door-to-door delivery for local businesses in Dorset.",
    url: "https://www.flyerdistributionhampshire.co.uk/areas/bournemouth",
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
    title: "Flyer Distribution Bournemouth",
    description:
      "Leaflet and flyer distribution across Bournemouth. Targeted door-to-door delivery for local businesses in Dorset.",
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
      name: "Bournemouth",
      item: "https://www.flyerdistributionhampshire.co.uk/areas/bournemouth",
    },
  ],
};

export default function BournemouthPage() {
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
            Leaflet Distribution Bournemouth
          </h1>
          <p className="text-blue-200 text-lg max-w-xl">
            Reach residents and visitors across Bournemouth with professional
            door-to-door leaflet distribution.
          </p>
        </div>
      </section>

      <section className="bg-slate-50 py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          <div>
            <h2 className="text-2xl font-bold text-blue-900 mb-4">
              About Our Bournemouth Coverage
            </h2>
            <p className="text-gray-600 mb-4 leading-relaxed">
              Bournemouth is one of Dorset&apos;s largest towns, known for its
              beaches, vibrant town centre, and large student population.
              We cover BH1 through BH12 and surrounding postcodes, reaching
              residential areas across all neighbourhoods.
            </p>
            <p className="text-gray-600 mb-4 leading-relaxed">
              Whether you need to reach the Westbourne boutique area,
              Boscombe, Winton, or the leafy suburbs, our experienced
              distributors know these routes well.
            </p>
            <p className="text-gray-600 leading-relaxed">
              Bournemouth&apos;s large student population and year-round tourism
              also make it one of the most responsive areas for campaign
              testing: high footfall, high density, and a wide mix of
              demographics within a compact postcode range.
            </p>
            <div className="mt-8">
              <Link
                href="/quote"
                className="inline-block bg-blue-700 hover:bg-blue-800 text-white font-bold px-7 py-3.5 rounded-md transition duration-200 ease-out hover:scale-105"
              >
                Get a Bournemouth Quote
              </Link>
            </div>
          </div>
          <div className="relative h-80 w-full overflow-hidden rounded-lg">
            <Image
              src="https://images.pexels.com/photos/29030837/pexels-photo-29030837.jpeg?auto=compress&cs=tinysrgb&w=800"
              alt="Bournemouth pier and ferris wheel"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
              style={{ objectPosition: "center" }}
            />
          </div>
        </div>
      </section>

      <section className="bg-white py-12 border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-xl font-bold text-blue-900 mb-4">
            Bournemouth Postcodes We Cover
          </h2>
          <div className="flex flex-wrap gap-2">
            {["BH1", "BH2", "BH3", "BH4", "BH5", "BH6", "BH7", "BH8", "BH9", "BH10", "BH11", "BH12"].map(
              (pc) => (
                <span
                  key={pc}
                  className="bg-blue-50 border border-blue-200 text-blue-800 text-sm px-4 py-1.5 rounded-full font-medium"
                >
                  {pc}
                </span>
              )
            )}
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
              href="/areas/poole"
              className="bg-white border border-gray-200 rounded-lg p-5 hover:border-blue-400 hover:shadow-md transition-all block"
            >
              <h3 className="text-sm font-semibold text-blue-900 mb-1">Poole</h3>
              <p className="text-gray-600 text-xs mb-3">Affluent harbour town with excellent residential distribution routes.</p>
              <span className="text-blue-600 text-xs font-semibold">View area →</span>
            </Link>
            <Link
              href="/areas/christchurch"
              className="bg-white border border-gray-200 rounded-lg p-5 hover:border-blue-400 hover:shadow-md transition-all block"
            >
              <h3 className="text-sm font-semibold text-blue-900 mb-1">Christchurch</h3>
              <p className="text-gray-600 text-xs mb-3">Coastal market town covering BH23 postcodes on the Dorset border.</p>
              <span className="text-blue-600 text-xs font-semibold">View area →</span>
            </Link>
            <Link
              href="/areas/dorset"
              className="bg-white border border-gray-200 rounded-lg p-5 hover:border-blue-400 hover:shadow-md transition-all block"
            >
              <h3 className="text-sm font-semibold text-blue-900 mb-1">Dorset</h3>
              <p className="text-gray-600 text-xs mb-3">County-wide coverage across Bournemouth, Poole and surrounding towns.</p>
              <span className="text-blue-600 text-xs font-semibold">View area →</span>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
