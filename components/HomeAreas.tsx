import Link from "next/link";
import AreaCheckForm from "@/components/AreaCheckForm";
import HomeAreaGroup from "@/components/HomeAreaGroup";
import { regionColumns } from "@/lib/areas-overview";

// The homepage's "Areas We Cover": the intro and a "Check if we cover you"
// search, then the four regions with their towns, from the same data as the
// /areas explorer so the two never disagree. On phones each region is a row
// that opens and closes (components/HomeAreaGroup.tsx).

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

        {/* 2. The four regions and their towns: columns from md, rows that open and close on phones, a line between them. */}
        <div className="mt-10 grid grid-cols-1 divide-y divide-white/15 md:grid-cols-2 md:gap-x-8 md:gap-y-8 md:divide-y-0 lg:grid-cols-4">
          {regionColumns().map((region) => (
            <HomeAreaGroup key={region.id} label={region.label} areas={region.areas} />
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
