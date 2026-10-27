import { AREA_PAGES, type AreaSlug } from "@/lib/area-pages";
import { AREA_REGIONS, type OverviewCard, type RegionId } from "@/lib/area-search";
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

// The homepage's Areas We Cover columns: the same regions, names and links
// as the cards, each led by the town its region is named after (New Forest
// heads New Forest & Waterside), then the rest in the regions' own order.
export function regionColumns(): { id: RegionId; label: string; areas: { slug: AreaSlug; name: string; href: string }[] }[] {
  const cards = overviewCards();
  return AREA_REGIONS.map((region) => {
    const own = cards.filter((c) => c.regionId === region.id);
    const lead = own.filter((c) => region.label.startsWith(c.name));
    return {
      id: region.id,
      label: region.label,
      areas: [...lead, ...own.filter((c) => !lead.includes(c))].map(({ slug, name, href }) => ({ slug, name, href })),
    };
  });
}
