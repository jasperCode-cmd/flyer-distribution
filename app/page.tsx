import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Testimonials from "@/components/Testimonials";

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

const trustSignals = [
  {
    icon: "🏘️",
    title: "Local Team",
    body: "We're based in Hampshire and Dorset and know every postcode. No national middlemen, just local people who care about your campaign.",
  },
  {
    icon: "🎯",
    title: "Targeted Postcodes",
    body: "Tell us your target areas and we will plan a campaign that puts your leaflets in front of the right people. We work with you to focus your distribution where it counts.",
  },
  {
    icon: "✅",
    title: "Tracked and Assured Delivery",
    body: "Every round is completed by vetted, experienced distributors who confirm completion, so you can be confident your materials reached the right doors.",
  },
];

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
                className="inline-block bg-white text-blue-900 hover:bg-blue-50 font-bold px-8 py-4 rounded-md text-base transition-colors shadow-lg"
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

      <Testimonials />

      {/* Stats bar */}
      <section className="bg-blue-900 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-6 items-start">

            {/* 92% — filled/duotone eye */}
            <div className="flex flex-col items-center text-center">
              <div className="h-14 flex items-end justify-center mb-5" aria-hidden="true">
                <svg className="w-14 h-14 text-blue-300 block" viewBox="0 0 24 24" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M12 5C6.5 5 2.36 8.51.46 11.32a1.5 1.5 0 000 1.36C2.36 15.49 6.5 19 12 19s9.64-3.51 11.54-6.32a1.5 1.5 0 000-1.36C21.64 8.51 17.5 5 12 5zm0 11.5a4.5 4.5 0 110-9 4.5 4.5 0 010 9z"
                    opacity="0.45"
                  />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </div>
              <p className="text-5xl sm:text-6xl font-bold mb-3 leading-none">92%</p>
              <p className="text-blue-200 text-sm leading-relaxed max-w-[13rem]">
                of people who receive a door drop read it
              </p>
            </div>

            {/* 74% — filled location pin */}
            <div className="flex flex-col items-center text-center">
              <div className="h-14 flex items-end justify-center mb-5" aria-hidden="true">
                <svg className="w-14 h-14 text-blue-300 block" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z" />
                </svg>
              </div>
              <p className="text-5xl sm:text-6xl font-bold mb-3 leading-none">74%</p>
              <p className="text-blue-200 text-sm leading-relaxed max-w-[13rem]">
                of door drops are opened, read, filed or set aside for later
              </p>
            </div>

            {/* 4/5 — 4 filled + 1 outline person */}
            <div className="flex flex-col items-center text-center">
              <div className="h-14 flex items-end justify-center gap-1 mb-5" aria-hidden="true">
                {[0, 1, 2, 3, 4].map((i) =>
                  i < 4 ? (
                    <svg key={i} className="w-9 h-9 text-white block" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" />
                    </svg>
                  ) : (
                    <svg key={i} className="w-9 h-9 text-blue-400 block" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                    </svg>
                  )
                )}
              </div>
              <p className="text-5xl sm:text-6xl font-bold mb-3 leading-none">4/5</p>
              <p className="text-blue-200 text-sm leading-relaxed max-w-[13rem]">
                of door drop items are engaged with
              </p>
            </div>

          </div>
          <p className="text-center text-blue-300 text-xs mt-6">
            Source: Royal Mail
          </p>
        </div>
      </section>

      {/* Trust signals */}
      <section className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-blue-900 text-center mb-12">
            Why Choose Us?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {trustSignals.map((item) => (
              <div
                key={item.title}
                className="text-center p-6 rounded-lg bg-blue-50 border border-blue-100"
              >
                <div className="text-4xl mb-4">{item.icon}</div>
                <h3 className="text-lg font-semibold text-blue-900 mb-2">
                  {item.title}
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
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
              <div
                key={svc.title}
                className="bg-white rounded-lg border border-gray-200 p-6 hover:border-blue-300 transition-colors"
              >
                <h3 className="text-base font-semibold text-blue-900 mb-2">
                  {svc.title}
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">{svc.desc}</p>
              </div>
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
            className="inline-block bg-blue-700 hover:bg-blue-800 text-white font-bold px-10 py-4 rounded-md text-base transition-colors shadow"
          >
            Get a Free Quote
          </Link>
        </div>
      </section>
    </>
  );
}
