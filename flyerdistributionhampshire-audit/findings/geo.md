# GEO & AI Search Readiness Audit
## flyerdistributionhampshire.co.uk

**Audit date:** 2026-06-22
**Source:** Static file analysis (live domain unreachable)
**Analyst note:** All findings derived from Next.js source files in `/home/user/flyer-distribution/`

---

## GEO Readiness Score: 41 / 100

| Dimension | Weight | Raw Score | Weighted |
|---|---|---|---|
| Citability | 25% | 38/100 | 9.5 |
| Structural Readability | 20% | 52/100 | 10.4 |
| Multi-Modal Content | 15% | 28/100 | 4.2 |
| Authority & Brand Signals | 20% | 18/100 | 3.6 |
| Technical Accessibility | 20% | 67/100 | 13.4 |
| **Total** | | | **41.1** |

---

## 1. AI Crawler Access

**robots.ts output (served as /robots.txt):**

```
User-agent: *
Allow: /
Disallow: /admin/
```

A single wildcard rule is used. No named AI crawler rules are present.

| Crawler | Status | Notes |
|---|---|---|
| GPTBot | Allowed (by wildcard) | Not explicitly named |
| OAI-SearchBot | Allowed (by wildcard) | Not explicitly named |
| ClaudeBot | Allowed (by wildcard) | Not explicitly named |
| PerplexityBot | Allowed (by wildcard) | Not explicitly named |
| CCBot | Allowed (by wildcard) | Not explicitly blocked |
| anthropic-ai | Allowed (by wildcard) | Not explicitly blocked |

**Assessment:** All crawlers are technically permitted. However, the absence of named rules is a missed signal. Explicitly allowing search-oriented AI crawlers (GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot) by name would confirm intent and may improve crawl prioritisation. The training scrapers (CCBot, anthropic-ai) are not blocked; this is a neutral-to-positive stance for index coverage.

The blog page carries `robots: { index: false }` in its metadata, which is correct given it has no content.

---

## 2. llms.txt Status

**Status: MISSING**

No `/public/llms.txt` file exists and no `app/llms.txt/route.ts` is present. This is a significant omission for AI readiness.

`llms.txt` (the emerging standard proposed by Answer.AI / fast.ai) gives AI systems a curated, machine-readable summary of a site's content, services, and authorised use. Without it, language models must infer business details from HTML, which is less reliable and can produce hallucinated or incomplete descriptions.

**Recommended llms.txt content for this site:**

```
# Flyer Distribution Hampshire

> Professional flyer and leaflet distribution service based in Hampshire, UK.
> Serving local businesses, national brands with local campaigns, charities,
> and community organisations across Hampshire and Dorset.

## Services
- Design, Print and Deliver (full end-to-end service)
- Print and Deliver (client supplies artwork)
- Leaflet Distribution (door-to-door, letterbox delivery)
- Targeted Postcode Campaigns
- Vehicle Leaflet Distribution (car parks, retail areas)
- Campaign Planning

## Coverage Areas
Hampshire: Southampton (SO14–SO19, SO30, SO31, SO40, SO45), Winchester,
Eastleigh, Chandler's Ford, Hedge End, Romsey, Hythe, Totton, New Forest, Ringwood
Dorset: Bournemouth, Poole, Christchurch

## Key Facts
- Independent, locally owned business
- Vetted and trained distribution team
- Postcode-level targeting available
- Formats: A6, A5, A4, DL
- Quote turnaround: 24 hours
- Typical campaign completion: within two weeks of receiving materials
- Minimum recommended quantity: 5,000 leaflets
- Contact: flyerdistributionhampshire@gmail.com

## Pages
- /services — full service descriptions
- /areas — coverage map and area list
- /faq — 10 answered questions about the service
- /quote — free quote request form
```

**RSL 1.0 licensing:** Not declared anywhere. Adding an `AI-Content-License` header or RSL 1.0 declaration in llms.txt would signal permissive use to LLM training pipelines.

---

## 3. Passage-Level Citability Analysis

AI engines (Google AIO, Perplexity, ChatGPT Browse) extract short, self-contained passages for citation. Optimal passage length for citation is 134–167 words. Direct answers should appear in the first 40–60 words of each section.

### Homepage (app/page.tsx)

The hero paragraph reads:

