import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

// Door to door leaflet delivery: the page the Services menu's Leaflet
// Distribution item opens. Built to the leaflet delivery design: its 1200px
// container, 88px sections, type sizes, colours, corners and cards (the
// design's flex and grid rules, so it wraps where the design does). On phones
// (below 640px) the headings and section padding are smaller, as on
// /leaflet-printing: the H1 36px, H2s 32px (30px for the 36px ones), 64px
// sections.
// Facts only: no prices, no turnaround times, and the print supplier is never
// named. The Royal Mail figures and the review are copied word for word from
// the homepage (components/StatsBar.tsx and components/Testimonials.tsx).

const SITE = "https://www.flyerdistributionhampshire.co.uk";
const PAGE_URL = `${SITE}/leaflet-delivery`;
const DESCRIPTION =
  "Door to door leaflet delivery across Hampshire and Dorset by our own local team. GPS tracked rounds, a route report at the end, and printing if you need it.";
const OG_IMAGE = "https://images.pexels.com/photos/35110918/pexels-photo-35110918.jpeg?auto=compress&cs=tinysrgb&w=1200";
// Preselects Leaflet Distribution on the quote form.
const QUOTE_HREF = "/quote?service=leaflet";
// The same Google Business Profile the homepage's rating line links to.
const GOOGLE_PROFILE = "https://share.google/RVxyPi4TzXAzkt1Am";

export const metadata: Metadata = {
  // With the site's template: "Leaflet Delivery Hampshire & Dorset | Flyer Distribution Hampshire".
  title: "Leaflet Delivery Hampshire & Dorset",
  description: DESCRIPTION,
  alternates: {
    canonical: PAGE_URL,
  },
  openGraph: {
    title: "Leaflet Delivery Hampshire & Dorset | Flyer Distribution Hampshire",
    description: DESCRIPTION,
    url: PAGE_URL,
    siteName: "Flyer Distribution Hampshire",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "Flyer Distribution Hampshire" }],
    locale: "en_GB",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Leaflet Delivery Hampshire & Dorset | Flyer Distribution Hampshire",
    description: DESCRIPTION,
    images: [OG_IMAGE],
  },
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE },
    { "@type": "ListItem", position: 2, name: "Leaflet Delivery", item: PAGE_URL },
  ],
};

const serviceSchema = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Leaflet Delivery",
  serviceType: "Leaflet delivery",
  description: DESCRIPTION,
  url: PAGE_URL,
  // The site-wide LocalBusiness, from components/SiteSchema.tsx.
  provider: { "@id": `${SITE}/#business` },
  areaServed: [
    { "@type": "AdministrativeArea", name: "Hampshire" },
    { "@type": "AdministrativeArea", name: "Dorset" },
  ],
};

// The design's measures: a centred 1200px container with 24px sides, 88px
// above and below each section (64px on phones), 40px headings in #172554
// (32px on phones), body text at a 1.6 line height, card titles in the body font.
const CONTAINER = "mx-auto w-full max-w-[1200px] px-6";
const SECTION = "py-16 sm:py-[88px]";
const H2 = "font-heading text-[32px] sm:text-[40px] font-extrabold leading-[1.1] text-[#172554]";
const INTRO = "text-[18px] text-[#374151]";
const H3 = "font-sans font-bold";
// The hero's buttons: the yellow one 56px tall, the outlined one 56px plus its 2px border (as in the design),
// side by side the same height; 12px corners, 17px bold. The closing band's button is 56px, 18px.
const YELLOW_BUTTON =
  "inline-flex min-h-[56px] items-center rounded-[12px] bg-[#facc15] px-[26px] text-[17px] font-bold text-[#172554] transition duration-200 ease-out hover:scale-105 hover:bg-yellow-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#1e3a8a]";
const OUTLINE_BUTTON =
  "inline-flex min-h-[60px] items-center rounded-[12px] border-2 border-[#dbeafe] px-[22px] text-[17px] font-bold text-white transition duration-200 ease-out hover:scale-105 hover:bg-white hover:text-[#1e3a8a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#1e3a8a]";
const CLOSING_BUTTON =
  "inline-flex min-h-[56px] shrink-0 items-center rounded-[12px] bg-[#facc15] px-[30px] text-[18px] font-bold text-[#172554] transition duration-200 ease-out hover:scale-105 hover:bg-yellow-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#1e3a8a]";
