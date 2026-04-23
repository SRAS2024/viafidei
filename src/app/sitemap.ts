import type { MetadataRoute } from "next";

const BASE = process.env.CANONICAL_URL || "https://viafidei.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [
    "",
    "/prayers",
    "/spiritual-life",
    "/spiritual-guidance",
    "/liturgy-history",
    "/saints",
    "/search",
    "/login",
    "/register",
  ];
  return paths.map((p) => ({
    url: `${BASE}${p}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: p === "" ? 1 : 0.7,
  }));
}
