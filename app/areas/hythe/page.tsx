import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Breadcrumb from "@/components/Breadcrumb";

export const metadata: Metadata = {
  title: "Leaflet Distribution Hythe",
  description:
    "Leaflet and flyer distribution across Hythe and SO45 postcodes. Targeted door-to-door delivery across this Waterside village near Southampton.",
  alternates: {
    canonical: "https://www.flyerdistributionhampshire.co.uk/areas/hythe",
  },
  openGraph: {
    title: "Leaflet Distribution Hythe",
    description:
      "Leaflet and flyer distribution across Hythe and SO45 postcodes. Targeted door-to-door delivery across this Waterside village near Southampton.",
    url: "https://www.flyerdistributionhampshire.co.uk/areas/hythe",
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
    title: "Leaflet Distribution Hythe",
    description:
      "Leaflet and flyer distribution across Hythe and SO45 postcodes. Targeted door-to-door delivery across this Waterside village near Southampton.",
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
      name: "Hythe",
      item: "https://www.flyerdistributionhampshire.co.uk/areas/hythe",
    },
  ],
};

export default function HythePage() {
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
              { label: "Hythe" },
            ]}
          />
          <p className="text-blue-300 text-sm uppercase tracking-widest mb-2">
            Coverage Area
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">
            Leaflet Distribution Hythe
          </h1>
          <p className="text-blue-200 text-lg max-w-xl">
            Door-to-door leaflet delivery across Hythe and SO45 postcodes,
            reaching households across this Waterside village.
          </p>
        </div>
      </section>

      <section className="bg-slate-50 py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          <div>
            <h2 className="text-2xl font-bold text-blue-900 mb-4">
              About Our Hythe Coverage
            </h2>
            <p className="text-gray-600 mb-4 leading-relaxed">
              Hythe sits on the Waterside, looking out over Southampton
              Water with a small marina at its heart and a ferry crossing to
              Southampton itself. We cover SO45 and the wider Waterside
              area, delivering door to door through Hythe&apos;s town
              centre, the marina, and the residential roads that spread
              out from the village centre.
            </p>
            <p className="text-gray-600 mb-4 leading-relaxed">
              It&apos;s a close-knit community with a genuine village feel
              despite being minutes from Southampton by boat, and local
              shops, trades and hospitality businesses see real value in
              reaching residents directly through their letterboxes.
              Campaigns here often extend naturally into nearby{" "}
              <Link href="/areas/totton" className="text-blue-700 hover:underline font-medium">
                Totton
              </Link>{" "}
              or across the wider{" "}
              <Link href="/areas/new-forest" className="text-blue-700 hover:underline font-medium">
                New Forest
              </Link>{" "}
              villages.{" "}
              <Link href="/areas/brockenhurst" className="text-blue-700 hover:underline font-medium">
                Brockenhurst
              </Link>{" "}
              is another popular addition for wider New Forest campaigns.
            </p>
            <p className="text-gray-600 leading-relaxed">
              We can also run vehicle campaigns around Hythe&apos;s marina
              and shopping area, part of{" "}
              <Link href="/services" className="text-blue-700 hover:underline font-medium">
                our distribution options
              </Link>{" "}
              putting your materials in front of boat owners and visitors as
              well as residents.
            </p>
            <div className="mt-8">
              <Link
                href="/quote"
                className="inline-block bg-blue-700 hover:bg-blue-800 text-white font-bold px-7 py-3.5 rounded-md transition duration-200 ease-out hover:scale-105"
              >
                Get a Hythe Quote
              </Link>
            </div>
          </div>
          <div className="max-w-sm mx-auto lg:mx-0 aspect-square overflow-hidden rounded-lg shadow-lg ring-1 ring-black/5">
            <Image
              src="/Overhead-shot-residential-areas.webp"
              alt="Overhead view of a residential street with houses and gardens, the kind of area covered door to door"
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
            Hythe Postcodes We Cover
          </h2>
          <div className="flex flex-wrap gap-2">
            {["SO45"].map((pc) => (
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
              href="/areas/new-forest"
              className="bg-white border border-gray-200 rounded-lg p-5 hover:border-blue-400 hover:shadow-md transition-all block"
            >
              <h3 className="text-sm font-semibold text-blue-900 mb-1">New Forest</h3>
              <p className="text-gray-600 text-xs mb-3">Towns and villages across one of Hampshire&apos;s most distinctive districts.</p>
              <span className="text-blue-600 text-xs font-semibold">View area →</span>
            </Link>
            <Link
              href="/areas/southampton"
              className="bg-white border border-gray-200 rounded-lg p-5 hover:border-blue-400 hover:shadow-md transition-all block"
            >
              <h3 className="text-sm font-semibold text-blue-900 mb-1">Southampton</h3>
              <p className="text-gray-600 text-xs mb-3">A short ferry crossing from Hythe across Southampton Water.</p>
              <span className="text-blue-600 text-xs font-semibold">View area →</span>
            </Link>
            <Link
              href="/areas/totton"
              className="bg-white border border-gray-200 rounded-lg p-5 hover:border-blue-400 hover:shadow-md transition-all block"
            >
              <h3 className="text-sm font-semibold text-blue-900 mb-1">Totton</h3>
              <p className="text-gray-600 text-xs mb-3">Neighbouring New Forest edge town on the Waterside.</p>
              <span className="text-blue-600 text-xs font-semibold">View area →</span>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
