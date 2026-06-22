# Technical SEO Audit — flyerdistributionhampshire.co.uk
**Date:** 2026-06-22
**Stack:** Next.js 16 / App Router / SSR static export
**Audited from:** Source at `/home/user/flyer-distribution` + built HTML at `.next/server/app/`
**Pages audited:** / | /services | /about | /faq | /quote | /areas | /areas/southampton | /areas/bournemouth | /areas/poole | /areas/winchester | /areas/new-forest | /areas/ringwood | /blog

---

## Overall Technical Score: 54 / 100

Score breakdown: Security (20/20) + Crawlability (14/15) + URL Structure (10/10) + Mobile (8/10) + JS Rendering (5/10) + Indexability (4/15) + Structured Data (7/10) + Core Web Vitals risk (-5) + Missing capabilities (-9)

---

## 1. Crawlability — PASS (14/15)

**robots.txt** — PASS
- File confirmed present and served at the correct path.
- Directive: `User-Agent: *` / `Allow: /` / `Disallow: /admin/`
- Sitemap pointer is correct: `https://flyerdistributionhampshire.co.uk/sitemap.xml`

**XML Sitemap** — PASS
- 12 URLs present, all on the correct domain (`flyerdistributionhampshire.co.uk`).
- All indexable pages are included. /blog is correctly excluded (it carries `noindex`).
- `<lastmod>` values are set (dynamically generated at build time — 2026-06-22). Note: `<changefreq>` and `<priority>` are not used as ranking signals by Google; they are cosmetic here.
- Sitemap does not include the `<image:image>` extension. Not a critical omission for this site type.

**Blog page noindex** — PASS
- `/blog` correctly carries `<meta name="robots" content="noindex, follow">` in static HTML and is excluded from sitemap. The blog is currently a placeholder ("Check back soon") so this is appropriate.

**Minor issue — /blog linked from footer navigation** — LOW
- The footer links to `/blog` on every page despite it being noindexed. This wastes a small amount of crawl budget and may confuse users who follow the link to a near-empty placeholder page. Remove the footer link or replace it with a "Coming Soon" note until blog content is published.

---

## 2. Indexability — FAIL (4/15)

### CRITICAL — Canonical Tags Not Present in Static HTML (Affects All 12 Indexed Pages)

This is the highest-priority issue on the site.

**What is happening:**
Every `page.tsx` defines `alternates.canonical` via Next.js's metadata API (e.g., `canonical: "https://flyerdistributionhampshire.co.uk"`). However, inspection of every built `.html` file in `.next/server/app/` confirms that **zero `<link rel="canonical">` tags appear in the static `<head>` section** of any page.

The canonical URL exists only in the React Server Component (RSC) JSON payload embedded in `<script>` tags at the bottom of the document — specifically inside the `MetadataBoundary` / `Next.Metadata` suspense tree. Googlebot and other crawlers that evaluate the initial HTML stream will not see a canonical tag. Even for crawlers that do execute JavaScript, the canonical is injected client-side after hydration, which is unreliable as a canonicalisation signal.

**Confirmed on pages:**
- `/` (index.html) — no `<link rel="canonical">` in `<head>`
- `/about` — no `<link rel="canonical">` in `<head>`
- `/services` — no `<link rel="canonical">` in `<head>`
- `/areas/southampton` — no `<link rel="canonical">` in `<head>`
- All remaining pages — same behaviour confirmed

**Root cause:** This is a known regression in Next.js 16's App Router where `alternates.canonical` is handled by the `MetadataBoundary` component, which renders inside a React Suspense boundary and is hydrated client-side rather than being injected into the SSR `<head>` stream.

**Impact:** Without a canonical signal in the initial HTML:
- Google may create duplicate URL variants (e.g., with/without trailing slash, HTTP vs HTTPS, www vs non-www) and split PageRank.
- The site has no mechanism to consolidate authority if any URL is shared in multiple forms.
- Area pages (6 pages with near-identical structure) are particularly at risk of duplicate content treatment.

**Fix:** Replace `alternates.canonical` in the metadata object with a direct `<link>` tag rendered in the page's JSX or in the root layout's `<head>`. In Next.js App Router this is done by exporting a custom `generateMetadata` that returns a response that Next.js can inject into the head at the server-render phase, OR by switching to a `<Head>` component approach, OR by adding canonical tags via `next/head` in a compatible wrapper. The most reliable fix is to add a canonical `<link>` via a server component rendered directly in the `<head>`:

