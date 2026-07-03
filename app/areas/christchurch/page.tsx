import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Leaflet Distribution Christchurch",
  description:
    "Leaflet and flyer distribution across Christchurch and BH23 postcodes. Targeted door-to-door delivery in this coastal Dorset market town.",
  alternates: {
    canonical: "https://www.flyerdistributionhampshire.co.uk/areas/christchurch",
  },
  openGraph: {
    title: "Leaflet Distribution Christchurch",
    description:
      "Leaflet and flyer distribution across Christchurch and BH23 postcodes. Targeted door-to-door delivery in this coastal Dorset market town.",
    url: "https://www.flyerdistributionhampshire.co.uk/areas/christchurch",
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
    title: "Leaflet Distribution Christchurch",
    description:
      "Leaflet and flyer distribution across Christchurch and BH23 postcodes. Targeted door-to-door delivery in this coastal Dorset market town.",
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
      name: "Christchurch",
      item: "https://www.flyerdistributionhampshire.co.uk/areas/christchurch",
    },
  ],
};

export default function ChristchurchPage() {
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
            Leaflet Distribution Christchurch
          </h1>
          <p className="text-blue-200 text-lg max-w-xl">
            Door-to-door leaflet delivery across Christchurch and BH23
            postcodes, reaching households in this coastal Dorset market town.
          </p>
        </div>
      </section>

      <section className="bg-slate-50 py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          <div>
            <h2 className="text-2xl font-bold text-blue-900 mb-4">
              About Our Christchurch Coverage
            </h2>
            <p className="text-gray-600 mb-4 leading-relaxed">
              Christchurch sits on the Dorset coast between Bournemouth and the
              New Forest, with a settled residential population and a strong
              seasonal visitor trade. We cover BH23 and surrounding postcodes,
              delivering to households across the town and into nearby villages
              including Burton, Walkford, and Highcliffe.
            </p>
            <p className="text-gray-600 mb-4 leading-relaxed">
              The town&apos;s established residential character makes it well
              suited to campaigns targeting homeowners, particularly for home
              improvement, professional services, and local tradespeople. Its
              position between Bournemouth and the New Forest also makes it a
              natural add-on for businesses running wider coastal or county
              campaigns.
            </p>
            <p className="text-gray-600 leading-relaxed">
              Christchurch&apos;s harbourside and town centre retail areas are
              also available for vehicle leaflet distribution, reaching visitors
              and day-trippers alongside the resident population.
            </p>
            <div className="mt-8">
              <Link
                href="/quote"
                className="inline-block bg-blue-700 hover:bg-blue-800 text-white font-bold px-7 py-3.5 rounded-md transition-colors"
              >
                Get a Christchurch Quote
              </Link>
            </div>
          </div>
          <div className="relative h-80 w-full overflow-hidden rounded-lg">
            <Image
              src="https://images.pexels.com/photos/1796730/pexels-photo-1796730.jpeg?auto=compress&cs=tinysrgb&w=800"
              alt="Christchurch harbour and waterfront"
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
            Christchurch Postcodes We Cover
          </h2>
          <div className="flex flex-wrap gap-2">
            {["BH23"].map((pc) => (
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