> "We deliver your leaflets and flyers directly through letterboxes across Hampshire and Dorset, helping local businesses reach real customers in the right postcodes."

This is clear and direct but at 28 words it is below the citation-optimal length. It does not answer WHO operates the service, WHEN they operate, or HOW MUCH it costs.

The trust-signal blocks (Local Team, Targeted Postcodes, Tracked and Assured Delivery) are 40–60 words each — within range for extraction but lack any verifiable specifics (numbers, dates, volume claims).

**No statistics anywhere on the homepage.** There are no claims such as "X leaflets delivered" or "covering Y households" that an AI could cite as a verifiable fact.

### FAQ Page (app/faq/page.tsx) — STRONGEST PAGE FOR CITABILITY

10 FAQs are present. Analysed against the 134–167 word optimal range:

| FAQ | Word count | Citability |
|---|---|---|
| What areas do you cover? | 72 words | Below optimal but specific — named 13 towns |
| How does leaflet distribution work? | 51 words | Too short, vague process |
| Do you offer design/print/delivery? | 37 words | Too short |
| Can I target specific postcodes? | 44 words | Below optimal |
| Do I need leaflets pre-printed? | 64 words | Near range, includes format info |
| How do I get a quote? | 35 words | Too short |
| How many leaflets do I need? | 79 words | Close to optimal, includes 5,000 figure |
| What size leaflets do you deliver? | 31 words | Too short |
| What is vehicle leaflet distribution? | 61 words | Below optimal |
| How long does a campaign take? | 53 words | Below optimal, includes "two weeks" fact |

**Only 0 of 10 FAQs reach the 134-word optimal length.** The best-performing FAQ ("How many leaflets?") contains the only quantitative claim on the entire FAQ page (5,000 leaflets minimum). This is the most AI-citable passage on the site.

The FAQPage schema is correctly implemented and maps 1:1 to the visible FAQ content — this is a genuine positive.

### About Page (app/about/page.tsx)

The "Who We Are" section contains three paragraphs totalling approximately 95 words. It describes the business as "independent" and "based in Hampshire, UK" — useful for entity recognition. However:

- No founding date or trading history
- No team size or named personnel
- No volume claims or campaign statistics
- No geographic specifics beyond "Hampshire and Dorset"

The values section (Reliability, Local Knowledge, Transparency) provides descriptive prose but zero verifiable facts.

### Services Page (app/services/page.tsx)

Service descriptions average 40–55 words each. They are clear but too brief for citation. The "Design, Print and Deliver" description at 62 words is the longest and most detailed.

No pricing, no turnaround times, no volume capacities are mentioned on this page, despite the FAQ establishing that quotes are returned in 24 hours and campaigns complete in two weeks. These facts should be surfaced on the services page.

### Southampton Area Page (app/areas/southampton/page.tsx)

This is the second strongest page. It contains:

- Specific population figure: "over 250,000 residents"
- Named postcode areas: SO14, SO15, SO16, SO17, SO18, SO19, SO30, SO31, SO40, SO45
- Named neighbourhoods: Shirley, Portswood, Bitterne, city centre, waterfront
- Named business types served: restaurants, tradespeople, estate agents, gyms, retailers

The opening paragraph of the coverage section is 56 words — below optimal but dense with specifics. This is the most AI-citable page on the site after the FAQ.

**Overall citability verdict:** The site has a thin factual base. AI engines will struggle to cite it for anything beyond basic identity (name, location, service type). There are no statistics, no case studies, no outcome claims, and no third-party validation.

---

## 4. Structured Data Assessment

| Schema type | Page | Status | Notes |
|---|---|---|---|
| LocalBusiness | Homepage | Present | Missing: telephone, address, geo coordinates, openingHours, priceRange |
| Service (x6) | /services | Present | Missing: serviceType, offers/priceSpecification, url per service |
| FAQPage | /faq | Present, correct | 10 Q&As mapped accurately |
| BreadcrumbList | /areas/southampton (and 5 others) | Present | Correctly structured |
| Organization | None | Missing | No @type Organization schema anywhere |
| WebSite | None | Missing | No sitelinks search box / WebSite schema |
| Review / AggregateRating | None | Missing | No reviews exist |

**Critical gaps in LocalBusiness schema:**

