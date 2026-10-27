// The 15 area pages' own details, drawn by components/AreaPage.tsx. Each
// page's copy is its existing copy, word for word, as text and links, with
// only the corrections asked for: Poole's, Dorset's and Bournemouth's
// postcode ranges, Dorset's "covering everything" now "ranging",
// Southampton's "around 250,000 residents", and Fordingbridge out of the New
// Forest copy (SP6 is in its postcodes instead). Its postcodes and
// neighbourhood names are as confirmed, and its homes figure is the Census
// 2021 households in those postcode districts, from the Area Planner's data,
// rounded to the nearest 500. Its hero is its coverage map, and a photo sits
// beside its About copy only when it clearly shows the place itself.

import { formatPostcodeRanges } from "@/lib/postcode-ranges";

export type AreaSlug =
  | "southampton"
  | "bournemouth"
  | "poole"
  | "winchester"
  | "new-forest"
  | "ringwood"
  | "christchurch"
  | "dorset"
  | "eastleigh"
  | "romsey"
  | "hythe"
  | "totton"
  | "hedge-end"
  | "chandlers-ford"
  | "brockenhurst"
;

export type ReviewId = "kola" | "new-arts" | "auriel" | "victoria" | "hendonis" | "cozy" | "homebites";

export type Review = { quote: string; name: string; business?: string; label: "Google Review" | "Client review" };

// Real reviews from our testimonials, word for word (Hendonis Salon's without its emoji).
export const REVIEWS: Record<ReviewId, Review> = {
  "kola": {
    quote: "Excellent flyer distribution service from start to finish. The team was professional, reliable, and kept us updated throughout the campaign.",
    name: "Kola Construction",
    label: "Google Review",
  },
  "new-arts": {
    quote: "Outstanding service! Great communication; reasonably priced; excellent job! I would highly recommend these guys. I will be taking them again.",
    name: "John Lofthouse",
    business: "New Arts",
    label: "Google Review",
  },
  "auriel": {
    quote: "Really pleased with the service! Everything was handled efficiently, and the flyers were distributed exactly within the area I wanted to target. Communication was great throughout, and the pricing was very reasonable compared with other distributors I contacted. The whole process was straightforward and reliable, and I'd definitely use the service again. Highly recommend!",
    name: "Auriel Cochrane",
    business: "The Relocation Specialists, The Healing Hub and Elisha's Pampered Paws",
    label: "Google Review",
  },
  "victoria": {
    quote: "Great communication from the start. Very polite competitive prices will definitely be using again. Thank you",
    name: "Body by Victoria",
    label: "Google Review",
  },
  "hendonis": {
    quote: "Incredible service from start to finish, these guys deal with you in a really professional way and get the job done fast. Would really recommend",
    name: "Hendonis Salon",
    label: "Google Review",
  },
  "cozy": {
    quote: "Fast and reliable team service all around",
    name: "Cozy Stoves",
    label: "Client review",
  },
  "homebites": {
    quote: "10/10 service for my cake business! Very professional, would definitely recommend.",
    name: "Homebites Bakery",
    label: "Google Review",
  },
};

export type AreaPageData = {
  slug: AreaSlug;
  // As a label (breadcrumb, cards, pills) and in a sentence ("the New Forest").
  name: string;
  inName: string;
  eyebrow: string;
  // New Forest and Dorset: postcodes "we deliver to", never "every" or "all of".
  wide: boolean;
  postcodes: { code: string; places: string[] }[];
  homes: number;
  nearby: AreaSlug[];
  // A photo of the place itself (its own photo or a landmark) for the About section; most pages have none.
  photo?: { src: string; alt: string };
  review: ReviewId;
  // Its own copy: paragraphs of text and links to other pages on the site.
  copy: (string | { href: string; text: string })[][];
  // Answers to: which parts we cover, one or two postcodes, other towns in one campaign, and how they know.
  faqs: [string, string, string, string];
  question3?: string;
};

// Each page's coverage map, in public/area-maps: 1320 by 990, with the map
// credits printed in the image itself.
export const coverageMapSrc = (slug: AreaSlug) => `/area-maps/area-map-${slug}.webp`;
export const coverageMapAlt = (area: AreaPageData) =>
  `Map of the ${area.name} postcodes we deliver to: ${formatPostcodeRanges(area.postcodes.map((p) => p.code))}, with neighbouring postcodes shown around them`;

