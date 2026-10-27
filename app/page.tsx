import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Testimonials from "@/components/Testimonials";
import StatsBar from "@/components/StatsBar";
import BrandsBar from "@/components/BrandsBar";
import ReviewBand from "@/components/ReviewBand";
import TrustCards from "@/components/TrustCards";
import StaggerGroup from "@/components/StaggerGroup";
import ScrollReveal from "@/components/ScrollReveal";
import HeroCaseStudyTeaser from "@/components/HeroCaseStudyTeaser";
import AdditionalServiceCard from "@/components/AdditionalServiceCard";
import BrowserMockup from "@/components/BrowserMockup";
import { areas, regions } from "@/lib/areas-data";

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
    href: "/services",
  },
  {
    title: "Print and Deliver",
    desc: "Already have your design ready? We handle the printing in A6, A5, A4 or DL and deliver your leaflets directly through letterboxes across Hampshire and Dorset.",
    href: "/services",
  },
  {
    title: "Leaflet Distribution",
    desc: "Door-to-door delivery to households across your chosen areas. Your printed materials posted directly through letterboxes across Hampshire and Dorset.",
    href: "/services",
  },
  {
    title: "Targeted Postcode Campaigns",
    desc: "We use postcode data to focus your distribution on the areas most likely to respond to your campaign. Rather than blanket coverage, we put your leaflets where your potential customers actually live.",
    href: "/services",
  },
  {
    title: "Vehicle Leaflet Distribution",
    desc: "Leaflets placed on parked cars in car parks, retail areas, and high-footfall locations across Hampshire and Dorset.",
    href: "/services",
  },
  {
    title: "Campaign Planning",
    desc: "Not sure where to start? We sit down with you to understand your business, your customers and your goals. Then we build a campaign plan around your budget and timeline.",
    href: "/services",
  },
  {
    title: "Public Notice Leafleting",
    desc: "Statutory door-to-door distribution for Nationally Significant Infrastructure Projects across Hampshire, meeting Section 47 and Section 48 Planning Act 2008 requirements.",
    href: "/services/public-notice-leafleting",
  },
  {
    title: "Hand-to-Hand Leaflet Distribution",
    desc: "Direct, face-to-face handouts at shopping centres, town centres and events across Hampshire and Dorset for immediate brand exposure.",
    href: "/services/hand-to-hand-distribution",
  },
  {
    title: "B2B Leaflet Distribution",
    desc: "Direct marketing to business owners and decision-makers at offices, business parks and commercial areas across Hampshire and Dorset.",
    href: "/services/b2b-distribution",
  },
];

// Our Google Business Profile, as in the footer and the schema below.
const GOOGLE_PROFILE = "https://share.google/RVxyPi4TzXAzkt1Am";

// The blue bar after the brands: four reasons to choose us.
const sellingPoints = ["Local Hampshire and Dorset team", "Postcode targeting", "GPS tracked delivery", "Quote within 24 hours"];
const HERO_STAR = "M12 2.5l2.9 6.06 6.6.87-4.83 4.6 1.24 6.6L12 17.5l-5.91 3.13 1.24-6.6-4.83-4.6 6.6-.87L12 2.5z";

