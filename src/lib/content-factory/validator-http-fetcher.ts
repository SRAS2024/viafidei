/**
 * HTTP fetcher for cross-source validator documents (spec §17).
 *
 * `collectCrossSourceEvidence()` accepts an optional `loader` that
 * resolves a validator's body when none was pre-supplied. In
 * production the worker passes this fetcher so the validator
 * lookup happens once per validator URL, with retries on transient
 * failures.
 *
 * The fetcher:
 *   - hits the validator URL with a short timeout
 *   - retries with exponential backoff (uses withRetryBackoff())
 *   - strips HTML tags from the response body so the validator
 *     matcher works on plain text
 *   - returns null when the URL is unreachable AND every retry
 *     fails — the collector then records an
 *     `insufficient_evidence` row for the field
 *
 * Spec rule satisfied: "If validation sources are temporarily
 * unavailable, retry with backoff."
 */

import { logger } from "../observability/logger";
import { withRetryBackoff } from "./cross-source-evidence-retry";

export type ValidatorFetchResult = {
  body: string;
  contentType?: string | null;
};

/**
 * Strip HTML tags to a single normalised text blob for the
 * validator matcher. We do not preserve structure — only the
 * concatenated text.
 */
function htmlToText(html: string): string {
  // Remove <script>, <style>, <noscript> blocks first.
  let body = html.replace(/<script[\s\S]*?<\/script>/gi, " ");
  body = body.replace(/<style[\s\S]*?<\/style>/gi, " ");
  body = body.replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
  // Replace block-level tags with spaces so we don't fuse adjacent
  // paragraphs.
  body = body.replace(/<\/?(p|div|h\d|li|br|tr|td|th|section|article)[^>]*>/gi, " ");
  // Strip the rest of the tags.
  body = body.replace(/<[^>]+>/g, "");
  // Decode the four common HTML entities.
  body = body
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ");
  return body.replace(/\s+/g, " ").trim();
}

export type FetchValidatorOptions = {
  /** Override fetch (tests inject a stub). */
  fetcher?: typeof fetch;
  /** Per-request timeout in milliseconds. Defaults to 10s. */
  timeoutMs?: number;
  /** Retry attempts on transient failures. Defaults to 3. */
  maxAttempts?: number;
  /** Base backoff delay between retries. Defaults to 200ms. */
  baseDelayMs?: number;
};

/**
 * Fetch a validator URL and return the cleaned body. Returns null
 * (NOT throws) when the URL is unreachable after every retry — the
 * collector handles null by emitting an insufficient_evidence row.
 */
export async function fetchValidatorDocument(
  url: string,
  options: FetchValidatorOptions = {},
): Promise<ValidatorFetchResult | null> {
  const fetcher = options.fetcher ?? globalThis.fetch;
  if (typeof fetcher !== "function") {
    logger.warn("validator-http-fetcher.no_fetch_available");
    return null;
  }
  const timeoutMs = options.timeoutMs ?? 10_000;
  const result = await withRetryBackoff<ValidatorFetchResult>(
    async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetcher(url, {
          signal: controller.signal,
          headers: { Accept: "text/html, application/xml, application/json" },
        });
        if (!response.ok) {
          logger.warn("validator-http-fetcher.non_2xx", {
            url,
            status: response.status,
          });
          return null;
        }
        const ct = response.headers.get("content-type");
        const raw = await response.text();
        const body = ct && /application\/(json|xml)/i.test(ct) ? raw : htmlToText(raw);
        return { body, contentType: ct };
      } finally {
        clearTimeout(timeout);
      }
    },
    {
      maxAttempts: options.maxAttempts ?? 3,
      baseDelayMs: options.baseDelayMs ?? 200,
    },
  );
  if (!result.ok) {
    logger.warn("validator-http-fetcher.exhausted_retries", {
      url,
      attempts: result.attempts,
      error: result.error,
    });
    return null;
  }
  return result.value;
}

/**
 * Build a per-host validator loader the cross-source collector can
 * call. The wrapper caches the body in-memory for the lifetime of
 * one worker tick — the same validator URL queried twice in one
 * tick only hits the network once.
 */
export function createValidatorDocumentLoader(options: FetchValidatorOptions = {}) {
  const inflight = new Map<string, Promise<ValidatorFetchResult | null>>();
  const cache = new Map<string, ValidatorFetchResult | null>();
  return async (
    url: string,
  ): Promise<{ body?: string; headings?: ReadonlyArray<string> } | null> => {
    if (cache.has(url)) {
      const cached = cache.get(url) ?? null;
      return cached ? { body: cached.body } : null;
    }
    let pending = inflight.get(url);
    if (!pending) {
      pending = fetchValidatorDocument(url, options);
      inflight.set(url, pending);
    }
    const result = await pending;
    cache.set(url, result);
    inflight.delete(url);
    return result ? { body: result.body } : null;
  };
}
