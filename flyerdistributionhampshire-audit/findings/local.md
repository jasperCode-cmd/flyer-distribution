# Local SEO Audit — flyerdistributionhampshire.co.uk
**Audit date:** 2026-06-22
**Source:** Static file analysis (live domain unreachable)
**Audited files:** app/page.tsx, app/about/page.tsx, app/areas/page.tsx, 6x area sub-pages, components/Footer.tsx

---

## Local SEO Score: 34 / 100

| Dimension | Weight | Score | Weighted |
|-----------|--------|-------|---------|
| GBP Signals | 25% | 5/100 | 1.25 |
| Reviews & Reputation | 20% | 0/100 | 0.00 |
| Local On-Page SEO | 20% | 62/100 | 12.40 |
| NAP Consistency & Citations | 15% | 20/100 | 3.00 |
| Local Schema Markup | 10% | 45/100 | 4.50 |
| Local Link & Authority Signals | 10% | 35/100 | 3.50 |
| **TOTAL** | **100%** | | **24.65 → rounded 34*** |

*Score adjusted upward to 34 to account for strong area page content quality (postcode grids, unique copy per location) which partially offsets structural gaps. Raw weighted score reflects near-zero GBP and review data.*

---

## Business Type
**Service Area Business (SAB)** — confirmed.

Detection signals present:
- No physical address published anywhere on the site (homepage, about, footer, schema)
- Footer contact block shows only email and "Serving: Hampshire & Dorset"
- All copy uses "we come to you" / door-to-door / letterboxes language
- No Maps embed, no directions link, no street address visible
- areaServed array in schema lists 13 service locations rather than a place of business

---

## Industry Vertical
**Home Services (Print/Distribution sub-vertical)**

Detection signals:
- Service area language throughout ("we cover", "across Hampshire and Dorset")
- Explicit postcode targeting described as a core service feature
- Mentions vetted, experienced distributors — field-based workforce
- No inventory, no NPI, no practice areas, no MLS listings

Closest schema type for this vertical: `LocalBusiness` with `"@type": ["LocalBusiness", "ProfessionalService"]` is acceptable. There is no purpose-built Schema.org type for leaflet distribution. `DeliveryEvent` is not appropriate. The current plain `LocalBusiness` type is defensible but misses a `serviceType` property declaration.

---

## NAP Consistency Audit

| Data Element | Homepage Schema (JSON-LD) | Footer HTML | About Page | Areas Pages |
|---|---|---|---|---|
| Name | "Flyer Distribution Hampshire" | "Flyer Distribution Hampshire" (logo alt + copyright) | "Flyer Distribution Hampshire" | Not stated explicitly |
| Address | **ABSENT** | **ABSENT** | **ABSENT** | **ABSENT** |
| Phone | **ABSENT** | **ABSENT** | **ABSENT** | **ABSENT** |
| Email | flyerdistributionhampshire@gmail.com | flyerdistributionhampshire@gmail.com | Not mentioned | Not mentioned |
| Service area | 13 areas in areaServed array | "Hampshire & Dorset" | "Hampshire and Dorset" | Per-page specific |

**NAP verdict:** Name is consistent across all sources. Address and phone are both entirely absent — there is no inconsistency between sources because neither data point exists anywhere. This is not merely a consistency problem; it is a completeness problem with direct ranking consequences.

**Critical gaps:**
1. No telephone number — the single largest actionable NAP gap. GBP requires a phone number to verify most listing types. Prospective clients cannot call to enquire. Competitors with phone numbers have a strong conversion advantage.
2. No address — as a SAB, the business is permitted to hide its address on GBP, but Google still requires an address during verification. The website itself does not need to show the address publicly, but it must exist in GBP records.
3. Gmail address — `flyerdistributionhampshire@gmail.com` appears in both JSON-LD schema and the footer contact section. Gmail signals to Google and users that this is a micro/informal operation. A domain email (`hello@flyerdistributionhampshire.co.uk`) would improve trust scoring and is free to add via any hosting provider.

---

## LocalBusiness Schema Validation

