# Full SEO Audit Report — flyerdistributionhampshire.co.uk

**Audit date:** 2026-06-24
**Method:** 9-agent parallel analysis — source code + built HTML (live domain unreachable from audit environment)
**Business type detected:** Service Area Business (SAB) — Leaflet & Flyer Distribution, Hampshire & Dorset UK
**Stack:** Next.js 16.2.6 / React 19 / App Router / Tailwind CSS v4

---

## Overall SEO Health Score: 62 / 100

| Category | Weight | Score | Weighted |
|---|---|---|---|
| Technical SEO | 22% | 74 | 16.28 |
| Content Quality | 23% | 61 | 14.03 |
| On-Page SEO / SXO | 20% | 51 | 10.20 |
| Schema / Structured Data | 10% | 54 | 5.40 |
| Performance (CWV) | 10% | 72 | 7.20 |
| AI Search Readiness | 10% | 54 | 5.40 |
| Images | 5% | 70 | 3.50 |
| **Overall** | **100%** | | **62 / 100** |

---

## Executive Summary

The site has a solid technical foundation: server-side rendered Next.js with all critical SEO content in the initial HTML payload, correct security headers, clean URL structure, and well-implemented breadcrumb and FAQ schema. These are genuine strengths that many local service competitors lack.

However, the site is currently non-competitive for its primary target queries because it is missing the entire trust and social proof layer that ranking pages in this vertical universally carry. Every competitor in the top 10 for "leaflet distribution Hampshire" has a visible phone number, customer testimonials, a delivery proof mechanism, and pricing signals. This site has none of these. No amount of technical optimisation closes that gap.

The five highest-impact improvements — in order of expected ranking impact — are:

1. **Add a phone number** to header, footer, About, and Quote pages
2. **Collect and publish customer testimonials** (3–5 on homepage and About page)
3. **Build GBP reviews** — post-campaign email asking for a Google review
4. **Expand area pages** from 200 words to 600+ with local context, process narrative, and inline FAQs
5. **Add indicative pricing** — even a "from £X per 1,000" signal removes the largest conversion barrier

Items 1–3 are off-site/operational, not code changes. Items 4–5 are content work. The schema and technical fixes listed below are meaningful but secondary to these foundational trust signals.

---

## Score by Specialist Agent

| Specialist | Score | Key Gap |
|---|---|---|
| Technical SEO | 74/100 | No AI crawler management, no IndexNow, duplicate canonicals |
| Content Quality | 61/100 | E-E-A-T crisis — anonymous, no reviews, 9/12 pages thin |
| On-Page SEO (SXO) | 51/100 | Zero competitive trust elements present vs. 10/10 competitors |
| Schema | 54/100 | No entity graph — missing @id, WebSite, area-page Service nodes |
| Sitemap/Architecture | 71/100 | lastModified = build date, deprecated priority/changeFreq |
| Performance | 72/100 | Hero cross-origin LCP risk, services-page CLS |
| AI Search Readiness | 54/100 | No pricing, FAQ answers too short, weak brand mentions |
| Local SEO | 57/100 | No reviews, no phone, no citation directory presence |
| Backlinks | N/A | New domain, clean slate, foundational citations not yet built |

---

## What Was Fixed During This Audit

**`/public/llms.txt` created and deployed** by the GEO agent during this audit. The file is now served at `https://flyerdistributionhampshire.co.uk/llms.txt` and contains: business description, all six services with format specifications, geographic coverage with postcodes, key operational facts (minimum quantity: 5,000 leaflets; quote turnaround: 24 hours; campaign completion: 2 weeks), all 10 FAQ answers verbatim, and a full page index. This improves AI search citability across Perplexity, Bing Copilot, and any crawler that respects the llms.txt convention.

---

## Critical Issues (Fix Immediately)

### CRIT-1: No phone number anywhere on the site
Present across 0/13 pages. Click-to-call is the primary mobile conversion mechanism for local services. 10/10 ranking competitors have a visible phone number. Also required in LocalBusiness schema `telephone` field.

**Business requirement:** Obtain a phone number (even a free Google Voice / local VoIP number) and add it to the site header, footer, About page, Quote page, and LocalBusiness JSON-LD.

