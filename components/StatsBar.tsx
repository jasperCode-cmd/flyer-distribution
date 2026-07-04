"use client";

import { useEffect, useRef, useState } from "react";

function useCountUp(target: number, duration: number, triggered: boolean) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!triggered) return;
    let start: number | null = null;
    const step = (timestamp: number) => {
      if (start === null) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [triggered, target, duration]);
  return count;
}

export default function StatsBar() {
  const ref = useRef<HTMLDivElement>(null);
  const [triggered, setTriggered] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTriggered(true);
          observer.disconnect();
        }
      },
      { threshold: 0.25 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const stat92 = useCountUp(92, 1800, triggered);
  const stat74 = useCountUp(74, 1800, triggered);
  const stat4 = useCountUp(4, 1600, triggered);

  return (
    <section className="bg-blue-900 text-white">
      <div ref={ref} className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-6 items-start">

          {/* 92% */}
          <div className="flex flex-col items-center text-center">
            <div
              className={`h-14 flex items-end justify-center mb-5 transition-all duration-700 ease-out ${
                triggered ? "opacity-100 scale-100" : "opacity-0 scale-75"
              }`}
              aria-hidden="true"
            >
              <svg className="w-14 h-14 text-blue-300 block" viewBox="0 0 24 24" fill="currentColor">
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M12 5C6.5 5 2.36 8.51.46 11.32a1.5 1.5 0 000 1.36C2.36 15.49 6.5 19 12 19s9.64-3.51 11.54-6.32a1.5 1.5 0 000-1.36C21.64 8.51 17.5 5 12 5zm0 11.5a4.5 4.5 0 110-9 4.5 4.5 0 010 9z"
                  opacity="0.45"
                />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </div>
            <p className="text-5xl sm:text-6xl font-bold mb-3 leading-none">
              {stat92}%
            </p>
            <p className="text-blue-200 text-sm leading-relaxed max-w-[13rem]">
              of people who receive a door drop read it
            </p>
          </div>

          {/* 74% */}
          <div className="flex flex-col items-center text-center">
            <div
              className={`h-14 flex items-end justify-center mb-5 transition-all duration-700 ease-out delay-150 ${
                triggered ? "opacity-100 scale-100" : "opacity-0 scale-75"
              }`}
              aria-hidden="true"
            >
              <svg className="w-14 h-14 text-blue-300 block" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z" />
              </svg>
            </div>
            <p className="text-5xl sm:text-6xl font-bold mb-3 leading-none">
              {stat74}%
            </p>
            <p className="text-blue-200 text-sm leading-relaxed max-w-[13rem]">
              of door drops are opened, read, filed or set aside for later
            </p>
          </div>

          {/* 4/5 */}
          <div className="flex flex-col items-center text-center">
            <div
              className={`h-14 flex items-end justify-center gap-1 mb-5 transition-all duration-700 ease-out delay-300 ${
                triggered ? "opacity-100 scale-100" : "opacity-0 scale-75"
              }`}
              aria-hidden="true"
            >
              {[0, 1, 2, 3, 4].map((i) =>
                i < 4 ? (
                  <svg key={i} className="w-9 h-9 text-white block" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" />
                  </svg>
                ) : (
                  <svg key={i} className="w-9 h-9 text-blue-400 block" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                )
              )}
            </div>
            <p className="text-5xl sm:text-6xl font-bold mb-3 leading-none">
              {stat4}/5
            </p>
            <p className="text-blue-200 text-sm leading-relaxed max-w-[13rem]">
              of door drop items are engaged with
            </p>
          </div>

        </div>
        <p className="text-center text-blue-300 text-xs mt-6">
          Source: Royal Mail
        </p>
      </div>
    </section>
  );
}
