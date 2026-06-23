import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Flyer Distribution Ringwood",
  description:
    "Leaflet and flyer distribution across Ringwood and surrounding areas in Hampshire. Targeted delivery to local households.",
  alternates: {
    canonical: "https://flyerdistributionhampshire.co.uk/areas/ringwood",
  },
  openGraph: {
    title: "Flyer Distribution Ringwood",
    description:
      "Leaflet and flyer distribution across Ringwood and surrounding areas in Hampshire. Targeted delivery to local households.",
    url: "https://flyerdistributionhampshire.co.uk/areas/ringwood",
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
    title: "Flyer Distribution Ringwood",
    description:
      "Leaflet and flyer distribution across Ringwood and surrounding areas in Hampshire. Targeted delivery to local households.",
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
      item: "https://flyerdistributionhampshire.co.uk",
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Areas",
      item: "https://flyerdistributionhampshire.co.uk/areas",
    },
    {
      "@type": "ListItem",
      position: 3,
      name: "Ringwood",
      item: "https://flyerdistributionhampshire.co.uk/areas/ringwood",
    },
  ],
};

export default function RingwoodPage() {
  return (
    <>
      <link rel="canonical" href="https://flyerdistributionhampshire.co.uk/areas/ringwood" />
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
            Flyer Distribution in Ringwood
          </h1>
          <p className="text-blue-200 text-lg max-w-xl">
            Professional leaflet delivery across Ringwood and the surrounding
            Hampshire countryside, reaching local households effectively.
          </p>
        </div>
      </section>

      <section className="bg-slate-50 py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          <div>
            <h2 className="text-2xl font-bold text-blue-900 mb-4">
              About Our Ringwood Coverage
            </h2>
            <p className="text-gray-600 mb-4 leading-relaxed">
              Ringwood is a thriving market town on the edge of the New Forest,
              with a strong community feel and a mix of residential areas and
              rural properties. Its position close to the Dorset border makes it
              a natural hub for reaching households across the western edge of
              Hampshire.
            </p>
            <p className="text-gray-600 mb-4 leading-relaxed">
              We cover BH24 and surrounding postcode areas, delivering to
              households across Ringwood town as well as nearby villages including
              St Leonards, Ashley Heath, and Verwood. The area attracts a
              stable, established resident base that responds well to local
              marketing.
            </p>
            <p className="text-gray-600 leading-relaxed">
              Ringwood works particularly well for home services, tradespeople,
              and businesses looking to build a local presence across the
              Hampshire and Dorset border area.
            </p>
            <div className="mt-8">
              <Link
                href="/quote"
                className="inline-block bg-blue-700 hover:bg-blue-800 text-white font-bold px-7 py-3.5 rounded-md transition-colors"
              >
                Get a Ringwood Quote
              </Link>
            </div>
          </div>
          <div>
            <Image
              src="https://images.pexels.com/photos/5784675/pexels-photo-5784675.jpeg?auto=compress&cs=tinysrgb&w=800"
              alt="Green fields near Ringwood"
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
            Ringwood Postcodes We Cover
          </h2>
          <div className="flex flex-wrap gap-2">
            {["BH24", "BH21", "BH31"].map((pc) => (
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
    </>
  );
}
