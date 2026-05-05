import type { ContentStatus } from "@prisma/client";
import { appConfig } from "../config";
import { prisma } from "../db/client";
import { withAdvisoryLock } from "../concurrency/lock";
import { logger } from "../observability/logger";
import type { ConditionalState, IngestionRunSummary, SourceAdapter } from "./types";
import { sanitize } from "./validate";
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

    const { valid, rejected } = sanitize(items);
    const counts = await persistItems(valid, initialStatus);

    // When new + updated rows land in REVIEW status, every persisted row
    // (created OR updated) requires moderator approval before it appears on
    // the public site. Skipped rows already lived through their review.
    const reviewRequired = initialStatus === "REVIEW" ? counts.created + counts.updated : 0;

    const summary: IngestionRunSummary = {
      recordsSeen: items.length,
      recordsCreated: counts.created,
      recordsUpdated: counts.updated,
      recordsSkipped: counts.skipped + rejected.length,
      recordsFailed: 0,
      recordsReviewRequired: reviewRequired,
      errorMessage: rejected.length ? `${rejected.length} items rejected by validation` : null,
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
