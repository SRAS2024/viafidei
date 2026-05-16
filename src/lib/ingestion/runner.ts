import type { ContentStatus } from "@prisma/client";
import { appConfig } from "../config";
import { recordDataManagementLogs, type DataManagementLogInput } from "../data/data-management-log";
import { prisma } from "../db/client";
import { withAdvisoryLock } from "../concurrency/lock";
import { logger } from "../observability/logger";
import type { ConditionalState, IngestionRunSummary, SourceAdapter } from "./types";
import { sanitize } from "./validate";
import { formatIngestedItems } from "./format";
import { cleanIngestedItems } from "./clean";
import { classifyIngestedItems } from "./classify";
import { enrichIngestedItems } from "./enrich";
import { persistItems } from "./persist";

export type RunnerOptions = {
  /**
   * Status assigned to newly-created or revived items. Defaults to the
   * configured initial status (REVIEW) so nothing scraped becomes live
   * without explicit approval.
   */
  initialStatus?: ContentStatus;
  /** When true, skips DB locking. Used by tests. */
  skipLock?: boolean;
  /** Identifier for who triggered the run ("automatic" cron, "manual" admin). */
  triggeredBy?: "automatic" | "manual";
  /** Admin username for manual runs — flows into DataManagementLog rows. */
  actorUsername?: string | null;
  /** Source display name (e.g. "Vatican"). Used in log reasons. */
  sourceName?: string;
};

const ENTITY_TYPE_BY_KIND: Record<string, string> = {
  prayer: "Prayer",
  saint: "Saint",
  apparition: "MarianApparition",
  parish: "Parish",
  devotion: "Devotion",
  liturgy: "LiturgyEntry",
  guide: "SpiritualLifeGuide",
};

function defaultInitialStatus(): ContentStatus {
  return appConfig.ingestion.initialStatus;
}

const NO_OP_SUMMARY: IngestionRunSummary = {
  recordsSeen: 0,
  recordsCreated: 0,
  recordsUpdated: 0,
  recordsSkipped: 0,
  recordsFailed: 0,
  recordsReviewRequired: 0,
  errorMessage: null,
};

/**
 * Conditional-request state (ETag / Last-Modified) is round-tripped through
 * the `errorMessage` JSON blob so adapters can short-circuit on 304s without
 * adding a dedicated column. `loadPriorState` parses the most recent
 * SUCCESS run's payload back out.
 */
async function loadPriorState(jobId: string): Promise<ConditionalState | undefined> {
  const lastSuccess = await prisma.ingestionJobRun.findFirst({
    where: { jobId, status: "SUCCESS" },
    orderBy: { startedAt: "desc" },
  });
  if (!lastSuccess?.errorMessage) return undefined;
  try {
    const parsed = JSON.parse(lastSuccess.errorMessage) as Partial<ConditionalState>;
    if (parsed.etag || parsed.lastModified) return parsed;
  } catch {
    // older runs may not contain JSON
  }
  return undefined;
}

export async function runAdapter(
  adapter: SourceAdapter,
  jobId: string | null,
  sourceHost: string,
  options: RunnerOptions = {},
): Promise<IngestionRunSummary> {
  const lockKey = `ingest:${adapter.key}`;
  const exec = () => runAdapterUnlocked(adapter, jobId, sourceHost, options);
  if (options.skipLock) return exec();
  const result = await withAdvisoryLock(lockKey, exec);
  if (result) return result;
  logger.warn("ingestion.run.skipped_locked", { adapter: adapter.key, sourceHost, lockKey });
  return {
    ...NO_OP_SUMMARY,
    errorMessage: `Skipped: another runner holds lock '${lockKey}'`,
  };
}

