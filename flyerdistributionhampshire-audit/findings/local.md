# Local SEO Findings
**Score: 57 / 100**
**Auditor:** seo-local — 2026-06-24
**Business type:** Service Area Business (SAB) — no storefront

## Dimension Scores

| Dimension | Weight | Score | Weighted |
|---|---|---|---|
| GBP Signals | 25% | 40 | 10.0 |
| Reviews & Reputation | 20% | 10 | 2.0 |
| Local On-Page SEO | 20% | 80 | 16.0 |
| NAP Consistency & Citations | 15% | 65 | 9.75 |
| Local Schema Markup | 10% | 60 | 6.0 |
| Local Link & Authority Signals | 10% | 30 | 3.0 |

## Critical

**C1. Zero reviews or social proof anywhere on the site**
No testimonials, no star rating, no Google review widget, no aggregateRating schema. Whitespark 2026 identifies review velocity as a top-3 local pack factor (18-day rule: rankings decline with no new reviews for 3 weeks). This is the most significant ranking and conversion gap.

**C2. No phone number anywhere**
Missing from header, footer, About page, Quote page, and LocalBusiness schema. Click-to-call is the primary mobile conversion mechanism for local services. Without it, the business cannot appear in call-only ad formats or voice search results.

## High

**H1. GBP share link may not be stable**
`https://share.google/RVxyPi4TzXAzkt1Am` is a shortlink. Obtain the canonical Google Maps Place URL (`https://www.google.com/maps/place/?q=place_id:ChIJ...`) from the GBP dashboard for use in schema `sameAs` and footer link.

**H2. Upgrade `areaServed` to typed Place objects**
Plain string array in LocalBusiness schema. Replace with:
```json
{"@type": "City", "name": "Southampton", "addressRegion": "Hampshire", "addressCountry": "GB"}
```

**H3. No per-area Service schema on area pages**
Each area page carries only BreadcrumbList. Google cannot infer from breadcrumbs alone that the business actively serves Southampton. Add a `Service` node with `areaServed` scoped to that city + `provider @id` pointing to the homepage LocalBusiness entity.

**H4. No citation presence on Tier 1 UK directories**
No listings on Yell.com, Thomson Local, FreeIndex, Scoot, or 192.com. Citation consistency across these directories is a core local pack factor. Submit to each with identical NAP: "Flyer Distribution Hampshire" + email + website URL.

## Medium

**M1. Eastleigh and Christchurch have no dedicated pages**
Of the 7 "Also Covering" towns, these two have the highest search volume. Eastleigh (SO50–SO53) sits between Southampton and Winchester; Christchurch (BH23) bridges Bournemouth and Dorset. Both warrant dedicated area pages with genuine unique content.

**M2. Area pages don't cross-link to each other**
Southampton links to /quote but not to Winchester or Eastleigh. Bournemouth doesn't link to Poole. Adding "nearby areas" blocks improves internal linking and captures cluster intent.

**M3. `openingHoursSpecification` missing from LocalBusiness schema**
Required for Knowledge Panel hours display. Add if hours are accurate (e.g. Mon–Fri 09:00–17:00).

**M4. `priceRange` absent from schema**
Even a descriptive `priceRange: "££"` or "From £X per 1,000 leaflets" gives GBP parity and reduces friction for price-comparing searchers.

**M5. `lang="en"` should be `lang="en-GB"`**
Fix in app/layout.tsx. Affects language parsing by search engines and assistive technologies.

**M6. BH24 and SO45 postcode overlaps between area pages**
BH24 appears on both New Forest and Ringwood pages. SO45 appears on both Southampton and New Forest pages. Geographically accurate but add a clarifying sentence on each affected page.

## NAP Consistency Audit

| Element | Schema | Footer | About | Status |
|---|---|---|---|---|
| Name | Flyer Distribution Hampshire | Flyer Distribution Hampshire | Flyer Distribution Hampshire | Consistent ✓ |
| Address | Omitted (SAB — correct) | "Hampshire, UK" | Omitted | Acceptable ✓ |
| Phone | Omitted | Omitted | Omitted | Critical gap ✗ |
| Email | flyerdistributionhampshire@gmail.com | flyerdistributionhampshire@gmail.com | Not shown | Partial ✓ |
| GBP link | sameAs present | Footer link present | Not present | Partial |

## Local Content Strengths

- Correct Hampshire vs Dorset administrative geography maintained throughout
- Specific neighbourhood naming on every area page
- Postcode-level specificity (strong local relevance signal)
- Vehicle distribution angle for New Forest visitor/day-tripper audience is locally intelligent
- All 6 featured towns linked from homepage and /areas hub
