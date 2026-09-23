import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Breadcrumb from "@/components/Breadcrumb";

export const metadata: Metadata = {
  title: "Leaflet Distribution Romsey",
  description:
    "Leaflet and flyer distribution across Romsey and SO51 postcodes. Targeted door-to-door delivery in this historic Hampshire market town.",
  alternates: {
    canonical: "https://www.flyerdistributionhampshire.co.uk/areas/romsey",
  },
  openGraph: {
    title: "Leaflet Distribution Romsey",
    description:
      "Leaflet and flyer distribution across Romsey and SO51 postcodes. Targeted door-to-door delivery in this historic Hampshire market town.",
    url: "https://www.flyerdistributionhampshire.co.uk/areas/romsey",
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
    title: "Leaflet Distribution Romsey",
    description:
      "Leaflet and flyer distribution across Romsey and SO51 postcodes. Targeted door-to-door delivery in this historic Hampshire market town.",
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
      name: "Romsey",
      item: "https://www.flyerdistributionhampshire.co.uk/areas/romsey",
    },
  ],
};

export default function RomseyPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <section className="bg-blue-900 text-white py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <Breadcrumb
            items={[
              { label: "Home", href: "/" },
              { label: "Areas", href: "/areas" },
              { label: "Romsey" },
            ]}
          />
          <p className="text-blue-300 text-sm uppercase tracking-widest mb-2">
            Coverage Area
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">
            Leaflet Distribution Romsey
          </h1>
          <p className="text-blue-200 text-lg max-w-xl">
            Door-to-door leaflet delivery across Romsey and SO51 postcodes,
            reaching households in this historic Hampshire market town.
          </p>
        </div>
      </section>

      <section className="bg-slate-50 py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          <div>
            <h2 className="text-2xl font-bold text-blue-900 mb-4">
              About Our Romsey Coverage
            </h2>
            <p className="text-gray-600 mb-4 leading-relaxed">
              Romsey is a historic market town in the Test Valley, sitting
              between Southampton and Salisbury with a well-loved,
              independent town centre. We cover SO51 and the
              surrounding villages, delivering door to door across the town
              centre, the newer residential estates, and the rural
              properties just outside it.
            </p>
            <p className="text-gray-600 mb-4 leading-relaxed">
              The pedestrianised town centre around Romsey Abbey draws a
              loyal local crowd, and that same audience responds well to
              print marketing for independent shops, cafes, trades and
              professional services. Many of our Romsey campaigns pair the
              town itself with nearby{" "}
              <Link href="/areas/southampton" className="text-blue-700 hover:underline font-medium">
                Southampton
              </Link>{" "}
              or{" "}
              <Link href="/areas/totton" className="text-blue-700 hover:underline font-medium">
                Totton
              </Link>{" "}
              for businesses wanting wider reach across the Test Valley.
            </p>
            <p className="text-gray-600 leading-relaxed">
              Vehicle campaigns are also part of{" "}
              <Link href="/services" className="text-blue-700 hover:underline font-medium">
                our leaflet distribution options
              </Link>{" "}
              around Romsey&apos;s car parks and retail areas, useful for
              reaching visitors to the Abbey and Sir Harold Hillier Gardens
              alongside residents. We&apos;ve also completed
              residential rounds out towards West Wellow, where you can{" "}
              <Link href="/case-studies" className="text-blue-700 hover:underline font-medium">
                see the results
              </Link>
              .
            </p>
            <div className="mt-8">
              <Link
                href="/quote"
                className="inline-block bg-blue-700 hover:bg-blue-800 text-white font-bold px-7 py-3.5 rounded-md transition duration-200 ease-out hover:scale-105"
              >
                Get a Romsey Quote
              </Link>
            </div>
          </div>
          <div className="max-w-sm mx-auto lg:mx-0 aspect-square overflow-hidden rounded-lg shadow-lg ring-1 ring-black/5">
            <Image
              src="/Overhead-shot-residential-areas.webp"
              alt="Overhead view of a residential street with houses and gardens, typical of the neighbourhoods we cover"
              width={999}
              height={999}
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </section>

      <section className="bg-white py-12 border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-xl font-bold text-blue-900 mb-4">
            Romsey Postcodes We Cover
          </h2>
          <div className="flex flex-wrap gap-2">
            {["SO51"].map((pc) => (
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
              <p className="text-gray-600 text-xs mb-3">Hampshire&apos;s largest city, a short drive from Romsey.</p>
              <span className="text-blue-600 text-xs font-semibold">View area →</span>
            </Link>
            <Link
              href="/areas/winchester"
              className="bg-white border border-gray-200 rounded-lg p-5 hover:border-blue-400 hover:shadow-md transition-all block"
            >
              <h3 className="text-sm font-semibold text-blue-900 mb-1">Winchester</h3>
              <p className="text-gray-600 text-xs mb-3">Hampshire&apos;s county town, a short drive northeast of Romsey.</p>
              <span className="text-blue-600 text-xs font-semibold">View area →</span>
            </Link>
            <Link
              href="/areas/totton"
              className="bg-white border border-gray-200 rounded-lg p-5 hover:border-blue-400 hover:shadow-md transition-all block"
            >
              <h3 className="text-sm font-semibold text-blue-900 mb-1">Totton</h3>
              <p className="text-gray-600 text-xs mb-3">New Forest edge town between Romsey and Southampton.</p>
              <span className="text-blue-600 text-xs font-semibold">View area →</span>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
