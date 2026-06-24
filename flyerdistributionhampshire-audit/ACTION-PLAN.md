# SEO Action Plan — flyerdistributionhampshire.co.uk

**Audit date:** 2026-06-24
**Overall Health Score:** 62 / 100
**Business type:** Service Area Business — Leaflet Distribution, Hampshire & Dorset UK

---

## Phase 1: Critical Trust & Conversions (Do First — Highest ROI)
*These are primarily operational/content tasks, not code changes*

| # | Action | Owner | Effort | Impact |
|---|---|---|---|---|
| 1.1 | Obtain a business phone number and add to site header, footer, About, Quote pages, and LocalBusiness schema | Business | 2 hrs | Critical |
| 1.2 | Contact recent customers — collect 3–5 written testimonials (first name + business type) for homepage and About page | Business | 1–2 hrs | Critical |
| 1.3 | Set up post-campaign email asking for a Google Business Profile review | Business | 1 hr | Critical |
| 1.4 | Name the business owner on the About page with a 2–3 sentence bio + founding year | Business | 30 min | Critical |
| 1.5 | Add indicative pricing to homepage and services page ("distribution from Xp per household" is sufficient) | Business + Dev | 1 hr | High |
| 1.6 | Add AI crawler rules to robots.ts — block CCBot, GPTBot, Bytespider, Google-Extended; allow PerplexityBot, ChatGPT-User | Dev | 15 min | High |

---

## Phase 2: Content Expansion (Weeks 2–3)

| # | Action | Owner | Effort | Impact |
|---|---|---|---|---|
| 2.1 | Remove JSX `<link rel="canonical">` from all 13 page components — `metadata.alternates.canonical` now rendering correctly in Next.js 16.2.6 | Dev | 30 min | High |
| 2.2 | Expand /services to 800+ words: add "How It Works" (4 steps), per-service "who it suits", turnaround times, minimum quantities | Content | 2–3 hrs | High |
| 2.3 | Expand About page to 500+ words: add founding story, owner bio, values narrative, 2–3 testimonials | Content | 2 hrs | High |
| 2.4 | Expand Areas hub to 500+ words: add geographic narrative, business types served, "also covering" descriptive paragraph | Content | 1 hr | High |
| 2.5 | Expand Southampton page to 600+ words: add "Why leaflet distribution works in Southampton", local demographics, process narrative, 4 inline FAQs | Content | 2 hrs | High |
| 2.6 | Expand Bournemouth page to 600+ words: student market angle, BCP council context, inline FAQs | Content | 2 hrs | High |
| 2.7 | Expand Poole page to 600+ words: develop affluent demographics angle, Sandbanks specifics, inline FAQs | Content | 2 hrs | High |
| 2.8 | Expand Winchester, New Forest, Ringwood pages to 400–500 words each | Content | 3 hrs | Medium |
| 2.9 | Add "How It Works" process section to homepage (3–4 steps) | Dev + Content | 1 hr | High |
| 2.10 | Add 3 FAQ questions: pricing, tracking proof, leaflet exclusivity | Content | 30 min | High |
| 2.11 | Fix meta titles: /services, /faq, /about, /quote — add geo context | Dev | 20 min | Medium |

---

## Phase 3: Schema & Technical (Weeks 2–4)

