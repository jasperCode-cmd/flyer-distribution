import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Breadcrumb from "@/components/Breadcrumb";

// Leaflet and flyer printing. It targets printing: delivery is a benefit
// that links out to /services and /areas, and "distribution" stays out of
// its H1 and H2s so it doesn't compete with those pages. Facts only: no
// prices, no turnaround times, and the print supplier is never named.

const SITE = "https://www.flyerdistributionhampshire.co.uk";
const PAGE_URL = `${SITE}/leaflet-printing`;
const DESCRIPTION =
  "Leaflet, flyer and business card printing for Hampshire and Dorset businesses. We recommend 250gsm silk, and can deliver to you or door to door.";
const OG_IMAGE = "https://images.pexels.com/photos/35110918/pexels-photo-35110918.jpeg?auto=compress&cs=tinysrgb&w=1200";
// Preselects Leaflet Printing on the quote form.
const QUOTE_HREF = "/quote?service=printing";

export const metadata: Metadata = {
  // With the site's template: "Leaflet Printing Hampshire and Dorset | Flyer Distribution Hampshire".
  title: "Leaflet Printing Hampshire and Dorset",
  description: DESCRIPTION,
  alternates: {
    canonical: PAGE_URL,
  },
  openGraph: {
    title: "Leaflet Printing Hampshire and Dorset | Flyer Distribution Hampshire",
    description: DESCRIPTION,
    url: PAGE_URL,
    siteName: "Flyer Distribution Hampshire",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "Flyer Distribution Hampshire" }],
    locale: "en_GB",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Leaflet Printing Hampshire and Dorset | Flyer Distribution Hampshire",
    description: DESCRIPTION,
    images: [OG_IMAGE],
  },
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE },
    { "@type": "ListItem", position: 2, name: "Services", item: `${SITE}/services` },
    { "@type": "ListItem", position: 3, name: "Leaflet Printing", item: PAGE_URL },
  ],
};

const serviceSchema = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Leaflet Printing",
  serviceType: "Leaflet printing",
  description: DESCRIPTION,
  url: PAGE_URL,
  // The site-wide LocalBusiness, from components/SiteSchema.tsx.
  provider: { "@id": `${SITE}/#business` },
  areaServed: [
    { "@type": "AdministrativeArea", name: "Hampshire" },
    { "@type": "AdministrativeArea", name: "Dorset" },
  ],
};

const YELLOW_BUTTON =
  "inline-block bg-yellow-400 hover:bg-yellow-300 text-blue-900 font-bold px-7 py-3.5 rounded-md transition duration-200 ease-out hover:scale-105 shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-blue-900";
const IN_TEXT_LINK = "font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-900";
// A card's link on a white card, and on a navy one.
const CARD_LINK = "inline-flex items-center gap-1.5 font-semibold text-blue-700 hover:text-blue-900 underline-offset-4 hover:underline";
const CARD_LINK_ON_NAVY = "inline-flex items-center gap-1.5 font-semibold text-[#facc15] hover:text-yellow-200 underline-offset-4 hover:underline";
const CARD = "rounded-2xl border border-gray-200 bg-white shadow-sm transition-all duration-300 ease-out hover:-translate-y-1 hover:border-blue-300 hover:shadow-xl";
const STAR = "M12 2.5l2.9 6.06 6.6.87-4.83 4.6 1.24 6.6L12 17.5l-5.91 3.13 1.24-6.6-4.83-4.6 6.6-.87L12 2.5z";

const Arrow = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

// Line icons, drawn on a 24px grid.
const Icon = ({ children, className = "h-7 w-7" }: { children: React.ReactNode; className?: string }) => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);

const TICKS = ["250gsm silk, double-sided, recommended", "Delivered to you or through letterboxes", "Every round GPS tracked", "Based in Hampshire and Dorset"];

const MAIN_PRODUCTS = [
  {
    title: "Flyers and leaflets",
    text: "Our main product. A6, A5, A4 and DL, printed single or double-sided.",
    icon: (
      <>
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <path d="M14 2v6h6M8 13h8M8 17h5" />
      </>
    ),
  },
  {
    title: "Folded leaflets",
    text: "Folded leaflets, available creased or perforated.",
    icon: (
      <>
        <path d="M2 4l7 2 6-2 7 2v14l-7-2-6 2-7-2z" />
        <path d="M9 6v14M15 4v14" />
      </>
    ),
  },
  {
    title: "Business cards",
    text: "Standard, folded and uncoated cards to match your leaflets.",
    icon: (
      <>
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M6 10h6M6 14h4" />
      </>
    ),
  },
];

