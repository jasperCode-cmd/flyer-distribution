import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import PrintBuilder from "@/components/PrintBuilder";

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

// The design's measures: a centred 1200px container with 24px sides on every
// section, 88px above and below each section (64px on phones), 40px headings
// in #172554, body text #374151 at a 1.6 line height, third-level headings in
// the body font.
const CONTAINER = "mx-auto w-full max-w-[1200px] px-6";
const SECTION = "py-16 sm:py-[88px]";
const H2 = "font-heading text-[32px] sm:text-[40px] font-extrabold leading-[1.1] text-[#172554]";
const INTRO = "text-[18px] text-[#374151]";
const H3 = "font-sans font-bold";
// Buttons: 56px tall (the design's 52px plus the outline's 2px border, which the yellow one matches), 12px corners, 17px bold.
const YELLOW_BUTTON =
  "inline-flex min-h-[56px] items-center rounded-[12px] bg-[#facc15] px-[26px] text-[17px] font-bold text-[#172554] transition duration-200 ease-out hover:scale-105 hover:bg-yellow-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#1e3a8a]";
const OUTLINE_BUTTON =
  "inline-flex min-h-[56px] items-center rounded-[12px] border-2 border-[#dbeafe] px-[22px] text-[17px] font-bold text-white transition duration-200 ease-out hover:scale-105 hover:bg-white hover:text-[#1e3a8a]";
const CLOSING_BUTTON =
  "inline-flex min-h-[56px] shrink-0 items-center rounded-[12px] bg-[#facc15] px-[30px] text-[18px] font-bold text-[#172554] transition duration-200 ease-out hover:scale-105 hover:bg-yellow-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#172554]";
const IN_TEXT_LINK = "text-[#1d4ed8] underline underline-offset-2 hover:text-[#172554]";
// A card's link on a white card, and on a navy one.
const CARD_LINK = "inline-flex items-center gap-1.5 font-bold text-[#1d4ed8] hover:text-[#172554] underline-offset-4 hover:underline";
const CARD_LINK_ON_NAVY = "inline-flex items-center gap-1.5 font-bold text-[#facc15] hover:text-yellow-200 underline-offset-4 hover:underline";
const BADGE = "rounded-full bg-[#facc15] px-2.5 py-1 text-[12px] font-bold leading-none text-[#172554]";
const STAR = "M12 2.5l2.9 6.06 6.6.87-4.83 4.6 1.24 6.6L12 17.5l-5.91 3.13 1.24-6.6-4.83-4.6 6.6-.87L12 2.5z";

const Arrow = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

// Line icons, drawn on a 24px grid.
const Icon = ({ children, className = "h-7 w-7", strokeWidth = 1.75 }: { children: React.ReactNode; className?: string; strokeWidth?: number }) => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);

const TICKS = ["250gsm silk, double-sided, recommended", "Delivered to you or through letterboxes", "Every round GPS tracked", "Based in Hampshire and Dorset"];

const MAIN_PRODUCTS = [
  {
    title: "Flyers and leaflets",
    image: { src: "/images/printing-flyers-leaflets.webp", alt: "Colourful printed leaflets laid out on a desk" },
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
    image: { src: "/images/printing-folded-leaflets.webp", alt: "A printed folded leaflet standing on a stack of leaflets" },
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
    image: { src: "/images/printing-business-cards.webp", alt: "A stack of printed business cards" },
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
        <path d="M12 3 4 9v12h16V9Z" />
        <path d="M9 21v-6h6v6" />
      </>
    ),
  },
  {
    title: "Perforated flyers",
    text: "A tear-off voucher or reply slip that customers can keep and bring in.",
    icon: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M3 14h18" strokeDasharray="2 2" />
      </>
    ),
  },
];

const ICONS = {
  printer: (
    <>
      <path d="M6 9V2h12v7" />
      <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </>
  ),
  letterbox: (
    <>
      <path d="M3 9.5 12 3l9 6.5V21H3Z" />
      <path d="M8 14h8" />
    </>
  ),
  pen: (
    <>
      <path d="M12 19l7-7 3 3-7 7-3-3z" />
      <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
      <path d="M2 2l7.6 7.6" />
      <circle cx="11" cy="11" r="2" />
    </>
  ),
  pin: (
    <>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </>
  ),
  parcel: (
    <>
      <path d="M16.5 9.4 7.5 4.2" />
      <path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7Z" />
      <path d="M3.3 7 12 12l8.7-5" />
      <path d="M12 22V12" />
    </>
  ),
};

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