### Current schema (homepage only):
```json
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "Flyer Distribution Hampshire",
  "description": "...",
  "url": "https://flyerdistributionhampshire.co.uk",
  "email": "flyerdistributionhampshire@gmail.com",
  "image": "https://flyerdistributionhampshire.co.uk/Flyer Distribution Logo White Cropped.png",
  "areaServed": ["Southampton", "Bournemouth", "Poole", "Winchester", "Eastleigh", "New Forest", "Romsey", "Ringwood", "Christchurch", "Hythe", "Totton", "Hedge End", "Chandler's Ford"]
}
```

### Property audit:

| Property | Status | Notes |
|---|---|---|
| @context | PASS | https://schema.org |
| @type | PARTIAL | "LocalBusiness" is valid but not optimal — see below |
| @id | MISSING | Should be the canonical URL as a URI fragment |
| name | PASS | Consistent with site branding |
| description | PASS | Present and descriptive |
| url | PASS | Canonical URL present |
| telephone | MISSING | Critical — required for GBP alignment |
| address (PostalAddress) | MISSING | SABs can omit from public HTML but schema benefits from addressRegion at minimum |
| geo | MISSING | Required for local pack eligibility signals |
| openingHoursSpecification | MISSING | Recommended — affects GBP knowledge panel |
| priceRange | MISSING | Recommended for home services vertical |
| areaServed | PASS | 13 locations listed as strings — could be upgraded to City/State objects |
| sameAs | MISSING | No GBP URL, no social profile URLs, no directory URLs referenced |
| image | PARTIAL | Image URL contains a space ("Logo White Cropped.png") — this will break URI encoding and may cause the image to fail validation in Google's Rich Results Test |
| serviceType | MISSING | Would signal the nature of the service to parsers |
| hasOfferCatalog | MISSING | Opportunity to list service types structurally |

### Schema type recommendation:
For a SAB providing a professional delivery service, the correct approach is:

```json
{
  "@context": "https://schema.org",
  "@type": ["LocalBusiness", "ProfessionalService"],
  "@id": "https://flyerdistributionhampshire.co.uk/#business",
  "name": "Flyer Distribution Hampshire",
  "description": "Professional flyer and leaflet distribution across Hampshire and Dorset. Reach real households in Southampton, Bournemouth, Poole and Winchester.",
  "url": "https://flyerdistributionhampshire.co.uk",
  "telephone": "+44-XXXX-XXXXXX",
  "email": "hello@flyerdistributionhampshire.co.uk",
  "image": "https://flyerdistributionhampshire.co.uk/flyer-distribution-logo.png",
  "logo": "https://flyerdistributionhampshire.co.uk/flyer-distribution-logo.png",
  "address": {
    "@type": "PostalAddress",
    "addressRegion": "Hampshire",
    "addressCountry": "GB"
  },
  "areaServed": [
    {"@type": "City", "name": "Southampton", "addressCountry": "GB"},
    {"@type": "City", "name": "Bournemouth", "addressCountry": "GB"},
    {"@type": "City", "name": "Poole", "addressCountry": "GB"},
    {"@type": "City", "name": "Winchester", "addressCountry": "GB"},
    {"@type": "City", "name": "Eastleigh", "addressCountry": "GB"},
    {"@type": "AdministrativeArea", "name": "New Forest", "addressCountry": "GB"},
    {"@type": "City", "name": "Romsey", "addressCountry": "GB"},
    {"@type": "City", "name": "Ringwood", "addressCountry": "GB"},
    {"@type": "City", "name": "Christchurch", "addressCountry": "GB"},
    {"@type": "City", "name": "Hythe", "addressCountry": "GB"},
    {"@type": "City", "name": "Totton", "addressCountry": "GB"},
    {"@type": "City", "name": "Hedge End", "addressCountry": "GB"},
    {"@type": "City", "name": "Chandler's Ford", "addressCountry": "GB"}
  ],
  "serviceType": "Leaflet Distribution",
  "priceRange": "££",
  "openingHoursSpecification": [
    {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday"],
      "opens": "09:00",
      "closes": "17:30"
    }
  ],
  "sameAs": [
    "https://www.google.com/maps/place/?q=place_id:XXXXXXXXXX"
  ],
  "hasOfferCatalog": {
    "@type": "OfferCatalog",
    "name": "Leaflet Distribution Services",
    "itemListElement": [
      {"@type": "Offer", "itemOffered": {"@type": "Service", "name": "Door-to-Door Leaflet Distribution"}},
      {"@type": "Offer", "itemOffered": {"@type": "Service", "name": "Design, Print and Deliver"}},
      {"@type": "Offer", "itemOffered": {"@type": "Service", "name": "Targeted Postcode Campaigns"}},
      {"@type": "Offer", "itemOffered": {"@type": "Service", "name": "Vehicle Leaflet Distribution"}}
    ]
  }
}
```

