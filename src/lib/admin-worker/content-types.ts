/**
 * Single source of truth for the content types the extraction pipeline can
 * actually turn into a package artifact.
 *
 * Why this exists: a source-read is classified into a `detectedContentType`
 * (a plain string column — it can be a real content type, an internal
 * classifier type like ROSARY/CONSECRATION, or a terminal verdict like
 * UNUSABLE / WRONG). The EXTRACTION stage may only pick reads whose detected
 * type has a real extractor; otherwise the read can never produce an artifact
 * and — because it is never marked done — it sits at the head of the
 * oldest-first extraction queue and is re-selected on every pass forever
 * (the "EXTRACTION chosen 10/10 passes" stuck loop). Both the dispatcher's
 * candidate query AND the brain's `readsAwaitingExtraction` backlog count
 * must agree on this set so the queue drains and the brain stops scoring
 * EXTRACTION once no extractable work remains.
 *
 * Every `ChecklistContentType` is extractable directly; ROSARY and
 * CONSECRATION are internal classifier types that map onto
 * SPIRITUAL_PRACTICE / DEVOTION at publish time but extract with their own
 * dedicated extractors, so they belong here too.
 *
 * `extractByType` (extractors.ts) derives its parameter type from this list,
 * which makes the per-type switch exhaustive: adding a type here is a compile
 * error until a matching extractor is wired in.
 */

export const EXTRACTABLE_CONTENT_TYPES = [
  // ChecklistContentType members.
  "PRAYER",
  "DEVOTION",
  "SAINT",
  "MARIAN_TITLE",
  "APPARITION",
  "NOVENA",
  "SACRAMENT",
  "GUIDE",
  "CHURCH_DOCUMENT",
  "LITURGICAL",
  "SPIRITUAL_PRACTICE",
  "PARISH",
  "POPE",
  "DOCTOR",
  "RITE",
  // Internal classifier types with their own extractors.
  "ROSARY",
  "CONSECRATION",
] as const;

export type ExtractableContentType = (typeof EXTRACTABLE_CONTENT_TYPES)[number];

const EXTRACTABLE_SET: ReadonlySet<string> = new Set(EXTRACTABLE_CONTENT_TYPES);

/**
 * True when `detectedContentType` has a real extractor — i.e. the EXTRACTION
 * stage can turn it into a package artifact. False for null, UNUSABLE, WRONG,
 * and any unrecognised value, all of which must be skipped by extraction so
 * they never block the queue.
 */
export function isExtractableContentType(
  contentType: string | null | undefined,
): contentType is ExtractableContentType {
  return contentType != null && EXTRACTABLE_SET.has(contentType);
}

/**
 * Content types that are BUILT FROM CURATED / STRUCTURED KNOWLEDGE, not from
 * live web extraction. They keep a real extractor (so the capability exists and
 * `isExtractableContentType` stays true — see content-types.test.ts), but the
 * EXTRACTION stage must NOT pull discovered web pages of these types: arbitrary
 * "how-to" / devotional pages classified GUIDE (a near-catch-all) or MARIAN_TITLE
 * rarely yield a complete, publishable record, so every extraction returns
 * `needs_repair` and the stage loops with zero successes (the real "EXTRACTION
 * LOOPING on GUIDE" escalation). These types grow from their authoritative
 * sources instead — the curated knowledge base (`checklist/knowledge/guides.ts`
 * via curated-ingest) and the keyless structured (Wikidata) ingestors — which
 * `source-reader.ts` already skips extraction for. Kept in sync there.
 */
export const CURATED_BUILT_CONTENT_TYPES: ReadonlySet<string> = new Set(["GUIDE", "MARIAN_TITLE"]);

/**
 * The types the live pipeline may web-extract: extractable MINUS the
 * curated/structured-built ones. Both the dispatcher's extraction candidate
 * query AND the brain's `readsAwaitingExtraction` backlog count use THIS set
 * (not `EXTRACTABLE_CONTENT_TYPES`) so they agree and neither loops on nor
 * over-scores extraction for a type that will never yield a web artifact.
 */
export const WEB_EXTRACTION_CONTENT_TYPES = EXTRACTABLE_CONTENT_TYPES.filter(
  (t) => !CURATED_BUILT_CONTENT_TYPES.has(t),
) as ReadonlyArray<ExtractableContentType>;
