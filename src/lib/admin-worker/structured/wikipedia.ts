/**
 * Wikipedia REST summary client for structured-knowledge ingestion.
 *
 * Wikidata gives the worker structured facts; Wikipedia's REST summary endpoint
 * gives the narrative fields (a biography, a background paragraph) as a clean
 * lead abstract plus a canonical citation URL. Using the source's own abstract
 * verbatim — with a citation — is MORE accurate for our bar than any
 * paraphrase: there is no invention, and the text is attributable. Defensive +
 * network-gated like the rest of the subsystem; returns null on any failure.
 *
 * Every language edition exposes the same REST shape
 * (`https://{lang}.wikipedia.org/api/rest_v1/page/summary/{title}`), so the
 * client keys off the article URL's host: an it/es/fr/de/pl article is read the
 * same way. Non-English prose is only ever used for CORROBORATION (does the
 * article state the same feast day?) — the published biography stays English.
 */

import { fetchJson } from "./http";
import { parseWikipediaArticleUrl } from "./wikipedia-url";

export { parseWikipediaArticleUrl } from "./wikipedia-url";

export interface WikipediaSummary {
  /** The article's lead abstract (plain text). */
  extract: string;
  /** Canonical article URL, usable as a citation. */
  url: string;
  /** Language edition the abstract came from ("en", "it", …). */
  lang: string;
}

interface RestSummary {
  extract?: string;
  content_urls?: { desktop?: { page?: string } };
}

/**
 * Fetch the lead abstract + canonical URL for a Wikipedia article URL (any
 * language edition, e.g. `https://en.wikipedia.org/wiki/Pope_Francis`). Returns
 * null when the URL isn't a Wikipedia article, the fetch fails, or the abstract
 * is empty.
 */
export async function fetchSummaryForArticleUrl(
  articleUrl: string,
): Promise<WikipediaSummary | null> {
  const parsed = parseWikipediaArticleUrl(articleUrl);
  if (!parsed) return null;
  const api = `https://${parsed.lang}.wikipedia.org/api/rest_v1/page/summary/${parsed.title}`;
  const data = await fetchJson<RestSummary>(api);
  const extract = data?.extract?.trim();
  if (!extract) return null;
  return { extract, url: data?.content_urls?.desktop?.page ?? articleUrl, lang: parsed.lang };
}