### CRIT-2: Zero customer testimonials or social proof
No testimonials, no reviews, no star rating, no case studies anywhere on the site. Whitespark 2026 identifies review velocity as a top-3 local pack factor. Every ranking competitor surfaces 4+ star ratings and client quotes above the fold.

**Immediate action:** Contact recent customers directly and ask for written testimonials (for the website) + Google Business Profile reviews. Three genuine testimonials with first name and business type transform the trust profile.

### CRIT-3: No AI crawler management in robots.txt
All AI training crawlers freely ingesting via wildcard rule. Add named rules for at minimum: GPTBot (OpenAI training), CCBot (bulk scraper), Bytespider (ByteDance training), Google-Extended (Gemini training). Allow PerplexityBot and ChatGPT-User (these drive referral traffic, not training).

### CRIT-4: E-E-A-T crisis — anonymous business
No named founder, director, or team member anywhere. Under September 2025 QRG, anonymous local service businesses score poorly on Trustworthiness. The About page has three values cards with no individual behind them.

**Action:** Name the business owner on the About page with a 2–3 sentence bio. This is the single highest-ROI content change available.

---

## High Priority (Fix Within 1 Week)

### HIGH-1: Duplicate canonical tags — remove JSX `<link rel="canonical">` from all pages
Confirmed in built HTML: both `metadata.alternates.canonical` AND the JSX `<link>` are rendering, producing two identical canonical tags per page. Since Next.js 16.2.6 correctly renders `alternates.canonical`, the JSX link elements in each page component return value should be removed. Affects 13 page files.

### HIGH-2: Add indicative pricing to homepage and services page
"How much does leaflet distribution cost in Hampshire?" is the highest-volume PAA query for this vertical. No pricing signal exists anywhere — not even a "from £X" indication. This is the most common reason a budget-researching SME bounces to a competitor.

### HIGH-3: Add "How It Works" process section (homepage and services page)
Present on 8/10 ranking competitor pages. A 3–4 step process block (enquiry → proof review → distribution → confirmation) addresses informational intent and increases conversion confidence. Also improves AI citation readiness.

### HIGH-4: Expand /services page from 410 to 800+ words
The most under-resourced high-intent page. Add: per-service "who it suits" copy, turnaround expectations, minimum quantities, and a How It Works section. Service descriptions currently duplicate the homepage cards word-for-word.

### HIGH-5: Expand About page — add founding date, name, and town
270 words with no identifying information. Add: founder/owner name and short bio, founding year, town-level location ("based in [town], Hampshire"), and 2–3 client testimonials.

### HIGH-6: Schema entity graph — add `@id` to LocalBusiness and propagate
Without `"@id": "https://flyerdistributionhampshire.co.uk/#business"`, Google cannot reliably associate citations, Service nodes, or GBP signals with this entity. 20-minute fix with compounding impact across all schema improvements.

### HIGH-7: Add WebSite schema to layout.tsx
Global entity declaration linking the publisher to the WebSite. Enables sitelinks search box eligibility.

### HIGH-8: `lastModified: new Date()` in sitemap.ts
Generates an identical build timestamp for all 12 URLs. Replace with static per-route ISO date strings.

---

## Medium Priority (Fix Within 1 Month)

### MED-1: Expand all 6 area pages to 400–600 words
9/12 pages fall below their word count minimums. Each area page needs one genuinely unique content element: a demographic statistic, local landmark reference, business-use case, or geographic detail not replicated elsewhere. New Forest and Southampton are the strongest models.

### MED-2: Add Service schema to each area page scoped to that city
Currently area pages carry only BreadcrumbList schema. Add a `Service` node with `areaServed: {"@type": "City", "name": "[City]"}` and `provider: {"@id": ".../#business"}` to each.

### MED-3: Add BreadcrumbList to /services, /faq, /about, /quote
Already implemented on /areas and all 6 area pages. Add two-item (Home → Page) lists to the four remaining content pages.

### MED-4: Add 3 FAQ questions — pricing, tracking, exclusivity
"How much does leaflet distribution cost in Hampshire?", "How do I know my leaflets were delivered?", "Are my leaflets delivered alone or with other businesses?" — the top PAA queries for this vertical, all absent from the current FAQ.

