/**
 * READ-ONLY diagnosis of one page of a structured ingestor.
 *
 * This is the "so now what?" half of the reportable-skips work. The ingest
 * itself now records WHY every row was dropped, but an operator staring at
 * `narrative_too_short 41` still needs to know WHICH entities that fired on
 * before deciding whether the ingestor is behaving (Transcendental Meditation
 * is genuinely not a Catholic practice) or broken (the document extractor
 * regressed and every official page now reads as empty).
 *
 * So this module replays exactly what a pass would do — the same SPARQL page,
 * the same mappers, the same guards — and returns the histogram plus example
 * entities per code, WITHOUT the publish path and WITHOUT touching a database.
 * There is no Prisma client in this file and no write of any kind: it is safe
 * to run on the operator's Mac while the production worker is publishing.
 *
 * It is also deliberately gentler on the sources than the ingest lane: the
 * per-row Wikipedia fetches run at a configurable low concurrency with an
 * optional pause between batches, because a human running a diagnostic has no
 * reason to spend the worker's rate budget.
 */

import { fetchSourcePage } from "./source-page";
import type { StructuredIngestor } from "./ingestors";
import {
  isRejection,
  reject,
  tallyRejection,
  topRejections,
  type RejectionCode,
  type RejectionHistogram,
} from "./reject";
import type { SparqlBinding } from "./wikidata";

/** One entity, named the way an operator can look it up. */
export interface DiagnosedEntity {
  /** Wikidata QID when the row carries one. */
  qid?: string;
  /** The row's English label / display name, when it has one. */
  label?: string;
  /** The slug the record would have published under. */
  slug?: string;
}

/** A dropped row: the code that will be counted, plus who and why. */
export interface DiagnosedRejection extends DiagnosedEntity {
  code: RejectionCode;
  /** Free-text detail from the mapper. Never aggregated. */
  detail?: string;
}

export interface StructuredPageDiagnosis {
  ingestorId: string;
  contentType: string;
  /** Cursor offset the page was read at. */
  offset: number;
  /** Page width actually requested (clamped by `maxPageSize`). */
  batch: number;
  /** True when the SPARQL source failed — nothing below is meaningful. */
  sourceFailed: boolean;
  /** Entities the ENUMERATION returned (what the cursor would advance by). */
  enumerated: number;
  /** Rows handed to the mappers. */
  rows: number;
  /** Rows that produced a publishable entry. */
  accepted: DiagnosedEntity[];
  /** Rows that were dropped, in page order. */
  rejections: DiagnosedRejection[];
  /** Counts per reason code — the same histogram the pass log carries. */
  histogram: RejectionHistogram;
}

/** Best-effort identity of a row for reporting; never throws. */
function identityOf(ingestor: StructuredIngestor, row: SparqlBinding): DiagnosedEntity {
  try {
    const id = ingestor.identify?.(row);
    if (id) return { qid: id.qid, label: id.name, slug: id.slug };
  } catch {
    // a row we cannot even identify is exactly the kind this reports on
  }
  return {};
}

/** The display name an accepted entry publishes under. */
function acceptedIdentity(payload: Record<string, unknown>, slug: string): DiagnosedEntity {
  const label =
    (typeof payload.title === "string" && payload.title) ||
    (typeof payload.canonicalName === "string" && payload.canonicalName) ||
    undefined;
  const qid = typeof payload.wikidataQid === "string" ? payload.wikidataQid : undefined;
  return { qid, label, slug };
}

const sleep = (ms: number): Promise<void> =>
  ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve();

/**
 * Fetch one page for `ingestor` and map every row, recording an attributed
 * reason for each one that does not publish.
 *
 * Read-only: fetches from the configured SPARQL endpoint and Wikipedia exactly
 * as a pass would, then stops. Nothing is published, nothing is written, and
 * no database connection is opened.
 */
export async function diagnoseStructuredPage(input: {
  ingestor: StructuredIngestor;
  /** Rows to request. Clamped to the ingestor's own `maxPageSize`. */
  batch?: number;
  /** Cursor offset to read at (default 0 — the start of the corpus). */
  offset?: number;
  /** Concurrent mapper runs. Deliberately low by default (2, vs the lane's 8). */
  concurrency?: number;
  /** Pause between mapper batches, to stay polite to Wikipedia. */
  spacingMs?: number;
}): Promise<StructuredPageDiagnosis> {
  const { ingestor } = input;
  const batch = Math.max(
    1,
    Math.min(input.batch ?? 25, ingestor.maxPageSize ?? Number.MAX_SAFE_INTEGER),
  );
  const offset = Math.max(0, input.offset ?? 0);
  const concurrency = Math.max(1, input.concurrency ?? 2);
  const spacingMs = Math.max(0, input.spacingMs ?? 250);

  const out: StructuredPageDiagnosis = {
    ingestorId: ingestor.id,
    contentType: ingestor.contentType,
    offset,
    batch,
    sourceFailed: false,
    enumerated: 0,
    rows: 0,
    accepted: [],
    rejections: [],
    histogram: {},
  };

  const page = await fetchSourcePage(ingestor, batch, offset);
  if (page.rows === null) {
    out.sourceFailed = true;
    return out;
  }
  out.enumerated = page.size;
  out.rows = page.rows.length;

  for (let start = 0; start < page.rows.length; start += concurrency) {
    const slice = page.rows.slice(start, start + concurrency);
    const results = await Promise.all(
      slice.map((row) =>
        ingestor
          .map(row, {} as Record<string, never>)
          .catch((err) => reject("map_threw", err instanceof Error ? err.message : String(err))),
      ),
    );
    results.forEach((result, i) => {
      const row = slice[i];
      if (isRejection(result)) {
        tallyRejection(out.histogram, result.code);
        out.rejections.push({
          ...identityOf(ingestor, row),
          code: result.code,
          detail: result.detail,
        });
      } else {
        out.accepted.push(acceptedIdentity(result.payload, result.slug));
      }
    });
    if (start + concurrency < page.rows.length) await sleep(spacingMs);
  }

  return out;
}

/**
 * Group a diagnosis's rejections by code, ordered exactly like the log line's
 * top-N, with at most `examplesPerCode` entities each.
 */
export function rejectionsByCode(
  diagnosis: StructuredPageDiagnosis,
  examplesPerCode = 3,
): Array<{ code: RejectionCode; count: number; examples: DiagnosedRejection[] }> {
  return topRejections(diagnosis.histogram, Number.MAX_SAFE_INTEGER).map(({ code, count }) => ({
    code,
    count,
    examples: diagnosis.rejections.filter((r) => r.code === code).slice(0, examplesPerCode),
  }));
}
