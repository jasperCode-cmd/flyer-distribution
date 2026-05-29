import type { MetadataRoute } from "next";

const BASE_URL = "https://PLACEHOLDER_DOMAIN";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    "",
    "/services",
    "/areas",
    "/areas/southampton",
    "/areas/bournemouth",
    "/areas/poole",
    "/areas/winchester",
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