async function runAdapterUnlocked(
  adapter: SourceAdapter,
  jobId: string | null,
  sourceHost: string,
  options: RunnerOptions,
): Promise<IngestionRunSummary> {
  const initialStatus = options.initialStatus ?? defaultInitialStatus();
  const startedAt = new Date();

  logger.info("ingestion.run.started", {
    adapter: adapter.key,
    sourceHost,
    jobId,
    initialStatus,
  });

  const run = jobId
    ? await prisma.ingestionJobRun.create({
        data: { jobId, startedAt, status: "RUNNING" },
      })
    : null;

  try {
    const conditionalState = jobId ? await loadPriorState(jobId) : undefined;
    const {
      items,
      notModified,
      conditionalState: nextState,
    } = await adapter.fetch({
      sourceHost,
      jobName: adapter.key,
      conditionalState,
    });

    if (notModified) {
      const summary: IngestionRunSummary = { ...NO_OP_SUMMARY };
      if (run) {
        await prisma.ingestionJobRun.update({
          where: { id: run.id },
          data: {
            finishedAt: new Date(),
            status: "SUCCESS",
            recordsSeen: 0,
            recordsCreated: 0,
            recordsUpdated: 0,
            recordsSkipped: 0,
            recordsFailed: 0,
            recordsReviewRequired: 0,
            errorMessage: nextState ? JSON.stringify(nextState) : null,
          },
        });
      }
      logger.info("ingestion.run.not_modified", {
        adapter: adapter.key,
        sourceHost,
        jobId,
        durationMs: Date.now() - startedAt.getTime(),
      });
      return summary;
    }

    // Intelligent packaging pipeline. Each stage transforms or filters
    // items so the catalog ends up clean.
    //
    //   1. format    — canonical text shape (entity decode, smart-quote
    //                  fold, whitespace normalisation).
    //   2. clean     — strip navigation / cookie / share-this / footer /
    //                  newsletter / donation boilerplate from text
    //                  fields. The surrounding content survives.
    //   3. classify  — re-route the item's `kind` when the body reads
    //                  more like another kind (a "prayer" page whose
    //                  body is actually a saint biography is sent to
    //                  the Saint bucket, not bounced).
    //   4. enrich    — fill in missing required + helpful fields from
    //                  signals already in the text: prayer category,
    //                  saint patronages + feast day, apparition
    //                  location + country + status, parish diocese +
    //                  city + region + country, devotion duration +
    //                  tags, liturgy kind, guide kind.
    //   5. sanitize  — final per-kind validator. Three outcomes:
    //                    • valid    → PUBLISHED
    //                    • soft     → REVIEW (imperfect-but-real)
    //                    • noise    → HARD-DELETED (landing pages,
    //                                 navigation cruft, meta-
    //                                 descriptions — never had any
    //                                 place in the catalog)
    //                    • rejected → not persisted (structurally
    //                                 invalid: missing slug, off-
    //                                 allowlist source, protected
    //                                 kind)
    const formatted = formatIngestedItems(items);
    const cleaned = cleanIngestedItems(formatted);
    const classifyResults = classifyIngestedItems(cleaned);
    const reclassified = classifyResults.map((r) => r.item);
    const enriched = enrichIngestedItems(reclassified);
    const { valid, review, noise, rejected } = sanitize(enriched);

    const triggeredBy = options.triggeredBy ?? "automatic";
    const persistOptions = {
      triggeredBy,
      actorUsername: options.actorUsername ?? null,
      sourceName: options.sourceName ?? sourceHost,
      jobName: adapter.key,
      // We accumulate logs ourselves so review items, deleted items,
      // and persisted items all land in the same batched
      // DataManagementLog write.
      skipDataManagementLog: true,
    } as const;

    // Items that pass every check are persisted with the configured
    // `initialStatus` (PUBLISHED for auto-publish, REVIEW for staged
    // moderation).
    const counts = await persistItems(valid, initialStatus, persistOptions);
    // Items that fail a soft (category-heuristic) check are persisted
    // with `status = REVIEW` so a moderator can decide whether the
    // content is genuinely Catholic but mis-shaped, or really a
    // source-summary blurb that should be archived. This is the
    // "imperfect but possibly real" bucket.
    const reviewCounts =
      review.length > 0
        ? await persistItems(
            review.map((r) => r.item),
            "REVIEW" as ContentStatus,
            persistOptions,
          )
        : { created: 0, updated: 0, skipped: 0, logs: [] as DataManagementLogInput[] };

    // Noise: clearly non-content items (landing pages, navigation
    // cruft, meta-descriptions). The intelligent packager hard-deletes
    // these by not persisting them at all and emitting a single DELETE
    // log row per item so the operator can see what the janitor
    // dropped — no archive, no review, just gone.
    const noiseLogs: DataManagementLogInput[] = noise.map(({ item, reason }) => ({
      action: "DELETE",
      contentType: ENTITY_TYPE_BY_KIND[item.kind] ?? "Unknown",
      contentRef:
        (item as { slug?: string }).slug ??
        (item as { defaultTitle?: string }).defaultTitle ??
        (item as { title?: string }).title ??
        (item as { canonicalName?: string }).canonicalName ??
        null,
      reason: `Discarded as noise (landing page / nav cruft / meta-description): ${reason}`,
      triggeredBy,
      actorUsername: options.actorUsername ?? null,
    }));

    // Structural rejections: missing slug, off-allowlist, protected
    // kind. These never reach the catalog and never make it past the
    // sanitize() function — they go straight to the REJECT log.
    const rejectionLogs: DataManagementLogInput[] = rejected.map(({ item, reason }) => ({
      action: "REJECT",
      contentType: ENTITY_TYPE_BY_KIND[item.kind] ?? "Unknown",
      contentRef:
        (item as { slug?: string }).slug ??
        (item as { defaultTitle?: string }).defaultTitle ??
        (item as { title?: string }).title ??
        (item as { canonicalName?: string }).canonicalName ??
        null,
      reason: `Rejected by validator: ${reason}`,
      triggeredBy,
      actorUsername: options.actorUsername ?? null,
    }));

    // Re-classified items: log when the classifier changed the
    // adapter's `kind` so the admin can see which buckets the
    // packager is routing things into.
    const reclassifyLogs: DataManagementLogInput[] = classifyResults
      .filter((r) => r.newKind !== r.originalKind)
      .map((r) => ({
        action: "CATEGORY_FIX",
        contentType: ENTITY_TYPE_BY_KIND[r.newKind] ?? "Unknown",
        contentRef:
          (r.item as { slug?: string }).slug ??
          (r.item as { defaultTitle?: string }).defaultTitle ??
          (r.item as { title?: string }).title ??
          (r.item as { canonicalName?: string }).canonicalName ??
          null,
        reason: `Re-classified from ${r.originalKind} → ${r.newKind} by content classifier`,
        triggeredBy,
        actorUsername: options.actorUsername ?? null,
      }));

    // Soft-review items are persisted as REVIEW; tag them so the admin
    // can see *why* they were diverted.
    const softReviewLogs: DataManagementLogInput[] = review.map(({ item, reason }) => ({
      action: "CATEGORY_FIX",
      contentType: ENTITY_TYPE_BY_KIND[item.kind] ?? "Unknown",
      contentRef:
        (item as { slug?: string }).slug ??
        (item as { defaultTitle?: string }).defaultTitle ??
        (item as { title?: string }).title ??
        (item as { canonicalName?: string }).canonicalName ??
        null,
      reason: `Sent to review: ${reason}`,
      triggeredBy,
      actorUsername: options.actorUsername ?? null,
    }));

    const allLogs: DataManagementLogInput[] = [
      ...counts.logs,
      ...reviewCounts.logs,
      ...reclassifyLogs,
      ...softReviewLogs,
      ...noiseLogs,
      ...rejectionLogs,
    ];
    if (allLogs.length > 0) {
      await recordDataManagementLogs(allLogs).catch((err) => {
        logger.warn("ingestion.run.data_management_log_failed", {
          adapter: adapter.key,
          sourceHost,
          jobId,
          errorMessage: err instanceof Error ? err.message : String(err),
        });
      });
    }

    // When new + updated rows land in REVIEW status (either because the
    // configured initialStatus is REVIEW, or because the soft validator
    // diverted them), every persisted row in that bucket counts toward
    // the review queue.
    const directReview = initialStatus === "REVIEW" ? counts.created + counts.updated : 0;
    const softReview = reviewCounts.created + reviewCounts.updated;

    const summary: IngestionRunSummary = {
      recordsSeen: items.length,
      recordsCreated: counts.created + reviewCounts.created,
      recordsUpdated: counts.updated + reviewCounts.updated,
      recordsSkipped: counts.skipped + reviewCounts.skipped + noise.length + rejected.length,
      recordsFailed: 0,
      recordsReviewRequired: directReview + softReview,
      errorMessage:
        noise.length || rejected.length || review.length
          ? `${noise.length} discarded as noise, ${rejected.length} rejected, ${review.length} routed to REVIEW`
          : null,
    };

    if (run) {
      await prisma.ingestionJobRun.update({
        where: { id: run.id },
        data: {
          finishedAt: new Date(),
          status: rejected.length > 0 ? "PARTIAL" : "SUCCESS",
          recordsSeen: summary.recordsSeen,
          recordsCreated: summary.recordsCreated,
          recordsUpdated: summary.recordsUpdated,
          recordsSkipped: summary.recordsSkipped,
          recordsFailed: summary.recordsFailed,
          recordsReviewRequired: summary.recordsReviewRequired,
          errorMessage: nextState ? JSON.stringify(nextState) : summary.errorMessage,
        },
      });
    }

    const reclassifiedCount = classifyResults.filter((r) => r.newKind !== r.originalKind).length;

    logger.info("ingestion.run.completed", {
      adapter: adapter.key,
      sourceHost,
      jobId,
      durationMs: Date.now() - startedAt.getTime(),
      recordsSeen: summary.recordsSeen,
      recordsCreated: summary.recordsCreated,
      recordsUpdated: summary.recordsUpdated,
      recordsSkipped: summary.recordsSkipped,
      recordsFailed: summary.recordsFailed,
      recordsReviewRequired: summary.recordsReviewRequired,
      published: initialStatus === "PUBLISHED" ? counts.created + counts.updated : 0,
      reclassified: reclassifiedCount,
      noiseDiscarded: noise.length,
      rejected: rejected.length,
      partial: rejected.length > 0,
    });

    return summary;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (run) {
      await prisma.ingestionJobRun.update({
        where: { id: run.id },
        data: {
          finishedAt: new Date(),
          status: "FAILED",
          recordsFailed: 1,
          errorMessage,
        },
      });
    }
    // Also write a FAIL row to DataManagementLog so the admin log page
    // explains every run-level failure — not just the per-item REJECT
    // rows. Without this, an entire scheduler tick that 503s upstream
    // is invisible to anyone watching /admin/logs/data-management.
    await recordDataManagementLogs([
      {
        action: "FAIL",
        contentType: "IngestionRun",
        contentRef: adapter.key,
        reason: `Run failed: ${errorMessage.slice(0, 240)}`,
        triggeredBy: options.triggeredBy ?? "automatic",
        actorUsername: options.actorUsername ?? null,
      },
    ]).catch((err) => {
      logger.warn("ingestion.run.fail_log_failed", {
        adapter: adapter.key,
        sourceHost,
        jobId,
        errorMessage: err instanceof Error ? err.message : String(err),
      });
    });
    logger.error("ingestion.run.failed", {
      adapter: adapter.key,
      sourceHost,
      jobId,
      durationMs: Date.now() - startedAt.getTime(),
      errorMessage,
    });
    return { ...NO_OP_SUMMARY, recordsFailed: 1, errorMessage };
  }
}
