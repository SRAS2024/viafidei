/**
 * Source document layer.
 *
 * The factory's input boundary. Adapters and discovery jobs do not
 * write directly to public content tables — they hand a fetched page
 * to `recordSourceDocument()` which:
 *
 *   1. Cleans navigation / footers / donation / newsletter / share /
 *      livestream / video / related / cookie / ad / sidebar / event
 *      noise out of the body.
 *   2. Structures the surviving content into headings, paragraphs,
 *      lists, tables, and links.
 *   3. Computes raw + cleaned checksums for change detection.
 *   4. Writes one SourceDocument row keyed by the source URL.
 *
 * Builders read SourceDocument rows; they never re-parse raw HTML.
 *
 * The cleanup signatures below are intentionally conservative —
 * everything they strip has a `kind=…` label so the cleanup
 * decisions are auditable.
 */

import { createHash } from "node:crypto";
import { prisma } from "../db/client";
import { logger } from "../observability/logger";
import type { SourceDocumentSnapshot } from "./types";

export type RecordSourceDocumentInput = {
  sourceUrl: string;
  sourceHost: string;
  sourceId?: string | null;
  adapterKey?: string | null;
  discoveredItemId?: string | null;
  workerJobId?: string | null;
  ingestionBatchId?: string | null;
  sourceTier?: number | null;
  sourceTitle?: string | null;
  rawHtml?: string | null;
  rawBody?: string | null;
  language?: string | null;
  metadata?: Record<string, string | undefined>;
  sourcePurposes?: Record<string, boolean>;
  fetchStatus?: string;
  httpStatus?: number | null;
  etag?: string | null;
  lastModifiedHeader?: string | null;
};

export type RecordedSourceDocument = SourceDocumentSnapshot & {
  id: string;
};

const NOISE_PATTERNS: Array<{ kind: string; re: RegExp }> = [
  { kind: "navigation", re: /^\s*(?:home|menu|navigation|skip\s+to\s+main\s+content)\s*$/i },
  { kind: "footer", re: /(?:^\s*(?:copyright|©)|all rights reserved)\b/i },
  {
    kind: "donation",
    re: /^\s*(?:donate|give\s+now|support\s+us|make\s+a\s+gift|your\s+gift)/i,
  },
  {
    kind: "newsletter",
    re: /^\s*(?:subscribe(?:\s+to\s+our)?(?:\s+newsletter)?|sign\s+up\s+for\s+our\s+newsletter|stay\s+connected\s+with\s+us)/i,
  },
  { kind: "share", re: /^\s*(?:share(?:\s+this)?|tweet|pin\s+it|email\s+to\s+a\s+friend)/i },
  { kind: "livestream", re: /\b(?:livestream|live\s+stream|watch\s+live)\b/i },
  { kind: "video", re: /^\s*(?:watch\s+video|video\s+embed|youtube\.com|vimeo\.com)/i },
  { kind: "related", re: /^\s*(?:related\s+articles|you\s+might\s+(?:also\s+)?like|read\s+more)/i },
  { kind: "cookie", re: /\b(?:cookie\s+(?:policy|notice|preferences)|accept\s+cookies?)\b/i },
  { kind: "ad", re: /^\s*(?:advertisement|sponsored\s+(?:content|by))/i },
  { kind: "sidebar", re: /^\s*(?:sidebar|recent\s+posts|categories|archives)\s*$/i },
];

const EVENT_PATTERNS: Array<{ kind: string; re: RegExp }> = [
  { kind: "event_card", re: /\b(?:event\s+(?:listing|details)|join\s+us\s+(?:for|this))\b/i },
];

/**
 * Cleans a raw text body. Returns the cleaned body, a list of removed
 * lines with their categorisation, and a structured table of the
 * surviving content (paragraphs, headings, lists). The cleanup is
 * conservative: matching lines are dropped; everything else is kept
 * verbatim.
 */
