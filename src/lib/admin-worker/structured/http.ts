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
 * GET a URL and parse the JSON body. Returns null on any failure (network,
 * non-2xx, timeout, parse) and when network is disabled. Never throws.
 */
export async function fetchJson<T = unknown>(
  url: string,
  opts: { accept?: string } = {},
): Promise<T | null> {
  if (!structuredNetworkEnabled()) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: opts.accept ?? "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
