/**
 * Worker curated-knowledge ingestion.
 *
 * The repo ships a curated knowledge base (`ALL_CURATED_ENTRIES`) of
 * hand-verified, schema-valid Catholic content with authority citations — the
 * Church's fixed, doctrinally-stable texts (the Our Father, the seven
 * sacraments, the Doctors of the Church, the line of popes, the recognized
 * rites, the major basilicas, the approved litanies, …). This is the worker's
 * FIRST-PASS content source, exactly as the knowledge base was designed for:
 * production-quality content for the canonical items without depending on a
 * live network fetch, plus live discovery + cross-source verification for
 * everything beyond the curated set.
 *
 * Each pass the worker publishes a bounded batch of not-yet-live curated
 * entries through the REAL publish orchestrator (safety gate + full
 * ten-dimension quality gate + persist + verifier evidence), so content grows
 * across every type even in an environment that cannot reach live authority
 * hosts. It is idempotent (already-published slugs are skipped) and bounded
 * (`limit` new publishes per call), so it makes steady forward progress
 * without ever stalling or re-doing work.
 *
 * This runs as a supplementary, fail-open loop step (like the daily-readings
 * refresh): it does not override the brain's mission selection for live
 * discovery — it is the worker keeping its own ground-truth knowledge
 * published.
 */

import type { PrismaClient } from "@prisma/client";

import { writeAdminWorkerLog } from "./logs";
import { seedCuratedContent, type SeedCuratedResult } from "./seed-curated-content";

/** Default number of new curated items published per pass. */
export const DEFAULT_CURATED_INGEST_BATCH = 25;

export interface CuratedIngestResult extends SeedCuratedResult {
  /** True when there was nothing new to publish (curated base fully live). */
  exhausted: boolean;
}

/**
 * Publish up to `limit` not-yet-live curated entries through the real publish
 * pipeline and record the activity to the Admin Worker log. Returns the seed
 * result plus an `exhausted` flag (no new items remained).
 */
export async function runCuratedIngest(
  prisma: PrismaClient,
  opts: { passId?: string; limit?: number } = {},
): Promise<CuratedIngestResult> {
  const limit = opts.limit ?? DEFAULT_CURATED_INGEST_BATCH;
  const res = await seedCuratedContent(prisma, { limit });
  const exhausted = res.published === 0;

  // Only log when the worker actually did something (published this pass) or
  // hit a problem — a steady stream of "nothing to do" rows would be noise
  // once the curated base is fully live.
  if (res.published > 0 || res.failed > 0) {
    await writeAdminWorkerLog(prisma, {
      passId: opts.passId,
      category: "CONTENT_BUILD",
      severity: res.failed > 0 ? "WARN" : "INFO",
      eventName: "curated_knowledge_ingest",
      message: `Curated knowledge ingest: published ${res.published} new item(s)${
        res.failed > 0 ? `, ${res.failed} failed` : ""
      } from the worker's ground-truth knowledge base (${Object.entries(res.byType)
        .map(([t, n]) => `${t}:${n}`)
        .join(", ")}).`,
      safeMetadata: {
        published: res.published,
        alreadyPublished: res.alreadyPublished,
        failed: res.failed,
        byType: res.byType,
      },
    }).catch(() => undefined);
  }

  return { ...res, exhausted };
}
