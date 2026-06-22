# Schema Markup Analysis — flyerdistributionhampshire.co.uk

**Audit date:** 2026-06-22
**Source:** Static file analysis of Next.js app directory
**Overall schema score: 31 / 100**

---

## 1. Schema Inventory

| Page | Schema type(s) present | Format |
|---|---|---|
| / (homepage) | LocalBusiness | JSON-LD |
| /services | @graph of 6x Service | JSON-LD |
| /faq | FAQPage (10 Q&A) | JSON-LD |
| /areas/southampton | BreadcrumbList | JSON-LD |
| /areas/bournemouth | BreadcrumbList | JSON-LD |
| /areas/poole | BreadcrumbList | JSON-LD |
| /areas/winchester | BreadcrumbList | JSON-LD |
| /areas/new-forest | BreadcrumbList | JSON-LD |
| /areas/ringwood | BreadcrumbList | JSON-LD |
| /about | None | — |
| /quote | None | — |
| /areas (index) | None | — |

All implemented schema uses JSON-LD and `https://schema.org`. No Microdata or RDFa found. Format compliance is the one thing done correctly.

---

## 2. Validation Results

### 2.1 LocalBusiness — homepage (`app/page.tsx`)

**Status: FAIL — critically incomplete**

Properties present:
- `@context` https://schema.org — PASS
- `@type` LocalBusiness — PASS
- `name` — PASS
- `description` — PASS
- `url` — PASS
- `email` — PASS
- `image` — FAIL (broken URL — see issue 2.1a)
- `areaServed` — PARTIAL (plain string array; insufficient for a SAB — see issue 2.1b)

**Missing required / strongly recommended properties for a LocalBusiness:**

| Property | Status | Impact |
|---|---|---|
| `@id` | Missing | No canonical entity identifier; Google cannot deduplicate this entity across pages |
| `telephone` | Missing | Business has no phone — acceptable, but should be noted |
| `address` (PostalAddress) | Missing | SABs with no fixed premise should still declare a `PostalAddress` for their operating region, or use `areaServed` with structured geo data |
| `openingHours` | Missing | Recommended for Knowledge Panel |
| `priceRange` | Missing | Recommended for Knowledge Panel |
| `sameAs` | Missing | No links to Google Business Profile, Facebook, or any social/directory profile |
| `logo` | Missing | Should be a separate `ImageObject` with `url`, `width`, `height` |
| `serviceArea` | Missing | SABs must use `serviceArea` (with `GeoCircle` or `GeoShape`), not just `areaServed` strings |
| `hasOfferCatalog` or `makesOffer` | Missing | No link to service offerings |

**Issue 2.1a — image URL contains unencoded spaces:**
```
"image": "https://flyerdistributionhampshire.co.uk/Flyer Distribution Logo White Cropped.png"
```
Spaces in a URL make it technically invalid (RFC 3986). Googlebot may fail to fetch this image. The spaces must be percent-encoded as `%20`, or (better) the file renamed on the server to remove spaces.

Broken form: `Flyer Distribution Logo White Cropped.png`
Corrected form: `Flyer%20Distribution%20Logo%20White%20Cropped.png`
Ideal form: rename file to `flyer-distribution-logo-white-cropped.png`

**Issue 2.1b — areaServed is a plain string array:**
```json
"areaServed": ["Southampton", "Bournemouth", "Poole", ...]
```
For a Service Area Business with no fixed retail premises, Google expects `serviceArea` using structured geo types, not bare strings. Plain strings have no geo-semantic value — Google cannot resolve "Ringwood" to a location without a `GeoCircle`, `GeoShape`, or at minimum an `AdministrativeArea` with an identifier.

---

### 2.2 Service schemas — /services (`app/services/page.tsx`)

**Status: FAIL — functional but thin**

The @graph of 6 Service nodes is structurally valid. Each node has `@type`, `name`, `description`, `provider`, and `areaServed`. However:

**Missing on every Service node:**

