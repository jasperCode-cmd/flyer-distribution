# SEO Action Plan — flyerdistributionhampshire.co.uk

**Audit date:** 2026-06-22  
**Overall Health Score:** 57 / 100  
**Business type:** Service Area Business — Leaflet Distribution, Hampshire & Dorset UK

---

## Priority Legend

| Priority | Definition | Timeframe |
|----------|-----------|-----------|
| CRITICAL | Blocks indexing, breaks core functionality, or causes crawl errors | Fix within 24 hours |
| HIGH | Directly limits ranking potential or conversion | Fix within 1 week |
| MEDIUM | Optimization opportunity with meaningful SEO impact | Fix within 1 month |
| LOW | Nice to have, marginal gains | Backlog |

---

## Phase 1: Critical Fixes (Do Today)

### C1 — Fix favicon case sensitivity
**Priority:** CRITICAL  
**Effort:** 2 minutes  
**Category:** Technical  

`layout.tsx` references `/favicon.png` but the public directory contains `Favicon.png` (capital F). On Linux servers this returns a 404. Every page tab will show no icon — a brand trust issue.

**Fix:**
```bash
mv /home/user/flyer-distribution/public/Favicon.png /home/user/flyer-distribution/public/favicon.png
```
Then rebuild.

---

### C2 — Fix canonical tag rendering (HIGHEST PRIORITY)
**Priority:** CRITICAL  
**Effort:** 1–2 hours  
**Category:** Technical  

Next.js 16 renders `alternates.canonical` client-side. The canonical `<link>` tag is NOT present in the static HTML output served to crawlers. All 12 indexed pages are affected. Without canonical tags in the HTML shell, Googlebot and all other crawlers cannot determine the authoritative URL for each page.

**Fix options:**

**Option A (recommended) — Add explicit `<link>` in page head via a utility component:**

Create `/home/user/flyer-distribution/components/CanonicalTag.tsx`:
```tsx
export default function CanonicalTag({ href }: { href: string }) {
  return (
    <head>
      <link rel="canonical" href={href} />
    </head>
  );
}
```

Add to each page's JSX:
```tsx
import CanonicalTag from "@/components/CanonicalTag";
// In the component return:
<>
  <CanonicalTag href="https://flyerdistributionhampshire.co.uk/about" />
  {/* rest of page */}
</>
```

**Option B — Wait for Next.js to fix this behavior** (not recommended — timeline unknown)

**Option C — Use next/head (Pages Router workaround)** (not compatible with App Router)

**Option A is the correct fix.** Apply to all 12 indexed pages.

---

### C3 — Rename logo file (remove spaces from filename)
**Priority:** CRITICAL  
**Effort:** 15 minutes  
**Category:** Technical / Schema  

The LocalBusiness schema references: `"https://flyerdistributionhampshire.co.uk/Flyer Distribution Logo White Cropped.png"`

Spaces in URLs are invalid per RFC 3986 and will cause Googlebot to fail fetching the schema image.

**Fix:**
```bash
mv "public/Flyer Distribution Logo White Cropped.png" "public/flyer-distribution-logo-white-cropped.png"
mv "public/Flyer Distribution Logo White.png" "public/flyer-distribution-logo-white.png"
```

Update all references:
- `components/Footer.tsx` — Footer logo image
- `app/page.tsx` — LocalBusiness schema image property
- Any other TSX files referencing the old filename

---

## Phase 2: High-Impact Improvements (Week 1)

### H1 — Set up Google Business Profile
**Priority:** HIGH  
**Effort:** 2–4 hours + ongoing  
**Category:** Local SEO  

This is the single most impactful action for local search ranking. Without a GBP listing, the business cannot appear in the local pack ("Map Pack") for queries like "leaflet distribution Southampton" or "flyer distribution Hampshire".

