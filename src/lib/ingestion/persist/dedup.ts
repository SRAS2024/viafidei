import type { IngestedItem } from "../types";
import { normalizeSlug } from "../slug";

/**
 * Strips fragments / trailing slashes / known tracking params so two ingest
 * passes that found the same URL through different index pages collapse onto
 * one externalSourceKey.
 */
export function normalizeExternalKey(input: string | undefined | null): string | undefined {
  if (!input) return undefined;
  const trimmed = input.trim();
  if (!trimmed) return undefined;
  try {
    const url = new URL(trimmed);
    url.hash = "";
    const stripParams = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];
    for (const k of stripParams) url.searchParams.delete(k);
    let path = url.pathname.replace(/\/+$/, "");
    if (!path) path = "/";
    return `${url.protocol}//${url.host.toLowerCase()}${path}${url.search}`;
  } catch {
    return trimmed;
  }
}

/**
 * Deduplicates a freshly-fetched batch in-memory before any DB writes happen.
 *
 * Two records collide when EITHER their normalized externalSourceKey OR their
 * normalized slug matches. The first occurrence wins; subsequent duplicates
 * are dropped. This stops a single crawler run from inserting the same prayer
 * twice when the same document is reachable via multiple index pages.
 */
export function dedupeBatch(items: IngestedItem[]): IngestedItem[] {
  const seenKeys = new Set<string>();
  const seenSlugs = new Set<string>();
  const out: IngestedItem[] = [];

  for (const item of items) {
    const key = normalizeExternalKey(item.externalSourceKey);
    const slug = `${item.kind}:${normalizeSlug(item.slug)}`;

    if (key && seenKeys.has(key)) continue;
    if (seenSlugs.has(slug)) continue;

    if (key) seenKeys.add(key);
    seenSlugs.add(slug);

    out.push(key ? { ...item, externalSourceKey: key } : item);
  }

  return out;
}
