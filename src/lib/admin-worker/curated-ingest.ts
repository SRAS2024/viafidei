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

/** Failing entries named in one log line (the payload carries the same bound). */
const LOGGED_FAILURES = 10;

/**
 * Publish up to `limit` not-yet-live curated entries through the real publish
 * pipeline and record the activity to the Admin Worker log. Returns the seed
 * result plus an `exhausted` flag (no new items remained).
 *
 * The seed's backoff decides when a failing entry is tried again, so an entry
 * that cannot publish is attempted — and named in the log — once per backoff
 * window rather than silently retried on every pass. Goal rows are left to
 * the loop, which refreshes them once per pass.
 */
export async function runCuratedIngest(
  prisma: PrismaClient,
  opts: { passId?: string; limit?: number } = {},
): Promise<CuratedIngestResult> {
  const limit = opts.limit ?? DEFAULT_CURATED_INGEST_BATCH;
  const res = await seedCuratedContent(prisma, {
    limit,
    finalizeGoals: false,
    honorBackoff: true,
  });
  const updated = res.updated ?? 0;
  const failures = res.failures ?? [];
  const exhausted = res.published === 0 && updated === 0;

  // Only log when the worker actually did something (published or updated
  // this pass) or hit a problem — a steady stream of "nothing to do" rows
  // would be noise once the curated base is fully live. A failing entry is
  // only attempted once per backoff window, so naming it here is not a
  // per-pass repeat.
  if (res.published > 0 || updated > 0 || res.failed > 0 || failures.length > 0) {
    const named = failures
      .slice(0, LOGGED_FAILURES)
      .map(
        (f) =>
          `${f.contentType}/${f.slug} (${f.reason}; attempt ${f.attempts}, next ${new Date(f.nextAttemptAt).toISOString()})`,
      );
    await writeAdminWorkerLog(prisma, {
      passId: opts.passId,
      category: "CONTENT_BUILD",
      severity: res.failed > 0 || failures.length > 0 ? "WARN" : "INFO",
      eventName: "curated_knowledge_ingest",
      message: `Curated knowledge ingest: published ${res.published} new item(s)${
        updated > 0 ? `, re-published ${updated} updated item(s)` : ""
      }${
        res.failed > 0 ? `, ${res.failed} failed` : ""
      } from the worker's ground-truth knowledge base (${Object.entries(res.byType)
        .map(([t, n]) => `${t}:${n}`)
        .join(", ")}).${
        failures.length > 0
          ? ` ${failures.length} entr${failures.length === 1 ? "y" : "ies"} did not publish and will be retried after a backoff: ${named.join("; ")}${failures.length > named.length ? "; …" : ""}.`
          : ""
      }`,
      safeMetadata: {
        published: res.published,
        updated,
        alreadyPublished: res.alreadyPublished,
        failed: res.failed,
        deferred: res.deferred ?? 0,
        failures: failures.slice(0, LOGGED_FAILURES),
        byType: res.byType,
      },
    }).catch(() => undefined);
  }

  return { ...res, exhausted };
}
