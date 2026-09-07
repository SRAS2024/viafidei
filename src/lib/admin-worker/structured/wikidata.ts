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
 *
 * Two contracts matter to every caller:
 *   - `runSparql` returns `null` on FAILURE and `[]` only on a genuinely empty
 *     answer. The two used to be indistinguishable, so one throttled request
 *     read as "end of corpus" and reset the ingest cursor to 0 (a full
 *     re-sweep of thousands of already-published rows).
 *   - every request goes through ONE in-process gate shared by the ingest lane
 *     and the discovery seeder: a single query in flight, ≥3 s between starts,
 *     `Retry-After` honoured, and a 60 s cool-down after a 504 / abort (the
 *     server keeps executing an aborted query, so an immediate retry only
 *     burns the per-client 60 s/60 s WDQS budget and produces 429s).
 */

import { fetchJsonDetailed } from "./http";

const DEFAULT_SPARQL_ENDPOINT = "https://query.wikidata.org/sparql";

/**
 * SPARQL client timeout. The Wikidata Query Service applies its OWN 60s
 * server-side query timeout, and the worker's grouped, aggregated queries
 * (GROUP BY + aggregates over the full saint/document corpus, sorted)
 * legitimately take 5-30s to return. Give SPARQL a 55s budget (just under
 * WDQS's own 60s limit) so a slow-but-successful query completes instead of
 * being killed.
 */
const SPARQL_TIMEOUT_MS = 55_000;

/** Minimum spacing between two request starts against the same endpoint. */
const DEFAULT_MIN_SPACING_MS = 3_000;
/** Cool-down applied after a 504 / abort: the server is still busy with us. */
const TIMEOUT_COOLDOWN_MS = 60_000;
/** Floor for a 429 back-off even when Retry-After is tiny or missing. */
const THROTTLE_MIN_BACKOFF_MS = 5_000;
/** Longest we wait INSIDE one runSparql before giving up and cooling instead. */
const MAX_INLINE_WAIT_MS = 20_000;

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

/** Why the last runSparql failed (for logs + the persisted cool-down). */
export interface SparqlFailure {
  at: number;
  /** "throttled" (429/503), "timeout" (504/abort), "unreachable", "disabled". */
  kind: "throttled" | "timeout" | "unreachable" | "disabled";
  status: number | null;
  /** Epoch ms until which the source should be left alone (null = none). */
  cooldownUntil: number | null;
}

interface GateState {
  minSpacingMs: number;
  /** Serialises requests: one query in flight across the whole process. */
  chain: Promise<void>;
  lastStartByEndpoint: Map<string, number>;
  cooldownUntil: number;
  lastFailure: SparqlFailure | null;
}

const gate: GateState = {
  minSpacingMs: DEFAULT_MIN_SPACING_MS,
  chain: Promise.resolve(),
  lastStartByEndpoint: new Map(),
  cooldownUntil: 0,
  lastFailure: null,
};

/** Epoch ms until which the SPARQL source is cooling (0 when open). */
export function sparqlCooldownUntil(): number {
  return gate.cooldownUntil > Date.now() ? gate.cooldownUntil : 0;
}

/** The most recent failure, for diagnostics / the persisted cool-down. */
export function lastSparqlFailure(): SparqlFailure | null {
  return gate.lastFailure;
}

/**
 * Seed the in-process cool-down from persisted state (another process, or a
 * previous run of this one, learned the service was throttling). Only ever
 * EXTENDS the cool-down — never shortens it.
 */
export function applySparqlCooldown(untilEpochMs: number): void {
  if (untilEpochMs > gate.cooldownUntil) gate.cooldownUntil = untilEpochMs;
}

/**
 * Reset the gate (tests only): clears the cool-down + spacing memory and lets a
 * test shrink the spacing so mocked fetches don't wait real seconds.
 */
export function resetSparqlGateForTests(opts: { minSpacingMs?: number } = {}): void {
  gate.minSpacingMs = opts.minSpacingMs ?? DEFAULT_MIN_SPACING_MS;
  gate.chain = Promise.resolve();
  gate.lastStartByEndpoint.clear();
  gate.cooldownUntil = 0;
  gate.lastFailure = null;
}

/** Run `fn` with the gate held: one in flight, spaced per endpoint. */
async function withGate<T>(fn: () => Promise<T>): Promise<T> {
  const prev = gate.chain;
  let release: () => void = () => undefined;
  gate.chain = new Promise<void>((resolve) => {
    release = resolve;
  });
  await prev;
  try {
    return await fn();
  } finally {
    release();
  }
}

