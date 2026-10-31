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

import { fetchJson, type SourceReadLedger } from "./http";
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
 * is empty; a fetch that failed transiently is recorded in `opts.ledger`.
 */
export async function fetchSummaryForArticleUrl(
  articleUrl: string,
  opts: { ledger?: SourceReadLedger } = {},
): Promise<WikipediaSummary | null> {
  const parsed = parseWikipediaArticleUrl(articleUrl);
  if (!parsed) return null;
  const api = `https://${parsed.lang}.wikipedia.org/api/rest_v1/page/summary/${parsed.title}`;
  const data = await fetchJson<RestSummary>(api, { ledger: opts.ledger });
  const extract = data?.extract?.trim();
  if (!extract) return null;
  return { extract, url: data?.content_urls?.desktop?.page ?? articleUrl, lang: parsed.lang };
}

interface IntroResponse {
  query?: { pages?: Array<{ extract?: string; missing?: boolean }> };
}

/**
 * The article's whole INTRODUCTION as plain text — every lead paragraph, with
 * the parenthetical names and dates — from the Action API's TextExtracts. The
 * REST summary above is only the first paragraph with its parentheses removed,
 * which leaves many saints under the 100-character biography floor: Eugendus's
 * summary is "Eugendus was the fourth abbot of Condat Abbey, at Saint-Claude,
 * Jura." (69 characters). Null when unavailable; a read that failed
 * transiently is recorded in `opts.ledger`.
 */
export async function fetchIntroForArticleUrl(
  articleUrl: string,
  opts: { ledger?: SourceReadLedger } = {},
): Promise<string | null> {
  const parsed = parseWikipediaArticleUrl(articleUrl);
  if (!parsed) return null;
  let title: string;
  try {
    title = decodeURIComponent(parsed.title);
  } catch {
    title = parsed.title;
  }
  const api =
    `https://${parsed.lang}.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1` +
    `&explaintext=1&redirects=1&format=json&formatversion=2&titles=${encodeURIComponent(title)}`;
  const data = await fetchJson<IntroResponse>(api, { ledger: opts.ledger });
  const extract = data?.query?.pages?.[0]?.extract?.trim();
  return extract ? extract : null;
}
