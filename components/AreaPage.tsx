import Image from "next/image";
import Link from "next/link";
import Breadcrumb from "@/components/Breadcrumb";
import { AREA_PAGES, REVIEWS, type AreaPageData } from "@/lib/area-pages";
import { formatPostcodeRanges } from "@/lib/postcode-ranges";

// The shared template for the area pages (/areas/leaflet-distribution-[area]).
// Each page's details come from lib/area-pages.tsx; the page file keeps its
// own metadata and BreadcrumbList schema. New Forest and Dorset are "wide":
// their postcodes are ones "we deliver to", and they never say "every" or
// "all of". The only link off the site is our Google reviews.

const GOOGLE_PROFILE = "https://share.google/RVxyPi4TzXAzkt1Am";
const STAR = "M12 2.5l2.9 6.06 6.6.87-4.83 4.6 1.24 6.6L12 17.5l-5.91 3.13 1.24-6.6-4.83-4.6 6.6-.87L12 2.5z";
const QUOTE_HREF = "/quote?service=leaflet";

const YELLOW_BUTTON =
  "inline-block bg-yellow-400 hover:bg-yellow-300 text-blue-900 font-bold px-7 py-3.5 rounded-md transition duration-200 ease-out hover:scale-105 shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-blue-900";
const PILL =
  "inline-block rounded-full border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-800 hover:border-blue-400 hover:bg-blue-50 transition-colors";

// 107500 as "107,500".
const thousands = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

