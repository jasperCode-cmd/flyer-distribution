// The homepage review band: the 5.0 Google rating, two client reviews and
// four reasons to choose us. The link is the same Google Business Profile
// the footer and the homepage schema use.
const GOOGLE_PROFILE = "https://share.google/RVxyPi4TzXAzkt1Am";

const reviews = [
  {
    quote:
      "Outstanding service! Great communication; reasonably priced; excellent job! I would highly recommend these guys. I will be taking them again.",
    name: "John Lofthouse, New Arts",
    source: "Google Review",
  },
  {
    quote:
      "Incredible service from start to finish, these guys deal with you in a really professional way and get the job done fast. Would really recommend",
    name: "Hendonis Salon",
    source: null,
  },
];

const reasons = ["Local Hampshire and Dorset team", "Postcode targeting", "GPS tracked delivery", "Quote within 24 hours"];

const STAR = "M12 2.5l2.9 6.06 6.6.87-4.83 4.6 1.24 6.6L12 17.5l-5.91 3.13 1.24-6.6-4.83-4.6 6.6-.87L12 2.5z";

export default function ReviewBand() {
  return (
    <section className="bg-[#eef4fc] border-t border-[#dbe4f0] text-[#334155]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.6fr)] gap-10 lg:gap-12 items-center">
          {/* The rating */}
          <div>
            <p className="text-[#1d4ed8] text-xs sm:text-sm font-bold uppercase tracking-[0.16em] mb-3">
              What our clients say
            </p>
            <div className="flex items-center gap-4 mb-4">
              <p className="font-heading font-bold text-[64px] leading-none text-[#1e3a8a]">5.0</p>
              <svg role="img" aria-label="5 out of 5 stars" viewBox="0 0 120 24" className="h-7 w-auto fill-[#b45309]">
                {[0, 1, 2, 3, 4].map((i) => (
                  <path key={i} d={STAR} transform={`translate(${i * 24} 0)`} />
                ))}
              </svg>
            </div>
            <p className="text-[#334155] leading-relaxed max-w-sm mb-4">
              Rated 5 stars on Google by local businesses across Hampshire and Dorset
            </p>
            <a
              href={GOOGLE_PROFILE}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1.5 font-bold text-[#1d4ed8] hover:text-[#1e3a8a] underline-offset-4 hover:underline transition-colors duration-200"
            >
              Read our reviews
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

          {/* Two reviews */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {reviews.map((r) => (
              <figure key={r.name} className="rounded-2xl bg-white border border-[#dbe4f0] shadow-[0_1px_3px_rgba(15,23,42,0.06)] p-6 flex flex-col">
                <blockquote className="flex-1 text-[#1f2937] leading-relaxed">&ldquo;{r.quote}&rdquo;</blockquote>
                <figcaption className="mt-4 text-sm">
                  <span className="font-bold text-[#1e3a8a]">{r.name}</span>
                  {r.source && <span className="ml-2 text-[#475569]">{r.source}</span>}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>

        {/* Four reasons, under a thin divider */}
        <ul className="mt-10 pt-8 border-t border-[#dbe4f0] flex flex-wrap justify-center gap-x-10 gap-y-3">
          {reasons.map((reason) => (
            <li key={reason} className="flex items-center gap-2 text-[#334155]">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="w-5 h-5 shrink-0 text-[#1d4ed8]"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
              {reason}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
