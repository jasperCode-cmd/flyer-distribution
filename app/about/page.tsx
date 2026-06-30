import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "Flyer Distribution Hampshire is an independent marketing and leaflet distribution company based in Hampshire, co-founded by Jasper and Daniel.",
  alternates: {
    canonical: "https://www.flyerdistributionhampshire.co.uk/about",
  },
  openGraph: {
    title: "About Us",
    description:
      "Flyer Distribution Hampshire is an independent marketing and leaflet distribution company based in Hampshire, co-founded by Jasper and Daniel.",
    url: "https://www.flyerdistributionhampshire.co.uk/about",
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
      "Flyer Distribution Hampshire is an independent marketing and leaflet distribution company based in Hampshire, co-founded by Jasper and Daniel.",
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
            An independent marketing and leaflet distribution company based in
            Hampshire, helping businesses connect with their ideal customers
            through both traditional and digital marketing.
          </p>
        </div>
      </section>

      {/* Intro — two-column with image */}
      <section className="bg-slate-50 pt-16 pb-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          <div>
            <p className="text-gray-600 mb-4 leading-relaxed">
              Flyer Distribution Hampshire is an independent marketing and leaflet
              distribution company based in Hampshire, helping businesses connect
              with their ideal customers through both traditional and digital
              marketing. We work with local businesses, national brands running
              regional campaigns, charities, and community organisations to deliver
              advertising that gets real results.
            </p>
            <p className="text-gray-600 mb-4 leading-relaxed">
              Leaflet distribution remains at the heart of what we do, but our
              services extend beyond door-to-door delivery to include website
              design and SEO, helping businesses build a stronger presence both
              online and offline.
            </p>
            <p className="text-gray-600 leading-relaxed">
              We&apos;re small enough to offer a genuinely personal service, with
              distributors who are fully vetted, trained, and know their routes
              inside out. We cover all major towns and cities across Hampshire and
              into Dorset, including Bournemouth and Poole.
            </p>
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

      {/* Who We Are — full width */}
      <section className="bg-slate-50 pb-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-blue-900 mb-4">
            Who We Are
          </h2>
          <p className="text-gray-600 mb-6 leading-relaxed">
            Flyer Distribution Hampshire was co-founded by Jasper and Daniel,
            who both graduated in 2025, Jasper from the University of
            Southampton and Daniel from Bournemouth University. Together they
            combine modern digital marketing expertise with proven offline
            advertising methods to give businesses a complete marketing solution.
          </p>

          <h3 className="text-lg font-semibold text-blue-900 mb-2">
            Jasper, Co-Founder &amp; Operations Director
          </h3>
          <p className="text-gray-600 mb-6 leading-relaxed">
            Jasper brings extensive expertise in website design and development,
            search engine optimisation (SEO), organic digital marketing, and
            social media growth. His passion for helping businesses improve their
            online visibility ensures clients benefit from marketing strategies
            that continue delivering results long after a campaign has finished.
          </p>

          <h3 className="text-lg font-semibold text-blue-900 mb-2">
            Daniel, Co-Founder &amp; Sales Director
          </h3>
          <p className="text-gray-600 mb-8 leading-relaxed">
            Daniel has a strong background in sales, media, marketing, and
            business development. His experience in building client
            relationships, developing advertising strategies, and growing brands
            through social media enables him to create marketing campaigns that
            are both effective and commercially focused.
          </p>

          <p className="text-gray-600 mb-8 leading-relaxed">
            If you have a campaign in mind, we&apos;d be delighted to discuss
            how Flyer Distribution Hampshire can help your business reach more
            customers and achieve measurable growth.
          </p>

          <Link
            href="/quote"
            className="inline-block bg-blue-700 hover:bg-blue-800 text-white font-bold px-7 py-3.5 rounded-md transition-colors"
          >
            Get a Free Quote
          </Link>
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
