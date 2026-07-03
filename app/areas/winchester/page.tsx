import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Flyer Distribution Winchester",
  description:
    "Leaflet and flyer distribution across Winchester, Hampshire. Professional door-to-door delivery in the county town and surrounding villages.",
  alternates: {
    canonical: "https://www.flyerdistributionhampshire.co.uk/areas/winchester",
  },
  openGraph: {
    title: "Flyer Distribution Winchester",
    description:
      "Leaflet and flyer distribution across Winchester, Hampshire. Professional door-to-door delivery in the county town and surrounding villages.",
    url: "https://www.flyerdistributionhampshire.co.uk/areas/winchester",
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
    title: "Flyer Distribution Winchester",
    description:
      "Leaflet and flyer distribution across Winchester, Hampshire. Professional door-to-door delivery in the county town and surrounding villages.",
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
      name: "Winchester",
      item: "https://www.flyerdistributionhampshire.co.uk/areas/winchester",
    },
  ],
};

export default function WinchesterPage() {
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
            Leaflet Distribution Winchester
          </h1>
          <p className="text-blue-200 text-lg max-w-xl">
            Professional leaflet delivery across Winchester city and surrounding
            Hampshire villages, reaching the affluent households of the county
            town.
          </p>
        </div>
      </section>

      <section className="bg-slate-50 py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          <div>
            <h2 className="text-2xl font-bold text-blue-900 mb-4">
              About Our Winchester Coverage
            </h2>
            <p className="text-gray-600 mb-4 leading-relaxed">
              Winchester is Hampshire&apos;s historic county town, consistently
              ranked among the best places to live in the UK. With high average
              household incomes and a thriving independent business scene,
              leaflet distribution here reaches an engaged, local audience.
            </p>
            <p className="text-gray-600 mb-4 leading-relaxed">
              We cover SO21, SO22, SO23, and surrounding postcode areas
              including the city centre, St Cross, Badger Farm, Harestock, and
              the outlying villages such as Colden Common and Bishopstoke.
            </p>
            <p className="text-gray-600 leading-relaxed">
              Winchester&apos;s county town professional base makes it
              particularly effective for premium services such as home
              improvements, fine dining, private schools, and specialist
              professional services.
            </p>
            <div className="mt-8">
              <Link
                href="/quote"
                className="inline-block bg-blue-700 hover:bg-blue-800 text-white font-bold px-7 py-3.5 rounded-md transition-colors"
              >
                Get a Winchester Quote
              </Link>
            </div>
          </div>
          <div>
            <Image
              src="https://images.pexels.com/photos/11167778/pexels-photo-11167778.jpeg?auto=compress&cs=tinysrgb&w=800"
              alt="Winchester Cathedral"
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
            Winchester Postcodes We Cover
          </h2>
          <div className="flex flex-wrap gap-2">
            {["SO21", "SO22", "SO23", "SO24", "SO32"].map((pc) => (
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
              href="/areas/eastleigh"
              className="bg-white border border-gray-200 rounded-lg p-5 hover:border-blue-400 hover:shadow-md transition-all block"
            >
              <h3 className="text-sm font-semibold text-blue-900 mb-1">Eastleigh</h3>
              <p className="text-gray-600 text-xs mb-3">One of Hampshire&apos;s largest towns, covering SO50 postcodes.</p>
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
