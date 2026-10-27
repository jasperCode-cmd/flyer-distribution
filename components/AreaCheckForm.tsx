"use client";

import { areasSearchHref } from "@/lib/area-search";

// "Check if we cover you" on the homepage: a plain GET form to /areas?q=, so
// it works without JavaScript. With it, the search is trimmed and an empty
// box goes to plain /areas.
export default function AreaCheckForm() {
  return (
    <form
      action="/areas"
      method="get"
      role="search"
      className="w-full lg:max-w-md"
      onSubmit={(e) => {
        e.preventDefault();
        window.location.assign(areasSearchHref(String(new FormData(e.currentTarget).get("q") ?? "")));
      }}
    >
      <label htmlFor="area-check" className="block text-sm font-semibold text-white mb-2">
        Check if we cover you
      </label>
      <div className="flex gap-2">
        <input
          id="area-check"
          name="q"
          type="search"
          placeholder="Town or postcode, e.g. BH14"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          className="min-w-0 flex-1 h-12 rounded-md bg-white px-4 text-base text-gray-900 placeholder:text-gray-500 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#facc15]"
        />
        <button
          type="submit"
          className="h-12 shrink-0 rounded-md bg-[#facc15] px-6 font-bold text-[#1e3a8a] transition-colors hover:bg-yellow-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-blue-900"
        >
          Check
        </button>
      </div>
    </form>
  );
}
