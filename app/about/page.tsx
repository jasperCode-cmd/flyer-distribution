import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { AREA_PAGES } from "@/lib/area-pages";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "Flyer Distribution Hampshire is an independent marketing and leaflet distribution company based in Hampshire, co-founded by Jasper and Daniel.",
  alternates: {
    canonical: "https://www.flyerdistributionhampshire.co.uk/about",
  },
  openGraph: {
    title: "About Us",
    description:
      "Flyer Distribution Hampshire is an independent marketing and leaflet distribution company based in Hampshire, co-founded by Jasper and Daniel.",
    url: "https://www.flyerdistributionhampshire.co.uk/about",
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
    title: "About Us",
    description:
      "Flyer Distribution Hampshire is an independent marketing and leaflet distribution company based in Hampshire, co-founded by Jasper and Daniel.",
    images: [
      "https://images.pexels.com/photos/35110918/pexels-photo-35110918.jpeg?auto=compress&cs=tinysrgb&w=1200",
    ],
  },
};

// How many areas we cover: one per area page, from the shared area data.
const AREAS_COVERED = Object.keys(AREA_PAGES).length;

const PILLS = ["Rated 5.0 on Google", `${AREAS_COVERED} areas covered`, "Quote within 24 hours"];

const FOUNDERS = [
  {
    initial: "J",
    name: "Jasper",
    text: "University of Southampton graduate. Jasper looks after operations, campaign planning, route reports, websites and SEO.",
  },
  {
    initial: "D",
    name: "Dan",
    text: "Bournemouth University graduate. Dan is your first call: he talks through your campaign, builds your quote and helps choose the best areas.",
  },
];

const PROMISES = [
  {
    number: "01",
    title: "Reliability",
    text: "We are a small team and our reputation depends on every round being completed. When we take on a campaign, it gets delivered.",
  },
  {
    number: "02",
    title: "Local knowledge",
    text: "We know the areas, postcodes and communities of Hampshire and Dorset, and that local knowledge makes a real difference.",
  },
  {
    number: "03",
    title: "Transparency",
    text: "No hidden costs, no vague timelines. A clear quote, updates throughout, and a route report when your campaign is complete.",
  },
];

// The last section: where to go next on the left, every service on the right.
// Line icons in the site's style (the paper plane, website and screen ones
// are the quote form's).
const ICON_PATHS = {
  plane: <path d="M21.5 2.5 2.5 10l7 3 3 7 9-17.5ZM9.5 13 15 8.5" />,
  map: (
    <>
      <path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z" />
      <path d="M8 2v16M16 6v16" />
    </>
  ),
  personPlus: (
    <>
      <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <path d="M20 8v6M23 11h-6" />
    </>
  ),
  web: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M6.5 6.5h.01M9 6.5h.01M7.5 13h9M7.5 16h5.5" />
    </>
  ),
  screen: (
    <>
      <rect x="3" y="2.5" width="18" height="11" rx="1.5" />
      <path d="M12 13.5V17M3.5 17h16M19.5 17h2" />
      <circle cx="8" cy="19.5" r="1.5" />
      <circle cx="15" cy="19.5" r="1.5" />
    </>
  ),
};

function LineIcon({ name, className }: { name: keyof typeof ICON_PATHS; className: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      {ICON_PATHS[name]}
    </svg>
  );
}

