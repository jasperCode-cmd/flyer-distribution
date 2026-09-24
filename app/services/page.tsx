import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import StaggerGroup from "@/components/StaggerGroup";
import AdditionalServiceCard from "@/components/AdditionalServiceCard";
import BrowserMockup from "@/components/BrowserMockup";

export const metadata: Metadata = {
  title: "Leaflet Services",
  description:
    "Full design, print and leaflet distribution services across Hampshire and Dorset. Choose our end-to-end package or distribution-only service.",
  alternates: {
    canonical: "https://www.flyerdistributionhampshire.co.uk/services",
  },
  openGraph: {
    title: "Leaflet Services | Flyer Distribution Hampshire",
    description:
      "Full design, print and leaflet distribution services across Hampshire and Dorset. Choose our end-to-end package or distribution-only service.",
    url: "https://www.flyerdistributionhampshire.co.uk/services",
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
    title: "Leaflet Services | Flyer Distribution Hampshire",
    description:
      "Full design, print and leaflet distribution services across Hampshire and Dorset. Choose our end-to-end package or distribution-only service.",
    images: [
      "https://images.pexels.com/photos/35110918/pexels-photo-35110918.jpeg?auto=compress&cs=tinysrgb&w=1200",
    ],
  },
};

const packages = [
  {
    title: "Design, Print and Deliver",
    badge: "Most Popular",
    desc: "Our full end-to-end service. We work with you from the initial design right through to delivery. Bring us your idea and we handle everything including design, printing in A6, A5, A4 or DL, and full distribution across your chosen areas in Hampshire and Dorset.",
    image: "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800&q=80",
    alt: "Designer working on creative artwork at a desk",
  },
  {
    title: "Print and Deliver",
    badge: null,
    desc: "Already have your design ready? We handle the printing in A6, A5, A4 or DL and deliver your leaflets directly through letterboxes across Hampshire and Dorset.",
    image: "https://images.pexels.com/photos/19843566/pexels-photo-19843566.jpeg?auto=compress&cs=tinysrgb&w=800",
    alt: "Printed leaflets ready for delivery",
  },
];

const supportingServices = [
  {
    title: "Leaflet Distribution",
    desc: "Standard door-to-door leaflet delivery to households across your chosen areas in Hampshire and Dorset. We handle the rounds so your printed materials land directly through letterboxes.",
    image: "https://images.pexels.com/photos/35110918/pexels-photo-35110918.jpeg?auto=compress&cs=tinysrgb&w=800",
    alt: "Leaflets being delivered through a letterbox",
  },
  {
    title: "Targeted Postcode Campaigns",
    desc: "We use postcode data to focus your distribution on the areas most likely to respond to your campaign. Rather than blanket coverage, we put your leaflets where your potential customers actually live.",
    image: "https://images.pexels.com/photos/17144737/pexels-photo-17144737.jpeg?auto=compress&cs=tinysrgb&w=800",
    alt: "Residential area targeted for leaflet distribution in Hampshire",
  },
  {
    title: "Campaign Planning",
    desc: "Not sure where to start? We sit down with you to understand your business, your customers and your goals. Then we build a campaign plan around your budget and timeline.",
    image: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&q=80",
    alt: "Person reviewing campaign planning notes at a desk",
  },
  {
    title: "Vehicle Leaflet Distribution",
    desc: "Place leaflets on parked cars in car parks, retail areas, and high-footfall locations across Hampshire and Dorset. An effective way to reach people already out and spending locally.",
    image: "https://images.unsplash.com/photo-1506521781263-d8422e82f27a?w=800&q=80",
    alt: "Parked cars in a car park where leaflets can be distributed",
  },
  {
    title: "Public Notice Leafleting",
    desc: "Statutory door-to-door distribution supporting Section 47 and Section 48 Planning Act 2008 consultation requirements for Nationally Significant Infrastructure Projects across Hampshire.",
    image: "https://images.pexels.com/photos/17144737/pexels-photo-17144737.jpeg?auto=compress&cs=tinysrgb&w=800",
    alt: "Residential street where public notice leaflets are distributed",
    href: "/services/public-notice-leafleting",
  },
  {
    title: "Hand-to-Hand Leaflet Distribution",
    desc: "Direct, face-to-face handouts at shopping centres, town centres and events, putting your leaflets straight into people's hands for immediate exposure.",
    image: "https://images.pexels.com/photos/19843566/pexels-photo-19843566.jpeg?auto=compress&cs=tinysrgb&w=800",
    alt: "A stack of printed leaflets ready for hand-to-hand distribution",
    href: "/services/hand-to-hand-distribution",
  },
  {
    title: "B2B Leaflet Distribution",
    desc: "Direct marketing to business owners and decision-makers at offices, business parks and commercial areas across Hampshire and Dorset.",
    image: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&q=80",
    alt: "Business professional working at a desk in an office setting",
    href: "/services/b2b-distribution",
  },
];

