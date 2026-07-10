"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

type Testimonial = {
  id: string;
  name: string;
  label: string;
  quote: string | null;
  header: React.ReactNode;
};

const Stars = () => (
  <div className="flex gap-0.5 mb-3" aria-label="5 out of 5 stars">
    {[...Array(5)].map((_, i) => (
      <svg
        key={i}
        className="w-4 h-4 text-amber-400"
        fill="currentColor"
        viewBox="0 0 20 20"
        aria-hidden="true"
      >
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
    ))}
  </div>
);

const ChevronIcon = ({ flipped = false }: { flipped?: boolean }) => (
  <svg
    className={`w-5 h-5 ${flipped ? "rotate-180" : ""}`}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

const testimonials: Testimonial[] = [
  {
    id: "coastline-print",
    name: "Coastline Print",
    label: "Google Review",
    quote: null,
    header: (
      <Image
        src="/Coastline Print Logo.jpg"
        alt="Coastline Print logo"
        width={150}
        height={150}
        className="h-14 w-14 object-contain rounded-full"
      />
    ),
  },
  {
    id: "body-by-victoria",
    name: "Body by Victoria",
    label: "Google Review",
    quote:
      "Great communication from the start. Very polite competitive prices will definitely be using again. Thank you",
    header: (
      <Image
        src="/Body by Victoria.png"
        alt="Body by Victoria logo"
        width={913}
        height={534}
        className="h-14 w-auto object-contain"
      />
    ),
  },
  {
    id: "kola-construction",
    name: "Kola Construction",
    label: "Google Review",
    quote:
      "Excellent flyer distribution service from start to finish. The team was professional, reliable, and kept us updated throughout the campaign.",
    header: (
      <div className="flex items-center justify-center gap-2">
        <Image
          src="/grand designs live.webp"
          alt="Grand Designs Live exhibitor badge"
          width={200}
          height={100}
          className="h-10 w-auto object-contain shrink-0"
        />
        <Image
          src="/KOLA-CONSTRUCTION-LOGO.webp"
          alt="Kola Construction logo"
          width={200}
          height={80}
          className="h-12 w-auto object-contain shrink-0"
        />
        <Image
          src="/logo_exhibitor_default.webp"
          alt="Ideal Home Show exhibitor badge"
          width={200}
          height={100}
          className="h-7 w-auto object-contain shrink-0"
        />
      </div>
    ),
  },
  {
    id: "hendonis-salon",
    name: "Hendonis Salon",
    label: "Google Review",
    quote:
      "Incredible service from start to finish, these guys deal with you in a really professional way and get the job done fast. Would really recommend 🙌",
    header: (
      <Image
        src="/Hendonis Salon.jpg"
        alt="Hendonis Salon logo"
        width={150}
        height={150}
        className="h-14 w-14 object-contain rounded-full"
      />
    ),
  },
  {
    id: "cozy-stoves",
    name: "Cozy Stoves",
    label: "Client review",
    quote: "Fast and reliable team service all around",
    header: (
      <Image
        src="/Cozy-Stoves-logo.png"
        alt="Cozy Stoves logo"
        width={305}
        height={100}
        className="h-14 w-auto object-contain"
      />
    ),
  },
];

const COUNT = testimonials.length;
const AUTOPLAY_MS = 4500;
const SWIPE_THRESHOLD = 40;

/** Shortest signed circular distance from `index` to `i`, e.g. for 5 items: -2..2 */
function circularDiff(i: number, index: number) {
  const n = COUNT;
  let d = ((i - index) % n + n) % n;
  if (d > n / 2) d -= n;
  return d;
}

export default function Testimonials() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const goTo = useCallback((i: number) => {
    setIndex(((i % COUNT) + COUNT) % COUNT);
  }, []);

  const next = useCallback(() => goTo(index + 1), [index, goTo]);
  const prev = useCallback(() => goTo(index - 1), [index, goTo]);

  useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => {
      setIndex((i) => (i + 1) % COUNT);
    }, AUTOPLAY_MS);
    return () => clearTimeout(t);
  }, [index, paused]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > SWIPE_THRESHOLD) {
      if (delta < 0) next();
      else prev();
    }
    touchStartX.current = null;
  };

  return (
    <section className="bg-white border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-2xl sm:text-3xl font-bold text-blue-900 text-center mb-12">
          What People Say About Us
        </h2>

        <div
          className="relative"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <div
            className="relative mx-auto max-w-2xl h-[300px] sm:h-[340px] overflow-hidden"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {testimonials.map((t, i) => {
              const diff = circularDiff(i, index);
              const abs = Math.abs(diff);
              const isCenter = diff === 0;
              const scale = isCenter ? 1 : abs === 1 ? 0.86 : 0.72;
              const opacity = isCenter ? 1 : abs === 1 ? 0.68 : 0;

              return (
                <div
                  key={t.id}
                  aria-hidden={!isCenter}
                  className="absolute top-1/2 left-1/2 transition-all duration-700 ease-out"
                  style={{
                    transform: `translate(-50%, -50%) translateX(${diff * 76}%) scale(${scale})`,
                    opacity,
                    zIndex: isCenter ? 20 : abs === 1 ? 10 : 0,
                    pointerEvents: isCenter ? "auto" : "none",
                  }}
                >
                  <div className="w-64 h-72 sm:w-80 sm:h-[310px] bg-white rounded-lg border border-gray-200 shadow-lg p-5 sm:p-6 flex flex-col">
                    <div className="h-14 flex items-center justify-center mb-4 shrink-0">
                      {t.header}
                    </div>
                    <div className="flex-1 flex flex-col justify-center min-h-0">
                      <Stars />
                      {t.quote && (
                        <blockquote className="text-gray-600 text-sm leading-relaxed line-clamp-5">
                          &ldquo;{t.quote}&rdquo;
                        </blockquote>
                      )}
                    </div>
                    <div className="mt-3 shrink-0">
                      <p className="text-blue-900 font-semibold text-sm">{t.name}</p>
                      <p className="text-gray-400 text-xs mt-0.5">{t.label}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Arrows */}
          <button
            type="button"
            onClick={prev}
            aria-label="Previous testimonial"
            className="absolute left-0 sm:-left-2 top-1/2 -translate-y-1/2 z-30 w-9 h-9 rounded-full bg-white border border-gray-200 shadow text-blue-700 flex items-center justify-center hover:bg-blue-50 transition-colors duration-200"
          >
            <ChevronIcon />
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="Next testimonial"
            className="absolute right-0 sm:-right-2 top-1/2 -translate-y-1/2 z-30 w-9 h-9 rounded-full bg-white border border-gray-200 shadow text-blue-700 flex items-center justify-center hover:bg-blue-50 transition-colors duration-200"
          >
            <ChevronIcon flipped />
          </button>
        </div>

        {/* Dots */}
        <div className="flex justify-center gap-2 mt-8">
          {testimonials.map((t, i) => (
            <button
              key={t.id}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Go to ${t.name} testimonial`}
              aria-current={i === index}
              className={`w-2.5 h-2.5 rounded-full transition-colors duration-200 ${
                i === index ? "bg-blue-700" : "bg-gray-300 hover:bg-gray-400"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
