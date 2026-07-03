import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Leaflet Distribution Dorset",
  description:
    "County-wide leaflet and flyer distribution across Dorset. Covering Bournemouth, Poole, Christchurch, Weymouth and surrounding towns.",
  alternates: {
    canonical: "https://www.flyerdistributionhampshire.co.uk/areas/dorset",
  },
  openGraph: {
    title: "Leaflet Distribution Dorset",
    description:
      "County-wide leaflet and flyer distribution across Dorset. Covering Bournemouth, Poole, Christchurch, Weymouth and surrounding towns.",
    url: "https://www.flyerdistributionhampshire.co.uk/areas/dorset",
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
    title: "Leaflet Distribution Dorset",
    description:
      "County-wide leaflet and flyer distribution across Dorset. Covering Bournemouth, Poole, Christchurch, Weymouth and surrounding towns.",
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
      name: "Dorset",
      item: "https://www.flyerdistributionhampshire.co.uk/areas/dorset",
    },
  ],
};

export default function DorsetPage() {
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
            Leaflet Distribution Dorset
          </h1>
          <p className="text-blue-200 text-lg max-w-xl">
            County-wide leaflet delivery across Dorset, from Bournemouth and
            Poole in the east to Weymouth and beyond.
          </p>
        </div>
      </section>

      <section className="bg-slate-50 py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          <div>
            <h2 className="text-2xl font-bold text-blue-900 mb-4">
              About Our Dorset Coverage
            </h2>
            <p className="text-gray-600 mb-4 leading-relaxed">
              Dorset is one of the most diverse counties on the south coast, with
              major urban centres in Bournemouth and Poole, busy coastal towns
              like Christchurch and Weymouth, and a wealth of market towns and
              villages inland. Our distribution teams cover all key areas across
              the county.
            </p>
            <p className="text-gray-600 mb-4 leading-relaxed">
              We cover BH postcode areas across the east of the county, including
              Bournemouth, Poole, Christchurch, Wimborne, Ferndown, and
              Verwood, as well as the DT postcodes serving Dorchester,
              Weymouth, Bridport, and Sherborne.
            </p>
            <p className="text-gray-600 leading-relaxed">
              Whether you need to reach urban households, coastal communities, or
              the county&apos;s rural residents, we can build a Dorset-wide
              campaign or focus on specific towns and postcodes that match your
              customer profile.
            </p>
            <div className="mt-8">
              <Link
                href="/quote"
                className="inline-block bg-blue-700 hover:bg-blue-800 text-white font-bold px-7 py-3.5 rounded-md transition-colors"
              >
                Get a Dorset Quote
              </Link>
            </div>
          </div>
          <div className="relative h-80 w-full overflow-hidden rounded-lg">
            <Image
              src="https://images.pexels.com/photos/1591339/pexels-photo-1591339.jpeg?auto=compress&cs=tinysrgb&w=800"
              alt="Dorset countryside rolling hills"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
        </div>
      </section>

      <section className="bg-white py-12 border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-xl font-bold text-blue-900 mb-4">
            Dorset Postcodes We Cover
          </h2>
          <div className="flex flex-wrap gap-2">
            {[
              "BH1", "BH2", "BH3", "BH4", "BH5", "BH6", "BH7", "BH8",
              "BH9", "BH10", "BH11", "BH12", "BH13", "BH14", "BH15",
              "BH16", "BH17", "BH18", "BH21", "BH22", "BH23", "BH24",
              "DT1", "DT2", "DT3", "DT4", "DT9", "DT11",
            ].map((pc) => (
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
    </>
  );
}
