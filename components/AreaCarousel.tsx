import Link from "next/link";

const areas = [
  { name: "Southampton",  slug: "southampton" },
  { name: "Bournemouth",  slug: "bournemouth" },
  { name: "Poole",        slug: "poole" },
  { name: "Winchester",   slug: "winchester" },
  { name: "New Forest",   slug: "new-forest" },
  { name: "Ringwood",     slug: "ringwood" },
  { name: "Christchurch", slug: "christchurch" },
  { name: "Eastleigh",    slug: "eastleigh" },
  { name: "Dorset",       slug: "dorset" },
];

/*
  Each copy renders the 9 cards 3 times so one copy is ~3500px wide —
  wider than any realistic viewport — meaning the viewport is always filled
  with cards and the seam never becomes visible.

  The outer .marquee-track has w-max so translateX(-50%) is calculated
  against the content width (= two copies), not the container width.
  Moving by -50% of content width = exactly one copy width → seamless loop.
*/
function Cards({ prefix, tabIndex }: { prefix: string; tabIndex?: number }) {
  return (
    <>
      {[0, 1, 2].flatMap((rep) =>
        areas.map((a) => (
          <Link
            key={`${prefix}-${rep}-${a.slug}`}
            href={`/areas/${a.slug}`}
            tabIndex={tabIndex}
            className="flex-shrink-0 bg-white border border-gray-200 rounded-full px-5 py-2 shadow-sm hover:border-blue-300 hover:shadow-md transition-all duration-200 flex items-center"
          >
            <span className="text-blue-900 font-semibold text-sm whitespace-nowrap">{a.name}</span>
          </Link>
        ))
      )}
    </>
  );
}

export default function AreaCarousel() {
  return (
    <section className="bg-white py-2">
      <div className="marquee-outer marquee-container overflow-hidden">
        {/*
          w-max makes the track's own width = sum of its children,
          so translateX(-50%) moves by exactly one copy's width.
        */}
        <div className="marquee-track flex w-max py-2">
          {/* Primary copy — keyboard-focusable */}
          <div className="flex gap-4 pr-4">
            <Cards prefix="a" />
          </div>
          {/* Duplicate copy — hidden from AT and keyboard */}
          <div className="flex gap-4 pr-4 marquee-copy-dupe" aria-hidden="true">
            <Cards prefix="b" tabIndex={-1} />
          </div>
        </div>
      </div>
    </section>
  );
}
