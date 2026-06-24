# Schema Markup Findings
**Score: 54 / 100**
**Auditor:** seo-schema — 2026-06-24

## Schema Inventory

| Location | Type | Status |
|---|---|---|
| app/page.tsx | LocalBusiness | Present, significant gaps |
| app/services/page.tsx | Service @graph (×6) | Present, entity graph broken |
| app/faq/page.tsx | FAQPage | Well-implemented |
| app/areas/page.tsx | BreadcrumbList (2 items) | Correct |
| app/areas/[town]/page.tsx ×6 | BreadcrumbList (3 items) | Correct |
| app/layout.tsx | None | WebSite schema missing |

## Critical

**C1. LocalBusiness missing `@id` (highest impact)**
Without a stable IRI (`"@id": "https://flyerdistributionhampshire.co.uk/#business"`), Google cannot resolve the entity across pages. The six Service nodes' `provider` stubs cannot cross-reference it. Single most impactful omission for Knowledge Panel candidacy. 20-minute fix, maximum impact.

**C2. `@type` is bare `LocalBusiness`**
Use `["LocalBusiness", "ProfessionalService"]` dual type. ProfessionalService is Google-confirmed eligible for this service category and provides stronger classification signals.

**C3. No WebSite schema in layout.tsx**
A `WebSite` entity with `publisher` linking to `@id` of LocalBusiness should be in layout.tsx. Also enables sitelinks search box eligibility via `potentialAction: SearchAction`.

**C4. Service nodes have no `@id` and cannot be cross-referenced**
Six services are defined but float independently. Without `@id` on each Service and a `hasOfferCatalog`/`makesOffer` link on LocalBusiness, Google sees them as unconnected entities.

**C5. Area pages have only BreadcrumbList — no entity schema**
Six area pages are high-intent landing pages with zero entity signal beyond navigation. Each should carry a `Service` node scoped to that city.

## High

**H1. Missing `logo` as ImageObject**
The `image` field points to the logo but Google's LocalBusiness spec separates `image` (contextual photo) from `logo` (brand mark as `ImageObject`). Logo URL already hosted — declare it under `logo` as well.

**H2. Missing `contactPoint`**
Add `ContactPoint` with `contactType: "customer service"`, `email`, `areaServed: "GB"`, `availableLanguage: "English"`.

**H3. Service nodes missing `serviceType` and `url`**
`serviceType` is plain-text (e.g. "Door-to-door leaflet distribution"). Each Service should carry `"url": "https://flyerdistributionhampshire.co.uk/services"`.

**H4. `openingHoursSpecification` absent**
Even approximate hours (Mon–Fri 09:00–17:00) are a required signal for Knowledge Panel display. Only add if hours are accurate.

## Medium

**M1. `areaServed` uses plain strings**
Replace flat strings with typed objects:
```json
{"@type": "City", "name": "Southampton", "addressRegion": "Hampshire", "addressCountry": "GB"}
```
Gives Google explicit geographic entity anchoring rather than keyword matching.

**M2. `sameAs` has only one entry**
The GBP share link is present. Add LinkedIn, Facebook, or trade directory URLs to strengthen the entity's identity graph.

**M3. No `Review` or `AggregateRating`**
Worth adding once genuine reviews exist. Priority once GBP reviews accumulate.

## Info

**I1. FAQPage — retire from SERP but keep for AI**
Google removed FAQPage rich results on May 7, 2026. The markup is valid, aids AI/LLM citation, and should be kept. Do not remove.

## Score Breakdown

| Category | Max | Score | Notes |
|---|---|---|---|
| Context & syntax | 15 | 14 | All blocks valid |
| LocalBusiness completeness | 25 | 10 | Missing @id, @type subtype, hours, logo, contactPoint |
| Rich result eligibility | 20 | 14 | BreadcrumbList valid ×7; Service graph present |
| Entity graph coherence | 20 | 4 | Services not linked to business; no WebSite; area pages no entity |
| Deprecated type handling | 10 | 8 | FAQPage present but not harmful |
| Coverage (all pages have schema) | 10 | 4 | Area pages only breadcrumb; no schema on /about, /quote |

## Recommended Implementation Order

1. Add `@id` to LocalBusiness + propagate to all Service `provider` fields — 30 min
2. Change to `["LocalBusiness", "ProfessionalService"]` — 2 min
3. Add WebSite JSON-LD to layout.tsx — 10 min
4. Add `serviceType` + `@id` to each Service node in services/page.tsx — 20 min
5. Add Service schema to each of the 6 area pages scoped to that city — 45 min
6. Add `logo` ImageObject and `contactPoint` to LocalBusiness — 10 min
7. Upgrade `areaServed` strings to typed objects — 10 min
8. Add `openingHoursSpecification` only if hours are accurate
