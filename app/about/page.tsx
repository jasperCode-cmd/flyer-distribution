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
              distribution company based in Hampshire. We help local businesses,
              national brands, charities, and community organisations connect with
              their ideal customers through targeted advertising that gets real
              results.
            </p>
            <p className="text-gray-600 mb-4 leading-relaxed">
              Leaflet distribution is at the heart of what we do, with services
              extending to website design and SEO for businesses looking to grow
              their presence online as well as offline.
            </p>
            <p className="text-gray-600 leading-relaxed">
              We&apos;re small enough to offer a genuinely personal service, with
              distributors who are fully vetted, trained, and know their routes
              inside out, covering Hampshire and into Dorset including Bournemouth
              and Poole.
            </p>
          </div>
          <div className="max-w-sm mx-auto lg:mx-0">
            <div className="aspect-square overflow-hidden rounded-lg">
              <Image
                src="/Flyer%20Distribution%20Hampshire.jpg"
                alt="Flyer Distribution Hampshire team"
                width={1200}
                height={1600}
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Who We Are — full width */}
      <section className="bg-slate-50 pb-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-blue-900 mb-4">
            Who We Are
          </h2>

          {/* Intro — standalone above the founder cards */}
          <p className="text-gray-600 mb-10 leading-relaxed">
            Flyer Distribution Hampshire was co-founded by Jasper and Daniel,
            who both graduated in 2025, Jasper from the University of
            Southampton and Daniel from Bournemouth University. Together they
            combine modern digital marketing expertise with proven offline
            advertising methods to give businesses a complete marketing solution.
          </p>

          {/* Founder cards — side by side on desktop */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">

            {/* Jasper */}
            <div className="group relative bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:scale-[1.02] hover:shadow-lg transition-all duration-300 ease-out">
              <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-lg bg-blue-200 group-hover:bg-blue-500 transition-colors duration-300" aria-hidden="true" />
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xl font-bold flex-shrink-0">
                  J
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">Jasper</p>
                  <p className="text-sm font-semibold text-blue-700 mt-0.5">Co-Founder &amp; Operations Director</p>
                </div>
              </div>
              <p className="text-gray-600 text-sm leading-[1.8]">
                Jasper brings extensive expertise in website design and development,
                search engine optimisation (SEO), organic digital marketing, and
                social media growth. His passion for helping businesses improve their
                online visibility ensures clients benefit from marketing strategies
                that continue delivering results long after a campaign has finished.
              </p>
            </div>

            {/* Daniel */}
            <div className="group relative bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:scale-[1.02] hover:shadow-lg transition-all duration-300 ease-out">
              <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-lg bg-blue-200 group-hover:bg-blue-500 transition-colors duration-300" aria-hidden="true" />
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xl font-bold flex-shrink-0">
                  D
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">Daniel</p>
                  <p className="text-sm font-semibold text-blue-700 mt-0.5">Co-Founder &amp; Sales Director</p>
                </div>
              </div>
              <p className="text-gray-600 text-sm leading-[1.8]">
                Daniel has a strong background in sales, media, marketing, and
                business development. His experience in building client
                relationships, developing advertising strategies, and growing brands
                through social media enables him to create marketing campaigns that
                are both effective and commercially focused.
              </p>
            </div>

          </div>

          {/* Closing — centered below both cards */}
          <div className="text-center">
            <p className="text-gray-600 mb-8 leading-relaxed max-w-lg mx-auto">
              If you have a campaign in mind, we&apos;d be delighted to discuss
              how Flyer Distribution Hampshire can help your business reach more
              customers and achieve measurable growth.
            </p>
            <Link
              href="/quote"
              className="inline-block bg-blue-700 hover:bg-blue-800 text-white font-bold px-7 py-3.5 rounded-md transition duration-200 ease-out hover:scale-105"
            >
              Get a Free Quote
            </Link>
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
                className="group relative border border-gray-200 rounded-lg p-6 text-center shadow-sm hover:scale-[1.02] hover:shadow-lg transition-all duration-300 ease-out"
              >
                <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-lg bg-blue-200 group-hover:bg-blue-500 transition-colors duration-300" aria-hidden="true" />
                <h3 className="text-base font-semibold text-blue-900 mb-2">
                  {v.title}
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="bg-slate-50 py-16 border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-blue-900 mb-3">
            Our Services
          </h2>
          <p className="text-gray-600 mb-8">
            From leaflet distribution to web design and mobile screen hire, we offer a range of marketing solutions for local businesses.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                title: "Leaflet Services",
                desc: "Door-to-door distribution, targeted postcode campaigns, design and print.",
                href: "/services",
              },
              {
                title: "Web Design & SEO",
                desc: "Bespoke websites and search engine optimisation for local businesses.",
                href: "/services/web-design-seo",
              },
              {
                title: "Screen Hire",
                desc: "Mobile LED screen trailer hire for events and advertising across Hampshire and Dorset.",
                href: "/services/screen-hire",
              },
            ].map((svc) => (
              <Link
                key={svc.title}
                href={svc.href}
                className="border border-gray-200 rounded-lg p-6 bg-white hover:border-blue-400 hover:shadow-md transition-all block"
              >
                <h3 className="text-base font-semibold text-blue-900 mb-2">
                  {svc.title}
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">{svc.desc}</p>
                <span className="mt-3 inline-block text-blue-600 text-xs font-semibold">
                  View service →
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
