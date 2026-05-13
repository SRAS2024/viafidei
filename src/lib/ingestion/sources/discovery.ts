import { gateUrl, isApprovedUrl } from "./vatican-allowlist";

const ANCHOR_RE = /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
const TAG_RE = /<[^>]+>/g;
const WHITESPACE_RE = /\s+/g;

export type DiscoveredLink = {
  url: string;
  text: string;
};

function stripTags(html: string): string {
  return html.replace(TAG_RE, "").replace(WHITESPACE_RE, " ").trim();
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(parseInt(num, 10)));
}

function resolveUrl(href: string, baseUrl: string): string | null {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

/**
 * Extracts every anchor link from an HTML page, resolves each href against
 * `baseUrl`, and keeps only links whose host is in the credibility allowlist.
 *
 * Returns a deduped list — duplicate URLs in the same page are collapsed.
 */
export function extractApprovedLinks(html: string, baseUrl: string): DiscoveredLink[] {
  const seen = new Set<string>();
  const out: DiscoveredLink[] = [];
  for (const match of html.matchAll(ANCHOR_RE)) {
    const rawHref = match[1];
    const inner = decodeEntities(stripTags(match[2] ?? ""));
    const resolved = resolveUrl(rawHref, baseUrl);
    if (!resolved) continue;
    if (!isApprovedUrl(resolved)) continue;
    if (seen.has(resolved)) continue;
    seen.add(resolved);
    out.push({ url: resolved, text: inner });
  }
  return out;
}

const META_DESCRIPTION_RE =
  /<meta\b[^>]*\bname\s*=\s*["']description["'][^>]*\bcontent\s*=\s*["']([^"']+)["'][^>]*\/?>/i;
const OG_DESCRIPTION_RE =
  /<meta\b[^>]*\bproperty\s*=\s*["']og:description["'][^>]*\bcontent\s*=\s*["']([^"']+)["'][^>]*\/?>/i;
const TITLE_RE = /<title[^>]*>([\s\S]*?)<\/title>/i;

// Strip wholesale before walking content blocks so we never collect
// boilerplate from nav menus, scripts, styles, or footers.
const STRIP_BLOCKS_RE = [
  /<script\b[\s\S]*?<\/script>/gi,
  /<style\b[\s\S]*?<\/style>/gi,
  /<noscript\b[\s\S]*?<\/noscript>/gi,
  /<header\b[\s\S]*?<\/header>/gi,
  /<footer\b[\s\S]*?<\/footer>/gi,
  /<nav\b[\s\S]*?<\/nav>/gi,
  /<aside\b[\s\S]*?<\/aside>/gi,
  /<form\b[\s\S]*?<\/form>/gi,
  /<!--[\s\S]*?-->/g,
];

// Block-level tags whose text content is worth collecting. A recursive
// walker pulls innerText from each, joined by paragraph breaks. This is
// much more tolerant of modern CMS HTML (vatican.va's mix of <div> /
// <section>, USCCB's React-ish output) than the old <p>-only collector.
const BLOCK_TAG_RE =
  /<(?:p|article|section|main|li|blockquote|figcaption|h[1-6]|div(?:\s+class=["'][^"']*(?:body|content|article|post|prose|main|text)[^"']*["'])?)\b[^>]*>([\s\S]*?)<\/(?:p|article|section|main|li|blockquote|figcaption|h[1-6]|div)>/gi;

export type ExtractedDocument = {
  title: string | null;
  description: string | null;
  bodyText: string;
};

function preprocess(html: string): string {
  let out = html;
  for (const re of STRIP_BLOCKS_RE) out = out.replace(re, " ");
  // Convert <br> to newline so block-text collapsing keeps line breaks.
  out = out.replace(/<br\s*\/?\s*>/gi, "\n");
  return out;
}

function collectBlockText(html: string): string {
  const blocks: string[] = [];
  const seen = new Set<string>();
  // Capture every block-level region's text. Nested blocks are dropped
  // when their parent already emitted them (Set-based dedup on the
  // exact text run keeps the final output clean).
  for (const m of html.matchAll(BLOCK_TAG_RE)) {
    const inner = decodeEntities(stripTags(m[1]));
    if (!inner) continue;
    if (inner.length < 3) continue;
    if (seen.has(inner)) continue;
    seen.add(inner);
    blocks.push(inner);
  }
  if (blocks.length === 0) {
    // Fall back to whole-body stripped text so even unstructured pages
    // surface SOMETHING for the validator to judge.
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const raw = bodyMatch ? bodyMatch[1] : html;
    const text = decodeEntities(stripTags(raw));
    return text.length > 0 ? text : "";
  }
  return blocks.join("\n\n").trim();
}

/**
 * Pulls the title, meta description, and concatenated readable text from an
 * HTML document. Designed to tolerate the wide range of HTML shapes the
 * Catholic web produces — from vatican.va's nested <div> trees to USCCB's
 * modern CMS output to plain static pages on smaller diocesan sites.
 */
export function extractDocument(html: string): ExtractedDocument {
  const titleMatch = html.match(TITLE_RE);
  const title = titleMatch ? decodeEntities(stripTags(titleMatch[1])) : null;

  const descMatch = html.match(META_DESCRIPTION_RE) ?? html.match(OG_DESCRIPTION_RE);
  const description = descMatch ? decodeEntities(stripTags(descMatch[1])) : null;

  const cleaned = preprocess(html);
  const bodyText = collectBlockText(cleaned);

  return { title, description, bodyText };
}

/**
 * Convenience: only returns a URL if it is allowlisted, otherwise null.
 */
export function safeUrl(url: string): string | null {
  return gateUrl(url);
}

/**
 * Parse a sitemap.xml document (or sitemap-index) and return the contained
 * <loc> URLs that are inside the credibility allowlist.
 *
 * Handles both shapes:
 *   <urlset><url><loc>...</loc></url></urlset>
 *   <sitemapindex><sitemap><loc>...</loc></sitemap></sitemapindex>
 *
 * For sitemap indexes the caller should recursively fetch each child
 * sitemap; the function only flattens what it sees.
 */
export function extractSitemapUrls(xml: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const LOC_RE = /<loc>([\s\S]*?)<\/loc>/gi;
  for (const m of xml.matchAll(LOC_RE)) {
    const raw = decodeEntities(m[1].trim());
    if (!raw) continue;
    if (!isApprovedUrl(raw)) continue;
    if (seen.has(raw)) continue;
    seen.add(raw);
    out.push(raw);
  }
  return out;
}

/**
 * True when the XML body looks like a sitemap *index* (i.e. references
 * other sitemap files rather than page URLs directly). Used so the
 * sitemap discovery can recurse only when needed.
 */
export function isSitemapIndex(xml: string): boolean {
  return /<sitemapindex\b/i.test(xml);
}