const MORE_PRODUCTS = [
  {
    title: "Custom-shaped flyers",
    text: "Cut to a shape that suits your brand, so your leaflet stands out on the doormat.",
    icon: (
      <>
        <circle cx="6" cy="6" r="3" />
        <circle cx="6" cy="18" r="3" />
        <path d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12" />
      </>
    ),
  },
  {
    title: "Perforated flyers",
    text: "A tear-off voucher or reply slip that customers can keep and bring in.",
    icon: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M3 14h2m3 0h2m3 0h2m3 0h2" />
      </>
    ),
  },
];

const SIZES = [
  { size: "A6", popular: false },
  { size: "A5", popular: true },
  { size: "A4", popular: false },
  { size: "DL", popular: false },
];

// One real review, word for word as it appears in components/Testimonials.tsx.
const REVIEW = {
  quote:
    "Excellent flyer distribution service from start to finish. The team was professional, reliable, and kept us updated throughout the campaign.",
  name: "Kola Construction",
  label: "Google Review",
};

const FAQS: { q: string; a: React.ReactNode }[] = [
  {
    q: "Can you print leaflets without delivering them?",
    a: (
      <>
        Yes. We deliver the printed boxes to you anywhere in Hampshire and Dorset, and we can send them to other areas too. If you later
        want them delivered to homes, see our{" "}
        <Link href="/services" className={IN_TEXT_LINK}>
          leaflet delivery
        </Link>
        .
      </>
    ),
  },
  {
    q: "What paper do you recommend?",
    a: "For most campaigns, 250gsm silk printed double-sided. Other weights and finishes are available and we will advise on the call.",
  },
  {
    q: "Can you design the leaflet for us?",
    a: (
      <>
        Yes. Our{" "}
        <Link href="/services#design-print-deliver" className={IN_TEXT_LINK}>
          Design, Print and Deliver
        </Link>{" "}
        package covers the design too.
      </>
    ),
  },
  {
    q: "Can you print and deliver in one go?",
    a: "Yes. With Print and Deliver your leaflets go from the printer to our own team, who deliver them door to door with every round GPS tracked.",
  },
  {
    q: "What else can you print?",
    a: "As well as flyers and leaflets, we print custom-shaped and perforated flyers, folded leaflets and business cards, including folded and uncoated cards.",
  },
];

