/**
 * Reportable rejections for the structured-knowledge ingest.
 *
 * THE PROBLEM THIS SOLVES. Every structured mapper used to answer
 * `Promise<CuratedEntry | null>`, and the orchestrator turned a `null` into
 * `out.skipped += 1` and nothing else. Observed in production on 2026-09-07:
 *
 *     wikidata-spiritual-practices  fetched 68,   1 already live,  66 SKIPPED
 *     wikidata-saints               fetched 100, 34 already live,  40 SKIPPED
 *     wikidata-marian-titles        fetched 6,    0 already live,   3 SKIPPED
 *     wikidata-rites                fetched 2,    0 already live,   1 SKIPPED
 *
 * Ninety-seven percent of one ingestor's page vanished and NOTHING in the log,
 * the payload, or the worker's own self-diagnosis could tell a correct
 * rejection ("this is an Islamic practice, not a Catholic one") from a bug
 * ("the infobox parser regressed and every feast day now fails to corroborate").
 * `ingestors.ts` alone held 65 `return null` statements. A null must report.
 *
 * THE MECHANISM. A mapper no longer returns `CuratedEntry | null`; it returns
 * `MapResult = CuratedEntry | MapRejection`, and a `MapRejection` can only be
 * built by `reject(code, detail?)` with a code from the CLOSED
 * `REJECTION_CODES` set. That choice — a typed result rather than a
 * `reject()` recorder handed in on the context — is what makes the guarantee
 * a COMPILE-TIME one: `return null` inside a mapper is a type error, so a
 * silent discard cannot be written, not merely detected after the fact. The
 * closed union also means a typo'd code fails `tsc` instead of quietly
 * creating a new histogram bucket that no one is counting.
 *
 * The code is the aggregatable half; `detail` is free text for a human and is
 * never counted. Attribution is pure and allocation-free-ish: no I/O, no
 * network, no throw — recording WHY a row was dropped must never be able to
 * change WHETHER it was dropped.
 *
 * The companion guard is `reject-coverage.ts`, scanned by
 * `tests/admin-worker/structured-reject-coverage.test.ts`: it fails CI if any
 * mapper (or any `MapResult`-returning helper) can reach a bare `return null`,
 * and if any `reject(...)` names a code outside this set.
 */

import type { CuratedEntry } from "@/lib/checklist/knowledge";

/**
 * The CLOSED set of machine-readable rejection reasons.
 *
 * Closed on purpose: these are counted, compared across passes, and read by an
 * operator deciding whether an ingestor is behaving or broken, so free text
 * would make the histogram useless. Add a code here (with a comment saying what
 * it means) rather than inventing one at a call site — `tsc` enforces it.
 *
 * Grouped by where the decision is made, not by severity: a "correct rejection"
 * and a "bug" can share a code, and telling them apart is the job of the
 * diagnostic script (`scripts/maintenance/diagnose-structured-ingest.ts`),
 * which prints example entities per code.
 */
export const REJECTION_CODES = [
  /* ── Row-shape: the SPARQL row cannot describe an entity ──────────────── */
  /** The label service echoed the QID (no English label exists for the entity). */
  "no_english_label",
  /** A binding the record cannot be built without was unbound (see `detail`). */
  "missing_required_field",
  /** Slugification of the label produced nothing usable. */
  "slug_unresolvable",
  /** A URL the schema requires did not parse as a URL. */
  "invalid_url",
  /** Wikidata tags antipopes with the papal position; they are not Roman Pontiffs. */
  "antipope_excluded",

  /* ── Narrative sourcing: no citable prose could be obtained ───────────── */
  /** The entity has no Wikipedia article to cite a narrative from. */
  "no_wikipedia_article",
  /** The Wikipedia REST summary fetch returned nothing (failure, or gated off). */
  "wikipedia_fetch_failed",
  /** An abstract was fetched but is shorter than the content type's minimum. */
  "description_too_short",
  /** The entity carries no authoritative source URL and no Wikipedia article. */
  "no_source_url",
  /** Sources were read but none yielded enough prose for the narrative fields. */
  "narrative_too_short",

  /* ── Catholicity / classification guards ─────────────────────────────── */
  /** The Catholicity screen (rite / spiritual practice) did not pass. */
  "not_catholic_context",
  /** The row's type or kind is not one this content type's schema recognises. */
  "unrecognized_type",
  /** Deliberately owned by a different ingestor (Marian titles vs devotions). */
  "owned_by_other_ingestor",

  /* ── Church documents ─────────────────────────────────────────────────── */
  /** The publication date is not at day precision / did not parse. */
  "date_unparseable",
  /** P921 produced no usable subject, so `keyThemes` would be empty. */
  "no_key_themes",
  /** The document has no canonical (usually vatican.va) text URL. */
  "no_canonical_url",

  /* ── Saints ───────────────────────────────────────────────────────────── */
  /** `parseSaintFacts` could not read entity / QID / label from the row. */
  "saint_facts_unparseable",
  /** The P411 statements prove no CATHOLIC canonization status. */
  "not_catholic_status",
  /** A non-Catholic religion with no Catholic religion and no Catholic status. */
  "non_catholic_religion",
  /** Status must come from the infobox, but no Catholic religion is stated. */
  "no_catholic_religion",
  /** Infobox carries no canonization/beatification date, so no status. */
  "no_canonization_date",
  /** No P841 value parsed into a real calendar day. */
  "feast_unparseable",
  /** The one feast day is not stated by the article's prose or infobox. */
  "feast_uncorroborated",
  /** Several feast days and nothing to say which the calendar uses. */
  "feast_ambiguous",
  /** Non-English article and the composed English biography was too thin. */
  "biography_unavailable",

  /* ── Orchestration: recorded by ingest.ts, not by a mapper ─────────────── */
  /** The mapper threw; the pass degraded to dropping the row. */
  "map_threw",
  /** The same entity appeared twice on one page and could not be disambiguated. */
  "duplicate_in_page",
  /** The mapped payload failed its content schema at publish time. */
  "schema_invalid",
  /** The publish orchestrator declined the record (safety / quality gate). */
  "publish_rejected",
  /** The publish call threw. */
  "publish_threw",
] as const;

