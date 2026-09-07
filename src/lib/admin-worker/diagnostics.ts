/**
 * Admin Worker diagnostics. Produces the 24 health ratings the spec
 * requires on the admin diagnostics card.
 *
 * Each rating returns one of: pass | warn | fail | unknown. The
 * diagnostics page reads these alongside the legacy diagnostics so
 * the operator gets one unified view.
 *
 * Most ratings are derived from rows the worker is already writing —
 * heartbeat, pass durations, source reputation, content goals,
 * security actions, post-publish verifications.
 */

import type { PrismaClient } from "@prisma/client";

import { workerExecutionAllowed } from "./execution-context";
import { readExecutionStatus, type ExecutionStatus } from "./execution-host";
// Reader only — it re-senses nothing and pulls in no worker machinery, so it
// is safe on the request path this module serves.
import { readSelfMaintenanceSummary, type SelfMaintenanceSummary } from "./operational-summary";

export type HealthStatus = "pass" | "warn" | "fail" | "unknown";

/**
 * Shared per-run context. The execution status (master switch + lease) is read
 * ONCE per diagnostics run and handed to every rating that judges liveness by
 * age, so none of them can call the worker "stalled" while it is intentionally
 * OFF — or "failed" when the database could not even be read.
 */
export interface DiagnosticsContext {
  /** Null when the status could not be read at all (treated as unknown). */
  execution: ExecutionStatus | null;
  /**
   * The self-maintenance sweep's persisted snapshot, read ONCE per run and
   * shared by the ratings that judge it — two ratings, one pair of queries.
   * Optional so a rating can still be called directly in a test.
   */
  selfMaintenance?: SelfMaintenanceSummary | null;
}

const INACTIVE_SUMMARY =
  "Admin Worker intentionally inactive — the master switch is OFF, so no worker runs locally and none runs in production.";
const UNKNOWN_SUMMARY = "Admin Worker state unknown — the database could not be read.";

/** The switch is provably OFF (not merely unreadable). */
function workerIntentionallyOff(ctx: DiagnosticsContext | undefined): boolean {
  return ctx?.execution?.known === true && ctx.execution.state === "OFF";
}

/** The switch/lease rows could not be read — OFF vs running is unknowable. */
function executionUnknown(ctx: DiagnosticsContext | undefined): boolean {
  return ctx?.execution != null && ctx.execution.known === false;
}

/**
 * Apply execution awareness to an age/progress rating:
 *   - worker OFF by design → pass, with the measured facts kept in the summary
 *     (the age is true; it just is not a fault), no repair advice;
 *   - execution state unknown → never worse than warn, because a red rating
 *     with "fix the stalled pipeline" advice is wrong when the only fact is
 *     that the database was unreachable.
 */
function withExecutionAwareness(
  rating: HealthRating,
  ctx: DiagnosticsContext | undefined,
): HealthRating {
  if (workerIntentionallyOff(ctx)) {
    return {
      ...rating,
      status: "pass",
      score: 1,
      summary: `${INACTIVE_SUMMARY} ${rating.summary}`,
      recommendedRepair: undefined,
    };
  }
  if (executionUnknown(ctx) && rating.status === "fail") {
    return {
      ...rating,
      status: "warn",
      score: 0.5,
      summary: `${UNKNOWN_SUMMARY} ${rating.summary}`,
    };
  }
  return rating;
}

export interface HealthRating {
  key: string;
  label: string;
  status: HealthStatus;
  score: number;
  lastCheckedAt: Date;
  dataSource: string;
  latestSuccess?: Date | null;
  latestFailure?: Date | null;
  currentBlocker?: string;
  recommendedRepair?: string;
  summary: string;
  /**
   * Spec §13: per-subsystem automatic-repair status.
   *   "in_progress" — an open repair plan (PENDING/RUNNING) maps to
   *                   this subsystem right now.
   *   "available"   — the subsystem is auto-repairable but no plan is
   *                   currently open.
   *   "manual"      — no automatic repair handler covers this subsystem.
   */
  automaticRepairStatus?: "in_progress" | "available" | "manual";
}

/**
 * Spec §13: map each subsystem rating key to the AdminWorkerRepairKind
 * values that auto-repair it. Keys absent from this map are "manual".
 */
const RATING_REPAIR_KINDS: Record<string, string[]> = {
  admin_worker_heartbeat: ["HEARTBEAT_STALE"],
  admin_worker_queue: ["QUEUE_STUCK"],
  admin_worker_source_discovery: ["DISCOVERY_FAILED", "CANDIDATE_URLS_MISSING"],
  admin_worker_fetcher: ["FETCH_FAILED"],
  admin_worker_source_reading: ["READ_FAILED", "SOURCE_JOBS_MISSING"],
  admin_worker_classification: ["CLASSIFY_FAILED"],
  admin_worker_extractors: ["EXTRACT_FAILED"],
  admin_worker_building: ["BUILD_REPEATED_FAILURE"],
  admin_worker_cross_source: ["VALIDATION_FAILED", "VALIDATION_EVIDENCE_MISSING"],
  admin_worker_verifier: ["VALIDATION_FAILED", "VALIDATION_EVIDENCE_MISSING"],
  admin_worker_strict_qa: ["STRICT_QA_FAILED", "QA_MISSING_FIELDS"],
  admin_worker_quality_scoring: ["QUALITY_SCORE_FAILED"],
  admin_worker_publishing: ["PERSIST_FAILED"],
  admin_worker_public_render: ["PUBLIC_DISPLAY_FAILED"],
  admin_worker_search: ["SEARCH_VISIBILITY_FAILED"],
  admin_worker_sitemap: ["SITEMAP_VISIBILITY_FAILED"],
  admin_worker_cache: ["CACHE_FAILED"],
};

/** Each rating returns a HealthRating shape so the UI is uniform. */
type RatingFn = (prisma: PrismaClient, ctx: DiagnosticsContext) => Promise<HealthRating>;

/** Window for "is this failing NOW" ratings — lifetime counts pinned them red forever. */
const RECENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
/** Minimum recent samples before a failure ratio may FAIL a rating. */
const MIN_SAMPLES_FOR_FAIL = 3;

/**
 * Rate a recent-window failure ratio: pass with no failures, warn on any,
 * fail only when at least half of ≥ MIN_SAMPLES_FOR_FAIL recent samples failed.
 */
function ratioStatus(recentTotal: number, recentFailed: number): HealthStatus {
  if (recentFailed === 0) return "pass";
  if (recentTotal >= MIN_SAMPLES_FOR_FAIL && recentFailed / recentTotal >= 0.5) return "fail";
  return "warn";
}

async function ratingOverall(prisma: PrismaClient): Promise<HealthRating> {
  const state = await prisma.adminWorkerState
    .findUnique({ where: { id: "singleton" } })
    .catch(() => null);
  if (!state) {
    return {
      key: "admin_worker_overall",
      label: "Admin Worker overall",
      status: "unknown",
      score: 0,
      lastCheckedAt: new Date(),
      dataSource: "AdminWorkerState",
      summary: "No AdminWorkerState row found.",
      recommendedRepair: "Run the 0024_admin_worker migration.",
    };
  }
  const status: HealthStatus = state.paused ? "warn" : state.currentBlocker ? "fail" : "pass";
  return {
    key: "admin_worker_overall",
    label: "Admin Worker overall",
    status,
    score: status === "pass" ? 1 : status === "warn" ? 0.5 : 0,
    lastCheckedAt: new Date(),
    dataSource: "AdminWorkerState",
    latestSuccess: state.lastSuccessfulAt,
    latestFailure: state.lastFailedAt,
    currentBlocker: state.currentBlocker ?? undefined,
    recommendedRepair: state.recoveryAction ?? undefined,
    summary: state.paused
      ? `Paused${state.pausedReason ? ` (${state.pausedReason})` : ""}.`
      : state.currentBlocker
        ? `Blocked: ${state.currentBlocker}`
        : `Mode: ${state.currentMode}, priority: ${state.currentPriority}.`,
  };
}

/**
 * Heartbeat rating, aware of where the Admin Worker actually executes.
 *
 * The supported production architecture is local execution (spec §24): the
 * worker runs on the operator's MacBook under the native application. So an
 * absent heartbeat is only a FAILURE when the worker is supposed to be running.
 *
 *   master switch OFF            → "Admin Worker intentionally inactive" (pass)
 *   ON + live local lease + beat  → "Admin Worker active locally" (pass)
 *   ON + no lease / no heartbeat  → genuine local worker failure (fail)
 */
async function ratingHeartbeat(
  prisma: PrismaClient,
  ctx?: DiagnosticsContext,
): Promise<HealthRating> {
  const state = await prisma.adminWorkerState
    .findUnique({ where: { id: "singleton" } })
    .catch(() => null);
  const execution = ctx?.execution ?? null;
  const last = state?.lastHeartbeatAt ?? null;
  const now = new Date();
  const ageMs = last ? now.getTime() - last.getTime() : Infinity;

  if (execution && execution.known && execution.state === "OFF") {
    return {
      key: "admin_worker_heartbeat",
      label: "Heartbeat",
      status: "pass",
      score: 1,
      lastCheckedAt: now,
      dataSource: "AdminWorkerState.lastHeartbeatAt + AdminWorkerMemory(worker.execution.*)",
      latestSuccess: last,
      summary: INACTIVE_SUMMARY,
    };
  }
  // Unreadable switch/lease: we cannot tell OFF from running, so do not
  // report a worker failure off a database failure.
  if (execution && !execution.known) {
    return {
      key: "admin_worker_heartbeat",
      label: "Heartbeat",
      status: "warn",
      score: 0.5,
      lastCheckedAt: now,
      dataSource: "AdminWorkerState.lastHeartbeatAt + AdminWorkerMemory(worker.execution.*)",
      latestSuccess: last,
      summary: `${UNKNOWN_SUMMARY}${execution.error ? ` (${execution.error})` : ""}${
        last ? ` Last heartbeat ${Math.round(ageMs / 1000)}s ago.` : ""
      }`,
      recommendedRepair: "Check database connectivity from the diagnostics host.",
    };
  }

  let status: HealthStatus = "fail";
  if (ageMs < 60_000) status = "pass";
  else if (ageMs < 5 * 60_000) status = "warn";

  const localLive = execution?.executingLocally === true;
  if (!localLive && status === "pass") status = "warn";

  const summary = last
    ? `Last heartbeat ${Math.round(ageMs / 1000)}s ago${
        localLive
          ? " — Admin Worker active locally."
          : " — no live local runtime holds the execution lease."
      }`
    : "No heartbeat recorded.";

  return {
    key: "admin_worker_heartbeat",
    label: "Heartbeat",
    status,
    score: status === "pass" ? 1 : status === "warn" ? 0.5 : 0,
    lastCheckedAt: now,
    dataSource: "AdminWorkerState.lastHeartbeatAt + AdminWorkerMemory(worker.execution.*)",
    latestSuccess: last,
    summary,
    recommendedRepair:
      status === "pass"
        ? undefined
        : "Open the Via Fidei application on the operator's MacBook and switch the Admin Worker ON. " +
          "Production never takes this work over.",
  };
}

