/**
 * Mapping ONE source row, with the reads its verdict rested on accounted for.
 *
 * Shared by the ingest pass (`ingest.ts`) and the read-only diagnostic
 * (`diagnose.ts`), so both report the same verdict for the same row.
 *
 * Every fetch helper a mapper uses fails open: an infobox fetch that timed out
 * parses as `{}`, a narrative source that answered 429 reads as "no text". So a
 * rejection reached after such a read — `no_canonization_date`,
 * `feast_uncorroborated`, `narrative_too_short` — may say nothing about the
 * entity, yet it carries a code the rejection memory treats as a fact about it
 * and defers the entity for a day or more. Each row is therefore mapped with
 * its own `SourceReadLedger`; a rejection reached while the ledger holds an
 * unread source is reported as `source_read_failed` (the mapper's own verdict
 * kept in the detail), a code that is never remembered, so the next sweep maps
 * the entity again. An ENTRY is never touched: the mappers already publish
 * with less corroboration when an optional read fails, by design.
 */

import type { SourceReadLedger } from "./http";
import type { StructuredIngestor } from "./ingestors";
import { isRejection, reject, type MapResult } from "./reject";
import { isRememberedRejection } from "./reject-memory";
import type { SparqlBinding } from "./wikidata";

/** One mapped row, and whether its sources answered. */
export interface MappedRow {
  result: MapResult;
  /**
   * Source reads that did NOT complete while the row was mapped (no response,
   * timeout, 408/425/429/5xx, network gate closed). Zero means every source
   * answered — a 404 or an empty article IS an answer — so a rejection with
   * no unread source says nothing about whether the source is up.
   */
  unreadSources: number;
}

/**
 * Map one row, reporting the reads that did not complete alongside the
 * verdict: the ingest's outage detection (`WIKIPEDIA_FAILURE_STREAK_LIMIT`)
 * counts only rows whose sources did not answer. A thrown mapper becomes
 * `map_threw`; a remembered-kind rejection reached after a read that did not
 * complete becomes `source_read_failed`. Never throws.
 */
export async function mapSourceRowDetailed(
  ingestor: StructuredIngestor,
  row: SparqlBinding,
): Promise<MappedRow> {
  const reads: SourceReadLedger = { unread: [] };
  let result: MapResult;
  try {
    result = await ingestor.map(row, { reads });
  } catch (err) {
    return {
      result: reject("map_threw", err instanceof Error ? err.message : String(err)),
      unreadSources: reads.unread.length,
    };
  }
  const unreadSources = reads.unread.length;
  if (!isRejection(result) || unreadSources === 0 || !isRememberedRejection(result.code)) {
    return { result, unreadSources };
  }
  return {
    result: reject(
      "source_read_failed",
      `${result.code}${result.detail ? ` (${result.detail})` : ""}; unread: ${reads.unread.join(" ")}`,
    ),
    unreadSources,
  };
}

/** `mapSourceRowDetailed`, verdict only (the read-only diagnostic's view). */
export async function mapSourceRow(
  ingestor: StructuredIngestor,
  row: SparqlBinding,
): Promise<MapResult> {
  return (await mapSourceRowDetailed(ingestor, row)).result;
}
