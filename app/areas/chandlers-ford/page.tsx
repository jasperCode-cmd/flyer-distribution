import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Breadcrumb from "@/components/Breadcrumb";
import PopulationCounter from "@/components/PopulationCounter";
import { areas } from "@/lib/areas-data";

export const metadata: Metadata = {
  title: "Leaflet Distribution Chandler's Ford",
  description:
    "Leaflet and flyer distribution across Chandler's Ford and SO53 postcodes. Targeted door-to-door delivery across this Eastleigh borough community.",
  alternates: {
    canonical: "https://www.flyerdistributionhampshire.co.uk/areas/chandlers-ford",
  },
  openGraph: {
    title: "Leaflet Distribution Chandler's Ford",
    description:
      "Leaflet and flyer distribution across Chandler's Ford and SO53 postcodes. Targeted door-to-door delivery across this Eastleigh borough community.",
    url: "https://www.flyerdistributionhampshire.co.uk/areas/chandlers-ford",
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
    title: "Leaflet Distribution Chandler's Ford",
    description:
      "Leaflet and flyer distribution across Chandler's Ford and SO53 postcodes. Targeted door-to-door delivery across this Eastleigh borough community.",
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
      name: "Chandler's Ford",
      item: "https://www.flyerdistributionhampshire.co.uk/areas/chandlers-ford",
    },
  ],
};

const areaData = areas.find((a) => a.href === "/areas/chandlers-ford")!;

export default function ChandlersFordPage() {
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
              { label: "Chandler's Ford" },
            ]}
          />
          <p className="text-blue-300 text-sm uppercase tracking-widest mb-2">
            Coverage Area
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">
            Leaflet Distribution Chandler&apos;s Ford
          </h1>
          <p className="text-blue-200 text-lg max-w-xl">
            Door-to-door leaflet delivery across Chandler&apos;s Ford and
            SO53 postcodes, reaching households across this residential
            community.
          </p>
        </div>
      </section>

      <section className="bg-slate-50 py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          <div>
            <h2 className="text-2xl font-bold text-blue-900 mb-4">
              About Our Chandler&apos;s Ford Coverage
            </h2>
            <PopulationCounter
              population={areaData.population}
              label={areaData.populationLabel}
              className="mb-4"
            />
            <p className="text-gray-600 mb-4 leading-relaxed">
              Chandler&apos;s Ford is a largely residential part of the
              Eastleigh borough, made up of established neighbourhoods like
              Hiltingbury and Valley Park around the shops at Fryern. We
              cover SO53 and the surrounding roads, delivering door to
              door across its estates and into the smaller pockets of
              housing nearby, including neighbouring{" "}
              <Link href="/areas/hedge-end" className="text-blue-700 hover:underline font-medium">
                Hedge End
              </Link>
              .
            </p>
            <p className="text-gray-600 mb-4 leading-relaxed">
              It&apos;s firmly a commuter area, with residents travelling
              into{" "}
              <Link href="/areas/southampton" className="text-blue-700 hover:underline font-medium">
                Southampton
              </Link>{" "}
              and beyond for work, which makes evenings and weekends the
              times campaigns here tend to land best. Trades, home
              services, and family-focused businesses do particularly well
              reaching this audience directly through their letterboxes,
              often alongside{" "}
              <Link href="/areas/eastleigh" className="text-blue-700 hover:underline font-medium">
                Eastleigh
              </Link>{" "}
              itself.
            </p>
            <p className="text-gray-600 leading-relaxed">
              We can also run vehicle campaigns around the shops at Fryern
              and the wider Chandler&apos;s Ford area, part of{" "}
              <Link href="/services" className="text-blue-700 hover:underline font-medium">
                our service list
              </Link>
              , putting your materials in front of people already out and
              about locally.
            </p>
            <div className="mt-8">
              <Link
                href="/quote"
                className="inline-block bg-blue-700 hover:bg-blue-800 text-white font-bold px-7 py-3.5 rounded-md transition duration-200 ease-out hover:scale-105"
              >
                Get a Chandler&apos;s Ford Quote
              </Link>
            </div>
          </div>
          <div className="max-w-sm mx-auto lg:mx-0 aspect-square overflow-hidden rounded-lg shadow-lg ring-1 ring-black/5">
            <Image
              src="/Overhead-shot-residential-areas.webp"
              alt="Overhead view of a residential street with houses and gardens, typical of the estates we cover"
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
            Chandler&apos;s Ford Postcodes We Cover
          </h2>
          <div className="flex flex-wrap gap-2">
            {["SO53"].map((pc) => (
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
              <p className="text-gray-600 text-xs mb-3">One of Hampshire&apos;s largest towns, bordering Chandler&apos;s Ford.</p>
              <span className="text-blue-600 text-xs font-semibold">View area →</span>
            </Link>
            <Link
              href="/areas/southampton"
              className="bg-white border border-gray-200 rounded-lg p-5 hover:border-blue-400 hover:shadow-md transition-all block"
            >
              <h3 className="text-sm font-semibold text-blue-900 mb-1">Southampton</h3>
              <p className="text-gray-600 text-xs mb-3">Hampshire&apos;s largest city, within easy reach of Chandler&apos;s Ford.</p>
              <span className="text-blue-600 text-xs font-semibold">View area →</span>
            </Link>
            <Link
              href="/areas/hedge-end"
              className="bg-white border border-gray-200 rounded-lg p-5 hover:border-blue-400 hover:shadow-md transition-all block"
            >
              <h3 className="text-sm font-semibold text-blue-900 mb-1">Hedge End</h3>
              <p className="text-gray-600 text-xs mb-3">Residential town on the other side of Eastleigh borough.</p>
              <span className="text-blue-600 text-xs font-semibold">View area →</span>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