const IN_TEXT_LINK = "text-[#1d4ed8] underline hover:text-[#172554]";
// A card's link on a white card, and on a navy one.
const CARD_LINK = "inline-flex items-center gap-1.5 font-bold text-[#1d4ed8] hover:text-[#172554] underline-offset-4 hover:underline";
const CARD_LINK_ON_NAVY = "inline-flex items-center gap-1.5 font-bold text-[#facc15] hover:text-yellow-200 underline-offset-4 hover:underline";
const BADGE = "rounded-full bg-[#facc15] px-2.5 py-1 text-[12px] font-bold text-[#172554]";
const STAR = "M12 2.5l2.9 6.06 6.6.87-4.83 4.6 1.24 6.6L12 17.5l-5.91 3.13 1.24-6.6-4.83-4.6 6.6-.87L12 2.5z";

const Arrow = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

// Line icons, drawn on a 24px grid.
const Icon = ({ children, className }: { children: React.ReactNode; className: string }) => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);

const Stars = ({ className }: { className: string }) => (
  <svg role="img" aria-label="5 out of 5 stars" viewBox="0 0 120 24" className={className}>
    {[0, 1, 2, 3, 4].map((i) => (
      <path key={i} d={STAR} transform={`translate(${i * 24} 0)`} />
    ))}
  </svg>
);

// The homepage's three Royal Mail figures, word for word (components/StatsBar.tsx).
const STATS = [
  { figure: "92%", label: "of people who receive a door drop read it" },
  { figure: "74%", label: "of door drops are opened, read, filed or set aside for later" },
  { figure: "4 in 5", label: "door drop items are engaged with" },
];

const DOOR_TO_DOOR_POINTS = [
  {
    title: "Targeted postcodes.",
    text: "Choose your postcodes, or we'll suggest the ones most likely to respond.",
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1" />
      </>
    ),
  },
  {
    title: "GPS tracked rounds.",
    text: "Every round is recorded as it's walked.",
    icon: (
      <>
        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
        <circle cx="12" cy="10" r="3" />
      </>
    ),
  },
  {
    title: "Route report.",
    text: "You see the areas we covered when your campaign is complete.",
    icon: (
      <>
        <path d="M9 20l-6-3V4l6 3 6-3 6 3v13l-6-3-6 3Z" />
        <path d="M9 7v13M15 4v13" />
      </>
    ),
  },
];

// The other ways we deliver: the first three link to their pages; vehicle distribution has no page yet,
// so its card asks about it on the quote form, and other pages link to the card (its id).
const OTHER_METHODS: { title: string; text: string; href: string; cta: string; whole: boolean; id?: string; icon: React.ReactNode }[] = [
  {
    title: "Hand-to-Hand Distribution",
    text: "Face to face at shopping centres, town centres and events.",
    href: "/services/hand-to-hand-distribution",
    cta: "Learn more",
    whole: true,
    icon: (
      <>
        <path d="M18 11V6a2 2 0 0 0-4 0v1" />
        <path d="M14 10V4a2 2 0 0 0-4 0v2" />
        <path d="M10 10.5V6a2 2 0 0 0-4 0v8" />
        <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-6-2.4l-3.6-3.6a2 2 0 0 1 2.8-2.8L7 15" />
      </>
    ),
  },
  {
    title: "B2B Leaflet Distribution",
    text: "Straight to offices, business parks and commercial areas.",
    href: "/services/b2b-distribution",
    cta: "Learn more",
    whole: true,
    icon: (
      <>
        <rect x="4" y="2" width="16" height="20" rx="2" />
        <path d="M9 22v-4h6v4" />
        <path d="M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01" />
      </>
    ),
  },
  {
    title: "Public Notice Leafleting",
    text: "Road closures, works and statutory consultations.",
    href: "/services/public-notice-leafleting",
    cta: "Learn more",
    whole: true,
    icon: (
      <>
        <path d="M3 11v2a1 1 0 0 0 1 1h3l5 4V6L7 10H4a1 1 0 0 0-1 1Z" />
        <path d="M16 9a4 4 0 0 1 0 6" />
        <path d="M19 6a8 8 0 0 1 0 12" />
      </>
    ),
  },
  {
    title: "Vehicle Leaflet Distribution",
    text: "On parked cars in car parks, retail areas and busy spots.",
    href: QUOTE_HREF,
    cta: "Ask about it",
    whole: false,
    id: "vehicle-leaflet-distribution",
    icon: (
      <>
        <path d="M5 17h14l-1.5-6h-11Z" />
        <path d="M7 11l1.5-4h7L17 11" />
        <circle cx="7.5" cy="17.5" r="1.5" />
        <circle cx="16.5" cy="17.5" r="1.5" />
      </>
    ),
  },
];

