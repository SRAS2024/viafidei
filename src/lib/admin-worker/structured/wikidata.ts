/**
 * Wikidata SPARQL client for structured-knowledge ingestion.
 *
 * Wikidata is a free, keyless, CC0 structured knowledge graph that carries the
 * bulk of the facts the worker's content goals need — every pope with reign
 * dates, thousands of saints with feast days and canonization status, the
 * encyclicals, the approved apparitions — each statement backed by reference
 * URLs to authoritative sources. Querying it is deterministic and accurate (no
 * model, no hallucination), and it scales without a ceiling. This is the thin
 * SPARQL transport; the per-content-type queries + field mappings live in
 * `ingestors.ts`.
 */

import { fetchJson } from "./http";

const SPARQL_ENDPOINT = "https://query.wikidata.org/sparql";

/** One result row: variable name → bound term (or undefined when unbound). */
export type SparqlBinding = Record<string, { type: string; value: string } | undefined>;

interface SparqlResponse {
  results?: { bindings?: SparqlBinding[] };
}

/**
 * Run a SPARQL SELECT and return its result rows. Returns [] on any failure or
 * when network is disabled — callers treat an empty result as "nothing to
 * ingest this pass", never an error.
 */
export async function runSparql(query: string): Promise<SparqlBinding[]> {
  const url = `${SPARQL_ENDPOINT}?format=json&query=${encodeURIComponent(query)}`;
  const data = await fetchJson<SparqlResponse>(url, {
    accept: "application/sparql-results+json",
  });
  return data?.results?.bindings ?? [];
}

/** Read a trimmed, non-empty binding value, or undefined. */
export function bindingValue(row: SparqlBinding, key: string): string | undefined {
  const v = row[key]?.value;
  return v && v.trim() ? v.trim() : undefined;
}

/** Canonical Wikidata entity page URL from a QID or full entity URI. */
export function wikidataEntityUrl(qidOrUri: string): string {
  const qid = qidOrUri.replace(/^.*\/(Q\d+)$/, "$1");
  return `https://www.wikidata.org/wiki/${qid}`;
}
