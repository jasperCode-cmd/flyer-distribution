import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Flyer Distribution Poole",
  description:
    "Professional leaflet and flyer distribution across Poole, Dorset. Targeted delivery to residential streets around Poole Harbour.",
};

export default function PooléPage() {
  return (
    <>
      <section className="bg-blue-900 text-white py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-blue-300 text-sm uppercase tracking-widest mb-2">
            Coverage Area
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">
            Flyer Distribution in Poole
          </h1>
          <p className="text-blue-200 text-lg max-w-xl">
            Door-to-door leaflet delivery across Poole, covering affluent
            residential areas and harbour-side communities in Dorset.
          </p>
        </div>
      </section>

      <section className="bg-slate-50 py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          <div>
            <h2 className="text-2xl font-bold text-blue-900 mb-4">
              About Our Poole Coverage
            </h2>
            <p className="text-gray-600 mb-4 leading-relaxed">
              Poole is one of the most affluent towns in Dorset, with
              prestigious areas like Sandbanks, Canford Cliffs, and Branksome
              Park attracting high-income households. Our distributors cover
              BH13 through BH17 and surrounding postcodes.
            </p>
            <p className="text-gray-600 mb-4 leading-relaxed">
              For businesses targeting higher-income demographics such as luxury
              services, premium restaurants, and home improvement, Poole offers
              an excellent return on flyer investment.
            </p>
            <p className="text-gray-600 leading-relaxed">
              We also cover Parkstone, Upton, Hamworthy, and the wider
              residential areas around the harbour.
            </p>
            <div className="mt-8">
              <Link
                href="/quote"
                className="inline-block bg-blue-700 hover:bg-blue-800 text-white font-bold px-7 py-3.5 rounded-md transition-colors"
              >
                Get a Poole Quote
              </Link>
            </div>
          </div>
          <div>
            <Image
              src="https://picsum.photos/seed/poole/700/500"
              alt="Poole harbour and waterfront residential area"
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
            Poole Postcodes We Cover
          </h2>
          <div className="flex flex-wrap gap-2">
            {["BH12", "BH13", "BH14", "BH15", "BH16", "BH17", "BH18"].map((pc) => (
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