async function ratingQueue(prisma: PrismaClient): Promise<HealthRating> {
  // Health is whether the queue is failing NOW: failed vs succeeded jobs in
  // the last 7 days. The lifetime failed count is history and only reported.
  const since = new Date(Date.now() - RECENT_WINDOW_MS);
  const [pending, failed, failedRecent, succeededRecent, lastSuccess, lastFailure] =
    await Promise.all([
      prisma.workerBuildJob.count({ where: { status: "pending" } }),
      prisma.workerBuildJob.count({ where: { status: "failed" } }),
      prisma.workerBuildJob
        .count({ where: { status: "failed", createdAt: { gte: since } } })
        .catch(() => 0),
      prisma.workerBuildJob
        .count({ where: { status: "succeeded", createdAt: { gte: since } } })
        .catch(() => 0),
      prisma.workerBuildJob.findFirst({
        where: { status: "succeeded" },
        orderBy: { finishedAt: "desc" },
        select: { finishedAt: true, errorMessage: true },
      }),
      prisma.workerBuildJob.findFirst({
        where: { status: "failed" },
        orderBy: { finishedAt: "desc" },
        select: { finishedAt: true, errorMessage: true },
      }),
    ]);
  const status: HealthStatus = ratioStatus(failedRecent + succeededRecent, failedRecent);
  return {
    key: "admin_worker_queue",
    label: "Queue processing",
    status,
    score: status === "pass" ? 1 : status === "warn" ? 0.6 : 0.2,
    lastCheckedAt: new Date(),
    dataSource: "WorkerBuildJob (last 7d)",
    summary: `${pending} pending; last 7d: ${succeededRecent} succeeded, ${failedRecent} failed (${failed} failed lifetime).`,
    latestSuccess: lastSuccess?.finishedAt ?? null,
    latestFailure: lastFailure?.finishedAt ?? null,
    currentBlocker: lastFailure?.errorMessage ?? undefined,
    recommendedRepair:
      failedRecent > 0 ? "Inspect failed jobs at /admin/checklist/failed." : undefined,
  };
}

async function ratingTaskPlanning(prisma: PrismaClient): Promise<HealthRating> {
  // The worker plans its next action every pass through the brain (an
  // AdminWorkerDecision), not the legacy AdminWorkerTask queue. Count either, so
  // the check reflects real planning under the current per-pass architecture.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [decisions, tasks] = await Promise.all([
    prisma.adminWorkerDecision.count({ where: { createdAt: { gte: since } } }).catch(() => 0),
    prisma.adminWorkerTask.count({ where: { createdAt: { gte: since } } }).catch(() => 0),
  ]);
  const planned = decisions + tasks;
  const status: HealthStatus = planned > 0 ? "pass" : "warn";
  return {
    key: "admin_worker_task_planning",
    label: "Task planning",
    status,
    score: status === "pass" ? 1 : 0.5,
    lastCheckedAt: new Date(),
    dataSource: "AdminWorkerDecision + AdminWorkerTask",
    summary: `${planned} work item(s) planned in last 24h (${decisions} brain decision(s), ${tasks} task(s)).`,
  };
}

async function ratingSourceDiscovery(prisma: PrismaClient): Promise<HealthRating> {
  const total = await prisma.candidateSourceUrl.count();
  const recent = await prisma.candidateSourceUrl.count({
    where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });
  const status: HealthStatus = total > 0 || recent > 0 ? "pass" : "warn";
  return {
    key: "admin_worker_source_discovery",
    label: "Source discovery",
    status,
    score: status === "pass" ? 1 : 0.5,
    lastCheckedAt: new Date(),
    dataSource: "CandidateSourceUrl",
    summary: `${total} candidate URLs (${recent} new in last 24h).`,
  };
}

async function ratingSourceReading(prisma: PrismaClient): Promise<HealthRating> {
  const fetched = await prisma.candidateSourceUrl.count({ where: { status: "FETCHED" } });
  const built = await prisma.candidateSourceUrl.count({ where: { status: "BUILT" } });
  const status: HealthStatus = fetched + built > 0 ? "pass" : "warn";
  return {
    key: "admin_worker_source_reading",
    label: "Source reading",
    status,
    score: status === "pass" ? 1 : 0.5,
    lastCheckedAt: new Date(),
    dataSource: "CandidateSourceUrl.status",
    summary: `${fetched} fetched, ${built} built.`,
  };
}

async function ratingSourceReputation(prisma: PrismaClient): Promise<HealthRating> {
  const total = await prisma.adminWorkerSourceReputation.count();
  const paused = await prisma.adminWorkerSourceReputation.count({ where: { paused: true } });
  const status: HealthStatus = total > 0 ? (paused > total / 2 ? "warn" : "pass") : "warn";
  return {
    key: "admin_worker_source_reputation",
    label: "Source reputation",
    status,
    score: total > 0 ? 1 - paused / total : 0.5,
    lastCheckedAt: new Date(),
    dataSource: "AdminWorkerSourceReputation",
    summary: `${total - paused} active, ${paused} paused (of ${total}).`,
  };
}

async function ratingPublishing(prisma: PrismaClient): Promise<HealthRating> {
  const [total, lastPublish, lastFailure] = await Promise.all([
    prisma.publishedContent.count({ where: { isPublished: true } }),
    prisma.publishedContent.findFirst({
      where: { isPublished: true },
      orderBy: { publishedAt: "desc" },
      select: { publishedAt: true },
    }),
    prisma.adminWorkerLog.findFirst({
      where: { category: "PUBLISHING", severity: { in: ["ERROR", "CRITICAL"] } },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, message: true },
    }),
  ]);
  const status: HealthStatus = total > 0 ? "pass" : "warn";
  return {
    key: "admin_worker_publishing",
    label: "Publishing",
    status,
    score: status === "pass" ? 1 : 0.4,
    lastCheckedAt: new Date(),
    dataSource: "PublishedContent",
    summary: `${total} items currently published.`,
    latestSuccess: lastPublish?.publishedAt ?? null,
    latestFailure: lastFailure?.createdAt ?? null,
    currentBlocker: lastFailure?.message ?? undefined,
  };
}

async function ratingPostPublish(prisma: PrismaClient): Promise<HealthRating> {
  // Windowed to 7 days and rated on the recent FAIL ratio: a single 502 during
  // a deploy months ago used to pin this red for the life of the deployment.
  const since = new Date(Date.now() - RECENT_WINDOW_MS);
  const [total, recentTotal, recentFailed] = await Promise.all([
    prisma.postPublishVerification.count(),
    prisma.postPublishVerification.count({ where: { createdAt: { gte: since } } }).catch(() => 0),
    prisma.postPublishVerification
      .count({ where: { result: "FAIL", createdAt: { gte: since } } })
      .catch(() => 0),
  ]);
  const status: HealthStatus = total === 0 ? "warn" : ratioStatus(recentTotal, recentFailed);
  return {
    key: "admin_worker_post_publish",
    label: "Post-publish verification",
    status,
    score: status === "pass" ? 1 : status === "warn" ? 0.5 : 0.2,
    lastCheckedAt: new Date(),
    dataSource: "PostPublishVerification (last 7d)",
    summary:
      total === 0
        ? "No post-publish verifications recorded yet."
        : `${recentTotal} verified in last 7d, ${recentFailed} failed (${total} lifetime).`,
    recommendedRepair:
      status === "fail"
        ? "Most recent post-publish probes are failing — check the public site is reachable from the worker before trusting any rollback."
        : undefined,
  };
}

async function ratingHumanReview(prisma: PrismaClient): Promise<HealthRating> {
  const pending = await prisma.humanReviewQueue.count({ where: { status: "PENDING" } });
  const status: HealthStatus = pending === 0 ? "pass" : pending > 25 ? "fail" : "warn";
  return {
    key: "admin_worker_human_review",
    label: "Human review queue",
    status,
    score: status === "pass" ? 1 : status === "warn" ? 0.6 : 0.2,
    lastCheckedAt: new Date(),
    dataSource: "HumanReviewQueue",
    summary: `${pending} items awaiting review.`,
  };
}

async function ratingSecurity(prisma: PrismaClient): Promise<HealthRating> {
  const recentBreaches = await prisma.securityEvent.count({
    where: {
      classification: "Breach",
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });
  const status: HealthStatus = recentBreaches === 0 ? "pass" : recentBreaches > 3 ? "fail" : "warn";
  return {
    key: "admin_worker_security",
    label: "Security defense",
    status,
    score: status === "pass" ? 1 : status === "warn" ? 0.6 : 0.2,
    lastCheckedAt: new Date(),
    dataSource: "SecurityEvent",
    summary: `${recentBreaches} confirmed breaches in last 24h.`,
  };
}

async function ratingMonthlyReport(prisma: PrismaClient): Promise<HealthRating> {
  // Track the MONTHLY EMAIL JOB's own durable rows (generatedBy stamp from
  // monthly-report-job.ts), not manual 30-day audit pulls — the old query
  // matched any LAST_30_DAYS row, so an operator pulling an audit made this
  // read "pass" while the actual month-end email had silently never sent.
  const { MONTHLY_REPORT_GENERATED_BY } = await import("./monthly-report-job");
  const lastMonthly = await prisma.adminDeveloperReportLog.findFirst({
    where: { generatedBy: MONTHLY_REPORT_GENERATED_BY, status: "GENERATED" },
    orderBy: { generatedAt: "desc" },
  });
  const status: HealthStatus = lastMonthly
    ? Date.now() - lastMonthly.generatedAt.getTime() < 32 * 24 * 60 * 60 * 1000
      ? "pass"
      : "warn"
    : "warn";
  return {
    key: "admin_worker_monthly_report",
    label: "Monthly report generation",
    status,
    score: status === "pass" ? 1 : 0.5,
    lastCheckedAt: new Date(),
    dataSource: "AdminDeveloperReportLog",
    summary: lastMonthly
      ? `Last monthly report emailed ${lastMonthly.generatedAt.toISOString().slice(0, 10)} (${(lastMonthly.includedSections ?? []).find((s) => s.startsWith("MONTH:")) ?? "month unknown"}).`
      : "No monthly report has been emailed yet (the month-end job sends it; a missed month catches up automatically).",
  };
}

async function ratingHomepage(prisma: PrismaClient): Promise<HealthRating> {
  const recent = await prisma.homepageQualityScore.findFirst({
    orderBy: { createdAt: "desc" },
  });
  const score = recent?.finalScore ?? 0;
  const status: HealthStatus = !recent
    ? "warn"
    : score >= 0.8
      ? "pass"
      : score >= 0.6
        ? "warn"
        : "fail";
  return {
    key: "admin_worker_homepage",
    label: "Homepage redesign",
    status,
    score,
    lastCheckedAt: new Date(),
    dataSource: "HomepageQualityScore",
    summary: recent ? `Homepage score ${score.toFixed(2)}.` : "Homepage has not been scored yet.",
  };
}

async function ratingContentGoals(
  prisma: PrismaClient,
  ctx?: DiagnosticsContext,
): Promise<HealthRating> {
  const goals = await prisma.contentGoal.findMany();
  if (goals.length === 0) {
    return {
      key: "admin_worker_content_goals",
      label: "Content goals",
      status: "warn",
      score: 0.5,
      lastCheckedAt: new Date(),
      dataSource: "ContentGoal",
      summary: "No content goals seeded yet.",
      recommendedRepair: "Call `seedContentGoals(prisma)`.",
    };
  }
  // The growth target is `desiredTarget` (minimumTarget is intentionally 0 for
  // every seed — see content-goals.ts). Reading minimumTarget made this rating
  // report "N / 0 (100%)" — a false all-clear that masked real, large gaps.
  const totalTarget = goals.reduce((sum, g) => sum + g.desiredTarget, 0);
  const totalCurrent = goals.reduce((sum, g) => sum + g.currentValidCount, 0);
  const totalGap = goals.reduce((sum, g) => sum + g.gapCount, 0);
  const pct = totalTarget === 0 ? 1 : Math.min(1, totalCurrent / totalTarget);
  const behind = goals
    .filter((g) => g.gapCount > 0)
    .sort((a, b) => b.gapCount - a.gapCount)
    .slice(0, 4)
    .map((g) => `${g.contentType} +${g.gapCount}`);

  // Content goals are a long-horizon target dominated by the 200k-parish goal,
  // so raw "% complete" is a completion ratio, not a health signal — it reads
  // red for years while the worker fills correctly. HEALTH = is the worker
  // still making forward progress toward goals. Green while progressing (any
  // publish in the last 7 days), red only when genuinely STALLED with a gap.
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentPublishes = await prisma.publishedContent
    .count({ where: { isPublished: true, publishedAt: { gte: since7d } } })
    .catch(() => 0);
  const progressing = recentPublishes > 0;
  const status: HealthStatus = totalGap === 0 || progressing ? "pass" : "fail";
  // "STALLED" is only a diagnosis while the worker is meant to be running —
  // withExecutionAwareness turns it into a plain fact when the switch is OFF.
  const stalledLabel = workerIntentionallyOff(ctx) ? " (no publishes: worker OFF)" : " (STALLED)";
  return withExecutionAwareness(
    {
      key: "admin_worker_content_goals",
      label: "Content goals",
      status,
      // Score reflects health (progress), not completion, so a healthy marathon
      // doesn't drag the aggregate down; the true completion % stays in the summary.
      score: status === "pass" ? 1 : pct,
      lastCheckedAt: new Date(),
      dataSource: "ContentGoal.desiredTarget",
      summary:
        totalGap === 0
          ? `All content goals met: ${totalCurrent} / ${totalTarget}.`
          : `${totalCurrent} / ${totalTarget} target (${Math.round(pct * 100)}%); ${totalGap} still to build; +${recentPublishes} published in last 7d${
              progressing ? " (progressing)" : stalledLabel
            }${behind.length ? ` — largest gaps: ${behind.join(", ")}` : ""}.`,
      recommendedRepair: progressing
        ? undefined
        : totalGap > 0
          ? "No content published in the last 7 days despite an open gap — the growth pipeline is stalled. Advance the below-target types (prioritize + fetch existing candidates, extract, build, publish)."
          : undefined,
    },
    ctx,
  );
}

async function ratingCleanupCustodian(prisma: PrismaClient): Promise<HealthRating> {
  // Custody/cleanup runs every pass inside the autonomous loop (runCustodyPass)
  // and logs a CLEANUP-category event, rather than starting a separate
  // CLEANUP-typed pass. Count either signal so the check reflects real cleanup.
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [cleanupPasses, cleanupLogs] = await Promise.all([
    prisma.adminWorkerPass
      .count({ where: { passType: "CLEANUP", startedAt: { gte: since } } })
      .catch(() => 0),
    prisma.adminWorkerLog
      .count({ where: { category: "CLEANUP", createdAt: { gte: since } } })
      .catch(() => 0),
  ]);
  const recent = cleanupPasses + cleanupLogs;
  const status: HealthStatus = recent > 0 ? "pass" : "warn";
  return {
    key: "admin_worker_cleanup",
    label: "Cleanup custodian",
    status,
    score: status === "pass" ? 1 : 0.5,
    lastCheckedAt: new Date(),
    dataSource: "AdminWorkerPass + AdminWorkerLog(CLEANUP)",
    summary: `${recent} cleanup action(s) in last 7 days.`,
  };
}

async function ratingDatabaseHealth(prisma: PrismaClient): Promise<HealthRating> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      key: "admin_worker_db",
      label: "Database health",
      status: "pass",
      score: 1,
      lastCheckedAt: new Date(),
      dataSource: "Postgres",
      summary: "Postgres reachable.",
    };
  } catch (err) {
    return {
      key: "admin_worker_db",
      label: "Database health",
      status: "fail",
      score: 0,
      lastCheckedAt: new Date(),
      dataSource: "Postgres",
      summary: `Database error: ${err instanceof Error ? err.message : String(err)}`,
      recommendedRepair: "Check DATABASE_URL and the Postgres service.",
    };
  }
}

