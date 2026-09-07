import { appConfig } from "@/lib/config";
import { escapeXml, listSitemapChunks } from "@/lib/data/sitemap";

export const dynamic = "force-dynamic";

const BASE = appConfig.canonicalUrl;

/**
 * The sitemap index. Points at one chunked sitemap per content type (see
 * src/lib/data/sitemap.ts), which is what keeps the site indexable past the
 * 50,000-URL-per-file protocol limit. The URL is unchanged — robots.txt has
 * always named /sitemap.xml — so nothing already registered with Search
 * Console has to be re-submitted.
 */
export async function GET() {
  const chunks = await listSitemapChunks();
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...chunks.map((c) =>
      [
        "  <sitemap>",
        `    <loc>${escapeXml(`${BASE}/sitemaps/${c.key}/${c.chunk}.xml`)}</loc>`,
        `    <lastmod>${c.lastModified.toISOString()}</lastmod>`,
        "  </sitemap>",
      ].join("\n"),
    ),
    "</sitemapindex>",
    "",
  ].join("\n");

  return new Response(body, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