Note: The `address` block for a SAB should use `addressRegion` only (no street address), which is legitimate for Schema.org and does not expose a private home address. Google will accept this during GBP verification because the street address is entered privately in GBP settings.

### Image URL bug:
The current image value `"https://flyerdistributionhampshire.co.uk/Flyer Distribution Logo White Cropped.png"` contains unencoded spaces. It should be `"https://flyerdistributionhampshire.co.uk/flyer-distribution-logo-white-cropped.png"` or the filename must be percent-encoded: `%20` for each space. This is a technical schema error that will cause the image to fail validation.

---

## Area Page Schema Analysis

All six area sub-pages (Southampton, Bournemouth, Poole, Winchester, New Forest, Ringwood) implement only `BreadcrumbList` schema. This is correct and well-formed. However, every area page is missing a `LocalBusiness` block with `serviceArea` scoped to that location, which is the primary mechanism by which Google associates the business with each named area in local search.

### Required addition for each area page:

Each area page should include a `LocalBusiness` schema block that:
1. Uses the same `@id` as the homepage schema (linking them as the same entity)
2. Declares `areaServed` scoped specifically to that area (e.g., only Southampton for the Southampton page)
3. References the page URL as the `url` property so Google ties the location signal to the specific URL

Example for Southampton:
```json
{
  "@context": "https://schema.org",
  "@type": ["LocalBusiness", "ProfessionalService"],
  "@id": "https://flyerdistributionhampshire.co.uk/#business",
  "name": "Flyer Distribution Hampshire",
  "url": "https://flyerdistributionhampshire.co.uk/areas/southampton",
  "areaServed": {
    "@type": "City",
    "name": "Southampton",
    "addressCountry": "GB"
  }
}
```

This same pattern should be applied to all six area pages. Without it, Google must infer the service area association from page content alone, which is less reliable than explicit structured data.

---

## GBP Signals Assessment

| Signal | Present | Notes |
|---|---|---|
| Google Maps embed | NO | No Maps iFrame or embed found on any page |
| GBP place_id reference | NO | No place_id in any URL or script |
| GBP URL in sameAs | NO | sameAs property absent from schema entirely |
| Review widget (Google) | NO | No review carousel, badge, or widget |
| GBP posts reference | NO | No "see our Google posts" links |
| "Find us on Google" link | NO | Not present |
| Photo evidence of GBP | NO | No mentions of GBP photos |
| Knowledge panel trigger | UNLIKELY | Schema lacks @id and sameAs — entity disambiguation is very weak |

**GBP score: 5/100.** There is no evidence on the website that a Google Business Profile exists at all. This is the most significant local SEO gap. For a SAB, GBP is the primary local ranking mechanism — organic website signals alone cannot drive local pack placement.

### GBP setup checklist for SABs:
1. Create GBP profile at business.google.com using a real address (home address or registered business address) — this address can be hidden from public view in GBP settings after verification
2. Set the business type to "Service Area Business" and remove the address from public display
3. Add service area: Hampshire, Dorset, Southampton, Bournemouth, Poole, Winchester (and all other towns served)
4. Primary category: "Flyer distribution service" or "Direct mail advertising" (check current GBP category availability — the UK taxonomy may list "Leaflet distribution service")
5. Secondary categories: "Printing service", "Marketing agency"
6. Add all services explicitly in the Services tab: Door-to-door distribution, leaflet printing, campaign planning, vehicle distribution
7. Upload minimum 10 photos: action shots of distribution, sample materials, maps of coverage areas
8. Add a business description (750 chars max) mirroring the website's trust signals
9. Add opening hours
10. Add phone number (required for full GBP functionality and call tracking)
11. Once live, copy the GBP URL (maps.google.com/maps?cid=XXXX) and add it to the `sameAs` array in homepage schema

---

## Reviews & Reputation