async function ratingEnvironmentHealth(): Promise<HealthRating> {
  const required = ["DATABASE_URL", "ADMIN_USERNAME", "ADMIN_PASSWORD", "SESSION_SECRET"];
  const missing = required.filter((k) => !process.env[k]);
  const status: HealthStatus = missing.length === 0 ? "pass" : "fail";
  return {
    key: "admin_worker_env",
    label: "Environment health",
    status,
    score: status === "pass" ? 1 : 0,
    lastCheckedAt: new Date(),
    dataSource: "process.env",
    summary:
      status === "pass" ? "All required env vars present." : `Missing: ${missing.join(", ")}.`,
    recommendedRepair: status === "pass" ? undefined : "Set the missing env vars in Railway.",
  };
}

async function ratingEmailHealth(): Promise<HealthRating> {
  const configured = Boolean(process.env.RESEND_API_KEY);
  const hasAdmin = Boolean(process.env.ADMIN_EMAIL);
  const status: HealthStatus = configured && hasAdmin ? "pass" : "warn";
  return {
    key: "admin_worker_email",
    label: "Email reports",
    status,
    score: status === "pass" ? 1 : 0.5,
    lastCheckedAt: new Date(),
    dataSource: "RESEND_API_KEY,ADMIN_EMAIL",
    summary:
      status === "pass" ? "RESEND_API_KEY + ADMIN_EMAIL set." : "Email is not fully configured.",
    recommendedRepair: status === "pass" ? undefined : "Set RESEND_API_KEY and ADMIN_EMAIL.",
  };
}

async function ratingClassification(prisma: PrismaClient): Promise<HealthRating> {
  // Classification now happens inline in the discovery/extraction pipeline: each
  // candidate URL is tagged with a predictedContentType rather than spawning a
  // CLASSIFY_CONTENT task. Count classified candidates (plus any legacy tasks).
  const [classified, tasks] = await Promise.all([
    prisma.candidateSourceUrl
      .count({ where: { predictedContentType: { not: null } } })
      .catch(() => 0),
    prisma.adminWorkerTask.count({ where: { taskType: "CLASSIFY_CONTENT" } }).catch(() => 0),
  ]);
  const count = classified + tasks;
  return {
    key: "admin_worker_classification",
    label: "Content classification",
    status: count > 0 ? "pass" : "warn",
    score: count > 0 ? 1 : 0.5,
    lastCheckedAt: new Date(),
    dataSource: "CandidateSourceUrl.predictedContentType",
    summary: `${classified} candidate(s) classified by content type${tasks > 0 ? ` (+${tasks} legacy task(s))` : ""}.`,
  };
}

async function ratingBuilding(prisma: PrismaClient): Promise<HealthRating> {
  const succeeded = await prisma.workerBuildJob.count({ where: { status: "succeeded" } });
  return {
    key: "admin_worker_building",
    label: "Content building",
    status: succeeded > 0 ? "pass" : "warn",
    score: succeeded > 0 ? 1 : 0.5,
    lastCheckedAt: new Date(),
    dataSource: "WorkerBuildJob",
    summary: `${succeeded} successful builds.`,
  };
}

async function ratingFormatting(prisma: PrismaClient): Promise<HealthRating> {
  const recent = await prisma.contentQualityScore.findFirst({
    orderBy: { createdAt: "desc" },
  });
  const score = recent?.formattingScore ?? 0;
  return {
    key: "admin_worker_formatting",
    label: "Content formatting",
    status: score >= 0.8 ? "pass" : score >= 0.5 ? "warn" : "fail",
    score,
    lastCheckedAt: new Date(),
    dataSource: "ContentQualityScore",
    summary: recent ? `Latest formatting score ${score.toFixed(2)}.` : "No formatting scores yet.",
  };
}

async function ratingCrossSource(prisma: PrismaClient): Promise<HealthRating> {
  // Cross-source validation activity is observed via the
  // VALIDATION-category log emitted by the build engine + post-publish
  // verifier. ContentValidationEvidence was removed with the legacy
  // ingestion tables in migration 0025_drop_legacy_system.
  const recent = await prisma.adminWorkerLog.count({
    where: {
      category: "VALIDATION",
      createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
  });
  return {
    key: "admin_worker_cross_source",
    label: "Cross-source validation",
    status: recent > 0 ? "pass" : "warn",
    score: recent > 0 ? 1 : 0.5,
    lastCheckedAt: new Date(),
    dataSource: "AdminWorkerLog (category=VALIDATION)",
    summary: `${recent} validation log entries in last 7 days.`,
  };
}

async function ratingStrictQa(prisma: PrismaClient): Promise<HealthRating> {
  // Spec §3: the artifact-level AdminWorkerStrictQAResult is the durable
  // strict-QA record (written by the STRICT_QA stage).
  const now = new Date();
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60_000);
  const [rows, latest, eligible] = await Promise.all([
    prisma.adminWorkerStrictQAResult
      .findMany({
        where: { createdAt: { gte: since } },
        select: { packageArtifactId: true, status: true },
      })
      .catch(() => [] as Array<{ packageArtifactId: string; status: string }>),
    prisma.adminWorkerStrictQAResult
      .findFirst({ orderBy: { createdAt: "desc" } })
      .catch(() => null),
    // Artifacts the STRICT_QA stage would actually process right now.
    prisma.adminWorkerPackageArtifact
      .count({ where: { status: { in: ["BUILD_READY", "VERIFICATION_READY"] } } })
      .catch(() => 0),
  ]);

  // Strict QA only runs when there are artifacts sitting at BUILD_READY /
  // VERIFICATION_READY. "No results" is only a problem when such artifacts are
  // WAITING and not being QA'd. With an empty build funnel (all published or
  // rerouted upstream), no results is the correct, healthy state — publishing
  // 3400+ items via curated/structured ingest does not route through this stage.
  if (rows.length === 0) {
    const stalled = eligible > 0;
    return {
      key: "admin_worker_strict_qa",
      label: "Strict QA (AdminWorkerStrictQAResult)",
      status: stalled ? "warn" : "pass",
      score: stalled ? 0.5 : 1,
      lastCheckedAt: now,
      dataSource: "AdminWorkerStrictQAResult (last 7d)",
      latestSuccess: latest?.createdAt,
      summary: stalled
        ? `No strict-QA results in last 7 days, but ${eligible} artifact(s) await QA.`
        : "No strict-QA results in last 7 days — no artifacts awaiting QA (build funnel empty).",
      recommendedRepair: stalled
        ? "Run the BUILD_READY drain; artifacts are waiting at BUILD_READY/VERIFICATION_READY."
        : undefined,
    };
  }

  // A strict-QA non-pass that ended with the artifact TERMINALLY REJECTED is QA
  // WORKING — it correctly caught junk (arbitrary web extraction always yields
  // some). Counting those against the pass rate kept this rating amber even when
  // QA was doing exactly its job. HEALTH = pass rate among artifacts QA
  // evaluated that remain VIABLE (not terminally rejected); the volume of junk
  // upstream is the extractors' rating, not QA's. (There is no Prisma relation
  // from the result to the artifact, so resolve REJECTED ids in a second read.)
  const ids = Array.from(new Set(rows.map((r) => r.packageArtifactId)));
  const rejectedIds = new Set(
    (
      await prisma.adminWorkerPackageArtifact
        .findMany({ where: { id: { in: ids }, status: "REJECTED" }, select: { id: true } })
        .catch(() => [] as Array<{ id: string }>)
    ).map((a) => a.id),
  );
  const viable = rows.filter((r) => !rejectedIds.has(r.packageArtifactId));
  const total = viable.length;
  const passed = viable.filter((r) => r.status === "PASSED").length;

  if (total === 0) {
    // Every artifact QA saw was correctly rejected as junk — QA gating working.
    return {
      key: "admin_worker_strict_qa",
      label: "Strict QA (AdminWorkerStrictQAResult)",
      status: "pass",
      score: 1,
      lastCheckedAt: now,
      dataSource: "AdminWorkerStrictQAResult (last 7d)",
      latestSuccess: latest?.createdAt,
      summary: `All ${rows.length} strict-QA result(s) in last 7d were on artifacts since rejected as junk — QA gating is working.`,
    };
  }

  const passRate = passed / total;
  // Small windows are noisy — a couple of not-yet-repaired artifacts must not
  // hard-FAIL the rating; cap at warn until there are enough viable artifacts.
  const status: HealthStatus =
    passRate >= 0.7 ? "pass" : passRate >= 0.4 || total < 5 ? "warn" : "fail";
  const rejectedCount = rows.length - total;
  return {
    key: "admin_worker_strict_qa",
    label: "Strict QA (AdminWorkerStrictQAResult)",
    status,
    score: status === "pass" ? Math.min(1, passRate) : status === "warn" ? 0.5 : 0,
    lastCheckedAt: now,
    dataSource: "AdminWorkerStrictQAResult (last 7d)",
    latestSuccess: latest?.createdAt,
    summary:
      `${passed}/${total} viable artifacts passed strict QA (${Math.round(passRate * 100)}%)` +
      `${rejectedCount > 0 ? `; ${rejectedCount} correctly rejected as junk (excluded)` : ""}; latest finalScore=${latest?.finalScore.toFixed(2) ?? "?"}.`,
    recommendedRepair:
      status === "fail"
        ? "Investigate strict-QA blocking reasons; review NEEDS_REPAIR artifacts so they are repaired or terminally rejected."
        : undefined,
  };
}

