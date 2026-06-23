import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Flyer Distribution Hampshire | Local Leaflet & Flyer Delivery",
  description:
    "Reliable flyer and leaflet distribution across Hampshire and Dorset. Reach real households in Southampton, Bournemouth, Poole and Winchester.",
  alternates: {
    canonical: "https://flyerdistributionhampshire.co.uk",
  },
  openGraph: {
    title: "Flyer Distribution Hampshire | Local Leaflet & Flyer Delivery",
    description:
      "Reliable flyer and leaflet distribution across Hampshire and Dorset. Reach real households in Southampton, Bournemouth, Poole and Winchester.",
    url: "https://flyerdistributionhampshire.co.uk",
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
    body: "Every round is completed by vetted, experienced distributors. We track every campaign and follow up to make sure your leaflets have been delivered so you can be confident your materials reached the right doors.",
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
];

const localBusinessSchema = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "Flyer Distribution Hampshire",
  "description":
    "Professional flyer and leaflet distribution across Hampshire and Dorset. Reach real households in Southampton, Bournemouth, Poole and Winchester.",
  "url": "https://flyerdistributionhampshire.co.uk",
  "email": "flyerdistributionhampshire@gmail.com",
  "image": "https://flyerdistributionhampshire.co.uk/Flyer%20Distribution%20Logo%20White%20Cropped.png",
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
    "Hythe",
    "Totton",
    "Hedge End",
    "Chandler's Ford",
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
        <Image
          src="https://images.unsplash.com/photo-1464082354059-27db6ce50048?w=1920&q=80"
          alt="Flyer distributor walking through a Hampshire street"
          width={1600}
          height={700}
          className="absolute inset-0 w-full h-full object-cover opacity-20"
          style={{ objectPosition: 'center', transform: 'scale(1.2)' }}
          priority
        />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-28 lg:py-36">
          <div className="max-w-2xl">
            <p className="text-blue-300 text-sm font-semibold uppercase tracking-widest mb-4">
              Hampshire &amp; Dorset
            </p>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6">
              Professional Flyer Distribution in Hampshire and Dorset
            </h1>
            <p className="text-blue-100 text-lg sm:text-xl leading-relaxed mb-8">
              We deliver your leaflets and flyers directly through letterboxes
              across Hampshire and Dorset, helping local businesses reach real
              customers in the right postcodes.
            </p>
            <Link
              href="/quote"
              className="inline-block bg-white text-blue-900 hover:bg-blue-50 font-bold px-8 py-4 rounded-md text-base transition-colors shadow-lg"
            >
              Get a Free Quote
            </Link>
          </div>
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
              Our Services
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
          <div className="flex flex-wrap gap-3 mb-10">
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
          <Link
            href="/areas"
            className="text-blue-300 hover:text-white font-semibold text-sm underline underline-offset-2"
          >
            See all coverage areas →
          </Link>
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
