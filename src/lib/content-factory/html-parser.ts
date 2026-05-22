/**
 * HTML source parser.
 *
 * Source fetch stores raw page text in `SourceDocument.rawBody`, but
 * builders and the content type router need STRUCTURED content — not
 * navigation, footers, event widgets, donation calls-to-action, share
 * buttons, and other site chrome. The orchestrator already calls
 * `cleanSourceBody()` to drop line-level noise; this parser runs BEFORE
 * that, when the input is raw HTML, and extracts:
 *
 *   - title         (from <title>, <meta og:title>, schema.org Article)
 *   - description   (meta description / og:description)
 *   - canonical URL (<link rel="canonical">)
 *   - og:type / schema:type (when present)
 *   - h1..h6 headings as a flat list with level
 *   - main / article body text
 *   - paragraphs
 *   - list items
 *
 * Heuristics:
 *
 *   1. Wholesale-drop entire elements that NEVER contribute body text
 *      (script, style, nav, footer, header, aside, form, iframe,
 *      noscript). Comments are stripped.
 *   2. After stripping, prefer text inside `<main>` or `<article>` —
 *      that's where modern Catholic CMSes (USCCB, vaticannews, etc.)
 *      put the real content. Fall back to <body> when neither
 *      element is present.
 *   3. Inside the chosen container, drop blocks whose text matches
 *      noisy phrases (donate / subscribe / newsletter / register /
 *      livestream / share this / related articles / upcoming events /
 *      cookie / advertisement).
 *   4. Emit headings as a separate array AND inline them into the
 *      paragraph stream as `# H` markdown so the existing
 *      `cleanSourceBody` heading parser still sees them.
 *
 * The parser is deliberately conservative — when a section can't be
 * positively identified, the text is kept rather than dropped. The
 * wrong-content detector and content type router catch anything that
 * survives.
 */

export type ParsedHtmlDocument = {
  /** Extracted page title (prefers <title>, then og:title, then h1). */
  title: string | null;
  /** Meta description or og:description (whichever appears first). */
  description: string | null;
  /** Canonical URL from <link rel="canonical"> when present. */
  canonicalUrl: string | null;
  /** og:title when present (kept separately so callers can compare). */
  ogTitle: string | null;
  /** og:type / schema.org type when present. */
  schemaType: string | null;
  /** Flat heading list, in document order. */
  headings: Array<{ level: number; text: string }>;
  /** Body paragraphs, in document order. */
  paragraphs: string[];
  /** List items, in document order (one per <li>). */
  listItems: string[];
  /**
   * Cleaned body text suitable to store as `rawBody` going into
   * `cleanSourceBody`. Headings are inlined as `# H1` so the
   * downstream parser still extracts them. Empty when the page
   * has no usable body (router should treat as `empty_cleaned_body`).
   */
  cleanedText: string;
  /** Parser version — bumped whenever the parser logic changes. */
  parserVersion: string;
};

export const HTML_PARSER_VERSION = "1.0.0";

const TAG_RE = /<[^>]+>/g;
const WHITESPACE_RE = /\s+/g;

// Drop wholesale before any extraction. These never contribute body
// text and including them in the cleaned body would pollute every
// downstream signal.
const DROP_ELEMENT_RE: ReadonlyArray<RegExp> = [
  /<script\b[\s\S]*?<\/script>/gi,
  /<style\b[\s\S]*?<\/style>/gi,
  /<noscript\b[\s\S]*?<\/noscript>/gi,
  /<header\b[\s\S]*?<\/header>/gi,
  /<footer\b[\s\S]*?<\/footer>/gi,
  /<nav\b[\s\S]*?<\/nav>/gi,
  /<aside\b[\s\S]*?<\/aside>/gi,
  /<form\b[\s\S]*?<\/form>/gi,
  /<iframe\b[\s\S]*?<\/iframe>/gi,
  /<!--[\s\S]*?-->/g,
];

// Block-level text where the noisy phrase appears means the entire
// block is site chrome, not content. The detector is loose on
// purpose — `donate now` in the middle of a paragraph about a saint
// who donated to the poor will survive cleaning later, but a
// `donate` paragraph with no surrounding context is dropped.
const NOISY_BLOCK_PHRASES: ReadonlyArray<RegExp> = [
  /\bdonate\s+(?:now|today|here)\b/i,
  /\b(?:give|make)\s+a\s+(?:gift|donation)\b/i,
  /\b(?:subscribe|sign\s+up)\s+(?:to|for)\s+(?:our|the)\s+newsletter\b/i,
  /\bnewsletter\s+(?:signup|sign[- ]up)\b/i,
  /\bregister\s+(?:now|today|here)\b/i,
  /\b(?:livestream|live\s+stream|watch\s+live)\b/i,
  /\bshare\s+(?:this|on\s+(?:facebook|twitter|x))\b/i,
  /\brelated\s+articles?\b/i,
  /\bupcoming\s+events?\b/i,
  /\bcookie\s+(?:policy|notice|preferences|consent)\b/i,
  /\baccept\s+cookies?\b/i,
  /\b(?:advertisement|sponsored\s+(?:content|by))\b/i,
];

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

function stripTagsToText(html: string): string {
  return decodeEntities(html.replace(TAG_RE, " ").replace(WHITESPACE_RE, " ").trim());
}

function stripDropElements(html: string): string {
  let out = html;
  for (const re of DROP_ELEMENT_RE) out = out.replace(re, " ");
  return out;
}