async function ratingQualityScoring(prisma: PrismaClient): Promise<HealthRating> {
  // Spec §4 + §13: per-publish ContentQualityScore rating.
  const now = new Date();
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60_000);
  const [recent, latest] = await Promise.all([
    prisma.contentQualityScore.count({ where: { createdAt: { gte: since } } }).catch(() => 0),
    prisma.contentQualityScore.findFirst({ orderBy: { createdAt: "desc" } }).catch(() => null),
  ]);
  const status: HealthStatus =
    recent === 0 ? "warn" : (latest?.finalScore ?? 0) >= 0.8 ? "pass" : "warn";
  return {
    key: "admin_worker_quality_scoring",
    label: "Quality scoring (ContentQualityScore)",
    status,
    score: status === "pass" ? 1 : status === "warn" ? 0.5 : 0,
    lastCheckedAt: now,
    dataSource: "ContentQualityScore (last 7d)",
    latestSuccess: latest?.createdAt,
    summary:
      recent === 0
        ? "No quality scores recorded in last 7 days."
        : `${recent} quality score(s) in last 7d; latest finalScore=${latest?.finalScore.toFixed(2) ?? "?"}.`,
    recommendedRepair:
      recent === 0
        ? "Run a publish pass; the orchestrator records a score per artifact."
        : undefined,
  };
}

async function ratingPackageArtifacts(prisma: PrismaClient): Promise<HealthRating> {
  // Spec §13: surface the per-status counts of AdminWorkerPackageArtifact.
  const now = new Date();
  const [total, extracted, checklistReady, buildReady, qaPassed, needsRepair, rejected, published] =
    await Promise.all([
      prisma.adminWorkerPackageArtifact.count().catch(() => 0),
      prisma.adminWorkerPackageArtifact.count({ where: { status: "EXTRACTED" } }).catch(() => 0),
      prisma.adminWorkerPackageArtifact
        .count({ where: { status: "CHECKLIST_READY" } })
        .catch(() => 0),
      prisma.adminWorkerPackageArtifact.count({ where: { status: "BUILD_READY" } }).catch(() => 0),
      prisma.adminWorkerPackageArtifact.count({ where: { status: "QA_PASSED" } }).catch(() => 0),
      prisma.adminWorkerPackageArtifact.count({ where: { status: "NEEDS_REPAIR" } }).catch(() => 0),
      prisma.adminWorkerPackageArtifact.count({ where: { status: "REJECTED" } }).catch(() => 0),
      prisma.adminWorkerPackageArtifact.count({ where: { status: "PUBLISHED" } }).catch(() => 0),
    ]);
  // A pile at CHECKLIST_READY/EXTRACTED means extraction is working but the
  // downstream funnel is stalled (EXTRACTING_WITHOUT_PUBLISHING). The always-on
  // drain now bridges CHECKLIST_READY → BUILD_READY → publish every pass, so a
  // persistent CHECKLIST_READY backlog is worth surfacing.
  const status: HealthStatus = total === 0 ? "warn" : "pass";
  return {
    key: "admin_worker_package_artifacts",
    label: "Package artifacts",
    status,
    score: total === 0 ? 0.5 : 1,
    lastCheckedAt: now,
    dataSource: "AdminWorkerPackageArtifact",
    summary:
      total === 0
        ? "No package artifacts yet."
        : `Artifacts: ${published} published, ${qaPassed} QA_PASSED, ${buildReady} BUILD_READY, ${checklistReady} CHECKLIST_READY, ${extracted} EXTRACTED, ${needsRepair} NEEDS_REPAIR, ${rejected} REJECTED.`,
    recommendedRepair:
      needsRepair > 0
        ? "Repair NEEDS_REPAIR artifacts before they fall through to rare human review."
        : undefined,
  };
}

async function ratingStructuredBlocks(prisma: PrismaClient): Promise<HealthRating> {
  // Spec §1 + §15: surface structured-block parsing activity.
  const now = new Date();
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60_000);
  const [recent, rejected] = await Promise.all([
    prisma.adminWorkerSourceBlock.count({ where: { createdAt: { gte: since } } }).catch(() => 0),
    prisma.adminWorkerSourceBlock
      .count({ where: { createdAt: { gte: since }, isRejected: true } })
      .catch(() => 0),
  ]);
  const status: HealthStatus = recent === 0 ? "warn" : "pass";
  return {
    key: "admin_worker_structured_blocks",
    label: "Structured source blocks",
    status,
    score: recent === 0 ? 0.5 : 1,
    lastCheckedAt: now,
    dataSource: "AdminWorkerSourceBlock (last 7d)",
    summary:
      recent === 0
        ? "No structured blocks created in last 7 days."
        : `${recent} blocks created (${rejected} rejected as junk).`,
    recommendedRepair:
      recent === 0
        ? "Run a source-fetch pass; readSource will parse and persist blocks."
        : undefined,
  };
}

async function ratingCandidateScoring(prisma: PrismaClient): Promise<HealthRating> {
  // Spec §13: candidate-scorer rating from CandidateSourceUrl.fetchPriority.
  const now = new Date();
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60_000);
  const [scored, total] = await Promise.all([
    prisma.candidateSourceUrl
      .count({ where: { createdAt: { gte: since }, fetchPriority: { gt: 0 } } })
      .catch(() => 0),
    prisma.candidateSourceUrl.count({ where: { createdAt: { gte: since } } }).catch(() => 0),
  ]);
  const rate = total === 0 ? 0 : scored / total;
  const status: HealthStatus =
    total === 0 ? "warn" : rate >= 0.8 ? "pass" : rate >= 0.5 ? "warn" : "fail";
  return {
    key: "admin_worker_candidate_scoring",
    label: "Candidate scoring",
    status,
    score: status === "pass" ? 1 : status === "warn" ? 0.5 : 0,
    lastCheckedAt: now,
    dataSource: "CandidateSourceUrl.fetchPriority (last 7d)",
    summary:
      total === 0
        ? "No candidate URLs scored in last 7 days."
        : `${scored}/${total} candidates carry a non-zero fetchPriority (${Math.round(rate * 100)}%).`,
    recommendedRepair:
      status === "fail" ? "Re-run candidate scoring (rescoreAllCandidates)." : undefined,
  };
}

async function ratingExtractors(prisma: PrismaClient): Promise<HealthRating> {
  // Spec §13: extractors rating from package-artifact confidence.
  const now = new Date();
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60_000);
  const [created, withFields] = await Promise.all([
    prisma.adminWorkerPackageArtifact
      .count({ where: { createdAt: { gte: since } } })
      .catch(() => 0),
    prisma.adminWorkerPackageArtifact
      .count({ where: { createdAt: { gte: since }, confidenceScore: { gte: 0.5 } } })
      .catch(() => 0),
  ]);
  const rate = created === 0 ? 0 : withFields / created;
  const status: HealthStatus =
    created === 0 ? "warn" : rate >= 0.7 ? "pass" : rate >= 0.4 ? "warn" : "fail";
  return {
    key: "admin_worker_extractors",
    label: "Extractors",
    status,
    score: status === "pass" ? 1 : status === "warn" ? 0.5 : 0,
    lastCheckedAt: now,
    dataSource: "AdminWorkerPackageArtifact.confidenceScore (last 7d)",
    summary:
      created === 0
        ? "No package artifacts extracted in last 7 days."
        : `${withFields}/${created} artifacts have confidence >= 0.5 (${Math.round(rate * 100)}%).`,
    recommendedRepair:
      status === "fail"
        ? "Investigate low-confidence extractions; check structured blocks."
        : undefined,
  };
}

async function ratingChecklistBridge(prisma: PrismaClient): Promise<HealthRating> {
  // Spec §13: checklist + citation bridge — the CHECKLIST_CREATION /
  // CITATION_CREATION stage promotes CHECKLIST_READY artifacts to BUILD_READY
  // and stamps `checklistItemId` (checklist-citation-orchestrator.ts).
  //
  // HEALTH = is the bridge KEEPING UP, not a lifetime funnel-yield. The old
  // metric was `bridged / ALL artifacts ever`, so every historical REJECTED junk
  // artifact and every stuck EXTRACTED row sat permanently in the denominator
  // yet could never be bridged — pinning this red forever once normal web-extract
  // rejects accumulated, even while the bridge stage worked perfectly. (Same
  // trap already corrected for content-goals + the repair orchestrator.)
  //
  // The only artifacts the bridge still OWES are those sitting at CHECKLIST_READY
  // without a checklistItemId — exactly the backlog the BUILD_READY drain targets
  // every pass. An empty backlog means the bridge is caught up (healthy); a
  // growing one means it is genuinely stalled. REJECTED / EXTRACTED / NEEDS_REPAIR
  // never reach the bridge and must not count against it.
  const now = new Date();
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60_000);
  const [waitingUnbridged, bridgedTotal, bridgedRecent] = await Promise.all([
    prisma.adminWorkerPackageArtifact
      .count({ where: { status: "CHECKLIST_READY", checklistItemId: null } })
      .catch(() => 0),
    prisma.adminWorkerPackageArtifact
      .count({ where: { checklistItemId: { not: null } } })
      .catch(() => 0),
    prisma.adminWorkerPackageArtifact
      .count({ where: { checklistItemId: { not: null }, updatedAt: { gte: since } } })
      .catch(() => 0),
  ]);
  const status: HealthStatus =
    waitingUnbridged === 0 ? "pass" : waitingUnbridged > 25 ? "fail" : "warn";
  return {
    key: "admin_worker_checklist_bridge",
    label: "Checklist + citation bridge",
    status,
    score: status === "pass" ? 1 : status === "warn" ? 0.5 : 0,
    lastCheckedAt: now,
    dataSource: "AdminWorkerPackageArtifact.checklistItemId + status",
    summary:
      waitingUnbridged === 0
        ? `Bridge caught up: ${bridgedTotal} artifact(s) bridged to ChecklistItem (${bridgedRecent} in last 7d); none awaiting.`
        : `${waitingUnbridged} artifact(s) at CHECKLIST_READY awaiting the bridge (${bridgedTotal} already bridged).`,
    recommendedRepair:
      status === "pass"
        ? undefined
        : "Run the CHECKLIST_CREATION / CITATION_CREATION dispatcher stages (or the BUILD_READY drain) to bridge the waiting CHECKLIST_READY artifacts.",
  };
}

/** Recent (7d) FAIL count + total for one PostPublishVerification check column. */
async function recentCheckFailures(
  prisma: PrismaClient,
  column: "publicPageCheck" | "searchCheck" | "sitemapCheck" | "cacheCheck",
): Promise<{ total: number; fails: number }> {
  const since = new Date(Date.now() - RECENT_WINDOW_MS);
  const [total, fails] = await Promise.all([
    prisma.postPublishVerification.count({ where: { createdAt: { gte: since } } }).catch(() => 0),
    prisma.postPublishVerification
      .count({ where: { [column]: "FAIL", createdAt: { gte: since } } })
      .catch(() => 0),
  ]);
  return { total, fails };
}

async function ratingPublicRender(prisma: PrismaClient): Promise<HealthRating> {
  // Same lifetime-count trap as ratingPostPublish: one historical FAIL row kept
  // the gate red forever. Rate the last 7 days' ratio instead.
  const { total, fails } = await recentCheckFailures(prisma, "publicPageCheck");
  const status = ratioStatus(total, fails);
  return {
    key: "admin_worker_public_render",
    label: "Public render gate",
    status,
    score: status === "pass" ? 1 : status === "warn" ? 0.5 : 0.2,
    lastCheckedAt: new Date(),
    dataSource: "PostPublishVerification (last 7d)",
    summary: `${fails} of ${total} public render check(s) failed in the last 7d.`,
  };
}

