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
 * SPARQL client timeout. The Wikidata Query Service applies its OWN 60s
 * server-side query timeout, and the worker's grouped, aggregated queries
 * (GROUP BY + SAMPLE over the full saint/document corpus, sorted) legitimately
 * take 15-30s to return — comfortably under the old shared 20s HTTP timeout on
 * a fast day, but aborting the moment the query service is under load or the
 * connection is slow. An abort was then indistinguishable from "the source is
 * unreachable", so the entire structured-ingest engine (saints, popes,
 * doctors, church documents, …) silently published 0 and the catalog plateaued.
 * Give SPARQL a 55s budget (just under WDQS's own 60s limit, and under the 120s
 * per-lane watchdog) so a slow-but-successful query completes instead of being
 * killed.
 */
const SPARQL_TIMEOUT_MS = 55_000;

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
    // One retry per endpoint: WDQS routinely returns a transient 429/503 (or the
    // request is slow enough to abort) on the first hit for a heavy query, then
    // succeeds on a second attempt a moment later. Without a retry a single
    // transient blip reads as "source unreachable" and the whole content type
    // publishes 0 for the pass. A short backoff keeps us well under the WDQS
    // rate limit and the lane watchdog.
    for (let attempt = 0; attempt < 2; attempt++) {
      const data = await fetchJson<SparqlResponse>(url, {
        accept: "application/sparql-results+json",
        timeoutMs: SPARQL_TIMEOUT_MS,
      });
      // A non-null response means this endpoint was reachable — accept it (even
      // an empty binding set is a valid answer). Only fall through when
      // unreachable.
      if (data) return data.results?.bindings ?? [];
      if (attempt === 0) await sleep(1_500);
    }
  }
  return [];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
