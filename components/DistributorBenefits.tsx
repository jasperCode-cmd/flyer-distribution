"use client";

import { useEffect, useRef, useState } from "react";

const cards = [
  {
    icon: (
      <svg className="w-9 h-9 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {/* Banknote / quick payment */}
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <circle cx="12" cy="12" r="3" />
        <path d="M6 6v0M18 18v0" />
      </svg>
    ),
    title: "Quick Payment",
    body: "Most jobs are paid the same day, and the amount is always agreed with you before you start. No guesswork.",
  },
  {
    icon: (
      <svg className="w-9 h-9 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {/* Clock / flexible */}
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 3" />
      </svg>
    ),
    title: "Flexible",
    body: "Work as much or as little as you want, fitting rounds around your own schedule.",
  },
  {
    icon: (
      <svg className="w-9 h-9 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {/* Check / no experience needed */}
        <path d="M20 6L9 17l-5-5" />
      </svg>
    ),
    title: "No Experience Needed",
    body: "We'll walk you through everything. If you can follow a route and post through a letterbox, you're ready to start.",
  },
  {
    icon: (
      <svg className="w-9 h-9 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {/* Gift / free to apply */}
        <rect x="3" y="8" width="18" height="13" rx="1" />
        <path d="M3 12h18M12 8v13M7.5 8a2.5 2.5 0 010-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 010 5" />
      </svg>
    ),
    title: "Free to Apply",
    body: "Nothing to buy and no cost to you at any point. Just apply below and we'll take it from there.",
  },
  {
    icon: (
      <svg className="w-9 h-9 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {/* Footsteps / outdoor exercise */}
        <path d="M12 20l4-16M8 20l4-16" />
        <circle cx="16" cy="4" r="1.5" />
        <circle cx="8" cy="4" r="1.5" />
      </svg>
    ),
    title: "Exercise and Real Income",
    body: "Get outside, stay active, and build a genuine side income alongside whatever else you've got going on.",
  },
];

export default function DistributorBenefits() {
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
    <div ref={ref} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {cards.map((item, i) => (
        <div
          key={item.title}
          className={`transition-[opacity,transform] duration-500 ease-out ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
          }`}
          style={{ transitionDelay: `${i * 100}ms` }}
        >
          <div className="group relative text-center p-6 rounded-lg bg-blue-50 border border-blue-100 shadow-sm hover:scale-[1.02] hover:shadow-lg transition-all duration-300 ease-out h-full">
            <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-lg bg-blue-200 group-hover:bg-blue-500 transition-colors duration-300" aria-hidden="true" />
            <div className="flex justify-center mb-4 mt-1">{item.icon}</div>
            <h3 className="text-base font-semibold text-blue-900 mb-2">{item.title}</h3>
            <p className="text-gray-600 text-sm leading-relaxed">{item.body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