```tsx
// In app/layout.tsx or per page.tsx, add inside <head>:
// Use next/navigation's headers() or pass canonicalUrl as a prop
<link rel="canonical" href="https://flyerdistributionhampshire.co.uk" />
```

For App Router the correct pattern (as of Next.js 13+) is to use `export const metadata` with `alternates.canonical` — however the built output confirms this is not writing to the static HTML in Next.js 16. The alternative is to render it directly in the layout component's `<html>` return:

```tsx
// app/layout.tsx — inject a per-page canonical via a server component
// Pass canonical as a slot or use generateMetadata per page with
// a workaround that forces SSR head injection
```

Until this is fixed, Google is operating on all 12 indexable pages with no canonical signal.

### HIGH — Description Mismatch Between layout.tsx and Homepage

The global `metadata.description` in `layout.tsx` reads:
> "Professional flyer and leaflet distribution across Hampshire and Dorset. Covering Southampton, Bournemouth, Poole and Winchester."

The homepage's built HTML `<meta name="description">` reads:
> "Reliable flyer and leaflet distribution across Hampshire and Dorset. Reach real households in Southampton, Bournemouth, Poole and Winchester."

The homepage `page.tsx` is overriding the layout-level description correctly, but the two versions are inconsistent. The layout-level description will be used as a fallback on any page that does not define its own `description`. Confirm all pages have page-level descriptions (they appear to — no pages were found relying on the layout fallback) and update the layout.tsx description to match site-wide messaging.

### MEDIUM — No Favicon in /public/ (Case Sensitivity Bug)

`layout.tsx` references `icon: "/favicon.png"`. The `/public/` directory contains:
- `Favicon.png` (capital F)
- No `favicon.png` (lowercase f)

On a Linux server the filesystem is case-sensitive. The browser/crawler will receive a 404 for `/favicon.png`. The built HTML confirms `<link rel="icon" href="/favicon.png">` on every page.

**Fix:** Rename `/public/Favicon.png` to `/public/favicon.png` and rebuild. This is a one-file change.

---

## 3. Security Headers — PASS (20/20)

All headers are applied via `next.config.ts` on the `/(.*)`  route pattern — meaning they apply to every page response.

| Header | Value | Status |
|---|---|---|
| X-Frame-Options | DENY | PASS |
| X-Content-Type-Options | nosniff | PASS |
| Referrer-Policy | strict-origin-when-cross-origin | PASS |
| Permissions-Policy | camera=(), microphone=(), geolocation=() | PASS |
| Strict-Transport-Security | max-age=63072000; includeSubDomains; preload | PASS |
| Content-Security-Policy | default-src 'self'; img-src 'self' images.unsplash.com images.pexels.com data:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self' fonts.gstatic.com; connect-src 'self' api.web3forms.com | PASS with note |

**CSP note:** `script-src 'unsafe-inline'` and `style-src 'unsafe-inline'` are present, which weakens XSS protection. This is commonly required by Next.js's inline scripts. The CSP also whitelists `picsum.photos` in `images.remotePatterns` (next.config.ts) but NOT in the `img-src` directive of the CSP. If any page uses a picsum.photos image it will be blocked. This is low risk if picsum is only used in development, but worth aligning.

**HSTS:** max-age of 63072000 (2 years) with `preload` flag is correct for submission to the HSTS preload list. Verify the site is listed at https://hstspreload.org/ after deployment.

---

## 4. URL Structure — PASS (10/10)

- All URLs use clean, lowercase, hyphenated slugs: `/areas/new-forest`, `/areas/southampton`, etc.
- No URL parameters, session IDs, or pagination observed.
- No redirect chains detectable from source (static site).
- Internal links use root-relative paths (`href="/services"`) consistently throughout.
- The sitemap uses bare domain without trailing slash (`https://flyerdistributionhampshire.co.uk`) which is consistent with the og:url values on each page.
- No `www.` variant handling visible in source — the hosting layer must enforce the canonical domain redirect (non-www to non-www or vice versa). This cannot be verified without live access, but there is no server-side redirect logic in the Next.js config.

---

## 5. Mobile Readiness — PASS with notes (8/10)

**Viewport meta** — PASS
Every page includes `<meta name="viewport" content="width=device-width, initial-scale=1">` in the static `<head>`. Confirmed across all audited pages.

