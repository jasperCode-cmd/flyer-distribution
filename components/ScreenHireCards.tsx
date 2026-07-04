"use client";

import { useEffect, useRef, useState } from "react";

const features = [
  {
    title: "Be Seen With a Screen",
    body: "Our mobile LED screen trailers are fully customisable for your event or campaign. Whether you need outdoor advertising, a live event display, a movie screening, or a gaming setup, the screen can be configured to suit. The 7m² display is bright enough for daylight viewing and delivers impact that static advertising cannot match.",
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
        {/* Monitor with play button inside */}
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8M12 17v4" />
        <path d="M10 8.5l5 3-5 3z" />
      </svg>
    ),
  },
  {
    title: "On the Move",
    body: "The screen arrives pre-mounted on a road-legal trailer and can be raised to maximum viewing height on arrival. Setup is straightforward and can typically be completed within an hour. The trailer is stable on most surfaces and suitable for car parks, fields, event sites, and public spaces across Hampshire and Dorset.",
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
        {/* Truck */}
        <path d="M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h11a2 2 0 012 2v3" />
        <rect x="9" y="11" width="14" height="10" rx="2" />
        <circle cx="12" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
      </svg>
    ),
  },
  {
    title: "Fully Qualified Engineers",
    body: "All screen installations are designed and overseen by fully qualified engineers using industry-leading components. We handle the full setup and takedown so you don't have to. You hire with confidence knowing the equipment is safe, professionally installed, and built to perform for the duration of your event.",
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
        {/* Wrench */}
        <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
      </svg>
    ),
  },
];

export default function ScreenHireCards() {
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
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {features.map((f, i) => (
        <div
          key={f.title}
          className={`transition-[opacity,transform] duration-500 ease-out ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
          }`}
          style={{ transitionDelay: `${i * 130}ms` }}
        >
          <div className="group relative bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:scale-[1.02] hover:shadow-lg transition-all duration-300 ease-out h-full">
            <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-lg bg-blue-200 group-hover:bg-blue-500 transition-colors duration-300" aria-hidden="true" />
            {f.icon}
            <h2 className="text-base font-semibold text-blue-900 mb-2">{f.title}</h2>
            <p className="text-gray-600 text-sm leading-relaxed">{f.body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