const servicesSchema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Service",
      "name": "Design, Print and Deliver",
      "description":
        "Our full end-to-end service. We work with you from the initial design right through to delivery. Bring us your idea and we handle everything including design, printing in A6, A5, A4 or DL, and full distribution across your chosen areas in Hampshire and Dorset.",
      "provider": {
        "@type": "LocalBusiness",
        "name": "Flyer Distribution Hampshire",
        "url": "https://www.flyerdistributionhampshire.co.uk",
      },
      "areaServed": "Hampshire and Dorset",
    },
    {
      "@type": "Service",
      "name": "Print and Deliver",
      "description":
        "Already have your design ready? We handle the printing in A6, A5, A4 or DL and deliver your leaflets directly through letterboxes across Hampshire and Dorset.",
      "provider": {
        "@type": "LocalBusiness",
        "name": "Flyer Distribution Hampshire",
        "url": "https://www.flyerdistributionhampshire.co.uk",
      },
      "areaServed": "Hampshire and Dorset",
    },
    {
      "@type": "Service",
      "name": "Leaflet Distribution",
      "description":
        "Standard door-to-door leaflet delivery to households across your chosen areas in Hampshire and Dorset. We handle the rounds so your printed materials land directly through letterboxes.",
      "provider": {
        "@type": "LocalBusiness",
        "name": "Flyer Distribution Hampshire",
        "url": "https://www.flyerdistributionhampshire.co.uk",
      },
      "areaServed": "Hampshire and Dorset",
    },
    {
      "@type": "Service",
      "name": "Targeted Postcode Campaigns",
      "description":
        "We use postcode data to focus your distribution on the areas most likely to respond to your campaign. Rather than blanket coverage, we put your leaflets where your potential customers actually live.",
      "provider": {
        "@type": "LocalBusiness",
        "name": "Flyer Distribution Hampshire",
        "url": "https://www.flyerdistributionhampshire.co.uk",
      },
      "areaServed": "Hampshire and Dorset",
    },
    {
      "@type": "Service",
      "name": "Vehicle Leaflet Distribution",
      "description":
        "Place leaflets on parked cars in car parks, retail areas, and high-footfall locations across Hampshire and Dorset. An effective way to reach people already out and spending locally.",
      "provider": {
        "@type": "LocalBusiness",
        "name": "Flyer Distribution Hampshire",
        "url": "https://www.flyerdistributionhampshire.co.uk",
      },
      "areaServed": "Hampshire and Dorset",
    },
    {
      "@type": "Service",
      "name": "Campaign Planning",
      "description":
        "Not sure where to start? We sit down with you to understand your business, your customers and your goals. Then we build a campaign plan around your budget and timeline.",
      "provider": {
        "@type": "LocalBusiness",
        "name": "Flyer Distribution Hampshire",
        "url": "https://www.flyerdistributionhampshire.co.uk",
      },
      "areaServed": "Hampshire and Dorset",
    },
    {
      "@type": "Service",
      "name": "Public Notice Leafleting",
      "description":
        "Statutory door-to-door distribution supporting Section 47 and Section 48 Planning Act 2008 consultation requirements for Nationally Significant Infrastructure Projects across Hampshire.",
      "provider": {
        "@type": "LocalBusiness",
        "name": "Flyer Distribution Hampshire",
        "url": "https://www.flyerdistributionhampshire.co.uk",
      },
      "areaServed": "Hampshire",
    },
    {
      "@type": "Service",
      "name": "Hand-to-Hand Leaflet Distribution",
      "description":
        "Direct, face-to-face handouts at shopping centres, town centres and events, putting your leaflets straight into people's hands for immediate exposure.",
      "provider": {
        "@type": "LocalBusiness",
        "name": "Flyer Distribution Hampshire",
        "url": "https://www.flyerdistributionhampshire.co.uk",
      },
      "areaServed": "Hampshire and Dorset",
    },
    {
      "@type": "Service",
      "name": "B2B Leaflet Distribution",
      "description":
        "Direct marketing to business owners and decision-makers at offices, business parks and commercial areas across Hampshire and Dorset.",
      "provider": {
        "@type": "LocalBusiness",
        "name": "Flyer Distribution Hampshire",
        "url": "https://www.flyerdistributionhampshire.co.uk",
      },
      "areaServed": "Hampshire and Dorset",
    },
  ],
};

