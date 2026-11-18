import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

// The all services hub: leaflet delivery, leaflet printing, web design and
// screen hire, a row each, with the two print and delivery packages between
// them, then a strip of reasons and the closing band. Built to the services
// design: its 1200px container, spacing, type sizes, colours, corners and
// cards (the design's flex and grid rules, so it wraps where the design does).
// On phones (below 640px) the headings and the larger section padding are
// smaller, as on /leaflet-delivery. The hero's four buttons and the four
// reasons sit 1 across on small phones, 2 from sm and 4 from lg, so no row is
// left with one. Each row has an id the hero's buttons jump
// to. Facts only: no prices, no turnaround times, no supplier named.

const SITE = "https://www.flyerdistributionhampshire.co.uk";
const PAGE_URL = `${SITE}/services`;
const DESCRIPTION =
  "Leaflet delivery, leaflet printing, web design and mobile screen hire for local businesses across Hampshire and Dorset, all from one local team.";
const OG_IMAGE = "https://images.pexels.com/photos/35110918/pexels-photo-35110918.jpeg?auto=compress&cs=tinysrgb&w=1200";
// The same Google Business Profile the homepage's rating links to.
const GOOGLE_PROFILE = "https://share.google/RVxyPi4TzXAzkt1Am";

export const metadata: Metadata = {
  // With the site's template: "Our Services | Flyer Distribution Hampshire".
  title: "Our Services",
  description: DESCRIPTION,
  alternates: {
    canonical: PAGE_URL,
  },
  openGraph: {
    title: "Our Services | Flyer Distribution Hampshire",
    description: DESCRIPTION,
    url: PAGE_URL,
    siteName: "Flyer Distribution Hampshire",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "Flyer Distribution Hampshire" }],
    locale: "en_GB",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Our Services | Flyer Distribution Hampshire",
    description: DESCRIPTION,
    images: [OG_IMAGE],
  },
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE },
    { "@type": "ListItem", position: 2, name: "Services", item: PAGE_URL },
  ],
};

// The four services, each at its own page, from the site-wide LocalBusiness (components/SiteSchema.tsx).
const AREA_SERVED = [
  { "@type": "AdministrativeArea", name: "Hampshire" },
  { "@type": "AdministrativeArea", name: "Dorset" },
];
const servicesSchema = {
  "@context": "https://schema.org",
  "@graph": [
    { name: "Leaflet Delivery", path: "/leaflet-delivery" },
    { name: "Leaflet Printing", path: "/leaflet-printing" },
    { name: "Web Design & SEO", path: "/services/web-design-seo" },
    { name: "Mobile Screen Trailer Hire", path: "/services/screen-hire" },
  ].map((s) => ({
    "@type": "Service",
    name: s.name,
    url: `${SITE}${s.path}`,
    provider: { "@id": `${SITE}/#business` },
    areaServed: AREA_SERVED,
  })),
};

// The design's measures: a centred 1200px container with 24px sides, 40px headings in #172554 (32px on phones),
// body text at a 1.6 line height.
const CONTAINER = "mx-auto w-full max-w-[1200px] px-6";
const H2 = "font-heading text-[32px] sm:text-[40px] font-extrabold leading-[1.1] text-[#172554]";
const INTRO = "text-[18px] text-[#374151]";
const BADGE = "self-start rounded-full bg-[#facc15] px-2.5 py-1 text-[12px] font-bold text-[#172554]";
const PILL = "inline-flex rounded-full bg-[#eff6ff] px-[13px] py-[7px] text-[14px] font-bold text-[#1e3a8a]";
const PILL_LINK = `${PILL} transition-colors hover:bg-[#dbeafe] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d4ed8] focus-visible:ring-offset-2`;
// The navy button each service row ends with: 52px tall, 12px corners, bold.
const ROW_BUTTON =
  "mt-1.5 inline-flex min-h-[52px] items-center gap-1.5 self-start rounded-[12px] bg-[#1e3a8a] px-6 font-bold text-white transition-colors duration-200 hover:bg-[#172554] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d4ed8] focus-visible:ring-offset-2";
const CLOSING_BUTTON =
  "inline-flex min-h-[56px] shrink-0 items-center rounded-[12px] bg-[#facc15] px-[30px] text-[18px] font-bold text-[#172554] transition duration-200 ease-out hover:scale-105 hover:bg-yellow-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#1e3a8a]";