**Responsive design** — PASS
Tailwind CSS breakpoints are used throughout: `sm:`, `md:`, `lg:` responsive prefixes on grid layouts, typography, and navigation. The hamburger menu toggle (`md:hidden`) is present for mobile. The desktop nav is hidden on mobile (`hidden md:flex`).

**Touch targets** — MEDIUM risk
Navigation buttons use `px-5 py-2.5` (approximately 40px height). The hamburger button uses `p-2` (approximately 36px including icon) which is at the lower threshold of the 44x44px recommended touch target size. The CTA buttons (`px-8 py-4`, `px-10 py-4`) are well-sized.

**Font size** — PASS
Body text uses `text-sm` (14px) in some card contexts. This is acceptable but borderline for mobile readability. Primary paragraph text uses base size.

**Sticky header** — Note
The header is `sticky top-0 z-50`. On very small viewports this reduces available content space. Not a disqualifying issue.

---

## 6. Core Web Vitals — Risk Assessment

Actual scores cannot be measured from source alone. The following are risk signals identified from the HTML:

**LCP (Largest Contentful Paint) — MEDIUM risk**

The homepage LCP candidate is the full-width hero image sourced from Unsplash:
`https://images.unsplash.com/photo-1464082354059-27db6ce50048?w=1920&q=80`

Positive signals:
- The image has a `<link rel="preload" as="image">` in the `<head>` — this is correctly implemented.
- The Next.js `Image` component is used with `priority={true}` on the hero (confirmed in RSC payload).
- The font file is preloaded: `<link rel="preload" href="...woff2" as="font" crossorigin="" type="font/woff2">`.

Risk signals:
- The LCP image is hosted on a third-party CDN (images.unsplash.com). DNS lookup + connection + TLS handshake for the third-party origin adds latency, even with the preload hint. A self-hosted or CDN-served (e.g., Cloudflare Images) hero image would be faster.
- The hero image on the homepage has a CSS `transform: scale(1.2)` applied. This forces a composite layer but does not directly impact LCP timing.
- Six `<script src="..." async>` tags load before the main stylesheet in the `<head>`. Although they are `async`, the volume of chunk scripts may compete for bandwidth on initial load.

Area pages have no hero image with `priority`; their above-fold image (city photo) uses `loading="lazy"` — this is correct since it is below the hero text on those pages.

**INP (Interaction to Next Paint) — LOW risk**

The site is largely static content with minimal interactive components. The quote form page and the mobile menu toggle are the primary interaction points. No heavy client-side JS framework patterns (no Redux, no large component trees requiring re-render) are visible. INP risk is low.

**CLS (Cumulative Layout Shift) — LOW-MEDIUM risk**

All Next.js `Image` components specify explicit `width` and `height` attributes, which allows the browser to reserve space and prevent layout shift. However:
- The logo image in the header (`width={220} height={60}`) does not have `priority` set and uses default loading. On slow connections the header could shift when the logo loads. Since the logo is above the fold and in the sticky header, this may cause minor CLS.
- The font (`Inter`) uses `display: swap` which causes a brief layout shift when the web font replaces the fallback. This is standard and acceptable.
- The `<div hidden=""><!--$--><!--/$--></div>` at the start of `<body>` is Next.js's hydration boundary placeholder. It is hidden and should not contribute to CLS.

---

## 7. JavaScript Rendering — PARTIAL PASS (5/10)

**Rendering model:** The site uses Next.js App Router with Server-Side Rendering (SSR). The built `.html` files contain fully rendered HTML content — body text, headings, navigation, schema markup, and Open Graph tags are all present in the initial HTML payload. This is not a Client-Side Rendering (CSR) or SPA shell pattern.

**What renders server-side (good):**
- All page body content
- H1, H2, H3 headings
- Navigation links
- All schema.org JSON-LD blocks
- Open Graph and Twitter Card meta tags
- Title and description meta tags
- Robots meta tag (where applicable)

**What does NOT render server-side (the canonical issue):**
- `<link rel="canonical">` — rendered client-side via React MetadataBoundary
- The RSC payload in `<script>` tags at page bottom also contains the canonical URL as a React component instruction, not as raw HTML

**Script loading:** Six `async` script chunks load in the `<head>`. This is normal for Next.js hydration but represents a non-trivial JavaScript payload. The `noModule` polyfill script (`03~yq9q893hmn.js`) targets legacy browsers.