export function cleanSourceBody(
  raw: string,
  options: { allowEventCards?: boolean } = {},
): {
  cleaned: string;
  removed: ReadonlyArray<{ kind: string; text: string }>;
  paragraphs: string[];
  headings: Array<{ level: number; text: string }>;
  lists: Array<{ ordered: boolean; items: string[] }>;
} {
  const lines = raw.split(/\r?\n/);
  const surviving: string[] = [];
  const removed: Array<{ kind: string; text: string }> = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      surviving.push("");
      continue;
    }
    let kind: string | null = null;
    for (const pat of NOISE_PATTERNS) {
      if (pat.re.test(trimmed)) {
        kind = pat.kind;
        break;
      }
    }
    if (!kind && !options.allowEventCards) {
      for (const pat of EVENT_PATTERNS) {
        if (pat.re.test(trimmed)) {
          kind = pat.kind;
          break;
        }
      }
    }
    if (kind) {
      removed.push({ kind, text: trimmed });
    } else {
      surviving.push(trimmed);
    }
  }

  const cleaned = surviving.join("\n").replace(/\n{3,}/g, "\n\n").trim();

  // Headings (markdown-style) and lists are pulled from the surviving
  // text so the downstream builders can pick fields from them.
  const headings: Array<{ level: number; text: string }> = [];
  const lists: Array<{ ordered: boolean; items: string[] }> = [];
  let currentList: { ordered: boolean; items: string[] } | null = null;

  for (const line of surviving) {
    if (!line) {
      if (currentList) {
        lists.push(currentList);
        currentList = null;
      }
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      headings.push({ level: h[1].length, text: h[2].trim() });
      if (currentList) {
        lists.push(currentList);
        currentList = null;
      }
      continue;
    }
    const ul = /^[-*•]\s+(.*)$/.exec(line);
    const ol = /^\d+\.\s+(.*)$/.exec(line);
    if (ul) {
      if (!currentList || currentList.ordered) {
        if (currentList) lists.push(currentList);
        currentList = { ordered: false, items: [] };
      }
      currentList.items.push(ul[1].trim());
      continue;
    }
    if (ol) {
      if (!currentList || !currentList.ordered) {
        if (currentList) lists.push(currentList);
        currentList = { ordered: true, items: [] };
      }
      currentList.items.push(ol[1].trim());
      continue;
    }
    if (currentList) {
      lists.push(currentList);
      currentList = null;
    }
  }
  if (currentList) lists.push(currentList);

  const paragraphs = cleaned
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  return { cleaned, removed, paragraphs, headings, lists };
}

export function checksum(value: string | null | undefined): string | null {
  if (!value) return null;
  return createHash("sha256").update(value).digest("hex");
}

function deriveTitle(input: RecordSourceDocumentInput, headings: Array<{ text: string }>): string {
  if (input.sourceTitle && input.sourceTitle.trim().length > 0) return input.sourceTitle.trim();
  if (headings.length > 0) return headings[0].text;
  return input.sourceUrl;
}

/**
 * Record (insert or upsert) a SourceDocument from a fresh fetch.
 * The URL is the primary key. Re-fetching the same URL updates the
 * existing row in place — checksums let downstream consumers detect
 * "content actually changed" vs "we re-fetched the same page".
 */
export async function recordSourceDocument(
  input: RecordSourceDocumentInput,
): Promise<RecordedSourceDocument> {
  const raw = input.rawBody ?? input.rawHtml ?? "";
  const allowEventCards =
    !!input.sourcePurposes?.canIngestHistory && /history|council|encyclical/i.test(input.sourceUrl);
  const cleanedResult = cleanSourceBody(raw, { allowEventCards });
  const cleaned = cleanedResult.cleaned;
  const headings = cleanedResult.headings;
  const paragraphs = cleanedResult.paragraphs;
  const lists = cleanedResult.lists;
  const title = deriveTitle(input, headings);
  const contentChecksum = checksum(raw);
  const cleanedChecksum = checksum(cleaned);

  try {
    const row = await prisma.sourceDocument.upsert({
      where: { sourceUrl: input.sourceUrl },
      create: {
        sourceUrl: input.sourceUrl,
        sourceHost: input.sourceHost,
        sourceId: input.sourceId ?? null,
        adapterKey: input.adapterKey ?? null,
        discoveredItemId: input.discoveredItemId ?? null,
        workerJobId: input.workerJobId ?? null,
        ingestionBatchId: input.ingestionBatchId ?? null,
        sourceTier: input.sourceTier ?? null,
        sourceTitle: title,
        rawBody: raw,
        cleanedBody: cleaned,
        headingsJson: headings as unknown as object,
        paragraphsJson: paragraphs as unknown as object,
        listsJson: lists as unknown as object,
        tablesJson: [] as unknown as object,
        linksJson: [] as unknown as object,
        metadataJson: (input.metadata ?? {}) as unknown as object,
        sourcePurposesJson: (input.sourcePurposes ?? {}) as unknown as object,
        fetchStatus: input.fetchStatus ?? "ok",
        httpStatus: input.httpStatus ?? null,
        etag: input.etag ?? null,
        lastModifiedHeader: input.lastModifiedHeader ?? null,
        contentChecksum,
        cleanedChecksum,
        language: input.language ?? null,
      },
      update: {
        sourceHost: input.sourceHost,
        sourceId: input.sourceId ?? null,
        adapterKey: input.adapterKey ?? null,
        discoveredItemId: input.discoveredItemId ?? null,
        workerJobId: input.workerJobId ?? null,
        ingestionBatchId: input.ingestionBatchId ?? null,
        sourceTier: input.sourceTier ?? null,
        sourceTitle: title,
        rawBody: raw,
        cleanedBody: cleaned,
        headingsJson: headings as unknown as object,
        paragraphsJson: paragraphs as unknown as object,
        listsJson: lists as unknown as object,
        metadataJson: (input.metadata ?? {}) as unknown as object,
        sourcePurposesJson: (input.sourcePurposes ?? {}) as unknown as object,
        fetchStatus: input.fetchStatus ?? "ok",
        httpStatus: input.httpStatus ?? null,
        etag: input.etag ?? null,
        lastModifiedHeader: input.lastModifiedHeader ?? null,
        contentChecksum,
        cleanedChecksum,
        language: input.language ?? null,
        fetchedAt: new Date(),
      },
    });

    return rowToSnapshot(row);
  } catch (e) {
    logger.warn("content-factory.source-document.upsert_failed", {
      sourceUrl: input.sourceUrl,
      error: e instanceof Error ? e.message : String(e),
    });
    throw e;
  }
}

