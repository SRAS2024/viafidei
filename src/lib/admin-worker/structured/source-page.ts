/**
 * Fetching ONE page of source rows for a structured ingestor.
 *
 * Split out of `ingest.ts` so it can be shared with the read-only diagnostic
 * (`diagnose.ts`) WITHOUT dragging the publish path along: `ingest.ts` imports
 * the publish orchestrator, the checklist validator and the worker log, so a
 * diagnostic that imported it would pull a Prisma-touching module graph into a
 * script whose whole promise is that it cannot write anything. This file's own
 * imports are the SPARQL transport and the ingestor registry — nothing else.
 *
 * The contract is unchanged and is the subtle part: `rows: null` means the
 * SOURCE FAILED (the cursor must not move), while `rows: []` means a genuinely
 * empty page, and `size` is what the ENUMERATION returned — which is what the
 * cursor advances by, and is not the same as `rows.length` for a two-phase
 * ingestor whose hydration legitimately binds fewer entities.
 */

import { runSparql, type SparqlBinding } from "./wikidata";
import type { StructuredIngestor } from "./ingestors";

/** One page of source rows: what to map, and how many entities the page held. */
export interface SourcePage {
  /** Rows in the shape `map()` / `identify()` consume, or null on failure. */
  rows: SparqlBinding[] | null;
  /**
   * Entities the ENUMERATION returned for this page. This — not `rows.length` —
   * is what the cursor advances by and what "a short page means end of corpus"
   * is judged on: in the two-phase form the hydration query can legitimately
   * return fewer rows than were enumerated (an entity edited between the two
   * calls), and treating that as the end of the corpus would wrap the cursor to
   * 0 and re-sweep thousands of already-live rows.
   */
  size: number;
}

/**
 * Fetch one page from an ingestor's source.
 *
 * Single-phase ingestors run their one query. A two-phase ingestor (`hydrate`
 * present) runs the cheap ordered enumeration first and then hydrates exactly
 * the entities that page enumerated, so the expensive OPTIONAL + aggregate work
 * is bounded by the page instead of the corpus. Either phase failing is a
 * SOURCE failure (`rows: null`) — never an empty corpus.
 */
export async function fetchSourcePage(
  ingestor: StructuredIngestor,
  batch: number,
  offset: number,
): Promise<SourcePage> {
  let enumerated: SparqlBinding[] | null;
  try {
    enumerated = await runSparql(ingestor.sparql(batch, offset));
  } catch {
    enumerated = null;
  }
  if (enumerated === null) return { rows: null, size: 0 };
  if (!ingestor.hydrate) return { rows: enumerated, size: enumerated.length };
  const size = enumerated.length;
  if (size === 0) return { rows: [], size: 0 };
  let query: string | null = null;
  try {
    query = ingestor.hydrate(enumerated);
  } catch {
    query = null;
  }
  // No hydratable entity on the page (every row unusable): not a failure — an
  // empty page the cursor may step past.
  if (!query) return { rows: [], size };
  let rows: SparqlBinding[] | null;
  try {
    rows = await runSparql(query);
  } catch {
    rows = null;
  }
  if (rows === null) return { rows: null, size: 0 };
  return { rows, size };
}
