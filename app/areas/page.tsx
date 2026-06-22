import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Areas We Cover in Hampshire & Dorset",
  description:
    "Flyer and leaflet distribution across Hampshire and Dorset. View coverage areas including Southampton, Bournemouth, Poole and Winchester.",
  openGraph: {
    title: "Areas We Cover in Hampshire & Dorset",
    description:
      "Flyer and leaflet distribution across Hampshire and Dorset. View coverage areas including Southampton, Bournemouth, Poole and Winchester.",
    url: "https://flyerdistributionhampshire.co.uk/areas",
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
    title: "Areas We Cover in Hampshire & Dorset",
    description:
      "Flyer and leaflet distribution across Hampshire and Dorset. View coverage areas including Southampton, Bournemouth, Poole and Winchester.",
    images: [
      "https://images.pexels.com/photos/35110918/pexels-photo-35110918.jpeg?auto=compress&cs=tinysrgb&w=1200",
    ],
  },
};

const featuredAreas = [
  {
    name: "Southampton",
    href: "/areas/southampton",
    desc: "Hampshire's largest city. Residential coverage across all major postcode areas.",
  },
  {
    name: "Bournemouth",
    href: "/areas/bournemouth",
    desc: "Major Dorset resort town with strong consumer footfall.",
  },
  {
    name: "Poole",
    href: "/areas/poole",
    desc: "Affluent harbour town with excellent residential distribution routes.",
  },
  {
    name: "Winchester",
    href: "/areas/winchester",
    desc: "Historic cathedral city and prosperous Hampshire county town.",
  },
  {
    name: "New Forest",
    href: "/areas/new-forest",
    desc: "Towns and villages across one of Hampshire's most distinctive districts.",
  },
  {
    name: "Ringwood",
    href: "/areas/ringwood",
    desc: "Market town on the New Forest edge, close to the Dorset border.",
  },
];

const otherAreas = [
  "Eastleigh",
  "Romsey",
  "Christchurch",
  "Hythe",
  "Totton",
  "Hedge End",
  "Chandler's Ford",
];

export default function AreasPage() {
  return (
    <>
      <section className="bg-blue-900 text-white py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">
            Areas We Cover
          </h1>
          <p className="text-blue-200 text-lg max-w-xl">
            We distribute flyers and leaflets across Hampshire and into Dorset,
            covering hundreds of postcodes and thousands of homes.
          </p>
        </div>
      </section>

      <section className="bg-slate-50 py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-blue-900 mb-8">
            Featured Locations
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
            {featuredAreas.map((area) => (
              <Link
                key={area.name}
                href={area.href}
                className="bg-white border border-gray-200 rounded-lg p-6 hover:border-blue-400 hover:shadow-md transition-all block"
              >
                <h3 className="text-base font-semibold text-blue-900 mb-1">
                  {area.name}
                </h3>
                <p className="text-gray-600 text-sm">{area.desc}</p>
                <span className="mt-3 inline-block text-blue-600 text-xs font-semibold">
                  View area →
                </span>
              </Link>
            ))}
          </div>

          <h2 className="text-2xl font-bold text-blue-900 mb-6">
            Also Covering
          </h2>
          <div className="flex flex-wrap gap-2">
            {otherAreas.map((area) => (
              <span
                key={area}
                className="bg-blue-50 border border-blue-200 text-blue-800 text-sm px-4 py-1.5 rounded-full"
              >
                {area}
              </span>
            ))}
          </div>
          <p className="mt-6 text-gray-500 text-sm">
            Don&apos;t see your area listed? Get in touch and we can often accommodate additional postcodes on request.
          </p>
        </div>
      </section>

      <section className="bg-white py-14 border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold text-blue-900 mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-gray-600 mb-8 max-w-md mx-auto">
            Tell us your target postcodes and we&apos;ll put together a quote
            within 24 hours.
          </p>
          <Link
            href="/quote"
            className="inline-block bg-blue-700 hover:bg-blue-800 text-white font-bold px-8 py-4 rounded-md transition-colors"
          >
            Get a Free Quote
          </Link>
        </div>
      </section>
    </>
  );
}