const IN_TEXT_LINK_ON_NAVY = "text-white underline hover:text-[#facc15]";
const STAR = "M12 2.5l2.9 6.06 6.6.87-4.83 4.6 1.24 6.6L12 17.5l-5.91 3.13 1.24-6.6-4.83-4.6 6.6-.87L12 2.5z";
// Each row's photo: as wide as its column (548px beside the copy at full width, the full width once they stack).
const ROW_IMAGE_SIZES = "(min-width: 1200px) 548px, (min-width: 984px) calc(50vw - 52px), calc(100vw - 48px)";
// A row photo covers its box, so in a box taller than the photo's own shape it is drawn wider than the box: its
// height times the photo's width-to-height ratio (coverWidth). sizes asks for the wider of the two, so the file
// the browser picks fills the photo as drawn: beside the copy from 984px (548px at most), the full width once they
// stack, and never less than coverWidth.
const rowImageSizes = (coverWidth: number) =>
  `(min-width: 984px) ${Math.max(548, coverWidth)}px, (min-width: ${coverWidth + 48}px) calc(100vw - 48px), ${coverWidth}px`;

const Arrow = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

const DownArrow = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-[#facc15]" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14M6 13l6 6 6-6" />
  </svg>
);

const JUMPS = [
  { id: "leaflet-delivery", label: "Leaflet Delivery" },
  { id: "leaflet-printing", label: "Leaflet Printing" },
  { id: "web-design-seo", label: "Web Design & SEO" },
  { id: "screen-hire", label: "Screen Hire" },
];

const DELIVERY_PILLS = [
  { label: "Door to door", href: "/leaflet-delivery" },
  { label: "Hand-to-Hand", href: "/services/hand-to-hand-distribution" },
  { label: "B2B", href: "/services/b2b-distribution" },
  { label: "Public Notice", href: "/services/public-notice-leafleting" },
  { label: "Vehicle", href: "/leaflet-delivery#vehicle-leaflet-distribution" },
];

const REASONS = [
  { title: "Our own local team", text: "Based in Hampshire and Dorset" },
  { title: "GPS tracked rounds", text: "With a route report at the end" },
  { title: "One point of contact", text: "From the first call to the last round" },
];

// A service row's copy: its heading, line, pills (links, or plain labels) and button.
function RowCopy({
  badge,
  title,
  text,
  pills,
  button,
}: {
  badge?: string;
  title: string;
  text: string;
  pills: { label: string; href?: string }[];
  button: { label: string; href: string };
}) {
  return (
    <div className="flex min-w-0 flex-[1_1_440px] flex-col gap-4">
      {badge && <span className={BADGE}>{badge}</span>}
      <h2 className={H2}>{title}</h2>
      <p className={INTRO}>{text}</p>
      <ul className="flex flex-wrap gap-2">
        {pills.map((p) => (
          <li key={p.label}>
            {p.href ? (
              <Link href={p.href} className={PILL_LINK}>
                {p.label}
              </Link>
            ) : (
              <span className={PILL}>{p.label}</span>
            )}
          </li>
        ))}
      </ul>
      <Link href={button.href} className={ROW_BUTTON}>
        {button.label} <Arrow />
      </Link>
    </div>
  );
}

