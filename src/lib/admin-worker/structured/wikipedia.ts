/**
 * Wikipedia REST summary client for structured-knowledge ingestion.
 *
 * Wikidata gives the worker structured facts; Wikipedia's REST summary endpoint
 * gives the narrative fields (a biography, a background paragraph) as a clean
 * lead abstract plus a canonical citation URL. Using the source's own abstract
 * verbatim — with a citation — is MORE accurate for our bar than any
 * paraphrase: there is no invention, and the text is attributable. Defensive +
 * network-gated like the rest of the subsystem; returns null on any failure.
 */

import { fetchJson } from "./http";

export interface WikipediaSummary {
  /** The article's lead abstract (plain text). */
  extract: string;
  /** Canonical article URL, usable as a citation. */
  url: string;
}

interface RestSummary {
  extract?: string;
  content_urls?: { desktop?: { page?: string } };
}

/**
 * Fetch the lead abstract + canonical URL for an English Wikipedia article URL
 * (e.g. `https://en.wikipedia.org/wiki/Pope_Francis`). Returns null when the
 * URL isn't an enwiki article, the fetch fails, or the abstract is empty.
 */
export async function fetchSummaryForArticleUrl(
  articleUrl: string,
): Promise<WikipediaSummary | null> {
  const m = articleUrl.match(/\/wiki\/(.+)$/);
  if (!m) return null;
  const title = m[1];
  const api = `https://en.wikipedia.org/api/rest_v1/page/summary/${title}`;
  const data = await fetchJson<RestSummary>(api);
  const extract = data?.extract?.trim();
  if (!extract) return null;
  return { extract, url: data?.content_urls?.desktop?.page ?? articleUrl };
}
