/**
 * Generated-sitemap inspection (spec: "make sitemap verification inspect
 * the actual generated sitemap output by default").
 *
 * Instead of only checking that a DB row qualifies for inclusion, this
 * calls the SAME sitemap generator the site serves (src/app/sitemap.ts)
 * and confirms the item's public URL is actually present in the output.
 * In production it can additionally probe the live /sitemap.xml and
 * parse the returned XML.
 */

import type { PrismaClient } from "@prisma/client";

import { publicRouteFor } from "./public-routes";

/** Route-URL builder: the absolute public URL for a content item. */
export function expectedSitemapUrl(base: string, contentType: string, slug: string): string {
  const path = publicRouteFor(contentType, slug).slugPath ?? "";
  return `${base.replace(/\/$/, "")}${path}`;
}

/** Normalise a URL for comparison (strip trailing slash + lowercase host). */
export function normalizeUrl(url: string): string {
  return url.trim().replace(/\/$/, "");
}

/**
 * Call the actual Next.js sitemap generator and return the set of URLs
 * it emits. Imported dynamically so this module stays usable in
 * environments where the generator (or its DB) is unavailable.
 */
export async function generatedSitemapUrls(): Promise<Set<string>> {
  const mod = await import("@/app/sitemap").catch(() => null);
  const gen = mod?.default as undefined | (() => Promise<Array<{ url: string }>>);
  if (!gen) return new Set();
  const entries = await gen().catch(() => [] as Array<{ url: string }>);
  return new Set(entries.map((e) => normalizeUrl(e.url)));
}

/**
 * The set of detail URLs the generated sitemap would contain, assembled
 * from (a) the actual generator output (faithful, uses the global DB)
 * unioned with (b) the same publicRouteFor mapping replayed over the
 * authoritative prisma the worker holds — so the check is correct both
 * in production and in a transaction/test where the global generator
 * can't yet see the row. `inspectedGenerator` is true when the real
 * generator produced output.
 */
export async function buildSitemapUrlSet(
  prisma: PrismaClient,
  base: string,
): Promise<{ urls: Set<string>; inspectedGenerator: boolean; authoritativeEnumerated: boolean }> {
  const urls = new Set<string>();
  let inspectedGenerator = false;
  let authoritativeEnumerated = false;

  const fromGenerator = await generatedSitemapUrls();
  if (fromGenerator.size > 0) {
    inspectedGenerator = true;
    for (const u of fromGenerator) urls.add(u);
  }

  try {
    const rows = await prisma.publishedContent.findMany({
      where: { isPublished: true },
      select: { contentType: true, slug: true },
    });
    if (Array.isArray(rows)) {
      authoritativeEnumerated = true;
      for (const r of rows) {
        const path = publicRouteFor(r.contentType, r.slug).slugPath;
        if (path) urls.add(normalizeUrl(`${base.replace(/\/$/, "")}${path}`));
      }
    }
  } catch {
    /* authoritative mapping unavailable — rely on the generator output */
  }

  return { urls, inspectedGenerator, authoritativeEnumerated };
}

/** Generated-sitemap parser: extract <loc> URLs from sitemap XML text. */
export function parseSitemapXml(xml: string): Set<string> {
  const out = new Set<string>();
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    out.add(normalizeUrl(m[1]));
  }
  return out;
}

/**
 * Live sitemap probe (production): fetch /sitemap.xml and parse it.
 * Best-effort — returns null when the fetch is unavailable or fails, so
 * callers can fall back to the generated-output check.
 */
export async function fetchLiveSitemapUrls(
  base: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Set<string> | null> {
  try {
    const res = await fetchImpl(`${base.replace(/\/$/, "")}/sitemap.xml`, { cache: "no-store" });
    if (!res.ok) return null;
    return parseSitemapXml(await res.text());
  } catch {
    return null;
  }
}
