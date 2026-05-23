/**
 * Canonical slug generation for the checklist-first worker.
 *
 * Every checklist item, citation, and published row uses a slug produced
 * here. Slugs are lowercase, ASCII, dash-separated, and stable across
 * renames (renames create aliases instead).
 */

/**
 * Convert input to a canonical URL slug:
 *   - lowercase
 *   - strip diacritics
 *   - drop possessive apostrophes
 *   - replace non-alphanumeric with single dash
 *   - collapse repeated dashes
 *   - trim leading/trailing dashes
 */
export function canonicalizeSlug(input: string): string {
  if (!input) return "";
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]s\b/g, "s")
    .replace(/['’]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Normalize text for fuzzy comparison: strip diacritics, lowercase,
 * collapse whitespace, remove leading "Saint"/"St."/"St" prefixes, drop
 * apostrophes and punctuation.
 */
export function normalizeForComparison(input: string): string {
  if (!input) return "";
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/^\s*(saint|st\.?|the)\s+/i, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Build a deterministic slug suggestion from a canonical name. Useful when
 * seeding new checklist items or when extracting a slug from a fetched
 * source title.
 */
export function suggestSlug(name: string): string {
  return canonicalizeSlug(name);
}

/**
 * Append a numeric suffix to disambiguate duplicate slugs (slug, slug-2,
 * slug-3, ...).
 */
export function withSuffix(slug: string, n: number): string {
  if (n <= 1) return slug;
  return `${slug}-${n}`;
}
