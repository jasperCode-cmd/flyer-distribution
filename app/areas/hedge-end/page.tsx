import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Breadcrumb from "@/components/Breadcrumb";

export const metadata: Metadata = {
  title: "Leaflet Distribution Hedge End",
  description:
    "Leaflet and flyer distribution across Hedge End and SO30 postcodes. Targeted door-to-door delivery for this residential town east of Southampton.",
  alternates: {
    canonical: "https://www.flyerdistributionhampshire.co.uk/areas/hedge-end",
  },
  openGraph: {
    title: "Leaflet Distribution Hedge End",
    description:
      "Leaflet and flyer distribution across Hedge End and SO30 postcodes. Targeted door-to-door delivery for this residential town east of Southampton.",
    url: "https://www.flyerdistributionhampshire.co.uk/areas/hedge-end",
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
    title: "Leaflet Distribution Hedge End",
    description:
      "Leaflet and flyer distribution across Hedge End and SO30 postcodes. Targeted door-to-door delivery for this residential town east of Southampton.",
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
      name: "Hedge End",
      item: "https://www.flyerdistributionhampshire.co.uk/areas/hedge-end",
    },
  ],
};

export default function HedgeEndPage() {
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
              { label: "Hedge End" },
            ]}
          />
          <p className="text-blue-300 text-sm uppercase tracking-widest mb-2">
            Coverage Area
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">
            Leaflet Distribution Hedge End
          </h1>
          <p className="text-blue-200 text-lg max-w-xl">
            Door-to-door leaflet delivery across Hedge End and SO30
            postcodes, reaching households across this Hampshire town.
          </p>
        </div>
      </section>

      <section className="bg-slate-50 py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          <div>
            <h2 className="text-2xl font-bold text-blue-900 mb-4">
              About Our Hedge End Coverage
            </h2>
            <p className="text-gray-600 mb-4 leading-relaxed">
              Hedge End sits just east of Southampton, a residential town
              that&apos;s grown up alongside the retail park that now draws
              shoppers from across the area. We cover SO30 and the
              surrounding roads, delivering door to door across Hedge
              End&apos;s housing estates and into the neighbouring
              communities nearby, including{" "}
              <Link href="/areas/chandlers-ford" className="text-blue-700 hover:underline font-medium">
                Chandler&apos;s Ford
              </Link>
              .
            </p>
            <p className="text-gray-600 mb-4 leading-relaxed">
              Most homes here are owner-occupied family houses, built up
              over several decades, which makes for a stable, responsive
              audience for local trades, home improvement, and professional
              services. The retail park itself is well known across the
              wider area, and that footfall makes Hedge End a natural fit
              alongside{" "}
              <Link href="/areas/eastleigh" className="text-blue-700 hover:underline font-medium">
                Eastleigh
              </Link>{" "}
              or{" "}
              <Link href="/areas/southampton" className="text-blue-700 hover:underline font-medium">
                Southampton
              </Link>{" "}
              campaigns too.
            </p>
            <p className="text-gray-600 leading-relaxed">
              Vehicle{" "}
              <Link href="/services" className="text-blue-700 hover:underline font-medium">
                leaflet distribution
              </Link>{" "}
              is available around Hedge End Retail Park and the surrounding
              car parks, useful for reaching shoppers travelling in from
              outside the immediate area.
            </p>
            <div className="mt-8">
              <Link
                href="/quote"
                className="inline-block bg-blue-700 hover:bg-blue-800 text-white font-bold px-7 py-3.5 rounded-md transition duration-200 ease-out hover:scale-105"
              >
                Get a Hedge End Quote
              </Link>
            </div>
          </div>
          <div className="max-w-sm mx-auto lg:mx-0 aspect-square overflow-hidden rounded-lg shadow-lg ring-1 ring-black/5">
            <Image
              src="/Overhead-shot-residential-areas.webp"
              alt="Overhead view of a residential street with houses and gardens, the kind of neighbourhood we cover door to door"
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
            Hedge End Postcodes We Cover
          </h2>
          <div className="flex flex-wrap gap-2">
            {["SO30"].map((pc) => (
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
              <p className="text-gray-600 text-xs mb-3">One of Hampshire&apos;s largest towns, bordering Hedge End.</p>
              <span className="text-blue-600 text-xs font-semibold">View area →</span>
            </Link>
            <Link
              href="/areas/southampton"
              className="bg-white border border-gray-200 rounded-lg p-5 hover:border-blue-400 hover:shadow-md transition-all block"
            >
              <h3 className="text-sm font-semibold text-blue-900 mb-1">Southampton</h3>
              <p className="text-gray-600 text-xs mb-3">Hampshire&apos;s largest city, just west of Hedge End.</p>
              <span className="text-blue-600 text-xs font-semibold">View area →</span>
            </Link>
            <Link
              href="/areas/chandlers-ford"
              className="bg-white border border-gray-200 rounded-lg p-5 hover:border-blue-400 hover:shadow-md transition-all block"
            >
              <h3 className="text-sm font-semibold text-blue-900 mb-1">Chandler&apos;s Ford</h3>
              <p className="text-gray-600 text-xs mb-3">Residential Eastleigh borough community north of Hedge End.</p>
              <span className="text-blue-600 text-xs font-semibold">View area →</span>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
