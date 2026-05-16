/**
 * Per-content-type pause toggle. An admin can pause every Saint
 * ingestion (across all sources) without manually disabling each
 * job. The worker consults `isContentTypePaused()` before leasing a
 * queue row; paused rows are marked SKIPPED with no retry cost.
 */

import { prisma } from "../db/client";
import { logger } from "../observability/logger";

const CACHE_TTL_MS = 30_000;
let cache: { at: number; map: Map<string, { pausedAt: Date; reason: string | null }> } | null =
  null;

async function loadCache(): Promise<Map<string, { pausedAt: Date; reason: string | null }>> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.map;
  const rows = await prisma.contentTypePause.findMany();
  const map = new Map(
    rows.map((r) => [r.contentType, { pausedAt: r.pausedAt, reason: r.pausedReason }]),
  );
  cache = { at: now, map };
  return map;
}

/** Test-only cache reset so unit tests can program findMany freshly. */
export function __resetContentTypePauseCache(): void {
  cache = null;
}

function invalidateCache(): void {
  cache = null;
}

export async function isContentTypePaused(
  contentType: string | null | undefined,
): Promise<{ paused: boolean; reason: string | null; pausedAt: Date | null }> {
  if (!contentType) return { paused: false, reason: null, pausedAt: null };
  const map = await loadCache();
  const entry = map.get(contentType);
  if (!entry) return { paused: false, reason: null, pausedAt: null };
  return { paused: true, reason: entry.reason, pausedAt: entry.pausedAt };
}

export async function pauseContentType(
  contentType: string,
  reason: string,
  actorUsername: string | null = null,
): Promise<void> {
  await prisma.contentTypePause.upsert({
    where: { contentType },
    create: { contentType, pausedReason: reason, actorUsername },
    update: { pausedReason: reason, actorUsername, pausedAt: new Date() },
  });
  invalidateCache();
  logger.info("content_type.paused", { contentType, reason, actorUsername });
}

export async function resumeContentType(contentType: string): Promise<void> {
  await prisma.contentTypePause.deleteMany({ where: { contentType } });
  invalidateCache();
  logger.info("content_type.resumed", { contentType });
}

export async function listPausedContentTypes(): Promise<
  Array<{ contentType: string; pausedAt: Date; pausedReason: string | null }>
> {
  const rows = await prisma.contentTypePause.findMany({ orderBy: { pausedAt: "desc" } });
  return rows.map((r) => ({
    contentType: r.contentType,
    pausedAt: r.pausedAt,
    pausedReason: r.pausedReason,
  }));
}
