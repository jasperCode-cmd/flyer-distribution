# Technical SEO Findings
**Score: 74 / 100**
**Auditor:** seo-technical — 2026-06-24

## Category Breakdown

| Category | Score | Status |
|---|---|---|
| Crawlability | 80/100 | Pass with gaps |
| Indexability | 88/100 | Pass |
| Security Headers | 82/100 | Pass with gaps |
| URL Structure | 90/100 | Pass |
| Mobile Optimization | 85/100 | Pass |
| Core Web Vitals (source signals) | 70/100 | Needs attention |
| Structured Data | 82/100 | Pass with gaps |
| JavaScript Rendering | 95/100 | Pass |
| AI Crawler Management | 0/100 | FAIL |
| IndexNow Protocol | 0/100 | FAIL |

## Critical

**C1. No AI crawler rules in robots.txt**
All AI training crawlers are freely allowed via wildcard. Recommend adding explicit named rules: block CCBot, GPTBot, Bytespider, Google-Extended; allow PerplexityBot and ChatGPT-User for search referral traffic.

**C2. IndexNow not implemented**
No key file at domain root. Add to recover near-instant indexing on Bing and Yandex for content updates.

## High

**H1. Duplicate canonical tags on every page (confirmed in built HTML)**
The built index.html shows two identical `<link rel="canonical">` tags — `metadata.alternates.canonical` AND the JSX `<link rel="canonical">` are both rendering in Next.js 16.2.6. Since Next.js now renders `alternates.canonical` correctly, the JSX canonical link elements in each page component can be removed. Affects all 13 pages.

**H2. `lastModified: new Date()` in sitemap**
Every URL gets the build timestamp as lastmod. Google ignores inaccurate lastmod. Replace with static per-route ISO date strings.

**H3. CSP uses `script-src 'unsafe-inline'`**
Negates inline XSS protection. Required short-term for Next.js hydration, but nonce-based CSP via Next.js middleware is the correct fix (3–4 hours).

**H4. `picsum.photos` in remotePatterns — unused**
Stale config. Remove from `next.config.ts` remotePatterns.

## Medium

**M1. Hero image from Unsplash CDN**
`priority` prop is correctly set (preload link confirmed in HTML). Cross-origin cold-fetch adds latency risk. Also: `transform: scale(1.2)` inline style on the `<Image>` element adds compositing overhead — move to a wrapper div.

**M2. Services-page image dimension mismatch → CLS risk**
Package cards: `width={700} height={420}` but CSS h-56 (224px). Supporting service cards: `width={600} height={300}` but CSS h-44 (176px). Mismatch causes layout shift on /services. Fix: use `fill` prop with a fixed-height wrapper `<div className="relative w-full h-56">`.

**M3. BreadcrumbList missing on /services, /faq, /about, /quote**
Already on /areas and all 6 area pages. Add two-item lists (Home → Page) to the four remaining content pages.

**M4. Same OG image on all pages**
Every page uses the same Pexels letterbox photo. Area pages especially benefit from location-relevant OG images.

**M5. `lang="en"` should be `lang="en-GB"`**
In `app/layout.tsx`, change the html element lang attribute to `en-GB` for correct language disambiguation by search engines and assistive technologies.

## Low

**L1. No favicon.ico fallback**
favicon.png exists in /public/ but older clients request /favicon.ico. Generate a .ico and place in /public/.

**L2. FAQ page title 62 chars (may truncate)**
"FAQ: Frequently Asked Questions | Flyer Distribution Hampshire" = 62 chars. Shorten to "Leaflet Distribution FAQ | Flyer Distribution Hampshire" (56 chars).

**L3. fonts.gstatic.com in CSP font-src is unnecessary**
`next/font` self-hosts Inter — no external Google Fonts runtime request. Remove allowance to tighten policy.

**L4. changeFrequency and priority in sitemap can be removed**
Google ignores both. Removing reduces payload and eliminates noise.

## Confirmed Passes

- HTTPS + HSTS `max-age=63072000; includeSubDomains; preload` ✓
- X-Frame-Options: DENY ✓
- X-Content-Type-Options: nosniff ✓
- Referrer-Policy: strict-origin-when-cross-origin ✓
- Permissions-Policy: camera, microphone, geolocation blocked ✓
- Viewport meta tag in all built HTML ✓
- All SEO-critical content (title, description, h1, canonical, OG, JSON-LD, body text) in initial HTML — no JS rendering dependency ✓
- robots.txt: valid, disallows /admin/, references sitemap ✓
- Sitemap: 12 URLs, all indexable pages, /blog correctly excluded ✓
- noindex on /blog confirmed in built HTML ✓
- OG/Twitter cards: summary_large_image, 1200×630, en_GB locale — all pages ✓
- URL structure: clean, lowercase, hyphen-separated, no query strings ✓
- Trailing slash consistency: no trailing slashes throughout ✓
- Inter font self-hosted via next/font (no external runtime request) ✓
- Web3Forms accessed only via fetch() — not a render-blocking script ✓
