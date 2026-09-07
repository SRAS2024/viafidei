/**
 * Network-gated JSON fetch for the structured-knowledge ingestion subsystem.
 *
 * The worker's biggest deterministic lever is not "read messy HTML" — it is
 * "ingest structured knowledge." Wikidata, Wikipedia's REST API, and similar
 * sources expose clean, queryable, citable facts (feast days, reign dates,
 * canonization status, patronages) with no language model required and no
 * hallucination surface. This is the shared, defensive HTTP layer those clients
 * sit on: a bounded-timeout GET that returns parsed JSON or null, never throws,
 * and is a hard no-op when the worker is running without network
 * (ADMIN_WORKER_SKIP_NETWORK=1, e.g. tests / sandbox), so the ingestion path is
 * always safe to call from the loop.
 */

const TIMEOUT_MS = 20_000;
const USER_AGENT =
  "ViaFideiAdminWorker/1.0 (+https://etviafidei.com; structured-knowledge ingestion)";

/** True when the worker may make outbound structured-knowledge requests. */
export function structuredNetworkEnabled(): boolean {
  return process.env.ADMIN_WORKER_SKIP_NETWORK !== "1";
}

/**
 * GET a URL and return the raw text body. Returns null on any failure
 * (network, non-2xx, timeout, non-text content) and when network is disabled.
 * Never throws. Bounded to `maxBytes` (default 2 MB) by truncation.
 */
export async function fetchText(
  url: string,
  opts: { maxBytes?: number; timeoutMs?: number } = {},
): Promise<string | null> {
  if (!structuredNetworkEnabled()) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType && !/text|html|xml|json/i.test(contentType)) return null;
    const body = await res.text();
    const max = opts.maxBytes ?? 2_000_000;
    return body.length > max ? body.slice(0, max) : body;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Outcome of a JSON GET that keeps the failure DETAIL the SPARQL client needs:
 * a 429 carries a `Retry-After` the query service expects us to honour, a 504
 * (or a client-side abort) means the server is still executing the query and an
 * immediate retry only doubles its load. `fetchJson` below flattens this to
 * data-or-null for callers that don't care.
 */
export type FetchJsonResult<T> =
  | { ok: true; status: number; data: T }
  | {
      ok: false;
      /** HTTP status, or null when no response arrived (network error / abort). */
      status: number | null;
      /** Parsed `Retry-After` in ms (429/503), or null when absent. */
      retryAfterMs: number | null;
      /** True when the request was aborted by our own timeout. */
      aborted: boolean;
      /** True when the network gate is closed (ADMIN_WORKER_SKIP_NETWORK=1). */
      disabled: boolean;
    };

/** Parse an HTTP `Retry-After` header (delta-seconds or HTTP-date) to ms. */
export function parseRetryAfterMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const v = value.trim();
  if (/^\d+$/.test(v)) return Number(v) * 1000;
  const at = Date.parse(v);
  if (Number.isFinite(at)) return Math.max(0, at - Date.now());
  return null;
}

/**
 * GET a URL and parse the JSON body, reporting HOW it failed. Never throws.
 */
export async function fetchJsonDetailed<T = unknown>(
  url: string,
  opts: { accept?: string; timeoutMs?: number } = {},
): Promise<FetchJsonResult<T>> {
  if (!structuredNetworkEnabled()) {
    return { ok: false, status: null, retryAfterMs: null, aborted: false, disabled: true };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: opts.accept ?? "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) {
      // Test doubles often fake only `ok`/`status`; tolerate a missing headers bag.
      const header = typeof res.headers?.get === "function" ? res.headers.get("retry-after") : null;
      return {
        ok: false,
        status: typeof res.status === "number" ? res.status : null,
        retryAfterMs: parseRetryAfterMs(header),
        aborted: false,
        disabled: false,
      };
    }
    return { ok: true, status: res.status, data: (await res.json()) as T };
  } catch (err) {
    const aborted =
      controller.signal.aborted || (err instanceof Error && err.name === "AbortError");
    return { ok: false, status: null, retryAfterMs: null, aborted, disabled: false };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * GET a URL and parse the JSON body. Returns null on any failure (network,
 * non-2xx, timeout, parse) and when network is disabled. Never throws.
 */
export async function fetchJson<T = unknown>(
  url: string,
  opts: { accept?: string; timeoutMs?: number } = {},
): Promise<T | null> {
  const r = await fetchJsonDetailed<T>(url, opts);
  return r.ok ? r.data : null;
}