| Property | Status | Notes |
|---|---|---|
| `@id` | Missing | No stable URI for each service entity |
| `url` | Missing | No link to the canonical page for this service |
| `serviceType` | Missing | Recommended classifier (e.g. "Leaflet Distribution") |
| `offers` | Missing | Even a minimal `Offer` with `priceCurrency: "GBP"` and `priceSpecification` or `description` greatly helps |
| `provider.@id` | Missing | Provider reference should use `@id` to link back to the root LocalBusiness entity |
| `areaServed` | PARTIAL | `"Hampshire and Dorset"` is a single plain string — same geo issue as above |

---

### 2.3 FAQPage — /faq (`app/faq/page.tsx`)

**Status: INFO — structurally valid; no Google SERP rich result**

The FAQPage schema is correctly formed:
- `@context` https://schema.org — PASS
- `@type` FAQPage — PASS
- `mainEntity` array of 10 Questions — PASS
- Each Question has `@type: Question`, `name`, and `acceptedAnswer` with `@type: Answer` and `text` — PASS

**However:** Google retired FAQ rich results for all sites on 7 May 2026. This schema will no longer produce accordion-style SERP features. It is not harmful to retain — it aids LLM/AI citation and entity resolution — but it carries zero Google SERP benefit as of the audit date. No action required, but do not invest effort in expanding it for Google's benefit.

Missing:
- `@id` on the FAQPage entity
- `url` on the FAQPage entity

---

### 2.4 BreadcrumbList — all 6 area pages

**Status: PASS — structurally correct**

All six area pages implement an identical 3-level BreadcrumbList:
- Position 1: Home → `https://flyerdistributionhampshire.co.uk` — PASS
- Position 2: Areas → `https://flyerdistributionhampshire.co.uk/areas` — PASS
- Position 3: [Area name] → absolute URL — PASS

All URLs are absolute. All `@type: ListItem` nodes are correct. `position` values are integers. This schema will qualify for Google's breadcrumb rich result.

One minor gap: `/areas/page.tsx` itself has no BreadcrumbList schema, so the Areas index page has no breadcrumb trail. Low priority.

---

## 3. Site-wide Issues

### 3.1 No @id used anywhere — Critical

Not a single schema block across the entire site declares an `@id`. This means:

- Google cannot link the LocalBusiness on the homepage to the `provider` objects inside each Service node
- Google cannot deduplicate or consolidate the entity graph across pages
- The site has no Knowledge Graph anchor

The root business entity should be assigned a permanent canonical `@id` URI (typically the homepage URL with a `#` fragment, e.g. `https://flyerdistributionhampshire.co.uk/#business`) and this `@id` should be referenced by every other schema block that mentions the business.

### 3.2 No WebSite schema — High

No `WebSite` schema exists on any page. A `WebSite` block with a `SearchAction` (`potentialAction`) enables the Sitelinks Searchbox feature in Google Search. Even without the SearchAction, a WebSite entity provides a named anchor for the site as a whole.

### 3.3 No Organization schema — High

Although `LocalBusiness` is a subtype of `Organization`, a discrete `Organization` node (or a `LocalBusiness` with `@id`) is expected for Knowledge Panel population. Without it, Google has no clear entity to associate the business with structured data from external sources (GBP, Wikidata, etc.). This is compounded by the total absence of `sameAs`.

### 3.4 No sameAs links — High

No `sameAs` property appears anywhere. If the business has a Google Business Profile, Facebook page, Yell listing, or any other external presence, these should be listed as `sameAs` on the root LocalBusiness entity. `sameAs` is the primary mechanism by which Google links structured data to the Knowledge Graph.

### 3.5 No serviceArea — High (SAB-specific)

This is a Service Area Business. Google's local search documentation specifically notes that SABs should use `serviceArea` with structured geo types. The current `areaServed` plain-string array:
- Has no geo-semantic value Google can parse
- Does not satisfy the SAB local pack requirements
- Should be replaced or supplemented with `serviceArea` using `GeoCircle` or individual `AdministrativeArea` nodes

### 3.6 Pages with no schema — Medium