| # | Action | Owner | Effort | Impact |
|---|---|---|---|---|
| 3.1 | Add `"@id": "https://flyerdistributionhampshire.co.uk/#business"` to LocalBusiness schema in app/page.tsx | Dev | 5 min | Critical |
| 3.2 | Change LocalBusiness `@type` to `["LocalBusiness", "ProfessionalService"]` | Dev | 5 min | High |
| 3.3 | Add WebSite JSON-LD to app/layout.tsx (publisher link to #business @id) | Dev | 15 min | High |
| 3.4 | Upgrade Service @graph: add `@id` and `serviceType` to each node, update `provider` to use `{"@id": ".../#business"}`, add `hasOfferCatalog` to LocalBusiness | Dev | 30 min | High |
| 3.5 | Add Service schema to each of 6 area pages, scoped to that city | Dev | 45 min | High |
| 3.6 | Add BreadcrumbList to /services, /faq, /about, /quote | Dev | 20 min | Medium |
| 3.7 | Add `logo` (ImageObject), `contactPoint` (email), `openingHoursSpecification` (if hours accurate) to LocalBusiness | Dev | 20 min | Medium |
| 3.8 | Upgrade `areaServed` to typed `{"@type": "City", "name": "...", "addressRegion": "..."}` objects | Dev | 15 min | Medium |
| 3.9 | Fix sitemap.ts: replace `new Date()` with static per-route ISO date strings | Dev | 20 min | High |
| 3.10 | Remove `picsum.photos` from next.config.ts remotePatterns | Dev | 5 min | Low |
| 3.11 | Change `lang="en"` to `lang="en-GB"` in app/layout.tsx | Dev | 5 min | Medium |
| 3.12 | Remove `fonts.gstatic.com` from CSP `font-src` in next.config.ts | Dev | 5 min | Low |
| 3.13 | Fix services-page images: replace width/height + CSS override with fill + fixed-height wrapper | Dev | 30 min | Medium |
| 3.14 | Move hero `transform: scale(1.2)` to a wrapper div, remove from `<Image>` element | Dev | 10 min | Medium |

---

## Phase 4: Citations, Authority & AI (Month 2)

| # | Action | Owner | Effort | Impact |
|---|---|---|---|---|
| 4.1 | Submit to Yell.com, Yelp UK, FreeIndex, Thomson Local, Scoot, Bark.com, 192.com (NAP: "Flyer Distribution Hampshire" + email + URL) | Business | 2.5 hrs | High |
| 4.2 | Create LinkedIn Company Page with website URL and service description | Business | 20 min | High |
| 4.3 | Join Hampshire Chamber of Commerce or Dorset Chamber (member directory citation) | Business | 1 hr | High |
| 4.4 | Register with Enterprise M3 LEP or Solent LEP (free government domain citation) | Business | 30 min | Medium |
| 4.5 | Add additional sameAs entries to LocalBusiness schema (LinkedIn, Yell, Facebook if created) | Dev | 10 min | Medium |
| 4.6 | Verify and replace GBP share link with stable Google Maps Place URL | Dev | 15 min | Medium |
| 4.7 | Publish blog: 3–5 posts targeting high-PAA queries | Content | 4–6 hrs | Medium |
| 4.8 | Add coverage map (static image or embedded Google Map) to /areas page | Dev | 1 hr | Medium |

---

## Phase 5: Monitoring & Ongoing (Ongoing)

| # | Action | Cadence |
|---|---|---|
| 5.1 | Check Google Business Profile for new reviews — respond to all within 48 hours | Weekly |
| 5.2 | Monitor GBP reviews — target 2+ new reviews per month | Monthly |
| 5.3 | Update sitemap lastModified dates when page content changes | On each content update |
| 5.4 | Publish blog post | Monthly |
| 5.5 | Check Search Console for crawl errors, manual actions, and indexation issues | Monthly |
| 5.6 | Track rankings for "leaflet distribution [city]" queries for all 6 featured areas | Monthly |

---

## Already Done (This Audit)

- `/public/llms.txt` created and committed — AI search citability improved
- Footer Blog link now shows "Coming soon" pill

---

## What NOT to Do

These items were flagged but are **not recommended** given this site's specific setup:

- **Do not remove JSX canonical links yet without rebuilding and verifying** — HIGH-1 recommends removal since alternates.canonical now renders, but run a build and grep `.next/server/app/index.html` for `<link rel="canonical">` after removal to confirm before pushing
- **Do not add GPS tracking language if you don't actually use GPS tracking** — several agents recommend this but only add tracking claims you can deliver
- **Do not add pricing that isn't accurate** — even a "from £X" figure creates expectations. Only add real pricing signals
- **Do not add `openingHoursSpecification` if hours aren't consistent** — incorrect hours in schema cause GBP conflicts

---

## Quick Wins Summary (Under 2 Hours Total Code Work)

These are the fastest code fixes with meaningful SEO impact:

1. Add `@id` to LocalBusiness schema — 5 min → unlocks entity graph
2. Change LocalBusiness `@type` to `["LocalBusiness", "ProfessionalService"]` — 5 min
3. Add WebSite JSON-LD to layout.tsx — 15 min
4. Add AI crawler rules to robots.ts — 15 min
5. Change `lang="en"` to `lang="en-GB"` in layout.tsx — 5 min
6. Remove `picsum.photos` from remotePatterns — 5 min
7. Remove `fonts.gstatic.com` from CSP font-src — 5 min
8. Fix sitemap lastModified — 20 min
9. Update 4 page title tags — 20 min

**Total: ~95 minutes. Combined impact: schema entity graph, AI crawler clarity, language signal, CSP tightening, accurate sitemap.**
