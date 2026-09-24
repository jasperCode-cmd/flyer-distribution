// Single source of truth for the 15 coverage-area towns, used on the
// /areas overview page and the homepage's "Areas We Cover" section. Adding
// a new town only requires a new entry here with the right region, and
// both pages group by region and sort alphabetically automatically.
export type Region = "Hampshire" | "Dorset";

export interface AreaEntry {
  name: string;
  href: string;
  desc: string;
  region: Region;
  population: number;
  populationLabel: string;
}

export const regions: Region[] = ["Hampshire", "Dorset"];

export const areas: AreaEntry[] = [
  {
    name: "Southampton",
    href: "/areas/southampton",
    desc: "Hampshire's largest city. Residential coverage across all major postcode areas.",
    region: "Hampshire",
    population: 248922,
    populationLabel: "Residents (2021 Census)",
  },
  {
    name: "Bournemouth",
    href: "/areas/bournemouth",
    desc: "Major Dorset resort town with strong consumer footfall.",
    region: "Dorset",
    population: 196455,
    populationLabel: "Residents (2021 Census)",
  },
  {
    name: "Poole",
    href: "/areas/poole",
    desc: "Affluent harbour town with excellent residential distribution routes.",
    region: "Dorset",
    population: 144800,
    populationLabel: "Residents (2021 Census)",
  },
  {
    name: "Winchester",
    href: "/areas/winchester",
    desc: "Historic cathedral city and prosperous Hampshire county town.",
    region: "Hampshire",
    population: 48478,
    populationLabel: "Residents (2021 Census)",
  },
  {
    name: "New Forest",
    href: "/areas/new-forest",
    desc: "Towns and villages across one of Hampshire's most distinctive districts.",
    region: "Hampshire",
    population: 175800,
    populationLabel: "Residents, New Forest District (2021 Census)",
  },
  {
    name: "Ringwood",
    href: "/areas/ringwood",
    desc: "Market town on the New Forest edge, close to the Dorset border.",
    region: "Hampshire",
    population: 14618,
    populationLabel: "Residents (2021 Census)",
  },
  {
    name: "Christchurch",
    href: "/areas/christchurch",
    desc: "Coastal market town on the Dorset border, with strong residential coverage across BH23 postcodes.",
    region: "Dorset",
    population: 31372,
    populationLabel: "Residents (2021 Census)",
  },
  {
    name: "Eastleigh",
    href: "/areas/eastleigh",
    desc: "One of Hampshire's largest towns with strong residential coverage across SO50 postcodes.",
    region: "Hampshire",
    population: 24011,
    populationLabel: "Residents (2011 Census)",
  },
  {
    name: "Dorset",
    href: "/areas/dorset",
    desc: "County-wide coverage across Dorset including Bournemouth, Poole, Christchurch, Weymouth and surrounding towns.",
    region: "Dorset",
    population: 781401,
    populationLabel: "Residents across Dorset (2021 Census)",
  },
  {
    name: "Romsey",
    href: "/areas/romsey",
    desc: "Historic market town in the Test Valley, between Southampton and Salisbury.",
    region: "Hampshire",
    population: 14442,
    populationLabel: "Residents (2021 Census)",
  },
  {
    name: "Hythe",
    href: "/areas/hythe",
    desc: "Waterside village looking out over Southampton Water, with a working marina.",
    region: "Hampshire",
    population: 20526,
    populationLabel: "Residents, Hythe & Dibden parish (2021 Census)",
  },
  {
    name: "Totton",
    href: "/areas/totton",
    desc: "One of the largest towns on the edge of the New Forest, near the River Test.",
    region: "Hampshire",
    population: 28094,
    populationLabel: "Residents, Totton & Eling parish (2021 Census)",
  },
  {
    name: "Hedge End",
    href: "/areas/hedge-end",
    desc: "Residential town east of Southampton, home to a well-known retail park.",
    region: "Hampshire",
    population: 22527,
    populationLabel: "Residents (2021 Census)",
  },
  {
    name: "Chandler's Ford",
    href: "/areas/chandlers-ford",
    desc: "Residential part of the Eastleigh borough, with established neighbourhoods like Hiltingbury and Valley Park.",
    region: "Hampshire",
    population: 23918,
    populationLabel: "Residents (2021 Census)",
  },
  {
    name: "Brockenhurst",
    href: "/areas/brockenhurst",
    desc: "One of the New Forest's best-known villages, with ponies wandering along Brookley Road.",
    region: "Hampshire",
    population: 3488,
    populationLabel: "Residents (2021 Census)",
  },
];
