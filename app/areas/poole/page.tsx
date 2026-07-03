import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Flyer Distribution Poole",
  description:
    "Professional leaflet and flyer distribution across Poole, Dorset. Targeted delivery to residential areas around Poole Harbour.",
  alternates: {
    canonical: "https://www.flyerdistributionhampshire.co.uk/areas/poole",
  },
  openGraph: {
    title: "Flyer Distribution Poole",
    description:
      "Professional leaflet and flyer distribution across Poole, Dorset. Targeted delivery to residential areas around Poole Harbour.",
    url: "https://www.flyerdistributionhampshire.co.uk/areas/poole",
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
    title: "Flyer Distribution Poole",
    description:
      "Professional leaflet and flyer distribution across Poole, Dorset. Targeted delivery to residential areas around Poole Harbour.",
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
      name: "Poole",
      item: "https://www.flyerdistributionhampshire.co.uk/areas/poole",
    },
  ],
};

export default function PooléPage() {
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
            Leaflet Distribution Poole
          </h1>
          <p className="text-blue-200 text-lg max-w-xl">
            Door-to-door leaflet delivery across Poole, covering affluent
            residential areas and harbour-side communities in Dorset.
          </p>
        </div>
      </section>

      <section className="bg-slate-50 py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          <div>
            <h2 className="text-2xl font-bold text-blue-900 mb-4">
              About Our Poole Coverage
            </h2>
            <p className="text-gray-600 mb-4 leading-relaxed">
              Poole is one of the most affluent towns in Dorset, with
              prestigious areas like Sandbanks, Canford Cliffs, and Branksome
              Park attracting high-income households. Our distributors cover
              BH13 through BH17 and surrounding postcodes.
            </p>
            <p className="text-gray-600 mb-4 leading-relaxed">
              For businesses targeting higher-income demographics, Poole&apos;s
              waterfront and marina postcodes offer some of the highest-value
              residential distribution in Dorset, particularly for luxury
              services, premium restaurants, and home improvement.
            </p>
            <p className="text-gray-600 leading-relaxed">
              We also cover Parkstone, Upton, Hamworthy, and the wider
              residential areas around the harbour.
            </p>
            <div className="mt-8">
              <Link
                href="/quote"
                className="inline-block bg-blue-700 hover:bg-blue-800 text-white font-bold px-7 py-3.5 rounded-md transition-colors"
              >
                Get a Poole Quote
              </Link>
            </div>
          </div>
          <div>
            <Image
              src="https://images.pexels.com/photos/32385939/pexels-photo-32385939.jpeg?auto=compress&cs=tinysrgb&w=800"
              alt="Poole waterfront architecture"
              width={700}
              height={500}
              className="rounded-lg w-full object-cover"
            />
          </div>
        </div>
      </section>

      <section className="bg-white py-12 border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-xl font-bold text-blue-900 mb-4">
            Poole Postcodes We Cover
          </h2>
          <div className="flex flex-wrap gap-2">
            {["BH12", "BH13", "BH14", "BH15", "BH16", "BH17", "BH18"].map((pc) => (
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
              href="/areas/bournemouth"
              className="bg-white border border-gray-200 rounded-lg p-5 hover:border-blue-400 hover:shadow-md transition-all block"
            >
              <h3 className="text-sm font-semibold text-blue-900 mb-1">Bournemouth</h3>
              <p className="text-gray-600 text-xs mb-3">Major Dorset resort town with strong consumer footfall.</p>
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
            <Link
              href="/areas/ringwood"
              className="bg-white border border-gray-200 rounded-lg p-5 hover:border-blue-400 hover:shadow-md transition-all block"
            >
              <h3 className="text-sm font-semibold text-blue-900 mb-1">Ringwood</h3>
              <p className="text-gray-600 text-xs mb-3">Market town on the New Forest edge, close to the Dorset border.</p>
              <span className="text-blue-600 text-xs font-semibold">View area →</span>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