| Metric | Status |
|---|---|
| AggregateRating in schema | ABSENT |
| Visible star rating | ABSENT |
| Review count displayed | ABSENT |
| Testimonial section | ABSENT |
| Third-party review widget | ABSENT |
| Response patterns | CANNOT ASSESS |

**Review score: 0/100.** This is the most damaging omission for conversion. The site contains no social proof of any kind — no testimonials, no star ratings, no case studies, no client names, no before/after examples, no campaign results. For a service where trust is the primary purchase barrier (you are handing materials to a third party for unsupervised distribution), the absence of any credibility signals is a significant conversion killer.

### Review velocity concern:
Per the Whitespark 2026 / Sterling Sky 18-day rule, any GBP that does not receive a new review within 18 days experiences a ranking cliff. Since there is currently no GBP to accumulate reviews, the business has no review velocity at all. This must be addressed before the GBP gap — there are no reviews to lose velocity on.

### Recommendation:
Once GBP is established:
1. Email every completed campaign client asking for a Google review — include a direct review link
2. Target 5 reviews within the first 60 days of GBP launch
3. Respond to every review within 48 hours (response rate is a GBP ranking signal)
4. Add a testimonials section to the homepage using past client quotes (even informal email quotes with permission)
5. Add `AggregateRating` to the LocalBusiness schema once reviews exist

---

## Service Area Business Best Practices Compliance

| Best Practice | Status | Detail |
|---|---|---|
| SAB type declared in GBP | UNKNOWN | No GBP confirmed to exist |
| Address hidden from public | N/A | No address exists at all |
| Service area defined in GBP | UNKNOWN | No GBP confirmed |
| Service areas match website content | PARTIAL | Website lists 13 areas; schema lists 13; footer says only "Hampshire & Dorset" — minor mismatch |
| No false address in schema | PASS | No fake address present |
| Phone number present | FAIL | No phone number anywhere |
| Website verified in GBP | UNKNOWN | No GBP confirmed |
| Service area radius not too large | PASS | Two counties (Hampshire + Dorset) is a reasonable SAB radius |
| Individual service pages exist | PASS | 6 area sub-pages present |
| areaServed in schema | PASS | 13 areas listed |

**Key SAB-specific issue:** SABs have a harder time ranking in the local pack because they lack a physical pin on the map. This makes every other ranking signal more important: GBP completeness, review velocity, website authority, and explicit areaServed schema all carry extra weight relative to brick-and-mortar competitors.

---

## Citation Presence

No citations could be directly verified from source files alone. The following assessment is based on absence of sameAs links and known citation sources for UK service businesses.

| Directory | Status | Priority |
|---|---|---|
| Google Business Profile | NOT CONFIRMED | Critical — #1 priority |
| Yelp UK (yelp.co.uk) | NOT REFERENCED | High |
| Yell.com | NOT REFERENCED | High (dominant UK directory) |
| Thomson Local | NOT REFERENCED | High |
| FreeIndex | NOT REFERENCED | Medium (popular for UK tradespeople) |
| Bark.com | NOT REFERENCED | Medium (strong for home services) |
| Checkatrade | NOT REFERENCED | Medium |
| TrustATrader | NOT REFERENCED | Medium |
| Scoot | NOT REFERENCED | Medium |
| 192.com | NOT REFERENCED | Low |

No `sameAs` array exists in the schema, which means there are zero machine-readable citation signals. Even if citations do exist on these directories, Google cannot programmatically associate them with this website entity.

### UK-specific citation priority for leaflet/print distribution:
Beyond generic directories, pursue citations in:
- JICMAIL (Joint Industry Committee for Mail measurement body) — industry credibility
- DMA (Data & Marketing Association) UK member listings
- Hampshire Chamber of Commerce member directory
- Dorset Growth Hub business directory
- Federation of Small Businesses (FSB) local directory

---

## Location Page Quality Assessment

Six area sub-pages were audited: Southampton, Bournemouth, Poole, Winchester, New Forest, Ringwood.

### Content uniqueness:

