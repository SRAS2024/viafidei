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

export type HealthStatus = "pass" | "warn" | "fail" | "unknown";

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
type RatingFn = (prisma: PrismaClient) => Promise<HealthRating>;

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

async function ratingHeartbeat(prisma: PrismaClient): Promise<HealthRating> {
  const state = await prisma.adminWorkerState
    .findUnique({ where: { id: "singleton" } })
    .catch(() => null);
  const last = state?.lastHeartbeatAt ?? null;
  const now = new Date();
  const ageMs = last ? now.getTime() - last.getTime() : Infinity;
  let status: HealthStatus = "fail";
  if (ageMs < 60_000) status = "pass";
  else if (ageMs < 5 * 60_000) status = "warn";
  return {
    key: "admin_worker_heartbeat",
    label: "Heartbeat",
    status,
    score: status === "pass" ? 1 : status === "warn" ? 0.5 : 0,
    lastCheckedAt: now,
    dataSource: "AdminWorkerState.lastHeartbeatAt",
    latestSuccess: last,
    summary: last ? `Last heartbeat ${Math.round(ageMs / 1000)}s ago.` : "No heartbeat recorded.",
    recommendedRepair: status === "fail" ? "Restart the Admin Worker process." : undefined,
  };
}

async function ratingQueue(prisma: PrismaClient): Promise<HealthRating> {
  const [pending, failed, lastSuccess, lastFailure] = await Promise.all([
    prisma.workerBuildJob.count({ where: { status: "pending" } }),
    prisma.workerBuildJob.count({ where: { status: "failed" } }),
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
  const status: HealthStatus =
    failed > pending && failed > 5 ? "fail" : failed > 0 ? "warn" : "pass";
  return {
    key: "admin_worker_queue",
    label: "Queue processing",
    status,
    score: status === "pass" ? 1 : status === "warn" ? 0.6 : 0.2,
    lastCheckedAt: new Date(),
    dataSource: "WorkerBuildJob",
    summary: `${pending} pending, ${failed} failed.`,
    latestSuccess: lastSuccess?.finishedAt ?? null,
    latestFailure: lastFailure?.finishedAt ?? null,
    currentBlocker: lastFailure?.errorMessage ?? undefined,
    recommendedRepair: failed > 0 ? "Inspect failed jobs at /admin/checklist/failed." : undefined,
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
  const total = await prisma.postPublishVerification.count();
  const failed = await prisma.postPublishVerification.count({ where: { result: "FAIL" } });
  const status: HealthStatus = total === 0 ? "warn" : failed > 0 ? "fail" : "pass";
  return {
    key: "admin_worker_post_publish",
    label: "Post-publish verification",
    status,
    score: status === "pass" ? 1 : status === "warn" ? 0.5 : 0.2,
    lastCheckedAt: new Date(),
    dataSource: "PostPublishVerification",
    summary: `${total} verified, ${failed} failed.`,
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

async function ratingContentGoals(prisma: PrismaClient): Promise<HealthRating> {
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
  return {
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
            progressing ? " (progressing)" : " (STALLED)"
          }${behind.length ? ` — largest gaps: ${behind.join(", ")}` : ""}.`,
    recommendedRepair: progressing
      ? undefined
      : totalGap > 0
        ? "No content published in the last 7 days despite an open gap — the growth pipeline is stalled. Advance the below-target types (prioritize + fetch existing candidates, extract, build, publish)."
        : undefined,
  };
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
  const [total, passed, latest, eligible] = await Promise.all([
    prisma.adminWorkerStrictQAResult.count({ where: { createdAt: { gte: since } } }).catch(() => 0),
    prisma.adminWorkerStrictQAResult
      .count({ where: { createdAt: { gte: since }, status: "PASSED" } })
      .catch(() => 0),
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
  if (total === 0) {
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

  const passRate = passed / total;
  const status: HealthStatus = passRate >= 0.7 ? "pass" : passRate >= 0.4 ? "warn" : "fail";
  return {
    key: "admin_worker_strict_qa",
    label: "Strict QA (AdminWorkerStrictQAResult)",
    status,
    score: status === "pass" ? Math.min(1, passRate) : status === "warn" ? 0.5 : 0,
    lastCheckedAt: now,
    dataSource: "AdminWorkerStrictQAResult (last 7d)",
    latestSuccess: latest?.createdAt,
    summary: `${passed}/${total} artifacts passed strict QA (${Math.round(passRate * 100)}%); latest finalScore=${latest?.finalScore.toFixed(2) ?? "?"}.`,
    recommendedRepair:
      status === "fail"
        ? "Investigate strict-QA blocking reasons; review NEEDS_REPAIR artifacts."
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
  // Spec §13: checklist + citation bridge — artifacts with a
  // checklistItemId have been promoted to checklist items.
  const now = new Date();
  const [total, bridged] = await Promise.all([
    prisma.adminWorkerPackageArtifact.count().catch(() => 0),
    prisma.adminWorkerPackageArtifact
      .count({ where: { checklistItemId: { not: null } } })
      .catch(() => 0),
  ]);
  const rate = total === 0 ? 0 : bridged / total;
  const status: HealthStatus =
    total === 0 ? "warn" : rate >= 0.6 ? "pass" : rate >= 0.3 ? "warn" : "fail";
  return {
    key: "admin_worker_checklist_bridge",
    label: "Checklist + citation bridge",
    status,
    score: status === "pass" ? 1 : status === "warn" ? 0.5 : 0,
    lastCheckedAt: now,
    dataSource: "AdminWorkerPackageArtifact.checklistItemId",
    summary:
      total === 0
        ? "No package artifacts to bridge yet."
        : `${bridged}/${total} artifacts bridged to ChecklistItem (${Math.round(rate * 100)}%).`,
    recommendedRepair:
      status === "fail"
        ? "Run the CHECKLIST_CREATION / CITATION_CREATION dispatcher stages."
        : undefined,
  };
}

async function ratingPublicRender(prisma: PrismaClient): Promise<HealthRating> {
  const fails = await prisma.postPublishVerification.count({ where: { publicPageCheck: "FAIL" } });
  return {
    key: "admin_worker_public_render",
    label: "Public render gate",
    status: fails === 0 ? "pass" : "fail",
    score: fails === 0 ? 1 : 0.2,
    lastCheckedAt: new Date(),
    dataSource: "PostPublishVerification",
    summary: `${fails} public render failures.`,
  };
}

async function ratingSearchVisibility(prisma: PrismaClient): Promise<HealthRating> {
  const fails = await prisma.postPublishVerification.count({ where: { searchCheck: "FAIL" } });
  return {
    key: "admin_worker_search",
    label: "Search visibility",
    status: fails === 0 ? "pass" : "warn",
    score: fails === 0 ? 1 : 0.5,
    lastCheckedAt: new Date(),
    dataSource: "PostPublishVerification",
    summary: `${fails} search visibility failures.`,
  };
}

async function ratingSitemapVisibility(prisma: PrismaClient): Promise<HealthRating> {
  const fails = await prisma.postPublishVerification.count({ where: { sitemapCheck: "FAIL" } });
  return {
    key: "admin_worker_sitemap",
    label: "Sitemap visibility",
    status: fails === 0 ? "pass" : "warn",
    score: fails === 0 ? 1 : 0.5,
    lastCheckedAt: new Date(),
    dataSource: "PostPublishVerification",
    summary: `${fails} sitemap visibility failures.`,
  };
}

async function ratingCacheFreshness(prisma: PrismaClient): Promise<HealthRating> {
  const fails = await prisma.postPublishVerification.count({ where: { cacheCheck: "FAIL" } });
  return {
    key: "admin_worker_cache",
    label: "Cache freshness",
    status: fails === 0 ? "pass" : "warn",
    score: fails === 0 ? 1 : 0.5,
    lastCheckedAt: new Date(),
    dataSource: "PostPublishVerification",
    summary: `${fails} cache freshness failures.`,
  };
}

async function ratingLastPassTime(prisma: PrismaClient): Promise<HealthRating> {
  const recent = await prisma.adminWorkerPass.findFirst({
    orderBy: { startedAt: "desc" },
    select: { startedAt: true, status: true },
  });
  const now = new Date();
  const ageMs = recent ? now.getTime() - recent.startedAt.getTime() : Infinity;
  const status: HealthStatus = ageMs < 10 * 60_000 ? "pass" : ageMs < 60 * 60_000 ? "warn" : "fail";
  return {
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
  };
}

async function ratingLastTaskTime(prisma: PrismaClient): Promise<HealthRating> {
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
  return {
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
  };
}

// ── Spec §18 subsystem ratings ─────────────────────────────────────

async function ratingBrain(prisma: PrismaClient): Promise<HealthRating> {
  const now = new Date();
  const decision = await prisma.adminWorkerDecision
    .findFirst({ where: { decisionType: "brain_pass" }, orderBy: { createdAt: "desc" } })
    .catch(() => null);
  if (!decision) {
    return {
      key: "admin_worker_brain",
      label: "Admin Worker decision engine",
      status: "fail",
      score: 0,
      lastCheckedAt: now,
      dataSource: "AdminWorkerDecision.decisionType=brain_pass",
      summary: "No Admin Worker decisions recorded yet.",
      recommendedRepair: "Run a worker pass — the Admin Worker writes a decision on every cycle.",
    };
  }
  const ageMs = now.getTime() - decision.createdAt.getTime();
  const status: HealthStatus = ageMs < 10 * 60_000 ? "pass" : ageMs < 60 * 60_000 ? "warn" : "fail";
  return {
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
  };
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

async function ratingFetcher(prisma: PrismaClient): Promise<HealthRating> {
  const now = new Date();
  const since = new Date(now.getTime() - 24 * 60 * 60_000);
  const [recent, succeeded] = await Promise.all([
    prisma.adminWorkerFetchResult.count({ where: { createdAt: { gte: since } } }).catch(() => 0),
    prisma.adminWorkerFetchResult
      .count({ where: { createdAt: { gte: since }, succeeded: true } })
      .catch(() => 0),
  ]);
  const rate = recent === 0 ? 0 : succeeded / recent;
  const status: HealthStatus =
    recent === 0 ? "warn" : rate >= 0.8 ? "pass" : rate >= 0.5 ? "warn" : "fail";
  return {
    key: "admin_worker_fetcher",
    label: "Fetcher",
    status,
    score: status === "pass" ? 1 : status === "warn" ? 0.5 : 0,
    lastCheckedAt: now,
    dataSource: "AdminWorkerFetchResult (last 24h)",
    summary:
      recent === 0
        ? "No fetch attempts in last 24h."
        : `${succeeded}/${recent} fetches succeeded (${Math.round(rate * 100)}%).`,
    recommendedRepair:
      status === "fail"
        ? "Investigate fetch failures; check approved hosts and rate limits."
        : status === "warn"
          ? "Schedule a discovery pass to surface new candidates."
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
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [total, recent, pendingReview] = await Promise.all([
    prisma.adminWorkerRollbackLedger.count().catch(() => 0),
    prisma.adminWorkerRollbackLedger.count({ where: { createdAt: { gte: since } } }).catch(() => 0),
    prisma.adminWorkerRollbackLedger
      .count({ where: { humanReviewCreated: true, createdAt: { gte: since } } })
      .catch(() => 0),
  ]);
  return {
    key: "admin_worker_rollback",
    label: "Rollback ledger",
    status: recent === 0 ? "pass" : pendingReview > 0 ? "warn" : "pass",
    score: recent === 0 ? 1 : pendingReview > 0 ? 0.6 : 0.85,
    lastCheckedAt: new Date(),
    dataSource: "AdminWorkerRollbackLedger",
    summary:
      recent === 0
        ? `${total} rollback record(s); none in the last 7d.`
        : `${recent} rollback(s) in the last 7d${pendingReview > 0 ? `, ${pendingReview} awaiting human review` : ""}.`,
    recommendedRepair:
      pendingReview > 0
        ? "Review the human-review rollbacks in the rollback ledger and decide restore vs delete."
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

async function ratingOutboundNetwork(): Promise<HealthRating> {
  const now = new Date();
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
    return {
      key: "admin_worker_outbound_network",
      label: "Outbound internet reachability",
      status,
      // Score off critical-host reachability so a best-effort block (wikidata)
      // doesn't drag a healthy egress state down.
      score: skipped ? 0.5 : criticalReachable / Math.max(1, criticalHosts.length),
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
];

export async function runAdminWorkerDiagnostics(prisma: PrismaClient): Promise<HealthRating[]> {
  const results: HealthRating[] = await Promise.all(
    RATINGS.map((r) =>
      r(prisma).catch(
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
