import Image from "next/image";

interface Photo {
  src: string;
  alt: string;
}

// Hero photo (the most portrait/dramatic of the set) gets a larger tile on
// the left, spanning the full height, with the rest stacked in a narrower
// column on the right — proportioned to reflect each photo's real aspect
// ratio rather than forcing equal-sized tiles. That asymmetric layout only
// kicks in once the card is wide enough (lg+) to read well; on narrower
// cards it falls back to a plain even grid instead of squeezing thin
// stacked strips into a small box.
export default function CaseStudyCollage({
  hero,
  stacked,
}: {
  hero: Photo;
  stacked: Photo[];
}) {
  const all = [hero, ...stacked];

  // Single-photo entries (no stacked images) get one full-bleed tile at
  // every breakpoint, rather than forcing the hero+stack split layout
  // designed for multi-photo sets.
  if (stacked.length === 0) {
    return (
      <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden shadow-sm ring-1 ring-black/5 bg-gray-200">
        <Image
          src={hero.src}
          alt={hero.alt}
          fill
          sizes="(min-width: 1024px) 440px, 45vw"
          className="object-cover"
        />
      </div>
    );
  }

  return (
    <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden shadow-sm ring-1 ring-black/5 bg-gray-200">
      {/* Narrow cards: simple even grid */}
      <div
        className="grid grid-cols-2 gap-0.5 h-full lg:hidden"
        style={{ gridTemplateRows: `repeat(${Math.ceil(all.length / 2)}, 1fr)` }}
      >
        {all.map((photo, i) => (
          <div
            key={photo.src}
            className="relative"
            style={
              all.length % 2 === 1 && i === all.length - 1
                ? { gridColumn: "span 2" }
                : undefined
            }
          >
            <Image
              src={photo.src}
              alt={photo.alt}
              fill
              sizes="45vw"
              className="object-cover"
            />
          </div>
        ))}
      </div>

      {/* Wide cards: proportional hero + stack */}
      <div
        className="hidden lg:grid grid-cols-[3fr_2fr] gap-0.5 h-full"
        style={{ gridTemplateRows: `repeat(${stacked.length}, 1fr)` }}
      >
        <div className="relative" style={{ gridRow: `span ${stacked.length}` }}>
          <Image
            src={hero.src}
            alt={hero.alt}
            fill
            sizes="260px"
            className="object-cover"
          />
        </div>
        {stacked.map((photo) => (
          <div key={photo.src} className="relative">
            <Image
              src={photo.src}
              alt={photo.alt}
              fill
              sizes="180px"
              className="object-cover"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
