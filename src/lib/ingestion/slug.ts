const SLUG_REPLACE_RE = /[^a-z0-9]+/g;
const SLUG_TRIM_RE = /^-+|-+$/g;

const DIACRITIC_RE = /[̀-ͯ]/g;

export function normalizeSlug(input: string): string {
  return input
    .normalize("NFKD")
    .replace(DIACRITIC_RE, "")
    .toLowerCase()
    .trim()
    .replace(SLUG_REPLACE_RE, "-")
    .replace(SLUG_TRIM_RE, "");
}

export function isSlugUnique(a: string, b: string): boolean {
  return normalizeSlug(a) !== normalizeSlug(b);
}