function matchOgMeta(html: string, key: string): string | null {
  const re = new RegExp(
    `<meta\\b[^>]*\\bproperty\\s*=\\s*["']${key.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}["'][^>]*\\bcontent\\s*=\\s*["']([^"']+)["']`,
    "i",
  );
  const m = html.match(re);
  return m ? decodeEntities(m[1].trim()) : null;
}

function matchMetaByName(html: string, name: string): string | null {
  const re = new RegExp(
    `<meta\\b[^>]*\\bname\\s*=\\s*["']${name.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}["'][^>]*\\bcontent\\s*=\\s*["']([^"']+)["']`,
    "i",
  );
  const m = html.match(re);
  return m ? decodeEntities(m[1].trim()) : null;
}

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) return null;
  const text = stripTagsToText(m[1]);
  return text.length > 0 ? text : null;
}

function extractCanonical(html: string): string | null {
  const m = html.match(
    /<link\b[^>]*\brel\s*=\s*["']canonical["'][^>]*\bhref\s*=\s*["']([^"']+)["']/i,
  );
  if (!m) return null;
  return decodeEntities(m[1].trim());
}

function extractHeadings(html: string): Array<{ level: number; text: string }> {
  const headings: Array<{ level: number; text: string }> = [];
  const re = /<(h[1-6])\b[^>]*>([\s\S]*?)<\/\1>/gi;
  for (const m of html.matchAll(re)) {
    const level = parseInt(m[1].slice(1), 10);
    const text = stripTagsToText(m[2]);
    if (text.length === 0) continue;
    if (text.length > 200) continue; // skip suspicious mega-headings
    headings.push({ level, text });
  }
  return headings;
}

function pickMainContainer(html: string): string {
  // Prefer <main>, then <article>, then <body>. Fall back to the
  // whole document so even badly-structured pages produce some text.
  const mainMatch = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch) return mainMatch[1];
  const articleMatch = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  if (articleMatch) return articleMatch[1];
  const bodyMatch = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) return bodyMatch[1];
  return html;
}

function isNoisyBlock(text: string): boolean {
  if (text.length === 0) return true;
  for (const re of NOISY_BLOCK_PHRASES) {
    if (re.test(text)) return true;
  }
  return false;
}

function extractParagraphs(containerHtml: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  // Capture paragraph-ish blocks. The regex intentionally matches the
  // common block elements that hold body text on Catholic CMSes.
  const re =
    /<(p|blockquote|figcaption|li|div)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  for (const m of containerHtml.matchAll(re)) {
    const text = stripTagsToText(m[2]);
    if (text.length < 10) continue;
    if (text.length > 5000) continue; // skip suspicious huge blocks (likely nested)
    if (seen.has(text)) continue;
    if (isNoisyBlock(text)) continue;
    seen.add(text);
    out.push(text);
  }
  return out;
}

function extractListItems(containerHtml: string): string[] {
  const out: string[] = [];
  const re = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
  for (const m of containerHtml.matchAll(re)) {
    const text = stripTagsToText(m[1]);
    if (text.length === 0) continue;
    if (text.length > 1000) continue;
    if (isNoisyBlock(text)) continue;
    out.push(text);
  }
  return out;
}

/**
 * Parse a raw HTML page into structured fields suitable for storing
 * on a SourceDocument. When the input does not look like HTML
 * (no <html> / <body> / <p> / <h*> tags) the function returns the
 * input as a single paragraph so adapters that already pre-render
 * to plain text still flow through. Always sets `parserVersion`.
 */
export function parseHtmlForSourceDocument(input: {
  html: string;
  sourceUrl: string;
}): ParsedHtmlDocument {
  const raw = input.html ?? "";
  // Quick check — is this even HTML?
  const looksLikeHtml = /<\s*(?:html|body|p|h[1-6]|article|main|div|section)\b/i.test(raw);
  if (!looksLikeHtml) {
    const text = raw.trim();
    return {
      title: null,
      description: null,
      canonicalUrl: null,
      ogTitle: null,
      schemaType: null,
      headings: [],
      paragraphs: text.length > 0 ? [text] : [],
      listItems: [],
      cleanedText: text,
      parserVersion: HTML_PARSER_VERSION,
    };
  }
  const stripped = stripDropElements(raw);
  const title = extractTitle(stripped);
  const description =
    matchMetaByName(stripped, "description") ?? matchOgMeta(stripped, "og:description");
  const canonicalUrl = extractCanonical(stripped);
  const ogTitle = matchOgMeta(stripped, "og:title");
  const schemaType =
    matchOgMeta(stripped, "og:type") ?? matchMetaByName(stripped, "schema:type");
  // Headings are extracted from the full stripped document — many
  // Catholic CMSes put their primary <h1> outside <main>/<article>.
  const headings = extractHeadings(stripped);
  const container = pickMainContainer(stripped);
  const paragraphs = extractParagraphs(container);
  const listItems = extractListItems(container);

  // Inline headings into the cleaned text as `# H1` markdown so the
  // downstream `cleanSourceBody` heading parser still picks them up.
  const cleanedLines: string[] = [];
  for (const h of headings) {
    cleanedLines.push(`${"#".repeat(Math.min(Math.max(h.level, 1), 6))} ${h.text}`);
  }
  for (const p of paragraphs) {
    cleanedLines.push(p);
  }
  for (const item of listItems) {
    cleanedLines.push(`- ${item}`);
  }
  const cleanedText = cleanedLines.join("\n\n").trim();

  return {
    title: title ?? ogTitle,
    description,
    canonicalUrl,
    ogTitle,
    schemaType,
    headings,
    paragraphs,
    listItems,
    cleanedText,
    parserVersion: HTML_PARSER_VERSION,
  };
}
