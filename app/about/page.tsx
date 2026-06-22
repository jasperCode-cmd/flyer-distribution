import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "Learn about Flyer Distribution Hampshire, a local team dedicated to reliable, targeted leaflet delivery across Hampshire and Dorset.",
  openGraph: {
    title: "About Us",
    description:
      "Learn about Flyer Distribution Hampshire, a local team dedicated to reliable, targeted leaflet delivery across Hampshire and Dorset.",
    url: "https://flyerdistributionhampshire.co.uk/about",
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
    title: "About Us",
    description:
      "Learn about Flyer Distribution Hampshire, a local team dedicated to reliable, targeted leaflet delivery across Hampshire and Dorset.",
    images: [
      "https://images.pexels.com/photos/35110918/pexels-photo-35110918.jpeg?auto=compress&cs=tinysrgb&w=1200",
    ],
  },
};

export default function AboutPage() {
  return (
    <>
      <section className="bg-blue-900 text-white py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">About Us</h1>
          <p className="text-blue-200 text-lg max-w-xl">
            We&apos;re a local Hampshire business built on reliability, local
            knowledge, and a genuine commitment to helping businesses grow.
          </p>
        </div>
      </section>

      <section className="bg-slate-50 py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          <div>
            <h2 className="text-2xl font-bold text-blue-900 mb-4">
              Who We Are
            </h2>
            <p className="text-gray-600 mb-4 leading-relaxed">
              Flyer Distribution Hampshire is an independent leaflet delivery
              business based in Hampshire, UK. We work with local businesses,
              national brands with local campaigns, charities, and community
              organisations to get printed materials into the right letterboxes.
            </p>
            <p className="text-gray-600 mb-4 leading-relaxed">
              Unlike large national operators, we&apos;re small enough to care
              about every campaign and experienced enough to deliver it properly.
              Our distributors are vetted, trained, and know their routes inside
              out.
            </p>
            <p className="text-gray-600 leading-relaxed">
              We cover all major towns across Hampshire and extend into Dorset,
              including Bournemouth and Poole. If you have a campaign in mind,
              we&apos;d love to hear from you.
            </p>
            <div className="mt-8">
              <Link
                href="/quote"
                className="inline-block bg-blue-700 hover:bg-blue-800 text-white font-bold px-7 py-3.5 rounded-md transition-colors"
              >
                Get a Free Quote
              </Link>
            </div>
          </div>
          <div>
            <Image
              src="https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800&q=80"
              alt="Flyer distribution team member on a Hampshire street"
              width={700}
              height={500}
              className="rounded-lg w-full object-cover"
            />
          </div>
        </div>
      </section>

      <section className="bg-white py-16 border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-blue-900 mb-8 text-center">
            Our Values
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                title: "Reliability",
                body: "We are a small team and our reputation depends on every round being completed. When we take on a campaign, it gets delivered.",
              },
              {
                title: "Local Knowledge",
                body: "We know Hampshire's areas, postcodes, and communities, and that local knowledge makes a real difference.",
              },
              {
                title: "Transparency",
                body: "No hidden costs, no vague timelines. We give you a clear quote, keep you updated throughout and let you know when your campaign is complete. Simple, honest communication from start to finish.",
              },
            ].map((v) => (
              <div
                key={v.title}
                className="border border-gray-200 rounded-lg p-6 text-center"
              >
                <h3 className="text-base font-semibold text-blue-900 mb-2">
                  {v.title}
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
