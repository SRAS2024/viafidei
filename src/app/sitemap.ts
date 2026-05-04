import type { MetadataRoute } from "next";

const BASE = process.env.CANONICAL_URL || "https://etviafidei.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [
    "",
    "/prayers",
    "/devotions",
    "/spiritual-life",
    "/spiritual-guidance",
    "/liturgy-history",
    "/saints",
    "/search",
    "/login",
    "/register",
    "/forgot-password",
    "/privacy",
  ];
  return paths.map((p) => ({
    url: `${BASE}${p}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: p === "" ? 1 : 0.7,
  }));
}