const localBusinessSchema = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "@id": "https://www.flyerdistributionhampshire.co.uk/#business",
  "name": "Flyer Distribution Hampshire",
  "description":
    "Professional flyer and leaflet distribution across Hampshire and Dorset. Reach real households in Southampton, Bournemouth, Poole and Winchester.",
  "url": "https://www.flyerdistributionhampshire.co.uk",
  "email": "flyerdistributionhampshire@gmail.com",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "11 Forest Reach, St Leonards",
    "addressLocality": "Ringwood",
    "addressRegion": "Dorset",
    "postalCode": "BH24 2NR",
    "addressCountry": "GB"
  },
  "image": "https://www.flyerdistributionhampshire.co.uk/Flyer%20Distribution%20Logo%20White%20Cropped.webp",
  "sameAs": [
    "https://share.google/RVxyPi4TzXAzkt1Am",
    "https://www.facebook.com/share/1EWf3WKLJZ/?mibextid=wwXIfr",
    "https://www.instagram.com/flyerdistributionhampshire/",
    "https://www.tiktok.com/@aw.flyers",
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
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "5.0",
    "reviewCount": "2",
    "bestRating": "5",
  },
  "openingHoursSpecification": [
    {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ],
      "opens": "09:00",
      "closes": "18:00",
    },
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
      <section id="hero" className="relative bg-blue-900 text-white overflow-hidden">
        {/* Background photo, darkened to stay behind content */}
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

        {/* Desktop-only full-bleed image panel: spans the right 48% of the
            section edge to edge, independent of the centered text container
            below, so it isn't boxed in like an inset photo. On wide screens it
            stops at the photo's own width: the photo is square and as tall as
            the hero, so the panel is square at most (aspect-square, with 48%
            as the cap), and the blue side takes the rest. The left edge is
            clipped on a diagonal (narrower at the top, full width at the
            bottom) at a fixed angle, 12.22 degrees from upright: its run is a
            share of the panel's height (100cqh), so the angle holds however
            tall the hero is. The photo is shown at the hero's full height and
            its natural width, against the panel's right edge, so the leaflet
            is never zoomed and the photo's own left side fills the panel up
            to the diagonal. A yellow strip just behind it, 6px to the left,
            edges the diagonal, and a soft shadow falls to its left. */}
        <div
          className="hidden lg:block absolute inset-y-0 right-0 aspect-square max-w-[48%] [container-type:size]"
          style={{ filter: "drop-shadow(-18px 0 30px rgba(0,0,0,0.35))" }}
        >
          <div
            aria-hidden="true"
            className="absolute inset-y-0 right-0 -left-[6px] bg-yellow-400"
            style={{ clipPath: "polygon(calc(100cqh * 0.2166) 0%, calc(100cqh * 0.2166 + 6px) 0%, 6px 100%, 0% 100%)" }}
          />
          <div
            className="absolute inset-0 overflow-hidden"
            style={{ clipPath: "polygon(calc(100cqh * 0.2166) 0%, 100% 0%, 100% 100%, 0% 100%)" }}
          >
            <Image
              src="/Leaflet going through door with our branding.webp"
              alt="Branded leaflet being delivered through a letterbox"
              width={1054}
              height={1054}
              sizes="(min-width: 1024px) 1054px, 1px"
              quality={90}
              className="absolute top-0 right-0 h-full w-auto max-w-none"
              priority
            />
          </div>
        </div>

        {/* Content */}
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-8">
          <div className="flex flex-col gap-10">
            {/* Text, constrained to keep clear of the full-bleed image at desktop */}
            <div className="lg:max-w-[49%]">
              {/* Our Google rating, linking to the reviews */}
              <a
                href={GOOGLE_PROFILE}
                target="_blank"
                rel="noopener"
                className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 max-w-full rounded-2xl sm:rounded-full bg-white/10 border border-white/20 px-3.5 py-1.5 mb-5 text-xs sm:text-sm hover:bg-white/15 transition-colors"
              >
                <svg role="img" aria-label="5 out of 5 stars" viewBox="0 0 120 24" className="h-3.5 w-auto fill-yellow-400 shrink-0">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <path key={i} d={HERO_STAR} transform={`translate(${i * 24} 0)`} />
                  ))}
                </svg>
                <span className="font-bold text-white whitespace-nowrap">5.0 on Google</span>
                <span className="text-[#bfdbfe] whitespace-nowrap">from local businesses</span>
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
              <p className="text-blue-300 text-sm font-semibold uppercase tracking-widest mb-4">
                Hampshire &amp; Dorset
              </p>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight mb-6">
                <span className="text-yellow-400">#1</span> Tracked Flyer Distribution in Hampshire and Dorset
              </h1>
              <p className="text-blue-100 text-xl sm:text-2xl leading-relaxed mb-8">
                We deliver and track your leaflets and flyers by GPS, directly
                through letterboxes across Hampshire and Dorset, helping local
                businesses reach real customers in the right postcodes.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link
                  href="/quote"
                  className="inline-block bg-white text-blue-900 hover:bg-blue-50 font-bold px-8 py-4 rounded-md text-base transition duration-200 ease-out hover:scale-105 shadow-lg"
                >
                  Get a Free Quote
                </Link>
                <Link
                  href="/case-studies"
                  className="cta-shimmer relative overflow-hidden inline-block border-2 border-white text-white hover:bg-white hover:text-blue-900 font-bold px-8 py-4 rounded-md text-base transition duration-200 ease-out hover:scale-105"
                >
                  <span className="relative z-10">See Our Case Studies</span>
                </Link>
              </div>
              <HeroCaseStudyTeaser />
            </div>
            {/* Mobile-only square image, unchanged from before */}
            <div className="flex justify-center lg:hidden">
              <Image
                src="/Leaflet going through door with our branding.webp"
                alt="Branded leaflet being delivered through a letterbox"
                width={1054}
                height={1054}
                quality={90}
                sizes="min(100vw, 384px)"
                className="w-full max-w-xs sm:max-w-sm rounded-xl shadow-2xl"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      <BrandsBar />

      <section aria-label="Why local businesses choose us" className="bg-[#1e3a8a] text-white">
        <ul className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-[18px] flex flex-wrap justify-center gap-x-10 gap-y-3">
          {sellingPoints.map((point) => (
            <li key={point} className="flex items-center gap-2 text-base font-bold">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="w-5 h-5 shrink-0 text-[#facc15]"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.75}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
              {point}
            </li>
          ))}
        </ul>
      </section>

      <ReviewBand />

      <StatsBar />

      {/* John Lofthouse (New Arts) and Hendonis Salon are in the review band. */}
      <Testimonials exclude={["new-arts", "hendonis-salon"]} />

      {/* Trust signals */}
      <section className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-blue-900 text-center mb-12">
            Why Choose Us?
          </h2>
          <TrustCards />
          <div className="text-center mt-10">
            <Link
              href="/case-studies"
              className="text-blue-700 hover:text-blue-900 font-semibold text-sm underline underline-offset-2"
            >
              See our case studies →
            </Link>
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
            <p className="text-gray-600 max-w-xl text-lg">
              From door-to-door delivery to targeted postcode campaigns, we
              have a service to suit every budget and campaign goal. We also
              handle statutory{" "}
              <Link href="/services/public-notice-leafleting" className="text-blue-700 hover:underline font-medium">
                Public Notice Leafleting
              </Link>{" "}
              for infrastructure projects across Hampshire.
            </p>
          </div>
          <StaggerGroup
            className="flex flex-wrap justify-center gap-6"
            itemClassName="w-full sm:w-[calc(50%-0.75rem)]"
          >
            {services.map((svc) => (
              <Link
                key={svc.title}
                href={svc.href}
                className="group relative bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:border-blue-300 hover:scale-[1.02] hover:shadow-lg transition-all duration-300 ease-out block h-full"
              >
                <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-lg bg-blue-200 group-hover:bg-blue-500 transition-colors duration-300" aria-hidden="true" />
                <h3 className="text-base font-semibold text-blue-900 mb-2">
                  {svc.title}
                </h3>
                <p className="text-gray-600 text-base leading-relaxed">{svc.desc}</p>
              </Link>
            ))}
          </StaggerGroup>
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
          <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-10 lg:gap-16 items-start">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold mb-3">
                Areas We Cover
              </h2>
              <p className="text-blue-200 max-w-xl mb-10 text-lg">
                We cover the Hampshire and Dorset corridor, from{" "}
                <Link href="/areas/leaflet-distribution-winchester" className="text-white underline underline-offset-2 hover:text-blue-200">
                  Winchester
                </Link>{" "}
                in the north to Poole in the west, and everywhere in
                between.
              </p>
              {regions.map((region) => {
                const regionAreas = areas
                  .filter((area) => area.region === region)
                  .sort((a, b) => a.name.localeCompare(b.name));
                return (
                  <div key={region}>
                    <p className="text-blue-400 text-xs font-semibold uppercase tracking-wide mb-3">
                      {region}
                    </p>
                    <div className="flex flex-wrap gap-3 mb-8">
                      {regionAreas.map((area) => (
                        <Link
                          key={area.name}
                          href={area.href}
                          className="bg-blue-800 hover:bg-blue-700 border border-blue-700 text-white text-sm font-medium px-5 py-2.5 rounded-md transition-colors"
                        >
                          {area.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
              <Link
                href="/areas"
                className="text-blue-300 hover:text-white font-semibold text-sm underline underline-offset-2"
              >
                See all coverage areas →
              </Link>
            </div>
            <div className="flex justify-center lg:justify-end">
              <ScrollReveal>
                <div className="w-full max-w-xs sm:max-w-sm lg:max-w-none mx-auto lg:mx-0 aspect-square overflow-hidden rounded-lg shadow-lg ring-1 ring-black/5">
                  <Image
                    src="/Overhead-shot-residential-areas.webp"
                    alt="Overhead view of a residential street with houses and gardens, the kind of area covered door to door"
                    width={999}
                    height={999}
                    sizes="(max-width: 640px) 320px, (max-width: 1024px) 384px, 400px"
                    className="w-full h-full object-cover"
                  />
                </div>
              </ScrollReveal>
            </div>
          </div>
        </div>
      </section>

      {/* Additional Services */}
      <section className="bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="mb-10">
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-500 mb-2">
              More Ways We Can Help
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold text-blue-900 mb-3">
              Additional Services
            </h2>
            <p className="text-gray-600 max-w-xl text-lg">
              Beyond leaflet distribution, we also offer{" "}
              <Link href="/services/web-design-seo" className="text-blue-700 hover:underline font-medium">
                web design and SEO
              </Link>{" "}
              for growing your business online. And if you need something
              bigger for an event, our{" "}
              <Link href="/services/screen-hire" className="text-blue-700 hover:underline font-medium">
                mobile screen trailer hire
              </Link>{" "}
              is worth a look.
            </p>
          </div>
          <StaggerGroup className="grid grid-cols-1 sm:grid-cols-2 gap-6">
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

      {/* Final CTA */}
      <section className="bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-blue-900 mb-4">
            Ready to Reach More Customers?
          </h2>
          <p className="text-gray-600 max-w-lg mx-auto mb-8 leading-relaxed text-lg">
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

      {/* Join the team */}
      <section className="bg-blue-950 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">
            Want to Deliver Leaflets For Us?
          </h2>
          <p className="text-blue-200 max-w-lg mx-auto mb-8 leading-relaxed text-lg">
            Earn flexible, self-employed income across Hampshire and Dorset.
            No experience needed, and quick payment agreed before every job.
          </p>
          <Link
            href="/leaflet-distribution-jobs"
            className="inline-block bg-yellow-400 hover:bg-yellow-300 text-blue-900 font-bold px-8 py-3.5 rounded-md text-base transition duration-200 ease-out hover:scale-105 shadow"
          >
            Become a Distributor
          </Link>
        </div>
      </section>
    </>
  );
}