- `/about` — no schema; at minimum a `WebPage` or `AboutPage` type helps
- `/quote` — no schema; a `WebPage` with a `potentialAction` of type `RequestQuote` would be appropriate
- `/areas` (index) — no schema; no BreadcrumbList, no `CollectionPage`

---

## 4. Missing Schema Opportunities

| Schema type | Page | Priority | Notes |
|---|---|---|---|
| WebSite (with SearchAction) | / | High | Enables Sitelinks Searchbox |
| @id on LocalBusiness | / | Critical | Foundation for entity graph |
| serviceArea with GeoCircle | / | High | SAB requirement |
| sameAs | / | High | Knowledge Graph linkage |
| logo as ImageObject | / | Medium | Knowledge Panel display |
| WebPage / AboutPage | /about | Medium | Basic page entity |
| WebPage / ContactPage | /quote | Medium | Basic page entity |
| CollectionPage + BreadcrumbList | /areas | Low | Index page coverage |
| @id on each Service | /services | Medium | Entity linking |
| offers on each Service | /services | Medium | Richer service data |

---

## 5. Priority Fixes and Corrected JSON-LD

### Fix 1 (Critical) — Replace LocalBusiness on homepage

Add `@id`, fix the image URL, add `serviceArea` with structured geo data, add `sameAs` placeholders, add `logo` as ImageObject, and combine with a `WebSite` entity in an `@graph`.

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": "https://flyerdistributionhampshire.co.uk/#website",
      "url": "https://flyerdistributionhampshire.co.uk",
      "name": "Flyer Distribution Hampshire",
      "description": "Professional flyer and leaflet distribution across Hampshire and Dorset.",
      "publisher": {
        "@id": "https://flyerdistributionhampshire.co.uk/#business"
      },
      "potentialAction": {
        "@type": "SearchAction",
        "target": {
          "@type": "EntryPoint",
          "urlTemplate": "https://flyerdistributionhampshire.co.uk/?s={search_term_string}"
        },
        "query-input": "required name=search_term_string"
      }
    },
    {
      "@type": "LocalBusiness",
      "@id": "https://flyerdistributionhampshire.co.uk/#business",
      "name": "Flyer Distribution Hampshire",
      "description": "Professional flyer and leaflet distribution across Hampshire and Dorset. Reach real households in Southampton, Bournemouth, Poole and Winchester.",
      "url": "https://flyerdistributionhampshire.co.uk",
      "email": "flyerdistributionhampshire@gmail.com",
      "image": "https://flyerdistributionhampshire.co.uk/flyer-distribution-logo-white-cropped.png",
      "logo": {
        "@type": "ImageObject",
        "url": "https://flyerdistributionhampshire.co.uk/flyer-distribution-logo-white-cropped.png",
        "width": 400,
        "height": 120
      },
      "sameAs": [
        "https://www.facebook.com/PLACEHOLDER",
        "https://www.google.com/maps?cid=PLACEHOLDER"
      ],
      "areaServed": [
        { "@type": "City", "name": "Southampton" },
        { "@type": "City", "name": "Bournemouth" },
        { "@type": "City", "name": "Poole" },
        { "@type": "City", "name": "Winchester" },
        { "@type": "City", "name": "Eastleigh" },
        { "@type": "AdministrativeArea", "name": "New Forest" },
        { "@type": "City", "name": "Romsey" },
        { "@type": "City", "name": "Ringwood" },
        { "@type": "City", "name": "Christchurch" }
      ],
      "serviceArea": {
        "@type": "GeoCircle",
        "geoMidpoint": {
          "@type": "GeoCoordinates",
          "latitude": 50.9097,
          "longitude": -1.4044
        },
        "geoRadius": "50000"
      }
    }
  ]
}
```

Note: Replace `PLACEHOLDER` values in `sameAs` with real profile URLs before deploying. `width`/`height` on the logo should reflect the actual image dimensions. The `SearchAction` can be omitted if the site has no search functionality — a standard Next.js static site typically does not.

---

### Fix 2 (High) — Update Service nodes to use @id and provider reference

Replace each `provider` inline object with an `@id` reference to the root business entity, and add `@id`, `url`, and `serviceType` to each Service node. Example for one node:

```json
{
  "@type": "Service",
  "@id": "https://flyerdistributionhampshire.co.uk/services#leaflet-distribution",
  "name": "Leaflet Distribution",
  "serviceType": "Leaflet Distribution",
  "url": "https://flyerdistributionhampshire.co.uk/services",
  "description": "Standard door-to-door leaflet delivery to households across your chosen areas in Hampshire and Dorset.",
  "provider": {
    "@id": "https://flyerdistributionhampshire.co.uk/#business"
  },
  "areaServed": {
    "@type": "AdministrativeArea",
    "name": "Hampshire and Dorset"
  },
  "offers": {
    "@type": "Offer",
    "priceCurrency": "GBP",
    "description": "Price on request. Contact us for a tailored quote based on your postcode areas and leaflet quantity."
  }
}
```

Apply the same pattern to all 6 Service nodes, using unique `#` fragment identifiers.

