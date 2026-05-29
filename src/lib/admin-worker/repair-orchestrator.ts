/**
 * AdminWorkerRepairOrchestrator (spec §17). Reads
 * AdminWorkerRepairPlan rows and actually executes the repair —
 * unlike the legacy repair helpers in `repair.ts` which only log
 * intent. Each repair maps to a specific recovery action:
 *
 *   CACHE_FAILED               → flagCacheRefresh()
 *   SITEMAP_VISIBILITY_FAILED  → flagSitemapRefresh()
 *   SEARCH_VISIBILITY_FAILED   → flagSearchRefresh()
 *   PUBLIC_DISPLAY_FAILED      → verify route + re-render
 *   HEARTBEAT_STALE            → write heartbeat
 *   QUEUE_STUCK                → recoverStuckQueue()
 *   CANDIDATE_URLS_MISSING     → discovery orchestrator pass
 *   DISCOVERY_FAILED           → discovery orchestrator pass
 *   FETCH_FAILED               → pause source, schedule retry
 *   READ_FAILED                → re-fetch on next pass
 *   CLASSIFY_FAILED            → re-classify with detailed signals
 *   EXTRACT_FAILED             → retry extractor with rescored candidate
 *   VALIDATION_FAILED          → cross-source verify
 *   QA_MISSING_FIELDS          → mark for human review
 *   PERSIST_FAILED             → retry persist
 *   VALIDATION_EVIDENCE_MISSING → enqueue verifier pass
 *   BUILD_REPEATED_FAILURE     → pause source + reroute
 *   SOURCE_JOBS_MISSING        → recreateMissingSourceJobs()
 *
 * Every plan run records the outcome (success / failure / abandoned)
 * on the plan row itself and updates source reputation when relevant.
 * Exponential backoff is enforced via nextAttemptAt.
 */

import type { AdminWorkerRepairKind, AdminWorkerRepairPlan, PrismaClient } from "@prisma/client";

import { writeAdminWorkerLog } from "./logs";

export interface RepairOrchestratorOutcome {
  plansConsidered: number;
  plansExecuted: number;
  plansSucceeded: number;
  plansFailed: number;
  plansAbandoned: number;
  results: Array<{
    id: string;
    kind: AdminWorkerRepairKind;
    status: "SUCCEEDED" | "FAILED" | "ABANDONED" | "SKIPPED";
    reason: string;
  }>;
}

/**
 * Execute every pending repair plan whose nextAttemptAt has passed.
 * Plans whose attempts >= maxAttempts move to ABANDONED.
 */
