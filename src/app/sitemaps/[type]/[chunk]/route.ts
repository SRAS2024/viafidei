import { appConfig } from "@/lib/config";
import { escapeXml, listSitemapUrls } from "@/lib/data/sitemap";

export const dynamic = "force-dynamic";

const BASE = appConfig.canonicalUrl;

/**
 * One chunk of the sitemap: at most SITEMAP_CHUNK_SIZE URLs for one content
 * type. `[chunk]` carries a ".xml" suffix so crawlers see a file-shaped URL
 * (/sitemaps/saint/0.xml). An unknown type or an out-of-range chunk returns a
 * valid, empty `<urlset>` rather than a 404 — a crawler that guessed a URL
 * should not see an error.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ type: string; chunk: string }> },
) {
  const { type, chunk } = await ctx.params;
  const index = Number.parseInt(chunk.replace(/\.xml$/i, ""), 10);
  const urls = await listSitemapUrls(type.toLowerCase(), Number.isFinite(index) ? index : 0);

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((u) =>
      [
        "  <url>",
        `    <loc>${escapeXml(`${BASE}${u.loc}`)}</loc>`,
        `    <lastmod>${u.lastModified.toISOString()}</lastmod>`,
        `    <changefreq>${u.changeFrequency}</changefreq>`,
        `    <priority>${u.priority}</priority>`,
        "  </url>",
      ].join("\n"),
    ),
    "</urlset>",
    "",
  ].join("\n");

  return new Response(body, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
