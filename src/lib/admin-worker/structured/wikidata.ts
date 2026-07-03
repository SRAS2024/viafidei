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

const DEFAULT_SPARQL_ENDPOINT = "https://query.wikidata.org/sparql";

/**
 * The SPARQL endpoints to try, in order. The canonical Wikidata Query Service
 * (query.wikidata.org) is tried first, but it aggressively rate-limits / blocks
 * datacenter IPs, so on a cloud host (e.g. Railway) it is often unreachable even
 * when en.wikipedia.org and www.wikidata.org are fine — which starves the whole
 * structured-ingest path. Setting WIKIDATA_SPARQL_ENDPOINTS (comma-separated)
 * lets the operator add a REACHABLE fallback — a mirror or a self-hosted /
 * proxied Query Service — so structured ingest keeps flowing without touching
 * the blocked host. Endpoints are tried in order and the first REACHABLE one
 * wins (an unreachable endpoint falls through to the next; a reachable endpoint
 * that legitimately returns 0 rows is accepted, not retried).
 */
function sparqlEndpoints(): string[] {
  const extra = (process.env.WIKIDATA_SPARQL_ENDPOINTS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [DEFAULT_SPARQL_ENDPOINT, ...extra].filter((v, i, a) => a.indexOf(v) === i);
}

/** One result row: variable name → bound term (or undefined when unbound). */
export type SparqlBinding = Record<string, { type: string; value: string } | undefined>;

interface SparqlResponse {
  results?: { bindings?: SparqlBinding[] };
}

/**
 * Run a SPARQL SELECT and return its result rows. Tries each configured endpoint
 * until one is REACHABLE (returns a response); an unreachable endpoint (null)
 * falls through to the next. Returns [] on any failure, when every endpoint is
 * unreachable, or when network is disabled — callers treat an empty result as
 * "nothing to ingest this pass", never an error.
 */
export async function runSparql(query: string): Promise<SparqlBinding[]> {
  for (const endpoint of sparqlEndpoints()) {
    const url = `${endpoint}?format=json&query=${encodeURIComponent(query)}`;
    const data = await fetchJson<SparqlResponse>(url, {
      accept: "application/sparql-results+json",
    });
    // A non-null response means this endpoint was reachable — accept it (even an
    // empty binding set is a valid answer). Only fall through when unreachable.
    if (data) return data.results?.bindings ?? [];
  }
  return [];
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