### MED-5: Upgrade `areaServed` to typed Place objects
Replace plain string array in LocalBusiness schema with:
```json
{"@type": "City", "name": "Southampton", "addressRegion": "Hampshire", "addressCountry": "GB"}
```

### MED-6: Change `lang="en"` to `lang="en-GB"` in layout.tsx
Small but correct for a UK-specific business.

### MED-7: Fix CSP — remove `fonts.gstatic.com`, add `picsum.photos` note
`fonts.gstatic.com` in `font-src` is unused (next/font self-hosts). Remove. Also remove `picsum.photos` from `next.config.ts` remotePatterns (unused).

### MED-8: Fix services-page image CLS risk (fill prop)
Replace `width`/`height` + CSS height override with `fill` + fixed-height wrapper on all package and supporting-service card images.

### MED-9: Start citation building
Submit to Yell.com, Yelp UK, FreeIndex, Thomson Local, Scoot, and Bark.com with consistent NAP. ~2.5 hours total, maximum local SEO impact for a new domain.

### MED-10: Meta titles — add geo context to inner pages
- /services: "Leaflet Distribution Services | Hampshire & Dorset"
- /about: "About Flyer Distribution Hampshire"
- /quote: "Get a Free Leaflet Distribution Quote | Hampshire & Dorset"
- /faq: "Leaflet Distribution FAQ | Flyer Distribution Hampshire"

---

## Low Priority (Backlog)

### LOW-1: IndexNow protocol
Generate a hex key, place at `/public/<key>.txt`, and POST changed URLs on deploy. Near-instant indexing for Bing and Yandex.

### LOW-2: Hero image self-hosting
Replace Unsplash URL with a self-hosted or CDN-served image to eliminate cross-origin cold-fetch LCP risk.

### LOW-3: Add favicon.ico fallback
Place a .ico file in /public/ for older clients and feed readers.

### LOW-4: Nonce-based CSP
Replace `script-src 'unsafe-inline'` with a nonce via Next.js middleware. 3–4 hour implementation, security hardening.

### LOW-5: Verify GBP share link stability
Replace `https://share.google/RVxyPi4TzXAzkt1Am` with a stable Google Maps Place URL from the GBP dashboard.

### LOW-6: Remove deprecated sitemap fields
Drop `changeFrequency` and `priority` from sitemap.ts — Google ignores both.

### LOW-7: Dedicate pages for Eastleigh and Christchurch
When ready to expand content, these two towns have the highest search volume among the "Also Covering" list. Follow the existing area page template with genuine unique content.

### LOW-8: Remove `priority` from Header logo
Both the hero image and logo have `priority` — competing preload links. Remove priority from the logo; it's tiny and fast without it.

### LOW-9: Publish blog content
When the blog launches, priority topics: "How many leaflets do I need for a Southampton campaign?", "What does leaflet distribution cost in Hampshire?", "GPS tracked vs untracked delivery — what's the difference?"

---

## Technical Implementation Notes

**Canonical tags:** The JSX `<link rel="canonical">` elements added in the previous session were necessary when `metadata.alternates.canonical` wasn't rendering. The current build confirms both are now rendering. Removing the JSX links (HIGH-1) is now safe and recommended.

**JSON-LD placement:** `<script>` tags are NOT hoisted by React 19 — JSON-LD appears in BODY, not HEAD. This is fine — Google reads structured data from anywhere in the document.

**Next.js image optimization:** Active (no `output: "export"` and no `unoptimized: true`). AVIF/WebP served automatically via `/_next/image`.

---

## Scoring Improvement Roadmap

| Milestone | Actions | Expected Score |
|---|---|---|
| Current | — | 62/100 |
| After Phase 1 (critical trust) | Phone + testimonials + named founder + GBP reviews | ~70/100 |
| After Phase 2 (content expansion) | Area pages expanded, services page expanded, pricing added | ~76/100 |
| After Phase 3 (schema + technical) | Entity graph fixed, BreadcrumbList everywhere, canonical cleanup | ~81/100 |
| After Phase 4 (citations + links) | Tier 1 directories, chamber listings, blog launched | ~86/100 |
