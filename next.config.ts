import type { NextConfig } from "next";
import { MAP_PAGE_HEADER_RULES, SECURITY_HEADERS } from "./lib/security-headers";

const SITE = "https://www.flyerdistributionhampshire.co.uk";

// The area pages that moved from /areas/[area] to
// /areas/leaflet-distribution-[area] on 27 October 2026.
const MOVED_AREAS = [
  "southampton",
  "bournemouth",
  "poole",
  "winchester",
  "new-forest",
  "ringwood",
  "christchurch",
  "dorset",
  "eastleigh",
  "romsey",
  "hythe",
  "totton",
  "hedge-end",
  "chandlers-ford",
  "brockenhurst",
];

const nextConfig: NextConfig = {
  // Next's own trailing-slash redirect would run before the area redirects
  // below and send an old area address with a trailing slash through two
  // hops. So it is switched off here and added back, unchanged, after them.
  skipTrailingSlashRedirect: true,
  async redirects() {
    return [
      // THESE REDIRECTS MUST NEVER BE REMOVED. They carry the old area
      // addresses' links and search ranking over to the new ones. Each old
      // address, with or without a trailing slash, goes straight to its new
      // www address in one permanent (308) hop, keeping any query string.
      ...MOVED_AREAS.flatMap((area) =>
        [`/areas/${area}`, `/areas/${area}/`].map((source) => ({
          source,
          destination: `${SITE}/areas/leaflet-distribution-${area}`,
          permanent: true,
        }))
      ),
      // Next's own trailing-slash redirect, as it was: /page/ to /page (308).
      { source: "/:path+/", destination: "/:path+", permanent: true },
    ];
  },
  // Quote and invoice PDFs read their fonts and logo from disk, so the files
  // ship with the routes that make them.
  outputFileTracingIncludes: {
    "/api/crm/documents/**/*": ["./lib/documents/assets/**/*"],
    // The Area Planner's postcode shapes and Census household figures.
    "/api/crm/area-planner/**/*": ["./data/area-planner/**/*"],
    "/admin/crm/map": ["./data/area-planner/**/*"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: SECURITY_HEADERS,
      },
      ...MAP_PAGE_HEADER_RULES,
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "images.pexels.com" },
    ],
  },
};

export default nextConfig;
