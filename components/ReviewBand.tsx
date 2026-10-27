// The rating snapshot, on the homepage and every area page: the 5.0 Google
// rating and four short highlights from real client reviews. The link is the
// same Google Business Profile the footer and the homepage schema use.
const GOOGLE_PROFILE = "https://share.google/RVxyPi4TzXAzkt1Am";

// Each one is the exact start of that client's review in components/Testimonials.tsx.
export const HIGHLIGHTS = [
  { quote: "Outstanding service!", name: "John Lofthouse, New Arts" },
  { quote: "Incredible service from start to finish", name: "Hendonis Salon" },
  { quote: "Really pleased with the service!", name: "Auriel Cochrane" },
  { quote: "10/10 service for my cake business!", name: "Homebites Bakery" },
];

const STAR = "M12 2.5l2.9 6.06 6.6.87-4.83 4.6 1.24 6.6L12 17.5l-5.91 3.13 1.24-6.6-4.83-4.6 6.6-.87L12 2.5z";

export default function ReviewBand() {
  return (
    <section className="bg-white border-y border-[#e2e8f0] text-[#334155]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.6fr)] gap-10 lg:gap-12 items-center">
          {/* The rating */}
          <div>
            <h2 className="text-[#1d4ed8] text-xs sm:text-sm font-bold uppercase tracking-[0.16em] mb-4">Rated by local businesses</h2>
            <div className="flex items-center gap-4 mb-4">
              <p className="font-heading font-bold text-[72px] leading-none text-[#1e3a8a]">5.0</p>
              <div>
                <svg role="img" aria-label="5 out of 5 stars" viewBox="0 0 120 24" className="h-7 w-auto fill-[#b45309]">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <path key={i} d={STAR} transform={`translate(${i * 24} 0)`} />
                  ))}
                </svg>
                <p className="mt-1.5 font-semibold text-[#334155]">on Google</p>
              </div>
            </div>
            <p className="leading-relaxed max-w-sm mb-5">Rated five stars on Google by local businesses across Hampshire and Dorset.</p>
            <a
              href={GOOGLE_PROFILE}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1.5 font-bold text-[#1d4ed8] hover:text-[#1e3a8a] underline-offset-4 hover:underline transition-colors duration-200"
            >
              Read our Google reviews
              <span className="sr-only"> (opens in a new tab)</span>
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.25}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </a>
          </div>

          {/* Four highlights, 2 by 2 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
            {HIGHLIGHTS.map((h) => (
              <figure key={h.name} className="rounded-2xl bg-white border border-[#e2e8f0] p-6">
                <blockquote className="font-heading font-bold text-xl leading-snug text-[#1e3a8a]">&ldquo;{h.quote}&rdquo;</blockquote>
                <figcaption className="mt-3 text-sm text-[#475569]">{h.name}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
