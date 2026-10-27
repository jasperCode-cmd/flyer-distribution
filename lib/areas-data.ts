// The 15 area pages' links and short blurbs, used for the cards on the
// /areas overview (see lib/areas-overview.ts). Their regions, as on /areas
// and the homepage, come from AREA_REGIONS in lib/area-search.ts.
export interface AreaEntry {
  name: string;
  href: string;
  desc: string;
  population: number;
  populationLabel: string;
}

export const areas: AreaEntry[] = [
  {
    name: "Southampton",
    href: "/areas/leaflet-distribution-southampton",
    desc: "Hampshire's largest city. Residential coverage across all major postcode areas.",
    population: 248922,
    populationLabel: "Residents (2021 Census)",
  },
  {
    name: "Bournemouth",
    href: "/areas/leaflet-distribution-bournemouth",
    desc: "Major Dorset resort town with strong consumer footfall.",
    population: 196455,
    populationLabel: "Residents (2021 Census)",
  },
  {
    name: "Poole",
    href: "/areas/leaflet-distribution-poole",
    desc: "Affluent harbour town with excellent residential distribution routes.",
    population: 144800,
    populationLabel: "Residents (2021 Census)",
  },
  {
    name: "Winchester",
    href: "/areas/leaflet-distribution-winchester",
    desc: "Historic cathedral city and prosperous Hampshire county town.",
    population: 48478,
    populationLabel: "Residents (2021 Census)",
  },
  {
    name: "New Forest",
    href: "/areas/leaflet-distribution-new-forest",
    desc: "Towns and villages across one of Hampshire's most distinctive districts.",
    population: 175800,
    populationLabel: "Residents, New Forest District (2021 Census)",
  },
  {
    name: "Ringwood",
    href: "/areas/leaflet-distribution-ringwood",
    desc: "Market town on the New Forest edge, close to the Dorset border.",
    population: 14618,
    populationLabel: "Residents (2021 Census)",
  },
  {
    name: "Christchurch",
    href: "/areas/leaflet-distribution-christchurch",
    desc: "Coastal market town on the Dorset border, with strong residential coverage across BH23 postcodes.",
    population: 31372,
    populationLabel: "Residents (2021 Census)",
  },
  {
    name: "Eastleigh",
    href: "/areas/leaflet-distribution-eastleigh",
    desc: "One of Hampshire's largest towns with strong residential coverage across SO50 postcodes.",
    population: 24011,
    populationLabel: "Residents (2011 Census)",
  },
  {
    name: "Dorset",
    href: "/areas/leaflet-distribution-dorset",
    desc: "Coverage across Dorset, including Bournemouth, Poole, Christchurch and surrounding towns.",
    population: 781401,
    populationLabel: "Residents across Dorset (2021 Census)",
  },
  {
    name: "Romsey",
    href: "/areas/leaflet-distribution-romsey",
    desc: "Historic market town in the Test Valley, between Southampton and Salisbury.",
    population: 14442,
    populationLabel: "Residents (2021 Census)",
  },
  {
    name: "Hythe",
    href: "/areas/leaflet-distribution-hythe",
    desc: "Waterside village looking out over Southampton Water, with a working marina.",
    population: 20526,
    populationLabel: "Residents, Hythe & Dibden parish (2021 Census)",
  },
  {
    name: "Totton",
    href: "/areas/leaflet-distribution-totton",
    desc: "One of the largest towns on the edge of the New Forest, near the River Test.",
    population: 28094,
    populationLabel: "Residents, Totton & Eling parish (2021 Census)",
  },
  {
    name: "Hedge End",
    href: "/areas/leaflet-distribution-hedge-end",
    desc: "Residential town east of Southampton, home to a well-known retail park.",
    population: 22527,
    populationLabel: "Residents (2021 Census)",
  },
  {
    name: "Chandler's Ford",
    href: "/areas/leaflet-distribution-chandlers-ford",
    desc: "Residential part of the Eastleigh borough, with established neighbourhoods like Hiltingbury and Valley Park.",
    population: 23918,
    populationLabel: "Residents (2021 Census)",
  },
  {
    name: "Brockenhurst",
    href: "/areas/leaflet-distribution-brockenhurst",
    desc: "One of the New Forest's best-known villages, with ponies wandering along Brookley Road.",
    population: 3488,
    populationLabel: "Residents (2021 Census)",
  },
];
