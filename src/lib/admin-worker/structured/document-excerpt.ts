/**
 * Verbatim document-excerpt extraction for CHURCH_DOCUMENT enrichment.
 *
 * The church-document schema has an optional `bodyExcerpt` whose accuracy rule
 * is "verbatim text with provenance only". The ingestor already knows each
 * document's canonical URL (usually the actual vatican.va text); this tool
 * fetches that page and extracts the opening paragraphs of the document body —
 * verbatim, deterministically, with the canonical URL as provenance — so the
 * published record carries real document text, not just bibliographic metadata.
 *
 * Conservative by construction: it only accepts long, prose-like <p> paragraphs
 * (navigation chrome, copyright lines, link lists are filtered out), and when
 * the page yields nothing it confidently returns null — the record simply ships
 * without an excerpt. Zero fabrication surface: every character comes from the
 * fetched page.
 */

import { htmlToText } from "../communion-verifier";
import { fetchText } from "./http";

const MIN_PARAGRAPH_CHARS = 120;
const MAX_EXCERPT_CHARS = 1_200;
const MIN_EXCERPT_CHARS = 200;

/** Chrome/navigation paragraph markers — never part of the document body. */
const CHROME_PATTERNS: RegExp[] = [
  /copyright|©|all rights reserved/i,
  /cookie|privacy policy|terms of (use|service)/i,
  /\bmenu\b|\bsearch\b|\bback to top\b|\bskip to\b/i,
  /\bindex\b\s*$/i,
  /^\s*\[/,
];

/**
 * Pull the opening body paragraphs out of a document page's HTML — verbatim.
 * Returns null when no confident prose paragraphs are found. Pure; exported
 * for testing.
 */
export function extractExcerptFromHtml(html: string): string | null {
  if (!html) return null;
  // Drop script/style wholesale, then walk <p> blocks in document order.
  const cleaned = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ");
  const paragraphs: string[] = [];
  const re = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cleaned)) !== null) {
    const text = htmlToText(m[1]);
    if (text.length < MIN_PARAGRAPH_CHARS) continue;
    if (CHROME_PATTERNS.some((p) => p.test(text))) continue;
    paragraphs.push(text);
    // The opening of the document body is enough for an excerpt.
    if (paragraphs.join(" ").length >= MAX_EXCERPT_CHARS) break;
  }
  if (paragraphs.length === 0) return null;
  let excerpt = paragraphs.join("\n\n");
  if (excerpt.length > MAX_EXCERPT_CHARS) {
    // Cut at a sentence boundary inside the limit when possible.
    const slice = excerpt.slice(0, MAX_EXCERPT_CHARS);
    const lastStop = slice.lastIndexOf(". ");
    excerpt = lastStop > MIN_EXCERPT_CHARS ? slice.slice(0, lastStop + 1) : slice;
  }
  return excerpt.length >= MIN_EXCERPT_CHARS ? excerpt : null;
}

/**
 * Fetch a document's canonical page and return a verbatim opening excerpt, or
 * null (offline/disabled, fetch failed, or no confident prose found).
 */
export async function fetchDocumentExcerpt(canonicalUrl: string): Promise<string | null> {
  const html = await fetchText(canonicalUrl);
  if (!html) return null;
  try {
    return extractExcerptFromHtml(html);
  } catch {
    return null;
  }
}
