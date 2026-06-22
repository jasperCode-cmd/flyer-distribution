# Full SEO Audit Report — flyerdistributionhampshire.co.uk

**Audit date:** 2026-06-22  
**Auditor:** SEO Audit System (source-code analysis)  
**Method:** Source code + built HTML analysis (live domain unreachable per environment policy)  
**Next.js version:** 16.2.6 (App Router, Turbopack build)  
**Pages audited:** 13 (12 indexed + 1 noindex blog)

---

## Overall SEO Health Score: 57 / 100

| Category | Weight | Score | Weighted |
|----------|--------|-------|---------|
| Technical SEO | 22% | 58 | 12.8 |
| Content Quality | 23% | 48 | 11.0 |
| On-Page SEO | 20% | 65 | 13.0 |
| Schema / Structured Data | 10% | 60 | 6.0 |
| Performance (CWV) | 10% | 65 | 6.5 |
| AI Search Readiness | 10% | 42 | 4.2 |
| Images | 5% | 72 | 3.6 |
| **TOTAL** | **100%** | | **57.1** |

---

## Executive Summary

Flyer Distribution Hampshire is a new local Service Area Business website built on Next.js 16. The technical foundations are solid — the site has good security headers, proper robots.txt, a correct sitemap, structured data on key pages, Open Graph/Twitter Card metadata, and clean URL structure. These were recently implemented and are working correctly.

However, the site has significant gaps in three areas that will materially limit its search performance:

**1. Critical technical issue:** Canonical tags, while defined in source code via Next.js `alternates.canonical`, are NOT appearing in the static HTML output served to crawlers. This is a confirmed build artifact. Google may still read them via JavaScript execution, but it creates unnecessary crawl ambiguity and is a high-priority fix.

**2. Content depth and E-E-A-T:** Almost all pages are thin. The homepage, about page, and area pages lack social proof (zero reviews/testimonials), pricing information, named team members, case studies, or years of experience. The blog is entirely empty. These gaps severely limit trust signals and reduce the probability of ranking for competitive local queries.

**3. Missing local SEO fundamentals:** No Google Business Profile presence referenced anywhere. No phone number. No physical address. Gmail contact email. The LocalBusiness schema is missing critical properties (telephone, address, @id). For a local SAB competing on "leaflet distribution Southampton"-type queries, GBP is essential and currently absent.

