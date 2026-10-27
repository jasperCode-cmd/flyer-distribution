import Link from "next/link";
import AreaCheckForm from "@/components/AreaCheckForm";
import { regionColumns } from "@/lib/areas-overview";

// The homepage's "Areas We Cover": the intro and a "Check if we cover you"
// search, then the four regions with their towns, from the same data as the
// /areas explorer so the two never disagree.

const Arrow = ({ className }: { className: string }) => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15] focus-visible:ring-offset-2 focus-visible:ring-offset-blue-900";

export default function HomeAreas() {
  return (
    <section className="bg-blue-900 text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        {/* 1. The heading and intro, beside the search */}
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">
              Areas We Cover
            </h2>
            <p className="text-blue-200 text-lg">
              We cover the Hampshire and Dorset corridor, from{" "}
              <Link href="/areas/leaflet-distribution-winchester" className="text-white underline underline-offset-2 hover:text-blue-200">
                Winchester
              </Link>{" "}
              in the north to Poole in the west, and everywhere in
              between.
            </p>
          </div>
          <AreaCheckForm />
        </div>

        {/* 2. The four regions and their towns */}
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-8">
          {regionColumns().map((region) => (
            <div key={region.id}>
              <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-blue-300 mb-2">{region.label}</h3>
              <ul>
                {region.areas.map((area) => (
                  <li key={area.slug} className="border-b border-white/15">
                    <Link
                      href={area.href}
                      className={`group flex min-h-11 items-center justify-between gap-3 rounded-sm py-2 font-semibold text-white transition-colors hover:text-[#facc15] ${FOCUS}`}
                    >
                      {area.name}
                      <Arrow className="h-4 w-4 shrink-0 text-[#facc15] transition-transform duration-200 group-hover:translate-x-0.5" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* 3. Everything on /areas */}
        <Link
          href="/areas"
          className={`mt-8 inline-flex min-h-11 items-center gap-2 rounded-sm font-bold text-[#facc15] underline-offset-4 hover:underline ${FOCUS}`}
        >
          See all coverage areas
          <Arrow className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
