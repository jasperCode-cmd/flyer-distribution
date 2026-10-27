import type { MetadataRoute } from "next";

const BASE_URL = "https://www.flyerdistributionhampshire.co.uk";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    "",
    "/services",
    "/areas",
    "/areas/leaflet-distribution-southampton",
    "/areas/leaflet-distribution-bournemouth",
    "/areas/leaflet-distribution-poole",
    "/areas/leaflet-distribution-winchester",
    "/areas/leaflet-distribution-new-forest",
    "/areas/leaflet-distribution-ringwood",
    "/quote",
    "/about",
    "/faq",
    "/services/screen-hire",
    "/services/web-design-seo",
    "/areas/leaflet-distribution-christchurch",
    "/areas/leaflet-distribution-dorset",
    "/areas/leaflet-distribution-eastleigh",
    "/leaflet-distribution-jobs",
    "/case-studies",
    "/services/public-notice-leafleting",
    "/areas/leaflet-distribution-romsey",
    "/areas/leaflet-distribution-hythe",
    "/areas/leaflet-distribution-totton",
    "/areas/leaflet-distribution-hedge-end",
    "/areas/leaflet-distribution-chandlers-ford",
    "/areas/leaflet-distribution-brockenhurst",
    "/services/hand-to-hand-distribution",
    "/services/b2b-distribution",
    "/privacy-policy",
    "/before-you-book",
  ]; // /blog excluded: noindex

  return routes.map((route) => ({
    url: `${BASE_URL}${route}`,
    // The area pages moved to /areas/leaflet-distribution-[area] on 27 October 2026,
    // and the /areas overview's links changed with them.
    lastModified: new Date(route === "/areas" || route.startsWith("/areas/") ? "2026-10-27" : "2026-06-24"),
    changeFrequency: "monthly",
    priority: route === "" ? 1 : 0.8,
  }));
}
