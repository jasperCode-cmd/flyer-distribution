import { MAP_TILES } from "./area-planner/tiles";

// The site's security headers, read by next.config.ts. Every page has the
// same Content-Security-Policy except the two that show a map (the Area
// Planner and the private delivery pages), which may also load map tiles
// from the one tile host, and on the planner blob: images for the
// "Download image" preview. The public site's policy also allows
// Cloudflare Web Analytics (its beacon script and where it reports); the
// map pages' policies do not, so a private delivery link's address is never
// sent to it. Nothing else is loosened anywhere.

function contentSecurityPolicy(extraImg: string[] = [], analytics = false): string {
  const img = ["'self'", "images.unsplash.com", "images.pexels.com", "data:", ...extraImg].join(" ");
  return [
    "default-src 'self'",
    `img-src ${img}`,
    `script-src 'self' 'unsafe-inline'${analytics ? " https://static.cloudflareinsights.com" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' fonts.gstatic.com",
    `connect-src 'self' api.web3forms.com${analytics ? " https://cloudflareinsights.com" : ""}`,
  ]
    .map((d) => `${d};`)
    .join(" ");
}

export const SITE_CSP = contentSecurityPolicy([], true);
export const PLANNER_CSP = contentSecurityPolicy([MAP_TILES.host, "blob:"]);
export const DELIVERY_CSP = contentSecurityPolicy([MAP_TILES.host]);

export const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Also what keeps a private link's token out of the tile requests: only
  // the site's origin is sent to other hosts, which the tile policy needs.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "Content-Security-Policy", value: SITE_CSP },
];

// Later rules win for the same header, so these come after the site-wide one.
export const MAP_PAGE_HEADER_RULES = [
  { source: "/admin/crm/map", headers: [{ key: "Content-Security-Policy", value: PLANNER_CSP }] },
  { source: "/admin/crm/map/:path*", headers: [{ key: "Content-Security-Policy", value: PLANNER_CSP }] },
  {
    source: "/delivery/:path*",
    headers: [
      { key: "Content-Security-Policy", value: DELIVERY_CSP },
      { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
    ],
  },
];