async function ratingSearchVisibility(prisma: PrismaClient): Promise<HealthRating> {
  const { total, fails } = await recentCheckFailures(prisma, "searchCheck");
  return {
    key: "admin_worker_search",
    label: "Search visibility",
    status: fails === 0 ? "pass" : "warn",
    score: fails === 0 ? 1 : 0.5,
    lastCheckedAt: new Date(),
    dataSource: "PostPublishVerification (last 7d)",
    summary: `${fails} of ${total} search visibility check(s) failed in the last 7d.`,
  };
}

async function ratingSitemapVisibility(prisma: PrismaClient): Promise<HealthRating> {
  const { total, fails } = await recentCheckFailures(prisma, "sitemapCheck");
  return {
    key: "admin_worker_sitemap",
    label: "Sitemap visibility",
    status: fails === 0 ? "pass" : "warn",
    score: fails === 0 ? 1 : 0.5,
    lastCheckedAt: new Date(),
    dataSource: "PostPublishVerification (last 7d)",
    summary: `${fails} of ${total} sitemap visibility check(s) failed in the last 7d.`,
  };
}

async function ratingCacheFreshness(prisma: PrismaClient): Promise<HealthRating> {
  const { total, fails } = await recentCheckFailures(prisma, "cacheCheck");
  return {
    key: "admin_worker_cache",
    label: "Cache freshness",
    status: fails === 0 ? "pass" : "warn",
    score: fails === 0 ? 1 : 0.5,
    lastCheckedAt: new Date(),
    dataSource: "PostPublishVerification (last 7d)",
    summary: `${fails} of ${total} cache freshness check(s) failed in the last 7d.`,
  };
}

async function ratingLastPassTime(
  prisma: PrismaClient,
  ctx?: DiagnosticsContext,
): Promise<HealthRating> {
  const recent = await prisma.adminWorkerPass.findFirst({
    orderBy: { startedAt: "desc" },
    select: { startedAt: true, status: true },
  });
  const now = new Date();
  const ageMs = recent ? now.getTime() - recent.startedAt.getTime() : Infinity;
  const status: HealthStatus = ageMs < 10 * 60_000 ? "pass" : ageMs < 60 * 60_000 ? "warn" : "fail";
  return withExecutionAwareness(
    {
      key: "admin_worker_last_pass",
      label: "Last Admin Worker pass",
      status,
      score: status === "pass" ? 1 : status === "warn" ? 0.5 : 0,
      lastCheckedAt: now,
      dataSource: "AdminWorkerPass.startedAt",
      latestSuccess: recent?.startedAt ?? null,
      summary: recent
        ? `Last pass ${Math.round(ageMs / 1000)}s ago (status: ${recent.status}).`
        : "No pass recorded yet.",
    },
    ctx,
  );
}

async function ratingLastTaskTime(
  prisma: PrismaClient,
  ctx?: DiagnosticsContext,
): Promise<HealthRating> {
  // The worker's most recent unit of planned work is its latest brain decision
  // (one per pass), not the legacy AdminWorkerTask queue — take whichever is more
  // recent so this reflects the live per-pass cadence instead of a defunct table.
  const [lastDecision, lastTask] = await Promise.all([
    prisma.adminWorkerDecision
      .findFirst({
        orderBy: { createdAt: "desc" },
        select: { createdAt: true, chosenAction: true },
      })
      .catch(() => null),
    prisma.adminWorkerTask
      .findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true, taskType: true } })
      .catch(() => null),
  ]);
  const recent =
    lastDecision && lastTask
      ? lastDecision.createdAt >= lastTask.createdAt
        ? { createdAt: lastDecision.createdAt, kind: lastDecision.chosenAction }
        : { createdAt: lastTask.createdAt, kind: lastTask.taskType }
      : lastDecision
        ? { createdAt: lastDecision.createdAt, kind: lastDecision.chosenAction }
        : lastTask
          ? { createdAt: lastTask.createdAt, kind: lastTask.taskType }
          : null;
  const now = new Date();
  const ageMs = recent ? now.getTime() - recent.createdAt.getTime() : Infinity;
  const status: HealthStatus =
    ageMs < 60 * 60_000 ? "pass" : ageMs < 24 * 60 * 60_000 ? "warn" : "fail";
  return withExecutionAwareness(
    {
      key: "admin_worker_last_task",
      label: "Last Admin Worker task",
      status,
      score: status === "pass" ? 1 : status === "warn" ? 0.5 : 0,
      lastCheckedAt: now,
      dataSource: "AdminWorkerDecision + AdminWorkerTask",
      latestSuccess: recent?.createdAt ?? null,
      summary: recent
        ? `Last planned action ${Math.round(ageMs / 60_000)}min ago (${recent.kind}).`
        : "No tasks recorded yet.",
    },
    ctx,
  );
}

// ── Spec §18 subsystem ratings ─────────────────────────────────────

async function ratingBrain(prisma: PrismaClient, ctx?: DiagnosticsContext): Promise<HealthRating> {
  const now = new Date();
  const decision = await prisma.adminWorkerDecision
    .findFirst({ where: { decisionType: "brain_pass" }, orderBy: { createdAt: "desc" } })
    .catch(() => null);
  if (!decision) {
    return withExecutionAwareness(
      {
        key: "admin_worker_brain",
        label: "Admin Worker decision engine",
        status: "fail",
        score: 0,
        lastCheckedAt: now,
        dataSource: "AdminWorkerDecision.decisionType=brain_pass",
        summary: "No Admin Worker decisions recorded yet.",
        recommendedRepair: "Run a worker pass — the Admin Worker writes a decision on every cycle.",
      },
      ctx,
    );
  }
  const ageMs = now.getTime() - decision.createdAt.getTime();
  const status: HealthStatus = ageMs < 10 * 60_000 ? "pass" : ageMs < 60 * 60_000 ? "warn" : "fail";
  return withExecutionAwareness(
    {
      key: "admin_worker_brain",
      label: "Admin Worker decision engine",
      status,
      score: status === "pass" ? 1 : status === "warn" ? 0.5 : 0,
      lastCheckedAt: now,
      dataSource: "AdminWorkerDecision.createdAt",
      latestSuccess: decision.createdAt,
      summary: `Last Admin Worker decision ${Math.round(ageMs / 60_000)}min ago: ${decision.chosenAction}.`,
      recommendedRepair:
        status === "pass" ? undefined : "Run a worker pass to refresh the Admin Worker decision.",
    },
    ctx,
  );
}

async function ratingMissionPlanner(prisma: PrismaClient): Promise<HealthRating> {
  const now = new Date();
  const pipelineStages = await prisma.adminWorkerPipelineStage.count().catch(() => 0);
  const status: HealthStatus = pipelineStages > 0 ? "pass" : "warn";
  return {
    key: "admin_worker_mission_planner",
    label: "Mission planner + pipeline tracking",
    status,
    score: status === "pass" ? 1 : 0.5,
    lastCheckedAt: now,
    dataSource: "AdminWorkerPipelineStage",
    summary: `${pipelineStages} pipeline stage row(s) recorded.`,
    recommendedRepair: status === "pass" ? undefined : "Run a content-goal pass.",
  };
}

// errorClass values that are the fetcher CORRECTLY refusing off-policy or
// unusable content, NOT a transport failure: a candidate on an unapproved host,
// a login wall, a binary, an unreadable/oversized PDF, or a JS-only shell the
// (graceful-optional) dynamic fetcher couldn't render. The old rate counted
// these as "fetch failures" alongside real network errors, so the Fetcher
// rating read red whenever discovery surfaced lots of off-registry / dynamic
// candidates — conflating "the pipeline is broken" with "the URLs were junk".
const FETCH_POLICY_REJECTIONS = [
  "INVALID_URL",
  "UNAPPROVED_HOST",
  "BINARY_REJECTED",
  "PDF_TOO_LARGE",
  "PDF_UNREADABLE",
  "PDF_READ_FAILED",
  "TOO_SMALL",
  "TOO_LARGE_NO_STRUCTURE",
  "LOGIN_PAGE",
];

async function ratingFetcher(prisma: PrismaClient): Promise<HealthRating> {
  const now = new Date();
  const since = new Date(now.getTime() - 24 * 60 * 60_000);
  const [total, succeeded, policyRejected] = await Promise.all([
    prisma.adminWorkerFetchResult.count({ where: { createdAt: { gte: since } } }).catch(() => 0),
    prisma.adminWorkerFetchResult
      .count({ where: { createdAt: { gte: since }, succeeded: true } })
      .catch(() => 0),
    prisma.adminWorkerFetchResult
      .count({
        where: {
          createdAt: { gte: since },
          succeeded: false,
          errorClass: { in: FETCH_POLICY_REJECTIONS },
        },
      })
      .catch(() => 0),
  ]);
  // Transport health = of the fetches that SHOULD have worked (approved host,
  // usable content), what fraction actually retrieved a response. Benign policy
  // rejections are excluded from the denominator — the fetcher refusing junk is
  // it WORKING, not failing. What remains is genuine transport (network / HTTP /
  // timeout) failure, which is what "check approved hosts and rate limits" means.
  const attempted = Math.max(0, total - policyRejected);
  const rate = attempted === 0 ? 1 : succeeded / attempted;
  const status: HealthStatus =
    total === 0
      ? "warn"
      : attempted === 0
        ? "pass" // every row was a benign policy rejection — transport is fine
        : rate >= 0.8
          ? "pass"
          : rate >= 0.5
            ? "warn"
            : "fail";
  return {
    key: "admin_worker_fetcher",
    label: "Fetcher",
    status,
    score: status === "pass" ? 1 : status === "warn" ? 0.5 : 0,
    lastCheckedAt: now,
    dataSource: "AdminWorkerFetchResult (last 24h)",
    summary:
      total === 0
        ? "No fetch attempts in last 24h."
        : `${succeeded}/${attempted} genuine fetches succeeded (${Math.round(rate * 100)}%)` +
          `${policyRejected > 0 ? `; ${policyRejected} off-policy/unusable candidate(s) skipped` : ""}.`,
    recommendedRepair:
      status === "fail"
        ? "Transport is failing on approved hosts — check egress/proxy reachability, host bot-blocks (403), and rate limits."
        : status === "warn"
          ? "Some fetches on approved hosts are failing — check egress/proxy and rate limits."
          : undefined,
  };
}

async function ratingVerifier(prisma: PrismaClient): Promise<HealthRating> {
  const now = new Date();
  // Cross-source verification only runs on SENSITIVE artifacts — BUILD_READY
  // rows that carry validationNeeds (SAINT feast days, apparition approvals,
  // etc.). Non-sensitive types (PARISH/LITURGICAL/PRAYER/…) publish without it
  // by design. So "0 verification rows" is only a problem when there are
  // sensitive artifacts WAITING to be verified. With no eligible work, 0 rows
  // is the correct, healthy state — not a warning.
  const [count, awaiting] = await Promise.all([
    prisma.adminWorkerCrossSourceVerification.count().catch(() => 0),
    prisma.adminWorkerPackageArtifact
      .count({ where: { status: "BUILD_READY", validationNeeds: { isEmpty: false } } })
      .catch(() => 0),
  ]);
  const status: HealthStatus = count > 0 || awaiting === 0 ? "pass" : "warn";
  return {
    key: "admin_worker_verifier",
    label: "Cross-source verifier",
    status,
    score: status === "pass" ? 1 : 0.5,
    lastCheckedAt: now,
    dataSource: "AdminWorkerCrossSourceVerification",
    summary:
      count > 0
        ? `${count} verification row(s) recorded.`
        : awaiting === 0
          ? "No sensitive artifacts awaiting cross-source verification (nothing to verify)."
          : `${awaiting} sensitive artifact(s) awaiting verification but 0 evidence rows recorded.`,
    recommendedRepair:
      status === "pass"
        ? undefined
        : "Run a CROSS_SOURCE_VERIFICATION pass to populate evidence rows for the waiting artifacts.",
  };
}