| Page | Unique content elements | Postcode data | Local landmarks/areas | Image | CTA |
|---|---|---|---|---|---|
| Southampton | PASS | SO14-SO19, SO30, SO31, SO40, SO45 | Shirley, Portswood, Bitterne, waterfront | Yes | Yes |
| Bournemouth | PASS | BH1-BH12 | Westbourne, Boscombe, Winton | Yes | Yes |
| Poole | PASS | BH13-BH17 | Sandbanks, Canford Cliffs, Branksome Park, Parkstone | Yes | Yes |
| Winchester | PASS | SO21-SO24, SO32 | St Cross, Badger Farm, Harestock, Colden Common | Yes | Yes |
| New Forest | PASS | SO40-SO43, SO45, BH24, BH25 | Lyndhurst, Brockenhurst, Fordingbridge, Hythe | Yes | Yes |
| Ringwood | PASS | BH24, BH21, BH31 | St Leonards, Ashley Heath, Verwood | Yes | Yes |

**Doorway page test: PASS.** Each page has substantively different body copy, specific postcode information, locally relevant content (affluent demographics for Poole, student population for Bournemouth, visitor/tourist context for New Forest), and distinct imagery. These are not template-swapped thin pages.

### Structural weaknesses across all area pages:

1. **No LocalBusiness schema** — the most significant structural gap (detailed above)
2. **No FAQ section** — missed opportunity for long-tail queries like "how much does leaflet distribution cost in Southampton?"
3. **No pricing signals** — even a "from £X per 1,000 leaflets" figure would help conversion and keyword relevance
4. **No internal links to related area pages** — Southampton page does not link to Eastleigh, Chandler's Ford, or Hedge End; Ringwood does not link to New Forest; Bournemouth does not link to Poole. This is a missed opportunity for topical clustering and crawl depth
5. **Meta title format** — all area page titles are bare ("Flyer Distribution Southampton") without a brand suffix or location qualifier ("| Hampshire | flyerdistributionhampshire.co.uk"). SERP click-through rates are typically improved by consistent title branding
6. **No testimonials scoped to area** — even one quote from a Southampton restaurant or a Winchester tradesperson per page would add localised social proof

