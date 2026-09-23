"use client";

import StaggerGroup from "./StaggerGroup";

const cards = [
  {
    icon: (
      <svg className="w-9 h-9 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {/* Pen / bespoke design */}
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    ),
    title: "Bespoke Design",
    body: "Websites built around your business, not a generic template.",
  },
  {
    icon: (
      <svg className="w-9 h-9 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {/* Lightning bolt / fast */}
        <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" />
      </svg>
    ),
    title: "Fast & Easy to Navigate",
    body: "Quick to load and simple for your customers to find their way around.",
  },
  {
    icon: (
      <svg className="w-9 h-9 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {/* Target / conversion */}
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1" />
      </svg>
    ),
    title: "Built to Convert",
    body: "Every page designed to turn visitors into real enquiries.",
  },
  {
    icon: (
      <svg className="w-9 h-9 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {/* Phone / mobile-friendly */}
        <rect x="7" y="2" width="10" height="20" rx="2" />
        <path d="M11 18h2" />
      </svg>
    ),
    title: "Mobile-Friendly",
    body: "Clean and responsive from the ground up, on every device.",
  },
  {
    icon: (
      <svg className="w-9 h-9 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {/* Magnifying glass / SEO */}
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.35-4.35" />
      </svg>
    ),
    title: "SEO Built In",
    body: "Search optimisation from day one, so you get found organically.",
  },
  {
    icon: (
      <svg className="w-9 h-9 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {/* Shield check / trust */}
        <path d="M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6l7-3z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
    title: "Trusted & Professional",
    body: "A professional online presence your customers can trust.",
  },
];

export default function WebDesignBenefits() {
  return (
    <StaggerGroup
      className="flex flex-wrap justify-center gap-6"
      itemClassName="w-full sm:w-[calc(50%-0.75rem)] lg:w-[calc(33.333%-1rem)]"
    >
      {cards.map((item) => (
        <div
          key={item.title}
          className="group relative text-center p-6 rounded-lg bg-blue-50 border border-blue-100 shadow-sm hover:scale-[1.02] hover:shadow-lg transition-all duration-300 ease-out h-full"
        >
          <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-lg bg-blue-200 group-hover:bg-blue-500 transition-colors duration-300" aria-hidden="true" />
          <div className="flex justify-center mb-4 mt-1">{item.icon}</div>
          <h3 className="text-base font-semibold text-blue-900 mb-2">{item.title}</h3>
          <p className="text-gray-600 text-sm leading-relaxed">{item.body}</p>
        </div>
      ))}
    </StaggerGroup>
  );
}
