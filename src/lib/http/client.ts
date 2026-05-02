import type { ConditionalState } from "../ingestion/types";
import { buildConditionalHeaders, readConditionalState } from "./conditional";
import { DEFAULT_RETRY_POLICY, type RetryPolicy, backoffDelay, shouldRetry, sleep } from "./retry";
import { getDefaultTimeoutMs, withAbortTimeout } from "./timeout";
import { getIngestionUserAgent } from "./user-agent";

export type FetchOptions = {
  method?: "GET" | "HEAD";
  headers?: Record<string, string>;
  conditional?: ConditionalState;
  timeoutMs?: number;
  retry?: RetryPolicy;
};

export type FetchResult<T> = {
  status: number;
  ok: boolean;
  body: T | null;
  /** True when the response was 304 and `body` is unchanged from upstream. */
  notModified: boolean;
  conditionalState: ConditionalState;
  contentType: string | null;
};

export type FetchTextResult = FetchResult<string>;
export type FetchJsonResult<T> = FetchResult<T>;

const RATE_LIMIT_REGISTRY = new Map<string, number>();

function rateLimitDelayFor(host: string, perMin: number | null | undefined): number {
  if (!perMin || perMin <= 0) return 0;
  const minIntervalMs = Math.ceil(60_000 / perMin);
  const now = Date.now();
  const earliest = (RATE_LIMIT_REGISTRY.get(host) ?? 0) + minIntervalMs;
  const delay = Math.max(0, earliest - now);
  RATE_LIMIT_REGISTRY.set(host, now + delay);
  return delay;
}

async function performFetch(
  url: string,
  opts: FetchOptions,
  rateLimitPerMin?: number | null,
): Promise<Response> {
  const policy = opts.retry ?? DEFAULT_RETRY_POLICY;
  const timeoutMs = opts.timeoutMs ?? getDefaultTimeoutMs();
  const host = new URL(url).host;
  const headers: Record<string, string> = {
    "user-agent": getIngestionUserAgent(),
    accept: "application/json, text/html, application/xml;q=0.9, */*;q=0.5",
    ...buildConditionalHeaders(opts.conditional),
    ...(opts.headers ?? {}),
  };

  let lastError: unknown = null;

  for (let attempt = 0; attempt < policy.attempts; attempt++) {
    const wait = rateLimitDelayFor(host, rateLimitPerMin);
    if (wait > 0) await sleep(wait);

    const { signal, cancel } = withAbortTimeout(timeoutMs);
    try {
      const res = await fetch(url, {
        method: opts.method ?? "GET",
        headers,
        signal,
      });
      cancel();
      if (res.status >= 200 && res.status < 400) return res;
      if (!shouldRetry(res.status, policy)) return res;
      lastError = new Error(`HTTP ${res.status}`);
    } catch (err) {
      cancel();
      lastError = err;
    }
    if (attempt < policy.attempts - 1) {
      await sleep(backoffDelay(attempt, policy));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Failed to fetch ${url}`);
}

export async function fetchText(
  url: string,
  opts: FetchOptions = {},
  rateLimitPerMin?: number | null,
): Promise<FetchTextResult> {
  const res = await performFetch(url, opts, rateLimitPerMin);
  const conditional = readConditionalState(res.headers);
  if (res.status === 304) {
    return {
      status: 304,
      ok: true,
      body: null,
      notModified: true,
      conditionalState: conditional,
      contentType: res.headers.get("content-type"),
    };
  }
  const body = res.ok ? await res.text() : null;
  return {
    status: res.status,
    ok: res.ok,
    body,
    notModified: false,
    conditionalState: conditional,
    contentType: res.headers.get("content-type"),
  };
}

export async function fetchJson<T = unknown>(
  url: string,
  opts: FetchOptions = {},
  rateLimitPerMin?: number | null,
): Promise<FetchJsonResult<T>> {
  const res = await fetchText(url, opts, rateLimitPerMin);
  if (!res.ok || res.body === null) {
    return { ...res, body: null };
  }
  try {
    return { ...res, body: JSON.parse(res.body) as T };
  } catch (err) {
    throw new Error(
      `JSON parse failure for ${url}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