const STEPS = [
  {
    title: "Plan it with us",
    text: "A free call to agree your areas, quantity and timing. Not sure where to start? We'll plan the campaign around your goals.",
  },
  { title: "Get them printed", text: "Send us your leaflets, or we'll design and print them for you." },
  { title: "We deliver", text: "Our own team walks the rounds, every one GPS tracked." },
  { title: "You get the proof", text: "A route report showing the areas covered once your campaign is complete." },
];

// Two whole sentences, word for word, from Auriel Cochrane's Google review in components/Testimonials.tsx.
const REVIEW = {
  quote:
    "Really pleased with the service! Everything was handled efficiently, and the flyers were distributed exactly within the area I wanted to target.",
  name: "Auriel Cochrane",
  label: "Google Review",
};

// The area pages, in the four groups the homepage and /areas use (AREA_REGIONS in lib/area-search.ts).
const AREA_GROUPS: { label: string; towns: [name: string, slug: string][] }[] = [
  {
    label: "Southampton & Eastleigh",
    towns: [
      ["Southampton", "southampton"],
      ["Eastleigh", "eastleigh"],
      ["Chandler's Ford", "chandlers-ford"],
      ["Hedge End", "hedge-end"],
    ],
  },
  {
    label: "Winchester & Test Valley",
    towns: [
      ["Winchester", "winchester"],
      ["Romsey", "romsey"],
    ],
  },
  {
    label: "New Forest & Waterside",
    towns: [
      ["New Forest", "new-forest"],
      ["Totton", "totton"],
      ["Hythe", "hythe"],
      ["Lymington", "lymington"],
      ["Brockenhurst", "brockenhurst"],
      ["Ringwood", "ringwood"],
    ],
  },
  {
    label: "Bournemouth, Poole & Dorset",
    towns: [
      ["Bournemouth", "bournemouth"],
      ["Poole", "poole"],
      ["Christchurch", "christchurch"],
      ["Dorset", "dorset"],
    ],
  },
];

const FAQS: { q: string; a: React.ReactNode }[] = [
  {
    q: "How do I know my leaflets were delivered?",
    a: "Every round is GPS tracked, and when your campaign is complete we send you a route report showing the areas we covered.",
  },
  {
    q: "Can I choose exactly where my leaflets go?",
    a: "Yes. Tell us the postcodes or areas you want and we'll plan the rounds around them. Not sure? We'll suggest the areas most likely to respond.",
  },
  { q: "Who delivers my leaflets?", a: "Our own local team across Hampshire and Dorset." },
  {
    q: "Can you print them as well?",
    a: (
      <>
        Yes. Choose Print and Deliver, or Design, Print and Deliver if you need the artwork too. See{" "}
        <Link href="/leaflet-printing" className={IN_TEXT_LINK}>
          leaflet printing
        </Link>
        .
      </>
    ),
  },
  {
    q: "Do you deliver outside Hampshire and Dorset?",
    a: "We deliver from Winchester to Poole and everywhere in between. If you're just outside, ask us and we'll let you know.",
  },
];