**Hydration marker:** The `<div hidden=""><!--$--><!--/$--></div>` pattern is Next.js's standard RSC streaming boundary marker and is not a concern.

**Googlebot compatibility:** Because all meaningful content is in the static HTML, the site is fully crawlable without JavaScript execution. The canonical issue is the sole rendering-related SEO problem.

---

## 8. Structured Data — PASS (7/10)

All schema.org JSON-LD blocks are present in the static HTML (not JS-only). Confirmed by direct inspection.

| Page | Schema Type | Status |
|---|---|---|
| / (homepage) | LocalBusiness | PASS |
| /services | @graph with 6x Service nodes (each with provider LocalBusiness) | PASS |
| /faq | FAQPage with 10 Question/Answer pairs | PASS |
| /areas/southampton | BreadcrumbList (3 levels) | PASS |
| /areas/bournemouth | BreadcrumbList | PASS |
| /areas/poole | BreadcrumbList | PASS |
| /areas/new-forest | BreadcrumbList | PASS |
| /areas/ringwood | BreadcrumbList | PASS |
| /areas/winchester | BreadcrumbList | PASS |
| /about | None | MEDIUM — missing |
| /quote | None | LOW — acceptable |
| /areas (hub) | None | LOW — could add BreadcrumbList |

**Issues identified:**

1. **MEDIUM — LocalBusiness schema is incomplete.** The homepage `LocalBusiness` schema includes `name`, `description`, `url`, `email`, `image`, and `areaServed`. It is missing:
   - `telephone` — no phone number exists anywhere in the site (email-only contact). If a phone number is ever added, it must be in the schema.
   - `address` (PostalAddress type) — no physical address is listed. This weakens the local SEO value of the LocalBusiness schema and reduces eligibility for Google Business Profile rich result features.
   - `priceRange` — optional but useful for local pack signals.
   - `openingHoursSpecification` — not required but strengthens local signals.

2. **MEDIUM — Schema `image` URL contains unencoded spaces.** The `LocalBusiness.image` value is:
   `"https://flyerdistributionhampshire.co.uk/Flyer Distribution Logo White Cropped.png"`
   Spaces in URLs must be percent-encoded as `%20`. The unencoded URL may cause validation warnings in Google's Rich Results Test. The file is named with spaces in `/public/`. Fix by URL-encoding the value in the schema: `Flyer%20Distribution%20Logo%20White%20Cropped.png`, or rename the file to remove spaces.

3. **LOW — /about page has no schema.** A `Person` or `Organization` schema could be added to the about page to reinforce entity signals.

4. **PASS — FAQPage schema** is well-formed with 10 Q&A pairs. This is eligible for FAQ rich results in Google Search.

5. **PASS — BreadcrumbList** is correctly implemented on all 6 area sub-pages with 3-level hierarchy (Home > Areas > [City]). The homepage and /areas hub page are not breadcrumbed (appropriate).

---

## 9. IndexNow Protocol — NOT IMPLEMENTED

IndexNow is not implemented. No key file exists in `/public/` and no IndexNow submission logic exists in the codebase.

IndexNow allows instant URL submission to Bing, Yandex, and Naver on content change. For a relatively static site with infrequent updates this is a low-priority gap, but implementation is simple (a single text file and one API call on deploy).

**To implement:** Generate an IndexNow key (UUID), place it at `/public/[key].txt`, and add a post-deploy script that POSTs changed URLs to `https://api.indexnow.org/indexnow`.

---

## 10. Analytics & Observability — ABSENT

No analytics implementation is present in the built HTML. Specifically:
- No Google Analytics 4 (GA4) / gtag.js
- No Google Tag Manager (GTM)
- No Microsoft Clarity
- No Hotjar or equivalent

This means there is no data on user behaviour, bounce rate, conversion events (quote form submissions), or traffic sources. This is a significant operational gap — not a crawlability issue, but it prevents any measurement of SEO improvements made during this audit.

**Minimum recommendation:** Add GA4 with a conversion event for quote form submission. This can be done via a `<Script>` component in `app/layout.tsx` without impacting SSR.

---

## 11. AI Crawler Readiness — NOT IMPLEMENTED

No `llms.txt` file exists at `/public/llms.txt` or accessible at `https://flyerdistributionhampshire.co.uk/llms.txt`.

