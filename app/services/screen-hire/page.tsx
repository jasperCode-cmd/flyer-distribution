import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Mobile Screen Trailer Hire | Flyer Distribution Hampshire",
  description:
    "Hire our mobile LED screen trailer for events, advertising, movies, or gaming across Hampshire and Dorset. A 7m² screen mounted on a trailer, easy to set up and guaranteed to get you noticed.",
  alternates: {
    canonical: "https://www.flyerdistributionhampshire.co.uk/services/screen-hire",
  },
  openGraph: {
    title: "Mobile Screen Trailer Hire | Flyer Distribution Hampshire",
    description:
      "Hire our mobile LED screen trailer for events, advertising, movies, or gaming across Hampshire and Dorset. A 7m² screen mounted on a trailer, easy to set up and guaranteed to get you noticed.",
    url: "https://www.flyerdistributionhampshire.co.uk/services/screen-hire",
    siteName: "Flyer Distribution Hampshire",
    locale: "en_GB",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Mobile Screen Trailer Hire | Flyer Distribution Hampshire",
    description:
      "Hire our mobile LED screen trailer for events, advertising, movies, or gaming across Hampshire and Dorset. A 7m² screen mounted on a trailer, easy to set up and guaranteed to get you noticed.",
  },
};

const features = [
  {
    title: "Be Seen With a Screen",
    body: "Our mobile screen trailers are customised for different events and proven to get attention. Whether you need outdoor advertising, live event display, or something that simply stops people in their tracks, a mobile screen delivers impact that static advertising cannot match.",
  },
  {
    title: "On the Move",
    body: "The screen arrives mounted on a trailer and can be raised for maximum viewing. Featuring a 7m² screen, it is straightforward to position and operate, making it suitable for a wide range of locations and occasions across Hampshire and Dorset.",
  },
  {
    title: "Fully Qualified Engineers",
    body: "All screen designs and installations are overseen by fully qualified engineers using the latest components. You can hire with confidence knowing the setup is safe, professional, and built to perform.",
  },
];

export default function ScreenHirePage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-blue-900 text-white py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">
            Mobile Screen Trailer Hire
          </h1>
          <p className="text-blue-200 text-lg max-w-xl">
            A powerful, portable LED screen for events, advertising, and
            entertainment across Hampshire and Dorset.
          </p>
        </div>
      </section>

      {/* Trailer image */}
      <section className="bg-slate-50 pt-16">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative h-96 w-full overflow-hidden rounded-lg">
            <Image
              src="/Mobile%20Screen%20Trailer%20Hire%20Enquire.jpg"
              alt="Mobile LED screen trailer ready for hire"
              width={1244}
              height={1600}
              className="object-cover w-full h-full"
              style={{ objectPosition: "center center" }}
            />
          </div>
        </div>
      </section>

      {/* Feature cards */}
      <section className="bg-slate-50 py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {features.map((f) => (
              <div
                key={f.title}
                className="bg-white rounded-lg border border-gray-200 p-6"
              >
                <h2 className="text-base font-semibold text-blue-900 mb-2">
                  {f.title}
                </h2>
                <p className="text-gray-600 text-sm leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-white py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-blue-900 mb-4">
            Interested in Screen Hire?
          </h2>
          <p className="text-gray-600 max-w-lg mx-auto mb-8 leading-relaxed">
            Get in touch for availability, pricing, and to discuss your event or
            campaign. We cover Hampshire and Dorset and are happy to advise on
            the best setup for your needs.
          </p>
          <Link
            href="/quote"
            className="inline-block bg-blue-700 hover:bg-blue-800 text-white font-bold px-10 py-4 rounded-md text-base transition-colors shadow"
          >
            Get a Quote
          </Link>
        </div>
      </section>
    </>
  );
}
