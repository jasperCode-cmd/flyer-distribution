import Image from "next/image";

const brands = [
  { name: "New Arts", file: "logo-new-arts.webp", width: 762, height: 348 },
  { name: "Body by Victoria", file: "logo-body-by-victoria.webp", width: 466, height: 252 },
  { name: "Associated Asphalt", file: "logo-associated-asphalt.webp", width: 759, height: 128 },
  { name: "Hera Health", file: "logo-hera-health.webp", width: 582, height: 372 },
  { name: "Heritage Will Writing", file: "logo-heritage-will-writing.webp", width: 750, height: 328 },
  { name: "The Relocation Specialists", file: "logo-the-relocation-specialists.webp", width: 780, height: 248 },
  { name: "Full Shield Security", file: "logo-full-shield-security.webp", width: 780, height: 263 },
  { name: "Elisha's Pampered Paws", file: "logo-elishas-pampered-paws.webp", width: 331, height: 364 },
  { name: "The Healing Hub", file: "logo-the-healing-hub.webp", width: 764, height: 163 },
];

/*
  Same seamless-loop approach as the old area-pill carousel: the track
  renders all 9 logos 6 times over (2 copies x 3 reps each) so one copy is
  comfortably wider than any realistic viewport, and .marquee-track moves by
  exactly -50% (one copy's width) via translateX, so the seam never becomes
  visible.

  Only the very first repeat carries real alt text. Every other repeat is
  purely visual filler for the scroll, so it gets alt="" and sits inside its
  own aria-hidden wrapper — otherwise a screen reader would announce each
  brand's name six times over.
*/
function Logos({ groupId, hidden }: { groupId: string; hidden: boolean }) {
  return (
    <>
      {brands.map((b) => (
        <div key={`${groupId}-${b.file}`} className="flex-shrink-0 flex items-center">
          <Image
            src={`/${b.file}`}
            alt={hidden ? "" : `${b.name} logo`}
            width={b.width}
            height={b.height}
            className="h-9 sm:h-12 w-auto object-contain"
          />
        </div>
      ))}
    </>
  );
}

export default function BrandsBar() {
  return (
    <section className="bg-white py-8">
      <p className="text-center text-xs font-semibold uppercase tracking-widest text-gray-400 mb-6">
        Brands We&apos;ve Worked With
      </p>

      {/* Animated marquee — hidden under prefers-reduced-motion */}
      <div className="marquee-outer marquee-container overflow-hidden">
        <div className="marquee-track flex w-max items-center py-1">
          {/* First repeat — real alt text, the only copy read by screen readers */}
          <div className="flex items-center gap-10 pr-10">
            <Logos groupId="rep0" hidden={false} />
          </div>
          {/* Every other repeat (2 more to fill this copy, then 3 for the
              duplicate copy) — decorative only, alt="" + aria-hidden */}
          <div className="flex items-center gap-10 pr-10" aria-hidden="true">
            <Logos groupId="rep1" hidden />
          </div>
          <div className="flex items-center gap-10 pr-10" aria-hidden="true">
            <Logos groupId="rep2" hidden />
          </div>
          <div className="flex items-center gap-10 pr-10" aria-hidden="true">
            <Logos groupId="dupe0" hidden />
          </div>
          <div className="flex items-center gap-10 pr-10" aria-hidden="true">
            <Logos groupId="dupe1" hidden />
          </div>
          <div className="flex items-center gap-10 pr-10" aria-hidden="true">
            <Logos groupId="dupe2" hidden />
          </div>
        </div>
      </div>

      {/* Reduced-motion fallback: static, centred, wrapping row — no animation, no duplication */}
      <div className="brands-static-row flex-wrap items-center justify-center gap-x-10 gap-y-6 max-w-5xl mx-auto px-6">
        {brands.map((b) => (
          <Image
            key={b.file}
            src={`/${b.file}`}
            alt={`${b.name} logo`}
            width={b.width}
            height={b.height}
            className="h-9 sm:h-12 w-auto object-contain"
          />
        ))}
      </div>
    </section>
  );
}