**Actions:**
1. Go to https://business.google.com and create/claim the listing
2. Set business type to "Service Area Business" (hide physical address)
3. Add all service areas: Southampton, Bournemouth, Poole, Winchester, New Forest, Ringwood, Eastleigh, Romsey, Christchurch, Hythe, Totton, Hedge End, Chandler's Ford
4. Add services matching the site: Design, Print & Deliver; Leaflet Distribution; Vehicle Leaflet Distribution; Campaign Planning; Targeted Postcode Campaigns
5. Add business description (use the one from the site)
6. Add the email address
7. Upload photos of: the team (real photos), leaflets being delivered, printed materials
8. Once GBP is live, add the GBP URL to the `sameAs` array in LocalBusiness schema

**Start requesting reviews from past clients immediately after setup.**

---

### H2 — Add phone number
**Priority:** HIGH  
**Effort:** 30 minutes  
**Category:** Local SEO / Conversion  

A phone number is the most basic trust signal for a local service business. Its absence:
- Reduces conversion rate (many B2B clients prefer to call)
- Weakens NAP completeness for local citations
- Limits LocalBusiness schema completeness
- Reduces E-E-A-T score

**Actions:**
1. Set up a phone number (consider a Google Voice or similar virtual number to keep personal number private)
2. Add to `components/Footer.tsx` Contact section
3. Add to LocalBusiness schema: `"telephone": "+44XXXXXXXXXX"`
4. Add to quote form header as alternative contact: "Or call us on 0XXXX XXXXXX"
5. Add to `/about` page

---

### H3 — Fix services page heading hierarchy
**Priority:** HIGH  
**Effort:** 15 minutes  
**Category:** On-Page SEO  

In `/app/services/page.tsx` at lines 210, the two package card titles ("Design, Print and Deliver" and "Print and Deliver") use `<h2>` when they should use `<h3>`.

**Fix** in `app/services/page.tsx`:
```tsx
// Change line 210:
<h2 className="text-lg font-bold text-blue-900 mb-3">
// To:
<h3 className="text-lg font-bold text-blue-900 mb-3">
```
Apply to both package cards.

---

### H4 — Add social proof to homepage and area pages
**Priority:** HIGH  
**Effort:** 2–4 hours  
**Category:** Content / E-E-A-T  

The site has zero testimonials, reviews, or case studies. This is the biggest content gap impacting both conversion and E-E-A-T signals.

**Actions:**
1. Collect 3–5 genuine client testimonials (email past clients)
2. Add a "What Our Clients Say" section to the homepage between the services overview and the areas section
3. Add at least 1 testimonial to each area page (if client is from that area, even better)
4. Structure testimonials with: client name (or "Restaurant owner, Southampton"), their business type, and a specific quote about delivery reliability
5. Once GBP reviews are live, add an AggregateRating to the LocalBusiness schema

**Testimonial component template:**
```tsx
<blockquote className="bg-blue-50 border-l-4 border-blue-700 p-6 rounded-r-lg">
  <p className="text-gray-700 italic mb-3">"We've used Flyer Distribution Hampshire twice now for our restaurant campaigns in Southampton. Every leaflet was delivered on time and we saw a measurable uptick in bookings. Would definitely recommend."</p>
  <footer className="text-sm font-semibold text-blue-900">— Restaurant owner, Shirley, Southampton</footer>
</blockquote>
```

---

### H5 — Upgrade LocalBusiness schema
**Priority:** HIGH  
**Effort:** 1 hour  
**Category:** Schema / Local SEO  

Replace the current LocalBusiness schema with a proper `@graph` including `WebSite` entity and all required SAB properties.