/**
 * Read a SourceDocument by URL for builders that work off cached
 * documents (e.g. the strict QA revalidation loop).
 */
export async function getSourceDocument(
  sourceUrl: string,
): Promise<RecordedSourceDocument | null> {
  const row = await prisma.sourceDocument.findUnique({ where: { sourceUrl } });
  if (!row) return null;
  return rowToSnapshot(row);
}

/**
 * In-memory SourceDocument constructor for tests and seed flows that
 * never hit the network. Has no side effect — callers that want a
 * durable record must still call `recordSourceDocument()`.
 */
export function syntheticSourceDocument(input: {
  sourceUrl: string;
  sourceHost: string;
  rawBody: string;
  sourceTitle?: string;
  language?: string;
  sourcePurposes?: Record<string, boolean>;
  metadata?: Record<string, string | undefined>;
  sourceTier?: number | null;
}): SourceDocumentSnapshot {
  const cleanedResult = cleanSourceBody(input.rawBody);
  return {
    sourceUrl: input.sourceUrl,
    sourceHost: input.sourceHost,
    sourceTitle: input.sourceTitle ?? (cleanedResult.headings[0]?.text ?? input.sourceUrl),
    rawBody: input.rawBody,
    cleanedBody: cleanedResult.cleaned,
    headings: cleanedResult.headings,
    paragraphs: cleanedResult.paragraphs,
    lists: cleanedResult.lists,
    metadata: input.metadata ?? {},
    sourcePurposes: input.sourcePurposes ?? {},
    contentChecksum: checksum(input.rawBody),
    cleanedChecksum: checksum(cleanedResult.cleaned),
    language: input.language ?? "en",
    sourceTier: input.sourceTier ?? null,
    fetchStatus: "ok",
  };
}

type SourceDocumentRow = {
  id: string;
  sourceUrl: string;
  sourceHost: string;
  sourceTier: number | null;
  sourceTitle: string | null;
  cleanedBody: string | null;
  rawBody: string | null;
  headingsJson: unknown;
  paragraphsJson: unknown;
  listsJson: unknown;
  tablesJson: unknown;
  linksJson: unknown;
  metadataJson: unknown;
  sourcePurposesJson: unknown;
  fetchStatus: string;
  httpStatus: number | null;
  etag: string | null;
  lastModifiedHeader: string | null;
  contentChecksum: string | null;
  cleanedChecksum: string | null;
  language: string | null;
};

function rowToSnapshot(row: SourceDocumentRow): RecordedSourceDocument {
  return {
    id: row.id,
    sourceUrl: row.sourceUrl,
    sourceHost: row.sourceHost,
    sourceTier: row.sourceTier,
    sourceTitle: row.sourceTitle,
    cleanedBody: row.cleanedBody,
    rawBody: row.rawBody,
    headings: row.headingsJson as ReadonlyArray<{ level: number; text: string }>,
    paragraphs: row.paragraphsJson as ReadonlyArray<string>,
    lists: row.listsJson as ReadonlyArray<{ ordered: boolean; items: ReadonlyArray<string> }>,
    tables: row.tablesJson as ReadonlyArray<{ rows: ReadonlyArray<ReadonlyArray<string>> }>,
    links: row.linksJson as ReadonlyArray<{ url: string; text: string }>,
    metadata: row.metadataJson as Record<string, string | undefined>,
    sourcePurposes: row.sourcePurposesJson as Record<string, boolean>,
    fetchStatus: row.fetchStatus,
    httpStatus: row.httpStatus,
    etag: row.etag,
    lastModifiedHeader: row.lastModifiedHeader,
    contentChecksum: row.contentChecksum,
    cleanedChecksum: row.cleanedChecksum,
    language: row.language,
  };
}