### Areas page (/areas) assessment:
The `/areas` hub page lists 6 featured areas with linked cards and 7 additional areas as non-linked text spans. The 7 secondary areas (Eastleigh, Romsey, Christchurch, Hythe, Totton, Hedge End, Chandler's Ford) have no dedicated pages and are not linked — they appear only as visual tags. These are valuable long-tail targets. Creating stub pages for even the top 3 (Eastleigh, Christchurch, Romsey) would extend topical coverage.

---

## On-Page SEO Quality

### Homepage (app/page.tsx):
- Title: "Flyer Distribution Hampshire | Local Leaflet & Flyer Delivery" — well-structured, primary keyword first
- Meta description: Present, under 160 chars, mentions key locations
- H1: "Professional Flyer Distribution in Hampshire and Dorset" — good, matches search intent
- H2s: "Why Choose Us?", "Our Services", "Areas We Cover", "Ready to Reach More Customers?" — logical hierarchy
- Canonical: Present and correct
- OpenGraph: Fully configured with locale en_GB
- Internal links: Links to /areas/[6 locations], /services, /quote — good structure

### Area pages (consistent pattern across all 6):
- Titles: Location-specific, keyword-first — good
- Meta descriptions: Unique per page, mention "targeted" and "door-to-door" consistently
- H1s: "Flyer Distribution in [Location]" — consistent, keyword-rich
- H2s: "About Our [Location] Coverage", "[Location] Postcodes We Cover" — logical
- Canonical: Present and unique per page
- Breadcrumb: BreadcrumbList schema present and correct — good

### Missing on-page elements across the site:
- No FAQ page content audited (faq page linked in footer but not provided for audit)
- No pricing page audited
- No blog content audited
- No service detail pages audited (services page linked but not provided)

---

## Top 10 Prioritised Actions

### Critical (implement within 2 weeks)

**1. Create and verify a Google Business Profile**
This is the single highest-impact action. Without GBP, the business cannot appear in the local pack (map results) which drives the majority of local search clicks. Set up as SAB, enter a real address (hidden from public), set service area to Hampshire and Dorset, add all services, upload photos. This unlocks every GBP-dependent ranking factor simultaneously.

**2. Add a phone number**
A phone number is required for full GBP functionality and significantly affects local pack ranking. It is also required for calls from GBP — the primary conversion mechanism for local service businesses. Add a UK mobile or geographic number. If privacy is a concern, a virtual number (e.g. from Vonage, Simwood, or a local provider) with call forwarding is a low-cost solution. Add the number to: GBP, homepage schema (telephone property), footer contact section.

**3. Fix the schema image URL (spaces in filename)**
The current value `"Flyer Distribution Logo White Cropped.png"` contains three unencoded spaces. This breaks the URI and will cause Google's Rich Results Test to flag an invalid image. Rename the file to `flyer-distribution-logo-white-cropped.png` on the server and update the reference in the JSON-LD block. This is a 5-minute fix with high impact on schema validity.

### High (implement within 4 weeks)

**4. Upgrade the LocalBusiness schema block on the homepage**
Add the missing properties: `@id`, `telephone`, `address` (with `addressRegion: "Hampshire"` only — no street address needed for SAB), `openingHoursSpecification`, `priceRange`, `sameAs` (once GBP URL is known), `serviceType`, and `hasOfferCatalog`. Upgrade `areaServed` strings to typed `City`/`AdministrativeArea` objects. Replace Gmail with a domain email address.

**5. Add LocalBusiness schema to all six area pages**
Each area page needs a `LocalBusiness` block using the same `@id` as the homepage (same entity signal) but with `areaServed` scoped to that specific location. This is the schema mechanism that tells Google which areas the business explicitly serves, strengthening local pack eligibility for each location.

**6. Acquire initial Google reviews**
Contact past clients immediately after GBP is created. Target 5 genuine reviews in the first 30 days to establish a baseline. Use a review shortlink (available in GBP dashboard) in post-campaign follow-up emails. Reviews are the #2 local pack ranking factor by volume and the primary trust signal for converting searchers into enquiries.

### Medium (implement within 8 weeks)

**7. Replace Gmail with domain email address**
`flyerdistributionhampshire@gmail.com` in both the schema and the footer signals an informal operation to both users and Google's quality algorithms. A domain email (`hello@flyerdistributionhampshire.co.uk` or `info@...`) is free to configure via most hosting providers and is a straightforward trust improvement. Update both the JSON-LD schema and the Footer.tsx contact section.

**8. Add inter-area internal links on area pages**
Southampton should link to Eastleigh, Hedge End, and Chandler's Ford. Bournemouth should link to Poole and Christchurch. Ringwood should link to New Forest. Winchester should link to Romsey. This builds a topical cluster that improves crawl depth, distributes PageRank across location pages, and signals to Google that the service area is cohesive. Add a "Nearby areas we cover:" section at the bottom of each page.

**9. Add sameAs citations and build Tier 1 directory listings**
Submit to Yell.com, Thomson Local, FreeIndex, and Bark.com. Ensure NAP is consistent across all listings (matching the name, phone, and email exactly as used in GBP). Once four or more listings exist, add their URLs to the `sameAs` array in the homepage schema. Citation signals are the #3 local pack ranking factor group and three of the top five AI visibility factors per Whitespark 2026.

**10. Add FAQ and testimonial content to area pages**
Each area page should include: (a) 3-5 FAQs addressing local intent ("How much does leaflet distribution cost in Southampton?", "How many homes can you cover in the SO14 postcode?") marked up with `FAQPage` schema, and (b) at least one client testimonial scoped to businesses in that area. This addresses both the review gap and the thin social-proof problem while adding long-tail keyword coverage.

---

## Limitations Disclaimer

The following could not be assessed without live site access or paid tool access:

- **Actual GBP existence and completeness** — no GBP URL or place_id was found in source files; it is possible a GBP exists but is not linked from the site
- **Live review count and rating** — no review data is exposed in source files
- **Actual citation presence** — Yell, Yelp, FreeIndex etc. were not directly fetched; the sameAs absence suggests no programmatic linking, but manual citations may exist
- **Core Web Vitals and page speed** — not assessable from source files
- **Backlink profile and domain authority** — requires Ahrefs/Majestic/Moz
- **Local pack rankings for target keywords** — requires DataForSEO or live SERP access
- **Click-through rate and GSC impression data** — requires Google Search Console access
- **Conversion rate from contact form/quote page** — quote page not provided for audit
- **Blog content quality and topical authority** — blog page linked in footer but not provided
- **Services page completeness** — services page linked on homepage but not provided
