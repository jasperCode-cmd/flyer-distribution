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
}

export const regions: Region[] = ["Hampshire", "Dorset"];

export const areas: AreaEntry[] = [
  {
    name: "Southampton",
    href: "/areas/southampton",
    desc: "Hampshire's largest city. Residential coverage across all major postcode areas.",
    region: "Hampshire",
  },
  {
    name: "Bournemouth",
    href: "/areas/bournemouth",
    desc: "Major Dorset resort town with strong consumer footfall.",
    region: "Dorset",
  },
  {
    name: "Poole",
    href: "/areas/poole",
    desc: "Affluent harbour town with excellent residential distribution routes.",
    region: "Dorset",
  },
  {
    name: "Winchester",
    href: "/areas/winchester",
    desc: "Historic cathedral city and prosperous Hampshire county town.",
    region: "Hampshire",
  },
  {
    name: "New Forest",
    href: "/areas/new-forest",
    desc: "Towns and villages across one of Hampshire's most distinctive districts.",
    region: "Hampshire",
  },
  {
    name: "Ringwood",
    href: "/areas/ringwood",
    desc: "Market town on the New Forest edge, close to the Dorset border.",
    region: "Hampshire",
  },
  {
    name: "Christchurch",
    href: "/areas/christchurch",
    desc: "Coastal market town on the Dorset border, with strong residential coverage across BH23 postcodes.",
    region: "Dorset",
  },
  {
    name: "Eastleigh",
    href: "/areas/eastleigh",
    desc: "One of Hampshire's largest towns with strong residential coverage across SO50 postcodes.",
    region: "Hampshire",
  },
  {
    name: "Dorset",
    href: "/areas/dorset",
    desc: "County-wide coverage across Dorset including Bournemouth, Poole, Christchurch, Weymouth and surrounding towns.",
    region: "Dorset",
  },
  {
    name: "Romsey",
    href: "/areas/romsey",
    desc: "Historic market town in the Test Valley, between Southampton and Salisbury.",
    region: "Hampshire",
  },
  {
    name: "Hythe",
    href: "/areas/hythe",
    desc: "Waterside village looking out over Southampton Water, with a working marina.",
    region: "Hampshire",
  },
  {
    name: "Totton",
    href: "/areas/totton",
    desc: "One of the largest towns on the edge of the New Forest, near the River Test.",
    region: "Hampshire",
  },
  {
    name: "Hedge End",
    href: "/areas/hedge-end",
    desc: "Residential town east of Southampton, home to a well-known retail park.",
    region: "Hampshire",
  },
  {
    name: "Chandler's Ford",
    href: "/areas/chandlers-ford",
    desc: "Residential part of the Eastleigh borough, with established neighbourhoods like Hiltingbury and Valley Park.",
    region: "Hampshire",
  },
  {
    name: "Brockenhurst",
    href: "/areas/brockenhurst",
    desc: "One of the New Forest's best-known villages, with ponies wandering along Brookley Road.",
    region: "Hampshire",
  },
];
