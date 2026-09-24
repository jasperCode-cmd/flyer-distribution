import type { Metadata } from "next";
import Link from "next/link";
import { areas, regions } from "@/lib/areas-data";

export const metadata: Metadata = {
  title: "Hampshire & Dorset Coverage Areas",
  description:
    "Flyer and leaflet distribution across Hampshire and Dorset. View coverage areas including Southampton, Bournemouth, Poole and Winchester.",
  alternates: {
    canonical: "https://www.flyerdistributionhampshire.co.uk/areas",
  },
  openGraph: {
    title: "Hampshire & Dorset Coverage Areas",
    description:
      "Flyer and leaflet distribution across Hampshire and Dorset. View coverage areas including Southampton, Bournemouth, Poole and Winchester.",
    url: "https://www.flyerdistributionhampshire.co.uk/areas",
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
    title: "Hampshire & Dorset Coverage Areas",
    description:
      "Flyer and leaflet distribution across Hampshire and Dorset. View coverage areas including Southampton, Bournemouth, Poole and Winchester.",
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
  ],
};

export default function AreasPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <section className="bg-blue-900 text-white py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">
            Areas We Cover
          </h1>
          <p className="text-blue-200 text-lg max-w-xl">
            We distribute flyers and leaflets across Hampshire and into
            Dorset, covering hundreds of postcodes and thousands of homes as
            part of our full{" "}
            <Link href="/services" className="text-white underline underline-offset-2 hover:text-blue-200">
              leaflet distribution service
            </Link>
            .
          </p>
        </div>
      </section>

      <section className="bg-slate-50 py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {regions.map((region, i) => {
            const regionAreas = areas
              .filter((area) => area.region === region)
              .sort((a, b) => a.name.localeCompare(b.name));
            return (
              <div key={region} className={i < regions.length - 1 ? "mb-16" : ""}>
                <h2 className="text-2xl font-bold text-blue-900 mb-8">
                  {region}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {regionAreas.map((area) => (
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
              </div>
            );
          })}
          <p className="mt-6 text-gray-500 text-sm">
            Don&apos;t see your area listed?{" "}
            <Link href="/quote" className="text-blue-700 hover:underline font-medium">
              Get in touch
            </Link>{" "}
            and we can often accommodate additional postcodes on request.
          </p>
        </div>
      </section>

      <section className="bg-slate-50 py-14 border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-blue-900 mb-3">
            Our Leaflet Distribution Services
          </h2>
          <p className="text-gray-600 mb-8">
            From design and print through to targeted postcode campaigns, we have a service to suit every budget.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { title: "Design, Print and Deliver", href: "/services" },
              { title: "Print and Deliver", href: "/services" },
              { title: "Leaflet Distribution", href: "/services" },
              { title: "Public Notice Leafleting", href: "/services/public-notice-leafleting" },
            ].map((svc) => (
              <Link
                key={svc.title}
                href={svc.href}
                className="bg-white border border-gray-200 rounded-lg p-5 hover:border-blue-400 hover:shadow-md transition-all block"
              >
                <h3 className="text-sm font-semibold text-blue-900 mb-3">{svc.title}</h3>
                <span className="text-blue-600 text-xs font-semibold">View service →</span>
              </Link>
            ))}
          </div>
          <Link
            href="/services"
            className="text-blue-600 hover:text-blue-800 font-semibold text-sm underline underline-offset-2"
          >
            See all services →
          </Link>
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
            className="inline-block bg-blue-700 hover:bg-blue-800 text-white font-bold px-8 py-4 rounded-md transition duration-200 ease-out hover:scale-105"
          >
            Get a Free Quote
          </Link>
        </div>
      </section>
    </>
  );
}
