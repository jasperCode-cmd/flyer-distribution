// Deliberately generic and stylized, not a mockup of a real Strava export.
// This is a placeholder for each case study until a genuine route
// screenshot from the actual completed job is available to swap in.
export default function RoutePlaceholderGraphic({ className = "" }: { className?: string }) {
  return (
    <div className={`relative w-full aspect-[4/3] bg-blue-50 rounded-lg overflow-hidden ${className}`}>
      <svg viewBox="0 0 300 225" className="w-full h-full" aria-hidden="true">
        <rect width="300" height="225" fill="#eff6ff" />
        <path
          d="M40 180 C 70 120, 60 90, 100 80 S 160 100, 150 60 S 220 40, 260 45"
          fill="none"
          stroke="#1d4ed8"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray="1 14"
        />
        <circle cx="40" cy="180" r="8" fill="#1e3a8a" />
        <circle cx="260" cy="45" r="8" fill="#facc15" />
      </svg>
      <span className="sr-only">Placeholder route graphic, to be replaced with a real distribution route</span>
    </div>
  );
}
