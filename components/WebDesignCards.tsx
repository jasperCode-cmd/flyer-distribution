"use client";

import { useState } from "react";

const cards = [
  {
    title: "Web Design",
    icon: (
      <svg
        className="w-8 h-8 text-blue-600 mb-3"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </svg>
    ),
    description: (
      <>
        We build{" "}
        <strong className="font-semibold text-gray-800">fast, clean websites</strong>{" "}
        tailored to your business. Every site is mobile-friendly, easy to
        navigate, and designed to make a{" "}
        <strong className="font-semibold text-gray-800">strong first impression</strong>{" "}
        with potential customers.
      </>
    ),
  },
  {
    title: "Search Engine Optimisation",
    icon: (
      <svg
        className="w-8 h-8 text-blue-600 mb-3"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.35-4.35" />
      </svg>
    ),
    description: (
      <>
        A great website is only valuable if people can find it. We{" "}
        <strong className="font-semibold text-gray-800">
          build every site with SEO in mind from the ground up
        </strong>
        , covering technical setup, on-page optimisation, and local search
        visibility. We also offer{" "}
        <strong className="font-semibold text-gray-800">
          ongoing SEO support and retainers
        </strong>{" "}
        for businesses looking to grow their search presence over time.
      </>
    ),
  },
  {
    title: "Who We Work With",
    icon: (
      <svg
        className="w-8 h-8 text-blue-600 mb-3"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
    description: (
      <>
        Most of our web design clients are local service businesses, from trades
        and home improvement to health and wellness, food and drink, and
        professional services. If your business relies on people in your area
        finding you online and trusting what they see, we can help. We&apos;re
        happy to work with any business and{" "}
        <strong className="font-semibold text-gray-800">
          don&apos;t need a brief to give you a quote
        </strong>
        , just tell us what you&apos;re trying to achieve.
      </>
    ),
  },
];

export default function WebDesignCards() {
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {cards.map((card, i) => {
        const isOpen = expanded === i;
        const isWho = i === 2;

        return (
          <div
            key={card.title}
            className={
              isWho
                ? // "Who We Work With": transitions height slowly so the blue section
                  // background grows to accommodate if content exceeds base height
                  `md:flex md:items-center md:justify-center transition-[height] ease-out duration-700 ${
                    isOpen ? "md:h-[420px]" : "md:h-[360px]"
                  }`
                : // Web Design + SEO: fixed at SEO-card expanded height, no growth
                  "md:h-[360px] md:flex md:items-center md:justify-center"
            }
          >
            <div
              className="w-full bg-white rounded-xl md:cursor-pointer"
              onMouseEnter={() => setExpanded(i)}
              onMouseLeave={() => setExpanded(null)}
              onClick={() => setExpanded(isOpen ? null : i)}
            >
              {/* Icon + title */}
              <div
                className="flex flex-col items-center justify-center text-center px-6 pt-8 pb-4 min-h-[148px]"
              >
                {card.icon}
                <h2 className="text-base font-semibold text-blue-900">
                  {card.title}
                </h2>
              </div>
              {/* Description: always visible on mobile, expands on hover/click on desktop */}
              <div
                className={`overflow-hidden transition-all duration-500 ease-out md:max-h-0 ${
                  isOpen ? "md:max-h-[300px]" : ""
                }`}
              >
                <p
                  className="text-gray-600 text-sm leading-relaxed px-6 text-center pb-8"
                >
                  {card.description}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
