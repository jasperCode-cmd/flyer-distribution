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
              Dorset is one of the most varied counties for leaflet distribution,
              covering everything from the busy urban centres of Bournemouth and
              Poole through to the quieter market towns and coastal villages
              further west. If you are running a campaign that needs to reach
              audiences across the county rather than a single town, a
              Dorset-wide campaign is the most effective way to do it.
            </p>
            <p className="text-gray-600 mb-4 leading-relaxed">
              We cover all major Dorset postcode areas including BH1 through
              BH25, DT1 and surrounding Dorchester postcodes, and the coastal
              and rural areas in between. This makes us the right partner for
              businesses with a broad Dorset audience, including regional service
              providers, national brands running local activations, charities
              covering the county, and event promoters reaching across multiple
              towns at once.
            </p>
            <p className="text-gray-600 leading-relaxed">
              Where you need coverage in specific towns such as Bournemouth,
              Poole, or Christchurch, we also offer targeted campaigns for each
              of those areas individually. County-wide and multi-town campaigns
              are priced and planned as a single campaign, so you get one point
              of contact and one coordinated delivery.
            </p>
            <div className="mt-8">
              <Link
                href="/quote"
                className="inline-block bg-blue-700 hover:bg-blue-800 text-white font-bold px-7 py-3.5 rounded-md transition duration-200 ease-out hover:scale-105"
              >
                Get a Dorset Quote
              </Link>
            </div>
          </div>
          <div className="aspect-square overflow-hidden rounded-lg">
            <Image
              src="https://images.pexels.com/photos/20814980/pexels-photo-20814980.jpeg?auto=compress&cs=tinysrgb&w=800"
              alt="Dorset coastal town"
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
          </div>
        </div>
      </section>
    </>
  );
}