export default function ServicesPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(servicesSchema) }}
      />
      {/* Page header */}
      <section className="bg-blue-900 text-white py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">Leaflet Services</h1>
          <p className="text-blue-200 max-w-xl text-lg">
            Flexible flyer and leaflet distribution solutions for businesses of
            all sizes across Hampshire and Dorset.
          </p>
        </div>
      </section>

      {/* Featured Packages */}
      <section className="bg-white py-16 border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-500 mb-2">
            Our Packages
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold text-blue-900 mb-10">
            Full Print and Distribution Packages
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {packages.map((pkg) => (
              <div
                key={pkg.title}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:border-blue-300 hover:shadow-lg transition-all"
              >
                <div className="relative">
                  <Image
                    src={pkg.image}
                    alt={pkg.alt}
                    width={700}
                    height={420}
                    className="w-full h-56 object-cover"
                  />
                  {pkg.badge && (
                    <span className="absolute top-3 left-3 bg-blue-700 text-white text-xs font-semibold px-3 py-1 rounded-full">
                      {pkg.badge}
                    </span>
                  )}
                </div>
                <div className="p-6">
                  <h2 className="text-lg font-bold text-blue-900 mb-3">
                    {pkg.title}
                  </h2>
                  <p className="text-gray-600 text-sm leading-relaxed mb-5">
                    {pkg.desc}
                  </p>
                  <Link
                    href="/quote"
                    className="inline-block bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold px-5 py-2.5 rounded-md transition duration-200 ease-out hover:scale-105"
                  >
                    Get a Quote
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Supporting services */}
      <section className="bg-slate-50 py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-500 mb-2">
            Our Services
          </p>
          <h2 className="text-2xl font-bold text-blue-900 mb-8">
            Distribution Services
          </h2>
          <p className="text-gray-600 mb-8 max-w-2xl">
            Growing online too? We also build{" "}
            <Link href="/services/web-design-seo" className="text-blue-700 hover:underline font-medium">
              fast, SEO-friendly websites
            </Link>{" "}
            for local businesses.
          </p>
          <StaggerGroup
            className="flex flex-wrap justify-center gap-6"
            itemClassName="w-full md:w-[calc(50%-0.75rem)]"
          >
            {supportingServices.map((svc) => {
              const cardClass =
                "group bg-white rounded-lg border border-gray-200 overflow-hidden hover:border-blue-300 hover:shadow-md transition-all block h-full";
              const content = (
                <>
                  <Image
                    src={svc.image}
                    alt={svc.alt}
                    width={600}
                    height={300}
                    className="w-full h-44 object-cover"
                  />
                  <div className="p-5">
                    <h3 className="text-base font-semibold text-blue-900 mb-2 group-hover:text-blue-700 transition-colors">
                      {svc.title}
                    </h3>
                    <p className="text-gray-600 text-sm leading-relaxed">{svc.desc}</p>
                    {svc.href && (
                      <span className="mt-3 inline-block text-blue-600 text-xs font-semibold">
                        Learn more →
                      </span>
                    )}
                  </div>
                </>
              );
              return svc.href ? (
                <Link key={svc.title} href={svc.href} className={cardClass}>
                  {content}
                </Link>
              ) : (
                <div key={svc.title} className={cardClass}>
                  {content}
                </div>
              );
            })}
          </StaggerGroup>
        </div>
      </section>

      {/* Areas We Cover */}
      <section className="bg-blue-900 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">
            Areas We Cover
          </h2>
          <p className="text-blue-200 mb-10 max-w-xl">
            We cover the Hampshire and Dorset corridor, from Winchester in
            the north to Poole in the west, and everywhere in between. See
            our full{" "}
            <Link href="/areas" className="text-white underline underline-offset-2 hover:text-blue-200">
              coverage areas
            </Link>{" "}
            for the complete list, including:
          </p>
          <div className="flex flex-wrap gap-3 mb-8">
            {[
              { name: "Southampton", href: "/areas/southampton" },
              { name: "Bournemouth", href: "/areas/bournemouth" },
              { name: "Poole", href: "/areas/poole" },
              { name: "Winchester", href: "/areas/winchester" },
              { name: "New Forest", href: "/areas/new-forest" },
              { name: "Ringwood", href: "/areas/ringwood" },
              { name: "Christchurch", href: "/areas/christchurch" },
              { name: "Dorset", href: "/areas/dorset" },
              { name: "Eastleigh", href: "/areas/eastleigh" },
            ].map((area) => (
              <Link
                key={area.name}
                href={area.href}
                className="bg-blue-800 hover:bg-blue-700 border border-blue-700 text-white text-sm font-medium px-5 py-2.5 rounded-md transition duration-200 ease-out hover:scale-105"
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

      {/* CTA */}
      <section className="bg-white py-16 border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold text-blue-900 mb-4">
            Not Sure Which Service Is Right for You?
          </h2>
          <p className="text-gray-600 mb-8 max-w-md mx-auto">
            Get in touch and we&apos;ll recommend the most effective
            distribution strategy for your business and budget. Curious what
            a completed round looks like? Take a look at our{" "}
            <Link href="/case-studies" className="text-blue-700 hover:underline font-medium">
              case studies
            </Link>
            . Or check our{" "}
            <Link href="/faq" className="text-blue-700 hover:underline font-medium">
              FAQ
            </Link>{" "}
            for quick answers. Hiring for an event instead? Take a look at
            our{" "}
            <Link href="/services/screen-hire" className="text-blue-700 hover:underline font-medium">
              mobile screen trailer hire
            </Link>
            .
          </p>
          <Link
            href="/quote"
            className="inline-block bg-blue-700 hover:bg-blue-800 text-white font-bold px-8 py-4 rounded-md transition duration-200 ease-out hover:scale-105"
          >
            Get a Free Quote
          </Link>
        </div>
      </section>

      {/* Additional Services */}
      <section className="bg-slate-50 py-16 border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-blue-900 mb-10">
            Additional Services
          </h2>
          <StaggerGroup className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <AdditionalServiceCard
              href="/services/web-design-seo"
              badge="Get Online for Less"
              title="Web Design & SEO"
              description="Get found online and turn visitors into enquiries with a fast, professional website. We handle SEO, design and delivery, managed for you from start to finish."
              chips={["Mobile-first", "SEO built in", "Managed for you"]}
              exploreLabel="Explore Web Design & SEO"
              visual={
                <div className="absolute inset-0 bg-blue-900 flex items-center justify-center">
                  <div className="scale-[0.68] transition-transform duration-500 ease-out group-hover:scale-[0.74]">
                    <BrowserMockup />
                  </div>
                </div>
              }
            />
            <AdditionalServiceCard
              href="/services/screen-hire"
              badge="Available to Hire"
              title="Mobile Screen Trailer Hire"
              description="Hire our mobile LED screen trailer for events, advertising, movies, or gaming. A bright 7m&sup2; screen mounted on a trailer, easy to set up and hard to miss."
              chips={["7m² LED screen", "Events and advertising", "Easy setup"]}
              exploreLabel="Explore Screen Hire"
              imageSrc="/Mobile%20Screen%20Trailer%20Hire.webp"
              imageAlt="Mobile LED screen trailer"
              imagePosition="center 30%"
            />
          </StaggerGroup>
        </div>
      </section>
    </>
  );
}