**Replace content of `localBusinessSchema` in `app/page.tsx`:**
```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": "https://flyerdistributionhampshire.co.uk/#website",
      "url": "https://flyerdistributionhampshire.co.uk",
      "name": "Flyer Distribution Hampshire",
      "publisher": { "@id": "https://flyerdistributionhampshire.co.uk/#business" }
    },
    {
      "@type": "LocalBusiness",
      "@id": "https://flyerdistributionhampshire.co.uk/#business",
      "name": "Flyer Distribution Hampshire",
      "description": "Professional flyer and leaflet distribution across Hampshire and Dorset. Reliable, targeted, and affordable.",
      "url": "https://flyerdistributionhampshire.co.uk",
      "email": "flyerdistributionhampshire@gmail.com",
      "telephone": "+44XXXXXXXXXX",
      "image": "https://flyerdistributionhampshire.co.uk/flyer-distribution-logo-white-cropped.png",
      "logo": {
        "@type": "ImageObject",
        "url": "https://flyerdistributionhampshire.co.uk/flyer-distribution-logo-white-cropped.png",
        "width": 280,
        "height": 90
      },
      "sameAs": [
        "https://www.google.com/maps?cid=YOUR_GBP_CID",
        "https://www.facebook.com/YOUR_PAGE"
      ],
      "address": {
        "@type": "PostalAddress",
        "addressRegion": "Hampshire",
        "addressCountry": "GB"
      },
      "serviceArea": {
        "@type": "GeoCircle",
        "geoMidpoint": {
          "@type": "GeoCoordinates",
          "latitude": 50.9097,
          "longitude": -1.4044
        },
        "geoRadius": "50000"
      },
      "areaServed": [
        { "@type": "City", "name": "Southampton" },
        { "@type": "City", "name": "Bournemouth" },
        { "@type": "City", "name": "Poole" },
        { "@type": "City", "name": "Winchester" },
        { "@type": "City", "name": "Ringwood" },
        { "@type": "AdministrativeArea", "name": "New Forest" },
        { "@type": "City", "name": "Eastleigh" },
        { "@type": "City", "name": "Romsey" }
      ],
      "priceRange": "££",
      "knowsAbout": ["Leaflet Distribution", "Flyer Delivery", "Direct Mail Marketing", "Campaign Planning"]
    }
  ]
}
```

---

### H6 — Fix Service schema @id and provider references
**Priority:** HIGH  
**Effort:** 30 minutes  
**Category:** Schema  

In `app/services/page.tsx`, update each Service node to include `@id`, `url`, `serviceType`, and reference the business by `@id`:

```json
{
  "@type": "Service",
  "@id": "https://flyerdistributionhampshire.co.uk/services#leaflet-distribution",
  "name": "Leaflet Distribution",
  "serviceType": "Leaflet Distribution",
  "url": "https://flyerdistributionhampshire.co.uk/services",
  "description": "...",
  "provider": { "@id": "https://flyerdistributionhampshire.co.uk/#business" },
  "areaServed": { "@type": "AdministrativeArea", "name": "Hampshire and Dorset" },
  "offers": {
    "@type": "Offer",
    "priceCurrency": "GBP",
    "description": "Price on request — contact us for a tailored quote"
  }
}
```

---

### H7 — Install Google Analytics 4 + Search Console
**Priority:** HIGH  
**Effort:** 2 hours  
**Category:** Technical  

No analytics exists. Without it, SEO performance cannot be measured or improved.

**Actions:**
1. Create GA4 property at analytics.google.com
2. Install GA4 via Next.js — add script to `app/layout.tsx`:
```tsx
import Script from "next/script"
// In RootLayout:
<Script
  src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"
  strategy="afterInteractive"
/>
<Script id="gtag-init" strategy="afterInteractive">
  {`window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');`}
</Script>
```
3. Also update CSP in `next.config.ts` to add `https://www.googletagmanager.com` to `script-src` and `connect-src`
4. Verify Search Console domain property
5. Set up conversion tracking for quote form submissions (Web3Forms success callback)

---

### H8 — Create llms.txt
**Priority:** HIGH  
**Effort:** 30 minutes  
**Category:** AI Search  