function ArrowIcon({ className }: { className: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

const WHERE_NEXT = [
  { title: "Want to see our work?", text: "Real campaigns, with the areas we covered", href: "/case-studies", icon: "map" as const },
  { title: "Want to join the team?", text: "Flexible, local leaflet delivery work", href: "/leaflet-distribution-jobs", icon: "personPlus" as const },
];

const LEAFLET_PILLS = [
  { label: "Distribution", href: "/leaflet-delivery" },
  { label: "Printing", href: "/leaflet-printing" },
  { label: "Public Notice", href: "/services/public-notice-leafleting" },
  { label: "Hand-to-Hand", href: "/services/hand-to-hand-distribution" },
  { label: "B2B", href: "/services/b2b-distribution" },
];

const OTHER_SERVICES = [
  { title: "Web Design & SEO", text: "Bespoke websites and SEO for local businesses", href: "/services/web-design-seo", icon: "web" as const },
  { title: "Screen Hire", text: "Mobile LED screen trailer for events and advertising", href: "/services/screen-hire", icon: "screen" as const },
];

const LIFT = "transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2";

export default function AboutPage() {
  return (
    <>
      {/* 1. Hero */}
      <section className="bg-white pt-14 pb-10 lg:pt-20 lg:pb-12">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-[#1d4ed8]">About us</p>
          <h1 className="mt-3 text-4xl sm:text-5xl font-extrabold leading-tight text-[#1e3a8a]">Hi, we are Jasper and Dan.</h1>
          <p className="mt-5 text-lg sm:text-xl text-gray-600 leading-relaxed">
            We run Flyer Distribution Hampshire, a local leaflet distribution company covering Hampshire and Dorset. When you work
            with us, you deal with us directly.
          </p>
        </div>
      </section>

      {/* 2. The photo, whole at its own 3:4 (never cropped, so the leaflets in
          its bottom-left corner show), beside the panel; stacked on phones. */}
      <section className="bg-white pb-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="overflow-hidden rounded-[22px] bg-[#1e3a8a] md:flex">
            <div className="md:w-[340px] lg:w-[450px] md:shrink-0">
              <Image
                src="/Flyer%20Distribution%20Hampshire.webp"
                alt="Flyer Distribution Hampshire leaflets in hand on a delivery round in a Hampshire village"
                width={1200}
                height={1600}
                sizes="(min-width: 1024px) 450px, (min-width: 768px) 340px, calc(100vw - 32px)"
                priority
                className="block h-auto w-full"
              />
            </div>
            <div className="flex flex-1 flex-col justify-center px-6 py-9 sm:px-10 sm:py-12 lg:px-14 text-white">
              <p className="text-sm font-semibold uppercase tracking-widest text-[#facc15]">Out on a round</p>
              <p className="mt-3 font-heading text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight">
                Our own team, our own rounds, and proof of every one.
              </p>
              <p className="mt-5 text-base sm:text-lg text-[#dbeafe] leading-relaxed">
                Every campaign is delivered by our local, vetted team and GPS tracked, so you get a route report showing exactly which
                rounds we completed for you.
              </p>
              <ul className="mt-7 flex flex-wrap gap-2.5">
                {PILLS.map((pill) => (
                  <li key={pill} className="rounded-full bg-[#172554] px-4 py-2 text-sm font-semibold text-white">
                    {pill}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 3. The founders */}
      <section className="bg-white pb-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="sr-only">The founders</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {FOUNDERS.map((f) => (
              <div key={f.name} className="rounded-2xl border border-gray-200 bg-[#f8fafc] p-6 sm:p-8">
                <div className="flex items-center gap-4">
                  <span
                    aria-hidden="true"
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#1e3a8a] font-heading text-2xl font-bold text-[#facc15]"
                  >
                    {f.initial}
                  </span>
                  <div>
                    <h3 className="text-2xl font-bold text-[#1e3a8a]">{f.name}</h3>
                    <p className="mt-0.5 text-sm font-semibold text-[#1d4ed8]">Co-Founder</p>
                  </div>
                </div>
                <p className="mt-5 text-base text-gray-600 leading-[1.8]">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. What we promise */}
      <section className="bg-[#1e3a8a] text-white py-16 lg:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold">What we promise every client</h2>
          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-10">
            {PROMISES.map((p) => (
              <div key={p.title} className="border-t-4 border-[#facc15] pt-5">
                <p className="font-heading text-sm font-bold tracking-widest text-[#facc15]">{p.number}</p>
                <h3 className="mt-2 text-xl font-bold">{p.title}</h3>
                <p className="mt-3 text-base text-[#dbeafe] leading-relaxed">{p.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Where next, beside every service: one section in place of Our Services and the next steps. */}
      <section className="bg-[#f8fafc] py-16 sm:py-[88px]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
          {/* Left: the next step, then two more places to go. */}
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-[#1d4ed8]">Where next?</p>
            <h2 className="mt-3 font-heading text-[34px] sm:text-[44px] font-extrabold leading-[1.1] text-[#172554]">Planning a campaign?</h2>
            <p className="mt-4 text-[18px] leading-relaxed text-[#374151]">
              Tell us what you need and where, and get a free quote within 24 hours.
            </p>
            <Link
              href="/quote?service=leaflet"
              className="mt-7 inline-block bg-yellow-400 hover:bg-yellow-300 text-blue-900 font-bold px-7 py-3.5 rounded-md transition duration-200 ease-out hover:scale-105 shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              Get a Free Quote
            </Link>
            <ul className="mt-7 space-y-3">
              {WHERE_NEXT.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className={`group flex items-center gap-4 rounded-[14px] border border-[#e2e8f0] bg-white p-4 ${LIFT}`}>
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#dbeafe] text-[#1d4ed8]">
                      <LineIcon name={item.icon} className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold text-[#172554]">{item.title}</span>
                      <span className="block text-sm text-[#374151]">{item.text}</span>
                    </span>
                    <ArrowIcon className="h-5 w-5 shrink-0 text-[#1d4ed8] transition-transform duration-200 group-hover:translate-x-1" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Right: every service. */}
          <div className="rounded-[24px] border border-[#e2e8f0] bg-white p-6 shadow-[0_18px_40px_-20px_rgba(15,23,42,0.25)] sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Our services</p>
            {/* Leaflet services: its title and each pill are links of their own (links can't nest). */}
            <div className="mt-4 rounded-2xl bg-[#1e3a8a] p-5 text-white sm:p-6">
              <div className="flex items-start gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#172554] text-[#facc15]">
                  <LineIcon name="plane" className="h-6 w-6" />
                </span>
                <div className="min-w-0">
                  <h3 className="font-heading text-[22px] font-extrabold leading-tight">
                    <Link href="/leaflet-delivery" className="inline-flex min-h-10 items-center underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15]">
                      Leaflet services &rarr;
                    </Link>
                  </h3>
                  <p className="mt-1.5 text-[#dbeafe]">Door to door across Hampshire and Dorset, GPS tracked. Design and print too.</p>
                </div>
              </div>
              <ul className="mt-5 flex flex-wrap gap-2">
                {LEAFLET_PILLS.map((pill) => (
                  <li key={pill.href}>
                    <Link
                      href={pill.href}
                      className="inline-flex min-h-10 items-center rounded-full bg-white px-4 text-[13px] font-bold text-[#1e3a8a] transition-colors hover:bg-[#dbeafe] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15]"
                    >
                      {pill.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            {/* The other two, each one link, divided by a line. */}
            <ul className="mt-2 divide-y divide-[#e2e8f0]">
              {OTHER_SERVICES.map((svc) => (
                <li key={svc.href}>
                  <Link href={svc.href} className="group flex items-center gap-4 rounded-lg px-1 py-4 transition-colors hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#dbeafe] text-[#1d4ed8]">
                      <LineIcon name={svc.icon} className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg font-bold leading-snug text-[#172554]">{svc.title}</h3>
                      <p className="text-sm text-[#374151]">{svc.text}</p>
                    </div>
                    <ArrowIcon className="h-5 w-5 shrink-0 text-[#1d4ed8] transition-transform duration-200 group-hover:translate-x-1" />
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-2 border-t border-[#e2e8f0] pt-4">
              <Link href="/services" className="inline-flex min-h-10 items-center font-bold text-[#1d4ed8] underline-offset-4 hover:text-[#172554] hover:underline">
                View all services &rarr;
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
