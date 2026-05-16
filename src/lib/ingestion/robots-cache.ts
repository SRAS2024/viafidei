/**
 * DB-backed robots.txt cache. Each domain's robots.txt body is
 * stored with an expiry (`expiresAt`); next call to
 * `getRobotsForDomain()` returns the cached body if still fresh,
 * otherwise re-fetches and updates the row.
 *
 * The fetch helper is intentionally pluggable so tests can pass a
 * stub fetcher and the production caller can pass `fetchText` from
 * `lib/http/client`.
 */

import { prisma } from "../db/client";
import { logger } from "../observability/logger";

const DEFAULT_TTL_HOURS = 6;

export type RobotsFetcher = (
  url: string,
) => Promise<{ status: number; body: string | null } | null>;

export async function getRobotsForDomain(
  domain: string,
  fetcher: RobotsFetcher,
  ttlHours = DEFAULT_TTL_HOURS,
  now: Date = new Date(),
): Promise<{ body: string | null; status: number | null; cached: boolean }> {
  const cached = await prisma.robotsCache.findUnique({ where: { domain } });
  if (cached && cached.expiresAt > now) {
    return { body: cached.body, status: cached.lastStatus, cached: true };
  }
  const robotsUrl = `https://${domain}/robots.txt`;
  let fetched: { status: number; body: string | null } | null = null;
  try {
    fetched = await fetcher(robotsUrl);
  } catch (e) {
    logger.warn("robots.fetch_failed", {
      domain,
      error: e instanceof Error ? e.message : String(e),
    });
  }
  const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000);
  if (fetched) {
    await prisma.robotsCache.upsert({
      where: { domain },
      create: {
        domain,
        body: fetched.body,
        lastStatus: fetched.status,
        fetchedAt: now,
        expiresAt,
      },
      update: { body: fetched.body, lastStatus: fetched.status, fetchedAt: now, expiresAt },
    });
    return { body: fetched.body, status: fetched.status, cached: false };
  }
  // Fetch failed; fall back to the cached body (even if expired) so a
  // single failed robots check doesn't block ingestion.
  return { body: cached?.body ?? null, status: cached?.lastStatus ?? null, cached: false };
}

export async function pruneExpiredRobotsCache(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const result = await prisma.robotsCache.deleteMany({
    where: { expiresAt: { lt: cutoff } },
  });
  return result.count;
}
