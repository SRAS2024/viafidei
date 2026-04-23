import type { MetadataRoute } from "next";

const BASE = process.env.CANONICAL_URL || "https://viafidei.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/admin", "/profile", "/api"] },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
