const items = [
  {
    icon: (
      <svg
        className="w-7 h-7"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {/* Map pin / local */}
        <path d="M12 21s-7-6.1-7-11a7 7 0 0114 0c0 4.9-7 11-7 11z" />
        <circle cx="12" cy="10" r="2.5" />
      </svg>
    ),
    title: "Local Team",
    subtitle: "Hampshire & Dorset based",
  },
  {
    icon: (
      <svg
        className="w-7 h-7"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {/* Crosshair / target */}
        <circle cx="12" cy="12" r="7" />
        <circle cx="12" cy="12" r="2" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
      </svg>
    ),
    title: "Postcode Targeting",
    subtitle: "Reach the right customers",
  },
  {
    icon: (
      <svg
        className="w-7 h-7"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {/* Eye / tracked */}
        <path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
    title: "Tracked Delivery",
    subtitle: "Every round confirmed complete",
  },
  {
    icon: (
      <svg
        className="w-7 h-7"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {/* Clock */}
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3.5 2" />
      </svg>
    ),
    title: "Fast Turnaround",
    subtitle: "Quote within 24 hours",
  },
  {
    icon: (
      <svg
        className="w-7 h-7"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {/* Star */}
        <path d="M12 2.5l2.9 6.06 6.6.87-4.83 4.6 1.24 6.6L12 17.5l-5.91 3.13 1.24-6.6-4.83-4.6 6.6-.87L12 2.5z" />
      </svg>
    ),
    title: "5.0 Star Rated",
    subtitle: "Google Reviews",
  },
];

export default function TrustBar() {
  return (
    <section className="bg-blue-950 py-10 sm:py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-y-8 gap-x-6 lg:gap-x-4 lg:divide-x lg:divide-white/10">
          {items.map((item) => (
            <div
              key={item.title}
              className="group flex flex-col items-center text-center px-2"
            >
              <div className="text-white/90 group-hover:text-yellow-400 group-hover:scale-110 transition-all duration-300 ease-out mb-3">
                {item.icon}
              </div>
              <h3 className="text-base sm:text-lg font-bold text-white/90 group-hover:text-white transition-all duration-300 ease-out mb-1">
                {item.title}
              </h3>
              <p className="text-sm text-blue-300/80">{item.subtitle}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
