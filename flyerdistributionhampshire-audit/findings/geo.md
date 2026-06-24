# GEO & AI Search Readiness Findings
**Score: 54 / 100**
**Auditor:** seo-geo — 2026-06-24

## Dimension Scores

| Dimension | Weight | Score | Weighted |
|---|---|---|---|
| Citability | 25% | 48 | 12.0 |
| Structural Readability | 20% | 62 | 12.4 |
| Multi-Modal Content | 15% | 40 | 6.0 |
| Authority & Brand Signals | 20% | 30 | 6.0 |
| Technical Accessibility | 20% | 88 | 17.6 |

## AI Crawler Access

All AI crawlers allowed via wildcard `User-agent: *` — no named per-bot rules exist. This is correct for AI search visibility (Perplexity, ChatGPT-User) but means CCBot (bulk training scraper) and GPTBot (OpenAI training) are also freely ingesting. Consider adding explicit named rules as a signal of intent.

## llms.txt Status: CREATED ✓

`/public/llms.txt` created and pushed to main during this audit. Contents include: business description, all six services with format specs, geographic coverage with postcodes, key operational facts (min quantity, turnaround, quote SLA), all 10 FAQ answers verbatim, and a full page index.

## Platform Readiness

| Platform | Score | Notes |
|---|---|---|
| Google AI Overviews | 52/100 | FAQPage schema present; missing pricing, address, GBP reviews |
| Perplexity | 45/100 | Full SSR crawl access; weak passage-length content; no 3rd-party mentions |
| ChatGPT / SearchGPT | 40/100 | GPTBot allowed; no Wikipedia entity, no YouTube, no Reddit |
| Bing Copilot | 55/100 | FAQPage schema + SSR + OG metadata — strongest non-Google platform |

## Critical

**C1. No pricing information anywhere**
AI assistants asked "how much does leaflet distribution in Hampshire cost?" have nothing to cite. Even a "from £X per 1,000" or a price range in the FAQ would make the site the AI-preferred citation for this commercially valuable query type.

## High

**H1. FAQ answers below optimal citation length**
Most answers are 40–75 words. Optimal AI citation range is 120–160 words per answer, with the direct answer in the first sentence. Expand to this range — no new content strategy needed, only depth on existing answers.

**H2. No pricing FAQ question**
"How much does leaflet distribution cost in Hampshire?" is the highest-volume PAA query for this vertical. It is entirely absent from the FAQ.

**H3. Delivery tracking vague — no mechanism specified**
The site claims "tracked and assured delivery" but provides no specifics. AI assistants prefer specific, verifiable claims. State exactly what tracking involves (GPS, completion reports, photo confirmation, or manual sign-off).

**H4. Brand mention signals near-zero**
No Wikipedia entity, no YouTube channel, no Reddit mentions. `sameAs` has only the GBP link. Adding LinkedIn, Facebook, or trade directory URLs expands the entity graph that AI citation models use for brand resolution.

## Medium

**M1. Question-format headings would improve AI citability**
"About Our Southampton Coverage" → "How Does Leaflet Distribution Work in Southampton?" creates directly extractable answer blocks.

**M2. No `.well-known/` directory**
`/.well-known/security.txt` absent. Minor, but expected for a professional site.

**M3. No first-person authorial voice**
No named author, no byline. Weakens authority scoring in AI citation models.

## Technical Accessibility Strengths

- Full SSR — all content in initial HTML, no JavaScript rendering barrier for AI crawlers ✓
- Sitemap at /sitemap.xml correctly excludes /blog ✓
- Canonical URLs on all pages ✓
- FAQPage schema correctly implemented for structured Q&A extraction ✓
- OpenGraph metadata on every page ✓
- llms.txt now present ✓
