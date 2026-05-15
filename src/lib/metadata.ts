import type { Metadata } from "next";
import { appConfig } from "@/lib/config";

/**
 * Strip a single trailing slash. The canonical URL helpers all return
 * paths without one so the join below stays predictable
 * (`canonicalUrlFor("/")` → `https://etviafidei.com/`).
 */
function trimTrailingSlash(value: string): string {
  return value.endsWith("/") && value.length > 1 ? value.slice(0, -1) : value;
}

/**
 * Build an absolute canonical URL for a public route. Always anchored at
 * `appConfig.canonicalUrl` (the centralised production domain) so every
 * public page renders the same canonical even if the request arrived via
 * a preview / staging host.
 *
 * Pass paths that start with `/`. The function returns the joined URL
 * without inserting double slashes or losing the leading `/`.
 */
export function canonicalUrlFor(path: string): string {
  if (typeof path !== "string") return appConfig.canonicalUrl;
  const base = trimTrailingSlash(appConfig.canonicalUrl);
  if (!path || path === "/") return `${base}/`;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export type DetailMetadataInput = {
  /** Path relative to the canonical site, e.g. "/prayers/anima-christi". */
  path: string;
  /** Page title rendered in the browser tab + Open Graph title. */
  title: string;
  /** Optional one-line description for OG / Twitter cards + meta description. */
  description?: string;
  /**
   * Optional image used by Open Graph / Twitter previews. Provide a fully
   * qualified URL — relative paths are not joined to the canonical base
   * because OG image consumers (Slack, iMessage, etc.) require absolute.
   */
  imageUrl?: string;
};

/**
 * Build the Metadata object for a public detail page. Centralises the
 * canonical / Open Graph contract so every detail page surfaces a
 * consistent shape:
 *
 *   - alternates.canonical points at `${canonicalUrl}${path}`.
 *   - openGraph.url matches the canonical so social shares render the
 *     production URL even when the request hit a preview host.
 *   - openGraph.siteName + type are pinned to the brand defaults so
 *     individual pages don't drift on those fields.
 *   - openGraph.images is set only when an explicit imageUrl is given
 *     (Open Graph clients fall back to the site-wide default otherwise).
 *
 * Any field can be overridden by spreading additional properties into the
 * caller's returned object — this helper builds the baseline.
 */
export function buildDetailMetadata(input: DetailMetadataInput): Metadata {
  const { path, title, description, imageUrl } = input;
  const canonical = canonicalUrlFor(path);
  const meta: Metadata = {
    title,
    alternates: { canonical: path.startsWith("/") ? path : `/${path}` },
    openGraph: {
      title,
      url: canonical,
      siteName: "Via Fidei",
      type: "article",
      ...(description ? { description } : {}),
      ...(imageUrl ? { images: [{ url: imageUrl }] } : {}),
    },
    ...(description ? { description } : {}),
    twitter: {
      card: imageUrl ? "summary_large_image" : "summary",
      title,
      ...(description ? { description } : {}),
      ...(imageUrl ? { images: [imageUrl] } : {}),
    },
  };
  return meta;
}

/**
 * Stable not-found Metadata. Used by detail pages whose row was not
 * resolved at render time so the resulting <title> is always the same
 * "Not Found" string and the canonical points back at the index.
 */
export function notFoundMetadataFor(indexPath: string): Metadata {
  return {
    title: "Not Found",
    alternates: { canonical: indexPath.startsWith("/") ? indexPath : `/${indexPath}` },
    robots: { index: false, follow: false },
  };
}
