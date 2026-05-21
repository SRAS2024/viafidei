/**
 * Public growth recovery.
 *
 * When the catalog has zero strict-public rows but the worker is
 * healthy, this orchestrates the recovery: it repairs missing source
 * jobs and enqueues the growth bootstrap, then names the exact stage
 * the pipeline is stuck at — so the admin never just sees "no content
 * growth".
 */

import { logger } from "../observability/logger";
import { enqueueJob } from "../ingestion/queue/queue";
import { runSourceJobRepair } from "../ingestion/queue/source-job-repair";
import { getPipelineStatus, type PipelineStatus } from "./pipeline-status";

export type PublicGrowthFailingStage =
  | "none"
  | "worker missing"
  | "source jobs missing"
  | "source documents not created"
  | "builds not enqueued"
  | "builders failing"
  | "strict QA rejecting"
  | "persistence failing"
  | "public gate failing";

export type PublicGrowthRecoveryReport = {
  generatedAt: Date;
  ranRecovery: boolean;
  publicCountBefore: number;
  failingStage: PublicGrowthFailingStage;
  actionsTaken: string[];
  errors: string[];
};

/**
 * Name the exact stage the pipeline is stuck at. Walks the chain in
 * order so the most-upstream stall is always the one reported.
 */
export function determineFailingStage(status: PipelineStatus): PublicGrowthFailingStage {
  if (!status.workerHealthy) return "worker missing";
  if (status.queuePending === 0 && status.queueRunning === 0 && status.sourceDocuments === 0)
    return "source jobs missing";
  if (status.sourceDocuments === 0) return "source documents not created";
  if (status.buildLogs === 0) return "builds not enqueued";
  if (status.completePackages === 0) return "builders failing";
  if (status.qaPasses === 0) return "strict QA rejecting";
  if (status.persistedPackages === 0) return "persistence failing";
  if (status.strictPublicRows === 0) return "public gate failing";
  return "none";
}

export async function runPublicGrowthRecovery(
  options: { triggeredBy?: "automatic" | "manual" } = {},
): Promise<PublicGrowthRecoveryReport> {
  const generatedAt = new Date();
  const triggeredBy = options.triggeredBy ?? "automatic";
  const actionsTaken: string[] = [];
  const errors: string[] = [];

  const before = await getPipelineStatus();

  // The catalog already has public content — nothing to recover.
  if (before.strictPublicRows > 0) {
    return {
      generatedAt,
      ranRecovery: false,
      publicCountBefore: before.strictPublicRows,
      failingStage: "none",
      actionsTaken: [],
      errors,
    };
  }

  // No worker — recovery cannot make progress until the worker is
  // alive again. Name the worker as the failing stage.
  if (!before.workerHealthy) {
    return {
      generatedAt,
      ranRecovery: false,
      publicCountBefore: 0,
      failingStage: "worker missing",
      actionsTaken: [],
      errors,
    };
  }

  // Worker is healthy and the catalog is empty — kick the pipeline.
  try {
    const repair = await runSourceJobRepair({ triggeredBy });
    actionsTaken.push(`source job repair: ${repair.discoveryJobsCreated} discovery job(s) created`);
  } catch (e) {
    errors.push(`source job repair: ${e instanceof Error ? e.message : String(e)}`);
  }

  try {
    await enqueueJob({
      jobName: "public-growth-recovery-bootstrap",
      jobKind: "content_growth_bootstrap",
      dedupeKey: "public_growth_recovery_bootstrap",
      payload: { triggeredBy },
      triggeredBy,
    });
    actionsTaken.push("enqueued content_growth_bootstrap");
  } catch (e) {
    errors.push(`bootstrap enqueue: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Re-read the pipeline so the failing stage reflects the state
  // after the recovery actions were enqueued.
  const after = await getPipelineStatus();
  const failingStage = determineFailingStage(after);

  logger.info("public-growth-recovery.completed", {
    ranRecovery: true,
    failingStage,
    actionsTaken: actionsTaken.length,
    errors: errors.length,
  });

  return {
    generatedAt,
    ranRecovery: true,
    publicCountBefore: 0,
    failingStage,
    actionsTaken,
    errors,
  };
}