Create `/public/llms.txt` to enable AI crawlers (ChatGPT, Perplexity, Claude) to understand the business without parsing the full site:

```
# Flyer Distribution Hampshire
> A local flyer and leaflet distribution service covering Hampshire and Dorset, UK.

## Business
Flyer Distribution Hampshire is an independent Service Area Business providing door-to-door leaflet and flyer distribution to households across Hampshire and Dorset.

## Services
- Leaflet Distribution (door-to-door, through letterboxes)
- Design, Print and Deliver (full end-to-end campaign)
- Print and Deliver (client provides design)
- Targeted Postcode Campaigns (data-driven area selection)
- Vehicle Leaflet Distribution (leaflets on parked cars)
- Campaign Planning (strategy and advice)

## Coverage
Hampshire and Dorset, UK. Key areas: Southampton (SO14–SO19, SO30–SO45), Bournemouth (BH1–BH12), Poole (BH12–BH18), Winchester (SO21–SO24), New Forest (SO40–SO45, BH24–BH25), Ringwood (BH24, BH21, BH31). Also: Eastleigh, Romsey, Christchurch, Hythe, Totton, Hedge End, Chandler's Ford.

## Contact
Email: flyerdistributionhampshire@gmail.com
Website: https://flyerdistributionhampshire.co.uk

## Formats Handled
A6, A5, A4, DL leaflets and flyers.

## Turnaround
Most campaigns completed within 2 weeks of receiving materials.

## Quote
Free, no-obligation quotes via: https://flyerdistributionhampshire.co.uk/quote
Response within 24 hours.
```

---

### H9 — Add internal links from area and service pages
**Priority:** HIGH  
**Effort:** 2 hours  
**Category:** On-Page SEO  

Current internal linking is critically weak — virtually every page only links to `/quote`. Add cross-links:

1. **Each area page** → Add "Our Services" section at the bottom linking to `/services`
2. **Each area page** → Add "Other areas we cover" section linking to 2–3 related area pages
3. **Services page** → Add "Coverage areas" section linking to `/areas` and key area pages
4. **About page** → Add links to `/services` and `/areas`
5. **FAQ page** → Add contextual links in answers:
   - "What areas do you cover?" → link to `/areas`
   - "What services do you offer?" → link to `/services`
   - "How do I get a quote?" → link to `/quote`

---

### H10 — Expand FAQ answers for AI citation
**Priority:** HIGH  
**Effort:** 2 hours  
**Category:** Content / AI Search  

All FAQ answers are 30–80 words. For AI Overview eligibility and passage-level citation, expand each answer to 120–160 words with specific, factual details.

**Example expansion for "How long does a campaign take?":**

Current (57 words):
> "Most campaigns are completed within two weeks of us receiving your materials, with smaller campaigns often turning around faster. We will agree a clear timeline with you before the campaign begins so you know exactly when to expect completion."

Improved (140+ words):
> "Most campaigns are completed within two weeks of receiving your materials, with smaller runs of under 2,000 leaflets often completed within 3–5 business days. The campaign timeline depends on the postcode areas chosen and the total volume. For larger campaigns covering multiple towns across Hampshire and Dorset — for example, a 25,000-leaflet run across Southampton, Eastleigh, and Winchester — we typically allow 10–14 days from material receipt to completion confirmation. We will agree a clear start and end date with you before beginning, and we confirm completion once the full round is done. If you have a time-sensitive campaign (for example, a sale, event, or seasonal offer), let us know your deadline when requesting your quote and we will build the schedule around it."

---

## Phase 3: Content & Authority (Month 2)

### M1 — Expand homepage content
**Priority:** MEDIUM  
**Effort:** 4 hours  
**Category:** Content  