The LocalBusiness schema on the homepage is missing fields that AI systems use heavily for local entity disambiguation:

- `telephone` — no phone number exists anywhere on the site
- `address` (PostalAddress) — no street address declared
- `geo` (GeoCoordinates) — no lat/long
- `openingHoursSpecification` — no hours stated
- `priceRange` — absent (even a general "££" signal helps)
- `foundingDate` — absent
- `logo` — present but points to the logo image (good)
- `sameAs` — absent; no links to social profiles, Wikipedia, Companies House, etc.

The absence of a phone number and physical address is the single most damaging structured data gap for local AI citations. Google's Knowledge Panel and AIO local results depend heavily on NAP (Name, Address, Phone) consistency.

---

## 5. Brand Mention Signals & Authority

| Signal | Status | Impact |
|---|---|---|
| Wikipedia entity | Not present | High negative impact on ChatGPT/Perplexity citations |
| Google Business Profile | Unknown (not in source) | Critical gap for local AI results |
| Reddit mentions | Not detectable from source | Unknown |
| YouTube presence | Not detected | Strongest AI citation correlator (~0.737) — absent |
| LinkedIn company page | Not detected | Moderate impact |
| Twitter/X presence | Not detected | Moderate impact |
| Domain email | Gmail (flyerdistributionhampshire@gmail.com) | Weak authority signal |
| Backlink profile | Unknown from source | Domain Rating not assessable |
| Companies House / official registration | Not referenced | Missing trust layer |

**Entity disambiguation problem:** The business uses a Gmail address in its LocalBusiness schema. AI systems building entity graphs prefer domain email addresses (`@flyerdistributionhampshire.co.uk`), professional citations, and `sameAs` links to authoritative sources (Companies House, Google Business Profile, social profiles). The current entity footprint is nearly invisible outside the site itself.

**"sameAs" schema property** is entirely absent. This is the primary mechanism through which structured data systems connect a LocalBusiness entity to external authority sources.

---

## 6. Who / What / Where / When / Why for AI Citation

AI engines answering local service queries need clear factual answers to these questions. Current state:

| Question | Answered in content? | Quality |
|---|---|---|
| WHO operates the service? | Partially — "local independent team" | No names, no history, anonymous |
| WHAT is the service? | Yes — leaflet/flyer distribution | Well described across pages |
| WHERE do they operate? | Yes — Hampshire & Dorset with area list | Adequate; postcode detail on area pages |
| WHEN can I use them / how long does it take? | Partially — "two weeks" mentioned once in FAQ | Not on homepage or services page |
| WHY choose them over alternatives? | Only vague claims — "local", "vetted", "care" | No evidence, no reviews, no stats |
| HOW MUCH does it cost? | Not disclosed anywhere | Significant gap |
| HOW MANY leaflets? | Minimum 5,000 mentioned once in FAQ | Underplayed |

The "Why" and "How much" gaps are the most damaging for conversion-intent AI queries (e.g., "how much does leaflet distribution cost in Southampton?"). AI engines cannot cite a price because none is given, and cannot cite a reason to choose this business because no verifiable evidence exists.

---

## 7. Content Structure for AI Readability

**Positive structural signals:**
- H1 tags are used correctly on all pages (one per page)
- H2/H3 hierarchy is logical and consistent
- FAQ questions are used as H2 headings — directly question-formatted, which is strong
- Next.js SSR (server-side rendering) confirmed — all pages render full HTML server-side; no SPA hydration problem for crawlers
- Sitemap covers 12 URLs and is correctly generated
- Canonical URLs set on all audited pages
- OpenGraph and Twitter card meta on all pages
- `lang="en"` set on the HTML element
- Image alt text is present and descriptive on all images reviewed

**Negative structural signals:**
- No in-page anchor links on long pages (FAQ, services) — crawlers cannot deep-link to specific answers
- Service cards and area cards are rendered as JSX arrays without unique page URLs per service (services have schema but no dedicated `/services/leaflet-distribution` URLs)
- The "Also Covering" area list (Eastleigh, Romsey, etc.) is rendered as `<span>` tags with no links — these towns have no associated pages and no schema, reducing their discoverability
- No `<article>` or `<main>` landmark elements explicitly wrapping primary content (the `<main>` wrapper is in layout.tsx, which is adequate, but individual sections lack semantic article landmarks)
- No published dates on any content — AI systems use publication dates as freshness signals
- No author attribution anywhere — weakens E-E-A-T signals

