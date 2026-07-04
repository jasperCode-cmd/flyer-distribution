import Link from "next/link";

const areas = [
  { name: "Southampton",  slug: "southampton",  desc: "Hampshire's largest city" },
  { name: "Bournemouth",  slug: "bournemouth",  desc: "Major Dorset resort town" },
  { name: "Poole",        slug: "poole",        desc: "Affluent harbour town" },
  { name: "Winchester",   slug: "winchester",   desc: "Historic cathedral city" },
  { name: "New Forest",   slug: "new-forest",   desc: "Towns and villages across one of Hampshire's most distinctive districts" },
  { name: "Ringwood",     slug: "ringwood",     desc: "Market town on the New Forest edge" },
  { name: "Christchurch", slug: "christchurch", desc: "Coastal market town on the Dorset border" },
  { name: "Eastleigh",    slug: "eastleigh",    desc: "One of Hampshire's largest towns" },
  { name: "Dorset",       slug: "dorset",       desc: "County-wide coverage across Dorset" },
];

function Cards({ tabIndex }: { tabIndex?: number }) {
  return (
    <>
      {areas.map((a) => (
        <Link
          key={a.slug}
          href={`/areas/${a.slug}`}
          tabIndex={tabIndex}
          className="flex-shrink-0 bg-white border border-gray-200 rounded-full px-5 py-2 shadow-sm hover:border-blue-300 hover:shadow-md transition-all duration-200 flex items-center"
        >
          <span className="text-blue-900 font-semibold text-sm whitespace-nowrap">{a.name}</span>
        </Link>
      ))}
    </>
  );
}

export default function AreaCarousel() {
  return (
    <section className="bg-blue-50 py-4 border-b border-blue-100">
      {/*
        .marquee-outer: clips overflow + applies mask-image fade at edges
        .marquee-container: target for :hover/:focus-within pause rule in CSS
        Each copy uses pr-4 so the gap at the seam equals the internal gap-4,
        making translateX(-50%) a perfect seamless loop.
      */}
      <div className="marquee-outer marquee-container overflow-hidden">
        <div className="marquee-track flex py-2">
          {/* Primary copy — keyboard-focusable */}
          <div className="flex gap-4 pr-4">
            <Cards />
          </div>
          {/* Duplicate copy — visually identical, hidden from AT and keyboard */}
          <div className="flex gap-4 pr-4 marquee-copy-dupe" aria-hidden="true">
            <Cards tabIndex={-1} />
          </div>
        </div>
      </div>
    </section>
  );
}
