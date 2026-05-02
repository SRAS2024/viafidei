import type { ContentStatus } from "@prisma/client";
import { prisma } from "../db/client";
import { withAdvisoryLock } from "../concurrency/lock";
import type { ConditionalState, IngestionRunSummary, SourceAdapter } from "./types";
import { sanitize } from "./validate";
import { persistItems } from "./persist";

export type RunnerOptions = {
  /**
   * Status assigned to newly-created or revived items. Defaults to the value
   * of INGESTION_INITIAL_STATUS env var (or REVIEW) so nothing scraped becomes
   * live without explicit approval.
   */
  initialStatus?: ContentStatus;
  /** When true, skips DB locking. Used by tests. */
  skipLock?: boolean;
};

function defaultInitialStatus(): ContentStatus {
  const raw = process.env.INGESTION_INITIAL_STATUS?.toUpperCase();
  if (raw === "DRAFT" || raw === "REVIEW") return raw;
  return "REVIEW";
}

const NO_OP_SUMMARY: IngestionRunSummary = {
  recordsSeen: 0,
  recordsCreated: 0,
  recordsUpdated: 0,
  recordsSkipped: 0,
  errorMessage: null,
};

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
            ...summary,
            errorMessage: nextState ? JSON.stringify(nextState) : null,
          },
        });
      }
      return summary;
    }

    const { valid, rejected } = sanitize(items);
    const counts = await persistItems(valid, initialStatus);
    const summary: IngestionRunSummary = {
      recordsSeen: items.length,
      recordsCreated: counts.created,
      recordsUpdated: counts.updated,
      recordsSkipped: counts.skipped + rejected.length,
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
          errorMessage: nextState ? JSON.stringify(nextState) : summary.errorMessage,
        },
      });
    }

    return summary;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (run) {
      await prisma.ingestionJobRun.update({
        where: { id: run.id },
        data: {
          finishedAt: new Date(),
          status: "FAILED",
          errorMessage,
        },
      });
    }
    return { ...NO_OP_SUMMARY, errorMessage };
  }
}