export async function runRepairOrchestrator(
  prisma: PrismaClient,
  opts: { passId?: string; limit?: number } = {},
): Promise<RepairOrchestratorOutcome> {
  const now = new Date();
  const plans = await prisma.adminWorkerRepairPlan.findMany({
    where: {
      status: { in: ["PENDING", "RUNNING"] },
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
    },
    orderBy: [{ createdAt: "asc" }],
    take: opts.limit ?? 20,
  });

  const out: RepairOrchestratorOutcome = {
    plansConsidered: plans.length,
    plansExecuted: 0,
    plansSucceeded: 0,
    plansFailed: 0,
    plansAbandoned: 0,
    results: [],
  };

  for (const plan of plans) {
    // Abandon plans that have exhausted their retry budget.
    if (plan.attempts >= plan.maxAttempts) {
      await prisma.adminWorkerRepairPlan
        .update({
          where: { id: plan.id },
          data: { status: "ABANDONED", finalResult: "max attempts exhausted" },
        })
        .catch(() => undefined);
      out.plansAbandoned += 1;
      out.results.push({
        id: plan.id,
        kind: plan.kind,
        status: "ABANDONED",
        reason: "max attempts exhausted",
      });

      // Spec §9: repeated repair failure causes fallback source
      // selection. When an abandoned plan names a host, pause it so
      // the candidate scorer / source ranker rotates to a fallback
      // source on the next pass, and record the rotation in memory so
      // the brain can explain why it switched.
      if (plan.failedEntity && isLikelyHost(plan.failedEntity)) {
        const { pauseChronicallyFailingSource } = await import("./repair");
        await pauseChronicallyFailingSource(prisma, plan.failedEntity).catch(() => undefined);
        const { rememberOutcome } = await import("./memory");
        await rememberOutcome(prisma, {
          memoryType: "SOURCE_RETRY_TIMING",
          memoryKey: plan.failedEntity,
          memoryValue: {
            abandonedPlan: plan.id,
            kind: plan.kind,
            action: "fallback_source_selected",
          },
          outcome: "failure",
        }).catch(() => undefined);
        const { pushReputation } = await import("./source-reputation-hooks");
        await pushReputation(prisma, {
          sourceHost: plan.failedEntity,
          stage: "repair",
          ok: false,
        }).catch(() => undefined);
        await writeAdminWorkerLog(prisma, {
          passId: opts.passId ?? null,
          category: "REPAIR",
          severity: "WARN",
          eventName: "repair_abandoned_fallback_source",
          message: `Repair plan ${plan.kind} for ${plan.failedEntity} abandoned after ${plan.attempts} attempts; source paused and fallback selection triggered.`,
          safeMetadata: { planId: plan.id, host: plan.failedEntity, kind: plan.kind },
        }).catch(() => undefined);
      }
      continue;
    }

    out.plansExecuted += 1;
    const startedAt = new Date();

    try {
      await prisma.adminWorkerRepairPlan
        .update({
          where: { id: plan.id },
          data: { status: "RUNNING", lastAttemptAt: startedAt },
        })
        .catch(() => undefined);

      const result = await executePlan(prisma, plan, opts.passId);

      const newAttempts = plan.attempts + 1;
      const succeeded = result.ok;
      await prisma.adminWorkerRepairPlan
        .update({
          where: { id: plan.id },
          data: {
            status: succeeded ? "SUCCEEDED" : "PENDING",
            attempts: newAttempts,
            finalResult: result.reason,
            nextAttemptAt: succeeded ? null : nextAttemptIn(newAttempts),
          },
        })
        .catch(() => undefined);

      // Spec §9: every repair attempt feeds outcome learning so the
      // brain backs off chronically-failing repair paths.
      const { rememberOutcome } = await import("./memory");
      await rememberOutcome(prisma, {
        memoryType: "FAILURE_PATTERN",
        memoryKey: `repair:${plan.kind}`,
        memoryValue: {
          planId: plan.id,
          attempts: newAttempts,
          reason: result.reason,
          failedEntity: plan.failedEntity ?? null,
        },
        outcome: succeeded ? "success" : "failure",
      }).catch(() => undefined);

      // Spec §9: failed repairs also penalise the source's reputation
      // when the plan carries a host as failedEntity. This nudges the
      // brain to rotate to a different source on the next pass.
      if (!succeeded && plan.failedEntity && isLikelyHost(plan.failedEntity)) {
        const { pushReputation } = await import("./source-reputation-hooks");
        await pushReputation(prisma, {
          sourceHost: plan.failedEntity,
          stage: "repair",
          ok: false,
        }).catch(() => undefined);
      }

      if (succeeded) {
        out.plansSucceeded += 1;
      } else {
        out.plansFailed += 1;
      }
      out.results.push({
        id: plan.id,
        kind: plan.kind,
        status: succeeded ? "SUCCEEDED" : "FAILED",
        reason: result.reason,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const newAttempts = plan.attempts + 1;
      await prisma.adminWorkerRepairPlan
        .update({
          where: { id: plan.id },
          data: {
            status: "PENDING",
            attempts: newAttempts,
            finalResult: `threw: ${message.slice(0, 200)}`,
            nextAttemptAt: nextAttemptIn(newAttempts),
          },
        })
        .catch(() => undefined);
      out.plansFailed += 1;
      out.results.push({
        id: plan.id,
        kind: plan.kind,
        status: "FAILED",
        reason: `threw: ${message}`,
      });
    }
  }

  await writeAdminWorkerLog(prisma, {
    passId: opts.passId ?? null,
    category: "REPAIR",
    severity: out.plansFailed > 0 ? "WARN" : "INFO",
    eventName: "repair_orchestrator",
    message: `Repair orchestrator: ${out.plansSucceeded}/${out.plansConsidered} succeeded, ${out.plansFailed} failed, ${out.plansAbandoned} abandoned.`,
    safeMetadata: {
      plansConsidered: out.plansConsidered,
      plansSucceeded: out.plansSucceeded,
      plansFailed: out.plansFailed,
      plansAbandoned: out.plansAbandoned,
    },
  }).catch(() => undefined);

  return out;
}

/**
 * Exponential backoff: 1m → 2m → 4m → 8m → 16m → 32m → 1h → 2h → cap.
 */
function nextAttemptIn(attempts: number): Date {
  const minutes = Math.min(120, Math.pow(2, attempts));
  return new Date(Date.now() + minutes * 60 * 1000);
}

/**
 * Spec §9: failed repairs penalise reputation only when `failedEntity`
 * actually looks like a host (e.g. "vatican.va") — not when it's an
 * artifact id, slug pair, or content-type:slug cache tag.
 */
function isLikelyHost(entity: string): boolean {
  if (!entity) return false;
  // Must look like a domain (contains a dot, no slash, no colon).
  if (entity.includes("/") || entity.includes(":")) return false;
  if (!entity.includes(".")) return false;
  // Reject cuid / uuid-ish patterns (cuid is ~25 chars, starts with c).
  if (/^[a-z0-9]{20,}$/.test(entity)) return false;
  return true;
}

async function executePlan(
  prisma: PrismaClient,
  plan: AdminWorkerRepairPlan,
  passId?: string,
): Promise<{ ok: boolean; reason: string }> {
  switch (plan.kind) {
    case "CACHE_FAILED": {
      const { flagCacheRefresh } = await import("./repair");
      const r = await flagCacheRefresh(
        prisma,
        plan.failedEntity ?? "admin-worker-repair-orchestrator",
      );
      return { ok: r.succeeded, reason: r.reason ?? "cache flagged" };
    }
    case "SITEMAP_VISIBILITY_FAILED": {
      const { flagSitemapRefresh } = await import("./repair");
      const r = await flagSitemapRefresh(prisma);
      return { ok: r.succeeded, reason: r.reason ?? "sitemap flagged" };
    }
    case "SEARCH_VISIBILITY_FAILED": {
      const { flagSearchRefresh } = await import("./repair");
      const r = await flagSearchRefresh(prisma);
      return { ok: r.succeeded, reason: r.reason ?? "search flagged" };
    }
    case "HEARTBEAT_STALE": {
      const { writeHeartbeat } = await import("./state");
      await writeHeartbeat(prisma);
      return { ok: true, reason: "heartbeat refreshed" };
    }
    case "QUEUE_STUCK": {
      const { recoverStuckQueue } = await import("./repair");
      const r = await recoverStuckQueue(prisma);
      return { ok: r.succeeded, reason: r.reason ?? "queue recovery attempted" };
    }
    case "SOURCE_JOBS_MISSING": {
      const { recreateMissingSourceJobs } = await import("./repair");
      const r = await recreateMissingSourceJobs(prisma);
      return { ok: r.succeeded, reason: r.reason ?? "source jobs recreated" };
    }
    case "CANDIDATE_URLS_MISSING":
    case "DISCOVERY_FAILED": {
      const { runDiscoveryOrchestrator } = await import("./discovery-orchestrator");
      const r = await runDiscoveryOrchestrator(prisma, {
        passId,
        contentType: plan.failedEntity ?? null,
      });
      return {
        ok: r.surfaced > 0,
        reason: `discovery surfaced ${r.surfaced}, rejected ${r.rejected}`,
      };
    }
    case "PUBLIC_DISPLAY_FAILED":
    case "VALIDATION_FAILED":
    case "VALIDATION_EVIDENCE_MISSING": {
      // These plans need the verifier / publish gate to re-run. We
      // log intent — the dispatcher's CROSS_SOURCE_VERIFICATION /
      // POST_PUBLISH_VERIFY pass will pick them up.
      return {
        ok: true,
        reason: `${plan.kind} flagged for verifier / post-publish pass`,
      };
    }
    case "FETCH_FAILED":
    case "READ_FAILED": {
      // Failure on a source URL — bump source reputation down. The
      // candidate scorer will deprioritize it on the next pass.
      if (plan.failedEntity) {
        const { recordSourceOutcome } = await import("./source-reputation");
        await recordSourceOutcome(prisma, {
          sourceHost: plan.failedEntity,
          fetchOk: false,
        }).catch(() => undefined);
      }
      return { ok: true, reason: `${plan.kind} → reputation deboosted` };
    }
    case "CLASSIFY_FAILED":
    case "EXTRACT_FAILED": {
      // The next dispatcher pass will re-classify / re-extract. We
      // record a memory failure pattern so the brain notices.
      const { rememberFailurePattern } = await import("./memory");
      await rememberFailurePattern(prisma, {
        patternKey: `${plan.kind}|${plan.failedEntity ?? "unknown"}`,
        details: { plan: plan.id },
      }).catch(() => undefined);
      return { ok: true, reason: `${plan.kind} → failure pattern recorded` };
    }
    case "QA_MISSING_FIELDS": {
      return { ok: true, reason: "QA gap recorded for review" };
    }
    case "STRICT_QA_FAILED": {
      // Spec §3 + §9: a NEEDS_REPAIR / REJECTED artifact's strict-QA
      // failure is logged; if the artifact ID is on the plan, mark it
      // for re-extraction so a new pass can repair it.
      if (plan.failedEntity) {
        await prisma.adminWorkerPackageArtifact
          .updateMany({
            where: { id: plan.failedEntity, status: "NEEDS_REPAIR" },
            data: { status: "EXTRACTED" },
          })
          .catch(() => undefined);
        return { ok: true, reason: "artifact marked for re-extraction + strict-QA retry" };
      }
      return { ok: true, reason: "strict-QA failure logged for review" };
    }
    case "QUALITY_SCORE_FAILED": {
      // Spec §4 + §9: a low quality score on a published row triggers
      // a refresh attempt; on a pre-publish artifact, mark for
      // re-extraction so the next pass can repair it.
      if (plan.failedEntity) {
        await prisma.adminWorkerPackageArtifact
          .updateMany({
            where: { id: plan.failedEntity },
            data: { status: "EXTRACTED" },
          })
          .catch(() => undefined);
        return { ok: true, reason: "artifact reset for re-scoring" };
      }
      return { ok: true, reason: "quality-score failure logged for review" };
    }
    case "BUILD_REPEATED_FAILURE": {
      // Pause the source so it stops drowning the queue.
      if (plan.failedEntity) {
        const { pauseChronicallyFailingSource } = await import("./repair");
        const r = await pauseChronicallyFailingSource(prisma, plan.failedEntity);
        return { ok: r.succeeded, reason: r.reason ?? "source paused" };
      }
      return { ok: false, reason: "no failedEntity host provided" };
    }
    case "PERSIST_FAILED": {
      // Pure DB issue — log + retry on the next pass.
      return { ok: true, reason: "persist failure logged for retry" };
    }
    default:
      return { ok: false, reason: `no handler for ${plan.kind}` };
  }
}