export const AREA_PAGES: Record<AreaSlug, AreaPageData> = {
  "southampton": {
    slug: "southampton",
    name: "Southampton",
    inName: "Southampton",
    eyebrow: "Southampton, Hampshire",
    wide: false,
    postcodes: [
      { code: "SO14", places: ["City centre", "Bevois"] },
      { code: "SO15", places: ["Shirley", "Freemantle", "Millbrook", "Polygon"] },
      { code: "SO16", places: ["Bassett", "Coxford", "Redbridge", "Rownhams", "Nursling", "Chilworth"] },
      { code: "SO17", places: ["Portswood", "Swaythling"] },
      { code: "SO18", places: ["Bitterne Park", "Harefield", "West End"] },
      { code: "SO19", places: ["Sholing", "Woolston", "Peartree", "Thornhill"] },
    ],
    homes: 107_500,
    nearby: ["hedge-end", "totton", "hythe", "eastleigh", "romsey", "winchester", "new-forest"],
    review: "kola",
    copy: [
      [
        "Southampton is Hampshire's largest city, home to around 250,000 residents across diverse neighbourhoods. Our distribution teams cover all major postcodes including SO14, SO15, SO16, SO17, SO18, SO19, and surrounding areas.",
      ],
      [
        "Whether you're targeting the city centre, Shirley, Portswood, Bitterne, or the waterfront areas, we deliver your flyers reliably and efficiently to the right letterboxes. Campaigns here often extend out to ",
        { href: "/areas/leaflet-distribution-romsey", text: "Romsey" },
        " too.",
      ],
      [
        "We work with restaurants, tradespeople, estate agents, gyms, retailers, and many other local businesses to help them grow their customer base through our full range of ",
        { href: "/services", text: "leaflet distribution services" },
        ". We also run ",
        { href: "/services/hand-to-hand-distribution", text: "hand-to-hand distribution" },
        " at Westquay Shopping Centre, putting leaflets straight into shoppers' hands.",
      ],
    ],
    faqs: [
      "We deliver across SO14 to SO19: the city centre and Bevois (SO14), Shirley and Freemantle (SO15), Bassett, Redbridge and Rownhams (SO16), Portswood and Swaythling (SO17), Bitterne Park and West End (SO18), and Sholing and Woolston (SO19).",
      "Yes. You could start with SO15 for Shirley or SO17 for Portswood and Swaythling, for example, and narrow a district down to individual postcode sectors if you only want part of it.",
      "Yes. Southampton campaigns can take in Eastleigh, Totton, Hedge End and Romsey on the edge of the city, with Hythe, Winchester and the New Forest further out, all on one quote and one plan.",
      "Each Southampton round is GPS tracked by the distributor delivering it. When your campaign is finished we send a route report showing the recorded route for each round across the city.",
    ],
  },
  "bournemouth": {
    slug: "bournemouth",
    name: "Bournemouth",
    inName: "Bournemouth",
    eyebrow: "Bournemouth, Dorset",
    wide: false,
    postcodes: [
      { code: "BH1", places: ["Town centre", "Springbourne", "East Cliff"] },
      { code: "BH2", places: ["Town centre", "West Cliff"] },
      { code: "BH3", places: ["Talbot Woods"] },
      { code: "BH4", places: ["Westbourne", "West Cliff"] },
      { code: "BH5", places: ["Boscombe", "Pokesdown"] },
      { code: "BH6", places: ["Southbourne", "Tuckton"] },
      { code: "BH7", places: ["Littledown", "Iford"] },
      { code: "BH8", places: ["Queen's Park", "Strouden Park", "Throop", "Holdenhurst"] },
      { code: "BH9", places: ["Moordown", "Winton", "Muscliff"] },
      { code: "BH10", places: ["Redhill", "Northbourne", "Kinson"] },
      { code: "BH11", places: ["Bearwood", "Kinson", "Wallisdown"] },
    ],
    homes: 86_500,
    nearby: ["poole", "christchurch", "dorset"],
    photo: { src: "https://images.pexels.com/photos/29030837/pexels-photo-29030837.jpeg?auto=compress&cs=tinysrgb&w=800", alt: "Bournemouth pier and ferris wheel" },
    review: "auriel",
    copy: [
      [
        "Bournemouth is one of Dorset's largest towns, known for its beaches, vibrant town centre, and large student population. We cover BH1 through BH11 and surrounding postcodes, reaching residential areas across all neighbourhoods, backed by our full range of ",
        { href: "/services", text: "distribution services" },
        ".",
      ],
      [
        "Whether you need to reach the Westbourne boutique area, Boscombe, Winton, or the leafy suburbs, our experienced distributors know these routes well. Many campaigns here run alongside neighbouring ",
        { href: "/areas/leaflet-distribution-poole", text: "Poole" },
        ". ",
        { href: "/areas/leaflet-distribution-christchurch", text: "Christchurch" },
        ", just along the coast, is another popular pairing.",
      ],
      [
        "Bournemouth's large student population and year-round tourism also make it one of the most responsive areas for campaign testing: high footfall, high density, and a wide mix of demographics within a compact postcode range.",
      ],
    ],
    faqs: [
      "We cover BH1 to BH11, from the town centre, East Cliff and Westbourne to Boscombe, Southbourne and Tuckton in the east, Talbot Woods and Queen's Park in the middle, and Moordown, Winton, Kinson and Wallisdown to the north.",
      "Yes. BH5 and BH6 together reach Boscombe, Pokesdown and Southbourne, for example, while BH9 alone covers Moordown, Winton and Muscliff. Districts can be split into sectors too.",
      "Yes. Bournemouth campaigns often run alongside Poole and Christchurch, and they can grow into a wider Dorset campaign planned and quoted as one.",
      "Our Bournemouth distributors carry GPS tracking on each round, and once the last leaflets are delivered you get a route report covering the BH postcodes in your campaign.",
    ],
  },
  "poole": {
    slug: "poole",
    name: "Poole",
    inName: "Poole",
    eyebrow: "Poole, Dorset",
    wide: false,
    postcodes: [
      { code: "BH12", places: ["Alderney", "Newtown", "Heatherlands", "Branksome"] },
      { code: "BH13", places: ["Canford Cliffs", "Branksome Park", "Sandbanks"] },
      { code: "BH14", places: ["Parkstone", "Penn Hill", "Lilliput"] },
      { code: "BH15", places: ["Poole town centre", "Hamworthy", "Oakdale"] },
      { code: "BH16", places: ["Upton", "Lytchett Matravers", "Lytchett Minster"] },
      { code: "BH17", places: ["Canford Heath", "Creekmoor"] },
      { code: "BH18", places: ["Broadstone"] },
    ],
    homes: 67_500,
    nearby: ["bournemouth", "dorset", "ringwood"],
    review: "new-arts",
    copy: [
      [
        "Poole is one of the most affluent towns in Dorset, with prestigious areas like Sandbanks, Canford Cliffs, and Branksome Park attracting high-income households. Our distributors cover BH12 through BH18 and surrounding postcodes as part of ",
        { href: "/services", text: "the service we offer" },
        " across the wider area.",
      ],
      [
        "For businesses targeting higher-income demographics, Poole's waterfront and marina postcodes offer some of the highest-value residential distribution in Dorset, particularly for luxury services, premium restaurants, and home improvement. We also run county-wide ",
        { href: "/areas/leaflet-distribution-dorset", text: "Dorset campaigns" },
        " for businesses wanting broader reach.",
      ],
      [
        "We also cover Parkstone, Upton, Hamworthy, and the wider residential areas around the harbour. Many campaigns here extend naturally into neighbouring ",
        { href: "/areas/leaflet-distribution-bournemouth", text: "Bournemouth" },
        ". Others reach further, across the county boundary into ",
        { href: "/areas/leaflet-distribution-ringwood", text: "Ringwood" },
        ".",
      ],
    ],
    faqs: [
      "We deliver across BH12 to BH18: Branksome and Alderney (BH12), Canford Cliffs, Branksome Park and Sandbanks (BH13), Parkstone and Lilliput (BH14), Poole town centre and Hamworthy (BH15), Upton and the Lytchetts (BH16), Canford Heath and Creekmoor (BH17) and Broadstone (BH18).",
      "Yes. BH13 and BH14 on their own reach Sandbanks, Canford Cliffs and Parkstone, and BH18 covers Broadstone by itself. Any district can also be narrowed to selected sectors.",
      "Yes. Poole campaigns can extend next door into Bournemouth, and Ringwood or a broader Dorset campaign can be added to the same plan.",
      "Rounds in Poole are recorded by GPS as they are delivered, from Hamworthy to Canford Cliffs, and we send a route report after the final round.",
    ],
  },
  "winchester": {
    slug: "winchester",
    name: "Winchester",
    inName: "Winchester",
    eyebrow: "Winchester, Hampshire",
    wide: false,
    postcodes: [
      { code: "SO21", places: ["Itchen Valley", "Twyford", "Colden Common", "Micheldever", "Owslebury"] },
      { code: "SO22", places: ["Badger Farm", "Oliver's Battery", "Harestock", "Littleton", "Hursley"] },
      { code: "SO23", places: ["Winchester city centre", "Kings Worthy", "Headbourne Worthy"] },
      { code: "SO24", places: ["New Alresford", "Old Alresford", "Cheriton", "Bramdean"] },
      { code: "SO32", places: ["Bishop's Waltham", "Shedfield", "Botley", "Meon Valley"] },
    ],
    homes: 44_500,
    nearby: ["eastleigh", "southampton", "romsey", "new-forest"],
    photo: { src: "https://images.pexels.com/photos/11167778/pexels-photo-11167778.jpeg?auto=compress&cs=tinysrgb&w=800", alt: "Winchester Cathedral" },
    review: "homebites",
    copy: [
      [
        "Winchester is Hampshire's historic county town, consistently ranked among the best places to live in the UK. With high average household incomes and a thriving independent business scene, leaflet distribution here reaches an engaged, local audience.",
      ],
      [
        "We cover SO21, SO22, SO23, and surrounding postcode areas including the city centre, St Cross, Badger Farm, Harestock, and the outlying villages such as Colden Common and Bishopstoke. We've run campaigns as far out as Micheldever too, part of ",
        { href: "/case-studies", text: "our recent work" },
        ".",
      ],
      [
        "Winchester's county town professional base makes it particularly effective for premium services such as home improvements, fine dining, private schools, and specialist professional services, all delivered through ",
        { href: "/services", text: "our full leaflet distribution service" },
        ". For reaching other businesses directly, we also offer ",
        { href: "/services/b2b-distribution", text: "B2B leaflet distribution" },
        " around Winchester's business parks and professional quarters, alongside our standard door-to-door rounds.",
      ],
    ],
    faqs: [
      "We cover the city and its villages across SO21, SO22, SO23, SO24 and SO32: the city centre and Kings Worthy (SO23), Badger Farm, Oliver's Battery and Harestock (SO22), the Itchen Valley and Twyford (SO21), the Alresfords (SO24), and Bishop's Waltham and the Meon Valley (SO32).",
      "Yes. A city-focused campaign might use SO22 and SO23, while SO24 or SO32 suit businesses serving Alresford or Bishop's Waltham. You can also pick sectors within a district.",
      "Yes. Winchester campaigns can extend south to Eastleigh and Southampton, or west to Romsey, and the New Forest can be included in the same campaign.",
      "Winchester rounds are GPS tracked from start to finish, in the city and out in the villages, and at the end you receive a route report for the postcodes we delivered to.",
    ],
  },
  "new-forest": {
    slug: "new-forest",
    name: "New Forest",
    inName: "the New Forest",
    eyebrow: "New Forest, Hampshire",
    wide: true,
    postcodes: [
      { code: "SO40", places: ["Totton", "Eling", "Marchwood", "Netley Marsh", "Ashurst", "Copythorne"] },
      { code: "SO41", places: ["Lymington", "Pennington", "Milford on Sea", "Sway", "Boldre"] },
      { code: "SO42", places: ["Brockenhurst", "Beaulieu", "East Boldre"] },
      { code: "SO43", places: ["Lyndhurst", "Minstead"] },
      { code: "SO45", places: ["Hythe", "Dibden Purlieu", "Fawley", "Blackfield", "Holbury"] },
      { code: "BH24", places: ["Ringwood", "St Leonards", "St Ives", "Ellingham", "Burley"] },
      { code: "BH25", places: ["New Milton", "Barton on Sea", "Ashley"] },
      { code: "SP6", places: ["Fordingbridge"] },
    ],
    homes: 80_000,
    nearby: ["brockenhurst", "hythe", "totton", "ringwood", "southampton", "bournemouth"],
    review: "hendonis",
    copy: [
      [
        "The New Forest is a unique area covering a wide spread of market towns, villages, and residential communities across southern Hampshire. Key towns include Lyndhurst, ",
        { href: "/areas/leaflet-distribution-brockenhurst", text: "Brockenhurst" },
        ", and ",
        { href: "/areas/leaflet-distribution-hythe", text: "Hythe" },
        ", alongside a network of smaller villages with loyal, locally-minded residents.",
      ],
      [
        "We cover SO40, SO41, SO42, SO43, and surrounding postcode areas, delivering to households across the district. The New Forest demographic tends to be established and community-focused, making it well suited to local services, home improvement businesses, and independent retailers.",
      ],
      [
        "Vehicle ",
        { href: "/services", text: "leaflet distribution" },
        " is also available in car parks and high-footfall locations across New Forest towns for businesses looking to reach visitors and day-trippers as well as residents. We've also delivered statutory notice work here, including a road closure campaign around Lyndhurst that's part of ",
        { href: "/case-studies", text: "our portfolio of work" },
        ".",
      ],
    ],
    faqs: [
      "Our New Forest coverage takes in eight postcode districts: SO40 (Totton and Marchwood), SO41 (Lymington, Milford on Sea and Sway), SO42 (Brockenhurst and Beaulieu), SO43 (Lyndhurst and Minstead), SO45 (Hythe and Fawley), BH24 (Ringwood and Burley), BH25 (New Milton and Barton on Sea) and SP6 (Fordingbridge).",
      "Yes. You might choose SO41 for Lymington or BH25 for New Milton on their own, and a district can be narrowed further to the sectors that suit your business.",
      "Yes. A New Forest campaign can combine towns such as Totton, Hythe, Brockenhurst and Ringwood, and reach out to Southampton or Bournemouth too, with one quote and one plan.",
      "Each New Forest round is GPS tracked, the rural village rounds included, and you receive a route report once the campaign is complete.",
    ],
    question3: "Can you deliver in the New Forest and nearby towns in one campaign?",
  },
  "ringwood": {
    slug: "ringwood",
    name: "Ringwood",
    inName: "Ringwood",
    eyebrow: "Ringwood, Hampshire",
    wide: false,
    postcodes: [
      { code: "BH24", places: ["Ringwood", "St Leonards", "St Ives", "Ellingham", "Burley"] },
    ],
    homes: 11_000,
    nearby: ["new-forest", "bournemouth", "poole"],
    review: "victoria",
    copy: [
      [
        "Ringwood is a busy market town on the edge of the New Forest, well positioned between Bournemouth and Salisbury and serving a broad mix of residential roads, rural properties, and a strong town centre. We cover BH24 and surrounding postcodes, delivering directly through letterboxes across the town and into the surrounding villages.",
      ],
      [
        "The town has a loyal local customer base that engages well with print marketing, particularly for home services, food and drink, and community events. Its rural-residential mix also means a single campaign can reach both village households and town centre addresses in one round.",
      ],
      [
        "Vehicle ",
        { href: "/services", text: "leaflet distribution" },
        " is also available across Ringwood's car parks and retail areas for businesses looking to reach people already out and spending locally. We also handle statutory ",
        { href: "/services/public-notice-leafleting", text: "Public Notice Leafleting" },
        " for infrastructure projects reaching into this part of Hampshire.",
      ],
    ],
    faqs: [
      "Ringwood is the BH24 postcode district, which covers the town along with St Leonards, St Ives, Ellingham and Burley.",
      "Yes. BH24 is one district, so you can book the whole of it or choose just the sectors that suit you, such as the town itself or the villages around St Leonards and Burley.",
      "Yes. Ringwood campaigns can reach into the wider New Forest or down to Bournemouth and Poole, planned and quoted together.",
      "Ringwood rounds are GPS tracked as they are delivered, through the town and out to villages such as Ellingham and St Ives, and a route report follows when the campaign ends.",
    ],
  },
  "christchurch": {
    slug: "christchurch",
    name: "Christchurch",
    inName: "Christchurch",
    eyebrow: "Christchurch, Dorset",
    wide: false,
    postcodes: [
      { code: "BH23", places: ["Christchurch", "Highcliffe", "Mudeford", "Burton", "Bransgore", "Hurn"] },
    ],
    homes: 25_000,
    nearby: ["bournemouth", "poole", "ringwood", "dorset"],
    review: "cozy",
    copy: [
      [
        "Christchurch sits on the Dorset coast between ",
        { href: "/areas/leaflet-distribution-bournemouth", text: "Bournemouth" },
        " and the New Forest, with a settled residential population and a strong seasonal visitor trade. We cover BH23 and surrounding postcodes, delivering to households across the town and into nearby villages including Burton, Walkford, and Highcliffe.",
      ],
      [
        "The town's homeowner-heavy demographic makes it particularly effective for home improvement, trades, and professional services campaigns. Its position between Bournemouth and the New Forest also makes it a natural add-on for businesses running wider coastal or county campaigns, often paired with nearby ",
        { href: "/areas/leaflet-distribution-ringwood", text: "Ringwood" },
        ". It also sits naturally alongside our wider ",
        { href: "/areas/leaflet-distribution-dorset", text: "Dorset coverage" },
        ".",
      ],
      [
        "Christchurch's harbourside and town centre retail areas are also available for ",
        { href: "/services", text: "vehicle leaflet distribution" },
        ", reaching visitors and day-trippers alongside the resident population.",
      ],
    ],
    faqs: [
      "Christchurch is covered by BH23, from the town centre and Mudeford to Highcliffe in the east and Burton, Bransgore and Hurn to the north.",
      "Yes. Christchurch is a single district, BH23, but you can focus on selected sectors, for example around Highcliffe and Mudeford, instead of the whole district.",
      "Yes. Christchurch pairs naturally with Bournemouth and Poole, and Ringwood or a wider Dorset campaign can be added on the same plan.",
      "Each Christchurch round is GPS tracked, from Highcliffe to Bransgore, and we send a route report after the final delivery.",
    ],
  },
  "dorset": {
    slug: "dorset",
    name: "Dorset",
    inName: "Dorset",
    eyebrow: "Dorset",
    wide: true,
    postcodes: [
      { code: "BH1", places: ["Town centre", "Springbourne", "East Cliff"] },
      { code: "BH2", places: ["Town centre", "West Cliff"] },
      { code: "BH3", places: ["Talbot Woods"] },
      { code: "BH4", places: ["Westbourne", "West Cliff"] },
      { code: "BH5", places: ["Boscombe", "Pokesdown"] },
      { code: "BH6", places: ["Southbourne", "Tuckton"] },
      { code: "BH7", places: ["Littledown", "Iford"] },
      { code: "BH8", places: ["Queen's Park", "Strouden Park", "Throop", "Holdenhurst"] },
      { code: "BH9", places: ["Moordown", "Winton", "Muscliff"] },
      { code: "BH10", places: ["Redhill", "Northbourne", "Kinson"] },
      { code: "BH11", places: ["Bearwood", "Kinson", "Wallisdown"] },
      { code: "BH12", places: ["Alderney", "Newtown", "Heatherlands", "Branksome"] },
      { code: "BH13", places: ["Canford Cliffs", "Branksome Park", "Sandbanks"] },
      { code: "BH14", places: ["Parkstone", "Penn Hill", "Lilliput"] },
      { code: "BH15", places: ["Poole town centre", "Hamworthy", "Oakdale"] },
      { code: "BH16", places: ["Upton", "Lytchett Matravers", "Lytchett Minster"] },
      { code: "BH17", places: ["Canford Heath", "Creekmoor"] },
      { code: "BH18", places: ["Broadstone"] },
      { code: "BH21", places: ["Wimborne Minster", "Colehill", "Ferndown", "Holt", "Corfe Mullen"] },
      { code: "BH22", places: ["Ferndown", "West Moors", "West Parley"] },
      { code: "BH23", places: ["Christchurch", "Highcliffe", "Mudeford", "Burton", "Bransgore", "Hurn"] },
      { code: "BH24", places: ["Ringwood", "St Leonards", "St Ives", "Ellingham", "Burley"] },
      { code: "DT1", places: ["Dorchester", "Poundbury"] },
      { code: "DT2", places: ["Puddletown", "Crossways", "Charminster"] },
      { code: "DT3", places: ["Upwey", "Broadwey", "Preston", "Chickerell", "Abbotsbury"] },
      { code: "DT4", places: ["Weymouth", "Wyke Regis", "Westham"] },
      { code: "DT9", places: ["Sherborne and surrounding villages"] },
      { code: "DT11", places: ["Blandford Forum and surrounding villages"] },
    ],
    homes: 293_500,
    nearby: ["bournemouth", "poole", "christchurch"],
    review: "kola",
    copy: [
      [
        "Dorset is one of the most varied counties for leaflet distribution, ranging from the busy urban centres of Bournemouth and Poole through to the quieter market towns and coastal villages further west. If you are running a campaign that needs to reach audiences across the county rather than a single town, a Dorset-wide campaign is the most effective way to do it.",
      ],
      [
        "We cover all major Dorset postcode areas including BH1 through BH18, BH21 through BH24, DT1 and surrounding Dorchester postcodes, and the coastal and rural areas in between. This makes us the right partner for businesses with a broad Dorset audience, including regional service providers, national brands running local activations, charities covering the county, and event promoters reaching across multiple towns at once.",
      ],
      [
        "Where you need coverage in a specific town such as ",
        { href: "/areas/leaflet-distribution-poole", text: "Poole" },
        " or Bournemouth, we also offer targeted campaigns for each area individually. The same goes for ",
        { href: "/areas/leaflet-distribution-christchurch", text: "Christchurch" },
        ". County-wide and multi-town campaigns are priced and planned as a single campaign, so you get one point of contact and one coordinated delivery.",
      ],
    ],
    faqs: [
      "Our Dorset coverage is built around Bournemouth and Poole (BH1 to BH18), Wimborne Minster and Ferndown (BH21 and BH22), Christchurch (BH23), Ringwood (BH24), Dorchester, Weymouth and the villages around them (DT1 to DT4), Sherborne (DT9) and Blandford Forum (DT11).",
      "Yes. There's no need to go county-wide: you can choose one or two districts, such as DT4 for Weymouth or BH21 for Wimborne Minster, and narrow them to specific sectors.",
      "Yes. You could combine Bournemouth, Poole and Christchurch, or pair Dorchester with Weymouth, and the whole campaign is planned and quoted together.",
      "Each Dorset round is GPS tracked, in the towns and the rural districts alike, and at the end we send one route report for the whole campaign.",
    ],
    question3: "Can you deliver to several Dorset towns in one campaign?",
  },
  "eastleigh": {
    slug: "eastleigh",
    name: "Eastleigh",
    inName: "Eastleigh",
    eyebrow: "Eastleigh, Hampshire",
    wide: false,
    postcodes: [
      { code: "SO50", places: ["Eastleigh", "Bishopstoke", "Fair Oak", "Horton Heath", "Allbrook"] },
    ],
    homes: 21_500,
    nearby: ["chandlers-ford", "hedge-end"],
    photo: { src: "/Street%20Image%20when%20distributing%20flyers.webp", alt: "Street scene during leaflet distribution in Eastleigh" },
    review: "new-arts",
    copy: [
      [
        "Eastleigh is one of Hampshire's largest towns, home to around 50,000 residents across a mix of residential neighbourhoods and commercial areas. We cover SO50 and surrounding postcodes, delivering directly through letterboxes across the town.",
      ],
      [
        "Whether you're targeting the town centre or nearby ",
        { href: "/areas/leaflet-distribution-chandlers-ford", text: "Chandler's Ford" },
        ", our experienced distributors know these routes well. The same goes for ",
        { href: "/areas/leaflet-distribution-hedge-end", text: "Hedge End" },
        " and the surrounding villages. Many campaigns here also pair naturally with nearby ",
        { href: "/areas/leaflet-distribution-winchester", text: "Winchester" },
        ".",
      ],
      [
        "Eastleigh's proximity to Southampton Airport and strong commuter population also makes it well suited to targeted postcode campaigns for local service businesses. We've also delivered statutory notice work out towards Fair Oak, part of a Hampshire-wide road closure campaign you can find among ",
        { href: "/case-studies", text: "our past campaigns" },
        ".",
      ],
    ],
    faqs: [
      "We cover the SO50 postcode district: Eastleigh town, Bishopstoke, Fair Oak, Horton Heath and Allbrook.",
      "Yes. SO50 is one district, so you can take the whole area or only the sectors you need, for example the town centre, or Fair Oak and Horton Heath.",
      "Yes. Eastleigh is often combined with Chandler's Ford and Hedge End, and we plan the towns as one campaign with a single quote.",
      "Our distributors GPS track each Eastleigh round, and when the campaign is complete you receive a route report covering Eastleigh, Bishopstoke and the other areas you chose.",
    ],
  },
  "romsey": {
    slug: "romsey",
    name: "Romsey",
    inName: "Romsey",
    eyebrow: "Romsey, Hampshire",
    wide: false,
    postcodes: [
      { code: "SO51", places: ["Romsey", "Wellow", "Timsbury", "Braishfield", "Lockerley"] },
    ],
    homes: 13_000,
    nearby: ["southampton", "totton", "winchester"],
    review: "auriel",
    copy: [
      [
        "Romsey is a historic market town in the Test Valley, sitting between Southampton and Salisbury with a well-loved, independent town centre. We cover SO51 and the surrounding villages, delivering door to door across the town centre, the newer residential estates, and the rural properties just outside it.",
      ],
      [
        "The pedestrianised town centre around Romsey Abbey draws a loyal local crowd, and that same audience responds well to print marketing for independent shops, cafes, trades and professional services. Many of our Romsey campaigns pair the town itself with nearby ",
        { href: "/areas/leaflet-distribution-southampton", text: "Southampton" },
        " or ",
        { href: "/areas/leaflet-distribution-totton", text: "Totton" },
        " for businesses wanting wider reach across the Test Valley.",
      ],
      [
        "Vehicle campaigns are also part of ",
        { href: "/services", text: "our leaflet distribution options" },
        " around Romsey's car parks and retail areas, useful for reaching visitors to the Abbey and Sir Harold Hillier Gardens alongside residents. We've also completed residential rounds out towards West Wellow, where you can ",
        { href: "/case-studies", text: "see the results" },
        ".",
      ],
    ],
    faqs: [
      "Romsey is the SO51 district, which takes in the town along with Wellow, Timsbury, Braishfield and Lockerley.",
      "Yes. You can choose just the SO51 sectors that suit you, such as the town itself or the villages around Wellow and Lockerley.",
      "Yes. Romsey campaigns can continue into Southampton and Totton, and Winchester can be added as well, all under one plan.",
      "Each Romsey round is GPS tracked, and you get a route report afterwards, much like the West Wellow route maps in our case studies.",
    ],
  },
  "hythe": {
    slug: "hythe",
    name: "Hythe",
    inName: "Hythe",
    eyebrow: "Hythe, Hampshire",
    wide: false,
    postcodes: [
      { code: "SO45", places: ["Hythe", "Dibden Purlieu", "Fawley", "Blackfield", "Holbury"] },
    ],
    homes: 15_000,
    nearby: ["totton", "new-forest", "brockenhurst", "southampton"],
    review: "new-arts",
    copy: [
      [
        "Hythe sits on the Waterside, looking out over Southampton Water with a small marina at its heart and a ferry crossing to Southampton itself. We cover SO45 and the wider Waterside area, delivering door to door through Hythe's town centre, the marina, and the residential roads that spread out from the village centre.",
      ],
      [
        "It's a close-knit community with a genuine village feel despite being minutes from Southampton by boat, and local shops, trades and hospitality businesses see real value in reaching residents directly through their letterboxes. Campaigns here often extend naturally into nearby ",
        { href: "/areas/leaflet-distribution-totton", text: "Totton" },
        " or across the wider ",
        { href: "/areas/leaflet-distribution-new-forest", text: "New Forest" },
        " villages. ",
        { href: "/areas/leaflet-distribution-brockenhurst", text: "Brockenhurst" },
        " is another popular addition for wider New Forest campaigns.",
      ],
      [
        "We can also run vehicle campaigns around Hythe's marina and shopping area, part of ",
        { href: "/services", text: "our distribution options" },
        " putting your materials in front of boat owners and visitors as well as residents.",
      ],
    ],
    faqs: [
      "We cover SO45, the Waterside: Hythe, Dibden Purlieu, Fawley, Blackfield and Holbury.",
      "Yes. SO45 can be split by sector, so you might choose Hythe and Dibden Purlieu only, or the Fawley, Blackfield and Holbury end of the Waterside.",
      "Yes. Hythe sits well alongside Totton, Brockenhurst and the wider New Forest, and Southampton can be included in the same campaign.",
      "Every Hythe round is GPS tracked, from Dibden Purlieu down to Blackfield, and a route report follows once your campaign is complete.",
    ],
  },
  "totton": {
    slug: "totton",
    name: "Totton",
    inName: "Totton",
    eyebrow: "Totton, Hampshire",
    wide: false,
    postcodes: [
      { code: "SO40", places: ["Totton", "Eling", "Marchwood", "Netley Marsh", "Ashurst", "Copythorne"] },
    ],
    homes: 17_500,
    nearby: ["southampton", "hythe", "romsey", "new-forest"],
    review: "cozy",
    copy: [
      [
        "Totton grew from a cluster of smaller villages, Testwood, Calmore and Hammonds Green among them, into one of the largest towns on the edge of the New Forest. We cover SO40 and the surrounding area, delivering door to door across the town centre, its residential estates, and the villages that now form part of it.",
      ],
      [
        "With the River Test on one side and the New Forest on the other, Totton has a genuinely mixed audience, from young families in newer developments to long-established residents near Eling. Campaigns here often pair naturally with nearby ",
        { href: "/areas/leaflet-distribution-hythe", text: "Hythe" },
        " too. That mix suits a wide range of campaigns, from trades and home services to local retail and food businesses, and it sits naturally alongside ",
        { href: "/areas/leaflet-distribution-romsey", text: "Romsey" },
        " and ",
        { href: "/areas/leaflet-distribution-southampton", text: "Southampton" },
        " campaigns for businesses covering the wider area.",
      ],
      [
        "We also offer vehicle campaigns around Totton's retail areas and car parks, part of ",
        { href: "/services", text: "the full range of services" },
        " we provide, a good option for reaching shoppers heading to the shops near Eling Tide Mill and the town centre. West Wellow campaigns, among our ",
        { href: "/case-studies", text: "recent projects" },
        ", often route through here too.",
      ],
    ],
    faqs: [
      "Totton is covered by SO40, which also takes in Eling, Marchwood, Netley Marsh, Ashurst and Copythorne.",
      "Yes. Within SO40 you can choose just the sectors you need, for example Totton and Eling, or the villages out towards Ashurst and Copythorne.",
      "Yes. Totton campaigns can extend into Southampton next door, along the Waterside to Hythe or north to Romsey, and the New Forest can be added too.",
      "Totton rounds are delivered by our own distributors with GPS tracking on, and after the last round you receive a route report for the SO40 areas in your campaign.",
    ],
  },
  "hedge-end": {
    slug: "hedge-end",
    name: "Hedge End",
    inName: "Hedge End",
    eyebrow: "Hedge End, Hampshire",
    wide: false,
    postcodes: [
      { code: "SO30", places: ["Hedge End", "West End", "Botley", "Whiteley"] },
    ],
    homes: 14_000,
    nearby: ["eastleigh", "chandlers-ford", "southampton"],
    review: "hendonis",
    copy: [
      [
        "Hedge End sits just east of Southampton, a residential town that's grown up alongside the retail park that now draws shoppers from across the area. We cover SO30 and the surrounding roads, delivering door to door across Hedge End's housing estates and into the neighbouring communities nearby, including ",
        { href: "/areas/leaflet-distribution-chandlers-ford", text: "Chandler's Ford" },
        ".",
      ],
      [
        "Most homes here are owner-occupied family houses, built up over several decades, which makes for a stable, responsive audience for local trades, home improvement, and professional services. The retail park itself is well known across the wider area, and that footfall makes Hedge End a natural fit alongside ",
        { href: "/areas/leaflet-distribution-eastleigh", text: "Eastleigh" },
        " or ",
        { href: "/areas/leaflet-distribution-southampton", text: "Southampton" },
        " campaigns too.",
      ],
      [
        "Vehicle campaigns are available around Hedge End Retail Park and the surrounding car parks too, part of ",
        { href: "/services", text: "what we offer" },
        " for reaching shoppers travelling in from outside the immediate area.",
      ],
    ],
    faqs: [
      "We cover SO30: Hedge End along with West End, Botley and Whiteley.",
      "Yes. SO30 can be targeted by sector, so you could reach Hedge End itself or concentrate on Botley or Whiteley.",
      "Yes. Hedge End can be combined with Eastleigh, Chandler's Ford or Southampton, with one quote and one plan for the whole campaign.",
      "Each Hedge End round is tracked by GPS, and you are sent a route report once the campaign is finished, covering whichever of Hedge End, West End, Botley and Whiteley you booked.",
    ],
  },
  "chandlers-ford": {
    slug: "chandlers-ford",
    name: "Chandler's Ford",
    inName: "Chandler's Ford",
    eyebrow: "Chandler's Ford, Hampshire",
    wide: false,
    postcodes: [
      { code: "SO53", places: ["Chandler's Ford", "Hiltingbury", "Valley Park"] },
    ],
    homes: 13_000,
    nearby: ["eastleigh", "hedge-end", "southampton"],
    review: "victoria",
    copy: [
      [
        "Chandler's Ford is a largely residential part of the Eastleigh borough, made up of established neighbourhoods like Hiltingbury and Valley Park around the shops at Fryern. We cover SO53 and the surrounding roads, delivering door to door across its estates and into the smaller pockets of housing nearby, including neighbouring ",
        { href: "/areas/leaflet-distribution-hedge-end", text: "Hedge End" },
        ".",
      ],
      [
        "It's firmly a commuter area, with residents travelling into ",
        { href: "/areas/leaflet-distribution-southampton", text: "Southampton" },
        " and beyond for work, which makes evenings and weekends the times campaigns here tend to land best. Trades, home services, and family-focused businesses do particularly well reaching this audience directly through their letterboxes, often alongside ",
        { href: "/areas/leaflet-distribution-eastleigh", text: "Eastleigh" },
        " itself.",
      ],
      [
        "We can also run vehicle campaigns around the shops at Fryern and the wider Chandler's Ford area, part of ",
        { href: "/services", text: "our service list" },
        ", putting your materials in front of people already out and about locally.",
      ],
    ],
    faqs: [
      "Chandler's Ford is the SO53 district, including Hiltingbury and Valley Park.",
      "Yes. SO53 is a single district, so you can take all of it or choose individual sectors, such as Hiltingbury or Valley Park.",
      "Yes. Chandler's Ford campaigns often include neighbouring Eastleigh, and Hedge End or Southampton can be added to the same campaign.",
      "We GPS track each Chandler's Ford round, and you receive a route report when the campaign is done, covering Hiltingbury and Valley Park as well as the rest of SO53.",
    ],
  },
  "brockenhurst": {
    slug: "brockenhurst",
    name: "Brockenhurst",
    inName: "Brockenhurst",
    eyebrow: "Brockenhurst, Hampshire",
    wide: false,
    postcodes: [
      { code: "SO42", places: ["Brockenhurst", "Beaulieu", "East Boldre"] },
    ],
    homes: 2_000,
    nearby: ["new-forest", "hythe", "southampton"],
    review: "homebites",
    copy: [
      [
        "Brockenhurst is one of the New Forest's best-known villages, with New Forest ponies wandering along Brookley Road and a mainline railway station at its centre. We cover SO42 and the surrounding area, delivering door to door across the village and into the smaller hamlets and residential roads nearby.",
      ],
      [
        "Brookley Road mixes independent shops, tearooms and pubs with a steady flow of visitors alongside its residents, so campaigns here can reach a genuinely wide audience. Local hospitality, retail and trades businesses all find a receptive crowd, whether they're targeting residents or visitors to the wider ",
        { href: "/areas/leaflet-distribution-new-forest", text: "New Forest" },
        ".",
      ],
      [
        "Vehicle campaigns are also available around Brockenhurst's Brookley Road and station car parks, part of ",
        { href: "/services", text: "the services we provide" },
        ", a useful way to reach visitors as well as the village's own residents.",
      ],
    ],
    faqs: [
      "We cover SO42, which takes in Brockenhurst, Beaulieu and East Boldre.",
      "Yes. SO42 is a small district of about 2,000 homes, so you can take the whole of it or just the sectors around Brockenhurst village.",
      "Yes. Brockenhurst can be part of a wider New Forest campaign, and Hythe or Southampton can be added as well.",
      "Brockenhurst rounds are GPS tracked in the same way as our other New Forest rounds, and you get a route report at the end showing the routes delivered.",
    ],
  },
};