/** One of the closed `REJECTION_CODES`. */
export type RejectionCode = (typeof REJECTION_CODES)[number];

const CODE_SET: ReadonlySet<string> = new Set<string>(REJECTION_CODES);

/** True when `code` is a member of the closed set (for scanners / parsers). */
export function isRejectionCode(code: string): code is RejectionCode {
  return CODE_SET.has(code);
}

/**
 * A rejected row: WHY it was dropped, in a form that can be counted.
 *
 * `rejected: true` is the discriminant. `CuratedEntry` has no such field, so
 * `MapResult` narrows structurally with no runtime tagging cost.
 */
export interface MapRejection {
  readonly rejected: true;
  /** Aggregated. Always one of `REJECTION_CODES`. */
  readonly code: RejectionCode;
  /** For a human reading one entity's trace. NEVER aggregated. */
  readonly detail?: string;
}

/** What a mapper answers: a publishable entry, or an attributed rejection. */
export type MapResult = CuratedEntry | MapRejection;

/**
 * Build an attributed rejection. This is the ONLY way to say "no" from a
 * mapper. `detail` is trimmed and bounded so a rejection can never carry a
 * whole page of scraped text into a log payload.
 */
export function reject(code: RejectionCode, detail?: string): MapRejection {
  const d = typeof detail === "string" ? detail.trim().replace(/\s+/g, " ") : "";
  return d ? { rejected: true, code, detail: d.slice(0, 200) } : { rejected: true, code };
}

/**
 * Narrow a result to its rejection arm.
 *
 * Generic over the success type so the same guard works for a mapper's
 * `MapResult` and for an internal helper that answers `Something | MapRejection`
 * (e.g. `resolveSourcedNarrative`). Success types are plain objects with no
 * `rejected` field, so the discriminant is unambiguous.
 */
export function isRejection<T extends object>(result: T | MapRejection): result is MapRejection {
  return (result as MapRejection).rejected === true;
}

/** The entry, or null when the result is a rejection (test/consumer sugar). */
export function entryOrNull(result: MapResult): CuratedEntry | null {
  return isRejection(result) ? null : result;
}

/** The rejection, or null when the result is an entry (test/consumer sugar). */
export function rejectionOf(result: MapResult): MapRejection | null {
  return isRejection(result) ? result : null;
}

/** Counts per reason code for one page / one run. */
export type RejectionHistogram = Partial<Record<RejectionCode, number>>;

/**
 * Count one rejection. Fail-open by construction: no I/O, no throw, and a
 * caller that somehow passes an unknown string still lands in a bucket rather
 * than losing the row (the type system stops that at compile time, and the
 * scanner test stops a `reject("typo")` from ever reaching here).
 */
export function tallyRejection(hist: RejectionHistogram, code: RejectionCode): void {
  hist[code] = (hist[code] ?? 0) + 1;
}

/** Total rows the histogram accounts for. */
export function totalRejections(hist: RejectionHistogram): number {
  let n = 0;
  for (const v of Object.values(hist)) n += v ?? 0;
  return n;
}

/**
 * The `limit` most common reasons, highest first, ties broken alphabetically so
 * two passes with the same counts produce the same log line.
 */
export function topRejections(
  hist: RejectionHistogram,
  limit = 5,
): Array<{ code: RejectionCode; count: number }> {
  return (Object.entries(hist) as Array<[RejectionCode, number | undefined]>)
    .map(([code, count]) => ({ code, count: count ?? 0 }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code))
    .slice(0, Math.max(0, limit));
}

/**
 * One-line rendering for a log message: `narrative_too_short 41, ...`.
 * Empty string when nothing was rejected, so the caller can append it plainly.
 */
export function formatRejections(hist: RejectionHistogram, limit = 5): string {
  return topRejections(hist, limit)
    .map((r) => `${r.code} ${r.count}`)
    .join(", ");
}
