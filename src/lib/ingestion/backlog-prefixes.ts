/**
 * Slug prefixes that classify rows into the doctrinal buckets the
 * ingestion scheduler measures against `appConfig.ingestion.targets`.
 *
 * This module is deliberately a pure-data leaf — the scheduler module
 * (which is the more natural home) re-exports these for convenience,
 * but the dispatcher in `lib/data/admin-notifications.ts` cannot
 * import from `scheduler.ts` because that pulls `node:crypto` into
 * the Next.js instrumentation bundle (the runner needs it for
 * Postgres advisory locks). Keeping the prefix lists here means both
 * the scheduler and the admin notification dispatcher can read them
 * without tying their bundle target to one another.
 */

export const CHURCH_DOCUMENT_SLUG_PREFIXES = [
  "encyclical-",
  "catechism-",
  "code-of-canon-law-",
  "code-of-canons-of-the-eastern-churches",
  "council-",
  "vatican-council-",
  "synod-",
] as const;

export const SACRAMENT_SLUG_PREFIXES = ["sacrament-"] as const;
export const CONSECRATION_SLUG_PREFIXES = ["consecration-"] as const;
