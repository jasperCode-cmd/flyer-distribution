import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Flyer Distribution Winchester",
  description:
    "Leaflet and flyer distribution across Winchester, Hampshire. Professional door-to-door delivery in the county town and surrounding villages.",
};

export default function WinchesterPage() {
  return (
    <>
      <section className="bg-blue-900 text-white py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-blue-300 text-sm uppercase tracking-widest mb-2">
            Coverage Area
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">
            Flyer Distribution in Winchester
          </h1>
          <p className="text-blue-200 text-lg max-w-xl">
            Professional leaflet delivery across Winchester city and surrounding
            Hampshire villages, reaching the affluent households of the county
            town.
          </p>
        </div>
      </section>

      <section className="bg-slate-50 py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          <div>
            <h2 className="text-2xl font-bold text-blue-900 mb-4">
              About Our Winchester Coverage
            </h2>
            <p className="text-gray-600 mb-4 leading-relaxed">
              Winchester is Hampshire&apos;s historic county town, consistently
              ranked among the best places to live in the UK. With high average
              household incomes and a thriving independent business scene,
              leaflet distribution here reaches an engaged, local audience.
            </p>
            <p className="text-gray-600 mb-4 leading-relaxed">
              We cover SO21, SO22, SO23, and surrounding postcode areas
              including the city centre, St Cross, Badger Farm, Harestock, and
              the outlying villages such as Colden Common and Bishopstoke.
            </p>
            <p className="text-gray-600 leading-relaxed">
              Winchester is particularly effective for premium services such as
              home improvements, fine dining, private schools, and professional
              services.
            </p>
            <div className="mt-8">
              <Link
                href="/quote"
                className="inline-block bg-blue-700 hover:bg-blue-800 text-white font-bold px-7 py-3.5 rounded-md transition-colors"
              >
                Get a Winchester Quote
              </Link>
            </div>
          </div>
          <div>
            <Image
              src="https://images.unsplash.com/photo-1467803738586-46b7eb7b16a1?w=800&q=80"
              alt="Winchester cathedral and city centre"
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
            Winchester Postcodes We Cover
          </h2>
          <div className="flex flex-wrap gap-2">
            {["SO21", "SO22", "SO23", "SO24", "SO32"].map((pc) => (
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
