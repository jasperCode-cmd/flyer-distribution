import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Flyer Distribution Ringwood",
  description:
    "Leaflet and flyer distribution across Ringwood and surrounding areas in Hampshire. Targeted delivery to local households.",
  alternates: {
    canonical: "https://www.flyerdistributionhampshire.co.uk/areas/ringwood",
  },
  openGraph: {
    title: "Flyer Distribution Ringwood",
    description:
      "Leaflet and flyer distribution across Ringwood and surrounding areas in Hampshire. Targeted delivery to local households.",
    url: "https://www.flyerdistributionhampshire.co.uk/areas/ringwood",
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
      name: "Ringwood",
      item: "https://www.flyerdistributionhampshire.co.uk/areas/ringwood",
    },
  ],
};

export default function RingwoodPage() {
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
            Leaflet Distribution Ringwood
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
              Ringwood is a busy market town on the edge of the New Forest, well
              positioned between Bournemouth and Salisbury and serving a broad
              mix of residential streets, rural properties, and a strong local
              high street. We cover BH24 and surrounding postcodes, delivering
              directly through letterboxes across the town and into the
              surrounding villages.
            </p>
            <p className="text-gray-600 mb-4 leading-relaxed">
              The town has a loyal local customer base that engages well with
              print marketing, particularly for home services, food and drink,
              and community events. Its rural-residential mix also means a
              single campaign can reach both village households and town centre
              addresses in one round.
            </p>
            <p className="text-gray-600 leading-relaxed">
              Vehicle leaflet distribution is also available across Ringwood&apos;s
              car parks and retail areas for businesses looking to reach people
              already out and spending locally.
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
          </div>
        </div>
      </section>
    </>
  );
}