async function waitForSpacing(endpoint: string): Promise<void> {
  const last = gate.lastStartByEndpoint.get(endpoint) ?? 0;
  const wait = last + gate.minSpacingMs - Date.now();
  if (wait > 0) await sleep(wait);
  gate.lastStartByEndpoint.set(endpoint, Date.now());
}

function recordFailure(f: Omit<SparqlFailure, "at">): void {
  gate.lastFailure = { at: Date.now(), ...f };
  if (f.cooldownUntil) applySparqlCooldown(f.cooldownUntil);
}

/**
 * Run a SPARQL SELECT and return its result rows. Tries each configured endpoint
 * until one is REACHABLE (returns a response); an unreachable endpoint falls
 * through to the next. Returns `[]` only for a genuinely empty answer and
 * `null` on any failure (throttled, timed out, every endpoint unreachable,
 * network disabled, or the source is cooling down) — callers must keep their
 * cursor where it is on `null` and never treat it as "end of corpus".
 */
export async function runSparql(query: string): Promise<SparqlBinding[] | null> {
  return withGate(async () => {
    if (gate.cooldownUntil > Date.now()) {
      // Fail fast: hammering a throttled service only lengthens the throttle.
      return null;
    }
    let sawTransient = false;
    for (const endpoint of sparqlEndpoints()) {
      const url = `${endpoint}?format=json&query=${encodeURIComponent(query)}`;
      // One retry per endpoint for a 429 with a SHORT Retry-After (WDQS
      // routinely throttles the first hit of a heavy query and accepts it a
      // few seconds later). A 504 / abort is NOT retried: the server is still
      // executing our first query, so we back off and let the cursor wait.
      for (let attempt = 0; attempt < 2; attempt++) {
        await waitForSpacing(endpoint);
        const r = await fetchJsonDetailed<SparqlResponse>(url, {
          accept: "application/sparql-results+json",
          timeoutMs: SPARQL_TIMEOUT_MS,
        });
        if (r.ok) {
          // A response means this endpoint was reachable — accept it (even an
          // empty binding set is a valid answer).
          return r.data.results?.bindings ?? [];
        }
        if (r.disabled) {
          recordFailure({ kind: "disabled", status: null, cooldownUntil: null });
          return null;
        }
        if (r.aborted || r.status === 504) {
          recordFailure({
            kind: "timeout",
            status: r.status,
            cooldownUntil: Date.now() + TIMEOUT_COOLDOWN_MS,
          });
          return null;
        }
        if (r.status === 429 || r.status === 503) {
          sawTransient = true;
          const backoff = Math.max(r.retryAfterMs ?? 0, THROTTLE_MIN_BACKOFF_MS);
          if (attempt === 0 && backoff <= MAX_INLINE_WAIT_MS) {
            await sleep(backoff);
            continue;
          }
          recordFailure({
            kind: "throttled",
            status: r.status,
            cooldownUntil: Date.now() + backoff,
          });
          return null;
        }
        // Any other non-2xx / network error: this endpoint is unreachable —
        // fall through to the next endpoint without a retry.
        break;
      }
    }
    recordFailure({
      kind: sawTransient ? "throttled" : "unreachable",
      status: null,
      cooldownUntil: null,
    });
    return null;
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Read a trimmed, non-empty binding value, or undefined. */
export function bindingValue(row: SparqlBinding, key: string): string | undefined {
  const v = row[key]?.value;
  return v && v.trim() ? v.trim() : undefined;
}

/** Split a GROUP_CONCAT'd binding ("a||b||c") into its distinct non-empty parts. */
export function bindingList(row: SparqlBinding, key: string, separator = "||"): string[] {
  const v = bindingValue(row, key);
  if (!v) return [];
  return [
    ...new Set(
      v
        .split(separator)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
}

/** Bare QID ("Q42") from a QID or full entity URI; null when it isn't one. */
export function qidOf(qidOrUri: string | undefined): string | null {
  if (!qidOrUri) return null;
  const m = qidOrUri.trim().match(/(?:^|\/)(Q\d+)$/);
  return m ? m[1] : null;
}

/** Canonical Wikidata entity page URL from a QID or full entity URI. */
export function wikidataEntityUrl(qidOrUri: string): string {
  const qid = qidOrUri.replace(/^.*\/(Q\d+)$/, "$1");
  return `https://www.wikidata.org/wiki/${qid}`;
}
