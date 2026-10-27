import { AREA_PAGES } from "@/lib/area-pages";
import { AREA_REGIONS, type OverviewCard } from "@/lib/area-search";
import { areas } from "@/lib/areas-data";
import { formatPostcodeRanges } from "@/lib/postcode-ranges";

// The /areas overview's 15 cards, in region order: each page's name, postcodes
// and homes from lib/area-pages.ts, and its blurb from lib/areas-data.ts word
// for word. Built on the server, so the browser gets only what the cards show
// and search.

// 107500 as "107,500".
const thousands = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

export function overviewCards(): OverviewCard[] {
  return AREA_REGIONS.flatMap((region) =>
    region.slugs.map((slug) => {
      const page = AREA_PAGES[slug];
      const href = `/areas/leaflet-distribution-${slug}`;
      const entry = areas.find((a) => a.href === href);
      if (!entry) throw new Error(`No overview blurb for ${slug}`);
      const codes = page.postcodes.map((p) => p.code);
      return {
        slug,
        name: page.name,
        href,
        regionId: region.id,
        regionLabel: region.label,
        blurb: entry.desc,
        range: formatPostcodeRanges(codes),
        homes: `About ${thousands(page.homes)} homes`,
        codes,
        // Its places, less the bare "Town centre" and "City centre", which name no town.
        places: [...new Set(page.postcodes.flatMap((p) => p.places))].filter((p) => !/^(town|city) centre$/i.test(p)),
        wide: page.wide,
      };
    })
  );
}
