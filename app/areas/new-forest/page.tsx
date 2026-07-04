import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Flyer Distribution New Forest",
  description:
    "Leaflet and flyer distribution across the New Forest, Hampshire. Door-to-door delivery to households in New Forest towns and villages.",
  alternates: {
    canonical: "https://www.flyerdistributionhampshire.co.uk/areas/new-forest",
  },
  openGraph: {
    title: "Flyer Distribution New Forest",
    description:
      "Leaflet and flyer distribution across the New Forest, Hampshire. Door-to-door delivery to households in New Forest towns and villages.",
    url: "https://www.flyerdistributionhampshire.co.uk/areas/new-forest",
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
    title: "Flyer Distribution New Forest",
    description:
      "Leaflet and flyer distribution across the New Forest, Hampshire. Door-to-door delivery to households in New Forest towns and villages.",
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
      name: "New Forest",
      item: "https://www.flyerdistributionhampshire.co.uk/areas/new-forest",
    },
  ],
};

export default function NewForestPage() {
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
            Leaflet Distribution New Forest
          </h1>
          <p className="text-blue-200 text-lg max-w-xl">
            Professional leaflet delivery across New Forest towns and villages,
            reaching households throughout one of Hampshire&apos;s most
            distinctive areas.
          </p>
        </div>
      </section>

      <section className="bg-slate-50 py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          <div>
            <h2 className="text-2xl font-bold text-blue-900 mb-4">
              About Our New Forest Coverage
            </h2>
            <p className="text-gray-600 mb-4 leading-relaxed">
              The New Forest is a unique area covering a wide spread of market
              towns, villages, and residential communities across southern
              Hampshire. Key towns include Lyndhurst, Brockenhurst, Fordingbridge,
              and Hythe, alongside a network of smaller villages with loyal,
              locally-minded residents.
            </p>
            <p className="text-gray-600 mb-4 leading-relaxed">
              We cover SO40, SO41, SO42, SO43, and surrounding postcode areas,
              delivering to households across the district. The New Forest
              demographic tends to be established and community-focused, making it
              well suited to local services, home improvement businesses, and
              independent retailers.
            </p>
            <p className="text-gray-600 leading-relaxed">
              Vehicle leaflet distribution is also available in car parks and
              high-footfall locations across New Forest towns for businesses
              looking to reach visitors and day-trippers as well as residents.
            </p>
            <div className="mt-8">
              <Link
                href="/quote"
                className="inline-block bg-blue-700 hover:bg-blue-800 text-white font-bold px-7 py-3.5 rounded-md transition duration-200 ease-out hover:scale-105"
              >
                Get a New Forest Quote
              </Link>
            </div>
          </div>
          <div>
            <Image
              src="https://images.pexels.com/photos/33881640/pexels-photo-33881640.jpeg?auto=compress&cs=tinysrgb&w=800"
              alt="New Forest village street in summer"
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
            New Forest Postcodes We Cover
          </h2>
          <div className="flex flex-wrap gap-2">
            {["SO40", "SO41", "SO42", "SO43", "SO45", "BH24", "BH25"].map((pc) => (
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
              href="/areas/ringwood"
              className="bg-white border border-gray-200 rounded-lg p-5 hover:border-blue-400 hover:shadow-md transition-all block"
            >
              <h3 className="text-sm font-semibold text-blue-900 mb-1">Ringwood</h3>
              <p className="text-gray-600 text-xs mb-3">Market town on the New Forest edge, close to the Dorset border.</p>
              <span className="text-blue-600 text-xs font-semibold">View area →</span>
            </Link>
            <Link
              href="/areas/southampton"
              className="bg-white border border-gray-200 rounded-lg p-5 hover:border-blue-400 hover:shadow-md transition-all block"
            >
              <h3 className="text-sm font-semibold text-blue-900 mb-1">Southampton</h3>
              <p className="text-gray-600 text-xs mb-3">Hampshire&apos;s largest city with residential coverage across all major postcodes.</p>
              <span className="text-blue-600 text-xs font-semibold">View area →</span>
            </Link>
            <Link
              href="/areas/bournemouth"
              className="bg-white border border-gray-200 rounded-lg p-5 hover:border-blue-400 hover:shadow-md transition-all block"
            >
              <h3 className="text-sm font-semibold text-blue-900 mb-1">Bournemouth</h3>
              <p className="text-gray-600 text-xs mb-3">Major Dorset resort town with strong consumer footfall.</p>
              <span className="text-blue-600 text-xs font-semibold">View area →</span>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