---

### Fix 3 (High) — Rename logo image file

The current filename `Flyer Distribution Logo White Cropped.png` contains spaces, making the URL technically invalid. Rename the file on the server to `flyer-distribution-logo-white-cropped.png` (or any slug without spaces) and update all references in the codebase. This affects:
- `app/page.tsx` line 102 (`image` property)
- Any `<Image>` components referencing the same file
- The `logo` ImageObject once added per Fix 1

---

### Fix 4 (Medium) — Add area-page LocalBusiness references

Each area page currently has only a BreadcrumbList. Adding a minimal reference to the root business entity on area pages strengthens the geo-entity signal:

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://flyerdistributionhampshire.co.uk" },
        { "@type": "ListItem", "position": 2, "name": "Areas", "item": "https://flyerdistributionhampshire.co.uk/areas" },
        { "@type": "ListItem", "position": 3, "name": "Southampton", "item": "https://flyerdistributionhampshire.co.uk/areas/southampton" }
      ]
    },
    {
      "@type": "Service",
      "@id": "https://flyerdistributionhampshire.co.uk/areas/southampton#service",
      "name": "Flyer Distribution in Southampton",
      "serviceType": "Leaflet Distribution",
      "url": "https://flyerdistributionhampshire.co.uk/areas/southampton",
      "provider": {
        "@id": "https://flyerdistributionhampshire.co.uk/#business"
      },
      "areaServed": {
        "@type": "City",
        "name": "Southampton",
        "containedInPlace": {
          "@type": "AdministrativeArea",
          "name": "Hampshire"
        }
      }
    }
  ]
}
```

Apply equivalent markup to all six area pages.

---

## 6. Score Breakdown

| Category | Max | Score | Notes |
|---|---|---|---|
| Format (JSON-LD, https context, absolute URLs) | 15 | 13 | All JSON-LD, correct context; deduct 2 for broken image URL |
| LocalBusiness completeness | 25 | 4 | Present but missing @id, address, sameAs, serviceArea, logo |
| Service schema quality | 15 | 5 | 6 nodes present but missing @id, url, offers, serviceType, @id cross-links |
| BreadcrumbList correctness | 15 | 13 | All 6 area pages structurally correct; /areas index missing |
| FAQPage | 10 | 7 | Structurally valid; no Google SERP value as of May 2026 |
| Missing schema opportunities | 20 | 0 | WebSite, sameAs, serviceArea, page-level types all absent |
| **Total** | **100** | **42** | Adjusted for critical SAB gaps |

**Final score: 31 / 100**

The schema framework exists — all files use JSON-LD, the correct context, and absolute URLs — but the implementation is thin and missing the properties that carry the most weight for a local service business in Google Search. The three highest-impact fixes, in order, are: (1) add `@id` to the LocalBusiness and reference it everywhere, (2) add `serviceArea` with proper geo types for SAB local pack eligibility, and (3) add `sameAs` links to any verified external profiles. The broken logo URL with spaces should also be fixed as a quick win.
