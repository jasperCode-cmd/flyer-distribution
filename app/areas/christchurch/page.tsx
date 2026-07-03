import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Leaflet Distribution Christchurch",
  description:
    "Leaflet and flyer distribution across Christchurch and BH23 postcodes. Targeted door-to-door delivery in this coastal Dorset market town.",
  alternates: {
    canonical: "https://www.flyerdistributionhampshire.co.uk/areas/christchurch",
  },
  openGraph: {
    title: "Leaflet Distribution Christchurch",
    description:
      "Leaflet and flyer distribution across Christchurch and BH23 postcodes. Targeted door-to-door delivery in this coastal Dorset market town.",
    url: "https://www.flyerdistributionhampshire.co.uk/areas/christchurch",
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
    title: "Leaflet Distribution Christchurch",
    description:
      "Leaflet and flyer distribution across Christchurch and BH23 postcodes. Targeted door-to-door delivery in this coastal Dorset market town.",
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
      name: "Christchurch",
      item: "https://www.flyerdistributionhampshire.co.uk/areas/christchurch",
    },
  ],
};

export default function ChristchurchPage() {
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
            Leaflet Distribution Christchurch
          </h1>
          <p className="text-blue-200 text-lg max-w-xl">
            Door-to-door leaflet delivery across Christchurch and BH23
            postcodes, reaching households in this coastal Dorset market town.
          </p>
        </div>
      </section>

      <section className="bg-slate-50 py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          <div>
            <h2 className="text-2xl font-bold text-blue-900 mb-4">
              About Our Christchurch Coverage
            </h2>
            <p className="text-gray-600 mb-4 leading-relaxed">
              Christchurch is a historic market town on the Dorset coast, sitting
              at the mouth of the rivers Avon and Stour. Known for its priory,
              harbour, and the beaches at Mudeford, it has a settled residential
              community and a loyal local audience that responds well to targeted
              print marketing.
            </p>
            <p className="text-gray-600 mb-4 leading-relaxed">
              We cover BH23 and surrounding postcode areas, delivering to
              households across Christchurch town centre, Highcliffe, Burton, and
              the surrounding villages. The area is particularly well suited to
              local services, home improvements, and hospitality businesses.
            </p>
            <p className="text-gray-600 leading-relaxed">
              Christchurch sits between Bournemouth and the New Forest, making it
              an effective addition to wider Dorset or Hampshire campaigns for
              businesses seeking broad coastal coverage.
            </p>
            <div className="mt-8">
              <Link
                href="/quote"
                className="inline-block bg-blue-700 hover:bg-blue-800 text-white font-bold px-7 py-3.5 rounded-md transition-colors"
              >
                Get a Christchurch Quote
              </Link>
            </div>
          </div>
          <div className="relative h-80 w-full overflow-hidden rounded-lg">
            <Image
              src="https://images.pexels.com/photos/1796730/pexels-photo-1796730.jpeg?auto=compress&cs=tinysrgb&w=800"
              alt="Christchurch harbour and waterfront"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
        </div>
      </section>

      <section className="bg-white py-12 border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-xl font-bold text-blue-900 mb-4">
            Christchurch Postcodes We Cover
          </h2>
          <div className="flex flex-wrap gap-2">
            {["BH23"].map((pc) => (
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
