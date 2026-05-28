import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Flyer Distribution Portsmouth",
  description:
    "Professional leaflet and flyer distribution across Portsmouth. Reach households on Portsea Island and surrounding areas.",
};

export default function PortsmouthPage() {
  return (
    <>
      <section className="bg-blue-900 text-white py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-blue-300 text-sm uppercase tracking-widest mb-2">
            Coverage Area
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">
            Flyer Distribution in Portsmouth
          </h1>
          <p className="text-blue-200 text-lg max-w-xl">
            Door-to-door leaflet delivery across Portsmouth, covering Portsea
            Island and all surrounding residential districts.
          </p>
        </div>
      </section>

      <section className="bg-slate-50 py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          <div>
            <h2 className="text-2xl font-bold text-blue-900 mb-4">
              About Our Portsmouth Coverage
            </h2>
            <p className="text-gray-600 mb-4 leading-relaxed">
              Portsmouth is a densely populated coastal city with strong
              residential areas across Portsea Island including Southsea,
              Fratton, Copnor, and Milton. Our teams cover PO1 through PO6 and
              beyond, ensuring your flyers reach the right homes.
            </p>
            <p className="text-gray-600 mb-4 leading-relaxed">
              The city&apos;s high-density housing makes it an excellent choice
              for targeted campaigns, as your investment goes further when more
              homes are packed into a smaller geographic area.
            </p>
            <p className="text-gray-600 leading-relaxed">
              We deliver for businesses across sectors, from takeaways and
              tradespeople to fitness studios and estate agents.
            </p>
            <div className="mt-8">
              <Link
                href="/quote"
                className="inline-block bg-blue-700 hover:bg-blue-800 text-white font-bold px-7 py-3.5 rounded-md transition-colors"
              >
                Get a Portsmouth Quote
              </Link>
            </div>
          </div>
          <div>
            <Image
              src="https://picsum.photos/seed/portsmouth/700/500"
              alt="Portsmouth harbour and residential area"
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
            Portsmouth Postcodes We Cover
          </h2>
          <div className="flex flex-wrap gap-2">
            {["PO1", "PO2", "PO3", "PO4", "PO5", "PO6", "PO7", "PO8", "PO9"].map((pc) => (
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