// A main product card: a band across the top, 200px tall, filled edge to
// edge by its photo, or (with no image) its line icon, large, on light blue;
// then its title and line.
function PrintCard({ title, text, icon, image }: { title: string; text: string; icon: React.ReactNode; image?: { src: string; alt: string } }) {
  return (
    <li className="flex flex-col overflow-hidden rounded-[18px] border border-[#e2e8f0] bg-white">
      <div className="h-[200px] bg-[#dbeafe]">
        {image ? (
          <Image
            src={image.src}
            alt={image.alt}
            width={1200}
            height={700}
            sizes="(min-width: 1200px) 371px, (min-width: 768px) calc((100vw - 88px) / 3), calc(100vw - 48px)"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[#1e3a8a]">
            <Icon className="h-12 w-12">{icon}</Icon>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2 p-6">
        <h3 className={`${H3} text-[22px] text-[#172554]`}>{title}</h3>
        <p className="text-[#374151]">{text}</p>
      </div>
    </li>
  );
}

export default function LeafletPrintingPage() {
  return (
    <div className="leading-[1.6] text-[#1f2937]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }} />

      {/* 1. Hero: the breadcrumb, then the copy beside the photo box */}
      <section className="bg-[#1e3a8a] text-white">
        <div className={`${CONTAINER} pt-7 pb-16 sm:pb-[72px]`}>
          <nav aria-label="Breadcrumb" className="mb-9 text-[14px] text-[#dbeafe]">
            <ol className="flex flex-wrap items-center gap-x-1.5">
              <li>
                <Link href="/" className="underline underline-offset-2 hover:text-white">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <Link href="/services" className="underline underline-offset-2 hover:text-white">
                  Services
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <span className="font-bold text-white" aria-current="page">Leaflet Printing</span>
              </li>
            </ol>
          </nav>
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[minmax(0,1.075fr)_minmax(0,1fr)]">
            <div className="flex flex-col gap-[22px]">
              <p className="text-[#facc15] text-[13px] font-bold uppercase tracking-[0.14em]">Printing for Hampshire and Dorset businesses</p>
              <h1 className="font-heading text-[40px] sm:text-[56px] font-extrabold leading-[1.05]">Leaflet and Flyer Printing</h1>
              <p className="max-w-[560px] text-[18px] sm:text-[20px] text-[#dbeafe]">
                We print leaflets, flyers and business cards for local businesses across Hampshire and Dorset, then deliver them to you or
                straight through letterboxes in your chosen areas.
              </p>
              <div className="mt-1.5 flex flex-wrap gap-3.5">
                <Link href={QUOTE_HREF} className={YELLOW_BUTTON}>
                  Get a Free Quote
                </Link>
                <Link href="/services" className={OUTLINE_BUTTON}>
                  See our leaflet delivery
                </Link>
              </div>
            </div>
            {/* The photo box: 380px tall (280px on phones), 20px corners. */}
            <div className="h-[280px] overflow-hidden rounded-[20px] sm:h-[380px]">
              <Image
                src="/images/leaflet-printing-hero.webp"
                alt="A large printer mid-print"
                width={1500}
                height={1000}
                priority
                sizes="(min-width: 1200px) 532px, (min-width: 1024px) 45vw, calc(100vw - 48px)"
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 2. Four quick points */}
      <section className="border-b border-[#e2e8f0] bg-[#f8fafc]">
        <ul className={`${CONTAINER} flex flex-wrap justify-between gap-x-8 gap-y-3.5 py-[22px] font-bold text-[#172554]`}>
          {TICKS.map((tick) => (
            <li key={tick} className="flex items-center gap-2.5">
              <span aria-hidden="true" className="text-[#1d4ed8]">
                <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </span>
              {tick}
            </li>
          ))}
        </ul>
      </section>

      {/* 3. What we print: three photo cards, then two smaller grey ones */}
      <section className={`bg-white ${SECTION}`}>
        <div className={`${CONTAINER} flex flex-col gap-10`}>
          <div className="flex max-w-[720px] flex-col gap-3">
            <h2 className={H2}>What we print</h2>
            <p className={INTRO}>
              Leaflets and flyers are what most of our customers order, but we print a lot more than that. Tell us what you need on the
              call and we will recommend the right format.
            </p>
          </div>
          <ul className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {MAIN_PRODUCTS.map((p) => (
              <PrintCard key={p.title} {...p} />
            ))}
          </ul>
          <ul className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {MORE_PRODUCTS.map((p) => (
              <li key={p.title} className="flex items-start gap-[18px] rounded-[18px] bg-[#f8fafc] p-6">
                <span className="shrink-0 text-[#1d4ed8]">
                  <Icon className="block h-[34px] w-[34px]" strokeWidth={2}>
                    {p.icon}
                  </Icon>
                </span>
                <div className="flex flex-col gap-1">
                  <h3 className={`${H3} text-[20px] text-[#172554]`}>{p.title}</h3>
                  <p className="text-[#374151]">{p.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 4. Paper and finish: the recommendation and the paper photo, beside the print builder (after the text on phones) */}
      <section id="paper-and-finish" className={`bg-[#f8fafc] ${SECTION}`}>
        <div className={`${CONTAINER} grid grid-cols-1 items-start gap-12 lg:grid-cols-2`}>
          <div className="flex flex-col gap-[18px]">
            <h2 className={H2}>Paper and finish</h2>
            <p className={INTRO}>
              For most leaflet campaigns we recommend <strong>250gsm silk, printed double-sided</strong>. It feels sturdy in the hand, the
              colours stay sharp, and it holds up going through a letterbox.
            </p>
            <p className={INTRO}>Pick your options, or leave it to us and we will recommend what suits your campaign on the call.</p>
            <div className="flex items-center gap-4 rounded-[16px] border-2 border-[#1e3a8a] bg-white px-[22px] py-5">
              <span className={`shrink-0 ${BADGE}`}>We recommend</span>
              <span className="text-[18px] font-bold text-[#172554]">250gsm silk, double-sided</span>
            </div>
            <div className="h-[180px] overflow-hidden rounded-[16px]">
              <Image
                src="/images/printing-paper.webp"
                alt="A fan of coloured paper sheets"
                width={1200}
                height={700}
                sizes="(min-width: 1200px) 552px, (min-width: 1024px) 45vw, calc(100vw - 48px)"
                className="h-full w-full object-cover"
              />
            </div>
          </div>
          <PrintBuilder />
        </div>
      </section>

      {/* 5. Three ways to order: three equal cards, the third navy and most popular */}
      <section className={`bg-white ${SECTION}`}>
        <div className={`${CONTAINER} flex flex-col gap-10`}>
          <div className="flex max-w-[720px] flex-col gap-3">
            <h2 className={H2}>Three ways to order</h2>
            <p className={INTRO}>
              Print on its own, or let us handle delivery too. Whichever you choose, you deal with the same local team from start to finish.
            </p>
          </div>
          <ul className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <li className="flex flex-col gap-3.5 rounded-[20px] border border-[#e2e8f0] bg-white p-[30px]">
              <span className="text-[#1d4ed8]">
                <Icon className="block h-9 w-9" strokeWidth={2}>
                  {ICONS.printer}
                </Icon>
              </span>
              <h3 className={`${H3} text-[24px] text-[#172554]`}>Print only</h3>
              <p className="flex-1 text-[#374151]">
                We print your leaflets and deliver the boxes to you anywhere in Hampshire and Dorset, or send them to you further afield.
              </p>
              <Link href={QUOTE_HREF} className={`self-start ${CARD_LINK}`}>
                Get a printing quote <Arrow />
              </Link>
            </li>
            <li className="flex flex-col gap-3.5 rounded-[20px] border border-[#e2e8f0] bg-white p-[30px]">
              <span className="text-[#1d4ed8]">
                <Icon className="block h-9 w-9" strokeWidth={2}>
                  {ICONS.letterbox}
                </Icon>
              </span>
              <h3 className={`${H3} text-[24px] text-[#172554]`}>Print and Deliver</h3>
              <p className="flex-1 text-[#374151]">
                Send us your artwork. We print it and our own team delivers it door to door, with every round GPS tracked.
              </p>
              <Link href="/services#print-and-deliver" className={`self-start ${CARD_LINK}`}>
                About Print and Deliver <Arrow />
              </Link>
            </li>
            <li className="relative flex flex-col gap-3.5 rounded-[20px] bg-[#1e3a8a] p-[30px] text-white">
              <span className={`absolute right-5 top-5 ${BADGE}`}>Most popular</span>
              <span className="text-[#facc15]">
                <Icon className="block h-9 w-9" strokeWidth={2}>
                  {ICONS.pen}
                </Icon>
              </span>
              <h3 className={`${H3} text-[24px]`}>Design, Print and Deliver</h3>
              <p className="flex-1 text-[#dbeafe]">
                No artwork yet? We design your leaflet, print it and deliver it. One campaign, one team, start to finish.
              </p>
              <Link href="/services#design-print-deliver" className={`self-start ${CARD_LINK_ON_NAVY}`}>
                About Design, Print and Deliver <Arrow />
              </Link>
            </li>
          </ul>
        </div>
      </section>

      {/* 6. Where we deliver: the two counties, then anywhere else (no town names or postcodes) */}
      <section className={`bg-[#f8fafc] ${SECTION}`}>
        <div className={`${CONTAINER} flex flex-col gap-9`}>
          <div className="flex max-w-[760px] flex-col gap-3">
            <h2 className={H2}>Where we deliver your leaflets</h2>
            <p className={INTRO}>
              We print and deliver leaflets for businesses right across Hampshire and Dorset. Outside those counties? We can still print
              your leaflets and send them to you.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="flex flex-col gap-3.5 rounded-[20px] bg-[#1e3a8a] p-8 text-white">
              <span className="text-[#facc15]">
                <Icon className="block h-[38px] w-[38px]" strokeWidth={2}>
                  {ICONS.pin}
                </Icon>
              </span>
              <h3 className={`${H3} text-[26px]`}>Hampshire and Dorset</h3>
              <p className="flex-1 text-[17px] text-[#dbeafe]">
                This is home for us. We can drop the boxes off to you, or our own team can deliver your leaflets door to door, with every
                round GPS tracked.
              </p>
              <Link href="/areas" className={`self-start ${CARD_LINK_ON_NAVY}`}>
                See the areas we cover <Arrow />
              </Link>
            </div>
            <div className="flex flex-col gap-3.5 rounded-[20px] border border-[#e2e8f0] bg-white p-8">
              <span className="text-[#1d4ed8]">
                <Icon className="block h-[38px] w-[38px]" strokeWidth={2}>
                  {ICONS.parcel}
                </Icon>
              </span>
              <h3 className={`${H3} text-[26px] text-[#172554]`}>Other areas</h3>
              <p className="flex-1 text-[17px] text-[#374151]">
                Based further afield? We can still print your leaflets and send them to you. Just tell us where they need to go when you
                get a quote.
              </p>
              <Link href={QUOTE_HREF} className={`self-start ${CARD_LINK}`}>
                Get a printing quote <Arrow />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Printing questions: the intro and one real review, beside the questions (no FAQ schema) */}
      <section className={`bg-white ${SECTION}`}>
        <div className={`${CONTAINER} grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,408fr)_minmax(0,696fr)]`}>
          <div className="flex flex-col gap-3.5">
            <h2 className={H2}>Printing questions</h2>
            <p className={INTRO}>
              The questions we get asked most about printing. For anything about delivery, see our{" "}
              <Link href="/faq" className={IN_TEXT_LINK}>
                FAQ page
              </Link>
              .
            </p>
            {/* One real review, with the 5.0 Google rating the site shows elsewhere. */}
            <figure className="mt-3 flex flex-col gap-2.5 rounded-[18px] border border-[#e2e8f0] bg-[#f8fafc] p-6">
              <p className="flex items-center gap-2.5">
                <span className="font-heading text-[36px] font-extrabold text-[#172554]">5.0</span>
                <svg role="img" aria-label="5 out of 5 stars" viewBox="0 0 120 24" className="h-[22px] w-auto fill-[#b45309]">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <path key={i} d={STAR} transform={`translate(${i * 24} 0)`} />
                  ))}
                </svg>
              </p>
              <p className="text-[14px] text-[#4b5563]">{REVIEW.label}</p>
              <blockquote className="mt-1.5 italic text-[#1f2937]">&ldquo;{REVIEW.quote}&rdquo;</blockquote>
              <figcaption className="font-bold text-[#172554]">{REVIEW.name}</figcaption>
            </figure>
          </div>
          <div className="flex flex-col">
            {FAQS.map((f, i) => (
              <details key={f.q} open={i === 0} className="group border-b border-[#e2e8f0] py-5">
                <summary className="flex cursor-pointer list-none items-center gap-3 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 [&::-webkit-details-marker]:hidden">
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3 w-3 shrink-0 fill-[#172554] transition-transform duration-200 group-open:rotate-90">
                    <path d="M6 3l15 9-15 9z" />
                  </svg>
                  <h3 className={`${H3} text-[19px] text-[#172554]`}>{f.q}</h3>
                </summary>
                <p className="mt-3 text-[#374151]">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* 8. Closing band: heading on the left, the button on the right (stacked on phones). A
          faint line under it keeps it apart from the footer, which is nearly the same navy. */}
      <section className="bg-[#172554] text-white border-b border-white/10">
        <div className={`${CONTAINER} flex flex-col items-start gap-7 py-16 sm:py-[72px] md:flex-row md:items-center md:justify-between`}>
          <div className="flex flex-col gap-2.5">
            <h2 className="font-heading text-[30px] sm:text-[36px] font-extrabold leading-[1.15]">Ready to get your leaflets printed?</h2>
            <p className="text-[18px] text-[#dbeafe]">Tell us what you need and where, and we will come back to you with a quote.</p>
          </div>
          <Link href={QUOTE_HREF} className={CLOSING_BUTTON}>
            Get a Free Quote
          </Link>
        </div>
      </section>
    </div>
  );
}
