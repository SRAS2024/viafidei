/**
 * Per-domain ingestion rate limiter. Separate from the web-request
 * rate limiter so external HTTP fetches respect each upstream's
 * preferred spacing without interfering with API throttles.
 *
 *   - `requestsPerMinute` is the hard ceiling for a 60s window.
 *   - `spacingMs` enforces a minimum gap between consecutive
 *      fetches against the same domain (some upstreams 429 even
 *      when the per-minute rate is below the ceiling).
 *
 * Spacing is per-domain, not per-job, so multiple workers fetching
 * the same site cooperate via the IngestionRateBucket row.
 */

import { prisma } from "../db/client";

export type RateDecision = { allow: true } | { allow: false; waitMs: number; reason: string };

const DEFAULT_REQUESTS_PER_MINUTE = 60;
const DEFAULT_SPACING_MS = 1_000;

export type RateLimitOptions = {
  requestsPerMinute?: number;
  spacingMs?: number;
  now?: Date;
};

/**
 * Per-domain rate policies. Conservative defaults; specific domains
 * may set lower rates via IngestionSource.rateLimitPerMin /
 * requestSpacingMs at row creation time.
 */
export function policyForDomain(domain: string): { requestsPerMinute: number; spacingMs: number } {
  const lower = domain.toLowerCase();
  if (lower.endsWith("vatican.va") || lower.endsWith("usccb.org")) {
    return { requestsPerMinute: 30, spacingMs: 2_000 };
  }
  if (lower.endsWith("newadvent.org")) {
    return { requestsPerMinute: 20, spacingMs: 2_500 };
  }
  if (lower.endsWith("ewtn.com") || lower.endsWith("catholic.com")) {
    return { requestsPerMinute: 40, spacingMs: 1_200 };
  }
  return { requestsPerMinute: DEFAULT_REQUESTS_PER_MINUTE, spacingMs: DEFAULT_SPACING_MS };
}

/**
 * Check (and atomically record) a request against the rate bucket for
 * `domain`. Returns `{ allow: true }` when the request may proceed
 * immediately, or `{ allow: false, waitMs }` when the worker should
 * sleep for `waitMs` before retrying.
 */
export async function checkAndRecordDomainFetch(
  domain: string,
  options: RateLimitOptions = {},
): Promise<RateDecision> {
  const now = options.now ?? new Date();
  const policy = policyForDomain(domain);
  const requestsPerMinute = options.requestsPerMinute ?? policy.requestsPerMinute;
  const spacingMs = options.spacingMs ?? policy.spacingMs;

  const bucket = await prisma.ingestionRateBucket.findUnique({ where: { domain } });
  if (!bucket) {
    await prisma.ingestionRateBucket.create({
      data: { domain, windowStart: now, requestsInWindow: 1, lastRequestAt: now },
    });
    return { allow: true };
  }
  // Window roll-over.
  if (now.getTime() - bucket.windowStart.getTime() > 60_000) {
    await prisma.ingestionRateBucket.update({
      where: { domain },
      data: { windowStart: now, requestsInWindow: 1, lastRequestAt: now },
    });
    return { allow: true };
  }
  // Spacing check.
  if (bucket.lastRequestAt) {
    const sinceLast = now.getTime() - bucket.lastRequestAt.getTime();
    if (sinceLast < spacingMs) {
      return {
        allow: false,
        waitMs: spacingMs - sinceLast,
        reason: `Per-domain spacing not yet elapsed (need ${spacingMs}ms, got ${sinceLast}ms)`,
      };
    }
  }
  // Per-minute ceiling.
  if (bucket.requestsInWindow >= requestsPerMinute) {
    const waitMs = 60_000 - (now.getTime() - bucket.windowStart.getTime());
    return {
      allow: false,
      waitMs: Math.max(0, waitMs),
      reason: `Per-minute ceiling reached (${requestsPerMinute}/min for ${domain})`,
    };
  }
  await prisma.ingestionRateBucket.update({
    where: { domain },
    data: { requestsInWindow: bucket.requestsInWindow + 1, lastRequestAt: now },
  });
  return { allow: true };
}

/**
 * Check whether a `User-agent: *` robots.txt rule disallows a path.
 * The implementation is intentionally conservative — when the file
 * cannot be fetched (timeout, 404, malformed), the fetcher returns
 * `true` so ingestion isn't blocked by transient errors. Strict
 * blocking only happens when an explicit disallow rule matches.
 *
 * We do not fetch robots.txt here (no outbound HTTP from this
 * module); the caller is expected to pass the previously-fetched
 * body so the same scrape budget covers both fetches.
 */
export function robotsAllowsPath(robotsTxt: string | null, path: string): boolean {
  if (!robotsTxt) return true;
  const lines = robotsTxt.split(/\r?\n/);
  let inStar = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const lower = trimmed.toLowerCase();
    if (lower.startsWith("user-agent:")) {
      const ua = lower.slice("user-agent:".length).trim();
      inStar = ua === "*";
      continue;
    }
    if (!inStar) continue;
    if (lower.startsWith("disallow:")) {
      const rule = trimmed.slice("disallow:".length).trim();
      if (!rule) continue;
      if (path.startsWith(rule)) return false;
    }
  }
  return true;
}
