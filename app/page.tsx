import type { Metadata } from "next";
import Image, { getImageProps } from "next/image";
import Link from "next/link";
import Testimonials from "@/components/Testimonials";
import StatsBar from "@/components/StatsBar";
import BrandsBar from "@/components/BrandsBar";
import ReviewBand from "@/components/ReviewBand";
import TrustCards from "@/components/TrustCards";
import StaggerGroup from "@/components/StaggerGroup";
import HeroCaseStudyTeaser from "@/components/HeroCaseStudyTeaser";
import LeafletServices from "@/components/LeafletServices";
import HomeAreas from "@/components/HomeAreas";
import AdditionalServiceCard from "@/components/AdditionalServiceCard";
import BrowserMockup from "@/components/BrowserMockup";

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


// Our Google Business Profile, as in the footer and the site-wide schema.
const GOOGLE_PROFILE = "https://share.google/RVxyPi4TzXAzkt1Am";

// The blue bar after the brands: four reasons to choose us.
const sellingPoints = ["Local Hampshire and Dorset team", "Postcode targeting", "GPS tracked delivery", "Quote within 24 hours"];
const HERO_STAR = "M12 2.5l2.9 6.06 6.6.87-4.83 4.6 1.24 6.6L12 17.5l-5.91 3.13 1.24-6.6-4.83-4.6 6.6-.87L12 2.5z";

// The van photo in the hero's right-hand panel, shown from 1024px (lg) up
// only. It sits in a <picture> whose one source is for 1024px and wider, so
// below that the browser never fetches it: the fallback is an empty 1x1 GIF,
// inside a panel that isn't shown. The panel is square, 48% of the width and
// at most the hero's height (794px), hence the sizes.
const HERO_VAN = getImageProps({
  src: "/images/hero-van.webp",
  alt: "Flyer Distribution Hampshire branded van parked outside an office building",
  fill: true,
  sizes: "min(48vw, 800px)",
  loading: "eager",
}).props;
const EMPTY_GIF = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section id="hero" className="relative bg-blue-900 text-white overflow-hidden">
        {/* Background photo, darkened to stay behind content */}
        <Image
          src="https://images.unsplash.com/photo-1464082354059-27db6ce50048?w=1920&q=80"
          alt=""
          aria-hidden="true"
          width={1920}
          height={800}
          sizes="100vw"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ objectPosition: "center" }}
          priority
        />
        {/* Dark overlay. From 1024px up, an even 80%. Below that, where the
            hero is one column, the photo's white sky sits behind the eyebrow
            and the heading and its roofs behind the lower half, so the overlay
            stays dark over the sky (82%) and eases to 70% over the roofs (from
            15% to 40% of the way down): the roofs show more clearly, and every
            line of text keeps AA contrast against the brightest part of the
            photo behind it. */}
        <div className="absolute inset-0 bg-linear-to-b from-blue-950/82 from-15% to-blue-950/70 to-40% lg:bg-none lg:bg-blue-950/80" />

        {/* Desktop-only full-bleed image panel: spans the right 48% of the
            section edge to edge, independent of the centered text container
            below, so it isn't boxed in like an inset photo. On wide screens it
            stops at the photo's own width: the photo is square and as tall as
            the hero, so the panel is square at most (aspect-square, with 48%
            as the cap), and the blue side takes the rest. The left edge is
            clipped on a diagonal (narrower at the top, full width at the
            bottom) at a fixed angle, 12.22 degrees from upright: its run is a
            share of the panel's height (100cqh), so the angle holds however
            tall the hero is. The van photo (portrait) covers the panel: it is
            shown at the panel's full width, and its top and bottom are
            trimmed, holding the photo 60% of the way down, which centres the
            van (39% to 67% down the photo) in the square with room above and
            below, clear of the diagonal, at every desktop width. A yellow
            strip just behind it, 6px to the left, edges the diagonal, and a
            soft shadow falls to its left. Not rendered below 1024px, and not
            downloaded there either (see HERO_VAN). */}
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
            <picture>
              <source media="(min-width: 1024px)" srcSet={HERO_VAN.srcSet} sizes={HERO_VAN.sizes} />
              {/* eslint-disable-next-line @next/next/no-img-element -- next/image's own props, via getImageProps */}
              <img
                {...HERO_VAN}
                srcSet={undefined}
                sizes={undefined}
                src={EMPTY_GIF}
                className="object-cover"
                style={{ ...HERO_VAN.style, objectPosition: "50% 60%" }}
              />
            </picture>
          </div>
        </div>

        {/* Content */}
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-8">
          {/* Text, constrained to keep clear of the full-bleed image at desktop.
              Below 1024px the hero is this text alone, with no photo under it. */}
          <div className="lg:max-w-[49%]">
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
            {/* Our Google rating as a plain line under the buttons, linking
                to the reviews, with a tap area at least 44px tall. */}
            <a
              href={GOOGLE_PROFILE}
              target="_blank"
              rel="noopener"
              className="mt-2 flex w-fit max-w-full min-h-11 items-center gap-2 rounded-sm text-sm text-[#dbeafe] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#facc15]"
            >
              <svg role="img" aria-label="5 out of 5 stars" viewBox="0 0 120 24" className="h-3.5 w-auto fill-[#facc15] shrink-0">
                {[0, 1, 2, 3, 4].map((i) => (
                  <path key={i} d={HERO_STAR} transform={`translate(${i * 24} 0)`} />
                ))}
              </svg>
              <span>Rated 5.0 on Google by local businesses</span>
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
            <HeroCaseStudyTeaser />
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
      <LeafletServices />

      {/* Coverage areas */}
      <HomeAreas />

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
          <p className="mt-8">
            <Link
              href="/services"
              className="text-blue-700 hover:text-blue-900 font-semibold text-sm underline underline-offset-2"
            >
              See all our services →
            </Link>
          </p>
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