export default function AreaPage({ area }: { area: AreaPageData }) {
  const each = area.wide ? "each" : "every";
  const codes = area.postcodes.map((p) => p.code);
  const review = REVIEWS[area.review];
  const article = /^[AEIOU]/.test(area.name) ? "an" : "a";
  const questions = [
    `Which parts of ${area.inName} do you cover?`,
    `Can I target just one or two postcodes in ${area.inName}?`,
    area.question3 ?? `Can you deliver in ${area.inName} and other towns in one campaign?`,
    `How do I know my ${area.name} leaflets were delivered?`,
  ];
  const facts = [
    {
      title: area.wide ? `${codes.length} postcodes covered` : `Every ${area.name} postcode`,
      text: formatPostcodeRanges(codes),
    },
    { title: `About ${thousands(area.homes)} homes`, text: `in our ${area.name} coverage (Census 2021 estimate)` },
    { title: "GPS tracked", text: `with a route report for ${each} round` },
    { title: "24 hours", text: "to get your free quote" },
  ];

  return (
    <>
      {/* 1. Hero */}
      <section className="bg-blue-900 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-20 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">
          <div>
            <Breadcrumb
              items={[
                { label: "Home", href: "/" },
                { label: "Areas", href: "/areas" },
                { label: area.name },
              ]}
            />
            {/* Our Google rating, as on the homepage, linking to the reviews */}
            <a
              href={GOOGLE_PROFILE}
              target="_blank"
              rel="noopener"
              className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 max-w-full rounded-2xl sm:rounded-full bg-white/10 border border-white/20 px-3.5 py-1.5 mb-5 text-xs sm:text-sm hover:bg-white/15 transition-colors"
            >
              <svg role="img" aria-label="5 out of 5 stars" viewBox="0 0 120 24" className="h-3.5 w-auto fill-yellow-400 shrink-0">
                {[0, 1, 2, 3, 4].map((i) => (
                  <path key={i} d={STAR} transform={`translate(${i * 24} 0)`} />
                ))}
              </svg>
              <span className="font-bold text-white whitespace-nowrap">5.0 on Google</span>
              <span className="text-[#bfdbfe] whitespace-nowrap">from local businesses</span>
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
            <p className="text-blue-300 text-sm font-semibold uppercase tracking-widest mb-3">{area.eyebrow}</p>
            <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight mb-5">Leaflet Distribution in {area.inName}</h1>
            <p className="text-blue-100 text-lg sm:text-xl leading-relaxed mb-8">
              Door to door leaflet delivery across {area.inName} and the surrounding areas by our own local team, with {each}{" "}
              round GPS tracked and a route report once it&apos;s done.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href={QUOTE_HREF} className={YELLOW_BUTTON}>
                Get a Free Quote
              </Link>
              <Link
                href="/case-studies"
                className="inline-block border-2 border-white text-white hover:bg-white hover:text-blue-900 font-bold px-7 py-3 rounded-md transition duration-200 ease-out hover:scale-105"
              >
                See Our Case Studies
              </Link>
            </div>
          </div>
          {/* The page's image for now; its coverage map replaces it later. Never a link. */}
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl shadow-2xl shadow-black/30 ring-1 ring-white/10">
            <Image
              src={area.image.src}
              alt={area.image.alt}
              fill
              priority
              sizes="(min-width: 1152px) 540px, (min-width: 1024px) 46vw, 100vw"
              className="object-cover"
            />
          </div>
        </div>
      </section>

      {/* 2. Quick facts */}
      <section className="bg-white border-b border-gray-100">
        <ul className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-6">
          {facts.map((f) => (
            <li key={f.title} className="border-l-4 border-yellow-400 pl-4">
              <p className="text-lg sm:text-xl font-bold text-blue-900 leading-snug">{f.title}</p>
              <p className="mt-1 text-sm text-gray-600 leading-snug">{f.text}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* 3. About our coverage: the page's own copy */}
      <section className="bg-slate-50 py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <h2 className="text-2xl sm:text-3xl font-bold text-blue-900 mb-5">About our {area.name} coverage</h2>
            {area.copy.map((para, i) => (
              <p
                key={i}
                className={i < area.copy.length - 1 ? "text-gray-600 mb-4 leading-relaxed text-lg" : "text-gray-600 leading-relaxed text-lg"}
              >
                {para.map((piece, j) =>
                  typeof piece === "string" ? (
                    piece
                  ) : (
                    <Link key={j} href={piece.href} className="text-blue-700 hover:underline font-medium">
                      {piece.text}
                    </Link>
                  )
                )}
              </p>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Postcodes */}
      <section className="bg-white py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-blue-900 mb-6">
            {area.wide ? `${area.name} postcodes we deliver to` : `Every ${area.name} postcode we deliver to`}
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {area.postcodes.map((p) => (
              <li key={p.code} className="rounded-xl border border-gray-200 bg-slate-50 p-5">
                <h3 className="text-lg font-bold text-blue-900">{p.code}</h3>
                <p className="mt-1 text-sm text-gray-600 leading-relaxed">{p.places.join(", ")}</p>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-gray-600 text-lg">
            {area.wide ? "" : `We cover all of ${area.inName}. `}Choose whole postcodes or just the sectors that suit your business.
          </p>
        </div>
      </section>

      {/* 5. Not just this area */}
      <section className="bg-slate-50 py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <h2 className="text-2xl sm:text-3xl font-bold text-blue-900 mb-4">Not just {area.inName}</h2>
            <p className="text-gray-600 text-lg leading-relaxed">
              Many of our clients reach customers across more than one town. We can deliver in {area.inName} and the surrounding
              areas as part of the same campaign, with one quote, one plan and one route report.
            </p>
          </div>
          <Link
            href={QUOTE_HREF}
            className="mt-7 inline-block bg-blue-700 hover:bg-blue-800 text-white font-bold px-7 py-3.5 rounded-md transition duration-200 ease-out hover:scale-105"
          >
            Plan a multi-area campaign
          </Link>
          <ul className="mt-7 flex flex-wrap gap-2.5" aria-label="Nearby areas">
            {area.nearby.map((slug) => (
              <li key={slug}>
                <Link href={`/areas/leaflet-distribution-${slug}`} className={PILL}>
                  {AREA_PAGES[slug].name}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/areas" className={PILL}>
                All areas we cover
              </Link>
            </li>
          </ul>
        </div>
      </section>

      {/* 6. How a campaign works */}
      <section className="bg-white py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-blue-900 mb-8">
            How {article} {area.name} campaign works
          </h2>
          <ol className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <li className="rounded-xl border border-gray-200 p-6">
              <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-700 text-white font-bold">1</span>
              <h3 className="mt-4 text-lg font-bold text-blue-900">Tell us your areas</h3>
              <p className="mt-2 text-gray-600 leading-relaxed">
                Let us know which {area.name} postcodes you want to reach and roughly how many leaflets you have, and we&apos;ll
                send a free quote within 24 hours.
              </p>
            </li>
            <li className="rounded-xl border border-gray-200 p-6">
              <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-700 text-white font-bold">2</span>
              <h3 className="mt-4 text-lg font-bold text-blue-900">We plan, print and design</h3>
              <p className="mt-2 text-gray-600 leading-relaxed">
                We plan the rounds for the postcodes you choose, and if you need them we can take care of the{" "}
                <Link href="/services" className="text-blue-700 hover:underline font-medium">
                  design and printing
                </Link>{" "}
                as well, so your leaflets arrive ready to go.
              </p>
            </li>
            <li className="rounded-xl border border-gray-200 p-6">
              <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-700 text-white font-bold">3</span>
              <h3 className="mt-4 text-lg font-bold text-blue-900">We deliver and report</h3>
              <p className="mt-2 text-gray-600 leading-relaxed">
                Our own local team delivers your leaflets door to door, with each round GPS tracked, and we send you a route
                report once it&apos;s done.
              </p>
            </li>
          </ol>
        </div>
      </section>

      {/* 7. Review band: the rating and one real review */}
      <section className="bg-[#eef4fc] border-y border-[#dbe4f0] py-14 text-[#334155]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.6fr)] gap-8 lg:gap-12 items-center">
          <div>
            <p className="text-[#1d4ed8] text-xs sm:text-sm font-bold uppercase tracking-[0.16em] mb-3">What our clients say</p>
            <div className="flex items-center gap-4 mb-3">
              <p className="font-heading font-bold text-[56px] leading-none text-[#1e3a8a]">5.0</p>
              <svg role="img" aria-label="5 out of 5 stars" viewBox="0 0 120 24" className="h-7 w-auto fill-[#b45309]">
                {[0, 1, 2, 3, 4].map((i) => (
                  <path key={i} d={STAR} transform={`translate(${i * 24} 0)`} />
                ))}
              </svg>
            </div>
            <p className="leading-relaxed max-w-sm mb-4">Rated 5 stars on Google by local businesses across Hampshire and Dorset</p>
            <a
              href={GOOGLE_PROFILE}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1.5 font-bold text-[#1d4ed8] hover:text-[#1e3a8a] underline-offset-4 hover:underline transition-colors duration-200"
            >
              Read our reviews
              <span className="sr-only"> (opens in a new tab)</span>
              <svg aria-hidden="true" viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </a>
          </div>
          <figure className="rounded-2xl bg-white border border-[#dbe4f0] shadow-[0_1px_3px_rgba(15,23,42,0.06)] p-6 sm:p-8">
            <blockquote className="text-[#1f2937] text-lg leading-relaxed">&ldquo;{review.quote}&rdquo;</blockquote>
            <figcaption className="mt-4 text-sm">
              <span className="font-bold text-[#1e3a8a]">
                {review.name}
                {review.business ? `, ${review.business}` : ""}
              </span>
              <span className="ml-2 text-[#475569]">{review.label}</span>
            </figcaption>
          </figure>
        </div>
      </section>

      {/* 8. Questions, answered from the page's own facts (no FAQ schema) */}
      <section className="bg-white py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-blue-900 mb-6">{area.name} leaflet distribution questions</h2>
          <div className="space-y-3">
            {questions.map((q, i) => (
              <details key={q} open={i === 0} className="group rounded-xl border border-gray-200 bg-white open:shadow-sm">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-xl px-5 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 [&::-webkit-details-marker]:hidden">
                  <h3 className="text-base sm:text-lg font-semibold text-blue-900">{q}</h3>
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-blue-700 transition-transform duration-200 group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </summary>
                <p className="px-5 pb-5 text-gray-600 leading-relaxed">{area.faqs[i]}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* 9. Closing band */}
      <section className="bg-blue-900 text-white py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">Ready to reach homes in {area.inName} and beyond?</h2>
          <p className="text-blue-100 text-lg mb-8">
            Tell us about your campaign and we&apos;ll send a free, no-obligation quote within 24 hours.
          </p>
          <Link href={QUOTE_HREF} className={YELLOW_BUTTON}>
            Get a Free Quote
          </Link>
        </div>
      </section>
    </>
  );
}
