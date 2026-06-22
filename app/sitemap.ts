import type { MetadataRoute } from "next";

const BASE_URL = "https://flyerdistributionhampshire.co.uk";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    "",
    "/services",
    "/areas",
    "/areas/southampton",
    "/areas/bournemouth",
    "/areas/poole",
    "/areas/winchester",
    "/areas/new-forest",
    "/areas/ringwood",
    "/quote",
    "/about",
    "/faq",
  ];

  return routes.map((route) => ({
    url: `${BASE_URL}${route}`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: route === "" ? 1 : 0.8,
  }));
}
