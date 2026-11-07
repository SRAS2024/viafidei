/**
 * Where a visitor may be sent after signing in: a path on this site, nothing else.
 *
 * The value comes from a query string or a form field, so anyone can write it, and a
 * URL parser does not read a path the way it looks. It drops tabs and newlines wherever
 * they fall and reads a backslash as a slash, so "/<TAB>/evil.example" and "/\evil.example"
 * both name another site; and it resolves dot segments, so "/.//evil.example" becomes
 * the path "//evil.example", which is another site again the next time it is resolved.
 * So a list of bad prefixes is not enough. This refuses what no path of ours contains,
 * then resolves the value the way redirectTo() will and checks where it landed.
 */

/** Stands in for this site's origin: only whether the value leaves it matters here. */
const PROBE_ORIGIN = "https://via-fidei.invalid";

/** Far longer than any page on the site; a value this long is not one of our paths. */
const MAX_NEXT_LENGTH = 2048;

const CONTROL_OR_BACKSLASH = /[\u0000-\u001f\u007f\\]/;

/**
 * The value as a safe same-site path, or null. A repeated query parameter arrives as an
 * array, and the first value counts, as it does for the list pages' parameters.
 */
export function safeNextPath(raw: unknown): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string" || !value.startsWith("/")) return null;
  if (value.length > MAX_NEXT_LENGTH || CONTROL_OR_BACKSLASH.test(value)) return null;
  let resolved: URL;
  try {
    resolved = new URL(value, PROBE_ORIGIN);
  } catch {
    return null;
  }
  if (resolved.origin !== PROBE_ORIGIN || resolved.pathname.startsWith("//")) return null;
  return value;
}