Add to homepage:
- "Why leaflet distribution works" section with 2–3 statistics (e.g., Royal Mail research on direct mail response rates)
- "How it works" 3-step process section (Step 1: Tell us your target areas. Step 2: We plan and deliver your campaign. Step 3: We confirm completion.)
- Client testimonials section (3 testimonials, see H4)
- "Businesses we work with" section (restaurants, tradespeople, estate agents, gyms, retailers, etc.)

---

### M2 — Add pricing information
**Priority:** MEDIUM  
**Effort:** 2 hours  
**Category:** Content / Conversion  

No pricing anywhere on the site is a conversion barrier. Many visitors will leave without enquiring because they fear prices are too high.

**Options:**
1. Add "Starting from £X per 1,000 leaflets" on services and homepage
2. Add a pricing table with volume tiers on the services page
3. At minimum, add "Typical campaigns start from £XXX" in the FAQ

Even a "contact us for pricing" with a typical range reduces anxiety.

---

### M3 — Expand area pages to 500+ words each
**Priority:** MEDIUM  
**Effort:** 1–2 hours per page (6 pages)  
**Category:** Content  

Each area page should have at minimum 500 substantive words. Add to each:
- Local business landscape (what types of businesses are in this area)
- Why leaflet distribution works in this specific area
- Area-specific demographics and why they respond well
- A local testimonial or case study example
- Related areas / nearby coverage
- A "What our clients in [area] say" quote
- More specific neighborhood/postcode detail

**Southampton example additions:**
- "Southampton is home to over 250,000 residents and is one of the UK's busiest port cities. The diverse residential mix — from student-dense Portswood to the affluent Chilworth and Chandler's Ford suburbs — means leaflet distribution can be precisely targeted to the right household profile for your business."
- Add a cross-link to Eastleigh, Winchester as nearby areas

---

### M4 — Launch the blog with 5 articles
**Priority:** MEDIUM  
**Effort:** 1–2 days  
**Category:** Content  

The blog currently exists but has zero content. Remove noindex only after publishing content. Suggested initial articles:

1. **"How Many Leaflets Do You Need for a Hampshire Campaign?"** (targets FAQ intent, 800+ words)
2. **"Leaflet Distribution vs. Facebook Ads for Local Hampshire Businesses"** (comparison, 1,000+ words)
3. **"Best Leaflet Sizes for Different Business Types"** (A6 vs A5 vs A4 vs DL, 600+ words)
4. **"How to Target the Right Postcodes for Your Leaflet Campaign"** (targeting guide, 700+ words)
5. **"5 Leaflet Distribution Tips for Southampton Restaurants"** (niche, high conversion intent)

**Workflow:** Write article → publish → remove noindex from `/blog` → submit sitemap update

---

### M5 — Add About page substance
**Priority:** MEDIUM  
**Effort:** 2 hours  
**Category:** Content / E-E-A-T  

The about page currently has generic claims with no evidence. Add:
- Founding year or "established in [year]"
- Number of campaigns delivered (if trackable)
- Named person/owner (even first name) with a brief bio
- Real photo of the team/owner (not stock photography)
- Company registration number (if applicable)
- Areas of expertise / how they got into the business
- Link to professional email / business email (not Gmail)

---

### M6 — Add ContactPage schema to /quote
**Priority:** MEDIUM  
**Effort:** 30 minutes  
**Category:** Schema  

Add ContactPage schema to `app/quote/page.tsx`:
```json
{
  "@context": "https://schema.org",
  "@type": "ContactPage",
  "name": "Get a Free Quote",
  "url": "https://flyerdistributionhampshire.co.uk/quote",
  "description": "Request a free quote for flyer and leaflet distribution across Hampshire and Dorset.",
  "mainEntity": { "@id": "https://flyerdistributionhampshire.co.uk/#business" }
}
```

---

### M7 — Set up professional email
**Priority:** MEDIUM  
**Effort:** 1 hour  
**Category:** E-E-A-T  

`flyerdistributionhampshire@gmail.com` signals an informal operation. A professional email:
- `hello@flyerdistributionhampshire.co.uk`
- `info@flyerdistributionhampshire.co.uk`

