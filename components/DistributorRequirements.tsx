"use client";

import StaggerGroup from "./StaggerGroup";

const items = [
  {
    icon: (
      <svg className="w-8 h-8 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0116 0z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    ),
    body: "Living in Hampshire or Dorset.",
  },
  {
    icon: (
      <svg className="w-8 h-8 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 6L9 17l-5-5" />
      </svg>
    ),
    body: "Reliable, and able to see a route through to completion.",
  },
  {
    icon: (
      <svg className="w-8 h-8 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="10" width="20" height="8" rx="2" />
        <circle cx="7" cy="18" r="2" />
        <circle cx="17" cy="18" r="2" />
        <path d="M5 10l2-5h10l2 5" />
      </svg>
    ),
    body: "A car and full UK driving licence are preferred, but not essential. Plenty of our rounds are walkable, so don't let this put you off applying.",
  },
];

export default function DistributorRequirements() {
  return (
    <StaggerGroup className="grid grid-cols-1 sm:grid-cols-3 gap-6">
      {items.map((item, i) => (
        <div
          key={i}
          className="group relative bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:border-blue-300 hover:scale-[1.02] hover:shadow-lg transition-all duration-300 ease-out"
        >
          <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-lg bg-blue-200 group-hover:bg-blue-500 transition-colors duration-300" aria-hidden="true" />
          <div className="mb-4">{item.icon}</div>
          <p className="text-gray-700 text-sm leading-relaxed">{item.body}</p>
        </div>
      ))}
    </StaggerGroup>
  );
}
