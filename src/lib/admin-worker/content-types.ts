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
