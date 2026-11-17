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

const NEXT_STEPS = [
  { title: "Planning a campaign?", text: "Get a free quote within 24 hours", href: "/quote?service=leaflet" },
  { title: "Want to see our work?", text: "Real campaigns, with the areas we covered", href: "/case-studies" },
  { title: "Want to join the team?", text: "Flexible, local leaflet delivery work", href: "/leaflet-distribution-jobs" },
];

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

      <section className="bg-slate-50 py-16 border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-blue-900 mb-3">
            Our Services
          </h2>
          <p className="text-gray-600 mb-8 text-lg">
            From leaflet distribution to web design and mobile screen hire, we offer a range of marketing solutions for local businesses.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                title: "Leaflet Services",
                desc: "Door-to-door distribution, targeted postcode campaigns, design and print.",
                href: "/services",
              },
              {
                title: "Web Design & SEO",
                desc: "Bespoke websites and search engine optimisation for local businesses.",
                href: "/services/web-design-seo",
              },
              {
                title: "Screen Hire",
                desc: "Mobile LED screen trailer hire for events and advertising across Hampshire and Dorset.",
                href: "/services/screen-hire",
              },
            ].map((svc) => (
              <Link
                key={svc.title}
                href={svc.href}
                className="border border-gray-200 rounded-lg p-6 bg-white hover:border-blue-400 hover:shadow-md transition-all block"
              >
                <h3 className="text-base font-semibold text-blue-900 mb-2">
                  {svc.title}
                </h3>
                <p className="text-gray-600 text-base leading-relaxed">{svc.desc}</p>
                <span className="mt-3 inline-block text-blue-600 text-xs font-semibold">
                  View service →
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Next steps */}
      <section className="bg-white py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="sr-only">Next steps</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {NEXT_STEPS.map((step) => (
              <Link
                key={step.href}
                href={step.href}
                className="group flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all duration-300 ease-out hover:-translate-y-1 hover:border-blue-400 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
              >
                <h3 className="text-xl font-bold text-[#1e3a8a]">{step.title}</h3>
                <p className="mt-2 text-base text-gray-600 leading-relaxed">{step.text}</p>
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="mt-auto pt-4 h-9 w-9 text-[#1d4ed8] transition-transform duration-200 group-hover:translate-x-1"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.25}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
