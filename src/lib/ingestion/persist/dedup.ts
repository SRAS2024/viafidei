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
 * Reduce a website URL to a stable identity for deduplication.
 *
 * Trims scheme, www., trailing slash, and lowercases the host. So
 * "https://www.stmary.org/" and "http://stmary.org" collapse onto the
 * same identity.
 */
export function normalizeWebsiteIdentity(input: string | undefined | null): string | undefined {
  if (!input) return undefined;
  const trimmed = input.trim();
  if (!trimmed) return undefined;
  try {
    const url = new URL(trimmed);
    const host = url.host.toLowerCase().replace(/^www\./, "");
    let path = url.pathname.replace(/\/+$/, "");
    if (path === "") path = "/";
    return `${host}${path}`;
  } catch {
    return trimmed.toLowerCase();
  }
}

/**
 * Normalize a parish-level identity tuple so we can compare two parish
 * records that came from different sources but represent the same place.
 *
 * The output is a single deterministic string built from the normalized
 * parish name + city + state/region + country. Empty fields are dropped.
 */
export function normalizeParishIdentity(parts: {
  name?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
}): string | undefined {
  const name = parts.name ? normalizeSlug(parts.name) : "";
  if (!name) return undefined;
  const segs = [
    name,
    parts.city ? normalizeSlug(parts.city) : "",
    parts.region ? normalizeSlug(parts.region) : "",
    parts.country ? normalizeSlug(parts.country) : "",
  ].filter((s) => s.length > 0);
  return segs.join("|");
}

/**
 * Deduplicates a freshly-fetched batch in-memory before any DB writes happen.
 *
 * Two records collide when ANY of the following match for the same kind:
 *   - normalized externalSourceKey
 *   - normalized slug
 *   - normalized title / name (prayers, saints)
 *   - normalized website identity (parishes)
 *   - normalized parish identity tuple: name + city + region + country
 *
 * The first occurrence wins; subsequent duplicates are dropped. This stops a
 * single crawler run from inserting the same prayer twice when the same
 * document is reachable via multiple index pages.
 */
export function dedupeBatch(items: IngestedItem[]): IngestedItem[] {
  const seenKeys = new Set<string>();
  const seenSlugs = new Set<string>();
  const seenTitles = new Set<string>();
  const seenWebsites = new Set<string>();
  const seenParishIdents = new Set<string>();
  const out: IngestedItem[] = [];

  for (const item of items) {
    const key = normalizeExternalKey(item.externalSourceKey);
    const slug = `${item.kind}:${normalizeSlug(item.slug)}`;
    const titleKey = titleIdentityFor(item);
    const websiteKey =
      item.kind === "parish" && item.websiteUrl
        ? `parish:${normalizeWebsiteIdentity(item.websiteUrl)}`
        : null;
    const parishIdent =
      item.kind === "parish"
        ? normalizeParishIdentity({
            name: item.name,
            city: item.city,
            region: item.region,
            country: item.country,
          })
        : undefined;
    const parishKey = parishIdent ? `parish:${parishIdent}` : null;

    if (key && seenKeys.has(key)) continue;
    if (seenSlugs.has(slug)) continue;
    if (titleKey && seenTitles.has(titleKey)) continue;
    if (websiteKey && seenWebsites.has(websiteKey)) continue;
    if (parishKey && seenParishIdents.has(parishKey)) continue;

    if (key) seenKeys.add(key);
    seenSlugs.add(slug);
    if (titleKey) seenTitles.add(titleKey);
    if (websiteKey) seenWebsites.add(websiteKey);
    if (parishKey) seenParishIdents.add(parishKey);

    out.push(key ? { ...item, externalSourceKey: key } : item);
  }

  return out;
}

function titleIdentityFor(item: IngestedItem): string | null {
  switch (item.kind) {
    case "prayer":
      return item.defaultTitle ? `prayer:title:${normalizeSlug(item.defaultTitle)}` : null;
    case "saint":
      return item.canonicalName ? `saint:name:${normalizeSlug(item.canonicalName)}` : null;
    case "apparition":
      return item.title ? `apparition:title:${normalizeSlug(item.title)}` : null;
    case "devotion":
      return item.title ? `devotion:title:${normalizeSlug(item.title)}` : null;
    case "liturgy":
      return item.title ? `liturgy:title:${normalizeSlug(item.title)}` : null;
    case "guide":
      return item.title ? `guide:title:${normalizeSlug(item.title)}` : null;
    case "parish":
      // Parishes use the more discriminating identity tuple above; their
      // bare name collides for common dedications (Saint Mary's, etc.).
      return null;
  }
}