Options:
- Google Workspace (£6/month) — keeps Gmail interface
- Zoho Mail (free tier available)
- Cloudflare Email Routing (free, if domain is on Cloudflare) — forward to existing Gmail

---

### M8 — Build local citations
**Priority:** MEDIUM  
**Effort:** 4 hours (1 hour/week ongoing)  
**Category:** Local SEO  

Submit to UK local directories for consistent NAP signals:
1. Yell.com
2. Bing Places for Business (separate from GBP)
3. Free Index
4. Thomson Local
5. Scoot
6. Local Hampshire Chamber of Commerce (if applicable)

Ensure NAP is identical across all citations: exact same business name, email, phone (once added), and service areas.

---

## Phase 4: Monitoring & Iteration (Ongoing)

### O1 — Connect Google Search Console
**Action:** Verify domain in GSC, submit sitemap, monitor index coverage weekly

### O2 — Monitor Core Web Vitals
**Action:** Check PageSpeed Insights monthly. Target: LCP < 2.5s, CLS < 0.1, INP < 200ms

### O3 — Track GBP performance
**Action:** Monitor GBP Insights (impressions, calls, direction requests) weekly

### O4 — Collect and publish reviews
**Action:** After each campaign, ask client to leave a Google review. Target: 10 reviews in first 3 months

### O5 — Expand area coverage
**Action:** As business grows, add area pages for: Eastleigh, Romsey, Christchurch, Hythe, Totton, Chandler's Ford — all currently listed as "Also Covering" without dedicated pages

### O6 — Monitor canonical rendering
**Action:** After implementing canonical fix (C2), verify with Google Search Console URL Inspection Tool

---

## Summary Table

| # | Action | Priority | Effort | Expected Impact |
|---|--------|----------|--------|----------------|
| C1 | Fix favicon case | Critical | 2 min | Browser tab icon, minor trust |
| C2 | Fix canonical rendering | Critical | 2 hrs | All 12 pages get proper canonicals |
| C3 | Rename logo file (remove spaces) | Critical | 15 min | Schema image fetchable by Google |
| H1 | Create Google Business Profile | High | 4 hrs | Local pack visibility |
| H2 | Add phone number | High | 30 min | Trust, conversion, NAP |
| H3 | Fix services page H2→H3 | High | 15 min | Heading hierarchy |
| H4 | Add testimonials | High | 4 hrs | E-E-A-T, conversion |
| H5 | Upgrade LocalBusiness schema | High | 1 hr | Entity clarity, Knowledge Panel |
| H6 | Fix Service schema @id | High | 30 min | Schema entity connections |
| H7 | Install GA4 + GSC | High | 2 hrs | Measurement baseline |
| H8 | Create llms.txt | High | 30 min | AI crawler entity clarity |
| H9 | Add internal links | High | 2 hrs | PageRank distribution |
| H10 | Expand FAQ answers | High | 2 hrs | AI citation eligibility |
| M1 | Expand homepage content | Medium | 4 hrs | Content depth, trust |
| M2 | Add pricing information | Medium | 2 hrs | Conversion, user expectations |
| M3 | Expand area pages | Medium | 8 hrs | Thin content, local relevance |
| M4 | Launch blog (5 articles) | Medium | 2 days | Long-tail traffic, authority |
| M5 | Substantiate About page | Medium | 2 hrs | E-E-A-T |
| M6 | Add ContactPage schema | Medium | 30 min | Schema completeness |
| M7 | Set up professional email | Medium | 1 hr | E-E-A-T, trust |
| M8 | Build local citations | Medium | 4 hrs | NAP consistency, local signals |

**Estimated total effort: ~35 hours of development/content work**  
**Estimated timeline: 4–6 weeks for Phases 1–3**  
**Expected health score after full implementation: 78–82 / 100**