### Top 5 Critical Issues
1. **Canonical tags missing from rendered HTML** — all 12 indexed pages
2. **No Google Business Profile** — essential for local pack ranking
3. **No phone number** — major trust and conversion gap
4. **Favicon file not found** (`/favicon.png` referenced but `public/favicon.png` doesn't exist — only `Favicon.png` with capital F)
5. **Zero content on blog** — missed opportunity; blog is linked in footer and indexed (should be noindex or populated)

### Top 5 Quick Wins
1. Rename `public/Favicon.png` → `public/favicon.png` (case fix, 2 minutes)
2. Add phone number to footer, schema, and quote form header
3. Add 3–5 client testimonials to homepage and area pages
4. Fix canonical rendering: add explicit `<link rel="canonical">` via a layout component
5. Add `WebSite` schema with `SearchAction` to layout

---

## 1. Technical SEO

### 1.1 Crawlability

**robots.txt** (PASS)
```
User-Agent: *
Allow: /
Disallow: /admin/
Sitemap: https://flyerdistributionhampshire.co.uk/sitemap.xml
```
Correct. `/admin/` blocked. Sitemap properly declared.

**Sitemap** (PASS — minor issues)
- 12 URLs present, all on correct domain
- `/blog` correctly excluded (noindex page)
- All 6 area sub-pages included
- Issue: All pages have identical `lastModified` timestamp (build time). Static `lastmod` would be more accurate.
- Issue: All non-homepage pages have `priority: 0.8` — no differentiation between service pages and area pages.

**URL Structure** (PASS)
- Clean, descriptive slugs: `/areas/southampton`, `/areas/new-forest`, `/services`, `/faq`
- No trailing slash inconsistencies visible in source
- No query parameters on key pages
- `/areas/new-forest` correctly uses hyphen (not `/new_forest`)

### 1.2 Indexability

**Canonical Tags** (CRITICAL FAIL)

All 12 indexed pages define `alternates.canonical` in their Next.js metadata export. However, zero canonical `<link>` tags appear in the static HTML served by the build. Verification: manually inspected `index.html`, `about.html`, `areas/southampton.html` — none contain `<link rel="canonical">`. RSC payload segments also contain no canonical data.

In Next.js 15+, `alternates.canonical` is rendered via React's metadata API which injects tags client-side. Google claims to execute JavaScript but relies on canonical being in the initial HTML for certainty. Other crawlers (Bing, AI bots) may miss it entirely.

**Current canonical source code (page.tsx):**
```typescript
alternates: {
  canonical: "https://flyerdistributionhampshire.co.uk/about",
},
```
**What appears in rendered HTML:** Nothing.

**Fix:** Add explicit `<link rel="canonical" href={canonicalUrl}>` in the page `<head>` using a layout-level component or Next.js `generateMetadata` with direct `<link>` tag.

**noindex** (PASS)
- Blog page correctly sets `robots: { index: false, follow: true }`
- All other pages do not set noindex

**Meta robots** (PASS)
- No `X-Robots-Tag` conflicts detected
- No accidental noindex on indexed pages

### 1.3 Security Headers

All 5 expected security headers are present in `next.config.ts` and applied to all routes via `/(.*)`  pattern:

| Header | Value | Status |
|--------|-------|--------|
| X-Frame-Options | DENY | PASS |
| X-Content-Type-Options | nosniff | PASS |
| Referrer-Policy | strict-origin-when-cross-origin | PASS |
| Permissions-Policy | camera=(), microphone=(), geolocation=() | PASS |
| Strict-Transport-Security | max-age=63072000; includeSubDomains; preload | PASS |
| Content-Security-Policy | Present | PASS (see notes) |

**CSP Notes:**
- `img-src` covers `images.unsplash.com` and `images.pexels.com` ✓
- `connect-src` covers `api.web3forms.com` for quote form ✓
- `script-src 'unsafe-inline'` is present — reduces CSP security value but required for Next.js
- `font-src fonts.gstatic.com` — Inter is self-hosted via `next/font`, this may be unused
- Missing: `https://www.googletagmanager.com` (if analytics added later, CSP will block it)

### 1.4 Performance Signals (from HTML analysis)

**Preloads detected in homepage HTML:**
- Font: `83afe278b6a6bb3c-s.p.0q-301v4kxxnr.woff2` (Inter self-hosted — good)
- Hero image: Unsplash photo (1920px) — preloaded ✓
- Logo: `website_logo_main.png` — preloaded ✓

**LCP candidate:** Hero section background image from Unsplash (1920×700). It's loaded via Next.js `<Image>` with `priority` prop — this is correct and should optimize LCP. However, the image is hosted on Unsplash CDN (third-party), adding DNS lookup latency.

**JavaScript:** Multiple async script chunks loaded. No render-blocking scripts detected in `<head>`. Next.js App Router properly defers non-critical JS.

**Images:** All images use Next.js `<Image>` component with explicit `width` and `height`. This prevents CLS (layout shift). No images with missing dimensions detected.

**Fonts:** Inter loaded via `next/font/google` with `display: 'swap'` — correct, prevents FOIT.

### 1.5 Missing Critical File

**Favicon** (HIGH)

Layout.tsx references: `icon: "/favicon.png"`

`/home/user/flyer-distribution/public/` contains: `Favicon.png` (capital F), NOT `favicon.png`

On Linux servers (case-sensitive filesystem), `/favicon.png` will 404. The browser tab will show no favicon. This is a trust/brand signal issue.

**Fix:** `mv /home/user/flyer-distribution/public/Favicon.png /home/user/flyer-distribution/public/favicon.png`

### 1.6 Analytics

**No analytics installed.** No Google Analytics 4, Google Tag Manager, Microsoft Clarity, Hotjar, or any tracking code found in any source file. This means:
- No organic traffic data
- No conversion tracking (quote form submissions)
- No GSC data will be available
- Cannot measure SEO impact of changes

**Fix:** Install GA4 + Google Search Console as immediate priority. Web3Forms (the quote form submission handler) does capture leads, but there's no website-side tracking.

### 1.7 Mobile

- `<meta name="viewport" content="width=device-width, initial-scale=1">` present ✓
- Tailwind responsive classes used throughout (sm:, md:, lg: breakpoints) ✓
- Mobile hamburger menu implemented in Header component ✓
- No explicit AMP pages (not needed for this site type)

---

## 2. Content Quality

### 2.1 Page-by-Page Assessment

**Homepage (/)** — Score: 6/10
- H1: "Professional Flyer Distribution in Hampshire and Dorset" ✓ (keyword-rich)
- Content: Hero, 3 trust signals, 6 service cards, area links, CTA
- Weakness: Trust signals are generic claims ("Reliability", "Targeted Postcodes", "Tracked Delivery") with no evidence. No customer names, no statistics, no testimonials.
- Missing: How long in business, number of campaigns delivered, number of households reached
- Word count: ~400 words visible to users (thin for a competitive local service homepage)

**Services (/services)** — Score: 6/10
- H1: "Our Services" (weak — generic)
- Heading hierarchy issue: Package card titles use `<h2>` instead of `<h3>`, creating a broken hierarchy where the section title ("Full Print and Distribution Packages") is also `<h2>`. Google may deweight both.
- Content describes 6 services adequately but very briefly
- No pricing — this is a significant conversion barrier. Competitors likely show starting prices.
- Word count: ~500 words (adequate for a services page if pricing/social proof added)

**About (/about)** — Score: 4/10
- H1: "About Us"
- Tells the reader they're "local", "independent", "small enough to care" — all generic claims
- No named team members, no photos of actual staff (uses generic Unsplash photo)
- No founding year, no years of experience, no number of campaigns completed
- No company registration number or VAT number
- Three "values" cards (Reliability, Local Knowledge, Transparency) — all claims, no evidence
- This page scores extremely low on E-E-A-T

**FAQ (/faq)** — Score: 7/10
- H1: "Frequently Asked Questions" 
- 10 questions covering: coverage areas, process, design/print options, postcode targeting, quote process, quantities, formats, vehicle distribution, campaign timescales
- Good conversational tone
- FAQPage schema implemented
- Weakness: H2 tags used for each FAQ question (should be fine for FAQ format)
- Missing: Pricing FAQs ("How much does leaflet distribution cost?"), "How do I know my leaflets were delivered?", "What is your minimum order?"
- All answers are honest about "get in touch" — no concrete info provided

**Area Pages (6 pages)** — Score: 5/10
- H1: "Flyer Distribution in [City]" ✓ (keyword-rich)
- Each page has ~200–300 words of body content
- Pages follow identical template: intro, about coverage, postcodes we cover
- Differentiation is minimal — mostly different postcodes and one image
- Southampton: mentions specific neighborhoods (Shirley, Portswood, Bitterne) — good
- Winchester: mentions "affluent households", "county town" — adds value
- Ringwood: only 3 postcodes listed (BH24, BH21, BH31) — very limited
- Missing on all area pages: links to related areas, links to services page, local stats (households, population), case study or testimonial from that area

**Quote (/quote)** — Score: 7/10
- H1: "Get a Free Quote"
- Form is comprehensive and well-designed
- Uses Web3Forms for submission (no server-side code needed)
- Weakness: No trust signals near the form ("We respond within 24 hours" is in the sub-header but no social proof)
- Missing: Phone number as alternative contact
- Quote form has 12+ fields — may cause form abandonment. Consider a 2-step form.

**Blog (/blog)** — Score: 1/10
- H1: "Blog"
- Zero content — only text: "We are working on guides and tips for local businesses running leaflet campaigns. Check back soon."
- Page is noindex (correct given no content) but is linked from the footer
- Blog is a major missed opportunity for long-tail content ("how many leaflets do I need?", "best leaflet sizes for restaurants")

### 2.2 E-E-A-T Assessment

| Signal | Present | Notes |
|--------|---------|-------|
| Experience (real campaigns described) | No | No case studies or examples |
| Expertise (technical knowledge shown) | Partial | FAQ shows process knowledge |
| Authoritativeness (named authors, awards) | No | No named staff, no industry affiliations |
| Trustworthiness (reviews, contact info) | Low | Email only, no reviews, Gmail address |
| Physical address | No | SAB doesn't need to display, but adds trust |
| Phone number | No | Major gap |
| Company registration | No | Adds legitimacy |
| Review count | 0 | No reviews anywhere |
| Social media links | 0 | No social profiles linked |
| Named team members | 0 | Generic "we" throughout |

**E-E-A-T verdict:** Very low. The site reads like a professional template but lacks any real evidence of an established business. Google's quality raters would likely score this low on E-E-A-T for a YMYL-adjacent service (spending money on marketing).

### 2.3 Thin Content

Pages with insufficient content depth (under 300 substantive words):
- `/about` (~300 words, but all claims — no evidence)
- `/areas/ringwood` (~200 words)
- `/areas/new-forest` (~250 words)
- All other area pages: 250–350 words

### 2.4 Duplicate Content

The 6 area pages share near-identical structure and similar phrasing. While each has some unique content (specific postcodes, local landmarks), the template is very similar. Google may treat these as near-duplicate thin pages.

Risk: **Medium** — distinct enough not to trigger penalties but insufficient to rank strongly for competitive area-specific queries.

---

## 3. On-Page SEO

### 3.1 Title Tags

| Page | Title | Length | Issues |
|------|-------|--------|--------|
| / | Flyer Distribution Hampshire \| Local Leaflet & Flyer Delivery | 62 chars | Good |
| /services | Flyer & Leaflet Distribution Services \| Flyer Distribution Hampshire | 68 chars | Good |
| /about | About Us \| Flyer Distribution Hampshire | 40 chars | Generic H1, could be stronger |
| /faq | FAQ: Frequently Asked Questions \| Flyer Distribution Hampshire | 61 chars | Good |
| /areas | Areas We Cover in Hampshire & Dorset \| Flyer Distribution Hampshire | 67 chars | Good |
| /areas/southampton | Flyer Distribution Southampton \| Flyer Distribution Hampshire | 61 chars | Missing "Hampshire" after Southampton |
| /areas/bournemouth | Flyer Distribution Bournemouth \| Flyer Distribution Hampshire | 61 chars | Good |
| /areas/poole | Flyer Distribution Poole \| Flyer Distribution Hampshire | 56 chars | Good |
| /areas/winchester | Flyer Distribution Winchester \| Flyer Distribution Hampshire | 61 chars | Good |
| /areas/new-forest | Flyer Distribution New Forest \| Flyer Distribution Hampshire | 61 chars | Good |
| /areas/ringwood | Flyer Distribution Ringwood \| Flyer Distribution Hampshire | 59 chars | Good |
| /quote | Get a Free Quote \| Flyer Distribution Hampshire | 48 chars | Could include location |

### 3.2 Meta Descriptions

| Page | Description | Length | Issues |
|------|-------------|--------|--------|
| / | "Reliable flyer and leaflet distribution across Hampshire and Dorset. Reach real households in Southampton, Bournemouth, Poole and Winchester." | 142 chars | Good, location-specific |
| /services | "Full design, print and leaflet distribution services across Hampshire and Dorset. Choose our end-to-end package or distribution-only service." | 141 chars | Good |
| /about | "Learn about Flyer Distribution Hampshire, a local team dedicated to reliable, targeted leaflet delivery across Hampshire and Dorset." | 132 chars | Weak — no USP |
| /faq | "Answers to common questions about leaflet and flyer distribution in Hampshire and Dorset. Covering areas, quantities, campaign planning and more." | 145 chars | Good |
| /areas/southampton | "Leaflet and flyer distribution across Southampton. Targeted postcode delivery for businesses reaching Hampshire's largest city." | 126 chars | Good |
| /areas/bournemouth | "Leaflet and flyer distribution across Bournemouth. Targeted door-to-door delivery for local businesses in Dorset." | 114 chars | Good |
| /quote | "Request a free, no-obligation quote for flyer and leaflet distribution across Hampshire and Dorset." | 100 chars | Short, could include 24hr response |

### 3.3 H1 Tags

All 12 indexed pages have exactly one H1. No missing or duplicate H1s.

### 3.4 Heading Hierarchy Issues

**Services page** — MEDIUM issue:
```
H1: Our Services
  H2: Full Print and Distribution Packages  (section header)
    H2: Design, Print and Deliver  ← WRONG: should be H3 (package card)
    H2: Print and Deliver          ← WRONG: should be H3 (package card)
  H2: Distribution Services  (section header)
    H3: Leaflet Distribution  ← Correct H3 here
    H3: Targeted Postcode Campaigns
    ...
  H2: Not Sure Which Service Is Right for You?
```
The two package titles are H2 when they should be H3, creating an ambiguous hierarchy where Google must decide which H2s are section headers vs content.

**FAQ page** — MEDIUM issue:
All 10 FAQ questions use H2, then the "Still have questions?" CTA also uses H2. This is acceptable in FAQ format but the CTA H2 at the end creates noise in heading structure.

### 3.5 Internal Linking

This is one of the most significant on-page weaknesses:

| Page | Internal links to other pages |
|------|-------------------------------|
| / | /quote, /services, /areas, /areas/* (6 area buttons) |
| /services | /quote only |
| /about | /quote only |
| /faq | /quote only |
| /areas | /quote, /areas/* (6 area cards) |
| /areas/southampton | /quote only |
| /areas/bournemouth | /quote only |
| /areas/poole | /quote only |
| /areas/winchester | /quote only |
| /areas/new-forest | /quote only |
| /areas/ringwood | /quote only |
| /quote | (no internal links in body) |

**Problems:**
- Area pages don't link to the main /services page
- Area pages don't link to other area pages (no related area discovery)
- Services page doesn't link to any area pages
- About page doesn't link to services or areas
- FAQ page answers mention postcode targeting but don't link to /areas
- No page links to /about or /faq (except header nav)

PageRank is funnelled entirely to /quote, starving other pages of link equity.

---

## 4. Schema / Structured Data

### 4.1 Implemented Schemas

| Page | Schema Type | Present |
|------|------------|---------|
| / | LocalBusiness | Yes |
| /services | Service × 6 (in @graph) | Yes |
| /faq | FAQPage | Yes |
| /areas/southampton | BreadcrumbList | Yes |
| /areas/bournemouth | BreadcrumbList | Yes |
| /areas/poole | BreadcrumbList | Yes |
| /areas/winchester | BreadcrumbList | Yes |
| /areas/new-forest | BreadcrumbList | Yes |
| /areas/ringwood | BreadcrumbList | Yes |
| /about | None | Missing |
| /quote | None | Missing |
| /areas | None | Missing |

### 4.2 LocalBusiness Schema Analysis

Current implementation:
```json
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "Flyer Distribution Hampshire",
  "description": "...",
  "url": "https://flyerdistributionhampshire.co.uk",
  "email": "flyerdistributionhampshire@gmail.com",
  "image": "https://flyerdistributionhampshire.co.uk/Flyer Distribution Logo White Cropped.png",
  "areaServed": ["Southampton", "Bournemouth", "Poole", ...]
}
```

**Missing required/recommended properties:**
- `@id` — should be `"https://flyerdistributionhampshire.co.uk/#organization"`
- `telephone` — not available yet (add when phone number obtained)
- `address` — PostalAddress (SABs can hide from GBP but schema should have serviceArea instead)
- `openingHoursSpecification` — hours not defined
- `priceRange` — "££" estimate
- `sameAs` — array of GBP URL, Facebook, Twitter etc.
- `logo` — separate logo property vs image
- `serviceArea` — should use GeoCircle or GeoShape for SAB
- `knowsAbout` — ["Leaflet Distribution", "Flyer Delivery", ...]

**Image URL issue:** The logo URL contains a space: `"Flyer Distribution Logo White Cropped.png"` — this will fail HTTP validation. Should be URL-encoded or the filename should use hyphens.

### 4.3 Service Schema Analysis

6 Service schemas implemented. Each has: @type, name, description, provider (LocalBusiness reference), areaServed.

**Missing from Service schemas:**
- `@id` for each service
- `url` — should point to `/services#service-name`
- `serviceType` — more specific categorization
- `offers` — Offer schema (even without price, can indicate "contact for pricing")

### 4.4 Missing Schemas

- `WebSite` with `SearchAction` (enables sitelinks search box)
- `Organization` (separate from LocalBusiness)
- `WebPage` for key pages
- `ContactPage` for /quote
- `AggregateRating` (once reviews collected)
- `Review` entries

---

## 5. Images

### 5.1 Alt Text

All images have descriptive alt text. No empty `alt=""` attributes found. Quality assessment:

| Image | Alt Text | Quality |
|-------|----------|---------|
| Hero (homepage) | "Flyer distributor walking through a Hampshire street" | Excellent — local, descriptive |
| About page | "Flyer distribution team member on a Hampshire street" | Good |
| Southampton | "Southampton city centre shopping mall" | Generic — could mention brand |
| Bournemouth | "Bournemouth pier and ferris wheel" | Generic landmark |
| Winchester | "Winchester Cathedral" | Too generic, missing service context |
| Ringwood | "Green fields near Ringwood" | Very generic |
| Design service | "Designer working on creative artwork at a desk" | Generic stock photo description |
| Print service | "Printed leaflets ready for delivery" | Good, service-relevant |

### 5.2 Image Optimization

- All images use Next.js `<Image>` component ✓
- Width/height explicitly set on all images ✓ (prevents CLS)
- Priority prop on hero image ✓
- Lazy loading on below-fold images ✓
- Images served from Unsplash/Pexels CDNs (third-party latency)
- No local hero images — all stock photography
- No WebP explicitly forced (Next.js handles format optimization)

### 5.3 OG Image

All 13 pages (including blog) use the SAME OG image: `https://images.pexels.com/photos/35110918/pexels-photo-35110918.jpeg?auto=compress&cs=tinysrgb&w=1200`

This is a generic image of leaflets being delivered (appropriate for the business). However, page-specific OG images would improve social sharing CTR.

---

## 6. Performance (Core Web Vitals Estimates)

*Note: No live CrUX data available. Estimates based on source code analysis.*

### 6.1 LCP (Largest Contentful Paint) — Estimated: Good

- Hero image has `priority` prop (Next.js generates `fetchpriority="high"`) ✓
- Font preloaded via `<link rel="preload">` ✓
- Hero image preloaded ✓
- Concern: Hero image is from Unsplash CDN (third-party) — adds DNS lookup + connection time

### 6.2 CLS (Cumulative Layout Shift) — Estimated: Good

- All `<Image>` components have explicit `width` and `height` ✓
- `display: 'swap'` on Inter font ✓
- Header is sticky (no reflow) ✓

### 6.3 INP (Interaction to Next Paint) — Estimated: Unknown

- Header component is a client component (`"use client"`) due to mobile menu toggle
- QuoteForm is a client component with form state
- No heavy client-side JS detected beyond Next.js runtime
- No third-party scripts (no analytics, no chat widgets, no ad scripts) — this actually helps INP

### 6.4 Performance Concerns

- 6 scripts loaded async in `<head>` — all async, non-blocking
- Turbopack build chunks may be less optimized than webpack for production
- No image optimization for local/hosted images (only CDN images)
- No critical CSS inlining (relies on CSS chunk)

---

## 7. AI Search Readiness (GEO)

### 7.1 llms.txt

No `llms.txt` file exists. This is an emerging standard that helps AI crawlers understand site structure and permissions. Absence is not penalizing currently but is a missed optimization opportunity.

### 7.2 AI Crawler Access

- `robots.txt` has `Allow: /` with no specific AI crawler blocks ✓
- No `GPTBot`, `ClaudeBot`, `PerplexityBot` disallow rules ✓
- AI crawlers can access all pages

### 7.3 Passage-Level Citability

**FAQPage schema:** 10 Q&A pairs with structured JSON-LD — excellent for AI citation of specific facts about the service. Example citable passages:
- "We cover Southampton, Bournemouth, Poole, Winchester, Eastleigh, New Forest, Romsey, Ringwood, Christchurch, Hythe, Totton, Hedge End, and Chandler's Ford"
- "Most campaigns are completed within two weeks of us receiving your materials"
- "We generally recommend 5,000 or more [leaflets]"

**Missing citable facts:**
- No pricing data anywhere (major gap for AI comparison queries)
- No "about the team" with names/credentials
- No founding year or business history
- No statistics ("X campaigns delivered", "Y households reached")

### 7.4 Content Structure for AI

The site's content is structured but very lean. Clear statements exist but are sparse. For AI engines to cite this business confidently, they need more distinctive factual content.

---

## 8. Local SEO

### 8.1 NAP Consistency

| Element | Status |
|---------|--------|
| Name | Consistent ("Flyer Distribution Hampshire") across all pages ✓ |
| Address | MISSING — no address on site |
| Phone | MISSING — no phone number anywhere |
| Email | Present (Gmail) — consistent ✓ |

For a Service Area Business, hiding a physical address is acceptable (and common). However, having NO contact information other than an email — and a Gmail address at that — significantly damages trust signals.

### 8.2 Google Business Profile

No GBP URL is referenced anywhere on the site. It's unknown if a GBP listing exists. For local pack ranking ("leaflet distribution Southampton"), GBP is the #1 ranking factor and its absence (or non-optimized state) explains most of the potential ranking gap.

### 8.3 LocalBusiness Schema for SAB

The current LocalBusiness schema uses `areaServed: ["Southampton", "Bournemouth", ...]` (array of strings). For a SAB, Google recommends using `serviceArea` with `GeoCircle` or `GeoShape` rather than just string names. The current approach is acceptable but less specific than ideal.

### 8.4 Area Page Quality

6 area sub-pages exist. Quality assessment:
- All have unique H1, meta title, meta description ✓
- All have BreadcrumbList schema ✓
- All list specific postcodes ✓
- None have LocalBusiness or Service schema ✓ (could be added)
- All mention specific neighborhoods/areas within each location ✓
- None have testimonials from clients in that area
- None cross-link to related area pages
- Very short content (~200–300 words each)

---

## 9. Conclusions

The site has a strong technical foundation for a brand-new business: security, sitemap, robots, OG tags, schema, canonicals (in source) — these are all in place. The critical gap is content depth and local business signals.

To rank competitively for "leaflet distribution Hampshire" and area-specific variants, the site needs:
1. A working Google Business Profile with reviews
2. A phone number
3. Social proof (testimonials, case studies, review count)
4. Significantly deeper content on the homepage and area pages
5. An active blog with locally-relevant content
6. The canonical tag rendering fix (technical)
7. Pricing information (or at minimum a starting-from price)

---

## Appendix: Pages Audited

| Page | URL | Indexed | Schema | Word Count |
|------|-----|---------|--------|------------|
| Homepage | / | Yes | LocalBusiness | ~400 |
| Services | /services | Yes | 6× Service | ~500 |
| Areas | /areas | Yes | None | ~200 |
| Southampton | /areas/southampton | Yes | BreadcrumbList | ~300 |
| Bournemouth | /areas/bournemouth | Yes | BreadcrumbList | ~250 |
| Poole | /areas/poole | Yes | BreadcrumbList | ~250 |
| Winchester | /areas/winchester | Yes | BreadcrumbList | ~300 |
| New Forest | /areas/new-forest | Yes | BreadcrumbList | ~280 |
| Ringwood | /areas/ringwood | Yes | BreadcrumbList | ~230 |
| Quote | /quote | Yes | None | ~50 + form |
| About | /about | Yes | None | ~300 |
| FAQ | /faq | Yes | FAQPage | ~800 |
| Blog | /blog | **No** | None | ~30 |

*Specialist subagent findings are in: `findings/technical.md`, `findings/content.md`, `findings/schema.md`, `findings/local.md`, `findings/geo.md`, `findings/sxo.md`*
