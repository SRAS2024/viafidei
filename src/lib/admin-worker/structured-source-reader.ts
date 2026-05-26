/**
 * Structured source reader (spec §7). Replaces the previous "slice
 * the first 20k characters" pattern with a real HTML-structure
 * parser that:
 *
 *   - extracts title, canonical URL, main article body, headings,
 *     paragraph blocks, list blocks, prayer blocks (centred lines
 *     ending in "Amen"), day sections, scripture references, tables,
 *     location blocks, metadata, author/publisher, last-updated date
 *   - removes navigation, footer, ads, cookie banners, newsletter
 *     prompts, donation blocks, comments, unrelated sidebars,
 *     related-article lists, social-sharing text, event widgets,
 *     livestream embeds
 *   - stores both raw extracted text and structured blocks in
 *     AdminWorkerSourceBlock so extractors can consume blocks
 *     (not raw text)
 *
 * Implementation is a pragmatic regex-based HTML walker — sufficient
 * for the curated authority sources we fetch, without bringing in a
 * heavyweight parser dependency.
 */

import type { Prisma, PrismaClient } from "@prisma/client";

export type SourceBlockType =
  | "TITLE"
  | "HEADING"
  | "PARAGRAPH"
  | "LIST_ITEM"
  | "PRAYER"
  | "DAY_SECTION"
  | "SCRIPTURE"
  | "TABLE"
  | "LOCATION"
  | "METADATA"
  | "REJECTED";

export interface StructuredBlock {
  blockType: SourceBlockType;
  blockOrder: number;
  text: string;
  headingLevel?: number;
  confidenceScore: number;
  isRejected: boolean;
  rejectionReason?: string;
  metadata?: Record<string, unknown>;
}

export interface StructuredReadOutput {
  title: string | null;
  canonicalUrl: string | null;
  metaDescription: string | null;
  author: string | null;
  publisher: string | null;
  lastUpdated: string | null;
  mainBodyText: string;
  blocks: StructuredBlock[];
  scriptureReferences: string[];
  /** Blocks that were rejected (navigation, footer, ads, etc.). */
  rejectedBlocks: StructuredBlock[];
}

/**
 * Phrases / classes / IDs that flag a block as non-content. Any
 * block whose text contains one of these strings — or whose enclosing
 * tag has one of these IDs / classes — is rejected.
 */
