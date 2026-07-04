import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Testimonials from "@/components/Testimonials";
import StatsBar from "@/components/StatsBar";
import AreaCarousel from "@/components/AreaCarousel";
import TrustCards from "@/components/TrustCards";

export const metadata: Metadata = {
  title: "Flyer Distribution Hampshire | Local Leaflet & Flyer Delivery",
  description:
    "Reliable flyer and leaflet distribution across Hampshire and Dorset. Reach real households in Southampton, Bournemouth, Poole and Winchester.",
  alternates: {
    canonical: "https://www.flyerdistributionhampshire.co.uk",
  },
  openGraph: {
    title: "Flyer Distribution Hampshire | Local Leaflet & Flyer Delivery",
    description:
      "Reliable flyer and leaflet distribution across Hampshire and Dorset. Reach real households in Southampton, Bournemouth, Poole and Winchester.",
    url: "https://www.flyerdistributionhampshire.co.uk",
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
    title: "Flyer Distribution Hampshire | Local Leaflet & Flyer Delivery",
    description:
      "Reliable flyer and leaflet distribution across Hampshire and Dorset. Reach real households in Southampton, Bournemouth, Poole and Winchester.",
    images: [
      "https://images.pexels.com/photos/35110918/pexels-photo-35110918.jpeg?auto=compress&cs=tinysrgb&w=1200",
    ],
  },
};


const services = [
  {
    title: "Design, Print and Deliver",
    desc: "Our full end-to-end service. We handle everything from design and printing in A6, A5, A4 or DL through to full distribution across your chosen areas.",
  },
  {
    title: "Print and Deliver",
    desc: "Already have your design ready? We handle the printing in A6, A5, A4 or DL and deliver your leaflets directly through letterboxes across Hampshire and Dorset.",
  },
  {
    title: "Leaflet Distribution",
    desc: "Door-to-door delivery to households across your chosen areas. Your printed materials posted directly through letterboxes across Hampshire and Dorset.",
  },
  {
    title: "Targeted Postcode Campaigns",
    desc: "We use postcode data to focus your distribution on the areas most likely to respond to your campaign. Rather than blanket coverage, we put your leaflets where your potential customers actually live.",
  },
  {
    title: "Vehicle Leaflet Distribution",
    desc: "Leaflets placed on parked cars in car parks, retail areas, and high-footfall locations across Hampshire and Dorset.",
  },
  {
    title: "Campaign Planning",
    desc: "Not sure where to start? We sit down with you to understand your business, your customers and your goals. Then we build a campaign plan around your budget and timeline.",
  },
];

const areas = [
  { name: "Southampton", href: "/areas/southampton" },
  { name: "Bournemouth", href: "/areas/bournemouth" },
  { name: "Poole", href: "/areas/poole" },
  { name: "Winchester", href: "/areas/winchester" },
  { name: "New Forest", href: "/areas/new-forest" },
  { name: "Ringwood", href: "/areas/ringwood" },
  { name: "Christchurch", href: "/areas/christchurch" },
  { name: "Dorset", href: "/areas/dorset" },
  { name: "Eastleigh", href: "/areas/eastleigh" },
];

