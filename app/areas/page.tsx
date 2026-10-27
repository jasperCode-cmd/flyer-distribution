import type { Metadata } from "next";
import Link from "next/link";
import AreasExplorer from "@/components/AreasExplorer";
import { overviewCards } from "@/lib/areas-overview";

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
      {/* Hero, search, region chips and all 15 cards, every one in the server-rendered HTML */}
      <AreasExplorer cards={overviewCards()} />

      <section className="bg-slate-50 py-14 border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-blue-900 mb-3">
            Our Leaflet Distribution Services
          </h2>
          <p className="text-gray-600 mb-8 text-lg">
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

      {/* 4. Closing band */}
      <section className="bg-blue-900 text-white py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">Planning a campaign across several areas?</h2>
          <p className="text-blue-100 text-lg mb-8">
            We can combine towns in one campaign, with one quote, one plan and one route report.
          </p>
          <Link
            href="/quote?service=leaflet"
            className="inline-block bg-yellow-400 hover:bg-yellow-300 text-blue-900 font-bold px-7 py-3.5 rounded-md transition duration-200 ease-out hover:scale-105 shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-blue-900"
          >
            Get a Free Quote
          </Link>
        </div>
      </section>
    </>
  );
}