async function ratingRepairOrchestrator(prisma: PrismaClient): Promise<HealthRating> {
  const now = new Date();
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60_000);
  // Abandoned plans are TERMINAL history — they accumulate for the life of the
  // deployment. Counting them cumulatively pinned this rating red forever after
  // the first handful of genuinely-unfixable items. Health is whether repair is
  // FAILING REPEATEDLY RIGHT NOW: measure abandons in the last 7d, and whether
  // the pending backlog is being worked. (When a plan abandons, its linked
  // artifact is now driven to a terminal state in the orchestrator, so it no
  // longer lingers in NEEDS_REPAIR — see runRepairOrchestrator.)
  const [pending, abandonedRecent, abandonedTotal] = await Promise.all([
    prisma.adminWorkerRepairPlan
      .count({ where: { status: { in: ["PENDING", "RUNNING"] } } })
      .catch(() => 0),
    prisma.adminWorkerRepairPlan
      .count({ where: { status: "ABANDONED", updatedAt: { gte: since } } })
      .catch(() => 0),
    prisma.adminWorkerRepairPlan.count({ where: { status: "ABANDONED" } }).catch(() => 0),
  ]);
  const status: HealthStatus =
    abandonedRecent > 10 ? "fail" : pending > 20 || abandonedRecent > 0 ? "warn" : "pass";
  return {
    key: "admin_worker_repair_orchestrator",
    label: "Repair orchestrator",
    status,
    score: status === "pass" ? 1 : status === "warn" ? 0.5 : 0,
    lastCheckedAt: now,
    dataSource: "AdminWorkerRepairPlan",
    summary: `${pending} pending plan(s); ${abandonedRecent} abandoned in last 7d (${abandonedTotal} lifetime).`,
    recommendedRepair:
      status === "fail"
        ? "Repairs are failing repeatedly this week — investigate the failing path or raise maxAttempts."
        : status === "warn"
          ? "Run a REPAIR pass to drain pending plans."
          : undefined,
  };
}

async function ratingSchemaIntegrity(prisma: PrismaClient): Promise<HealthRating> {
  const now = new Date();
  const { checkSchemaIntegrity } = await import("./schema-integrity");
  const res = await checkSchemaIntegrity(prisma).catch(() => ({
    ok: true,
    drifts: [] as Array<{ model: string; detail: string }>,
    checked: 0,
  }));
  // A drift is CRITICAL: the deployed DB is behind the Prisma schema, so full-row
  // reads throw P2022, the funnel's fail-open catches swallow them as "no rows",
  // and publishing silently stalls (the recurring EXTRACTING_WITHOUT_PUBLISHING).
  const status: HealthStatus = res.drifts.length > 0 ? "fail" : "pass";
  return {
    key: "admin_worker_schema_integrity",
    label: "Database schema integrity",
    status,
    score: status === "pass" ? 1 : 0,
    lastCheckedAt: now,
    dataSource: "Prisma schema vs database",
    summary:
      res.drifts.length === 0
        ? `All ${res.checked} critical tables match the Prisma schema.`
        : `Schema drift on ${res.drifts.length} table(s): ${res.drifts
            .map((d) => `${d.model} (${d.detail})`)
            .join("; ")}.`,
    recommendedRepair:
      status === "fail"
        ? "The deployed database is behind the Prisma schema — run `prisma migrate deploy`. Full-row reads throw P2022 and the publish funnel silently stalls until the missing columns exist."
        : undefined,
  };
}

async function ratingGrowthOrchestrator(prisma: PrismaClient): Promise<HealthRating> {
  const now = new Date();
  const count = await prisma.adminWorkerGrowthSnapshot.count().catch(() => 0);
  const status: HealthStatus = count > 0 ? "pass" : "warn";
  return {
    key: "admin_worker_growth_orchestrator",
    label: "Growth orchestrator",
    status,
    score: status === "pass" ? 1 : 0.5,
    lastCheckedAt: now,
    dataSource: "AdminWorkerGrowthSnapshot",
    summary: `${count} growth snapshot(s) recorded.`,
    recommendedRepair:
      status === "pass" ? undefined : "Run a REPORTING pass to populate growth snapshots.",
  };
}

async function ratingSourceCoverage(prisma: PrismaClient): Promise<HealthRating> {
  const now = new Date();
  const [total, blocked] = await Promise.all([
    prisma.adminWorkerSourceCoverage.count().catch(() => 0),
    prisma.adminWorkerSourceCoverage.count({ where: { blockedByCoverage: true } }).catch(() => 0),
  ]);
  const status: HealthStatus =
    total === 0 ? "warn" : blocked > total / 3 ? "fail" : blocked > 0 ? "warn" : "pass";
  return {
    key: "admin_worker_source_coverage",
    label: "Source coverage (per content type)",
    status,
    score: status === "pass" ? 1 : status === "warn" ? 0.5 : 0,
    lastCheckedAt: now,
    dataSource: "AdminWorkerSourceCoverage",
    summary:
      total === 0
        ? "No source coverage scored yet."
        : `${blocked}/${total} content type(s) blocked by source coverage.`,
    recommendedRepair:
      status === "fail"
        ? "Add approved primary sources for blocked content types via the source registry."
        : status === "warn"
          ? "Schedule a REPORTING pass + review the coverage scorecard."
          : undefined,
  };
}

async function ratingRollback(prisma: PrismaClient): Promise<HealthRating> {
  // Rollback durability + recent activity (spec: rollback records appear in
  // diagnostics). Recent rollbacks mean content failed verification and was
  // pulled back — surfaced as a warn so operators notice, never a hard fail
  // (rollback is the safety mechanism working).
  //
  // The one thing that IS a fault: a rollback review that EXPIRED before anyone
  // decided restore-vs-delete. The content stays unpublished with no other open
  // signal (ratingHumanReview counts PENDING only), so it is surfaced here as a
  // warn until a person acts. Cleanup no longer expires these, but rows aged
  // out before that fix still exist.
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [total, recent, pendingReview, expiredRollbackReviews] = await Promise.all([
    prisma.adminWorkerRollbackLedger.count().catch(() => 0),
    prisma.adminWorkerRollbackLedger.count({ where: { createdAt: { gte: since } } }).catch(() => 0),
    prisma.adminWorkerRollbackLedger
      .count({ where: { humanReviewCreated: true, createdAt: { gte: since } } })
      .catch(() => 0),
    prisma.humanReviewQueue
      .count({
        where: {
          status: "EXPIRED",
          proposedAction: {
            in: ["restore_or_delete_unpublished_content", "investigate_post_publish_failure"],
          },
        },
      })
      .catch(() => 0),
  ]);
  const needsAttention = pendingReview > 0 || expiredRollbackReviews > 0;
  const summaryParts = [
    recent === 0
      ? `${total} rollback record(s); none in the last 7d.`
      : `${recent} rollback(s) in the last 7d${pendingReview > 0 ? `, ${pendingReview} awaiting human review` : ""}.`,
  ];
  if (expiredRollbackReviews > 0) {
    summaryParts.push(
      `${expiredRollbackReviews} unpublished item(s) whose restore-vs-delete review EXPIRED with no decision — still hidden from the public site.`,
    );
  }
  return {
    key: "admin_worker_rollback",
    label: "Rollback ledger",
    status: needsAttention ? "warn" : "pass",
    score: needsAttention ? 0.6 : recent === 0 ? 1 : 0.85,
    lastCheckedAt: new Date(),
    dataSource: "AdminWorkerRollbackLedger + HumanReviewQueue(EXPIRED rollback reviews)",
    summary: summaryParts.join(" "),
    recommendedRepair: needsAttention
      ? "Review the rollback human-review items (including EXPIRED ones) and decide restore vs delete — unpublished content is never re-published automatically."
      : undefined,
  };
}

async function ratingBuildReadyDrain(prisma: PrismaClient): Promise<HealthRating> {
  const now = new Date();
  const [stuck, readyToPublish, gateRows] = await Promise.all([
    prisma.adminWorkerPackageArtifact
      .count({ where: { status: { in: ["BUILD_READY", "VERIFICATION_READY"] } } })
      .catch(() => 0),
    prisma.adminWorkerPackageArtifact.count({ where: { status: "QA_PASSED" } }).catch(() => 0),
    prisma.adminWorkerPackageArtifact
      .groupBy({
        by: ["gateDiagnosis"],
        where: { status: { in: ["BUILD_READY", "VERIFICATION_READY"] } },
        _count: { _all: true },
      })
      .catch(() => [] as Array<{ gateDiagnosis: string | null; _count: { _all: number } }>),
  ]);
  const backlog = stuck + readyToPublish;
  // Warn when a backlog is accumulating; the drain runs every pass, so a
  // persistent large backlog means a gate genuinely needs attention.
  const status: HealthStatus = backlog === 0 ? "pass" : backlog >= 25 ? "warn" : "pass";
  const gates = gateRows
    .filter((r) => r.gateDiagnosis)
    .map((r) => `${r.gateDiagnosis}=${r._count._all}`)
    .join(", ");
  return {
    key: "admin_worker_build_ready_drain",
    label: "Build → publish drain",
    status,
    score: status === "pass" ? 1 : 0.5,
    lastCheckedAt: now,
    dataSource: "AdminWorkerPackageArtifact.status + gateDiagnosis",
    summary:
      backlog === 0
        ? "No built artifacts waiting; the pipeline is draining to publish."
        : `${stuck} awaiting QA/verification, ${readyToPublish} QA-passed awaiting publish.${gates ? ` Gates: ${gates}.` : ""}`,
    recommendedRepair:
      backlog >= 25
        ? "Inspect the per-gate breakdown; the drain routes repairable items automatically — a persistent backlog means missing validation evidence or an unmet QA dimension."
        : undefined,
  };
}

// Cache the outbound reachability probe so diagnostics renders don't hit the
// network on every call (one probe per process per interval).
type OutboundProbeResult = Awaited<
  ReturnType<typeof import("./outbound-network").probeOutboundReachability>
>;
let outboundProbeCache: { at: number; result: OutboundProbeResult } | null = null;
const OUTBOUND_PROBE_TTL_MS = 5 * 60 * 1000;

/**
 * Outbound reachability is a property of the machine that RUNS the worker, and
 * that machine is now the operator's Mac (spec §1). So:
 *
 *   - in a worker runtime we probe live and PERSIST the result, and
 *   - anywhere else (notably the Railway web service rendering
 *     /admin/diagnostics) we report the worker's last recorded measurement and
 *     make no outbound requests at all.
 *
 * That keeps the production web service from spending network calls on worker
 * telemetry, and stops the page reporting Railway's egress as if it were the
 * worker's — which in the new architecture would simply be wrong.
 */
const EGRESS_MEMORY_KEY = "worker.egress.probe";

async function ratingOutboundNetworkFromMemory(prisma: PrismaClient): Promise<HealthRating> {
  const now = new Date();
  const row = await prisma.adminWorkerMemory
    .findUnique({
      where: { memoryType_memoryKey: { memoryType: "GENERIC", memoryKey: EGRESS_MEMORY_KEY } },
      select: { memoryValue: true, updatedAt: true },
    })
    .catch(() => null);
  const value = (row?.memoryValue ?? null) as {
    at?: string;
    hostLabel?: string;
    summary?: string;
    status?: HealthStatus;
    score?: number;
  } | null;

  if (!value?.summary) {
    return {
      key: "admin_worker_outbound_network",
      label: "Outbound internet reachability",
      status: "unknown",
      score: 0,
      lastCheckedAt: now,
      dataSource: "measured on the Admin Worker's execution host",
      summary:
        "Not measured here. Outbound reachability belongs to the machine running the Admin Worker " +
        "(the operator's Mac); switch the worker on to record it. The production web service makes " +
        "no probe requests.",
    };
  }
  const ageMs = value.at ? now.getTime() - Date.parse(value.at) : null;
  const ageNote =
    ageMs != null && Number.isFinite(ageMs)
      ? ` (measured ${ageMs < 3_600_000 ? `${Math.round(ageMs / 60_000)}m` : `${Math.round(ageMs / 3_600_000)}h`} ago on ${value.hostLabel ?? "the worker host"})`
      : "";
  return {
    key: "admin_worker_outbound_network",
    label: "Outbound internet reachability",
    status: value.status ?? "unknown",
    score: value.score ?? 0,
    lastCheckedAt: now,
    dataSource: "AdminWorkerMemory(worker.egress.probe) — recorded by the local worker",
    summary: `${value.summary}${ageNote}`,
  };
}

