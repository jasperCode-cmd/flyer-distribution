import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Flyer Distribution Bournemouth",
  description:
    "Leaflet and flyer distribution across Bournemouth. Targeted door-to-door delivery for local businesses in Dorset.",
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
      name: "Bournemouth",
      item: "https://flyerdistributionhampshire.co.uk/areas/bournemouth",
    },
  ],
};

export default function BournemouthPage() {
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
            Flyer Distribution in Bournemouth
          </h1>
          <p className="text-blue-200 text-lg max-w-xl">
            Reach residents and visitors across Bournemouth with professional
            door-to-door leaflet distribution.
          </p>
        </div>
      </section>

      <section className="bg-slate-50 py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          <div>
            <h2 className="text-2xl font-bold text-blue-900 mb-4">
              About Our Bournemouth Coverage
            </h2>
            <p className="text-gray-600 mb-4 leading-relaxed">
              Bournemouth is one of Dorset&apos;s largest towns, known for its
              beaches, vibrant town centre, and large student population.
              We cover BH1 through BH12 and surrounding postcodes, reaching
              residential areas across all neighbourhoods.
            </p>
            <p className="text-gray-600 mb-4 leading-relaxed">
              Whether you need to reach the Westbourne boutique area,
              Boscombe, Winton, or the leafy suburbs, our experienced
              distributors know these routes well.
            </p>
            <p className="text-gray-600 leading-relaxed">
              Bournemouth&apos;s busy retail areas and car parks also make it
              well suited to vehicle leaflet distribution campaigns.
            </p>
            <div className="mt-8">
              <Link
                href="/quote"
                className="inline-block bg-blue-700 hover:bg-blue-800 text-white font-bold px-7 py-3.5 rounded-md transition-colors"
              >
                Get a Bournemouth Quote
              </Link>
            </div>
          </div>
          <div>
            <Image
              src="https://images.pexels.com/photos/29030837/pexels-photo-29030837.jpeg?auto=compress&cs=tinysrgb&w=800"
              alt="Bournemouth pier and ferris wheel"
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
            Bournemouth Postcodes We Cover
          </h2>
          <div className="flex flex-wrap gap-2">
            {["BH1", "BH2", "BH3", "BH4", "BH5", "BH6", "BH7", "BH8", "BH9", "BH10", "BH11", "BH12"].map(
              (pc) => (
                <span
                  key={pc}
                  className="bg-blue-50 border border-blue-200 text-blue-800 text-sm px-4 py-1.5 rounded-full font-medium"
                >
                  {pc}
                </span>
              )
            )}
          </div>
        </div>
      </section>
    </>
  );
}