export default function LeafletDeliveryPage() {
  return (
    <div className="bg-white leading-[1.6] text-[#1f2937]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }} />

      {/* 1. Hero: the breadcrumb, then the copy beside the photo (the photo below it once they no longer fit side by side) */}
      <section className="bg-[#1e3a8a] text-white">
        <div className={`${CONTAINER} pt-7 pb-16 sm:pb-[72px]`}>
          <nav aria-label="Breadcrumb" className="mb-9 text-[14px] text-[#dbeafe]">
            <ol className="flex flex-wrap items-center gap-x-1">
              <li>
                <Link href="/" className="underline hover:text-white">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <span className="font-bold text-white" aria-current="page">
                  Leaflet Delivery
                </span>
              </li>
            </ol>
          </nav>
          <div className="flex flex-wrap items-center gap-12">
            <div className="flex min-w-0 flex-[1_1_480px] flex-col gap-[22px]">
              <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-[#facc15]">Door to door across Hampshire and Dorset</p>
              <h1 className="font-heading text-[36px] sm:text-[56px] font-extrabold leading-[1.05]">Leaflet Delivery in Hampshire and Dorset</h1>
              <p className="max-w-[580px] text-[20px] text-[#dbeafe]">
                Our own local team delivers your leaflets through letterboxes in the postcodes you choose. Every round is GPS tracked, and you
                get a route report when your campaign is complete.
              </p>
              <div className="mt-1.5 flex flex-wrap gap-3.5">
                <Link href={QUOTE_HREF} className={YELLOW_BUTTON}>
                  Get a Free Quote
                </Link>
                <a href="#how-it-works" className={OUTLINE_BUTTON}>
                  See how it works
                </a>
              </div>
              {/* The Google rating as the homepage shows it: the stars and a plain line, linking to the reviews,
                  with a tap area at least 44px tall. The negative margins let that area overlap the gap above
                  and the space below, so the line sits where the design's 24px line does (4px under the buttons). */}
              <a
                href={GOOGLE_PROFILE}
                target="_blank"
                rel="noopener"
                className="-mt-1.5 -mb-2.5 flex w-fit max-w-full min-h-11 items-center gap-2 rounded-sm text-sm text-[#dbeafe] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#facc15]"
              >
                <Stars className="h-3.5 w-auto shrink-0 fill-[#facc15]" />
                <span>Rated 5.0 on Google by local businesses</span>
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </div>
            {/* 400px tall, 20px corners and a deep shadow; 522px wide beside the copy at full width. */}
            <Image
              src="/images/leaflet-delivery-hero.webp"
              alt="Leaflets posted through a letterbox"
              width={1600}
              height={1200}
              priority
              sizes="(min-width: 1200px) 522px, (min-width: 996px) calc(50vw - 78px), calc(100vw - 48px)"
              className="h-[400px] min-w-0 flex-[1_1_420px] rounded-[20px] object-cover shadow-[0_24px_48px_rgba(15,23,42,0.35)]"
            />
          </div>
        </div>
      </section>

      {/* 2. The Royal Mail figures */}
      <section className="border-b border-[#e2e8f0] bg-[#f8fafc]">
        <div className={`${CONTAINER} flex flex-wrap items-center gap-6 py-10`}>
          {STATS.map((s) => (
            <div key={s.figure} className="flex flex-[1_1_200px] flex-col">
              <span className="font-heading text-[44px] font-extrabold leading-none text-[#1e3a8a]">{s.figure}</span>
              <span className="text-[#374151]">{s.label}</span>
            </div>
          ))}
          <p className="flex-none self-end text-[13px] text-[#4b5563]">Source: Royal Mail</p>
        </div>
      </section>

      {/* 3. How we deliver: door to door in a navy card, then the four other methods */}
      <section className={`bg-white ${SECTION}`}>
        <div className={`${CONTAINER} flex flex-col gap-9`}>
          <div className="flex max-w-[720px] flex-col gap-3">
            <h2 className={H2}>How we deliver your leaflets</h2>
            <p className={INTRO}>
              Most campaigns go door to door. For events, car parks, local businesses and public notices, we have a delivery method built for
              the job.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-10 rounded-[24px] bg-[#1e3a8a] p-10 text-white">
            <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-3.5">
              <span className={`self-start ${BADGE}`}>Most campaigns start here</span>
              <h3 className="font-heading text-[32px] font-extrabold leading-[1.15]">Door to door leaflet delivery</h3>
              <p className="text-[18px] text-[#dbeafe]">
                We deliver your leaflets through letterboxes across the areas you choose, planned round by round to cover the homes in your
                chosen areas.
              </p>
            </div>
            <ul className="flex min-w-0 flex-[1_1_360px] flex-col gap-3.5">
              {DOOR_TO_DOOR_POINTS.map((p) => (
                <li key={p.title} className="flex items-start gap-3.5 rounded-[14px] bg-[#172554] px-[18px] py-4">
                  <Icon className="h-6 w-6 shrink-0 text-[#facc15]">{p.icon}</Icon>
                  <span>
                    <strong>{p.title}</strong> {p.text}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <ul className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4">
            {OTHER_METHODS.map((m) => {
              const inside = (
                <>
                  <span className="flex h-12 w-12 items-center justify-center rounded-[12px] bg-[#eff6ff] text-[#1d4ed8]">
                    <Icon className="h-6 w-6">{m.icon}</Icon>
                  </span>
                  <h3 className={`${H3} text-[19px] text-[#172554]`}>{m.title}</h3>
                  <p className="flex-[1_1_auto] text-[#4b5563]">{m.text}</p>
                </>
              );
              const card = "flex flex-1 flex-col gap-2.5 rounded-[18px] border border-[#e2e8f0] bg-white p-6";
              return (
                <li key={m.title} id={m.id} className={m.id ? "flex scroll-mt-24" : "flex"}>
                  {m.whole ? (
                    <Link
                      href={m.href}
                      className={`group ${card} transition-colors hover:border-[#bfdbfe] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d4ed8] focus-visible:ring-offset-2`}
                    >
                      {inside}
                      <span className="inline-flex items-center gap-1.5 self-start font-bold text-[#1d4ed8] underline-offset-4 group-hover:underline">
                        {m.cta} <Arrow />
                      </span>
                    </Link>
                  ) : (
                    <div className={card}>
                      {inside}
                      <Link href={m.href} className={`self-start ${CARD_LINK}`}>
                        {m.cta} <Arrow />
                      </Link>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* 4. Need them printed too? The two packages (linkable by id) and printing on its own */}
      <section className={`bg-[#f8fafc] ${SECTION}`}>
        <div className={`${CONTAINER} flex flex-col gap-8`}>
          <div className="flex max-w-[720px] flex-col gap-3">
            <h2 className={H2}>Need them printed too?</h2>
            <p className={INTRO}>Bring your own leaflets, or let us print them and deliver them in one go.</p>
          </div>
          <ul className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-5">
            <li id="design-print-deliver" className="relative flex scroll-mt-24 flex-col gap-3 rounded-[20px] bg-[#1e3a8a] p-[30px] text-white">
              <span className={`absolute right-5 top-5 ${BADGE}`}>Most popular</span>
              {/* Kept clear of the badge, so the title wraps rather than run under it. */}
              <h3 className="pr-[84px] font-heading text-[24px] font-extrabold">Design, Print and Deliver</h3>
              <p className="flex-[1_1_auto] text-[#dbeafe]">
                We design your leaflet, print it and deliver it across your chosen areas. One campaign, one team, start to finish.
              </p>
              <Link href={QUOTE_HREF} className={`self-start ${CARD_LINK_ON_NAVY}`}>
                Get a quote <Arrow />
              </Link>
            </li>
            <li id="print-and-deliver" className="flex scroll-mt-24 flex-col gap-3 rounded-[20px] border border-[#e2e8f0] bg-white p-[30px]">
              <h3 className="font-heading text-[24px] font-extrabold text-[#172554]">Print and Deliver</h3>
              <p className="flex-[1_1_auto] text-[#374151]">Artwork ready? We print it in A6, A5, A4 or DL and deliver it through letterboxes.</p>
              <Link href={QUOTE_HREF} className={`self-start ${CARD_LINK}`}>
                Get a quote <Arrow />
              </Link>
            </li>
            <li className="flex flex-col gap-3 rounded-[20px] border border-[#e2e8f0] bg-white p-[30px]">
              <h3 className="font-heading text-[24px] font-extrabold text-[#172554]">Just the printing</h3>
              <p className="flex-[1_1_auto] text-[#374151]">
                Flyers, folded leaflets and business cards, delivered to your door. Build your spec online.
              </p>
              <Link href="/leaflet-printing" className={`self-start ${CARD_LINK}`}>
                See leaflet printing <Arrow />
              </Link>
            </li>
          </ul>
        </div>
      </section>

      {/* 5. How it works: four numbered steps, each under a yellow rule (the hero's "See how it works" comes here) */}
      <section id="how-it-works" className={`scroll-mt-16 bg-white ${SECTION}`}>
        <div className={`${CONTAINER} flex flex-col gap-9`}>
          <h2 className={H2}>How it works</h2>
          <ol className="grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-5">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex flex-col gap-2 border-t-[3px] border-[#facc15] pt-[18px]">
                <span className="text-[13px] font-bold text-[#b45309]">{String(i + 1).padStart(2, "0")}</span>
                <h3 className={`${H3} text-[20px] text-[#172554]`}>{s.title}</h3>
                <p className="text-[#374151]">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 6. Proof: a real GPS tracked round beside the copy and one real review */}
      <section className={`bg-[#f8fafc] ${SECTION}`}>
        <div className={`${CONTAINER} flex flex-wrap items-stretch gap-8`}>
          <figure className="flex min-w-0 flex-[1_1_420px] flex-col gap-2.5">
            <Image
              src="/images/bitterne-park-route.webp"
              alt="GPS tracked leaflet delivery route in Bitterne Park, Southampton"
              width={1200}
              height={1449}
              sizes="(min-width: 1200px) 560px, (min-width: 920px) calc(50vw - 40px), calc(100vw - 48px)"
              className="h-[462px] w-full rounded-[20px] border border-[#e2e8f0] object-cover"
            />
            <figcaption className="text-[14px] text-[#4b5563]">A GPS tracked round in Bitterne Park, Southampton</figcaption>
          </figure>
          <div className="flex min-w-0 flex-[1_1_420px] flex-col justify-center gap-[18px]">
            <h2 className="font-heading text-[30px] sm:text-[36px] font-extrabold leading-[1.1] text-[#172554]">Proof your leaflets went out</h2>
            <p className={INTRO}>Every round is GPS tracked, so at the end of your campaign you can see exactly which areas we covered.</p>
            <figure className="rounded-[16px] border border-[#e2e8f0] bg-white p-[22px]">
              <div className="mb-2 flex h-[26px] items-center">
                <Stars className="h-[18px] w-auto fill-[#b45309]" />
              </div>
              <blockquote className="text-[17px] text-[#1f2937]">&ldquo;{REVIEW.quote}&rdquo;</blockquote>
              <figcaption className="mt-2.5 font-bold text-[#172554]">
                {REVIEW.name}, {REVIEW.label}
              </figcaption>
            </figure>
            <Link href="/case-studies" className={`self-start ${CARD_LINK}`}>
              See our case studies <Arrow />
            </Link>
          </div>
        </div>
      </section>

      {/* 7. Where we deliver: every area page, in its group */}
      <section className={`bg-white ${SECTION}`}>
        <div className={`${CONTAINER} flex flex-col gap-7`}>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex max-w-[680px] flex-col gap-2.5">
              <h2 className={H2}>Where we deliver</h2>
              <p className={INTRO}>From Winchester in the north to Poole in the west. Pick your area to see its postcodes and homes.</p>
            </div>
            <Link href="/areas" className={CARD_LINK}>
              See all areas <Arrow />
            </Link>
          </div>
          <ul className="grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-4">
            {AREA_GROUPS.map((g) => (
              <li key={g.label} className="flex flex-col gap-2.5 rounded-[16px] border border-[#e2e8f0] p-5">
                <h3 className={`${H3} text-[12px] uppercase tracking-[0.12em] text-[#1d4ed8]`}>{g.label}</h3>
                <ul className="flex flex-col gap-2.5">
                  {g.towns.map(([name, slug]) => (
                    <li key={slug}>
                      <Link
                        href={`/areas/leaflet-distribution-${slug}`}
                        className="flex w-fit items-center gap-1.5 font-bold text-[#172554] underline-offset-4 hover:underline"
                      >
                        {name} <Arrow />
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 8. Leaflet delivery questions: the intro beside the questions, the first open (no FAQ schema) */}
      <section className={`bg-[#f8fafc] ${SECTION}`}>
        <div className={`${CONTAINER} flex flex-wrap gap-12`}>
          <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-3">
            <h2 className={H2}>Leaflet delivery questions</h2>
            <p className={INTRO}>
              More answers on our{" "}
              <Link href="/faq" className={IN_TEXT_LINK}>
                FAQ page
              </Link>
              .
            </p>
          </div>
          <div className="flex min-w-0 flex-[2_1_520px] flex-col">
            {FAQS.map((f, i) => (
              <details key={f.q} open={i === 0} className="border-b border-[#e2e8f0] py-5">
                <summary className="cursor-pointer rounded text-[19px] font-bold text-[#172554] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                  <h3 className="inline font-sans">{f.q}</h3>
                </summary>
                <p className="mt-3 text-[#374151]">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* 9. Closing band: a navy card, the heading on the left and the yellow button on the right (below it once they no longer fit) */}
      <section className="bg-white">
        <div className={`${CONTAINER} py-16 sm:pt-[72px] sm:pb-[88px]`}>
          <div className="flex flex-wrap items-center justify-between gap-6 rounded-[24px] bg-[#1e3a8a] p-12 text-white">
            <div className="flex min-w-0 flex-[1_1_460px] flex-col gap-2.5">
              <h2 className="font-heading text-[30px] sm:text-[36px] font-extrabold leading-[1.15]">Ready to get your leaflets out?</h2>
              <p className="text-[18px] text-[#dbeafe]">Tell us your areas and quantity, and we&apos;ll come back to you with a quote.</p>
            </div>
            <Link href={QUOTE_HREF} className={CLOSING_BUTTON}>
              Get a Free Quote
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
