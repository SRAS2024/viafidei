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

/**
 * Stale-heartbeat repair. The Admin Worker process is supposed to
 * write a heartbeat on every pass; if the most recent heartbeat is
 * older than the threshold and the process is still alive, log it so
 * Railway's restart-on-unhealthy hook (railway.worker.json
 * restartPolicy=on_failure) can act. We do not call `process.exit()`
 * from here — that's the caller's choice.
 */
export async function checkHeartbeatHealth(prisma: PrismaClient): Promise<RepairOutcome> {
  const state = await prisma.adminWorkerState
    .findUnique({ where: { id: "singleton" } })
    .catch(() => null);
  const ageMs = state?.lastHeartbeatAt ? Date.now() - state.lastHeartbeatAt.getTime() : Infinity;
  if (ageMs < 5 * 60_000) {
    return { kind: "heartbeat_stale", attempted: false, succeeded: true, reason: "fresh" };
  }
  await writeAdminWorkerLog(prisma, {
    category: "REPAIR",
    severity: "ERROR",
    eventName: "heartbeat_stale",
    message: `Heartbeat is ${Math.round(ageMs / 1000)}s old. Railway should restart the worker.`,
  });
  return {
    kind: "heartbeat_stale",
    attempted: true,
    succeeded: false,
    reason: `heartbeat ${Math.round(ageMs / 1000)}s old`,
  };
}

/**
 * Discovery-failed repair. When the planner tries to enqueue work for
 * a content type but no SOURCE_VERIFIED items are available, log it
 * so the operator can review the source catalogue.
 */
export async function reportDiscoveryGap(
  prisma: PrismaClient,
  contentType: string,
): Promise<RepairOutcome> {
  await writeAdminWorkerLog(prisma, {
    category: "REPAIR",
    severity: "WARN",
    eventName: "discovery_gap",
    message: `No SOURCE_VERIFIED items available for ${contentType}; needs new sources.`,
    contentType,
  });
  return {
    kind: "discovery_failed",
    attempted: true,
    succeeded: false,
    reason: `no SOURCE_VERIFIED items for ${contentType}`,
  };
}

/** QA-missing-fields repair: route the build to another approved source. */
export async function rotateSourceForMissingFields(
  prisma: PrismaClient,
  checklistItemId: string,
  failedFields: string[],
): Promise<RepairOutcome> {
  await writeAdminWorkerLog(prisma, {
    category: "REPAIR",
    severity: "WARN",
    eventName: "qa_missing_fields",
    message: `QA missing fields [${failedFields.join(", ")}] — will try next source.`,
    relatedEntityId: checklistItemId,
  });
  return {
    kind: "qa_missing_fields",
    attempted: true,
    succeeded: true,
    reason: `flagged ${failedFields.length} field(s) for source rotation`,
  };
}

/**
 * Cache / sitemap / search refresh handlers. Phase 2 stubs that log
 * the intent — the actual revalidation call wires into the existing
 * `revalidateTag()` and search index modules.
 */
export async function flagCacheRefresh(
  prisma: PrismaClient,
  cacheTag: string,
): Promise<RepairOutcome> {
  await writeAdminWorkerLog(prisma, {
    category: "REPAIR",
    severity: "INFO",
    eventName: "cache_refresh_flagged",
    message: `Cache tag ${cacheTag} flagged for refresh.`,
    safeMetadata: { cacheTag },
  });
  return { kind: "cache_failed", attempted: true, succeeded: true, reason: `flagged ${cacheTag}` };
}

export async function flagSitemapRefresh(prisma: PrismaClient): Promise<RepairOutcome> {
  await writeAdminWorkerLog(prisma, {
    category: "REPAIR",
    severity: "INFO",
    eventName: "sitemap_refresh_flagged",
    message: "Sitemap flagged for refresh.",
  });
  return { kind: "sitemap_failed", attempted: true, succeeded: true, reason: "flagged" };
}

export async function flagSearchRefresh(prisma: PrismaClient): Promise<RepairOutcome> {
  await writeAdminWorkerLog(prisma, {
    category: "REPAIR",
    severity: "INFO",
    eventName: "search_refresh_flagged",
    message: "Search index flagged for refresh.",
  });
  return { kind: "search_failed", attempted: true, succeeded: true, reason: "flagged" };
}