---

## 8. Technical Accessibility for AI Crawlers

**Framework:** Next.js (App Router)
**Rendering:** Server-side rendered — confirmed by use of `export default function` components without `"use client"` directives on any audited page. This is optimal for AI crawlers.

**Score breakdown:**

| Check | Status |
|---|---|
| SSR vs CSR | SSR confirmed — positive |
| robots.txt | Present, permissive — positive |
| sitemap.xml | Present, 12 URLs — positive |
| llms.txt | Missing — negative |
| Canonical URLs | All pages have canonical — positive |
| Blog noindex | Correctly set — positive |
| HTTPS | Assumed (canonical URLs use https) |
| Page speed (inferred) | Stock Next.js + Tailwind likely fast — positive |
| JavaScript dependency for content | None on audited pages — positive |
| Named AI crawler rules | Missing — neutral/negative |

---

## 9. Platform-Specific Assessment

### Google AI Overviews (SGE)

**Score: 44/100**

Strengths: FAQPage schema is the primary asset here. Google AIO preferentially pulls from FAQPage markup. The 10 structured Q&As give Google the clearest path to surface this business in an AI Overview for queries like "leaflet distribution Hampshire" or "how does flyer distribution work."

Weaknesses: No reviews or ratings (AggregateRating schema). No pricing. Thin E-E-A-T signals (no author, no date, no professional credentials). The LocalBusiness schema lacks address and phone, which Google uses for local pack and AIO local surface integration. No Google Business Profile connection apparent from schema.

**Highest-priority fix for Google AIO:** Add telephone and PostalAddress to LocalBusiness schema and create a Google Business Profile with matching NAP data. Then add `sameAs` pointing to the GBP URL.

### Bing Copilot

**Score: 38/100**

Bing Copilot relies heavily on Bing index quality and structured data. The site has adequate structured data for service descriptions but lacks the authority signals (backlinks, brand mentions, social presence) that Bing weights more heavily than Google. The absence of any `Organization` schema with `sameAs` links is particularly damaging for Bing's entity graph. Bing Copilot also surfaces review data prominently; zero reviews is a critical gap.

### ChatGPT (Browse / Search)

**Score: 31/100**

ChatGPT with Browse relies on crawled content and citation confidence. For a local business, ChatGPT is most likely to cite the site when: (a) there are Wikipedia or Reddit mentions establishing the brand, (b) the content contains unique, quotable statistics, or (c) the site appears prominently in web search results that ChatGPT queries. None of these conditions are strongly met. The site may appear in ChatGPT answers about Hampshire leaflet distribution, but it has no unique factual content to distinguish itself from national competitors. The Gmail email address in schema slightly undermines entity confidence.

**Highest-priority fix for ChatGPT:** Create an llms.txt file (immediately machine-readable for LLM systems) and publish at least one statistic-rich blog post that can be cited (e.g., "How many households are in the SO postcode area?" or "Average leaflet response rates in Hampshire").

### Perplexity

**Score: 40/100**

Perplexity favours structured, answer-dense content. The FAQ page is the most Perplexity-citable page on the site because Perplexity's synthesis engine works well with Q&A formats. However, Perplexity weights authoritative external citations heavily — without backlinks from local business directories, industry sites, or news sources, Perplexity is unlikely to cite this site over a more established national competitor. The FAQ answers are too short for Perplexity's preferred passage length.

---

## 10. Top 5 Highest-Impact Recommendations

### Priority 1 — Create llms.txt (Effort: Low — 2 hours)

Add `/public/llms.txt` to the Next.js public directory. The file should declare the business entity, all services, coverage areas, key facts (formats, quantities, turnaround), and link to each main page. This is the single fastest win: it makes the entire business knowable to any LLM that fetches the file, bypassing HTML parsing entirely. An alternative implementation is `app/llms.txt/route.ts` as a dynamic Next.js route handler.

**Expected impact:** Improved entity accuracy in ChatGPT, Perplexity, and ClaudeBot responses; reduced hallucination risk when users ask AI assistants about Hampshire flyer distribution services.

### Priority 2 — Complete the LocalBusiness Schema (Effort: Low — 3 hours)

