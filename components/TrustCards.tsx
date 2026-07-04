"use client";

import { useEffect, useRef, useState } from "react";

const cards = [
  {
    icon: (
      <svg
        className="w-9 h-9 text-blue-600"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {/* Users / local team */}
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
    title: "Local Team",
    body: "We're based in Hampshire and Dorset and know every postcode. No national middlemen, just local people who care about your campaign.",
  },
  {
    icon: (
      <svg
        className="w-9 h-9 text-blue-600"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {/* Crosshair / targeted */}
        <circle cx="12" cy="12" r="7" />
        <circle cx="12" cy="12" r="2" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
      </svg>
    ),
    title: "Targeted Postcodes",
    body: "Tell us your target areas and we will plan a campaign that puts your leaflets in front of the right people. We work with you to focus your distribution where it counts.",
  },
  {
    icon: (
      <svg
        className="w-9 h-9 text-blue-600"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {/* Shield check / assured delivery */}
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
    title: "Tracked and Assured Delivery",
    body: "Every round is completed by vetted, experienced distributors who confirm completion, so you can be confident your materials reached the right doors.",
  },
];

export default function TrustCards() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="grid grid-cols-1 md:grid-cols-3 gap-8">
      {cards.map((item, i) => (
        /* Outer wrapper handles the entrance fade-up with staggered delay */
        <div
          key={item.title}
          className={`transition-[opacity,transform] duration-500 ease-out ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
          }`}
          style={{ transitionDelay: `${i * 130}ms` }}
        >
          {/* Inner card handles hover interactivity independently (no delay) */}
          <div className="group relative text-center p-6 rounded-lg bg-blue-50 border border-blue-100 shadow-sm hover:scale-[1.02] hover:shadow-lg transition-all duration-300 ease-out">
            {/* Top accent bar — subtle at rest, brighter on hover */}
            <div
              className="absolute top-0 left-0 right-0 h-[3px] rounded-t-lg bg-blue-200 group-hover:bg-blue-500 transition-colors duration-300"
              aria-hidden="true"
            />
            <div className="flex justify-center mb-4 mt-1">
              {item.icon}
            </div>
            <h3 className="text-lg font-semibold text-blue-900 mb-2">
              {item.title}
            </h3>
            <p className="text-gray-600 text-sm leading-relaxed">{item.body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