The `robots.txt` does not contain any directives for AI crawlers (GPTBot, ClaudeBot, anthropic-ai, Bytespider, etc.). All AI crawlers currently have unrestricted access under the `Allow: /` wildcard.

For a small local business this is low priority, but as AI-generated answers become a more significant source of referral traffic, an `llms.txt` providing structured business context (services, service areas, contact details) could improve visibility in AI assistant results.

---

## 12. Open Graph & Social Tags — PASS with note

All pages carry complete Open Graph and Twitter Card tags in the static HTML. Confirmed on: /, /about, /services, /areas/southampton.

**Consistent across all pages:**
- `og:title`, `og:description`, `og:url`, `og:site_name`, `og:locale` (en_GB), `og:type` (website), `og:image`, `og:image:width` (1200), `og:image:height` (630), `og:image:alt`
- `twitter:card` (summary_large_image), `twitter:title`, `twitter:description`, `twitter:image`

**Note:** The `og:image` is a Pexels CDN URL on every page — the same stock photo is used as the social share image for all pages. Page-specific OG images would improve click-through from social shares (lower priority).

The `og:url` values on each page match the intended canonical URLs, which is correct and consistent even though the `<link rel="canonical">` is missing from the HTML `<head>`.

---

## Prioritised Issue List

### Critical
1. **Canonical tags absent from all 12 indexed pages in static HTML.** Every page defines canonical in source but none appear in the rendered `<head>`. Fix requires changing how Next.js 16 injects canonical — use a server-rendered `<link>` element directly in the layout JSX rather than relying on `alternates.canonical` in the metadata object.

### High
2. **favicon.png 404 on Linux servers.** `/public/Favicon.png` must be renamed to `/public/favicon.png` (lowercase). One-file fix, rebuild required.
3. **No analytics installed.** No measurement of any user behaviour or conversion events.

### Medium
4. **LocalBusiness schema lacks address and telephone fields.** Add `address` (PostalAddress) and `telephone` to the homepage schema, or accept reduced local rich result eligibility.
5. **LocalBusiness schema image URL contains unencoded spaces.** URL-encode `Flyer%20Distribution%20Logo%20White%20Cropped.png` in the schema value, or rename the file.
6. **LCP image served from third-party origin (images.unsplash.com).** Hero image origin-connection latency adds to LCP. Consider self-hosting the hero image or using a first-party CDN.
7. **CSP `img-src` does not include `picsum.photos`** despite it being listed in `next.config.ts` `remotePatterns`. Align the two lists.

### Low
8. **Footer links to /blog on every page despite blog being noindex/placeholder.** Remove or replace with a "Coming Soon" message.
9. **No IndexNow implementation.** Add post-deploy IndexNow submission for faster Bing/Yandex indexing.
10. **No llms.txt.** Low priority for now; add when content strategy is clearer.
11. **No page-specific OG images.** All pages share one stock photo as social image. Consider adding at least a branded OG image.
12. **Hamburger button touch target (36px) is marginally below recommended 44px.** Increase padding slightly: `p-2.5` or `p-3`.
13. **/about page has no structured data.** Consider adding Organization or LocalBusiness schema.

---

## Page-by-Page Summary

| Page | Title in HTML | Canonical in HTML | Schema | Noindex |
|---|---|---|---|---|
| / | "Flyer Distribution Hampshire | Local Leaflet & Flyer Delivery" | ABSENT | No |
| /services | "Flyer & Leaflet Distribution Services | Flyer Distribution Hampshire" | ABSENT | No |
| /about | "About Us | Flyer Distribution Hampshire" | ABSENT | No |
| /faq | "FAQ..." (from built HTML) | ABSENT | FAQPage | No |
| /quote | present | ABSENT | None | No |
| /areas | present | ABSENT | None | No |
| /areas/southampton | "Flyer Distribution Southampton | Flyer Distribution Hampshire" | ABSENT | No |
| /areas/bournemouth | present | ABSENT | BreadcrumbList | No |
| /areas/poole | present | ABSENT | BreadcrumbList | No |
| /areas/winchester | present | ABSENT | BreadcrumbList | No |
| /areas/new-forest | present | ABSENT | BreadcrumbList | No |
| /areas/ringwood | present | ABSENT | BreadcrumbList | No |
| /blog | "Blog..." | ABSENT | None | YES (noindex,follow) |