const localBusinessSchema = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "@id": "https://www.flyerdistributionhampshire.co.uk/#business",
  "name": "Flyer Distribution Hampshire",
  "description":
    "Professional flyer and leaflet distribution across Hampshire and Dorset. Reach real households in Southampton, Bournemouth, Poole and Winchester.",
  "url": "https://www.flyerdistributionhampshire.co.uk",
  "email": "flyerdistributionhampshire@gmail.com",
  "image": "https://www.flyerdistributionhampshire.co.uk/Flyer%20Distribution%20Logo%20White%20Cropped.png",
  "sameAs": [
    "https://share.google/RVxyPi4TzXAzkt1Am",
  ],
  "areaServed": [
    "Southampton",
    "Bournemouth",
    "Poole",
    "Winchester",
    "Eastleigh",
    "New Forest",
    "Romsey",
    "Ringwood",
    "Christchurch",
    "Dorset",
    "Hythe",
    "Totton",
    "Hedge End",
    "Chandler's Ford",
    "Brockenhurst",
  ],
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
      />
      {/* Hero */}
      <section className="relative bg-blue-900 text-white overflow-hidden">
        {/* Background photo — darkened to stay behind content */}
        <Image
          src="https://images.unsplash.com/photo-1464082354059-27db6ce50048?w=1920&q=80"
          alt=""
          aria-hidden="true"
          width={1920}
          height={800}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ objectPosition: "center" }}
          priority
        />
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-blue-950/80" />
        {/* Content */}
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-10 lg:gap-16 items-center">
            {/* Text — 60% of row width at desktop */}
            <div>
              <p className="text-blue-300 text-sm font-semibold uppercase tracking-widest mb-4">
                Hampshire &amp; Dorset
              </p>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6">
                <span className="text-yellow-400">#1</span> Tracked Flyer Distribution in Hampshire and Dorset
              </h1>
              <p className="text-blue-100 text-lg sm:text-xl leading-relaxed mb-8">
                We deliver and track your leaflets and flyers directly through
                letterboxes across Hampshire and Dorset, helping local businesses
                reach real customers in the right postcodes.
              </p>
              <Link
                href="/quote"
                className="inline-block bg-white text-blue-900 hover:bg-blue-50 font-bold px-8 py-4 rounded-md text-base transition duration-200 ease-out hover:scale-105 shadow-lg"
              >
                Get a Free Quote
              </Link>
            </div>
            {/* Image column — square on mobile, cropped portrait on desktop */}
            <div className="flex justify-center lg:justify-end">
              {/* Mobile: square 1054×1054, hidden at lg+ */}
              <Image
                src="/Leaflet going through door with our branding.png"
                alt="Branded leaflet being delivered through a letterbox"
                width={1054}
                height={1054}
                quality={90}
                sizes="min(100vw, 384px)"
                className="w-full max-w-xs sm:max-w-sm rounded-xl shadow-2xl block lg:hidden"
                priority
              />
              {/* Desktop: cropped portrait 700×1054, shown at lg+ */}
              <Image
                src="/Leaflet going through door with our branding cropped.png"
                alt="Branded leaflet being delivered through a letterbox"
                width={700}
                height={1054}
                quality={90}
                sizes="410px"
                className="w-full rounded-xl shadow-2xl hidden lg:block"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      <AreaCarousel />

      <Testimonials />

      <StatsBar />

      {/* Trust signals */}
      <section className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-blue-900 text-center mb-12">
            Why Choose Us?
          </h2>
          <TrustCards />
        </div>
      </section>

      {/* Services overview */}
      <section className="bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-blue-900 mb-3">
              Leaflet Services
            </h2>
            <p className="text-gray-600 max-w-xl">
              From door-to-door delivery to targeted postcode campaigns, we have a
              service to suit every budget and campaign goal.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {services.map((svc) => (
              <Link
                key={svc.title}
                href="/services"
                className="group relative bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:border-blue-300 hover:scale-[1.02] hover:shadow-lg transition-all duration-300 ease-out block"
              >
                <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-lg bg-blue-200 group-hover:bg-blue-500 transition-colors duration-300" aria-hidden="true" />
                <h3 className="text-base font-semibold text-blue-900 mb-2">
                  {svc.title}
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">{svc.desc}</p>
              </Link>
            ))}
          </div>
          <div className="mt-8">
            <Link
              href="/services"
              className="text-blue-700 hover:text-blue-900 font-semibold text-sm underline underline-offset-2"
            >
              View all services →
            </Link>
          </div>
        </div>
      </section>

      {/* Coverage areas */}
      <section className="bg-blue-900 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">
            Areas We Cover
          </h2>
          <p className="text-blue-200 mb-10 max-w-xl">
            We cover the Hampshire and Dorset corridor, from Winchester in
            the north to Poole in the west, including:
          </p>
          <div className="flex flex-wrap gap-3 mb-8">
            {areas.map((area) => (
              <Link
                key={area.name}
                href={area.href}
                className="bg-blue-800 hover:bg-blue-700 border border-blue-700 text-white text-sm font-medium px-5 py-2.5 rounded-md transition-colors"
              >
                {area.name}
              </Link>
            ))}
          </div>
          <p className="text-blue-400 text-xs font-semibold uppercase tracking-wide mb-3">
            Also covering
          </p>
          <div className="flex flex-wrap gap-2 mb-8">
            {["Brockenhurst", "Romsey", "Hythe", "Totton", "Hedge End", "Chandler's Ford"].map((a) => (
              <span
                key={a}
                className="bg-blue-800 border border-blue-700 text-blue-200 text-sm px-4 py-1.5 rounded-full"
              >
                {a}
              </span>
            ))}
          </div>
          <Link
            href="/areas"
            className="text-blue-300 hover:text-white font-semibold text-sm underline underline-offset-2"
          >
            See all coverage areas →
          </Link>
        </div>
      </section>

      {/* Additional Services */}
      <section className="bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-blue-900 mb-3">
              Additional Services
            </h2>
            <p className="text-gray-600 max-w-xl">
              Beyond leaflet distribution, we offer web design and SEO, and mobile screen trailer hire across Hampshire and Dorset.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Web Design & SEO */}
            <Link
              href="/services/web-design-seo"
              className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:border-blue-300 transition-colors group"
            >
              <div className="relative h-80 w-full">
                <Image
                  src="https://images.pexels.com/photos/3913016/pexels-photo-3913016.jpeg?auto=compress&cs=tinysrgb&w=800"
                  alt="Laptop on a desk representing web design and SEO work"
                  fill
                  sizes="(max-width: 640px) 100vw, 50vw"
                  className="object-cover"
                />
              </div>
              <div className="p-6">
                <h3 className="text-base font-semibold text-blue-900 mb-2 group-hover:text-blue-700 transition-colors">
                  Web Design &amp; SEO
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  We build fast, professional websites and handle search engine optimisation to help your business get found online. From design through to delivery, we manage the process end to end.
                </p>
              </div>
            </Link>

            {/* Mobile Screen Trailer Hire */}
            <Link
              href="/services/screen-hire"
              className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:border-blue-300 transition-colors group"
            >
              <div className="relative h-80 w-full">
                <Image
                  src="/Mobile%20Screen%20Trailer%20Hire.jpg"
                  alt="Mobile LED screen trailer"
                  fill
                  sizes="(max-width: 640px) 100vw, 50vw"
                  className="object-cover"
                  style={{ objectPosition: "center 30%" }}
                />
              </div>
              <div className="p-6">
                <h3 className="text-base font-semibold text-blue-900 mb-2 group-hover:text-blue-700 transition-colors">
                  Mobile Screen Trailer Hire
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Hire our mobile LED screen trailer for events, advertising, movies, or gaming. Mounted on a trailer with a 7m&sup2; screen, it&apos;s easy to set up and guaranteed to get you noticed.
                </p>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-blue-900 mb-4">
            Ready to Reach More Customers?
          </h2>
          <p className="text-gray-600 max-w-lg mx-auto mb-8 leading-relaxed">
            Get in touch today for a free, no-obligation quote. Tell us your
            target area and quantity, and we'll do the rest.
          </p>
          <Link
            href="/quote"
            className="inline-block bg-blue-700 hover:bg-blue-800 text-white font-bold px-10 py-4 rounded-md text-base transition duration-200 ease-out hover:scale-105 shadow"
          >
            Get a Free Quote
          </Link>
        </div>
      </section>
    </>
  );
}
