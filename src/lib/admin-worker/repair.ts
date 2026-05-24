/**
 * Self-repair handlers. The Admin Worker recovers from common
 * pipeline failures without admin intervention.
 *
 * Phase 1 ships the repair catalogue + safe handlers for the cases
 * that have no external side-effects (queue recovery, source job
 * creation, reputation pause). Cache / sitemap / search refresh land
 * in Phase 2 with the post-publish verifier.
 */

import type { PrismaClient } from "@prisma/client";

import { writeAdminWorkerLog } from "./logs";

export type RepairKind =
  | "heartbeat_stale"
  | "queue_stuck"
  | "source_jobs_missing"
  | "discovery_failed"
  | "fetch_failed"
  | "build_repeated_failure"
  | "qa_missing_fields"
  | "validation_evidence_missing"
  | "persistence_failed"
  | "public_display_failed"
  | "cache_failed"
  | "sitemap_failed"
  | "search_failed";

export interface RepairOutcome {
  kind: RepairKind;
  attempted: boolean;
  succeeded: boolean;
  reason: string;
}

export async function recoverStuckQueue(prisma: PrismaClient): Promise<RepairOutcome> {
  // Stuck = WorkerBuildJob in RUNNING for > 10 min without progress.
  const cutoff = new Date(Date.now() - 10 * 60_000);
  const stuck = await prisma.workerBuildJob.findMany({
    where: { status: "running", updatedAt: { lt: cutoff } },
    take: 50,
  });
  if (stuck.length === 0) {
    return {
      kind: "queue_stuck",
      attempted: false,
      succeeded: true,
      reason: "no stuck jobs",
    };
  }
  await prisma.workerBuildJob.updateMany({
    where: { id: { in: stuck.map((s) => s.id) } },
    data: { status: "pending", leasedBy: null, leaseExpiresAt: null },
  });
  await writeAdminWorkerLog(prisma, {
    category: "REPAIR",
    severity: "WARN",
    eventName: "queue_recovered",
    message: `Released ${stuck.length} stuck running build job(s).`,
  });
  return {
    kind: "queue_stuck",
    attempted: true,
    succeeded: true,
    reason: `released ${stuck.length} stuck job(s)`,
  };
}

export async function pauseChronicallyFailingSource(
  prisma: PrismaClient,
  sourceHost: string,
): Promise<RepairOutcome> {
  await prisma.adminWorkerSourceReputation.updateMany({
    where: { sourceHost },
    data: { paused: true, reputationTier: "PAUSED" },
  });
  await writeAdminWorkerLog(prisma, {
    category: "REPAIR",
    severity: "WARN",
    eventName: "source_paused",
    message: `Paused source ${sourceHost} due to chronic failures.`,
    sourceHost,
  });
  return {
    kind: "build_repeated_failure",
    attempted: true,
    succeeded: true,
    reason: `paused ${sourceHost}`,
  };
}
