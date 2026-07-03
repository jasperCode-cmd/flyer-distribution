import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Flyer Distribution Southampton",
  description:
    "Leaflet and flyer distribution across Southampton. Targeted postcode delivery for businesses reaching Hampshire's largest city.",
  alternates: {
    canonical: "https://www.flyerdistributionhampshire.co.uk/areas/southampton",
  },
  openGraph: {
    title: "Flyer Distribution Southampton",
    description:
      "Leaflet and flyer distribution across Southampton. Targeted postcode delivery for businesses reaching Hampshire's largest city.",
    url: "https://www.flyerdistributionhampshire.co.uk/areas/southampton",
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
    title: "Flyer Distribution Southampton",
    description:
      "Leaflet and flyer distribution across Southampton. Targeted postcode delivery for businesses reaching Hampshire's largest city.",
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
      name: "Southampton",
      item: "https://www.flyerdistributionhampshire.co.uk/areas/southampton",
    },
  ],
};

export default function SouthamptonPage() {
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
            Leaflet Distribution Southampton
          </h1>
          <p className="text-blue-200 text-lg max-w-xl">
            Reach households and businesses across Hampshire&apos;s largest city
            with targeted door-to-door leaflet delivery.
          </p>
        </div>
      </section>

      <section className="bg-slate-50 py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          <div>
            <h2 className="text-2xl font-bold text-blue-900 mb-4">
              About Our Southampton Coverage
            </h2>
            <p className="text-gray-600 mb-4 leading-relaxed">
              Southampton is Hampshire&apos;s largest city, home to over 250,000
              residents across diverse neighbourhoods. Our distribution teams
              cover all major postcodes including SO14, SO15, SO16, SO17, SO18,
              SO19, and surrounding areas.
            </p>
            <p className="text-gray-600 mb-4 leading-relaxed">
              Whether you&apos;re targeting the city centre, Shirley, Portswood,
              Bitterne, or the waterfront areas, we deliver your flyers reliably
              and efficiently to the right letterboxes.
            </p>
            <p className="text-gray-600 leading-relaxed">
              We work with restaurants, tradespeople, estate agents, gyms,
              retailers, and many other local businesses to help them grow their
              customer base through effective print marketing.
            </p>
            <div className="mt-8">
              <Link
                href="/quote"
                className="inline-block bg-blue-700 hover:bg-blue-800 text-white font-bold px-7 py-3.5 rounded-md transition-colors"
              >
                Get a Southampton Quote
              </Link>
            </div>
          </div>
          <div>
            <Image
              src="https://images.pexels.com/photos/19916593/pexels-photo-19916593.jpeg?auto=compress&cs=tinysrgb&w=800"
              alt="Southampton city centre shopping mall"
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
            Southampton Postcodes We Cover
          </h2>
          <div className="flex flex-wrap gap-2">
            {["SO14", "SO15", "SO16", "SO17", "SO18", "SO19", "SO30", "SO31", "SO40", "SO45"].map(
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
              href="/areas/eastleigh"
              className="bg-white border border-gray-200 rounded-lg p-5 hover:border-blue-400 hover:shadow-md transition-all block"
            >
              <h3 className="text-sm font-semibold text-blue-900 mb-1">Eastleigh</h3>
              <p className="text-gray-600 text-xs mb-3">One of Hampshire&apos;s largest towns, covering SO50 postcodes.</p>
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
