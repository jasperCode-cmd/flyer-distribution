import type { NextConfig } from "next";
import { MAP_PAGE_HEADER_RULES, SECURITY_HEADERS } from "./lib/security-headers";

const nextConfig: NextConfig = {
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