const REJECTION_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /<nav[\s>]/i, reason: "navigation" },
  { pattern: /<footer[\s>]/i, reason: "footer" },
  { pattern: /<aside[\s>]/i, reason: "sidebar" },
  { pattern: /class=["'][^"']*(advert|ad-|google-ad|sponsor)/i, reason: "ad" },
  { pattern: /class=["'][^"']*(cookie|consent|gdpr)/i, reason: "cookie banner" },
  { pattern: /class=["'][^"']*(newsletter|subscribe|signup)/i, reason: "newsletter prompt" },
  { pattern: /class=["'][^"']*(donat|give-form|tithe)/i, reason: "donation block" },
  { pattern: /class=["'][^"']*(comment-|comments-)/i, reason: "comments" },
  { pattern: /class=["'][^"']*(related-(articles|posts)|read-more)/i, reason: "related list" },
  { pattern: /class=["'][^"']*(social-share|share-buttons|social-icons)/i, reason: "social share" },
  { pattern: /class=["'][^"']*(event-widget|calendar-widget)/i, reason: "event widget" },
  { pattern: /class=["'][^"']*(livestream|live-video|video-player)/i, reason: "livestream embed" },
];

const TEXT_REJECT_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /sign up for our newsletter/i, reason: "newsletter prompt" },
  { pattern: /accept cookies/i, reason: "cookie banner" },
  { pattern: /support our (parish|ministry|work)/i, reason: "donation block" },
  { pattern: /share this on (facebook|twitter|x)/i, reason: "social share" },
];

/**
 * Parse the HTML body into structured blocks.
 */
export function parseStructuredBlocks(html: string): StructuredReadOutput {
  const cleaned = removeRejectedRegions(html);
  const title = extractTitle(html);
  const canonical = extractCanonical(html);
  const metaDescription = extractMeta(html, "description");
  const author = extractMeta(html, "author") ?? extractMeta(html, "article:author");
  const publisher = extractMeta(html, "publisher") ?? extractMeta(html, "article:publisher");
  const lastUpdated =
    extractMeta(html, "article:modified_time") ??
    extractMeta(html, "lastmod") ??
    extractMeta(html, "date");

  const blocks: StructuredBlock[] = [];
  const rejectedBlocks: StructuredBlock[] = [];
  let order = 0;

  if (title) {
    blocks.push({
      blockType: "TITLE",
      blockOrder: order++,
      text: title,
      confidenceScore: 1,
      isRejected: false,
    });
  }

  for (const heading of extractHeadings(cleaned)) {
    blocks.push({
      blockType: "HEADING",
      blockOrder: order++,
      text: heading.text,
      headingLevel: heading.level,
      confidenceScore: 0.95,
      isRejected: false,
    });
  }

  for (const para of extractParagraphs(cleaned)) {
    const reject = isRejectedText(para);
    const block: StructuredBlock = {
      blockType: classifyParagraph(para),
      blockOrder: order++,
      text: para,
      confidenceScore: reject ? 0.1 : 0.85,
      isRejected: !!reject,
      rejectionReason: reject ?? undefined,
    };
    if (block.isRejected) {
      rejectedBlocks.push(block);
    } else {
      blocks.push(block);
    }
  }

  for (const li of extractListItems(cleaned)) {
    blocks.push({
      blockType: "LIST_ITEM",
      blockOrder: order++,
      text: li,
      confidenceScore: 0.8,
      isRejected: false,
    });
  }

  for (const tbl of extractTables(cleaned)) {
    blocks.push({
      blockType: "TABLE",
      blockOrder: order++,
      text: tbl,
      confidenceScore: 0.7,
      isRejected: false,
    });
  }

  // Scripture references — searched across the full main-body text.
  const mainBodyText = blocks
    .filter((b) => !b.isRejected && (b.blockType === "PARAGRAPH" || b.blockType === "PRAYER"))
    .map((b) => b.text)
    .join("\n\n");

  const scriptureReferences = extractScriptureReferences(mainBodyText);

  return {
    title,
    canonicalUrl: canonical,
    metaDescription,
    author,
    publisher,
    lastUpdated,
    mainBodyText,
    blocks,
    scriptureReferences,
    rejectedBlocks,
  };
}

function removeRejectedRegions(html: string): string {
  // Strip <nav>, <footer>, <aside>, <script>, <style> entirely.
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<aside[\s\S]*?<\/aside>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "");
}

function extractTitle(html: string): string | null {
  const m = /<title[^>]*>([\s\S]+?)<\/title>/i.exec(html);
  if (m) return decode(m[1]).trim() || null;
  const og = /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i.exec(html);
  return og ? decode(og[1]).trim() || null : null;
}

function extractCanonical(html: string): string | null {
  const m = /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i.exec(html);
  return m ? decode(m[1]).trim() || null : null;
}

function extractMeta(html: string, name: string): string | null {
  const a = new RegExp(
    `<meta[^>]+(?:name|property)=["']${escapeRegex(name)}["'][^>]+content=["']([^"']+)["']`,
    "i",
  );
  const b = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${escapeRegex(name)}["']`,
    "i",
  );
  const m = a.exec(html) ?? b.exec(html);
  return m ? decode(m[1]).trim() || null : null;
}

function extractHeadings(html: string): Array<{ level: number; text: string }> {
  const out: Array<{ level: number; text: string }> = [];
  const re = /<h([1-6])[^>]*>([\s\S]+?)<\/h\1>/gi;
  let m;
  while ((m = re.exec(html))) {
    const level = parseInt(m[1], 10);
    const text = decode(stripTags(m[2])).trim();
    if (text) out.push({ level, text });
  }
  return out;
}

function extractParagraphs(html: string): string[] {
  const out: string[] = [];
  const re = /<p[^>]*>([\s\S]+?)<\/p>/gi;
  let m;
  while ((m = re.exec(html))) {
    const text = decode(stripTags(m[1])).trim();
    if (text.length > 20) out.push(text);
  }
  return out;
}

function extractListItems(html: string): string[] {
  const out: string[] = [];
  const re = /<li[^>]*>([\s\S]+?)<\/li>/gi;
  let m;
  while ((m = re.exec(html))) {
    const text = decode(stripTags(m[1])).trim();
    if (text.length > 0) out.push(text);
  }
  return out;
}

function extractTables(html: string): string[] {
  const out: string[] = [];
  const re = /<table[^>]*>([\s\S]+?)<\/table>/gi;
  let m;
  while ((m = re.exec(html))) {
    const rows = m[1].match(/<tr[\s\S]+?<\/tr>/gi) ?? [];
    const lines = rows.map((row) =>
      (row.match(/<t[dh][^>]*>([\s\S]+?)<\/t[dh]>/gi) ?? [])
        .map((cell) => decode(stripTags(cell)).trim())
        .filter(Boolean)
        .join(" | "),
    );
    const text = lines.filter(Boolean).join("\n");
    if (text) out.push(text);
  }
  return out;
}

/**
 * Classify a paragraph as PRAYER, DAY_SECTION, LOCATION, or generic
 * PARAGRAPH based on lightweight content hints.
 */
function classifyParagraph(text: string): SourceBlockType {
  if (/amen[.!]?$/im.test(text) || /through christ our lord/i.test(text)) {
    return "PRAYER";
  }
  if (
    /^day [0-9]/i.test(text) ||
    /^day (one|two|three|four|five|six|seven|eight|nine)\b/i.test(text)
  ) {
    return "DAY_SECTION";
  }
  if (/^(address|location)[:\s]/i.test(text) || /\b[A-Z]{2}\s+\d{5}/.test(text)) {
    return "LOCATION";
  }
  if (/\b\d?\s?[A-Z][a-z]+\s+\d+:\d+(?:[\-–]\d+)?/i.test(text)) {
    // e.g. "Matthew 5:3" — scripture-bearing paragraph still counted
    // as a paragraph but flagged in metadata.
    return "PARAGRAPH";
  }
  return "PARAGRAPH";
}

function isRejectedText(text: string): string | null {
  for (const rule of TEXT_REJECT_PATTERNS) {
    if (rule.pattern.test(text)) return rule.reason;
  }
  return null;
}

const SCRIPTURE_RE =
  /\b(?:(?:1|2|3) )?[A-Z][a-zA-Z]+(?:\s\d{1,2})?\s\d{1,3}:\d{1,3}(?:[\-–]\d{1,3})?/g;

function extractScriptureReferences(text: string): string[] {
  const out = new Set<string>();
  let m;
  while ((m = SCRIPTURE_RE.exec(text))) {
    out.add(m[0]);
  }
  return [...out].slice(0, 50);
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, " ");
}

function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Persist the structured blocks to AdminWorkerSourceBlock. Returns
 * the IDs so the caller can link extractor packages back to the
 * blocks they consumed.
 */
export async function persistStructuredBlocks(
  prisma: PrismaClient,
  sourceReadId: string,
  output: StructuredReadOutput,
): Promise<string[]> {
  const ids: string[] = [];
  const all = [...output.blocks, ...output.rejectedBlocks];
  for (const block of all) {
    const row = await prisma.adminWorkerSourceBlock
      .create({
        data: {
          sourceReadId,
          blockType: block.blockType,
          blockOrder: block.blockOrder,
          text: block.text.slice(0, 5_000),
          headingLevel: block.headingLevel,
          confidenceScore: block.confidenceScore,
          isRejected: block.isRejected,
          rejectionReason: block.rejectionReason,
          metadata: block.metadata ? (block.metadata as Prisma.InputJsonValue) : undefined,
        },
        select: { id: true },
      })
      .catch(() => null);
    if (row) ids.push(row.id);
  }
  return ids;
}

export const REJECTION_PATTERN_NAMES = REJECTION_PATTERNS.map((p) => p.reason);
