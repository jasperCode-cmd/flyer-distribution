# Performance & Core Web Vitals Findings
**Score: 72 / 100**
**Auditor:** seo-performance — 2026-06-24

## CWV Prediction (source-code analysis)

| Metric | Predicted Status | Confidence |
|---|---|---|
| LCP | Needs Improvement / Poor | High |
| CLS | Good (one caveat) | Medium |
| INP | Good | High |

## LCP — Primary Risk

**Hero image is the LCP candidate on every viewport.**

What is correct:
- `priority` prop set on hero `<Image>` — preload link confirmed in built HTML ✓
- Explicit `width={1600} height={700}` — no dimension-based CLS ✓
- Next.js image optimization active (AVIF/WebP via `/_next/image`) ✓

Risks:
1. **Cross-origin Unsplash CDN fetch** — `/_next/image` proxies the request, but cold-fetch from origin.unsplash.com adds 300ms–1500ms on cache miss.
2. **`transform: scale(1.2)` on the `<Image>` element** — CSS transform forces a compositing layer and delays paint by 50–150ms.
3. **Header logo also has `priority`** — two competing preload links, minor bandwidth contention.
4. **No explicit `sizes` prop** — browser may download a larger srcset candidate than needed.

## CLS — One Risk

**Services-page images have dimension mismatches:**
- Package cards: `width={700} height={420}` but CSS overrides to `h-56` (224px)
- Supporting services: `width={600} height={300}` but CSS overrides to `h-44` (176px)
- Browser reserves space based on declared aspect ratio then immediately overrides — causes layout shift on /services

**Fix:** Replace all services-page `<Image>` components with `fill` prop + fixed-height wrapper:
```tsx
<div className="relative w-full h-56">
  <Image src={pkg.image} alt={pkg.alt} fill className="object-cover" />
</div>
```

## INP — Good

Only two client components (`Header.tsx` with a single useState boolean toggle, `QuoteForm.tsx` with simple state + async fetch). No animation libraries, no tag managers, no analytics scripts. INP will very likely pass the ≤200ms threshold.

## Bundle Size — Excellent

Runtime dependencies: next 16.2.6, react 19.2.4, react-dom 19.2.4 only. No component libraries, no date libraries, no state management. Estimated JS transferred: under 100 KB gzipped.

## Third-Party Scripts — Clean

Web3Forms accessed only via `fetch()` in the quote form submit handler — not a `<script>` tag, not blocking. Zero analytics, tag managers, chat widgets, or ad scripts anywhere in the codebase.

## CSP — Minor Issues

- `fonts.gstatic.com` in `font-src` is unnecessary (next/font self-hosts Inter)
- `'unsafe-inline'` in `script-src` negates XSS protection — acceptable short-term, nonce-based CSP is the correct long-term fix

## Prioritised Fixes

| Priority | Fix | Expected Impact |
|---|---|---|
| High | Self-host or CDN-serve the hero image | LCP -300ms to -1000ms |
| High | Fix services-page image dimension mismatch (use fill prop) | CLS improvement on /services |
| Medium | Remove `transform: scale(1.2)` from hero `<Image>` — move to wrapper | LCP -50ms to -150ms |
| Medium | Remove `priority` from Header logo | Marginal LCP improvement |
| Low | Remove `fonts.gstatic.com` from CSP font-src | Security tightening |
| Low | Migrate to nonce-based CSP | Security hardening |