export default function LeafletPrintingPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }} />

      {/* 1. Hero */}
      <section className="bg-blue-900 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-20 grid grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-10 lg:gap-14 items-center">
          <div>
            <Breadcrumb
              items={[
                { label: "Home", href: "/" },
                { label: "Services", href: "/services" },
                { label: "Leaflet Printing" },
              ]}
            />
            <p className="text-[#facc15] text-sm font-semibold uppercase tracking-widest mb-3">Printing for Hampshire and Dorset businesses</p>
            <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight mb-5">Leaflet and Flyer Printing</h1>
            <p className="text-blue-100 text-lg sm:text-xl leading-relaxed mb-8">
              We print leaflets, flyers and business cards for local businesses across Hampshire and Dorset, then deliver them to you or
              straight through letterboxes in your chosen areas.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href={QUOTE_HREF} className={YELLOW_BUTTON}>
                Get a Free Quote
              </Link>
              <Link
                href="/services"
                className="inline-block border-2 border-white text-white hover:bg-white hover:text-blue-900 font-bold px-7 py-3 rounded-md transition duration-200 ease-out hover:scale-105"
              >
                See our leaflet delivery
              </Link>
            </div>
          </div>
          {/* Cropped square from the bottom, so the printed leaflets in hand stay in view. */}
          <div className="overflow-hidden rounded-2xl shadow-2xl shadow-black/30 ring-1 ring-white/10">
            <Image
              src="/Flyer%20Distribution%20Hampshire.webp"
              alt="Printed leaflets in hand, ready for delivery in a Hampshire village"
              width={1200}
              height={1600}
              priority
              sizes="(min-width: 1152px) 490px, (min-width: 1024px) 42vw, calc(100vw - 32px)"
              className="block aspect-square w-full object-cover object-bottom"
            />
          </div>
        </div>
      </section>

      {/* 2. Four quick points */}
      <section className="bg-slate-50 border-b border-gray-100">
        <ul className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-3">
          {TICKS.map((tick) => (
            <li key={tick} className="flex items-center gap-3 font-semibold text-blue-900">
              <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1e3a8a] text-[#facc15]">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
              </span>
              {tick}
            </li>
          ))}
        </ul>
      </section>

      {/* 3. What we print */}
      <section className="bg-white py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-blue-900 mb-3">What we print</h2>
          <p className="text-gray-600 text-lg leading-relaxed max-w-3xl mb-10">
            Leaflets and flyers are what most of our customers order, but we print a lot more than that. Tell us what you need on the call
            and we will recommend the right format.
          </p>
          <ul className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {MAIN_PRODUCTS.map((p) => (
              <li key={p.title} className={`${CARD} p-7`}>
                <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                  <Icon>{p.icon}</Icon>
                </span>
                <h3 className="mt-5 text-xl font-bold text-blue-900">{p.title}</h3>
                <p className="mt-2 text-gray-600 leading-relaxed">{p.text}</p>
              </li>
            ))}
          </ul>
          <ul className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            {MORE_PRODUCTS.map((p) => (
              <li key={p.title} className={`${CARD} flex items-start gap-4 p-5`}>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                  <Icon className="h-6 w-6">{p.icon}</Icon>
                </span>
                <div>
                  <h3 className="text-lg font-bold text-blue-900">{p.title}</h3>
                  <p className="mt-1 text-gray-600 leading-relaxed">{p.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 4. Paper and finish */}
      <section className="bg-slate-50 py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-8 lg:gap-12 items-start">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-blue-900 mb-4">Paper and finish</h2>
            <p className="text-gray-600 text-lg leading-relaxed">
              For most leaflet campaigns we recommend 250gsm silk, printed double-sided. It feels sturdy in the hand, the colours stay
              sharp, and it holds up going through a letterbox.
            </p>
            <p className="mt-4 text-gray-600 text-lg leading-relaxed">
              Other paper weights and finishes are available. We will talk you through the options on the call and recommend what suits
              your campaign.
            </p>
            <div className="mt-7 inline-flex flex-col items-start gap-3 rounded-xl border-2 border-[#1e3a8a] bg-white px-6 py-5 shadow-sm">
              <span className="rounded-full bg-[#facc15] px-3 py-1 text-xs font-bold uppercase tracking-wider text-blue-900">We recommend</span>
              <p className="font-heading text-2xl font-bold text-blue-900">250gsm silk, double-sided</p>
            </div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-7 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-widest text-[#1d4ed8]">Popular sizes</p>
            <ul className="mt-4 flex flex-wrap gap-3">
              {SIZES.map((s) => (
                <li
                  key={s.size}
                  className={`rounded-full px-5 py-2.5 font-heading text-lg font-bold ${
                    s.popular ? "bg-[#1e3a8a] text-white shadow-md" : "border border-blue-200 bg-white text-blue-900"
                  }`}
                >
                  {s.size}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* 5. Three ways to order */}
      <section className="bg-white py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-blue-900 mb-3">Three ways to order</h2>
          <p className="text-gray-600 text-lg leading-relaxed max-w-3xl mb-10">
            Print on its own, or let us handle delivery too. Whichever you choose, you deal with the same local team from start to finish.
          </p>
          <ul className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <li className={`${CARD} flex flex-col p-7`}>
              <h3 className="text-xl font-bold text-blue-900">Print only</h3>
              <p className="mt-3 text-gray-600 leading-relaxed">
                We print your leaflets and deliver the boxes to you anywhere in Hampshire and Dorset, or send them to you further afield.
              </p>
              <p className="mt-auto pt-5">
                <Link href={QUOTE_HREF} className={CARD_LINK}>
                  Get a printing quote <Arrow />
                </Link>
              </p>
            </li>
            <li className={`${CARD} flex flex-col p-7`}>
              <h3 className="text-xl font-bold text-blue-900">Print and Deliver</h3>
              <p className="mt-3 text-gray-600 leading-relaxed">
                Send us your artwork. We print it and our own team delivers it door to door, with every round GPS tracked.
              </p>
              <p className="mt-auto pt-5">
                <Link href="/services#print-and-deliver" className={CARD_LINK}>
                  About Print and Deliver <Arrow />
                </Link>
              </p>
            </li>
            <li className="relative flex flex-col rounded-2xl bg-[#1e3a8a] p-7 text-white shadow-lg transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-xl">
              <span className="absolute -top-3 left-7 rounded-full bg-[#facc15] px-3 py-1 text-xs font-bold uppercase tracking-wider text-blue-900">
                Most popular
              </span>
              <h3 className="text-xl font-bold">Design, Print and Deliver</h3>
              <p className="mt-3 text-[#dbeafe] leading-relaxed">
                No artwork yet? We design your leaflet, print it and deliver it. One campaign, one team, start to finish.
              </p>
              <p className="mt-auto pt-5">
                <Link href="/services#design-print-deliver" className={CARD_LINK_ON_NAVY}>
                  About Design, Print and Deliver <Arrow />
                </Link>
              </p>
            </li>
          </ul>
        </div>
      </section>

      {/* 6. Where we deliver: the two counties, then anywhere else (no town names or postcodes) */}
      <section className="bg-slate-50 py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-blue-900 mb-3">Where we deliver your leaflets</h2>
          <p className="text-gray-600 text-lg leading-relaxed max-w-3xl mb-10">
            We print and deliver leaflets for businesses right across Hampshire and Dorset. Outside those counties? We can still print
            your leaflets and send them to you.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col rounded-2xl bg-[#1e3a8a] p-7 text-white shadow-lg">
              <h3 className="text-xl font-bold">Hampshire and Dorset</h3>
              <p className="mt-3 text-[#dbeafe] leading-relaxed">
                This is home for us. We can drop the boxes off to you, or our own team can deliver your leaflets door to door, with every
                round GPS tracked.
              </p>
              <p className="mt-auto pt-5">
                <Link href="/areas" className={CARD_LINK_ON_NAVY}>
                  See the areas we cover <Arrow />
                </Link>
              </p>
            </div>
            <div className="flex flex-col rounded-2xl border border-gray-200 bg-white p-7 shadow-sm">
              <h3 className="text-xl font-bold text-blue-900">Other areas</h3>
              <p className="mt-3 text-gray-600 leading-relaxed">
                Based further afield? We can still print your leaflets and send them to you. Just tell us where they need to go when you
                get a quote.
              </p>
              <p className="mt-auto pt-5">
                <Link href={QUOTE_HREF} className={CARD_LINK}>
                  Get a printing quote <Arrow />
                </Link>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Printing questions: the intro and one real review, beside the questions (no FAQ schema) */}
      <section className="bg-white py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] gap-10 lg:gap-14 items-start">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-blue-900 mb-3">Printing questions</h2>
            <p className="text-gray-600 text-lg leading-relaxed">
              The questions we get asked most about printing. For anything about delivery, see our{" "}
              <Link href="/faq" className={IN_TEXT_LINK}>
                FAQ page
              </Link>
              .
            </p>
            <figure className="mt-8 rounded-2xl border border-gray-200 bg-slate-50 p-6">
              <svg role="img" aria-label="5 out of 5 stars" viewBox="0 0 120 24" className="h-5 w-auto fill-amber-400">
                {[0, 1, 2, 3, 4].map((i) => (
                  <path key={i} d={STAR} transform={`translate(${i * 24} 0)`} />
                ))}
              </svg>
              <blockquote className="mt-3 text-gray-700 leading-relaxed">&ldquo;{REVIEW.quote}&rdquo;</blockquote>
              <figcaption className="mt-4">
                <p className="font-semibold text-blue-900">{REVIEW.name}</p>
                <p className="text-sm text-gray-500">{REVIEW.label}</p>
              </figcaption>
            </figure>
          </div>
          <div className="space-y-3">
            {FAQS.map((f, i) => (
              <details key={f.q} open={i === 0} className="group rounded-xl border border-gray-200 bg-white open:shadow-sm">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-xl px-5 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 [&::-webkit-details-marker]:hidden">
                  <h3 className="text-base sm:text-lg font-semibold text-blue-900">{f.q}</h3>
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-5 w-5 shrink-0 text-blue-700 transition-transform duration-200 group-open:rotate-180"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.25}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </summary>
                <p className="px-5 pb-5 text-gray-600 leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* 8. Closing band */}
      <section className="bg-blue-900 text-white py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">Ready to get your leaflets printed?</h2>
          <p className="text-blue-100 text-lg mb-8">Tell us what you need and where, and we will come back to you with a quote.</p>
          <Link href={QUOTE_HREF} className={YELLOW_BUTTON}>
            Get a Free Quote
          </Link>
        </div>
      </section>
    </>
  );
}