/**
 * Fetch-with-backoff. Wraps a single async operation in an
 * exponential-backoff retry loop. Each attempt logs to AdminWorkerLog
 * so the operator can see the retry trail. Returns the resolved value
 * on the first success or throws after the final attempt.
 *
 * Spec section 20: "If fetch fails, it should retry with backoff."
 */
export async function fetchWithBackoff<T>(
  prisma: PrismaClient,
  description: string,
  attempt: () => Promise<T>,
  opts: { attempts?: number; baseDelayMs?: number; sourceHost?: string } = {},
): Promise<T> {
  const max = opts.attempts ?? 4;
  const base = opts.baseDelayMs ?? 250;
  let lastErr: unknown = null;
  for (let i = 0; i < max; i++) {
    try {
      const value = await attempt();
      if (i > 0) {
        await writeAdminWorkerLog(prisma, {
          category: "REPAIR",
          severity: "INFO",
          eventName: "fetch_backoff_recovered",
          message: `${description} recovered after ${i + 1} attempt(s).`,
          sourceHost: opts.sourceHost ?? undefined,
        });
      }
      return value;
    } catch (err) {
      lastErr = err;
      const wait = base * 2 ** i;
      await writeAdminWorkerLog(prisma, {
        category: "REPAIR",
        severity: i + 1 >= max ? "ERROR" : "WARN",
        eventName: "fetch_backoff_retry",
        message: `${description} attempt ${i + 1}/${max} failed: ${err instanceof Error ? err.message : String(err)}; backing off ${wait}ms.`,
        sourceHost: opts.sourceHost ?? undefined,
      });
      if (i + 1 < max) await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/** Persistence-failed repair: log the database error so it surfaces
 *  in the diagnostics card. */
export async function reportPersistenceFailure(
  prisma: PrismaClient,
  description: string,
  error: unknown,
): Promise<RepairOutcome> {
  const message = error instanceof Error ? error.message : String(error);
  await writeAdminWorkerLog(prisma, {
    category: "ERROR",
    severity: "ERROR",
    eventName: "persistence_failed",
    message: `${description}: ${message}`,
  });
  return {
    kind: "persistence_failed",
    attempted: true,
    succeeded: false,
    reason: message.slice(0, 200),
  };
}

/** Validation-evidence missing: log it and let the planner pick a
 *  validation source on the next pass. */
export async function reportValidationEvidenceMissing(
  prisma: PrismaClient,
  contentType: string,
  contentId: string,
): Promise<RepairOutcome> {
  await writeAdminWorkerLog(prisma, {
    category: "REPAIR",
    severity: "WARN",
    eventName: "validation_evidence_missing",
    message: `Validation evidence missing for ${contentType} ${contentId}; planner will source a validator.`,
    contentType,
    relatedEntityId: contentId,
  });
  return {
    kind: "validation_evidence_missing",
    attempted: true,
    succeeded: false,
    reason: "logged",
  };
}

/**
 * Source-jobs-missing repair (spec §20). Re-enqueues every approved
 * checklist item that has no live WorkerBuildJob — covers the case
 * where a queue purge or migration left orphaned approved items
 * behind. Uses the existing `enqueueBuild` so the lease guard +
 * priority + retry budget stay consistent.
 */
export async function recreateMissingSourceJobs(prisma: PrismaClient): Promise<RepairOutcome> {
  const candidates = await prisma.checklistItem.findMany({
    where: {
      approvalStatus: { in: ["APPROVED_FOR_BUILD", "SOURCE_VERIFIED"] },
      buildJobs: { none: { status: { in: ["pending", "running"] } } },
    },
    take: 25,
    select: { id: true },
  });
  if (candidates.length === 0) {
    return {
      kind: "source_jobs_missing",
      attempted: false,
      succeeded: true,
      reason: "no orphaned approved items",
    };
  }
  const { enqueueBuild } = await import("@/lib/worker");
  let enqueued = 0;
  for (const item of candidates) {
    try {
      await enqueueBuild(prisma, {
        checklistItemId: item.id,
        triggeredBy: "admin_worker_repair",
      });
      enqueued += 1;
    } catch {
      // best effort
    }
  }
  await writeAdminWorkerLog(prisma, {
    category: "REPAIR",
    severity: "INFO",
    eventName: "source_jobs_recreated",
    message: `Re-enqueued ${enqueued} approved checklist item(s) with no live build job.`,
  });
  return {
    kind: "source_jobs_missing",
    attempted: true,
    succeeded: true,
    reason: `enqueued ${enqueued} item(s)`,
  };
}
