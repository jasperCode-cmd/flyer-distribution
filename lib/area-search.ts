import type { AreaSlug } from "@/lib/area-pages";

// The /areas overview's regions, search and results line. Pure, and safe in
// the browser: the cards themselves (built from lib/area-pages.ts by
// lib/areas-overview.ts) are passed in, so each page's own postcode list is
// the only one the search uses.

export const AREA_REGIONS = [
  { id: "southampton-eastleigh", label: "Southampton & Eastleigh", slugs: ["southampton", "eastleigh", "chandlers-ford", "hedge-end"] },
  { id: "winchester-test-valley", label: "Winchester & Test Valley", slugs: ["winchester", "romsey"] },
  { id: "new-forest-waterside", label: "New Forest & Waterside", slugs: ["totton", "hythe", "brockenhurst", "ringwood", "new-forest"] },
  { id: "bournemouth-poole-dorset", label: "Bournemouth, Poole & Dorset", slugs: ["bournemouth", "poole", "christchurch", "dorset"] },
] as const satisfies readonly { id: string; label: string; slugs: readonly AreaSlug[] }[];

export type RegionId = (typeof AREA_REGIONS)[number]["id"];

export type OverviewCard = {
  slug: AreaSlug;
  name: string;
  href: string;
  regionId: RegionId;
  regionLabel: string;
  blurb: string;
  // "SO14 to SO19" and "About 107,500 homes".
  range: string;
  homes: string;
  // The page's postcode districts and the places it lists under them.
  codes: string[];
  places: string[];
  // New Forest and Dorset, listed after the town pages in search results.
  wide: boolean;
};

export type SearchableArea = Pick<OverviewCard, "slug" | "name" | "codes" | "places" | "wide">;

// Lower case, apostrophes dropped, anything else between words a single space.
const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const startsAWord = (text: string, q: string) => {
  const t = words(text);
  return t.startsWith(q) || t.includes(` ${q}`);
};

const DISTRICT = /^[A-Z]{1,2}\d[A-Z\d]?$/;

// The postcode district a search names, if it names one: a district (BH14),
// a full postcode with or without its space (SO51 8AB, so518ab), or one that
// is still being typed (SO51 8).
export function postcodeDistrict(query: string): string | null {
  const q = query.trim().toUpperCase().replace(/\s+/g, " ");
  const spaced = /^([A-Z]{1,2}\d[A-Z\d]?) \d[A-Z]{0,2}$/.exec(q);
  if (spaced) return spaced[1];
  const compact = q.replace(/ /g, "");
  if (DISTRICT.test(compact)) return compact;
  const full = /^([A-Z]{1,2}\d[A-Z\d]?)\d[A-Z]{0,2}$/.exec(compact);
  return full ? full[1] : null;
}

// The areas a search finds, town pages first and then New Forest and Dorset.
// A postcode finds the pages that list its district; a district still being
// typed (SO5) finds the districts it starts, until one matches exactly; the
// letters alone (BH) find every page with districts there. A town name finds
// its page from the start of any word, and from three letters the places
// each page lists under its postcodes count too.
export function matchAreas<T extends SearchableArea>(areas: readonly T[], query: string): T[] {
  const q = words(query);
  if (!q) return [...areas];
  const district = postcodeDistrict(query) ?? "";
  const compact = query.toUpperCase().replace(/\s+/g, "");
  const exact = district !== "" && areas.some((a) => a.codes.includes(district));
  const stillTyping = district !== "" && !exact && DISTRICT.test(compact);
  const letters = /^[A-Z]{1,2}$/.test(compact) ? compact : null;
  const found = areas.filter(
    (a) =>
      (exact && a.codes.includes(district)) ||
      (stillTyping && a.codes.some((c) => c.startsWith(district))) ||
      (letters !== null && a.codes.some((c) => c.replace(/\d.*$/, "") === letters)) ||
      startsAWord(a.name, q) ||
      (q.length >= 3 && a.places.some((p) => startsAWord(p, q)))
  );
  return [...found.filter((a) => !a.wide), ...found.filter((a) => a.wide)];
}

// A search from another page, such as the homepage's "Check if we cover you":
// /areas?q=BH14, or plain /areas when nothing was typed. The explorer reads
// the same q back when it opens.
export const areasSearchHref = (query: string) => {
  const q = query.trim();
  return q ? `/areas?${new URLSearchParams({ q })}` : "/areas";
};
export const queryFromSearch = (search: string) => (new URLSearchParams(search).get("q") ?? "").trim();

// What the page shows: a search looks across every region, otherwise the
// chosen region (or all of them). Typing a search moves the chips back to
// All areas, and choosing a region clears the search.
export type ExplorerState = { query: string; region: RegionId | "all" };
export const START: ExplorerState = { query: "", region: "all" };
export const searchFor = (state: ExplorerState, query: string): ExplorerState => ({ query, region: query.trim() ? "all" : state.region });
export const chooseRegion = (region: RegionId | "all"): ExplorerState => ({ query: "", region });

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export function visibleAreas<T extends SearchableArea & Pick<OverviewCard, "regionId">>(
  cards: readonly T[],
  state: ExplorerState
): { shown: T[]; line: string; empty: boolean } {
  const query = state.query.trim();
  if (query) {
    const shown = matchAreas(cards, query);
    const line = shown.length
      ? `${shown.length} ${plural(shown.length, "area matches", "areas match")} "${query}"`
      : `No areas match "${query}"`;
    return { shown, line, empty: shown.length === 0 };
  }
  if (state.region === "all") return { shown: [...cards], line: `Showing all ${cards.length} areas`, empty: false };
  const region = AREA_REGIONS.find((r) => r.id === state.region)!;
  const shown = cards.filter((c) => c.regionId === region.id);
  return { shown, line: `Showing ${shown.length} ${plural(shown.length, "area", "areas")} in ${region.label}`, empty: false };
}
