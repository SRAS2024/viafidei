/**
 * Wikipedia article-URL parsing, kept in its own dependency-free module so the
 * summary client and the infobox reader can share it without either importing
 * the other (tests mock those two modules independently).
 */

/** Language subdomain + title of a `https://xx.wikipedia.org/wiki/Title` URL. */
export function parseWikipediaArticleUrl(
  articleUrl: string,
): { lang: string; title: string } | null {
  const m = articleUrl.match(/^https?:\/\/([a-z-]+)\.(?:m\.)?wikipedia\.org\/wiki\/(.+)$/i);
  if (!m) return null;
  return { lang: m[1].toLowerCase(), title: m[2] };
}
