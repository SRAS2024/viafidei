import type { MetadataRoute } from "next";

import { appConfig } from "@/lib/config";
import { PUBLIC_STATIC_PATHS, listSitemapChunks, listSitemapUrls } from "@/lib/data/sitemap";

/**
 * Compatibility shim for the Admin Worker's sitemap inspector.
 *
 * /sitemap.xml is now a sitemap INDEX (src/app/sitemap.xml/route.ts) pointing
 * at chunked per-type sitemaps, because one `<urlset>` cannot hold the
 * directory's target of >200,000 URLs. The worker's post-publish verifier
 * (src/lib/admin-worker/sitemap-inspect.ts) still imports `@/app/sitemap` and
 * calls its default export to get "every URL the sitemap would emit", so that
 * entry point is preserved here — flattened across the chunks — until that
 * module is pointed at `@/lib/data/sitemap` directly.
 *
 * This is a plain module inside the app directory, not a route: Next.js only
 * treats a `sitemap.ts` FILE at the app root as the sitemap metadata route, so
 * `sitemap/index.ts` adds no route and cannot collide with the index handler.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = appConfig.canonicalUrl;
  const now = new Date();
  const entries: MetadataRoute.Sitemap = PUBLIC_STATIC_PATHS.map((p) => ({
    url: `${base}${p.path}`,
    lastModified: now,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));

  for (const chunk of await listSitemapChunks()) {
    if (chunk.key === "pages") continue;
    for (const url of await listSitemapUrls(chunk.key, chunk.chunk)) {
      entries.push({
        url: `${base}${url.loc}`,
        lastModified: url.lastModified,
        changeFrequency: "weekly",
        priority: url.priority,
      });
    }
  }
  return entries;
}