async function ratingOutboundNetwork(prisma: PrismaClient): Promise<HealthRating> {
  const now = new Date();
  // Never probe from the production web service.
  if (!workerExecutionAllowed()) return ratingOutboundNetworkFromMemory(prisma);
  try {
    const { probeOutboundReachability } = await import("./outbound-network");
    if (!outboundProbeCache || Date.now() - outboundProbeCache.at > OUTBOUND_PROBE_TTL_MS) {
      outboundProbeCache = { at: Date.now(), result: await probeOutboundReachability(6000) };
    }
    const { proxy, hosts } = outboundProbeCache.result;
    const reachable = hosts.filter((h) => h.reachable).length;
    const skipped = hosts.every((h) => h.detail.startsWith("skipped"));
    // Health keys off CRITICAL hosts (Wikipedia + Vatican). query.wikidata.org
    // is best-effort: managed hosts' datacenter IPs are commonly blocked by
    // Wikidata's WDQS specifically, and the worker already falls back to alternate
    // SPARQL endpoints + Wikipedia for the same facts. So a blocked WDQS with the
    // critical hosts reachable is a HEALTHY, handled state — not an egress fault.
    const criticalHosts = hosts.filter((h) => h.critical);
    const criticalReachable = criticalHosts.filter((h) => h.reachable).length;
    const bestEffortBlocked = hosts.filter((h) => !h.critical && !h.reachable);
    const status: HealthStatus = skipped
      ? "warn"
      : criticalReachable === criticalHosts.length
        ? "pass"
        : criticalReachable === 0
          ? "fail"
          : "warn";
    const proxyNote = proxy.installed
      ? `via proxy (${proxy.mode})`
      : "direct egress (no proxy env set)";
    const bestEffortNote =
      status === "pass" && bestEffortBlocked.length > 0
        ? ` ${bestEffortBlocked
            .map((h) => h.host)
            .join(", ")} blocked but non-critical (fallback in place).`
        : "";
    const score = skipped ? 0.5 : criticalReachable / Math.max(1, criticalHosts.length);
    const summary = `${reachable}/${hosts.length} key hosts reachable ${proxyNote}. ${hosts
      .map(
        (h) => `${h.host}=${h.reachable ? "ok" : "blocked"}${h.critical ? "" : " (best-effort)"}`,
      )
      .join(", ")}.${bestEffortNote}`;

    // Record it so the browser diagnostics page can show the worker host's real
    // egress without making any request of its own. Fail-open.
    try {
      const { localHostLabel } = await import("./local-resources");
      await prisma.adminWorkerMemory.upsert({
        where: { memoryType_memoryKey: { memoryType: "GENERIC", memoryKey: EGRESS_MEMORY_KEY } },
        create: {
          memoryType: "GENERIC",
          memoryKey: EGRESS_MEMORY_KEY,
          memoryValue: {
            at: now.toISOString(),
            hostLabel: localHostLabel(),
            status,
            score,
            summary,
          },
          confidence: 1,
          lastUsedAt: now,
        },
        update: {
          memoryValue: {
            at: now.toISOString(),
            hostLabel: localHostLabel(),
            status,
            score,
            summary,
          },
          lastUsedAt: now,
        },
      });
    } catch {
      /* telemetry only */
    }

    return {
      key: "admin_worker_outbound_network",
      label: "Outbound internet reachability",
      status,
      // Score off critical-host reachability so a best-effort block (wikidata)
      // doesn't drag a healthy egress state down.
      score,
      lastCheckedAt: now,
      dataSource: "live probe: wikidata / wikipedia / vatican.va",
      summary: `${reachable}/${hosts.length} key hosts reachable ${proxyNote}. ${hosts
        .map(
          (h) => `${h.host}=${h.reachable ? "ok" : "blocked"}${h.critical ? "" : " (best-effort)"}`,
        )
        .join(", ")}.${bestEffortNote}`,
      recommendedRepair:
        !skipped && criticalReachable < criticalHosts.length
          ? "The deployment's network policy is blocking outbound egress to a CRITICAL host. Allow outbound HTTPS to these hosts, or set HTTPS_PROXY (+ NODE_EXTRA_CA_CERTS if the proxy uses a private CA) so the worker reaches the open internet — the worker code already permits any host."
          : undefined,
    };
  } catch (err) {
    return {
      key: "admin_worker_outbound_network",
      label: "Outbound internet reachability",
      status: "unknown",
      score: 0,
      lastCheckedAt: now,
      dataSource: "live probe",
      summary: `Probe error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

async function ratingWorkerLanes(prisma: PrismaClient): Promise<HealthRating> {
  // Adaptive-worker Phase B: the internal-lane scheduler records each lane's
  // live state (status, current item/gate/strategy, last outcome/error). This
  // rating surfaces lane health + is the operational-self-awareness signal:
  // which lanes ran, which are in error-backoff, and what each last did.
  const now = new Date();
  const lanes = await prisma.adminWorkerLaneState
    .findMany({
      orderBy: { lane: "asc" },
      select: {
        lane: true,
        status: true,
        currentStrategy: true,
        lastOutcome: true,
        lastError: true,
        lastFinishedAt: true,
        concurrentTasks: true,
        capacity: true,
      },
    })
    .catch(
      () =>
        [] as Array<{
          lane: string;
          status: string;
          currentStrategy: string | null;
          lastOutcome: string | null;
          lastError: string | null;
          lastFinishedAt: Date | null;
          concurrentTasks: number;
          capacity: number;
        }>,
    );

  if (lanes.length === 0) {
    return {
      key: "admin_worker_lanes",
      label: "Internal worker lanes",
      status: "warn",
      score: 0.5,
      lastCheckedAt: now,
      dataSource: "AdminWorkerLaneState",
      summary: "No lane state recorded yet — the worker runs lanes on its next pass.",
      recommendedRepair: "Run a worker pass; runWorkerLanes records each lane's live state.",
    };
  }

  const errored = lanes.filter((l) => l.status === "error");
  const running = lanes.filter((l) => l.status === "running");
  // A lane stuck "running" long after its last finish likely crashed mid-lane;
  // surface as warn (its artifact leases expire and get reaped regardless).
  const status: HealthStatus = errored.length > 2 ? "fail" : errored.length > 0 ? "warn" : "pass";
  const detail = lanes
    .map((l) => `${l.lane}:${l.status}${l.status === "error" && l.lastError ? "(!)" : ""}`)
    .join(", ");
  return {
    key: "admin_worker_lanes",
    label: "Internal worker lanes",
    status,
    score: status === "pass" ? 1 : status === "warn" ? 0.6 : 0.2,
    lastCheckedAt: now,
    dataSource: "AdminWorkerLaneState",
    latestFailure: errored[0]?.lastFinishedAt ?? null,
    currentBlocker: errored[0]?.lastError ?? undefined,
    summary: `${lanes.length} lane(s): ${running.length} running, ${errored.length} in error-backoff. ${detail}`,
    recommendedRepair:
      errored.length > 0
        ? `Lanes in error-backoff auto-retry after their cooldown; inspect ${errored.map((l) => l.lane).join(", ")} if the error persists across passes.`
        : undefined,
  };
}

async function ratingStrategyMemory(prisma: PrismaClient): Promise<HealthRating> {
  // Adaptive-worker Phase C/D: per-method strategy memory + innovation lab.
  // Surfaces how much the worker has learned about which METHOD works
  // (AdminWorkerStrategyStat) and the most recent bounded experiment's verdict.
  const now = new Date();
  const [stats, lastExperiment] = await Promise.all([
    prisma.adminWorkerStrategyStat
      .findMany({
        orderBy: [{ dimension: "asc" }, { ewma: "desc" }],
        take: 50,
        select: { dimension: true, method: true, ewma: true, attempts: true },
      })
      .catch(
        () => [] as Array<{ dimension: string; method: string; ewma: number; attempts: number }>,
      ),
    prisma.labExperimentResult
      .findFirst({
        orderBy: { createdAt: "desc" },
        select: { leader: true, conclusive: true, lesson: true, createdAt: true },
      })
      .catch(() => null),
  ]);

  if (stats.length === 0) {
    return {
      key: "admin_worker_strategy_memory",
      label: "Strategy memory + innovation",
      status: "warn",
      score: 0.5,
      lastCheckedAt: now,
      dataSource: "AdminWorkerStrategyStat + LabExperimentResult",
      summary: "No per-method strategy stats yet — the worker records method outcomes as it runs.",
      recommendedRepair: "Run discovery passes; each records which method surfaced candidates.",
    };
  }

  // Best method per dimension (stats are pre-sorted ewma desc within dimension).
  const bestByDim = new Map<string, { method: string; ewma: number }>();
  for (const s of stats) {
    if (!bestByDim.has(s.dimension)) bestByDim.set(s.dimension, { method: s.method, ewma: s.ewma });
  }
  const summary = [...bestByDim.entries()]
    .map(([dim, b]) => `${dim}:${b.method}(${b.ewma.toFixed(2)})`)
    .join(", ");

  return {
    key: "admin_worker_strategy_memory",
    label: "Strategy memory + innovation",
    status: "pass",
    score: 1,
    lastCheckedAt: now,
    dataSource: "AdminWorkerStrategyStat + LabExperimentResult",
    latestSuccess: lastExperiment?.createdAt ?? null,
    summary: `${stats.length} method stat(s). Best per dimension: ${summary}.${
      lastExperiment
        ? ` Last experiment: ${lastExperiment.conclusive ? `winner ${lastExperiment.leader}` : "inconclusive"}.`
        : ""
    }`,
  };
}

async function ratingContentProtection(prisma: PrismaClient): Promise<HealthRating> {
  // Adaptive-worker Phase E: every automated edit to live published content is
  // snapshotted (PublishedContentVersion) so it is reversible, and destructive
  // overwrites are refused unless backed by quality + evidence. This rating
  // surfaces recent protection activity: versions captured (reversibility) and
  // destructive edits refused (good content preserved).
  const now = new Date();
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60_000);
  const [versions, recentVersions, blocked] = await Promise.all([
    prisma.publishedContentVersion.count().catch(() => 0),
    prisma.publishedContentVersion.count({ where: { createdAt: { gte: since } } }).catch(() => 0),
    prisma.adminWorkerLog
      .count({
        where: { eventName: "protected_update_blocked", createdAt: { gte: since } },
      })
      .catch(() => 0),
  ]);
  // Always pass: protection is a safety mechanism working. Blocked overwrites
  // are surfaced (warn) so an operator can review whether a genuine improvement
  // is being held back, but a preserved-content decision is never a failure.
  const status: HealthStatus = blocked > 10 ? "warn" : "pass";
  return {
    key: "admin_worker_content_protection",
    label: "Published-content protection",
    status,
    score: status === "pass" ? 1 : 0.7,
    lastCheckedAt: now,
    dataSource: "PublishedContentVersion + AdminWorkerLog(protected_update_blocked)",
    summary:
      versions === 0
        ? "No content versions captured yet — no live content has been edited."
        : `${versions} version snapshot(s) (reversible edits); ${recentVersions} in last 7d, ${blocked} destructive overwrite(s) refused.`,
    recommendedRepair:
      blocked > 10
        ? "Many destructive edits were refused — review whether legitimate improvements need higher quality/evidence to clear the protection gate."
        : undefined,
  };
}

async function ratingEscalations(prisma: PrismaClient): Promise<HealthRating> {
  const now = new Date();
  const [open, latest] = await Promise.all([
    prisma.adminWorkerEscalation.count({ where: { resolvedAt: null } }).catch(() => 0),
    prisma.adminWorkerEscalation
      .findFirst({
        where: { resolvedAt: null },
        orderBy: { createdAt: "desc" },
        select: { kind: true, severity: true, emailDelivery: true, occurrences: true },
      })
      .catch(() => null),
  ]);
  const status: HealthStatus = open === 0 ? "pass" : latest?.severity === "ERROR" ? "fail" : "warn";
  return {
    key: "admin_worker_escalations",
    label: "Worker escalations",
    status,
    score: status === "pass" ? 1 : status === "warn" ? 0.5 : 0,
    lastCheckedAt: now,
    dataSource: "AdminWorkerEscalation",
    summary:
      open === 0
        ? "No open escalations."
        : `${open} open escalation(s); latest ${latest?.kind ?? "?"} (${latest?.severity ?? "?"}), ×${latest?.occurrences ?? 1}, email ${latest?.emailDelivery ?? "?"}.`,
    recommendedRepair:
      open > 0
        ? "Review the escalation email + Admin Worker Escalation.pdf and resolve the underlying condition; it auto-resolves once the condition clears."
        : undefined,
  };
}

async function ratingCodeVersion(prisma: PrismaClient): Promise<HealthRating> {
  const now = new Date();
  const latest = await prisma.adminWorkerCodeVersion
    .findFirst({ orderBy: { capturedAt: "desc" } })
    .catch(() => null);
  const status: HealthStatus = latest ? "pass" : "unknown";
  return {
    key: "admin_worker_code_version",
    label: "Code / version memory",
    status,
    score: latest ? 1 : 0,
    lastCheckedAt: now,
    dataSource: "AdminWorkerCodeVersion",
    latestSuccess: latest?.capturedAt ?? null,
    summary: latest
      ? `Running ${latest.versionLabel}${latest.sha ? ` (${latest.sha.slice(0, 8)})` : ""}; recorded ${latest.capturedAt
          .toISOString()
          .slice(0, 19)}.${latest.changedSummary ? ` ${latest.changedSummary}` : ""}`
      : "No code-version recorded yet — the worker records its running build at boot and on change.",
    recommendedRepair: latest ? undefined : "Restart the worker so it records its running build.",
  };
}

/* ------------------------------------------------------------------ */
/* self-maintenance                                                    */
/* ------------------------------------------------------------------ */

/** ~15-minute sweep cadence; six hours of silence means it stopped sweeping. */
const SELF_MAINT_STALE_MS = 6 * 60 * 60 * 1000;

async function selfMaintenanceOf(
  prisma: PrismaClient,
  ctx: DiagnosticsContext | undefined,
): Promise<SelfMaintenanceSummary | null> {
  if (ctx && ctx.selfMaintenance !== undefined) return ctx.selfMaintenance;
  return readSelfMaintenanceSummary(prisma).catch(() => null);
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${Math.round(bytes / 1024 ** 2)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

/**
 * Does the worker maintain ITSELF? The measured failure this rating exists for:
 * for three months the loop ran, wrote ~7 M telemetry rows, published nothing,
 * and no check anywhere said so. A healthy sweep reads as a calm "pass" — the
 * absence of repairs is the good outcome, not an empty state.
 */
async function ratingSelfMaintenance(
  prisma: PrismaClient,
  ctx: DiagnosticsContext,
): Promise<HealthRating> {
  const now = new Date();
  const s = await selfMaintenanceOf(prisma, ctx);
  const base = {
    key: "admin_worker_self_maintenance",
    label: "Self-maintenance",
    lastCheckedAt: now,
    dataSource: "AdminWorkerMemory(self-maintenance:*) + AdminWorkerLog(self_maintenance_*)",
    // The sweep IS the automatic repair for these conditions, so it is never
    // "manual" — it is in progress whenever it has something open.
    automaticRepairStatus: "available" as const,
  };

  if (!s || !s.everRan) {
    return {
      ...base,
      status: "unknown",
      score: 0,
      summary:
        "Self-maintenance has not swept yet — it sweeps every ~15 minutes from the maint-self-heal lane while the worker is on.",
    };
  }

  const ageMs = (s.lastSweepAgeSeconds ?? 0) * 1000;
  const parts = [s.headline];
  if (s.repairsApplied24h > 0) {
    parts.push(`${s.repairsApplied24h} repair action(s) in the last 24 h.`);
  }
  if (s.contentRestored24h > 0) {
    parts.push(`${s.contentRestored24h} content row(s) restored.`);
  }
  const summary = parts.join(" ");

  if (s.backedOff.length > 0 || s.escalations.length > 0) {
    const stuck = s.backedOff[0];
    return {
      ...base,
      status: "fail",
      score: 0,
      latestFailure: stuck?.until ?? s.escalations[0]?.at ?? null,
      automaticRepairStatus: "in_progress",
      currentBlocker: stuck
        ? `${stuck.condition} did not improve after ${stuck.failures} repair(s)`
        : `${s.escalations.length} self-maintenance escalation(s)`,
      summary,
      recommendedRepair:
        "The worker repaired this repeatedly and the signal never moved — read the self_maintenance_action rows and fix the underlying cause; it retries after its back-off.",
    };
  }

  if (s.conditions.length > 0) {
    const critical = s.conditions.some((c) => c.severity === "critical");
    return {
      ...base,
      status: critical ? "fail" : "warn",
      score: critical ? 0.25 : 0.5,
      automaticRepairStatus: "in_progress",
      summary,
      recommendedRepair: `The sweep applies ${s.conditions[0]?.remedy ?? "its remedy"} on its next run — confirm the condition clears.`,
    };
  }

  if (ageMs > SELF_MAINT_STALE_MS) {
    return withExecutionAwareness(
      {
        ...base,
        status: "warn",
        score: 0.5,
        latestSuccess: s.lastSweepAt,
        summary: `${summary} No sweep for ${Math.round(ageMs / 3_600_000)}h — the maint-self-heal lane has not run.`,
        recommendedRepair:
          "Check the worker loop is running and ADMIN_WORKER_SELF_MAINT is not set to 0.",
      },
      ctx,
    );
  }

  return {
    ...base,
    status: "pass",
    score: 1,
    latestSuccess: s.lastSweepAt,
    summary,
  };
}

/**
 * The worker's own storage footprint, from the sweep's persisted measurement.
 * Never measures anything here: pg_database_size on an admin page request is a
 * cost the sweep already paid.
 */
async function ratingSelfMaintenanceLedger(
  prisma: PrismaClient,
  ctx: DiagnosticsContext,
): Promise<HealthRating> {
  const now = new Date();
  const s = await selfMaintenanceOf(prisma, ctx);
  const size = s?.size ?? null;
  const base = {
    key: "admin_worker_ledger_size",
    label: "Worker ledger size",
    lastCheckedAt: now,
    dataSource: "AdminWorkerMemory(self-maintenance:last-result)",
    automaticRepairStatus: "available" as const,
  };

  if (!size) {
    return {
      ...base,
      status: "unknown",
      score: 0,
      summary:
        "Ledger size not measured yet — the self-maintenance sweep records it on its first run.",
    };
  }

  const dbOver =
    size.databaseThresholdBytes > 0 && size.databaseBytes >= size.databaseThresholdBytes;
  const rowsOver = size.rowThreshold > 0 && size.largestTableRows >= size.rowThreshold;
  const summary =
    `Database ${formatBytes(size.databaseBytes)}` +
    (size.databaseThresholdBytes > 0
      ? ` (trim threshold ${formatBytes(size.databaseThresholdBytes)})`
      : "") +
    (size.largestTable
      ? `; largest telemetry table ${size.largestTable} at ${size.largestTableRows.toLocaleString("en-US")} rows` +
        (size.rowThreshold > 0 ? ` (threshold ${size.rowThreshold.toLocaleString("en-US")})` : "")
      : "") +
    ".";

  if (dbOver || rowsOver) {
    return {
      ...base,
      status: dbOver && rowsOver ? "fail" : "warn",
      score: dbOver && rowsOver ? 0 : 0.5,
      automaticRepairStatus: "in_progress",
      summary,
      recommendedRepair:
        "The sweep trims the telemetry tables on its retention window; reclaiming already-lost space needs an operator VACUUM FULL.",
    };
  }

  return { ...base, status: "pass", score: 1, latestSuccess: size.measuredAt, summary };
}

const RATINGS: ReadonlyArray<RatingFn> = [
  ratingOverall,
  ratingBrain,
  ratingMissionPlanner,
  ratingHeartbeat,
  ratingLastPassTime,
  ratingLastTaskTime,
  ratingQueue,
  ratingTaskPlanning,
  ratingSourceDiscovery,
  ratingFetcher,
  ratingSourceReading,
  ratingSourceReputation,
  ratingSourceCoverage,
  ratingClassification,
  ratingBuilding,
  ratingFormatting,
  ratingCandidateScoring,
  ratingExtractors,
  ratingChecklistBridge,
  ratingVerifier,
  ratingCrossSource,
  ratingStructuredBlocks,
  ratingPackageArtifacts,
  ratingStrictQa,
  ratingQualityScoring,
  ratingPublishing,
  ratingPublicRender,
  ratingSearchVisibility,
  ratingSitemapVisibility,
  ratingCacheFreshness,
  ratingHomepage,
  ratingCleanupCustodian,
  ratingHumanReview,
  ratingSecurity,
  ratingEmailHealth,
  ratingMonthlyReport,
  ratingDatabaseHealth,
  ratingSchemaIntegrity,
  ratingEnvironmentHealth,
  ratingContentGoals,
  ratingGrowthOrchestrator,
  ratingRepairOrchestrator,
  ratingPostPublish,
  ratingRollback,
  ratingBuildReadyDrain,
  ratingWorkerLanes,
  ratingOutboundNetwork,
  ratingStrategyMemory,
  ratingContentProtection,
  ratingEscalations,
  ratingCodeVersion,
  ratingSelfMaintenance,
  ratingSelfMaintenanceLedger,
];

export async function runAdminWorkerDiagnostics(prisma: PrismaClient): Promise<HealthRating[]> {
  // One execution-status read for the whole run (see DiagnosticsContext).
  const [execution, selfMaintenance] = await Promise.all([
    readExecutionStatus(prisma).catch(() => null),
    // One persisted-snapshot read shared by the self-maintenance ratings.
    readSelfMaintenanceSummary(prisma).catch(() => null),
  ]);
  const ctx: DiagnosticsContext = { execution, selfMaintenance };
  const results: HealthRating[] = await Promise.all(
    RATINGS.map((r) =>
      r(prisma, ctx).catch(
        (err): HealthRating => ({
          key: "admin_worker_rating_error",
          label: "Rating error",
          status: "fail" as HealthStatus,
          score: 0,
          lastCheckedAt: new Date(),
          dataSource: "?",
          summary: err instanceof Error ? err.message : String(err),
        }),
      ),
    ),
  );

  // Spec §13: annotate each rating with its automatic-repair status.
  // One query for all open repair plans, grouped by kind. Wrapped in a
  // try/catch (not just .catch) so a mock or client without groupBy
  // degrades gracefully instead of throwing synchronously.
  const openPlans = await (async () => {
    try {
      const rows = await prisma.adminWorkerRepairPlan.groupBy({
        by: ["kind"],
        where: { status: { in: ["PENDING", "RUNNING"] } },
        _count: { _all: true },
      });
      return rows as Array<{ kind: string; _count: { _all: number } }>;
    } catch {
      return [] as Array<{ kind: string; _count: { _all: number } }>;
    }
  })();
  const openKinds = new Set(openPlans.filter((p) => p._count._all > 0).map((p) => p.kind));

  for (const rating of results) {
    // A rating that already knows its own repair status keeps it: the
    // self-maintenance ratings are repaired by the sweep itself, which files no
    // AdminWorkerRepairPlan, so the plan-kind map cannot speak for them.
    if (rating.automaticRepairStatus) continue;
    const kinds = RATING_REPAIR_KINDS[rating.key];
    if (!kinds) {
      rating.automaticRepairStatus = "manual";
    } else if (kinds.some((k) => openKinds.has(k))) {
      rating.automaticRepairStatus = "in_progress";
    } else {
      rating.automaticRepairStatus = "available";
    }
  }

  return results;
}

export function summarizeRatings(ratings: ReadonlyArray<HealthRating>): {
  pass: number;
  warn: number;
  fail: number;
  unknown: number;
} {
  const out = { pass: 0, warn: 0, fail: 0, unknown: 0 };
  for (const r of ratings) out[r.status]++;
  return out;
}
