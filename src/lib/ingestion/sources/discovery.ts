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
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
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
 * `baseUrl`, and keeps only links whose host is in the Vatican allowlist.
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
const TITLE_RE = /<title[^>]*>([\s\S]*?)<\/title>/i;
const PARAGRAPH_RE = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;

export type ExtractedDocument = {
  title: string | null;
  description: string | null;
  bodyText: string;
};

/**
 * Pulls the title, meta description, and concatenated paragraph text from an
 * HTML document. Designed to be deterministic and tolerant of the
 * idiosyncratic HTML produced by vatican.va.
 */
export function extractDocument(html: string): ExtractedDocument {
  const titleMatch = html.match(TITLE_RE);
  const title = titleMatch ? decodeEntities(stripTags(titleMatch[1])) : null;

  const descMatch = html.match(META_DESCRIPTION_RE);
  const description = descMatch ? decodeEntities(stripTags(descMatch[1])) : null;

  const paragraphs: string[] = [];
  for (const m of html.matchAll(PARAGRAPH_RE)) {
    const text = decodeEntities(stripTags(m[1]));
    if (text.length > 0) paragraphs.push(text);
  }

  return {
    title,
    description,
    bodyText: paragraphs.join("\n\n").trim(),
  };
}

/**
 * Convenience: only returns a URL if it is allowlisted, otherwise null. Mirrors
 * `gateUrl` from the allowlist module so adapter code can import a single
 * symbol.
 */
export function safeUrl(url: string): string | null {
  return gateUrl(url);
}