export default function ServicesPage() {
  return (
    <div className="bg-white leading-[1.6] text-[#1f2937]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(servicesSchema) }} />

      {/* 1. Hero: the breadcrumb, the copy, and a button to each service's row */}
      <section className="bg-[#1e3a8a] text-white">
        <div className={`${CONTAINER} flex flex-col gap-[22px] pt-7 pb-16`}>
          <nav aria-label="Breadcrumb" className="mb-3.5 text-[14px] text-[#dbeafe]">
            <ol className="flex flex-wrap items-center gap-x-1">
              <li>
                <Link href="/" className="underline hover:text-white">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <span className="font-bold text-white" aria-current="page">
                  Services
                </span>
              </li>
            </ol>
          </nav>
          <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-[#facc15]">For local businesses across Hampshire and Dorset</p>
          <h1 className="max-w-[820px] font-heading text-[36px] sm:text-[56px] font-extrabold leading-[1.05]">Our Services</h1>
          <p className="max-w-[680px] text-[20px] text-[#dbeafe]">
            Leaflet delivery, printing, web design and mobile screen hire. Pick one, or put them together and deal with one local team
            from start to finish.
          </p>
          <ul className="mt-[18px] grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {JUMPS.map((j) => (
              <li key={j.id}>
                <a
                  href={`#${j.id}`}
                  className="flex items-center justify-between gap-2.5 rounded-[14px] border border-[#3b5bb5] bg-[#172554] px-[18px] py-4 font-bold text-white transition-colors hover:border-[#facc15] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15]"
                >
                  {j.label}
                  <DownArrow />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 2. Leaflet Delivery: the photo, then the copy (photo first once they stack) */}
      <section id="leaflet-delivery" className="scroll-mt-16">
        <div className={`${CONTAINER} flex flex-wrap items-center gap-14 pt-16 pb-14 sm:pt-[88px]`}>
          <Image
            src="/images/leaflet-delivery-hero.webp"
            alt="Leaflets posted through a letterbox"
            width={1600}
            height={1200}
            sizes={rowImageSizes(534)}
            className="h-[400px] min-w-0 flex-[1_1_440px] rounded-[20px] object-cover"
          />
          <RowCopy
            badge="What we're known for"
            title="Leaflet Delivery"
            text="Door to door delivery across the postcodes you choose, by our own local team. Every round is GPS tracked, and you get a route report at the end."
            pills={DELIVERY_PILLS}
            button={{ label: "Explore leaflet delivery", href: "/leaflet-delivery" }}
          />
        </div>
      </section>

      {/* 3. Leaflet Printing: the copy, then the photo (photo first once they stack) */}
      <section id="leaflet-printing" className="scroll-mt-16">
        <div className={`${CONTAINER} flex flex-wrap-reverse items-center gap-14 py-14`}>
          <RowCopy
            title="Leaflet Printing"
            text="Flyers, folded leaflets and business cards, printed and delivered to you or straight through letterboxes. Build your spec online and send it straight to a quote."
            pills={[{ label: "Flyers and leaflets" }, { label: "Folded leaflets" }, { label: "Business cards" }, { label: "Custom shapes" }]}
            button={{ label: "Build your print", href: "/leaflet-printing#paper-and-finish" }}
          />
          <Image
            src="/images/printing-flyers-leaflets.webp"
            alt="Colourful printed leaflets laid out on a desk"
            width={2312}
            height={1349}
            sizes={rowImageSizes(618)}
            className="h-[360px] min-w-0 flex-[1_1_440px] rounded-[20px] object-cover"
          />
        </div>
      </section>

      {/* 4. The two packages, side by side while they fit */}
      <section className="bg-[#f8fafc]">
        <div className={`${CONTAINER} flex flex-col gap-6 py-16 sm:py-[72px]`}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-col gap-2">
              <h2 className="font-heading text-[28px] sm:text-[32px] font-extrabold leading-[1.15] text-[#172554]">Put printing and delivery together</h2>
              <p className="text-[17px] text-[#374151]">One campaign, one team, one quote.</p>
            </div>
          </div>
          <ul className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-5">
            <li className="flex">
              <Link
                href="/leaflet-delivery#design-print-deliver"
                className="group flex flex-1 flex-col gap-2.5 rounded-[20px] bg-[#1e3a8a] p-7 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d4ed8] focus-visible:ring-offset-2"
              >
                <span className={BADGE}>Most popular</span>
                <h3 className="font-heading text-[24px] font-extrabold">Design, Print and Deliver</h3>
                <p className="text-[#dbeafe]">We design your leaflet, print it and deliver it across your chosen areas.</p>
                <span className="inline-flex items-center gap-1.5 self-start font-bold text-[#facc15] underline-offset-4 group-hover:underline">
                  See the package <Arrow />
                </span>
              </Link>
            </li>
            <li className="flex">
              <Link
                href="/leaflet-delivery#print-and-deliver"
                className="group flex flex-1 flex-col gap-2.5 rounded-[20px] border border-[#e2e8f0] bg-white p-7 transition-colors hover:border-[#bfdbfe] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d4ed8] focus-visible:ring-offset-2"
              >
                {/* Lined up with the other card's title (under its badge) while the two sit side by side. */}
                <h3 className="font-heading text-[24px] font-extrabold text-[#172554] min-[668px]:mt-[30px]">Print and Deliver</h3>
                <p className="text-[#374151]">Artwork ready? We print it and deliver it through letterboxes.</p>
                <span className="inline-flex items-center gap-1.5 self-start font-bold text-[#1d4ed8] underline-offset-4 group-hover:underline">
                  See the package <Arrow />
                </span>
              </Link>
            </li>
          </ul>
        </div>
      </section>

      {/* 5. Web Design & SEO: the photo, then the copy */}
      <section id="web-design-seo" className="scroll-mt-16">
        <div className={`${CONTAINER} flex flex-wrap items-center gap-14 pt-16 pb-14 sm:pt-[88px]`}>
          <Image
            src="https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=1800&q=80"
            alt="A laptop showing website code on a desk"
            width={1800}
            height={1202}
            sizes={rowImageSizes(540)}
            className="h-[360px] min-w-0 flex-[1_1_440px] rounded-[20px] object-cover"
          />
          <RowCopy
            title="Web Design & SEO"
            text="Get found online and turn visitors into enquiries with a fast, professional website. We handle SEO, design and delivery, managed for you from start to finish."
            pills={[{ label: "Mobile-first" }, { label: "SEO built in" }, { label: "Managed for you" }]}
            button={{ label: "Explore web design", href: "/services/web-design-seo" }}
          />
        </div>
      </section>

      {/* 6. Mobile Screen Trailer Hire: the copy, then the photo */}
      <section id="screen-hire" className="scroll-mt-16">
        <div className={`${CONTAINER} flex flex-wrap-reverse items-center gap-14 pt-14 pb-16 sm:pb-[88px]`}>
          <RowCopy
            title="Mobile Screen Trailer Hire"
            text="Hire our mobile LED screen trailer for events, advertising, movies or gaming. A bright 7m² screen on a trailer, easy to set up and hard to miss."
            pills={[{ label: "7m² LED screen" }, { label: "Events and advertising" }, { label: "Easy setup" }]}
            button={{ label: "Explore screen hire", href: "/services/screen-hire" }}
          />
          <Image
            src="/images/screen-trailer.webp"
            alt="Our mobile LED screen trailer set up outdoors"
            width={736}
            height={941}
            sizes={ROW_IMAGE_SIZES}
            className="h-[400px] min-w-0 flex-[1_1_440px] rounded-[20px] object-cover object-[center_45%]"
          />
        </div>
      </section>

      {/* 7. Reasons: the 5.0 Google rating (linking to the reviews, as on the homepage) and three short lines */}
      <section className="border-t border-[#e2e8f0] bg-[#f8fafc]">
        <div className={`${CONTAINER} grid grid-cols-1 gap-5 py-10 sm:grid-cols-2 lg:grid-cols-4`}>
          <a
            href={GOOGLE_PROFILE}
            target="_blank"
            rel="noopener"
            className="flex flex-col self-start rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d4ed8]"
          >
            <span className="flex items-center gap-2 font-heading text-[28px] font-extrabold text-[#1e3a8a]">
              5.0
              <svg role="img" aria-label="5 out of 5 stars" viewBox="0 0 120 24" className="h-[18px] w-auto fill-[#b45309]">
                {[0, 1, 2, 3, 4].map((i) => (
                  <path key={i} d={STAR} transform={`translate(${i * 24} 0)`} />
                ))}
              </svg>
            </span>
            <span className="text-[#374151]">Rated on Google by local businesses</span>
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
          {REASONS.map((r) => (
            <p key={r.title} className="flex flex-col">
              <span className="text-[18px] font-bold text-[#172554]">{r.title}</span>
              <span className="text-[#374151]">{r.text}</span>
            </p>
          ))}
        </div>
      </section>

      {/* 8. Closing band: a navy card, the heading and links on the left, the yellow button on the right */}
      <section className="bg-white">
        <div className={`${CONTAINER} py-16 sm:pt-[72px] sm:pb-[88px]`}>
          <div className="flex flex-wrap items-center justify-between gap-7 rounded-[24px] bg-[#1e3a8a] p-12 text-white">
            <div className="flex min-w-0 flex-[1_1_460px] flex-col gap-2.5">
              <h2 className="font-heading text-[30px] sm:text-[36px] font-extrabold leading-[1.15]">Not sure which you need?</h2>
              <p className="text-[18px] text-[#dbeafe]">
                Tell us what you&apos;re trying to achieve and we&apos;ll recommend the right mix. Or see{" "}
                <Link href="/case-studies" className={IN_TEXT_LINK_ON_NAVY}>
                  our case studies
                </Link>
                ,{" "}
                <Link href="/faq" className={IN_TEXT_LINK_ON_NAVY}>
                  FAQs
                </Link>{" "}
                and{" "}
                <Link href="/before-you-book" className={IN_TEXT_LINK_ON_NAVY}>
                  what to know before you book
                </Link>
                .
              </p>
            </div>
            <Link href="/quote" className={CLOSING_BUTTON}>
              Get a Free Quote
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