Add the following fields to the existing `localBusinessSchema` object in `app/page.tsx`:
- `telephone` — requires a phone number to be created/published
- `address` with `@type: PostalAddress`, `addressRegion: "Hampshire"`, `addressCountry: "GB"`
- `sameAs` array pointing to: Google Business Profile URL, Facebook page (if created), LinkedIn company page (if created)
- `priceRange` — even `"££"` or `"Contact for quote"` helps
- `openingHoursSpecification` — even if just Mon–Fri 9–5

**Expected impact:** Qualifies the business for Google local AI surface integration; improves Bing entity resolution; provides NAP consistency for local pack rankings.

### Priority 3 — Establish Google Business Profile and Get First Reviews (Effort: Medium — 1 week)

No social presence or external entity anchor is detectable from the source. Create a Google Business Profile with matching NAP data (name, address, phone consistent with schema), add the GBP URL to `sameAs` in schema, and solicit 5–10 genuine customer reviews. AggregateRating schema can then be added to the homepage.

**Expected impact:** Reviews are the strongest missing signal for Google AIO local results. Even 5 reviews with a 4.5+ average rating would materially change how Google AIO presents this business in local distribution queries. Also creates the external entity anchor that Bing Copilot and ChatGPT need for citation confidence.

### Priority 4 — Expand FAQ Answers to Citation-Optimal Length (Effort: Low-Medium — 4 hours)

Every FAQ answer is currently 31–79 words. Expand each to 134–167 words by adding:
- Specific postcode or neighbourhood examples in area answers
- Step-by-step process detail in process answers
- Indicative quantities and format specifics in service answers
- The "two weeks / 24 hours" timing claims, which currently only appear in one FAQ and should be reinforced throughout

The question "How many leaflets do I need?" should be expanded to include household density data for the SO postcode area, typical response rates for print marketing, and a worked example. This single expanded answer could become the most-cited passage on the site for relevant AI queries.

**Expected impact:** Increases FAQ passage citation probability from near-zero to meaningful for Google AIO and Perplexity. FAQPage schema amplifies the effect.

### Priority 5 — Publish Two Long-Form Blog Posts with Verifiable Statistics (Effort: Medium — 2–3 days)

The blog exists but is empty and noindexed. Publishing two well-researched articles would provide the factual content layer the site entirely lacks:

Suggested articles:
1. "Leaflet Distribution in Hampshire: How Many Homes Can You Reach?" — include household counts per postcode district (SO, BH, SP, PO), response rate benchmarks, and cost-per-household comparisons. This answers the pricing question indirectly while providing citable statistics.
2. "Door-to-Door vs Vehicle Leaflet Distribution: What Works Best in Southampton?" — comparative content with specific claims creates citable, unique content that AI engines have a reason to surface.

Once published, remove `robots: { index: false }` from `app/blog/page.tsx` and add blog posts to the sitemap.

**Expected impact:** Statistics and unique factual claims are the primary driver of AI citation selection. A single well-researched article with original or well-sourced data points would likely become the highest-cited page on the domain within months.

---

## Summary of Gaps

| Gap | Severity | Affects |
|---|---|---|
| No llms.txt | High | All AI platforms |
| No phone number or address in schema or content | High | Google AIO, Bing Copilot, local results |
| No reviews or rating schema | High | Google AIO, Bing Copilot |
| No external entity anchors (GBP, social, sameAs) | High | ChatGPT, Perplexity, Bing |
| Gmail email instead of domain email | Medium | Entity confidence |
| FAQ answers below citation-optimal length | Medium | Google AIO, Perplexity |
| No pricing information | Medium | Conversion-intent AI queries |
| No statistics or verifiable claims | Medium | All platforms |
| No blog / long-form content | Medium | ChatGPT, Perplexity |
| No founding date or named personnel | Low-Medium | E-E-A-T signals |
| No explicit AI crawler rules in robots.txt | Low | Crawl prioritisation |
| No WebSite or Organization schema | Low | Sitelinks, entity graphs |
| Secondary area towns have no linked pages | Low | Long-tail local queries |

---

*GEO audit produced from static Next.js source file analysis. Live domain crawl not performed. Score reflects assessed readiness based on content, schema, and structure only; actual domain authority and backlink profile not assessed.*
