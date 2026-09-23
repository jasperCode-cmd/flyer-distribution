"use client";

import Link from "next/link";
import Image from "next/image";
import type { StaticImageData } from "next/image";

function ArrowIcon() {
  return (
    <svg
      className="w-4 h-4 transition-transform duration-200 ease-out group-hover:translate-x-1"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

type Props = {
  href: string;
  badge: string;
  title: string;
  description: string;
  chips: string[];
  exploreLabel: string;
  imageSrc?: string | StaticImageData;
  imageAlt?: string;
  imagePosition?: string;
  visual?: React.ReactNode;
};

// Shared card used for the "Web Design & SEO" and "Screen Trailer Hire"
// entries wherever they appear (homepage Additional Services, /services
// Additional Services), so both stay visually identical by construction
// rather than by two hand-kept copies of the same markup.
export default function AdditionalServiceCard({
  href,
  badge,
  title,
  description,
  chips,
  exploreLabel,
  imageSrc,
  imageAlt,
  imagePosition,
  visual,
}: Props) {
  return (
    <Link
      href={href}
      className="group relative bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 ease-out flex flex-col"
    >
      <div className="relative h-64 w-full overflow-hidden">
        {visual ? (
          visual
        ) : imageSrc ? (
          <Image
            src={imageSrc}
            alt={imageAlt ?? ""}
            fill
            sizes="(max-width: 640px) 100vw, 50vw"
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-110"
            style={imagePosition ? { objectPosition: imagePosition } : undefined}
          />
        ) : null}
        <span className="absolute top-3 left-3 bg-white/95 text-blue-900 text-xs font-semibold px-3 py-1 rounded-full shadow-sm">
          {badge}
        </span>
      </div>
      <div className="p-6 flex flex-col flex-1">
        <h3 className="text-base font-semibold text-blue-900 mb-2 group-hover:text-blue-700 transition-colors">
          {title}
        </h3>
        <p className="text-gray-600 text-sm leading-relaxed mb-4">
          {description}
        </p>
        <div className="flex flex-wrap gap-2 mb-5">
          {chips.map((chip) => (
            <span
              key={chip}
              className="bg-blue-50 border border-blue-100 text-blue-700 text-xs font-medium px-2.5 py-1 rounded-full"
            >
              {chip}
            </span>
          ))}
        </div>
        <span className="mt-auto inline-flex items-center gap-1.5 text-blue-700 font-semibold text-sm">
          {exploreLabel}
          <ArrowIcon />
        </span>
      </div>
    </Link>
  );
}
