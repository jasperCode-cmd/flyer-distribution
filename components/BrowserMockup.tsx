// Pure CSS/HTML browser-window mockup, no photo. Deliberately free of any
// numbers, rankings, percentages, traffic figures or client names, real or
// invented, since this is illustrating the shape of a website, not a claim.
// Floats gently via the hero-mockup-float(-delay) keyframes in globals.css,
// which respect prefers-reduced-motion.
export default function BrowserMockup() {
  return (
    <div className="relative">
      <div className="hero-mockup-float w-full max-w-md rounded-xl overflow-hidden shadow-2xl ring-1 ring-black/10 bg-white">
        <div className="bg-slate-100 px-4 py-3 flex items-center gap-2 border-b border-slate-200">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
          <div className="ml-3 flex-1 bg-white rounded-full px-3 py-1 text-[10px] text-slate-400 truncate">
            yourbusiness.co.uk
          </div>
        </div>
        <div className="p-4 space-y-3 bg-slate-50">
          <div className="flex items-center justify-between">
            <div className="h-2.5 w-16 rounded-full bg-blue-700" />
            <div className="flex gap-2">
              <div className="h-2 w-8 rounded-full bg-slate-300" />
              <div className="h-2 w-8 rounded-full bg-slate-300" />
              <div className="h-2 w-8 rounded-full bg-slate-300" />
            </div>
          </div>
          <div className="rounded-lg bg-blue-900 p-4">
            <div className="h-2.5 w-2/3 rounded-full bg-white/80 mb-2" />
            <div className="h-2 w-1/2 rounded-full bg-blue-300/60 mb-3" />
            <div className="h-6 w-20 rounded-md bg-yellow-400" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-white border border-slate-200 p-3">
              <div className="h-2 w-1/2 rounded-full bg-slate-300 mb-2" />
              <div className="h-1.5 w-full rounded-full bg-slate-200" />
            </div>
            <div className="rounded-lg bg-white border border-slate-200 p-3">
              <div className="h-2 w-1/2 rounded-full bg-slate-300 mb-2" />
              <div className="h-1.5 w-full rounded-full bg-slate-200" />
            </div>
          </div>
        </div>
      </div>

      {/* Floating search-result snippet, representing being found on Google */}
      <div className="hero-mockup-float-delay absolute -bottom-6 -left-3 sm:-left-8 bg-white rounded-lg shadow-xl p-3 w-44 sm:w-48">
        <div className="flex items-center gap-1.5 mb-1.5">
          <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <div className="h-1.5 w-16 rounded-full bg-blue-700" />
        </div>
        <div className="h-1.5 w-full rounded-full bg-slate-200 mb-1" />
        <div className="h-1.5 w-3/4 rounded-full bg-slate-200" />
      </div>
    </div>
  );
}
