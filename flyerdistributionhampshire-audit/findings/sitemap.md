# Sitemap & URL Architecture Findings
**Score: 71 / 100**
**Auditor:** seo-sitemap — 2026-06-24

## Checks

| Check | Result |
|---|---|
| XML format validity | PASS — Next.js MetadataRoute.Sitemap generates valid XML |
| URL count (under 50,000) | PASS — 12 URLs |
| Trailing slash consistency | PASS — no trailing slashes throughout |
| Non-200 / noindex URLs in sitemap | PASS — /blog correctly excluded |
| Sitemap referenced in robots.txt | PASS |
| URL structure quality | PASS — clean, lowercase, hyphenated, logical hierarchy |
| Sitemap completeness | PASS — all 12 indexable pages present |
| Crawl depth | PASS — all pages within 2 clicks of homepage |
| `lastModified` accuracy | FAIL — `new Date()` generates build timestamp for all URLs |

## High Priority

**H1. `lastModified: new Date()` — identical timestamp for all 12 URLs**
This is the most significant technical issue. Every URL shows the same date (the build timestamp). Google cautions that inaccurate lastmod values are ignored entirely. Fix: assign static ISO date strings per route reflecting actual last content-change date.

```ts
{ url: `${BASE_URL}`, lastModified: "2026-06-24", priority: 1 },
{ url: `${BASE_URL}/services`, lastModified: "2026-06-10", priority: 0.8 },
// etc.
```

## Medium Priority

**M1. Area pages don't cross-link to /services or sibling area pages**
Southampton → Winchester and Eastleigh; Bournemouth → Poole; etc. Adding "Nearby areas" and "Our services" links from area pages strengthens the internal linking graph.

**M2. FAQ answer for "What areas do you cover?" lists towns as plain text**
Eastleigh, Romsey, Christchurch etc. are named in the answer but not hyperlinked to area pages. Missed contextual linking opportunity.

## Low Priority

**L1. `changeFrequency` and `priority` in sitemap.ts can be removed**
Google ignores both fields. Removing reduces payload and eliminates noise.

**L2. About/quote/services page titles lack geo context**
- /about: "About Us" → "About Flyer Distribution Hampshire"
- /quote: "Get a Free Quote" → "Get a Free Leaflet Distribution Quote | Hampshire & Dorset"
- /services: "Leaflet Distribution Services" → "Leaflet Distribution Services | Hampshire & Dorset"

## Secondary Town Pages Assessment

Seven towns in "Also Covering" (Eastleigh, Romsey, Christchurch, Hythe, Totton, Hedge End, Chandler's Ford) currently have no dedicated pages. Recommendation: hold at current state except for Eastleigh (SO50/SO53) and Christchurch (BH23), which have the highest search volume and most distinct postcode coverage. Expanding all 7 towns risks thin-content doorway page issues if content cannot be meaningfully differentiated.

## Strengths

- /blog correctly excluded from sitemap while remaining crawlable (noindex, follow)
- All 12 indexable pages in sitemap
- Clean URL structure throughout: `/areas/new-forest`, `/faq` etc.
- All pages within 2 clicks from homepage
- Internal links to /quote from every page (good conversion flow)
